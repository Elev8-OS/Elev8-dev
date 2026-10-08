// Revenue and Reservations tab figures. Pinned: each series agrees with the
// Overview totals, the date each count is read by, weekday attribution per
// night, the party split, and per-currency ranking.

import type { AnalyticsBooking, ListingPerformanceRow } from '~/components/analytics/data/analytics'
import { describe, expect, it } from 'vitest'
import { periodPerformance } from '~/components/analytics/data/analytics'
import { movementSeries, partyMix, partySummary, pickupSeries, stayAverages, stayAverageSeries } from '~/components/analytics/data/reservation-insights'
import { buildCommissionRates, makeValuer, revenueBreakdown } from '~/components/analytics/data/revenue-basis'
import { adrByWeekday, breakdownSeries, channelRevenueSeries, rankListingsByRevenue } from '~/components/analytics/data/revenue-insights'

function booking(over: Partial<AnalyticsBooking> = {}): AnalyticsBooking {
  return {
    id: 'b1',
    listingId: 'l1',
    channel: 'Airbnb',
    currency: 'USD',
    bookedOn: '2026-08-01',
    checkIn: '2026-09-10',
    checkOut: '2026-09-13',
    nights: 3,
    guests: 2,
    nightlyRate: 100,
    leadDays: 40,
    country: 'AU',
    ...over,
  }
}

const SEPT = { start: '2026-09-01', end: '2026-09-30' }
const unit = { listingId: 'l1', listingName: 'Villa', location: 'Ubud, Bali', region: 'Bali' as const, tags: [], currency: 'USD', nightlyRate: 100, capacity: 4, lifecycle: 'active' as const }

describe('revenue tab', () => {
  const rows = [
    booking(),
    booking({ id: 'b2', channel: 'Direct', checkIn: '2026-09-20', checkOut: '2026-09-22', nights: 2 }),
    booking({ id: 'b3', currency: 'EUR' }),
    booking({ id: 'b4', cancelledOn: '2026-09-01' }),
  ]

  it('splits revenue by channel per bucket and adds up to the Overview revenue', () => {
    const net = makeValuer('net')
    const series = channelRevenueSeries(rows, SEPT, 'USD', net)
    expect(series).toHaveLength(30)
    const total = series.reduce((s, p) => s + p.total, 0)
    expect(total).toBeCloseTo(periodPerformance(rows, [unit], SEPT, 'USD', net).revenue)
    expect(series[9]!.byChannel.Airbnb).toBeCloseTo(85)
    expect(series[19]!.byChannel.Direct).toBeCloseTo(97.1)
  })

  it('stacks gross to owner net per bucket, summing to the period breakdown', () => {
    const rates = buildCommissionRates(rows, [], [])
    const points = breakdownSeries(rows, SEPT, 'USD', rates)
    const period = revenueBreakdown(rows, SEPT, 'USD', rates)
    expect(points.reduce((s, p) => s + p.gross, 0)).toBeCloseTo(period.gross)
    for (const p of points)
      expect(p.ownerNet + p.managementCommission + p.paymentFees + p.otaCommission).toBeCloseTo(p.gross)
  })

  it('ranks only listings in the chosen currency and counts the others', () => {
    const row = (id: string, currency: string, revenue: number) => ({ listingId: id, listingName: id, currency, revenue }) as ListingPerformanceRow
    const { ranked, otherCurrency } = rankListingsByRevenue([row('a', 'USD', 10), row('b', 'EUR', 99), row('c', 'USD', 30)], 'USD')
    expect(ranked.map(r => r.listingId)).toEqual(['c', 'a'])
    expect(otherCurrency).toBe(1)
  })

  it('reads ADR by the weekday of each night, not of the arrival', () => {
    // Fri 2026-09-11 arrival, nights Fri and Sat.
    const rates = adrByWeekday([booking({ checkIn: '2026-09-11', checkOut: '2026-09-13', nights: 2, nightlyRate: 150 })], SEPT, 'USD', makeValuer('gross'))
    expect(rates.find(r => r.day === 'Fri')).toMatchObject({ adr: 150, nights: 1 })
    expect(rates.find(r => r.day === 'Sat')).toMatchObject({ adr: 150, nights: 1 })
    expect(rates.find(r => r.day === 'Mon')).toMatchObject({ adr: null, nights: 0 })
  })

  it('counts only weekday nights inside the period', () => {
    const rates = adrByWeekday([booking({ checkIn: '2026-08-30', checkOut: '2026-09-02', nights: 3 })], SEPT, 'USD', makeValuer('gross'))
    expect(rates.reduce((s, r) => s + r.nights, 0)).toBe(1)
  })
})

describe('reservations tab', () => {
  it('reads bookings and cancellations by the day they happened', () => {
    const rows = [
      booking({ bookedOn: '2026-09-05' }),
      booking({ id: 'b2', bookedOn: '2026-07-01', cancelledOn: '2026-09-05' }),
      booking({ id: 'b3', bookedOn: '2026-09-05', cancelledOn: '2026-09-06' }),
    ]
    const p = pickupSeries(rows, SEPT)
    expect(p[4]).toMatchObject({ booked: 2, cancelled: 1 })
    expect(p[5]).toMatchObject({ booked: 0, cancelled: 1 })
  })

  it('counts arrivals and departures of confirmed stays only', () => {
    const m = movementSeries([booking(), booking({ id: 'b2', cancelledOn: '2026-09-01' })], SEPT)
    expect(m[9]!.arrivals).toBe(1)
    expect(m[12]!.departures).toBe(1)
  })

  it('splits parties deterministically and keeps at least two adults', () => {
    expect(partyMix({ id: 'x', guests: 2 })).toEqual({ adults: 2, children: 0 })
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const m = partyMix({ id, guests: 3 })
      expect(m.adults + m.children).toBe(3)
      expect(m.adults).toBeGreaterThanOrEqual(2)
      expect(partyMix({ id, guests: 3 })).toEqual(m)
    }
  })

  it('summarises party sizes into buckets', () => {
    const s = partySummary([booking({ guests: 1 }), booking({ id: 'b2', guests: 2 }), booking({ id: 'b3', guests: 7 })])
    expect(s.buckets.find(b => b.label === '6+ guests')!.stays).toBe(1)
    expect(s.avgGuests).toBeCloseTo(10 / 3)
  })

  it('averages reservation value in one currency and length of stay over every stay', () => {
    const rows = [booking(), booking({ id: 'b2', nights: 5, checkOut: '2026-09-15', currency: 'EUR' })]
    const a = stayAverages(rows, SEPT, 'USD', makeValuer('gross'))
    expect(a.avgReservationValue).toBe(300)
    expect(a.avgLengthOfStay).toBe(4)
    expect(stayAverages([], SEPT, 'USD', makeValuer('gross'))).toEqual({ avgReservationValue: null, avgLengthOfStay: null })
  })

  it('pairs each bucket with the comparison bucket, or none', () => {
    expect(stayAverageSeries([booking()], SEPT, null, 'USD', makeValuer('gross')).every(p => p.previous === null)).toBe(true)
    const paired = stayAverageSeries([booking()], SEPT, { start: '2026-08-02', end: '2026-08-31' }, 'USD', makeValuer('gross'))
    expect(paired[0]!.previous).not.toBeNull()
  })
})
