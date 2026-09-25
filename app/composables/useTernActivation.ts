import type { ActivationDraft, TernActivation } from '~/components/reservations/data/tern-activation'
import { computed } from 'vue'
import {
  bankDraftToAccount,
  firstInvalidActivationStep,
  TERN_ACTIVATION_TERMS_VERSION,
  ternPayoutTarget,
  validateBankDraft,
} from '~/components/reservations/data/tern-activation'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useOnboarding } from '~/composables/useOnboarding'

const STORAGE_KEY = 'elev8-tern-activation-v1'

/** The mock Tern API round trip. Long enough for the spinner to be seen. */
const TERN_API_MOCK_MS = 1500

const SEEDED_AT = '2026-09-01T00:00:00.000Z'

/**
 * The demo tenant starts ACTIVE, so the seeded waiver stays and insurance
 * claims keep working; `replayActivation()` is how the flow is shown. Same
 * reason the onboarding default is a finished tenant.
 */
export function seedTernActivation(): TernActivation {
  return {
    status: 'active',
    termsVersion: TERN_ACTIVATION_TERMS_VERSION,
    acceptedAt: SEEDED_AT,
    acceptedBy: 'Komang Juliantara',
    // The demo onboarding state's subscription card.
    billingPaymentMethodId: 'pm_demo',
    payoutBank: {
      accountHolder: 'PT Elev8 Bali Mandiri',
      bankName: 'Bank Central Asia (BCA)',
      country: 'ID',
      accountNumber: '7890 1234 56',
      bicSwift: 'CENAIDJA',
    },
    ternOrganizationId: 'tern_org_demo_0001',
    registeredAt: SEEDED_AT,
    attempts: 1,
  }
}

export type ActivationResult = { ok: true } | { ok: false, reason: string }

/**
 * The damage waiver service for this tenant: activation, the payout bank
 * account and the Tern organization. The ONLY writer of it.
 *
 * ⚠️ No card is asked for. The per-stay fees go on the subscription card the
 * tenant saved at onboarding (`useOnboarding().subscription`), read here and
 * frozen as a reference at activation.
 *
 * The Tern API is MOCKED: `activate` is a timer that returns a `tern_org_` id,
 * or a failure with the switch on. A real integration would post
 * `ternRegistrationPayload` and store the id Tern answers with.
 *
 * It never reads `useDamageProtection`: that composable reads this one to
 * decide whether the waiver may be offered, so the dependency runs one way.
 */
export function useTernActivation() {
  const activation = useState<TernActivation>('tern-activation', seedTernActivation)
  const { currentUser } = useCurrentDashboardUser()
  const { subscription } = useOnboarding()

  /** The card saved at onboarding for the Elev8 subscription. Null if there is none. */
  const subscriptionPaymentMethodId = computed(() => subscription.value.stripePaymentMethodId)

  const isActive = computed(() => activation.value.status === 'active')
  const isRegistering = computed(() => activation.value.status === 'registering')
  /** Where Tern pays a claim, or null until the service is active. */
  const payoutTarget = computed(() => ternPayoutTarget(activation.value))

  // Guarded on storage availability rather than `import.meta.client`, which
  // Vitest does not substitute.
  function persist() {
    if (typeof localStorage === 'undefined')
      return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activation.value))
    }
    catch { /* quota or private mode */ }
  }

  function hydrate() {
    if (typeof localStorage === 'undefined')
      return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw)
        return
      const parsed = JSON.parse(raw) as TernActivation
      if (parsed && typeof parsed.status === 'string') {
        // A reload mid-registration never heard back: it did not register.
        activation.value = parsed.status === 'registering'
          ? { ...parsed, status: 'registration_failed', lastError: 'The page was closed before Tern answered. Try again.' }
          : parsed
      }
    }
    catch { /* corrupt payload, keep the seed */ }
  }

  /**
   * Accept the terms, store the bank account, take the subscription card for
   * the per-stay fees, and register the tenant as an organization on Tern. Every step is checked again here: the
   * wizard gates each one, but this is the door that writes.
   *
   * A failed registration keeps what was entered, so trying again does not
   * mean typing the bank account twice.
   */
  async function activate(
    draft: ActivationDraft,
    _organizationName: string,
    forceFailure = false,
  ): Promise<ActivationResult> {
    if (activation.value.status === 'active')
      return { ok: false, reason: 'already_active' }
    if (activation.value.status === 'registering')
      return { ok: false, reason: 'already_registering' }
    const invalid = firstInvalidActivationStep(draft)
    if (invalid)
      return { ok: false, reason: `invalid_${invalid}` }
    // Without a subscription card there is nowhere to charge the per-stay fees.
    const paymentMethodId = subscriptionPaymentMethodId.value
    if (!paymentMethodId)
      return { ok: false, reason: 'no_subscription_card' }

    const acceptedAt = new Date().toISOString()
    const bank = bankDraftToAccount(draft.bank)
    activation.value = {
      ...activation.value,
      status: 'registering',
      termsVersion: TERN_ACTIVATION_TERMS_VERSION,
      acceptedAt,
      acceptedBy: currentUser.value?.name ?? 'Staff',
      billingPaymentMethodId: paymentMethodId,
      payoutBank: bank,
      bankCopiedFromTemplateId: draft.bankCopiedFromTemplateId,
      lastError: undefined,
      attempts: (activation.value.attempts ?? 0) + 1,
    }
    persist()

    // A real integration posts `ternRegistrationPayload(organizationName, bank, acceptedAt)`
    // here and stores the organization id Tern answers with.
    await new Promise(resolve => setTimeout(resolve, TERN_API_MOCK_MS))

    if (forceFailure) {
      activation.value = {
        ...activation.value,
        status: 'registration_failed',
        lastError: 'Tern could not register the organization. Nothing was charged.',
      }
      persist()
      return { ok: false, reason: 'registration_failed' }
    }

    activation.value = {
      ...activation.value,
      status: 'active',
      ternOrganizationId: `tern_org_${Date.now().toString(36)}`,
      registeredAt: new Date().toISOString(),
    }
    persist()
    return { ok: true }
  }

  /**
   * Change where Tern pays, once active. Claims already filed keep the account
   * frozen on them at filing; only new ones go to the new account.
   */
  function updatePayoutBank(bankDraft: ActivationDraft['bank'], copiedFromTemplateId?: string): ActivationResult {
    if (activation.value.status !== 'active')
      return { ok: false, reason: 'not_active' }
    if (Object.keys(validateBankDraft(bankDraft)).length)
      return { ok: false, reason: 'invalid_bank' }
    activation.value = {
      ...activation.value,
      payoutBank: bankDraftToAccount(bankDraft),
      bankCopiedFromTemplateId: copiedFromTemplateId,
    }
    persist()
    return { ok: true }
  }

  /** Demo only: back to the start, so the activation flow can be shown again. */
  function replayActivation() {
    activation.value = { status: 'not_activated' }
    persist()
  }

  return {
    activation,
    isActive,
    isRegistering,
    payoutTarget,
    subscriptionPaymentMethodId,
    hydrate,
    activate,
    updatePayoutBank,
    replayActivation,
  }
}
