// Stay extensions on the Analytics Reservations tab: how the generator adds
// them (never reshuffling a stay, never double-booking a night) and how the
// figures attribute them (stays by arrival, money by the nights in the period).

import type { AnalyticsBooking } from '~/components/analytics/data/analytics'
import { describe, expect, it } from 'vitest'
import { buildAnalyticsBookings, stayExtensionFor, toAnalyticsUnits } from '~/components/analytics/data/analytics'
import { extensionRevenueSeries, extensionSummary } from '~/components/analytics/data/extension-insights'
import { makeValuer } from '~/components/analytics/data/revenue-basis'
import { listings } from '~/components/listings/data/listings'

function booking(over: Partial<AnalyticsBooking> = {}): AnalyticsBooking {
  return {
    id: 'b1',
    listingId: 'l1',
    channel: 'Direct',
    currency: 'USD',
    bookedOn: '2026-08-01',
    checkIn: '2026-09-01',
    checkOut: '2026-09-05',
    nights: 4,
    guests: 2,
    nightlyRate: 100,
    leadDays: 31,
    country: 'AU',
    ...over,
  }
}

const SEPTEMBER = { start: '2026-09-01', end: '2026-09-30' }

describe('generated extensions', () => {
  const anchor = '2026-10-07'
  const bookings = buildAnalyticsBookings(toAnalyticsUnits(listings.value), anchor)
  const linked = bookings.filter(b => b.extensionOf)
  const inPlace = bookings.filter(b => b.extendedNights)

  it('extends a believable share of stays, both ways', () => {
    const stays = bookings.filter(b => !b.extensionOf && !b.cancelledOn).length
    const share = (linked.length + inPlace.length) / stays
    expect(share).toBeGreaterThan(0.03)
    expect(share).toBeLessThan(0.15)
    expect(linked.length).toBeGreaterThan(0)
    expect(inPlace.length).toBeGreaterThan(0)
  })

  it('grows only direct stays and books OTA nights as a linked direct stay starting at check-out', () => {
    expect(inPlace.every(b => b.channel === 'Direct')).toBe(true)
    const byId = new Map(bookings.map(b => [b.id, b]))
    for (const ext of linked) {
      const parent = byId.get(ext.extensionOf!)!
      expect(parent.channel).not.toBe('Direct')
      expect(parent.cancelledOn).toBeUndefined()
      expect(ext).toMatchObject({ channel: 'Direct', checkIn: parent.checkOut, listingId: parent.listingId, nightlyRate: parent.nightlyRate })
    }
  })

  it('only counts extensions agreed by the anchor', () => {
    expect(inPlace.every(b => b.extendedOn! <= anchor)).toBe(true)
    expect(linked.every(b => b.bookedOn <= anchor)).toBe(true)
  })

  it('never extends without a free night, and is a pure function of the id', () => {
    const stay = { id: 'an-x-1', checkIn: '2026-09-01', checkOut: '2026-09-05' }
    expect(stayExtensionFor(stay, 0, anchor)).toBeNull()
    expect(stayExtensionFor(stay, 5, anchor)).toEqual(stayExtensionFor(stay, 5, anchor))
    for (let i = 0; i < 400; i++) {
      const e = stayExtensionFor({ ...stay, id: `an-x-${i}` }, 2, anchor)
      if (e)
        expect(e.nights).toBeLessThanOrEqual(2)
    }
  })
})

describe('extension figures', () => {
  it('counts stays by arrival and money by the added nights inside the period', () => {
    const rows = [
      // Direct stay arriving 1 Sep, extended in place by 2 nights (5 to 7 Sep).
      booking({ checkOut: '2026-09-07', nights: 6, extendedNights: 2, extendedOn: '2026-09-04' }),
      // Airbnb stay arriving 10 Sep, carried on direct 29 Sep to 3 Oct (2 nights in September).
      booking({ id: 'b2', channel: 'Airbnb', checkIn: '2026-09-10', checkOut: '2026-09-29', nights: 19 }),
      booking({ id: 'b2-ext', checkIn: '2026-09-29', checkOut: '2026-10-03', nights: 4, extensionOf: 'b2' }),
      // Not extended.
      booking({ id: 'b3', checkIn: '2026-09-15', checkOut: '2026-09-18', nights: 3 }),
      // Cancelled stays never count.
      booking({ id: 'b4', checkIn: '2026-09-20', checkOut: '2026-09-22', nights: 2, cancelledOn: '2026-09-01' }),
    ]
    const s = extensionSummary(rows, SEPTEMBER, 'USD')
    expect(s).toMatchObject({ stays: 3, extended: 2, extraNights: 6, viaDirect: 1 })
    expect(s.rate).toBeCloseTo(2 / 3)
    expect(s.avgExtraNights).toBe(3)
    expect(s.revenueInPlace).toBe(200)
    expect(s.revenueViaDirect).toBe(200)
    // 15% Airbnb commission minus 2.9% card fees on the 200 rebooked direct.
    expect(s.feesSaved).toBeCloseTo(24.2)
  })

  it('never blends currencies and follows the revenue basis', () => {
    const rows = [booking({ checkOut: '2026-09-07', nights: 6, extendedNights: 2, currency: 'EUR' })]
    expect(extensionSummary(rows, SEPTEMBER, 'USD').revenue).toBe(0)
    expect(extensionSummary(rows, SEPTEMBER, 'EUR').revenue).toBe(200)
    expect(extensionSummary(rows, SEPTEMBER, 'EUR', makeValuer('net')).revenue).toBeCloseTo(200 * 0.971)
  })

  it('splits the revenue series by how the stay was extended, adding up to the period', () => {
    const rows = [
      booking({ checkOut: '2026-09-07', nights: 6, extendedNights: 2 }),
      booking({ id: 'b2', channel: 'Booking.com', checkIn: '2026-09-10', checkOut: '2026-09-20', nights: 10 }),
      booking({ id: 'b2-ext', checkIn: '2026-09-20', checkOut: '2026-09-23', nights: 3, extensionOf: 'b2' }),
    ]
    const series = extensionRevenueSeries(rows, SEPTEMBER, 'USD')
    expect(series.reduce((t, p) => t + p.inPlace, 0)).toBe(200)
    expect(series.reduce((t, p) => t + p.viaDirect, 0)).toBe(300)
  })
})
