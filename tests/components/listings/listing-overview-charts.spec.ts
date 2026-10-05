import type { OverviewStay } from '~/components/listings/data/listing-overview-charts'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import {
  averageStayLength,
  bookingSources,
  monthlyPerformance,
  overviewStays,
  stayLengthDistribution,
  staysInPeriod,
  stayYears,
} from '~/components/listings/data/listing-overview-charts'

const TODAY = new Date(2026, 9, 5) // 5 Oct 2026

function stay(patch: Partial<OverviewStay>): OverviewStay {
  return {
    id: 's',
    guestName: 'Guest',
    checkIn: '2026-09-10',
    checkOut: '2026-09-12',
    nights: 2,
    status: 'verified',
    revenue: 200,
    source: 'Airbnb',
    currency: 'USD',
    rooms: 1,
    ...patch,
  }
}

describe('overviewStays', () => {
  it('merges both sources and drops blocks, cancelled stays and inquiries', () => {
    const listing = {
      id: 'lst-x',
      unitTypes: [{ pricing: { currency: 'EUR' }, units: [] }] as any,
      bookings: [
        { id: 'b1', guestName: 'A', checkIn: '2026-09-01', checkOut: '2026-09-03', nights: 2, status: 'checked_out', revenue: 100, source: 'Airbnb' },
        { id: 'b2', guestName: 'B', checkIn: '2026-09-05', checkOut: '2026-09-06', nights: 1, status: 'inquiry', revenue: 50, source: 'Airbnb' },
        { id: 'b3', type: 'block', guestName: 'Owner', checkIn: '2026-09-07', checkOut: '2026-09-08', nights: 1, status: 'verified', revenue: 0, source: 'Direct' },
      ] as any,
    }
    const reservations = [
      { id: 'r1', listingId: 'lst-x', guestName: 'C', checkIn: '2026-09-10', checkOut: '2026-09-12', nights: 2, status: 'verified', totalPrice: 300, currency: 'IDR', channel: 'Booking.com' },
      { id: 'r2', listingId: 'lst-x', guestName: 'D', checkIn: '2026-09-15', checkOut: '2026-09-16', nights: 1, status: 'cancelled', totalPrice: 90, currency: 'IDR', channel: 'Direct' },
      { id: 'r3', listingId: 'other', guestName: 'E', checkIn: '2026-09-15', checkOut: '2026-09-16', nights: 1, status: 'verified', totalPrice: 90, currency: 'IDR', channel: 'Direct' },
    ] as unknown as ReservationEntry[]

    const stays = overviewStays(listing, reservations)
    expect(stays.map(s => [s.id, s.currency])).toEqual([['b1', 'EUR'], ['r1', 'IDR']])
  })
})

describe('monthlyPerformance', () => {
  it('lists January to December, future months included, and splits a stay over a month end', () => {
    const months = monthlyPerformance(
      [stay({ checkIn: '2026-08-30', checkOut: '2026-09-03', nights: 4, revenue: 400 }), stay({ id: 'f', checkIn: '2026-12-10', checkOut: '2026-12-12', revenue: 300 })],
      { currency: 'USD', rooms: 1, year: 2026 },
    )
    expect(months).toHaveLength(12)
    expect(months[0]!.period).toBe('2026-01')
    expect(months[11]!).toMatchObject({ period: '2026-12', revenue: 300 })
    const aug = months.find(m => m.period === '2026-08')!
    const sep = months.find(m => m.period === '2026-09')!
    expect(aug.revenue).toBe(200)
    expect(sep.revenue).toBe(200)
    expect(sep.occupancy).toBe(Math.round((2 / 30) * 100))
  })

  it('counts every currency for occupancy but only the chosen one for revenue', () => {
    const months = monthlyPerformance(
      [stay({ revenue: 200 }), stay({ id: 's2', checkIn: '2026-09-20', checkOut: '2026-09-22', currency: 'IDR', revenue: 3_000_000 })],
      { currency: 'USD', rooms: 1, year: 2026 },
    )
    const sep = months.find(m => m.period === '2026-09')!
    expect(sep.revenue).toBe(200)
    expect(sep.occupancy).toBe(Math.round((4 / 30) * 100))
  })

  it('reads occupancy in room-nights for a multi-room listing', () => {
    const months = monthlyPerformance(
      [stay({ checkIn: '2026-09-01', checkOut: '2026-10-01', nights: 30, rooms: 2 })],
      { currency: 'USD', rooms: 4, year: 2026 },
    )
    expect(months.find(m => m.period === '2026-09')!.occupancy).toBe(50)
  })
})

describe('stayYears', () => {
  it('lists every year a stay night falls in plus this year, newest first', () => {
    expect(stayYears([stay({ checkIn: '2025-12-30', checkOut: '2026-01-02' }), stay({ checkIn: '2027-03-01', checkOut: '2027-03-03' })], 2026))
      .toEqual([2027, 2026, 2025])
  })
})

describe('staysInPeriod', () => {
  const stays = [stay({ checkIn: '2025-06-01' }), stay({ checkIn: '2026-08-15' }), stay({ checkIn: '2026-10-20' })]

  it('keeps check-ins from the first of the window to the end of this month', () => {
    expect(staysInPeriod(stays, '3m', TODAY).map(s => s.checkIn)).toEqual(['2026-08-15', '2026-10-20'])
    expect(staysInPeriod(stays, 'all', TODAY)).toHaveLength(3)
  })
})

describe('booking sources and stay length', () => {
  const stays = [
    stay({ source: 'Booking.com', nights: 2 }),
    stay({ source: 'Booking.com', nights: 3 }),
    stay({ source: 'Airbnb', nights: 9 }),
    stay({ source: 'Direct', nights: 1 }),
  ]

  it('shares bookings per channel, most first', () => {
    expect(bookingSources(stays)).toEqual([
      { source: 'Booking.com', bookings: 2, percent: 50 },
      { source: 'Airbnb', bookings: 1, percent: 25 },
      { source: 'Direct', bookings: 1, percent: 25 },
    ])
  })

  it('buckets stay lengths and averages them', () => {
    expect(stayLengthDistribution(stays).map(b => b.stays)).toEqual([1, 1, 1, 0, 1, 0])
    expect(averageStayLength(stays)).toBe(3.75)
    expect(averageStayLength([])).toBeNull()
  })
})
