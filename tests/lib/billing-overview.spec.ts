import type { TenantSubscription } from '~/components/onboarding/data/onboarding'
import { describe, expect, it } from 'vitest'
import { nextSubscriptionInvoice, packageView } from '~/components/billing/data/billing-overview'
import { createMockSubscriptionBilling, createSeedInvoiceHistory, DEMO_PLAN } from '~/components/billing/data/subscription-billing'
import { createDefaultSubscription } from '~/components/onboarding/data/onboarding'

function perUnit(patch: Partial<TenantSubscription> = {}): TenantSubscription {
  return { ...createDefaultSubscription(), pmsModel: 'PMS_CM', pricingModel: 'per_unit', planCode: 'PER_UNIT_GROWTH', billingCycle: 'monthly', unitCount: 16, ...patch }
}

describe('packageView', () => {
  it('reads the package, its range and the units active against it', () => {
    expect(packageView(perUnit(), '2026-09-28T10:00:00.000Z')).toMatchObject({
      model: 'per_unit',
      planName: 'Growth',
      pmsLabel: 'ELEV8 as PMS and Channel Manager',
      unitsActive: 16,
      unitsMin: 5,
      unitsMax: 19,
      billedUnits: 16,
      unitRateUsd: 59,
      contractMonths: 12,
      contractEndsOn: '2027-09-28',
    })
  })

  it('bills the package floor when fewer units are active', () => {
    expect(packageView(perUnit({ unitCount: 2 }), null)).toMatchObject({ unitsActive: 2, billedUnits: 5, contractEndsOn: null })
  })

  it('has no maximum on the top package', () => {
    expect(packageView(perUnit({ planCode: 'PER_UNIT_ENTERPRISE', unitCount: 60 }), null)).toMatchObject({ unitsMax: null, unitRateUsd: 49 })
  })

  it('reads a per booking package as a quota', () => {
    expect(packageView(perUnit({ pricingModel: 'per_booking', planCode: 'PER_BOOKING_GROWTH', quotaTotal: 250, quotaRemaining: 40 }), null))
      .toEqual(expect.objectContaining({ model: 'per_booking', planName: 'Growth', quotaRemaining: 40, quotaTotal: 250, rateUsd: 11.9 }))
  })
})

describe('nextSubscriptionInvoice', () => {
  it('is one cycle after the last invoice, for the units active now', () => {
    expect(nextSubscriptionInvoice(perUnit(), [{ issuedOn: '2026-08-26T09:00:00.000Z' }, { issuedOn: '2026-09-26T09:00:00.000Z' }], null))
      .toEqual({ on: '2026-10-26', amountUsd: 944, units: 16, unitRateUsd: 59, planName: 'Growth' })
  })

  it('is a year on for a yearly package, at the yearly rate', () => {
    expect(nextSubscriptionInvoice(perUnit({ billingCycle: 'yearly' }), [{ issuedOn: '2026-09-26T09:00:00.000Z' }], null))
      .toMatchObject({ on: '2027-09-26', unitRateUsd: 54.08 })
  })

  it('falls back to activation before any invoice, and has none on per booking', () => {
    expect(nextSubscriptionInvoice(perUnit(), [], '2026-09-10T09:00:00.000Z')!.on).toBe('2026-10-10')
    expect(nextSubscriptionInvoice(perUnit({ pricingModel: 'per_booking' }), [], null)).toBeNull()
  })
})

describe('the demo invoice history', () => {
  it('has the failed invoice first and three paid months before it, all at the demo package amount', () => {
    const billing = createMockSubscriptionBilling()
    const history = createSeedInvoiceHistory(billing)
    expect(history.map(h => h.status)).toEqual(['payment_failed', 'paid', 'paid', 'paid'])
    expect(history[0]).toMatchObject({ id: billing.failedInvoice!.id, amountUsd: DEMO_PLAN.units * DEMO_PLAN.unitRateUsd })
    expect(billing.failedInvoice!.amountUsd).toBe(944)
    expect(new Set(history.map(h => h.amountUsd))).toEqual(new Set([944]))
    expect(new Set(history.map(h => h.number)).size).toBe(4)
  })
})
