import { describe, expect, it } from 'vitest'
import { newRuleSet } from '~/components/channels/data/website-channel'
import { websiteQuote } from '~/components/channels/data/website-quote'

const base = {
  currency: 'USD',
  nightly: Array.from({ length: 30 }, () => 100),
  checkIn: '2026-11-02', // Monday
  checkOut: '2026-11-09', // Monday, 7 nights
  bookedOn: '2026-10-14',
  listingTiers: [{ minNights: 7, discountType: 'percent' as const, value: 5 }],
  policyLength: { weeklyPct: 8, monthlyPct: 15 },
}

describe('websiteQuote', () => {
  it('without a rule set takes the single biggest listing or policy discount', () => {
    const q = websiteQuote({ ...base, ruleSet: null })
    expect(q.subtotal).toBe(700)
    expect(q.discounts).toEqual([{ label: 'Weekly 8%', source: 'policy', amount: 56 }])
    expect(q.total).toBe(644)
    expect(q.prepayment).toBeNull()
  })

  it('a rule set tier replaces the listing and policy discounts, and early bird stacks off the subtotal', () => {
    const ruleSet = { ...newRuleSet('A'), earlyBird: { enabled: true, days: 14, pct: 5 } }
    const q = websiteQuote({ ...base, ruleSet })
    expect(q.discounts.map(d => [d.label, d.source, d.amount])).toEqual([
      ['7+ nights 10%', 'website', 70],
      ['Early bird 5%', 'website', 35],
    ])
    expect(q.total).toBe(595)
    expect(q.prepayment).toBe(178.5)
    expect(q.blockers).toEqual([])
  })

  it('a rule set with no tier the stay reaches gives no stay discount, even if the listing has one', () => {
    const ruleSet = { ...newRuleSet('A'), lengthOfStayDiscounts: [{ id: 't', minNights: 14, pct: 20 }] }
    expect(websiteQuote({ ...base, ruleSet }).discounts).toEqual([])
  })

  it('lists the stay rules a stay breaks', () => {
    const ruleSet = { ...newRuleSet('A'), minNights: 10, minDaysBeforeArrival: 30, arrivalDays: [6], departureDays: [6] }
    expect(websiteQuote({ ...base, ruleSet }).blockers).toEqual([
      'Minimum stay is 10 nights.',
      'Book at least 30 days before arrival.',
      'No arrivals on Monday.',
      'No departures on Monday.',
    ])
  })

  it('rounds IDR to whole amounts and a fixed listing tier stays in the listing currency', () => {
    const q = websiteQuote({ ...base, currency: 'IDR', nightly: Array.from({ length: 7 }, () => 1_333_333), listingTiers: [{ minNights: 7, discountType: 'fixed', value: 1_000_000 }], policyLength: null, ruleSet: null })
    expect(q.subtotal).toBe(9_333_331)
    expect(q.discounts).toEqual([{ label: '7+ nights IDR 1,000,000', source: 'listing', amount: 1_000_000 }])
    expect(q.total).toBe(8_333_331)
  })
})
