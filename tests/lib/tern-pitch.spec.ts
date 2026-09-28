import { describe, expect, it } from 'vitest'
import { averageStayNights, DEFAULT_STAY_NIGHTS, estimatedStaysPerYear, marginPerStay, ternPitchFor } from '~/components/damage-protection/data/tern-pitch'

const stay = (nights: number, extra: Record<string, unknown> = {}) => ({ nights, status: 'checked_out' as const, ...extra })

describe('averageStayNights', () => {
  it('averages real stays only', () => {
    expect(averageStayNights([
      stay(4),
      stay(6),
      stay(30, { type: 'block' as const }),
      stay(9, { status: 'cancelled' as const }),
      stay(2, { status: 'inquiry' as const }),
    ])).toBe(5)
  })

  it('falls back to a stated default without any', () => {
    expect(averageStayNights([])).toBe(DEFAULT_STAY_NIGHTS)
  })
})

describe('estimatedStaysPerYear', () => {
  it('divides the booked nights of a year by the average stay', () => {
    // 365 x 0.8 = 292 nights, 4 a stay.
    expect(estimatedStaysPerYear(80, 4)).toBe(73)
  })

  it('never goes past a full year, or below nothing', () => {
    expect(estimatedStaysPerYear(140, 5)).toBe(73)
    expect(estimatedStaysPerYear(0, 4)).toBe(0)
  })
})

describe('marginPerStay', () => {
  it('is what the guest price leaves after the fee, negative when it does not cover it', () => {
    expect(marginPerStay(39, 25)).toBe(14)
    expect(marginPerStay(10, 25)).toBe(-15)
  })
})

describe('ternPitchFor', () => {
  const listing = { capacity: 10, stats: { occupancyRate: 80 }, bookings: [stay(4)] }

  it('quotes the tier sized for the listing, from the standard price unless it has its own', () => {
    expect(ternPitchFor(listing, 'USD')).toMatchObject({ tierName: 'Gold', perStayFee: 25, suggestedGuestPrice: 39, staysPerYear: 73 })
    expect(ternPitchFor(listing, 'USD', 55)!.suggestedGuestPrice).toBe(55)
  })

  it('quotes nothing in a currency Tern does not price: nothing is converted', () => {
    expect(ternPitchFor(listing, 'IDR')).toBeNull()
  })
})
