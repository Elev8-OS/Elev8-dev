import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import {
  cleaningFeeInPeriod,
  matchesReservationPeriod,
  nightsInPeriod,
  roomRevenueInPeriod,
} from '~/lib/reservation-period'

const SEP = { from: '2026-09-01', to: '2026-09-30' }
const OCT = { from: '2026-10-01', to: '2026-10-31' }

// 29 Sep to 3 Oct: nights of 29 and 30 Sep, 1 and 2 Oct. 3 Oct is the check-out.
function crossing(overrides: Partial<ReservationEntry> = {}) {
  return {
    checkIn: '2026-09-29',
    checkOut: '2026-10-03',
    nights: 4,
    totalPrice: 480,
    currency: 'USD',
    priceDetails: { subtotal: 400, cleaningFee: 50, serviceFee: 0, tax: 30, extras: 0, guestPaid: 480, commission: 0, payout: 480 },
    ...overrides,
  } as ReservationEntry
}

describe('matchesReservationPeriod', () => {
  it('stay basis: a month-crossing stay shows in both months', () => {
    expect(matchesReservationPeriod(crossing(), SEP, 'stay')).toBe(true)
    expect(matchesReservationPeriod(crossing(), OCT, 'stay')).toBe(true)
  })

  it('stay basis: the departure day alone is not a night in the range', () => {
    expect(matchesReservationPeriod(crossing(), { from: '2026-10-03', to: '2026-10-31' }, 'stay')).toBe(false)
  })

  it('check-in and check-out bases put the stay in one month each', () => {
    expect(matchesReservationPeriod(crossing(), SEP, 'check_in')).toBe(true)
    expect(matchesReservationPeriod(crossing(), OCT, 'check_in')).toBe(false)
    expect(matchesReservationPeriod(crossing(), SEP, 'check_out')).toBe(false)
    expect(matchesReservationPeriod(crossing(), OCT, 'check_out')).toBe(true)
  })

  it('open-ended and empty ranges', () => {
    expect(matchesReservationPeriod(crossing(), { from: '', to: '' }, 'stay')).toBe(true)
    expect(matchesReservationPeriod(crossing(), { from: '2026-10-02', to: '' }, 'stay')).toBe(true)
    expect(matchesReservationPeriod(crossing(), { from: '', to: '2026-09-28' }, 'stay')).toBe(false)
  })
})

describe('splitting a stay across months', () => {
  it('counts nights inside each month', () => {
    expect(nightsInPeriod(crossing(), SEP)).toBe(2)
    expect(nightsInPeriod(crossing(), OCT)).toBe(2)
    expect(nightsInPeriod(crossing(), { from: '', to: '' })).toBe(4)
  })

  it('splits room revenue by nights, taxes and fees excluded', () => {
    expect(roomRevenueInPeriod(crossing(), SEP)).toBe(200)
    expect(roomRevenueInPeriod(crossing(), OCT)).toBe(200)
    expect(roomRevenueInPeriod(crossing(), { from: '2026-11-01', to: '2026-11-30' })).toBe(0)
  })

  it('months always add up to the room revenue despite rounding', () => {
    const r = crossing({ checkIn: '2026-09-29', checkOut: '2026-10-02', nights: 3, priceDetails: { ...crossing().priceDetails!, subtotal: 100 } })
    const sep = roomRevenueInPeriod(r, SEP)
    const oct = roomRevenueInPeriod(r, OCT)
    expect(sep).toBe(66.67)
    expect(oct).toBe(33.33)
    expect(sep + oct).toBe(100)
  })

  it('rounds IDR to whole rupiah', () => {
    const r = crossing({ checkOut: '2026-10-02', nights: 3, currency: 'IDR', priceDetails: undefined, totalPrice: 1_000_000 })
    expect(roomRevenueInPeriod(r, SEP)).toBe(666_667)
    expect(roomRevenueInPeriod(r, OCT)).toBe(333_333)
  })

  it('falls back to the booking total without a price breakdown', () => {
    expect(roomRevenueInPeriod(crossing({ priceDetails: undefined }), SEP)).toBe(240)
  })

  it('counts the cleaning fee once, in the month of arrival', () => {
    expect(cleaningFeeInPeriod(crossing(), SEP)).toBe(50)
    expect(cleaningFeeInPeriod(crossing(), OCT)).toBe(0)
  })
})
