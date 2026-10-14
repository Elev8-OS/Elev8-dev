// Direct bookings split by the Website Builder site they came from. Pinned:
// the site is picked deterministically without touching the main random
// stream, only among sites selling the listing, never on an OTA booking, and
// the site rows add up exactly to the Direct row of the channel mix.

import type { AnalyticsBooking, WebsiteCoverage } from '~/components/analytics/data/analytics'
import { describe, expect, it } from 'vitest'
import {
  arrivalsIn,
  buildAnalyticsBookings,
  channelMix,
  OTHER_DIRECT_LABEL,
  toAnalyticsUnits,
  websiteForBooking,
} from '~/components/analytics/data/analytics'
import { makeValuer } from '~/components/analytics/data/revenue-basis'
import { listings } from '~/components/listings/data/listings'

const ANCHOR = '2026-10-07'
const units = toAnalyticsUnits(listings.value)
const SITES: WebsiteCoverage[] = [
  { id: 's1', name: 'Villa Sunset Bali', listingIds: ['lst-1', 'lst-5'] },
  { id: 's2', name: 'Ubud Jungle Retreat', listingIds: ['lst-12'] },
  { id: 's3', name: 'Canggu Surf Villa', listingIds: ['lst-1', 'lst-12'] },
  { id: 's4', name: 'Coverage not set', listingIds: [] },
]

function booking(over: Partial<AnalyticsBooking> = {}): AnalyticsBooking {
  return {
    id: 'b1',
    listingId: 'lst-1',
    channel: 'Direct',
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

describe('website of a generated direct booking', () => {
  const plain = buildAnalyticsBookings(units, ANCHOR)
  const withSites = buildAnalyticsBookings(units, ANCHOR, undefined, SITES)

  it('is deterministic', () => {
    expect(buildAnalyticsBookings(units, ANCHOR, undefined, SITES)).toEqual(withSites)
  })

  it('draws nothing from the main random stream: every other field is unchanged', () => {
    expect(withSites.map(({ websiteId: _, ...rest }) => rest)).toEqual(plain.map(({ websiteId: _, ...rest }) => rest))
  })

  it('does not depend on the order the sites are passed in', () => {
    expect(buildAnalyticsBookings(units, ANCHOR, undefined, [...SITES].reverse())).toEqual(withSites)
  })

  it('is never set on an OTA booking', () => {
    const ota = withSites.filter(b => b.channel !== 'Direct')
    expect(ota.length).toBeGreaterThan(0)
    expect(ota.every(b => !('websiteId' in b))).toBe(true)
  })

  it('is one of the sites selling the listing, else null', () => {
    const direct = withSites.filter(b => b.channel === 'Direct')
    expect(direct.length).toBeGreaterThan(0)
    for (const b of direct) {
      const covering = SITES.filter(s => s.listingIds.includes(b.listingId)).map(s => s.id)
      if (covering.length)
        expect(covering).toContain(b.websiteId)
      else
        expect(b.websiteId).toBeNull()
    }
    // Both shared listings spread over more than one site.
    expect(new Set(direct.filter(b => b.listingId === 'lst-1').map(b => b.websiteId)).size).toBe(2)
  })

  it('is null on every direct booking when no site is passed', () => {
    expect(plain.filter(b => b.channel === 'Direct').every(b => b.websiteId === null)).toBe(true)
  })

  it('a site with no coverage takes no booking', () => {
    expect(withSites.some(b => b.websiteId === 's4')).toBe(false)
    expect(websiteForBooking(booking({ listingId: 'lst-2' }), SITES)).toBeNull()
  })
})

describe('channel mix by website', () => {
  const bookings = buildAnalyticsBookings(units, ANCHOR, undefined, SITES)
  const year = { start: '2025-10-08', end: ANCHOR }
  const arrivals = arrivalsIn(bookings, year)

  for (const currency of ['USD', 'EUR']) {
    for (const basis of ['gross', 'net'] as const) {
      it(`site rows add up to the Direct row (${currency}, ${basis})`, () => {
        const mix = channelMix(arrivals, currency, makeValuer(basis), SITES)
        const direct = mix.find(s => s.channel === 'Direct')!
        expect(direct.sites!.length).toBeGreaterThan(0)
        expect(direct.sites!.reduce((s, r) => s + r.stays, 0)).toBe(direct.stays)
        expect(direct.sites!.reduce((s, r) => s + r.percent, 0)).toBe(direct.percent)
        expect(direct.sites!.reduce((s, r) => s + r.revenue, 0)).toBeCloseTo(direct.revenue, 6)
      })
    }
  }

  it('only the Direct row carries sites', () => {
    const mix = channelMix(arrivals, 'USD', undefined, SITES)
    expect(mix.filter(s => s.channel !== 'Direct').every(s => s.sites === undefined)).toBe(true)
  })

  it('names the sites, busiest first, and puts Other direct last', () => {
    const sites = channelMix(arrivals, 'USD', undefined, SITES).find(s => s.channel === 'Direct')!.sites!
    expect(sites.at(-1)).toMatchObject({ websiteId: null, name: OTHER_DIRECT_LABEL })
    const named = sites.filter(s => s.websiteId)
    expect(named.map(s => s.name).every(n => SITES.some(s => s.name === n))).toBe(true)
    expect(named.map(s => s.stays)).toEqual([...named.map(s => s.stays)].sort((a, b) => b - a))
  })

  it('counts every stay but only the chosen currency in revenue', () => {
    const rows = [
      booking({ id: 'a', websiteId: 's1' }),
      booking({ id: 'b', websiteId: 's1', currency: 'EUR' }),
      booking({ id: 'c', websiteId: null }),
      booking({ id: 'd', channel: 'Airbnb' }),
    ]
    const direct = channelMix(rows, 'USD', undefined, SITES).find(s => s.channel === 'Direct')!
    expect(direct.sites).toEqual([
      { websiteId: 's1', name: 'Villa Sunset Bali', stays: 2, revenue: 300, percent: 50 },
      { websiteId: null, name: OTHER_DIRECT_LABEL, stays: 1, revenue: 300, percent: 25 },
    ])
  })

  it('splits a rounded percent so the sites still add up', () => {
    const rows = [
      booking({ id: 'a', websiteId: 's1' }),
      booking({ id: 'b', websiteId: 's2' }),
      booking({ id: 'c', websiteId: 's3' }),
    ]
    const direct = channelMix(rows, 'USD', undefined, SITES).find(s => s.channel === 'Direct')!
    expect(direct.percent).toBe(100)
    expect(direct.sites!.map(s => s.percent)).toEqual([34, 33, 33])
  })
})
