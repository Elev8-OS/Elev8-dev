import { describe, expect, it } from 'vitest'
import {
  calculateCommission,
  findEffectiveCommissionRule,
  mockCommissionRules,
} from '@/components/owners/data/commission-rules'

// The `CommissionRule` type stores `rate` as a percentage (0–100), matching the
// Task 1 fixtures (e.g. cr-1 `rate: 20` = 20%, which yields the 7,700,000 IDR
// commission line in stmt-1). `calculateCommission` therefore treats rates as
// percentages, dividing by 100 internally.

describe('calculateCommission', () => {
  it('calculates a flat commission as a percentage of revenue', () => {
    expect(calculateCommission({ type: 'flat', rate: 20 }, 10_000)).toBe(2_000)
    expect(calculateCommission({ type: 'flat', rate: 15 }, 10_000)).toBe(1_500)
  })

  it('calculates progressive tiered commission with a marginal rate per band', () => {
    const rule = {
      type: 'tiered' as const,
      tiers: [
        { upTo: 10_000, rate: 10 },
        { upTo: 20_000, rate: 15 },
        { upTo: null, rate: 20 },
      ],
    }
    // 10_000 @ 10% + 10_000 @ 15% + 5_000 @ 20% = 1_000 + 1_500 + 1_000
    expect(calculateCommission(rule, 25_000)).toBe(3_500)
  })

  it('matches the tiered fixture (cr-2: 18% / 22%) on the seeded revenue', () => {
    // 50_000_000 @ 18% + 60_000_000 @ 22% = 9_000_000 + 13_200_000
    const rule = {
      type: 'tiered' as const,
      tiers: [
        { upTo: 50_000_000, rate: 18 },
        { upTo: null, rate: 22 },
      ],
    }
    expect(calculateCommission(rule, 110_000_000)).toBe(22_200_000)
  })

  it('does not charge revenue above the top of a capped tier set', () => {
    const rule = {
      type: 'tiered' as const,
      tiers: [
        { upTo: 1_000, rate: 10 },
        { upTo: 2_000, rate: 20 },
      ],
    }
    // 1_000 @ 10% + 1_000 @ 20% = 300; the extra 3_000 is uncharged.
    expect(calculateCommission(rule, 5_000)).toBe(300)
  })

  it('calculates a hybrid commission (fixed fee + percentage)', () => {
    // Mirrors cr-3: 250 base + 15% of 9_400 = 250 + 1_410
    expect(calculateCommission({ type: 'hybrid', fixedAmount: 250, rate: 15 }, 9_400)).toBe(1_660)
  })

  it('handles zero revenue for each rule type', () => {
    expect(calculateCommission({ type: 'flat', rate: 20 }, 0)).toBe(0)
    expect(calculateCommission({ type: 'hybrid', fixedAmount: 250, rate: 15 }, 0)).toBe(250)
  })
})

describe('findEffectiveCommissionRule', () => {
  it('finds the active rule for an (owner, listing) at a given period', () => {
    const rule = findEffectiveCommissionRule(mockCommissionRules, 'own-1', 'lst-1', '2026-06')
    expect(rule?.id).toBe('cr-1')
  })

  it('selects the co-owner rule by ownerId on a shared listing', () => {
    const rule = findEffectiveCommissionRule(mockCommissionRules, 'own-2', 'lst-3', '2026-06')
    expect(rule?.id).toBe('cr-2')
  })

  it('respects the effective-from date (no rule before it starts)', () => {
    // cr-4 (own-3, lst-3) starts 2026-07-01, so June has no effective rule.
    expect(findEffectiveCommissionRule(mockCommissionRules, 'own-3', 'lst-3', '2026-06')).toBeUndefined()
    expect(findEffectiveCommissionRule(mockCommissionRules, 'own-3', 'lst-3', '2026-07')?.id).toBe('cr-4')
  })

  it('returns undefined when no rule matches the owner/listing pair', () => {
    expect(findEffectiveCommissionRule(mockCommissionRules, 'own-1', 'lst-999', '2026-06')).toBeUndefined()
  })

  it('honors effectiveTo — a rule that ended before the period is not picked', () => {
    const expiredRule = {
      id: 'cr-expired',
      ownerId: 'own-1',
      listingId: 'lst-1',
      name: 'Expired 25%',
      type: 'flat' as const,
      rate: 25,
      effectiveFrom: '2025-01-01',
      effectiveTo: '2025-12-31',
    }
    // Period 2026-06 sits well after the rule's effectiveTo.
    expect(findEffectiveCommissionRule([...mockCommissionRules, expiredRule], 'own-1', 'lst-1', '2026-06')?.id)
      .toBe('cr-1')
    // Period 2025-06 falls inside the rule's interval — it wins.
    expect(findEffectiveCommissionRule([...mockCommissionRules, expiredRule], 'own-1', 'lst-1', '2025-06')?.id)
      .toBe('cr-expired')
    // EffectiveTo on the final day of the period still counts as inclusive.
    expect(findEffectiveCommissionRule([...mockCommissionRules, expiredRule], 'own-1', 'lst-1', '2025-12')?.id)
      .toBe('cr-expired')
  })

  it('picks the rule with the latest effectiveFrom when intervals overlap', () => {
    const olderRule = {
      id: 'cr-older',
      ownerId: 'own-1',
      listingId: 'lst-1',
      name: 'Older 15%',
      type: 'flat' as const,
      rate: 15,
      effectiveFrom: '2026-01-01',
    }
    const newerRule = {
      id: 'cr-newer',
      ownerId: 'own-1',
      listingId: 'lst-1',
      name: 'Newer 18%',
      type: 'flat' as const,
      rate: 18,
      effectiveFrom: '2026-04-01',
    }
    expect(
      findEffectiveCommissionRule([olderRule, newerRule], 'own-1', 'lst-1', '2026-06')?.id,
    ).toBe('cr-newer')
  })
})
