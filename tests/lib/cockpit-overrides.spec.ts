import type { CockpitOverride } from '~/components/cockpit/data/cockpit-overrides'
import { describe, expect, it } from 'vitest'
import { describeOverrides, overridesIn, overridesOn, sellableUnits, validateOverride } from '~/components/cockpit/data/cockpit-overrides'

function override(id: string, from: string, to: string, values: CockpitOverride['values'], extra: Partial<CockpitOverride> = {}): CockpitOverride {
  return { id, listingId: 'lst-1', unitTypeId: 'ut-1', from, to, values, createdAt: '2026-10-09T00:00:00Z', ...extra }
}

describe('cockpit overrides', () => {
  const list = [
    override('a', '2026-10-10', '2026-10-12', { minStay: 2, rate: 150 }),
    override('b', '2026-10-12', '2026-10-14', { minStay: 3, stopSell: true }),
    override('other-type', '2026-10-10', '2026-10-14', { stopSell: true }, { unitTypeId: 'ut-2' }),
    override('whole', '2026-10-10', '2026-10-14', { rate: 99 }, { unitTypeId: null }),
  ]

  it('covers its first and last night, and a later override wins field by field', () => {
    expect(overridesOn(list, 'lst-1', 'ut-1', '2026-10-09')).toEqual({})
    expect(overridesOn(list, 'lst-1', 'ut-1', '2026-10-10')).toEqual({ minStay: 2, rate: 150 })
    expect(overridesOn(list, 'lst-1', 'ut-1', '2026-10-12')).toEqual({ minStay: 3, rate: 150, stopSell: true })
    expect(overridesOn(list, 'lst-1', 'ut-1', '2026-10-15')).toEqual({})
  })

  it('keeps room types and the whole property apart', () => {
    expect(overridesOn(list, 'lst-1', null, '2026-10-11')).toEqual({ rate: 99 })
    expect(overridesIn(list, 'lst-1', 'ut-1', '2026-10-13', '2026-10-20').map(o => o.id)).toEqual(['b'])
  })

  it('describes the settings in the listed order, money with the currency code', () => {
    expect(describeOverrides({ stopSell: true, rate: 1500000, minStay: 1, availability: 0 }, 'IDR'))
      .toEqual(['Only Availability 0', 'Min Stay 1 night', 'Rate IDR 1,500,000', 'Stop Sell'])
    expect(describeOverrides({ closedToArrival: false, rate: 150 }, 'USD')).toEqual(['Closed To Arrival off', 'Rate USD 150.00'])
  })

  it('refuses empty or impossible values', () => {
    expect(validateOverride({}, 3)).toMatch(/at least one/)
    expect(validateOverride({ availability: 4 }, 3)).toMatch(/0 to 3/)
    expect(validateOverride({ maxAvailability: 1.5 }, 3)).toMatch(/Max Availability/)
    expect(validateOverride({ minStay: 0 }, 3)).toMatch(/Min Stay/)
    expect(validateOverride({ minStay: 4, maxStay: 2 }, 3)).toMatch(/shorter/)
    expect(validateOverride({ rate: 0 }, 3)).toMatch(/Rate/)
    expect(validateOverride({ availability: 0, stopSell: true, minStay: 2, maxStay: 7, rate: 120 }, 3)).toBeNull()
  })

  it('counts the rooms open to sell once overrides apply', () => {
    // 3 rooms, 2 free.
    expect(sellableUnits(2, 3, {})).toBe(2)
    expect(sellableUnits(2, 3, { availability: 1 })).toBe(1)
    expect(sellableUnits(2, 3, { availability: 3 })).toBe(2)
    expect(sellableUnits(2, 3, { availability: 0 })).toBe(0)
    // Max 2 sold a night, 1 already taken: 1 more.
    expect(sellableUnits(2, 3, { maxAvailability: 2 })).toBe(1)
    expect(sellableUnits(2, 3, { maxAvailability: 1 })).toBe(0)
    expect(sellableUnits(2, 3, { stopSell: true, availability: 2 })).toBe(0)
  })
})
