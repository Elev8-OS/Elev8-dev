// The GM dashboard's numbers all come out of this module, so the rules that
// would be invisible in the UI are pinned here: what counts as an occupied
// night, how a portfolio is generated (and that it is stable), and how the
// KPI deltas behave when a comparison period is empty.

import type { AttentionConversation, GmStay, GmUnit } from '~/components/gm/data/gm-dashboard'
import { describe, expect, it } from 'vitest'
import {
  addIsoDays,
  arrivalsOn,
  bookingsOn,
  buildDayFlow,
  buildGmStays,
  buildKpis,
  buildRegionByListingName,
  buildRevenueSeries,
  departuresOn,
  formatSignedPercent,
  formatSignedPoints,
  initialsOf,
  isoDiffDays,
  isoRange,
  isWeekend,
  KPI_LOOKBACK_DAYS,
  occupiesNight,
  periodMetrics,
  regionOf,
  relativeDelta,
  scopeToRegion,
  sortByAttention,
  summariseSentiment,
  toGmUnits,
  toIsoDate,
} from '~/components/gm/data/gm-dashboard'

const ANCHOR = '2026-09-08'

function stay(partial: Partial<GmStay> & Pick<GmStay, 'id' | 'checkIn' | 'checkOut'>): GmStay {
  const nights = isoDiffDays(partial.checkIn, partial.checkOut)
  return {
    listingId: 'lst-1',
    listingName: 'Villa Luwa',
    location: 'Canggu, Bali',
    region: 'Bali',
    guestName: 'Anna Schmidt',
    initials: 'AS',
    channel: 'Airbnb',
    nights,
    guests: 2,
    nightlyRate: 100,
    total: 100 * nights,
    status: 'verified',
    balanceDue: 0,
    ...partial,
  }
}

const units: GmUnit[] = [
  { id: 'lst-1', listingId: 'lst-1', listingName: 'Villa Luwa', location: 'Canggu, Bali', region: 'Bali', nightlyRate: 180, capacity: 6 },
  { id: 'lst-2', listingId: 'lst-2', listingName: 'Villa Bergfried', location: 'Freiburg, Germany', region: 'Germany', nightlyRate: 240, capacity: 4 },
]

/** Roughly the real portfolio's size, for the rules that only show at scale. */
const portfolio: GmUnit[] = Array.from({ length: 24 }, (_, i) => ({
  id: `lst-${i + 1}`,
  listingId: `lst-${i + 1}`,
  listingName: `Villa ${i + 1}`,
  location: i % 4 === 3 ? 'Weimar, Thüringen, Germany' : 'Canggu, Bali',
  region: i % 4 === 3 ? 'Germany' : 'Bali',
  nightlyRate: 120 + i * 5,
  capacity: 4,
}))

describe('date helpers', () => {
  it('adds days across a month boundary', () => {
    expect(addIsoDays('2026-09-29', 3)).toBe('2026-10-02')
    expect(addIsoDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('measures whole days in both directions', () => {
    expect(isoDiffDays('2026-09-08', '2026-09-15')).toBe(7)
    expect(isoDiffDays('2026-09-15', '2026-09-08')).toBe(-7)
  })

  it('builds a contiguous range', () => {
    expect(isoRange('2026-09-08', 3)).toEqual(['2026-09-08', '2026-09-09', '2026-09-10'])
  })

  it('reads a date in the viewer timezone, not UTC', () => {
    // 1 Jan 2026 00:30 local. A UTC-based reading would report 2025-12-31 for
    // anyone east of Greenwich, which would move the whole dashboard a day.
    expect(toIsoDate(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01')
  })

  it('knows the weekend', () => {
    expect(isWeekend('2026-09-12')).toBe(true) // Saturday
    expect(isWeekend('2026-09-13')).toBe(true) // Sunday
    expect(isWeekend('2026-09-14')).toBe(false)
  })
})

describe('occupancy', () => {
  const s = stay({ id: 's1', checkIn: '2026-09-08', checkOut: '2026-09-11' })

  it('counts the arrival night but not the departure night', () => {
    expect(occupiesNight(s, '2026-09-07')).toBe(false)
    expect(occupiesNight(s, '2026-09-08')).toBe(true)
    expect(occupiesNight(s, '2026-09-10')).toBe(true)
    // The guest leaves on the 11th, so that night is sellable again.
    expect(occupiesNight(s, '2026-09-11')).toBe(false)
  })

  it('splits a same-day turnover into one arrival and one departure', () => {
    const stays = [
      stay({ id: 'out', checkIn: '2026-09-05', checkOut: ANCHOR }),
      stay({ id: 'in', checkIn: ANCHOR, checkOut: '2026-09-12' }),
    ]
    expect(arrivalsOn(stays, ANCHOR).map(x => x.id)).toEqual(['in'])
    expect(departuresOn(stays, ANCHOR).map(x => x.id)).toEqual(['out'])

    const [today] = buildDayFlow(stays, [ANCHOR], 2)
    expect(today).toMatchObject({ arrivals: 1, departures: 1, occupied: 1, occupancy: 0.5 })
  })

  it('leaves a guest who arrived today out of the stayover list', () => {
    const stays = [
      stay({ id: 'arriving', checkIn: ANCHOR, checkOut: '2026-09-12' }),
      stay({ id: 'staying', checkIn: '2026-09-06', checkOut: '2026-09-12' }),
    ]
    const bookings = bookingsOn(stays, ANCHOR)
    expect(bookings.arrivals.map(x => x.id)).toEqual(['arriving'])
    expect(bookings.stayovers.map(x => x.id)).toEqual(['staying'])
  })
})

describe('revenue and period metrics', () => {
  it('recognises the nightly rate on each night sold', () => {
    const stays = [stay({ id: 's1', checkIn: '2026-09-08', checkOut: '2026-09-10', nightlyRate: 150 })]
    expect(buildRevenueSeries(stays, isoRange('2026-09-07', 4))).toEqual([
      { date: '2026-09-07', revenue: 0 },
      { date: '2026-09-08', revenue: 150 },
      { date: '2026-09-09', revenue: 150 },
      { date: '2026-09-10', revenue: 0 },
    ])
  })

  it('derives ADR from nights sold and RevPAR from nights available', () => {
    const stays = [stay({ id: 's1', checkIn: '2026-09-08', checkOut: '2026-09-10', nightlyRate: 200 })]
    const metrics = periodMetrics(stays, '2026-09-08', 4, 2)
    expect(metrics.revenue).toBe(400)
    expect(metrics.occupiedNights).toBe(2)
    expect(metrics.availableNights).toBe(8)
    expect(metrics.occupancy).toBe(0.25)
    expect(metrics.adr).toBe(200)
    expect(metrics.revpar).toBe(50)
  })

  it('reports zeros rather than NaN for an empty period', () => {
    const metrics = periodMetrics([], '2026-09-08', 4, 2)
    expect(metrics.adr).toBe(0)
    expect(metrics.revpar).toBe(0)
    expect(metrics.occupancy).toBe(0)
  })
})

describe('deltas', () => {
  it('reads a rise against an empty prior period as +100%, not Infinity', () => {
    expect(relativeDelta(500, 0)).toBe(1)
    expect(relativeDelta(0, 0)).toBe(0)
    expect(relativeDelta(120, 100)).toBeCloseTo(0.2)
  })

  it('signs its own formatting', () => {
    expect(formatSignedPercent(0.125)).toBe('+12.5%')
    expect(formatSignedPercent(-0.2)).toBe('-20.0%')
    // Occupancy moves in points, so it must not be printed as a percentage
    // of a percentage.
    expect(formatSignedPoints(0.04)).toBe('+4.0 pts')
  })
})

describe('kpis', () => {
  it('counts tonight against the portfolio and compares with a week ago', () => {
    const stays = [
      stay({ id: 'now', checkIn: '2026-09-07', checkOut: '2026-09-10', guests: 3 }),
      // Same unit a week earlier, so last week was fuller than tonight.
      stay({ id: 'then', checkIn: '2026-08-30', checkOut: '2026-09-03' }),
      stay({ id: 'then-2', checkIn: '2026-08-31', checkOut: '2026-09-03', listingId: 'lst-2' }),
    ]
    const kpis = buildKpis(stays, ANCHOR, 4)
    expect(kpis.inHouseUnits).toBe(1)
    expect(kpis.inHouseGuests).toBe(3)
    expect(kpis.occupancyTonight).toBe(0.25)
    // 2 of 4 units were occupied on 2026-09-01.
    expect(kpis.occupancyDelta).toBe(0.25 - 0.5)
  })

  it('flags arrivals that still need verifying', () => {
    const stays = [
      stay({ id: 'a', checkIn: ANCHOR, checkOut: '2026-09-11', status: 'unverified' }),
      stay({ id: 'b', checkIn: ANCHOR, checkOut: '2026-09-11', status: 'verified' }),
    ]
    const kpis = buildKpis(stays, ANCHOR, 4)
    expect(kpis.arrivalsToday).toBe(2)
    expect(kpis.unassignedArrivals).toBe(1)
  })
})

describe('portfolio generation', () => {
  it('keeps one unit per active listing and derives its region', () => {
    const listings = [
      { id: 'lst-1', name: 'A', location: 'Canggu, Bali', capacity: 6, pricing: { nightlyRate: 180 } },
      { id: 'lst-2', name: 'B', location: 'Weimar, Thüringen, Germany', capacity: 4, pricing: { nightlyRate: 240 } },
      { id: 'lst-3', name: 'C', location: 'Ubud, Bali', capacity: 2, status: 'inactive' as const, pricing: { nightlyRate: 90 } },
    ]
    const result = toGmUnits(listings)
    expect(result.map(u => u.id)).toEqual(['lst-1', 'lst-2'])
    expect(result.map(u => u.region)).toEqual(['Bali', 'Germany'])
    expect(regionOf('Freiburg, Baden-Württemberg, Germany')).toBe('Germany')
  })

  it('is deterministic — the same anchor and seed give the same portfolio', () => {
    const first = buildGmStays(units, ANCHOR)
    const second = buildGmStays(units, ANCHOR)
    expect(first.map(s => `${s.id}:${s.checkIn}:${s.nightlyRate}`))
      .toEqual(second.map(s => `${s.id}:${s.checkIn}:${s.nightlyRate}`))
  })

  it('never overlaps two stays in one unit', () => {
    const stays = buildGmStays(units, ANCHOR)
    for (const unit of units) {
      const forUnit = stays
        .filter(s => s.listingId === unit.id)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
      forUnit.forEach((current, i) => {
        const next = forUnit[i + 1]
        if (next)
          expect(next.checkIn >= current.checkOut).toBe(true)
      })
    }
  })

  it('fills the window either side of the anchor at a plausible occupancy', () => {
    const stays = buildGmStays(units, ANCHOR, { pastDays: 30, futureDays: 30 })
    expect(stays.some(s => s.checkOut <= ANCHOR)).toBe(true)
    expect(stays.some(s => s.checkIn > ANCHOR)).toBe(true)

    const occupancy = periodMetrics(stays, addIsoDays(ANCHOR, -29), 30, units.length).occupancy
    expect(occupancy).toBeGreaterThan(0.5)
    expect(occupancy).toBeLessThan(0.95)
  })

  it('derives each stay status from the anchor date', () => {
    const stays = buildGmStays(units, ANCHOR)
    for (const s of stays) {
      if (s.checkOut <= ANCHOR)
        expect(s.status).toBe('checked_out')
      else if (s.checkIn < ANCHOR)
        expect(s.status).toBe('checked_in')
      else expect(['verified', 'unverified']).toContain(s.status)
    }
  })

  it('leaves a guest arriving today expected, not already in house', () => {
    // `checked_in` means already in house. A guest arriving today has not
    // turned up yet — they are due at their ETA — and calling them checked in
    // also hid whether they still need verifying.
    const stays = buildGmStays(portfolio, ANCHOR)
    const arriving = arrivalsOn(stays, ANCHOR)
    expect(arriving.length).toBeGreaterThan(0)
    for (const s of arriving)
      expect(['verified', 'unverified']).toContain(s.status)
  })

  it('can actually flag an arrival as unverified', () => {
    // Guards the regression this replaced: every arrival was overwritten to
    // `checked_in`, so the header's unverified-arrivals badge could never
    // fire and `Verified`/`Unverified` never rendered in the table.
    const stays = buildGmStays(portfolio, ANCHOR)
    expect(stays.some(s => s.status === 'unverified')).toBe(true)
    expect(stays.some(s => s.status === 'verified')).toBe(true)
    expect(stays.some(s => s.status === 'checked_in')).toBe(true)
    expect(stays.some(s => s.status === 'checked_out')).toBe(true)
  })

  it('covers the whole KPI comparison window, so the trends are not inflated', () => {
    // The default portfolio must reach back far enough for both 30-day
    // periods. A short window leaves the prior one half empty and every
    // delta reads as a huge rise.
    const stays = buildGmStays(units, ANCHOR)
    const prior = periodMetrics(stays, addIsoDays(ANCHOR, -(KPI_LOOKBACK_DAYS - 1)), 30, units.length)
    expect(prior.occupancy).toBeGreaterThan(0.5)

    const kpis = buildKpis(stays, ANCHOR, units.length)
    expect(Math.abs(kpis.revparDelta)).toBeLessThan(0.5)
    expect(Math.abs(kpis.revenue30dDelta)).toBeLessThan(0.5)
  })

  it('takes initials from the first two names', () => {
    expect(initialsOf('Anna Schmidt')).toBe('AS')
    expect(initialsOf('Liam O\'Connor')).toBe('LO')
  })
})

describe('guest sentiment scoping', () => {
  function conv(partial: Partial<AttentionConversation> & Pick<AttentionConversation, 'id'>): AttentionConversation {
    return {
      guestName: 'Anna Schmidt',
      guestInitials: 'AS',
      listingName: 'Villa Luwa',
      sentiment: 'negative',
      sentimentNote: 'Air conditioning is broken',
      status: null,
      lastMessageAt: '2026-09-08T09:00:00Z',
      ...partial,
    }
  }

  const byName = buildRegionByListingName(units)

  it('maps a listing name to its region', () => {
    expect(byName.get('Villa Luwa')).toBe('Bali')
    expect(byName.get('Villa Bergfried')).toBe('Germany')
    expect(byName.get('Nowhere House')).toBeUndefined()
  })

  it('passes everything through when no region is selected', () => {
    const rows = [conv({ id: 'a' }), conv({ id: 'b', listingName: 'Nowhere House' })]
    expect(scopeToRegion(rows, 'all', byName)).toEqual({ rows, excluded: 0 })
  })

  it('keeps only the selected region and counts what it dropped', () => {
    const rows = [
      conv({ id: 'bali' }),
      conv({ id: 'de', listingName: 'Villa Bergfried' }),
      // Half the mock conversations name a listing that no longer exists;
      // those are reported, never silently swallowed.
      conv({ id: 'orphan', listingName: 'Villa Ocean' }),
    ]
    const scoped = scopeToRegion(rows, 'Germany', byName)
    expect(scoped.rows.map(r => r.id)).toEqual(['de'])
    expect(scoped.excluded).toBe(2)
  })

  it('puts action-needed first, then priority, then the newest message', () => {
    const rows = [
      conv({ id: 'quiet-new', lastMessageAt: '2026-09-08T18:00:00Z' }),
      conv({ id: 'flagged-medium', status: 'action_needed', actionPriority: 'medium', lastMessageAt: '2026-09-01T08:00:00Z' }),
      conv({ id: 'flagged-high', status: 'action_needed', actionPriority: 'high', lastMessageAt: '2026-08-30T08:00:00Z' }),
      conv({ id: 'quiet-old', lastMessageAt: '2026-09-02T08:00:00Z' }),
    ]
    expect(sortByAttention(rows).map(r => r.id))
      .toEqual(['flagged-high', 'flagged-medium', 'quiet-new', 'quiet-old'])
  })

  it('treats a missing priority as the lowest', () => {
    const rows = [
      conv({ id: 'none', status: 'action_needed', lastMessageAt: '2026-09-08T10:00:00Z' }),
      conv({ id: 'high', status: 'action_needed', actionPriority: 'high', lastMessageAt: '2026-09-01T10:00:00Z' }),
    ]
    expect(sortByAttention(rows).map(r => r.id)).toEqual(['high', 'none'])
  })

  it('does not mutate the array it was given', () => {
    const rows = [conv({ id: 'a' }), conv({ id: 'b', status: 'action_needed' })]
    sortByAttention(rows)
    expect(rows.map(r => r.id)).toEqual(['a', 'b'])
  })

  it('summarises the negative count, the flagged count and the exclusions', () => {
    const rows = [
      conv({ id: 'a', status: 'action_needed' }),
      conv({ id: 'b', status: 'action_needed' }),
      conv({ id: 'c' }),
    ]
    expect(summariseSentiment(rows, 2)).toEqual({ negative: 3, actionNeeded: 2, excluded: 2 })
  })
})
