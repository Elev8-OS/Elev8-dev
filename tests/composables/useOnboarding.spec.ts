import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ONBOARDING_PROMO_CODES,
  ONBOARDING_STORAGE_KEY,
} from '~/components/onboarding/data/onboarding'
import { useOnboarding } from '~/composables/useOnboarding'

/**
 * The composable talks to the promo endpoints through `$fetch`. Stub it with the
 * same rules the server uses so the tests exercise the client's handling of the
 * verdict rather than re-testing the validator.
 */
function stubFetch() {
  const redeemed: string[] = []
  const fetchMock = vi.fn(async (url: string, opts?: { body?: Record<string, unknown> }) => {
    const body = opts?.body ?? {}
    if (url === '/api/onboarding/promo/redeem') {
      redeemed.push(String(body.code))
      return { redeemed: true, promo: null }
    }
    const { validatePromoCode } = await import('~/components/onboarding/data/onboarding')
    return validatePromoCode(
      String(body.code),
      { pmsModel: body.pmsModel as never, pricingModel: body.pricingModel as never },
      ONBOARDING_PROMO_CODES,
      new Date('2026-09-07T00:00:00.000Z'),
    )
  })
  vi.stubGlobal('$fetch', fetchMock)
  return { fetchMock, redeemed }
}

/**
 * Resolves a promise that is waiting on one of the mock delays. Real timers
 * would add seconds per assertion for no extra coverage.
 */
async function settle<T>(run: () => Promise<T>): Promise<T> {
  // Timers must be faked before the call, or the mock delay is already ticking.
  vi.useFakeTimers()
  const promise = run()
  await vi.runAllTimersAsync()
  vi.useRealTimers()
  return promise
}

/** Walks a fresh tenant to the point where a plan has been chosen. */
function reachPlanSelected(model: 'PMS_CM' | 'PMS_ONLY' | 'MIGRATION' = 'PMS_CM') {
  const ob = useOnboarding()
  ob.startTenant('owner@example.com')
  ob.markEmailVerified()
  ob.saveProfile({
    companyName: 'PT Elev8',
    brandName: 'Elev8 Bali',
    phoneNumber: '+6281234567890',
    website: '',
    operatingCurrency: 'IDR',
    country: 'ID',
    timezone: 'Asia/Makassar',
    addressLine: 'Jl. Raya Canggu 12',
    city: 'Badung',
    zipCode: '80361',
  })
  ob.skipBranding()
  ob.selectModel(model)
  ob.selectPlan({ pricingModel: 'per_unit', planCode: 'PER_UNIT_GROWTH', billingCycle: 'monthly', unitCount: 8 })
  return ob
}

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('useOnboarding — account and wizard', () => {
  it('starts an existing demo tenant as completed, so the dashboard is untouched', () => {
    const { status, isComplete, showChecklist } = useOnboarding()
    expect(status.value).toBe('completed')
    expect(isComplete.value).toBe(true)
    // Completed but with work outstanding, so the card is demoable from day one.
    expect(showChecklist.value).toBe(true)
  })

  it('register puts a new tenant at registered with no model chosen', () => {
    const { startTenant, status, step, pmsModel, state } = useOnboarding()
    startTenant('new@example.com')
    expect(status.value).toBe('registered')
    expect(step.value).toBe('profile')
    expect(pmsModel.value).toBeNull()
    expect(state.value.email).toBe('new@example.com')
  })

  it('refuses to save an incomplete profile and reports the fields', () => {
    const { startTenant, saveProfile, status } = useOnboarding()
    startTenant('new@example.com')
    const result = saveProfile({
      companyName: '',
      brandName: '',
      phoneNumber: '',
      website: '',
      operatingCurrency: '',
      country: '',
      timezone: '',
      addressLine: '',
      city: '',
      zipCode: '',
    })
    expect(result.saved).toBe(false)
    expect(Object.keys(result.errors).length).toBeGreaterThan(0)
    expect(status.value).toBe('registered')
  })

  it('records a skipped branding step rather than pretending it was filled in', () => {
    const ob = useOnboarding()
    ob.startTenant('new@example.com')
    ob.markEmailVerified()
    ob.saveProfile({
      companyName: 'A',
      brandName: 'B',
      phoneNumber: '+6281234567890',
      website: '',
      operatingCurrency: 'IDR',
      country: 'ID',
      timezone: 'Asia/Makassar',
      addressLine: 'X',
      city: 'Y',
      zipCode: '1',
    })
    ob.skipBranding()
    expect(ob.state.value.brandingSkipped).toBe(true)
    expect(ob.status.value).toBe('branding_completed')
  })

  it('never moves the status backwards', () => {
    const ob = reachPlanSelected()
    expect(ob.setStatus('profile_completed')).toBe(false)
    expect(ob.status.value).toBe('plan_selected')
  })

  it('drops a stranded plan when the tenant changes model', () => {
    const ob = reachPlanSelected('PMS_CM')
    expect(ob.subscription.value.planCode).toBe('PER_UNIT_GROWTH')
    ob.selectModel('PMS_ONLY')
    expect(ob.subscription.value.planCode).toBeNull()
    expect(ob.subscription.value.pricingModel).toBeNull()
  })

  it('rebuilds the checklist for the chosen model', () => {
    const ob = reachPlanSelected('PMS_CM')
    ob.selectModel('PMS_ONLY')
    expect(ob.state.value.checklist.find(i => i.code === 'setup_stripe')!.status).toBe('not_applicable')
  })
})

describe('useOnboarding — promo', () => {
  it('applies a valid code and updates the total', async () => {
    stubFetch()
    const ob = reachPlanSelected()
    const result = await ob.applyPromo('LAUNCH50')
    expect(result.valid).toBe(true)
    expect(ob.orderSummary.value!.subtotal).toBe(8 * 59)
    expect(ob.orderSummary.value!.total).toBe((8 * 59) / 2)
    expect(ob.subscription.value.promoCode).toBe('LAUNCH50')
  })

  it('leaves the total alone when the code is rejected', async () => {
    stubFetch()
    const ob = reachPlanSelected()
    const before = ob.orderSummary.value!.total
    const result = await ob.applyPromo('NOPE')
    expect(result.valid).toBe(false)
    expect(ob.orderSummary.value!.total).toBe(before)
    expect(ob.appliedPromo.value).toBeNull()
  })

  it('removes an applied code and restores the total', async () => {
    stubFetch()
    const ob = reachPlanSelected()
    await ob.applyPromo('LAUNCH50')
    ob.removePromo()
    expect(ob.orderSummary.value!.total).toBe(8 * 59)
    expect(ob.subscription.value.promoCode).toBeNull()
  })

  it('drops a code that stops applying after the tenant changes plan', async () => {
    stubFetch()
    const ob = reachPlanSelected()
    await ob.applyPromo('UNITS20')
    expect(ob.appliedPromo.value?.code).toBe('UNITS20')

    // UNITS20 is per unit only.
    ob.selectPlan({ pricingModel: 'per_booking', planCode: 'PER_BOOKING_STARTER', billingCycle: 'monthly', unitCount: 8 })
    const result = await ob.revalidatePromo()
    expect(result!.valid).toBe(false)
    expect(result!.reason).toBe('wrong_pricing_model')
    expect(ob.appliedPromo.value).toBeNull()
  })

  it('keeps a code that still applies after a plan change', async () => {
    stubFetch()
    const ob = reachPlanSelected()
    await ob.applyPromo('LAUNCH50')
    ob.selectPlan({ pricingModel: 'per_unit', planCode: 'PER_UNIT_PRO', billingCycle: 'yearly', unitCount: 25 })
    const result = await ob.revalidatePromo()
    expect(result!.valid).toBe(true)
    expect(ob.appliedPromo.value?.code).toBe('LAUNCH50')
  })

  it('asks the server rather than deciding locally', async () => {
    const { fetchMock } = stubFetch()
    const ob = reachPlanSelected()
    await ob.applyPromo('LAUNCH50')
    expect(fetchMock).toHaveBeenCalledWith('/api/onboarding/promo/validate', expect.objectContaining({ method: 'POST' }))
  })
})

describe('useOnboarding — payment', () => {
  it('activates the subscription and always stores a payment method', async () => {
    stubFetch()
    const ob = reachPlanSelected()
    const result = await settle(() => ob.submitPayment())
    expect(result.ok).toBe(true)
    expect(ob.subscription.value.status).toBe('active')
    expect(ob.subscription.value.stripePaymentMethodId).toBeTruthy()
    expect(ob.subscription.value.activationSource).toBe('stripe_payment')
    expect(ob.status.value).toBe('integration_pending')
  })

  it('activates a fully discounted order as promo_full_discount, still with a card', async () => {
    stubFetch()
    const ob = reachPlanSelected()
    await ob.applyPromo('PARTNER100')
    expect(ob.orderSummary.value!.total).toBe(0)

    await settle(() => ob.submitPayment())
    expect(ob.subscription.value.status).toBe('active')
    expect(ob.subscription.value.amountDue).toBe(0)
    expect(ob.subscription.value.activationSource).toBe('promo_full_discount')
    expect(ob.subscription.value.stripePaymentMethodId).toBeTruthy()
    expect(ob.subscription.value.paymentMethodSavedAt).toBeTruthy()
  })

  it('counts the redemption only once the subscription is active', async () => {
    const { redeemed } = stubFetch()
    const ob = reachPlanSelected()
    await ob.applyPromo('LAUNCH50')
    expect(redeemed).toEqual([])
    await settle(() => ob.submitPayment())
    expect(redeemed).toEqual(['LAUNCH50'])
  })

  it('never counts a redemption for a tenant who abandons checkout', async () => {
    const { redeemed } = stubFetch()
    const ob = reachPlanSelected()
    await ob.applyPromo('LAUNCH50')
    await settle(() => ob.submitPayment({ declineCard: true }))
    expect(redeemed).toEqual([])
  })

  it('keeps the profile and the promo after a declined card, and allows a retry', async () => {
    stubFetch()
    const ob = reachPlanSelected()
    await ob.applyPromo('LAUNCH50')
    const failed = await settle(() => ob.submitPayment({ declineCard: true }))

    expect(failed.ok).toBe(false)
    expect(ob.status.value).toBe('payment_failed')
    expect(ob.appliedPromo.value?.code).toBe('LAUNCH50')
    expect(ob.state.value.profile.companyName).toBe('PT Elev8')

    ob.retryPayment()
    expect(ob.status.value).toBe('payment_pending')
    const retried = await settle(() => ob.submitPayment())
    expect(retried.ok).toBe(true)
    expect(ob.subscription.value.status).toBe('active')
  })

  it('leaves the plan inactive when the tenant refuses to save a card', async () => {
    stubFetch()
    const ob = reachPlanSelected()
    await ob.applyPromo('PARTNER100')
    ob.declinePaymentMethod()
    ob.completeOnboarding()

    expect(ob.subscription.value.status).not.toBe('active')
    expect(ob.planInactive.value).toBe(true)
    expect(ob.activeBanner.value).toBe('plan_inactive')
  })
})

describe('useOnboarding — integration and import', () => {
  it('routes PMS_CM to channels and the others to a PMS sign in', () => {
    const cm = reachPlanSelected('PMS_CM')
    expect(cm.integrationPath.value).toBe('channels')
    cm.selectModel('PMS_ONLY')
    expect(cm.integrationPath.value).toBe('pms')
  })

  it('stores nothing when the PMS sign in fails', async () => {
    const ob = reachPlanSelected('PMS_ONLY')
    const result = await settle(() => ob.connectPms('guesty', { fail: true }))
    expect(result.ok).toBe(false)
    expect(ob.state.value.connection).toBeNull()
  })

  it('records the connection purpose from the model', async () => {
    const sync = reachPlanSelected('PMS_ONLY')
    await settle(() => sync.connectPms('guesty'))
    expect(sync.state.value.connection!.purpose).toBe('sync')

    const migration = reachPlanSelected('MIGRATION')
    await settle(() => migration.connectPms('smoobu'))
    expect(migration.state.value.connection!.purpose).toBe('one_time_import')
  })

  it('runs the three import stages in order and finishes them all', async () => {
    vi.useFakeTimers()
    const ob = reachPlanSelected('PMS_ONLY')
    ob.startImport({ listings: 2, reservations: 2, guests: 2 })
    expect(ob.status.value).toBe('importing')
    expect(ob.importJobs.value.map(j => j.type)).toEqual(['listings', 'reservations', 'guests'])

    await vi.runAllTimersAsync()
    vi.useRealTimers()

    expect(ob.isImporting.value).toBe(false)
    expect(ob.importJobs.value.every(j => j.processedCount === j.totalCount)).toBe(true)
  })

  it('ticks off the first listing once listings have imported', async () => {
    vi.useFakeTimers()
    const ob = reachPlanSelected('PMS_ONLY')
    ob.startImport({ listings: 2, reservations: 1, guests: 1 })
    await vi.runAllTimersAsync()
    vi.useRealTimers()

    expect(ob.state.value.checklist.find(i => i.code === 'first_listing')!.status).toBe('done')
  })

  it('reports a partial import and lets a failed item be retried', async () => {
    vi.useFakeTimers()
    const ob = reachPlanSelected('PMS_ONLY')
    ob.startImport({ listings: 1, reservations: 2, guests: 1 })
    await vi.runAllTimersAsync()
    vi.useRealTimers()

    const reservations = ob.importJobs.value.find(j => j.type === 'reservations')!
    expect(reservations.status).toBe('partial')
    expect(ob.importHasFailures.value).toBe(true)

    ob.retryImportItem('reservations', reservations.failedItems[0]!.ref)
    expect(ob.importJobs.value.find(j => j.type === 'reservations')!.status).toBe('success')
    expect(ob.importHasFailures.value).toBe(false)
  })

  it('lists the channels a migration tenant has to reconnect', async () => {
    vi.useFakeTimers()
    const ob = reachPlanSelected('MIGRATION')
    ob.startImport({ listings: 1, reservations: 1, guests: 1 })
    await vi.runAllTimersAsync()
    vi.useRealTimers()

    expect(ob.state.value.channelsToReconnect.length).toBeGreaterThan(0)
  })

  it('cuts off the old system only when the tenant confirms', async () => {
    const ob = reachPlanSelected('MIGRATION')
    await settle(() => ob.connectPms('smoobu'))
    expect(ob.state.value.connection!.status).toBe('connected')
    ob.disconnectOldPms()
    expect(ob.state.value.connection!.status).toBe('disconnected')
  })

  it('completes without waiting for the import to finish', () => {
    const ob = reachPlanSelected('PMS_ONLY')
    ob.startImport({ listings: 5, reservations: 5, guests: 5 })
    ob.completeOnboarding()
    expect(ob.isComplete.value).toBe(true)
    expect(ob.isImporting.value).toBe(true)
  })
})

describe('useOnboarding — banners and checklist', () => {
  it('shows one banner, the highest priority one', async () => {
    stubFetch()
    const ob = reachPlanSelected('MIGRATION')
    await settle(() => ob.submitPayment())

    vi.useFakeTimers()
    ob.startImport({ listings: 1, reservations: 2, guests: 1 })
    // While running, the import outranks the reconnect reminder.
    expect(ob.activeBanner.value).toBe('importing')

    await vi.runAllTimersAsync()
    vi.useRealTimers()
    ob.completeOnboarding()

    // Finished with failures outranks the reconnect reminder too.
    expect(ob.activeBanner.value).toBe('import_failed')
    ob.retryImportItem('reservations', ob.importJobs.value.find(j => j.type === 'reservations')!.failedItems[0]!.ref)
    expect(ob.activeBanner.value).toBe('reconnect_channels')

    ob.toggleChannel('airbnb', true)
    expect(ob.activeBanner.value).toBeNull()
  })

  it('completes a checklist item from a system event, not a click', () => {
    const ob = reachPlanSelected()
    const before = ob.progress.value.done
    ob.completeChecklistItem('setup_cleaning')
    expect(ob.progress.value.done).toBe(before + 1)
  })

  it('never re-completes an item that was skipped', () => {
    const ob = reachPlanSelected()
    ob.skipChecklistItem('setup_stripe')
    ob.completeChecklistItem('setup_stripe')
    expect(ob.state.value.checklist.find(i => i.code === 'setup_stripe')!.status).toBe('skipped')
  })

  it('hides the card once everything applicable is done', () => {
    const ob = reachPlanSelected()
    ob.completeOnboarding()
    for (const item of [...ob.state.value.checklist])
      ob.completeChecklistItem(item.code)
    expect(ob.progress.value.finished).toBe(true)
    expect(ob.showChecklist.value).toBe(false)
  })
})

describe('useOnboarding — persistence', () => {
  it('writes progress to storage so a closed browser does not lose it', () => {
    const ob = reachPlanSelected()
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).status).toBe('plan_selected')
    expect(ob.status.value).toBe('plan_selected')
  })

  it('resumes at the step the tenant had not finished', () => {
    reachPlanSelected()
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY)

    // A fresh session: clear the in-memory state, then hydrate from storage.
    localStorage.setItem(ONBOARDING_STORAGE_KEY, stored!)
    const fresh = useOnboarding()
    fresh.resetOnboarding()
    localStorage.setItem(ONBOARDING_STORAGE_KEY, stored!)
    fresh.isHydrated.value = false
    fresh.hydrate()

    expect(fresh.status.value).toBe('plan_selected')
    expect(fresh.step.value).toBe('payment')
    expect(fresh.state.value.profile.companyName).toBe('PT Elev8')
  })

  it('falls back to defaults on a corrupt payload instead of throwing', () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '{not json')
    const ob = useOnboarding()
    ob.isHydrated.value = false
    expect(() => ob.hydrate()).not.toThrow()
    expect(ob.status.value).toBe('completed')
  })
})
