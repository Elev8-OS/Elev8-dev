import type {
  ChecklistItemCode,
  ImportJob,
  OnboardingPromoCode,
  OnboardingState,
  OnboardingStatus,
  OnboardingStep,
  OrderSelection,
  PmsModel,
  PricingModel,
  PromoValidationResult,
  TenantProfile,
} from '~/components/onboarding/data/onboarding'
import {
  billableUnits,
  buildOrderSummary,
  canAdvance,
  CHANNEL_OPTIONS,
  checklistProgress,
  createChecklist,
  createDefaultOnboardingState,
  createImportJobs,
  createNewTenantState,
  discountFor,
  integrationPathFor,
  isModuleAvailable,
  ONBOARDING_STORAGE_KEY,
  perBookingPlanByCode,
  perUnitPlanByCode,
  stepForStatus,
  subtotalFor,
  validateProfile,
} from '~/components/onboarding/data/onboarding'

/** Mock latencies, so loading states are visible rather than instant. */
const STRIPE_DELAY_MS = 1500
const CALRY_AUTH_DELAY_MS = 1600
const IMPORT_TICK_MS = 320

export function useOnboarding() {
  const state = useState<OnboardingState>('tenant-onboarding', createDefaultOnboardingState)
  const isHydrated = useState<boolean>('tenant-onboarding-hydrated', () => false)
  const isSavingPayment = useState<boolean>('tenant-onboarding-saving-payment', () => false)
  const isConnectingPms = useState<boolean>('tenant-onboarding-connecting-pms', () => false)
  const appliedPromo = useState<OnboardingPromoCode | null>('tenant-onboarding-promo', () => null)

  // ── Persistence ────────────────────────────────────────────────────────────

  /**
   * `import.meta.client` is not substituted under Vitest, so guard on storage
   * availability instead. That is SSR correct and testable.
   */
  function storage(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage
    }
    catch {
      return null
    }
  }

  function persist(): void {
    const store = storage()
    if (!store)
      return
    try {
      store.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state.value))
    }
    catch {
      // Private browsing and quota errors are not worth breaking onboarding for.
    }
  }

  function hydrate(): void {
    if (isHydrated.value)
      return
    isHydrated.value = true
    const store = storage()
    if (!store)
      return
    try {
      const raw = store.getItem(ONBOARDING_STORAGE_KEY)
      if (!raw)
        return
      const parsed = JSON.parse(raw) as Partial<OnboardingState>
      if (parsed && typeof parsed === 'object' && typeof parsed.status === 'string')
        state.value = { ...createDefaultOnboardingState(), ...parsed }
    }
    catch {
      // A corrupt payload should leave the tenant on defaults, not crash.
    }
  }

  function patch(changes: Partial<OnboardingState>): void {
    state.value = { ...state.value, ...changes }
    persist()
  }

  /**
   * Moves the status forward. Refuses a backwards move so a late webhook or a
   * stale tab cannot rewind a tenant who has already progressed (PRD 7.1).
   */
  function setStatus(next: OnboardingStatus): boolean {
    if (state.value.status === next)
      return true
    if (!canAdvance(state.value.status, next))
      return false
    patch({ status: next, step: stepForStatus(next) })
    return true
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const status = computed(() => state.value.status)
  const step = computed<OnboardingStep>(() => state.value.step)
  const pmsModel = computed(() => state.value.pmsModel)
  const isComplete = computed(() => state.value.status === 'completed')
  const subscription = computed(() => state.value.subscription)

  /** True while the tenant still owes Elev8 a working payment method. */
  const planInactive = computed(() =>
    state.value.status === 'completed' && state.value.subscription.status !== 'active')

  const importJobs = computed(() => state.value.importJobs)
  const isImporting = computed(() =>
    state.value.importJobs.some(j => j.status === 'queued' || j.status === 'running'))
  const importFailedCount = computed(() =>
    state.value.importJobs.reduce((sum, j) => sum + j.failedItems.length, 0))
  const importHasFailures = computed(() => importFailedCount.value > 0)

  const connectedChannels = computed(() => state.value.channels.filter(c => c.connected))
  const needsChannelReconnect = computed(() =>
    state.value.pmsModel === 'MIGRATION'
    && state.value.status === 'completed'
    && connectedChannels.value.length === 0)

  const progress = computed(() => checklistProgress(state.value.checklist))
  const showChecklist = computed(() => isComplete.value && !progress.value.finished)

  /** Modules a PMS_ONLY tenant does not get are hidden, not disabled (PRD 7.4). */
  function moduleAvailable(moduleName: string): boolean {
    return isModuleAvailable(state.value.pmsModel, moduleName)
  }

  /**
   * One banner per page, highest priority only (PRD 9).
   */
  type BannerKind = 'plan_inactive' | 'import_failed' | 'importing' | 'reconnect_channels' | null
  const activeBanner = computed<BannerKind>(() => {
    if (planInactive.value)
      return 'plan_inactive'
    if (importHasFailures.value && !isImporting.value)
      return 'import_failed'
    if (isImporting.value)
      return 'importing'
    if (needsChannelReconnect.value)
      return 'reconnect_channels'
    return null
  })

  // ── Account ────────────────────────────────────────────────────────────────

  /** Called on register. Wipes any previous tenant in this browser. */
  function startTenant(email: string): void {
    state.value = createNewTenantState(email)
    appliedPromo.value = null
    persist()
  }

  function markEmailVerified(): void {
    setStatus('email_verified')
  }

  // ── Wizard ─────────────────────────────────────────────────────────────────

  function saveProfile(profile: TenantProfile): { saved: boolean, errors: Record<string, string> } {
    const errors = validateProfile(profile)
    if (Object.keys(errors).length > 0)
      return { saved: false, errors }
    patch({ profile: { ...profile } })
    setStatus('profile_completed')
    return { saved: true, errors: {} }
  }

  function saveBranding(actionColor: string): void {
    patch({ actionColor, brandingSkipped: false })
    setStatus('branding_completed')
  }

  /** Skipping is a real choice, recorded so Settings can show it later. */
  function skipBranding(): void {
    patch({ brandingSkipped: true })
    setStatus('branding_completed')
  }

  function selectModel(model: PmsModel): void {
    // Changing model can strand a plan and a promo that no longer apply.
    const modelChanged = state.value.pmsModel !== model
    patch({
      pmsModel: model,
      checklist: createChecklist(model),
      subscription: modelChanged
        ? { ...state.value.subscription, pmsModel: model, planCode: null, pricingModel: null, billingCycle: null }
        : { ...state.value.subscription, pmsModel: model },
    })
  }

  function selectPlan(input: {
    pricingModel: PricingModel
    planCode: string
    billingCycle: BillingCycleInput
    unitCount: number
  }): void {
    const perBooking = perBookingPlanByCode(input.planCode)
    patch({
      subscription: {
        ...state.value.subscription,
        pmsModel: state.value.pmsModel,
        pricingModel: input.pricingModel,
        planCode: input.planCode,
        billingCycle: input.pricingModel === 'per_unit' ? input.billingCycle : null,
        unitCount: input.unitCount,
        quotaTotal: perBooking?.quota ?? null,
        quotaRemaining: perBooking?.quota ?? null,
        status: 'pending',
      },
    })
    setStatus('plan_selected')
  }

  type BillingCycleInput = 'monthly' | 'yearly'

  /** The order the payment screen prices, or null before a plan is chosen. */
  const orderSelection = computed<OrderSelection | null>(() => {
    const sub = state.value.subscription
    if (!state.value.pmsModel || !sub.pricingModel || !sub.planCode)
      return null
    return {
      pmsModel: state.value.pmsModel,
      pricingModel: sub.pricingModel,
      planCode: sub.planCode,
      billingCycle: sub.billingCycle,
      unitCount: sub.unitCount,
    }
  })

  const orderSummary = computed(() =>
    orderSelection.value ? buildOrderSummary(orderSelection.value, appliedPromo.value) : null)

  // ── Promo ──────────────────────────────────────────────────────────────────

  /**
   * Always asks the server. The client only renders the verdict (PRD 7.6), and
   * the rate limit lives there too so a reload cannot reset it.
   */
  async function applyPromo(rawCode: string): Promise<PromoValidationResult> {
    const selection = orderSelection.value
    if (!selection) {
      return { valid: false, reason: 'not_found', message: 'Pick a plan before applying a code.', promo: null }
    }

    let result: PromoValidationResult
    try {
      result = await $fetch<PromoValidationResult>('/api/onboarding/promo/validate', {
        method: 'POST',
        body: {
          code: rawCode,
          pmsModel: selection.pmsModel,
          pricingModel: selection.pricingModel,
          tenantId: state.value.email || 'anonymous',
        },
      })
    }
    catch {
      return { valid: false, reason: null, message: 'We could not check that code. Try again.', promo: null }
    }

    if (result.valid && result.promo) {
      appliedPromo.value = result.promo
      writePromoToSubscription(result.promo)
    }
    return result
  }

  function writePromoToSubscription(promo: OnboardingPromoCode | null): void {
    const selection = orderSelection.value
    const subtotal = selection ? subtotalFor(selection) : 0
    const discount = discountFor(subtotal, promo)
    patch({
      subscription: {
        ...state.value.subscription,
        promoCode: promo?.code ?? null,
        discountType: promo?.discountType ?? null,
        discountValue: promo?.discountValue ?? null,
        amountDue: Math.max(subtotal - discount, 0),
      },
    })
  }

  function removePromo(): void {
    appliedPromo.value = null
    writePromoToSubscription(null)
  }

  /**
   * Re-checks the applied code after the tenant changes plan. A code that no
   * longer fits is dropped and the caller is told why (PRD 8).
   */
  async function revalidatePromo(): Promise<PromoValidationResult | null> {
    const code = appliedPromo.value?.code
    if (!code)
      return null
    const result = await applyPromo(code)
    if (!result.valid) {
      appliedPromo.value = null
      writePromoToSubscription(null)
    }
    return result
  }

  // ── Payment ────────────────────────────────────────────────────────────────

  /**
   * Mock Stripe. Every path saves a card, including the zero total path, so the
   * next period can be billed without asking again (PRD 7.6).
   */
  async function submitPayment(options: { declineCard?: boolean } = {}): Promise<{ ok: boolean, message: string }> {
    const summary = orderSummary.value
    if (!summary)
      return { ok: false, message: 'Pick a plan first.' }

    setStatus('payment_pending')
    isSavingPayment.value = true
    await sleep(STRIPE_DELAY_MS)
    isSavingPayment.value = false

    if (options.declineCard) {
      patch({
        status: 'payment_failed',
        step: 'payment',
        subscription: { ...state.value.subscription, status: 'payment_failed' },
      })
      // The promo stays applied so a retry does not lose it.
      return { ok: false, message: 'Your card was declined. Try another card, your code is still applied.' }
    }

    const now = new Date().toISOString()
    const zeroTotal = summary.total === 0

    patch({
      subscription: {
        ...state.value.subscription,
        status: 'active',
        stripeCustomerId: `cus_mock_${Math.random().toString(36).slice(2, 10)}`,
        stripeSubscriptionId: state.value.subscription.pricingModel === 'per_unit'
          ? `sub_mock_${Math.random().toString(36).slice(2, 10)}`
          : null,
        stripePaymentMethodId: `pm_mock_${Math.random().toString(36).slice(2, 10)}`,
        paymentMethodSavedAt: now,
        amountDue: summary.total,
        activationSource: zeroTotal ? 'promo_full_discount' : 'stripe_payment',
      },
    })

    // Counted only now that the subscription is genuinely active.
    if (appliedPromo.value) {
      try {
        await $fetch('/api/onboarding/promo/redeem', { method: 'POST', body: { code: appliedPromo.value.code } })
      }
      catch {
        // A failed counter update must not block an already paid tenant.
      }
    }

    // payment_pending is skipped in the state machine when a promo zeroes the
    // total, but the tenant still passed through Stripe to save a card.
    patch({ status: 'integration_pending', step: 'integration' })

    return {
      ok: true,
      message: zeroTotal
        ? 'Your plan is active. Nothing was charged today.'
        : 'Payment received. Your plan is active.',
    }
  }

  /**
   * The tenant refused to save a card on the zero total path. They reach the
   * dashboard, but the subscription is not active (PRD 8).
   */
  function declinePaymentMethod(): void {
    patch({
      status: 'integration_pending',
      step: 'integration',
      subscription: { ...state.value.subscription, status: 'pending' },
    })
  }

  function retryPayment(): void {
    if (state.value.status === 'payment_failed')
      patch({ status: 'payment_pending', step: 'payment' })
  }

  // ── Integration ────────────────────────────────────────────────────────────

  const integrationPath = computed(() => integrationPathFor(state.value.pmsModel))

  function toggleChannel(id: string, connected: boolean): void {
    patch({
      channels: state.value.channels.map(c => (c.id === id ? { ...c, connected } : c)),
      channelsToReconnect: connected
        ? state.value.channelsToReconnect.filter(c => c !== id)
        : state.value.channelsToReconnect,
    })
  }

  /**
   * Mock Calry auth. On failure nothing is stored, so the tenant returns to the
   * picker with no half saved credential (PRD 8).
   */
  async function connectPms(provider: string, options: { fail?: boolean } = {}): Promise<{ ok: boolean, message: string }> {
    isConnectingPms.value = true
    await sleep(CALRY_AUTH_DELAY_MS)
    isConnectingPms.value = false

    if (options.fail) {
      patch({ connection: null })
      return { ok: false, message: 'We could not authorise that account. Nothing was saved, please try again.' }
    }

    patch({
      connection: {
        provider,
        calryIntegrationId: `calry_${Math.random().toString(36).slice(2, 10)}`,
        status: 'connected',
        connectedAt: new Date().toISOString(),
        purpose: state.value.pmsModel === 'MIGRATION' ? 'one_time_import' : 'sync',
      },
    })
    return { ok: true, message: 'Connected. We are starting the import.' }
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  /**
   * Runs listings, then reservations, then guests, because each stage
   * references the one before it (PRD 7.7). Nothing awaits the caller, so
   * leaving the progress screen never cancels the import.
   */
  function startImport(counts: Partial<Record<ImportJob['type'], number>> = {}): void {
    const jobs = createImportJobs().map(job => ({
      ...job,
      totalCount: counts[job.type] ?? defaultImportCount(job.type),
    }))
    patch({ importJobs: jobs })
    setStatus('importing')
    void runImport()
  }

  function defaultImportCount(type: ImportJob['type']): number {
    return type === 'listings' ? 12 : type === 'reservations' ? 148 : 96
  }

  async function runImport(): Promise<void> {
    for (const job of state.value.importJobs) {
      updateJob(job.type, { status: 'running', processedCount: 0 })
      const total = job.totalCount
      // Batched at 50, the same size the real Calry payload is chunked at.
      const batch = Math.max(1, Math.ceil(total / 8))
      let processed = 0
      while (processed < total) {
        await sleep(IMPORT_TICK_MS)
        processed = Math.min(total, processed + batch)
        updateJob(job.type, { processedCount: processed })
      }
      // One deliberate partial so the failure path is demoable end to end.
      const failures = job.type === 'reservations'
        ? [{ ref: 'RES-20261118-004', reason: 'No matching listing in the import' }]
        : []
      updateJob(job.type, {
        status: failures.length > 0 ? 'partial' : 'success',
        failedItems: failures,
      })
    }

    // A successful listings import satisfies the first checklist item (PRD 7.5).
    const listings = state.value.importJobs.find(j => j.type === 'listings')
    if (listings && listings.totalCount > 0 && listings.status !== 'failed')
      completeChecklistItem('first_listing')

    if (state.value.pmsModel === 'MIGRATION')
      patch({ channelsToReconnect: ['airbnb', 'booking'] })
  }

  function updateJob(type: ImportJob['type'], changes: Partial<ImportJob>): void {
    patch({
      importJobs: state.value.importJobs.map(j => (j.type === type ? { ...j, ...changes } : j)),
    })
  }

  function retryImportItem(type: ImportJob['type'], ref: string): void {
    patch({
      importJobs: state.value.importJobs.map((j) => {
        if (j.type !== type)
          return j
        const remaining = j.failedItems.filter(f => f.ref !== ref)
        return { ...j, failedItems: remaining, status: remaining.length > 0 ? 'partial' : 'success' }
      }),
    })
  }

  // ── Migration handover ─────────────────────────────────────────────────────

  /**
   * The old PMS is only cut off once the tenant says so, so two systems never
   * write to the same channel at once (PRD 6.11).
   */
  function disconnectOldPms(): void {
    if (!state.value.connection)
      return
    patch({ connection: { ...state.value.connection, status: 'disconnected' } })
  }

  // ── Completion ─────────────────────────────────────────────────────────────

  /** Completion does not wait for the import to finish (PRD 7.1). */
  function completeOnboarding(): void {
    patch({
      status: 'completed',
      step: 'done',
      activatedAt: state.value.activatedAt ?? new Date().toISOString(),
    })
  }

  // ── Checklist ──────────────────────────────────────────────────────────────

  /** Driven by system events, never by a tenant ticking a box (PRD 7.5). */
  function completeChecklistItem(code: ChecklistItemCode): void {
    patch({
      checklist: state.value.checklist.map(item =>
        item.code === code && item.status === 'todo'
          ? { ...item, status: 'done', completedAt: new Date().toISOString() }
          : item),
    })
  }

  function skipChecklistItem(code: ChecklistItemCode): void {
    patch({
      checklist: state.value.checklist.map(item =>
        item.code === code && item.status === 'todo'
          ? { ...item, status: 'skipped', completedAt: new Date().toISOString() }
          : item),
    })
  }

  function resetOnboarding(): void {
    state.value = {
      ...createNewTenantState('owner@example.com'),
      status: 'email_verified',
      step: 'profile',
    }
    appliedPromo.value = null
    persist()
  }

  return {
    state,
    status,
    step,
    pmsModel,
    isComplete,
    isHydrated,
    subscription,
    planInactive,
    orderSelection,
    orderSummary,
    appliedPromo,
    isSavingPayment,
    isConnectingPms,
    importJobs,
    isImporting,
    importFailedCount,
    importHasFailures,
    connectedChannels,
    needsChannelReconnect,
    integrationPath,
    progress,
    showChecklist,
    activeBanner,
    allChannels: CHANNEL_OPTIONS,

    hydrate,
    moduleAvailable,
    startTenant,
    markEmailVerified,
    saveProfile,
    saveBranding,
    skipBranding,
    selectModel,
    selectPlan,
    applyPromo,
    removePromo,
    revalidatePromo,
    submitPayment,
    declinePaymentMethod,
    retryPayment,
    toggleChannel,
    connectPms,
    startImport,
    retryImportItem,
    disconnectOldPms,
    completeOnboarding,
    completeChecklistItem,
    skipChecklistItem,
    resetOnboarding,
    setStatus,

    // Re-exported so callers do not need a second import for common maths.
    billableUnits,
    perUnitPlanByCode,
    perBookingPlanByCode,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
