import type { PricingPolicy } from '~/components/revenue/data/revenue-policy'
import { describe, expect, it } from 'vitest'
import { listings } from '~/components/listings/data/listings'
import {
  addDays,
  defaultPolicy,
  dowOf,
  isoDate,
  previewPolicy,
  resolveCost,
  revenueRooms,
  seasonOverlaps,
  summarisePreview,
  validatePolicy,
} from '~/components/revenue/data/revenue-policy'

function policy(patch: Partial<PricingPolicy> = {}): PricingPolicy {
  return { ...defaultPolicy({ currency: 'USD', seedRate: 100 }), rounding: { mode: 'none', step: 1 }, ...patch }
}

/** A Monday some weeks out, so day-of-week tests are stable. */
function nextMonday(): Date {
  let d = addDays(new Date(), 14)
  while (dowOf(d) !== 'mon')
    d = addDays(d, 1)
  return d
}

describe('revenueRooms', () => {
  it('lists every unit of a multi-room listing, and a listing without units as one room', () => {
    const rooms = revenueRooms(listings.value)
    for (const listing of listings.value) {
      const units = listing.unitTypes?.flatMap(t => t.units) ?? []
      const own = rooms.filter(r => r.listingId === listing.id)
      expect(own).toHaveLength(Math.max(1, units.length))
    }
    expect(new Set(rooms.map(r => r.key)).size).toBe(rooms.length)
  })
})

describe('defaultPolicy', () => {
  it('seeds a floor at 70% and a ceiling at 200% of the base rate plan', () => {
    const p = defaultPolicy({ currency: 'USD', seedRate: 200 })
    expect(p.base).toEqual({ price: 200, minPrice: 140, maxPrice: 400 })
    expect(p.minStay.default).toBe(2)
    expect(validatePolicy(p)).toEqual([])
  })
})

describe('validatePolicy', () => {
  it('rejects a base outside the floor and ceiling', () => {
    const issues = validatePolicy(policy({ base: { price: 50, minPrice: 70, maxPrice: 200 } }))
    expect(issues.map(i => i.field)).toContain('base')
  })

  it('rejects a ceiling at or below the floor', () => {
    const issues = validatePolicy(policy({ base: { price: 100, minPrice: 100, maxPrice: 100 } }))
    expect(issues.map(i => i.field)).toContain('maxPrice')
  })

  it('rejects a season that ends before it starts', () => {
    const issues = validatePolicy(policy({ seasons: [{ id: 's1', label: 'High', from: '2027-02-10', to: '2027-02-01', adjustPct: 10, minStay: null, minPrice: null }] }))
    expect(issues.map(i => i.field)).toContain('season-s1')
  })
})

describe('seasonOverlaps', () => {
  it('pairs seasons that share at least one night', () => {
    const a = { id: 'a', label: 'A', from: '2027-01-01', to: '2027-01-10', adjustPct: 0, minStay: null, minPrice: null }
    const b = { id: 'b', label: 'B', from: '2027-01-10', to: '2027-01-20', adjustPct: 0, minStay: null, minPrice: null }
    const c = { id: 'c', label: 'C', from: '2027-02-01', to: '2027-02-05', adjustPct: 0, minStay: null, minPrice: null }
    expect(seasonOverlaps([a, b, c]).map(([x, y]) => [x.id, y.id])).toEqual([['a', 'b']])
  })
})

describe('previewPolicy', () => {
  it('runs 90 nights from the start date, at the base when nothing else applies', () => {
    const nights = previewPolicy(policy(), new Date())
    expect(nights).toHaveLength(90)
    expect(nights[0]!.date).toBe(isoDate(new Date()))
    expect(new Set(nights.map(n => n.price))).toEqual(new Set([100]))
  })

  it('applies season, day of week and last-minute in turn, then clamps', () => {
    const start = nextMonday()
    const day = isoDate(start)
    const p = policy({
      seasons: [{ id: 's', label: 'Peak', from: day, to: day, adjustPct: 50, minStay: 4, minPrice: null }],
      dow: { mon: 1.5 },
    })
    const [night] = previewPolicy(p, start, 1)
    // 100 × 1.5 × 1.5 = 225, held at the 200 ceiling.
    expect(night!.price).toBe(200)
    expect(night!.clamped).toBe('ceiling')
    expect(night!.minStay).toBe(4)
    expect(night!.season).toBe('Peak')
    expect(night!.steps).toEqual(['Peak +50%', 'Mon +50%'])
  })

  it('lets a later season win an overlap', () => {
    const start = addDays(new Date(), 10)
    const day = isoDate(start)
    const p = policy({
      seasons: [
        { id: 'a', label: 'First', from: day, to: day, adjustPct: 10, minStay: null, minPrice: null },
        { id: 'b', label: 'Second', from: day, to: day, adjustPct: 20, minStay: null, minPrice: null },
      ],
    })
    expect(previewPolicy(p, start, 1)[0]!.price).toBe(120)
  })

  it('applies a last-minute rule by days out and its minimum stay', () => {
    const p = policy({ lastMinute: [{ id: 'lm', daysFrom: 0, daysTo: 2, adjustPct: -20, minStay: 1 }] })
    const nights = previewPolicy(p, new Date(), 5)
    expect(nights.slice(0, 3).map(n => [n.price, n.minStay])).toEqual([[80, 1], [80, 1], [80, 1]])
    expect(nights[3]!.price).toBe(100)
    expect(nights[3]!.minStay).toBe(2)
  })

  it('holds the price at a season floor above the policy floor', () => {
    const start = addDays(new Date(), 5)
    const day = isoDate(start)
    const p = policy({ seasons: [{ id: 's', label: 'Low', from: day, to: day, adjustPct: -40, minStay: null, minPrice: 90 }] })
    const [night] = previewPolicy(p, start, 1)
    expect(night!.price).toBe(90)
    expect(night!.clamped).toBe('floor')
  })

  it('rounds last', () => {
    const p = policy({ base: { price: 123, minPrice: 50, maxPrice: 300 }, rounding: { mode: 'nearest', step: 5 } })
    expect(previewPolicy(p, new Date(), 1)[0]!.price).toBe(125)
    const charm = policy({ base: { price: 123, minPrice: 50, maxPrice: 300 }, rounding: { mode: 'psychological', step: 1 } })
    expect(previewPolicy(charm, new Date(), 1)[0]!.price).toBe(129)
  })

  it('summarises average, range and clamped nights', () => {
    const summary = summarisePreview(previewPolicy(policy(), new Date(), 10))
    expect(summary).toEqual({ average: 100, low: 100, high: 100, atFloor: 0, atCeiling: 0 })
  })
})

describe('resolveCost', () => {
  it('uses a room value when set, else the derived one, and says which', () => {
    expect(resolveCost({ override: 40, confirmed: true }, { value: 30, source: 'Derived' }, 'money'))
      .toMatchObject({ value: 40, state: 'confirmed', source: 'Set for this room' })
    expect(resolveCost({ override: null, confirmed: false }, { value: 30, source: 'Derived' }, 'money'))
      .toMatchObject({ value: 30, state: 'estimated', source: 'Derived' })
    expect(resolveCost({ override: null, confirmed: true }, { value: 30, source: 'Derived' }, 'money'))
      .toMatchObject({ state: 'confirmed' })
    expect(resolveCost(undefined, { value: null, source: 'No defaults' }, 'money'))
      .toMatchObject({ value: null, state: 'missing' })
  })
})
