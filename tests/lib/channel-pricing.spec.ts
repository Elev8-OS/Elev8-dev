import type { Listing, RatePlan } from '~/components/listings/data/listings'
import { describe, expect, it } from 'vitest'
import {
  adjustedAmount,
  channelRatePlans,
  copyPromotions,
  isValidAdjustment,
  newPromotion,
  nextRatePlanCode,
  promotionIssues,
  promotionSummary,
  ratePlanChannelsLabel,
} from '~/components/channels/data/channel-pricing'
import { createRatePlan, listings } from '~/components/listings/data/listings'

function withPlans(plans: RatePlan[]): Listing {
  const base = listings.value.find(l => l.unitTypes?.length)!
  const [first, ...rest] = base.unitTypes!
  return { ...base, unitTypes: [{ ...first!, pricing: { ...first!.pricing, ratePlans: plans } }, ...rest.map(t => ({ ...t, pricing: { ...t.pricing, ratePlans: [] } }))] }
}

describe('rate plans per channel', () => {
  it('sells a plan with no channels everywhere, and one with channels only there', () => {
    const listing = withPlans([
      createRatePlan({ id: 'a', title: 'Standard', code: 'RP0001' }),
      createRatePlan({ id: 'b', title: 'Booking only', code: 'RP0002', channels: ['Booking.com'] }),
      createRatePlan({ id: 'c', title: 'Old plan' }),
    ])
    expect(channelRatePlans(listing, 'Booking.com').map(p => p.code)).toEqual(['RP0001', 'RP0002', 'c'])
    expect(channelRatePlans(listing, 'Airbnb').map(p => p.name)).toEqual(['Standard', 'Old plan'])
    expect(ratePlanChannelsLabel(createRatePlan({}))).toBe('All channels')
  })

  it('hands out the next free code across every listing', () => {
    const one = withPlans([createRatePlan({ code: 'RP0007' }), createRatePlan({ code: 'custom' })])
    expect(nextRatePlanCode([one])).toBe('RP0008')
    expect(nextRatePlanCode([withPlans([])])).toBe('RP0001')
  })
})

describe('promotions', () => {
  it('needs a name, a channel, a sane discount and a days rule for early bird', () => {
    const p = { ...newPromotion(), name: '', channels: [], amount: 120, daysBeforeArrival: null }
    expect(promotionIssues(p)).toEqual([
      'Give it a name',
      'Pick at least one channel',
      'A percent discount must stay under 100%',
      'Set how many days ahead guests book',
    ])
    expect(promotionIssues({ ...newPromotion(), name: 'Early' })).toEqual([])
  })

  it('catches backwards stay dates and nights', () => {
    const p = { ...newPromotion(), name: 'x', type: 'basic' as const, daysBeforeArrival: null, stayFrom: '2026-12-10', stayUntil: '2026-12-01', minNights: 5, maxNights: 3 }
    expect(promotionIssues(p)).toEqual(['The stay dates end before they start', 'Minimum nights is above maximum nights'])
  })

  it('summarises in the listing currency code', () => {
    const p = { ...newPromotion(), name: 'x', discountType: 'amount' as const, amount: 20, target: 'total' as const, minNights: 3 }
    expect(promotionSummary(p, 'USD')).toBe('USD 20 off the total · booked 30+ days ahead · 3+ nights')
  })

  it('gives copies their own ids', () => {
    const p = newPromotion()
    const [copy] = copyPromotions([p], 'lst-2')
    expect(copy!.id).not.toBe(p.id)
    expect(copy!.channels).not.toBe(p.channels)
  })
})

describe('price adjustments', () => {
  it('adds the percent and keeps cents', () => {
    expect(adjustedAmount(100, 15)).toBe(115)
    expect(adjustedAmount(99.99, -5)).toBe(94.99)
  })

  it('refuses a price at or below zero, and nonsense', () => {
    expect(isValidAdjustment(-100)).toBe(false)
    expect(isValidAdjustment(-99)).toBe(true)
    expect(isValidAdjustment(Number.NaN)).toBe(false)
  })
})
