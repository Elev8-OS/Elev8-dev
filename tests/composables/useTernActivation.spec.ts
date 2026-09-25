import type { ActivationDraft } from '~/components/reservations/data/tern-activation'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnboarding } from '~/composables/useOnboarding'
import { useTernActivation } from '~/composables/useTernActivation'

/** The 1.5s mocks cost real seconds otherwise. Fake timers BEFORE the call. */
async function settle<T>(run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers()
  const pending = run()
  await vi.runAllTimersAsync()
  const result = await pending
  vi.useRealTimers()
  return result
}

function draft(patch: Partial<ActivationDraft> = {}): ActivationDraft {
  return {
    termsAccepted: true,
    bank: { accountHolder: 'Elevate Schweiz GmbH', bankName: 'AKB', country: 'ch', iban: 'CH93 0076 2011 6238 5295 7', accountNumber: '', bicSwift: '' },
    ...patch,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('useTernActivation', () => {
  it('starts the demo tenant active, with a bank account for Tern to pay into', () => {
    const tern = useTernActivation()
    expect(tern.isActive.value).toBe(true)
    expect(tern.payoutTarget.value).toEqual({ id: 'tern_org_demo_0001', accountName: 'Bank Central Asia (BCA) •••• 3456' })
  })

  it('replays the flow from the start, with nowhere to pay until it is done again', () => {
    const tern = useTernActivation()
    tern.replayActivation()
    expect(tern.activation.value).toEqual({ status: 'not_activated' })
    expect(tern.payoutTarget.value).toBeNull()
  })

  it('takes the per-stay fee card from the onboarding subscription, and refuses without one', async () => {
    const tern = useTernActivation()
    tern.replayActivation()
    const onboarding = useOnboarding()
    const saved = onboarding.state.value
    onboarding.state.value = { ...saved, subscription: { ...saved.subscription, stripePaymentMethodId: null } }
    await expect(tern.activate(draft(), 'X')).resolves.toEqual({ ok: false, reason: 'no_subscription_card' })
    expect(tern.activation.value.status).toBe('not_activated')
    onboarding.state.value = saved
  })

  it('activates: accepts the terms, stores the bank, and registers an organization on Tern', async () => {
    const tern = useTernActivation()
    tern.replayActivation()
    await expect(settle(() => tern.activate(draft(), 'Elevate Schweiz GmbH'))).resolves.toEqual({ ok: true })
    expect(tern.activation.value).toMatchObject({
      status: 'active',
      termsVersion: 'tern-2026-09',
      // The demo onboarding subscription's card, never a second one.
      billingPaymentMethodId: 'pm_demo',
      payoutBank: { country: 'CH', iban: 'CH9300762011623852957' },
    })
    expect(tern.activation.value.ternOrganizationId).toMatch(/^tern_org_/)
    expect(JSON.parse(localStorage.getItem('elev8-tern-activation-v1')!).status).toBe('active')
  })

  it('refuses an incomplete draft and names the first step to fix', async () => {
    const tern = useTernActivation()
    tern.replayActivation()
    await expect(tern.activate(draft({ termsAccepted: false }), 'X')).resolves.toEqual({ ok: false, reason: 'invalid_terms' })
    expect(tern.activation.value.status).toBe('not_activated')
  })

  it('keeps what was entered when Tern refuses, and activates on the retry', async () => {
    const tern = useTernActivation()
    tern.replayActivation()
    await expect(settle(() => tern.activate(draft(), 'X', true))).resolves.toEqual({ ok: false, reason: 'registration_failed' })
    expect(tern.activation.value).toMatchObject({ status: 'registration_failed', attempts: 1, payoutBank: { bankName: 'AKB' } })
    expect(tern.payoutTarget.value).toBeNull()
    await expect(settle(() => tern.activate(draft(), 'X'))).resolves.toEqual({ ok: true })
    expect(tern.activation.value.attempts).toBe(2)
  })

  it('reads a reload mid-registration as a failed one, never as active', () => {
    localStorage.setItem('elev8-tern-activation-v1', JSON.stringify({ status: 'registering' }))
    const tern = useTernActivation()
    tern.hydrate()
    expect(tern.activation.value.status).toBe('registration_failed')
  })

  it('changes the payout bank once active, and refuses an invalid one', () => {
    const tern = useTernActivation()
    expect(tern.updatePayoutBank({ ...draft().bank, iban: 'CH93 0076 2011 6238 5295 8' })).toEqual({ ok: false, reason: 'invalid_bank' })
    expect(tern.updatePayoutBank(draft().bank)).toEqual({ ok: true })
    expect(tern.payoutTarget.value?.accountName).toBe('AKB •••• 2957')
    tern.replayActivation()
    expect(tern.updatePayoutBank(draft().bank)).toEqual({ ok: false, reason: 'not_active' })
  })
})
