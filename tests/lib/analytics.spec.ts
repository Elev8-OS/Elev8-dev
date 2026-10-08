// The Analytics page's figures all come out of this module, so the rules the
// UI cannot show are pinned here: stay-date attribution, no currency blending,
// comparison periods, bucket pairing and booking pace cut-offs.

import type { AnalyticsBooking, AnalyticsUnit } from '~/components/analytics/data/analytics'
import { describe, expect, it } from 'vitest'
import {
  bookingPace,
  buildAnalyticsBookings,
  channelMix,
  comparisonPeriod,
  currenciesOf,
  defaultCompareMode,
  earliestRangeStart,
  EMPTY_SCOPE,
  formatCompactMoney,
  guestOrigins,
  HISTORY_DAYS,
  leadTimeDistribution,
  listingPerformance,
  nightsIn,
  periodPerformance,
  resolvePeriod,
  scopeBookings,
  scopeUnits,
  shiftYear,
  spanDays,
  toAnalyticsUnits,
  trendBuckets,
  trendGrain,
  trendSeries,
  unitAvailableNights,
  unitCurrency,
} from '~/components/analytics/data/analytics'
import { retiredUnits } from '~/components/analytics/data/retired-listings'
import { addIsoDays } from '~/components/gm/data/gm-dashboard'
import { listings } from '~/components/listings/data/listings'

function unit(over: Partial<AnalyticsUnit> = {}): AnalyticsUnit {
  return {
    listingId: 'l1',
    listingName: 'Villa One',
    location: 'Canggu, Bali',
    region: 'Bali',
    tags: [],
    currency: 'USD',
    nightlyRate: 100,
    capacity: 4,
    lifecycle: 'active',
    ...over,
  }
}

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

describe('nightsIn', () => {
  it('counts the arrival night and not the departure night', () => {
    expect(nightsIn(booking(), SEPT)).toBe(3)
    expect(nightsIn(booking(), { start: '2026-09-12', end: '2026-09-12' })).toBe(1)
    expect(nightsIn(booking(), { start: '2026-09-13', end: '2026-09-20' })).toBe(0)
  })

  it('clips a stay that crosses the period edge', () => {
    expect(nightsIn(booking({ checkIn: '2026-08-29', checkOut: '2026-09-03', nights: 5 }), SEPT)).toBe(2)
    expect(nightsIn(booking({ checkIn: '2026-09-29', checkOut: '2026-10-04', nights: 5 }), SEPT)).toBe(2)
  })
})

describe('periodPerformance', () => {
  it('reads occupancy, ADR and RevPAR against the right denominators', () => {
    const units = [unit(), unit({ listingId: 'l2' })]
    const p = periodPerformance([booking()], units, SEPT, 'USD')
    expect(p.revenue).toBe(300)
    expect(p.occupiedNights).toBe(3)
    expect(p.availableNights).toBe(60)
    expect(p.occupancy).toBeCloseTo(3 / 60)
    expect(p.adr).toBe(100) // per night sold
    expect(p.revpar).toBe(5) // per night available
  })

  it('never blends currencies, and RevPAR only counts units earning in that currency', () => {
    const units = [unit(), unit({ listingId: 'l2', currency: 'EUR' })]
    const rows = [booking(), booking({ id: 'b2', listingId: 'l2', currency: 'EUR', nightlyRate: 200 })]
    const usd = periodPerformance(rows, units, SEPT, 'USD')
    const eur = periodPerformance(rows, units, SEPT, 'EUR')
    expect(usd.revenue).toBe(300)
    expect(eur.revenue).toBe(600)
    expect(usd.revpar).toBe(10) // 300 / (1 unit * 30 nights)
    // Occupancy spans every unit whatever the currency.
    expect(usd.occupancy).toBeCloseTo(6 / 60)
  })

  it('leaves cancelled bookings out of nights but counts them in the cancellation rate by booking date', () => {
    const rows = [
      booking({ bookedOn: '2026-09-02' }),
      booking({ id: 'b2', bookedOn: '2026-09-05', cancelledOn: '2026-09-07' }),
      booking({ id: 'b3', bookedOn: '2026-07-01', cancelledOn: '2026-09-07' }),
    ]
    const p = periodPerformance(rows, [unit()], SEPT, 'USD')
    expect(p.occupiedNights).toBe(3)
    expect(p.stays).toBe(1)
    expect(p.cancellationRate).toBe(0.5)
  })

  it('reports zeros and nulls, not NaN, for an empty period', () => {
    const p = periodPerformance([], [], SEPT, 'USD')
    expect(p).toMatchObject({ revenue: 0, occupancy: 0, adr: 0, revpar: 0, stays: 0, avgStayLength: null, avgLeadDays: null, cancellationRate: null })
  })
})

describe('periods', () => {
  it('resolves presets ending on the anchor day', () => {
    expect(resolvePeriod('30d', '2026-10-07')).toEqual({ start: '2026-09-08', end: '2026-10-07' })
    expect(spanDays(resolvePeriod('90d', '2026-10-07'))).toBe(90)
    expect(spanDays(resolvePeriod('12m', '2026-10-07'))).toBe(365)
    expect(resolvePeriod('ytd', '2026-10-07')).toEqual({ start: '2026-01-01', end: '2026-10-07' })
  })

  it('resolves the calendar presets', () => {
    expect(resolvePeriod('7d', '2026-10-07')).toEqual({ start: '2026-10-01', end: '2026-10-07' })
    expect(resolvePeriod('this_month', '2026-10-07')).toEqual({ start: '2026-10-01', end: '2026-10-07' })
    expect(resolvePeriod('last_month', '2026-10-07')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(resolvePeriod('last_month', '2026-03-15')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(resolvePeriod('last_year', '2026-10-07')).toEqual({ start: '2025-01-01', end: '2025-12-31' })
  })

  it('clamps a custom range to the data window and to today', () => {
    expect(resolvePeriod('custom', '2026-10-07', { start: '2026-08-01', end: '2026-08-15' })).toEqual({ start: '2026-08-01', end: '2026-08-15' })
    expect(resolvePeriod('custom', '2026-10-07', { start: '2026-09-01', end: '2026-12-31' }).end).toBe('2026-10-07')
    expect(resolvePeriod('custom', '2026-10-07', { start: '2020-01-01', end: '2026-01-01' }).start).toBe(earliestRangeStart('2026-10-07'))
    // A range must keep a full year of data behind it for the last-year comparison.
    expect(shiftYear(earliestRangeStart('2026-10-07')) >= addIsoDays('2026-10-07', -HISTORY_DAYS)).toBe(true)
    expect(resolvePeriod('custom', '2026-10-07', null)).toEqual(resolvePeriod('30d', '2026-10-07'))
  })

  it('compares with the stretch before, the same dates last year, or nothing', () => {
    expect(comparisonPeriod('previous', { start: '2026-09-08', end: '2026-10-07' })).toEqual({ start: '2026-08-09', end: '2026-09-07' })
    expect(comparisonPeriod('last_year', { start: '2026-01-01', end: '2026-10-07' })).toEqual({ start: '2025-01-01', end: '2025-10-07' })
    expect(comparisonPeriod('last_year', { start: '2028-01-01', end: '2028-02-29' })!.end).toBe('2027-02-28')
    expect(comparisonPeriod('none', { start: '2026-09-08', end: '2026-10-07' })).toBeNull()
  })

  it('defaults calendar and year-long periods to last year, rolling windows to the stretch before', () => {
    expect(defaultCompareMode('30d')).toBe('previous')
    expect(defaultCompareMode('7d')).toBe('previous')
    expect(defaultCompareMode('12m')).toBe('last_year')
    expect(defaultCompareMode('last_month')).toBe('last_year')
  })
})

describe('trend', () => {
  it('picks days, weeks or months by length', () => {
    expect(trendGrain({ start: '2026-09-01', end: '2026-09-30' })).toBe('day')
    expect(trendGrain({ start: '2026-07-01', end: '2026-09-30' })).toBe('week')
    expect(trendGrain({ start: '2025-10-08', end: '2026-10-07' })).toBe('month')
  })

  it('covers the span exactly, with partial edge months', () => {
    const buckets = trendBuckets({ start: '2025-10-08', end: '2026-10-07' }, 'month')
    expect(buckets).toHaveLength(13)
    expect(buckets[0]!.span).toEqual({ start: '2025-10-08', end: '2025-10-31' })
    expect(buckets.at(-1)!.span).toEqual({ start: '2026-10-01', end: '2026-10-07' })
    const days = buckets.reduce((s, b) => s + spanDays(b.span), 0)
    expect(days).toBe(365)
  })

  it('pairs each bucket with the comparison bucket in the same position', () => {
    const points = trendSeries([booking()], [unit()], SEPT, { start: '2026-08-03', end: '2026-08-31' }, 'USD')
    expect(points).toHaveLength(30)
    expect(points.at(-1)!.previous).toBeNull() // the comparison span is a day shorter
    expect(points[9]!.current.revenue).toBe(100)
  })
})

describe('distributions', () => {
  it('splits channels by stays, with revenue in the chosen currency only', () => {
    const rows = [booking(), booking({ id: 'b2', channel: 'Direct' }), booking({ id: 'b3', channel: 'Direct', currency: 'EUR' })]
    const mix = channelMix(rows, 'USD')
    expect(mix.map(m => m.channel)).toEqual(['Direct', 'Airbnb'])
    expect(mix[0]).toMatchObject({ stays: 2, revenue: 300, percent: 67 })
  })

  it('buckets lead times without gaps', () => {
    const dist = leadTimeDistribution([0, 3, 4, 90, 91, 300].map(leadDays => ({ leadDays })))
    expect(dist.map(d => d.stays)).toEqual([2, 1, 0, 0, 0, 1, 2])
  })

  it('folds small markets into Other', () => {
    const rows = ['AU', 'AU', 'US', 'DE', 'NL'].map(country => ({ country }))
    const origins = guestOrigins(rows, 2)
    expect(origins.map(o => o.name)).toEqual(['Australia', 'Germany', 'Other'])
    expect(origins.at(-1)!.stays).toBe(2)
  })
})

describe('bookingPace', () => {
  it('counts only what was booked, and not yet cancelled, by each cut-off', () => {
    const rows = [
      booking({ bookedOn: '2026-10-01', checkIn: '2026-11-10', checkOut: '2026-11-13' }),
      booking({ id: 'b2', bookedOn: '2026-10-20', checkIn: '2026-11-20', checkOut: '2026-11-23' }), // after today
      booking({ id: 'b3', bookedOn: '2025-09-01', checkIn: '2025-11-10', checkOut: '2025-11-16' }),
      booking({ id: 'b4', bookedOn: '2025-11-01', checkIn: '2025-11-20', checkOut: '2025-11-23' }), // after last year's cut-off
      booking({ id: 'b5', bookedOn: '2025-09-01', checkIn: '2025-11-01', checkOut: '2025-11-04', cancelledOn: '2025-09-15' }),
    ]
    const pace = bookingPace(rows, [unit()], '2026-10-07', 2)
    expect(pace.map(p => p.month)).toEqual(['2026-10', '2026-11'])
    expect(pace[1]!.onBooks).toBeCloseTo(3 / 30)
    expect(pace[1]!.lastYear).toBeCloseTo(6 / 30)
    // The current month counts from today, not from the 1st.
    expect(pace[0]!.month).toBe('2026-10')
  })
})

describe('listingPerformance', () => {
  it('gives each listing its own currency and occupancy change', () => {
    const units = [unit(), unit({ listingId: 'l2', currency: 'EUR' })]
    const rows = listingPerformance(
      [booking(), booking({ id: 'b2', listingId: 'l2', currency: 'EUR', nightlyRate: 150 })],
      units,
      SEPT,
      { start: '2026-08-02', end: '2026-08-31' },
    )
    expect(rows[1]).toMatchObject({ currency: 'EUR', revenue: 450, stays: 1 })
    expect(rows[0]!.occupancyDelta).toBeCloseTo(0.1)
  })
})

describe('generated portfolio', () => {
  const units = toAnalyticsUnits(listings.value)
  const bookings = buildAnalyticsBookings(units, '2026-10-07')

  it('is deterministic for the same anchor', () => {
    expect(buildAnalyticsBookings(units, '2026-10-07')).toEqual(bookings)
  })

  it('reads German listings in EUR rather than defaulting to USD', () => {
    const german = units.filter(u => u.region === 'Germany')
    expect(german.length).toBeGreaterThan(0)
    expect(german.every(u => u.currency === 'EUR')).toBe(true)
    expect(unitCurrency({ id: 'x', name: 'x', location: 'Ubud, Bali', tags: [], capacity: 2, pricing: { nightlyRate: 1 } })).toBe('USD')
    expect(currenciesOf(units)[0]).toBe('USD')
  })

  it('never books a unit twice for the same night', () => {
    for (const u of units) {
      const own = bookings.filter(b => b.listingId === u.listingId && !b.cancelledOn).sort((a, b) => a.checkIn.localeCompare(b.checkIn))
      for (let i = 1; i < own.length; i++)
        expect(own[i]!.checkIn >= own[i - 1]!.checkOut).toBe(true)
    }
  })

  it('holds no booking made after the anchor day', () => {
    expect(bookings.every(b => b.bookedOn <= '2026-10-07')).toBe(true)
    expect(bookings.every(b => !b.cancelledOn || b.cancelledOn <= '2026-10-07')).toBe(true)
  })

  it('lands in a believable range, with a full year behind the 12-month comparison', () => {
    const p = periodPerformance(bookings, units, resolvePeriod('12m', '2026-10-07'), 'USD')
    const prior = periodPerformance(bookings, units, comparisonPeriod('last_year', resolvePeriod('12m', '2026-10-07'))!, 'USD')
    expect(p.occupancy).toBeGreaterThan(0.5)
    expect(p.occupancy).toBeLessThan(0.9)
    expect(Math.abs(p.occupancy - prior.occupancy)).toBeLessThan(0.1)
    expect(p.cancellationRate!).toBeGreaterThan(0.03)
    expect(p.cancellationRate!).toBeLessThan(0.2)
  })
})

describe('formatCompactMoney', () => {
  it('leads with the ISO code', () => {
    expect(formatCompactMoney(18_400, 'USD')).toBe('USD 18.4K')
  })
})

describe('partial buckets', () => {
  it('flags weeks and months the period cuts short', () => {
    const months = trendBuckets({ start: '2025-10-08', end: '2026-10-07' }, 'month')
    expect(months[0]!.partial).toBe(true)
    expect(months[1]!.partial).toBe(false)
    expect(months.at(-1)!.partial).toBe(true)
    const weeks = trendBuckets({ start: '2026-07-01', end: '2026-07-10' }, 'week')
    expect(weeks.map(w => w.partial)).toEqual([false, true])
  })
})

describe('trend and listings without a comparison', () => {
  it('leaves every previous bucket and occupancy change empty', () => {
    expect(trendSeries([booking()], [unit()], SEPT, null, 'USD').every(p => p.previous === null)).toBe(true)
    expect(listingPerformance([booking()], [unit()], SEPT, null)[0]!.occupancyDelta).toBeNull()
  })
})

describe('scope filters', () => {
  const units = [
    unit({ listingId: 'a', region: 'Bali', tags: ['Pool', 'Ubud'] }),
    unit({ listingId: 'b', region: 'Bali', tags: ['Pool'] }),
    unit({ listingId: 'c', region: 'Germany', tags: ['Pool', 'EUR'], currency: 'EUR' }),
  ]

  it('combines region and listings as any-of and tags as all-of', () => {
    const ids = (scope: Partial<typeof EMPTY_SCOPE>) => scopeUnits(units, { ...EMPTY_SCOPE, ...scope }).map(u => u.listingId)
    expect(ids({})).toEqual(['a', 'b', 'c'])
    expect(ids({ regions: ['Bali'] })).toEqual(['a', 'b'])
    expect(ids({ listingIds: ['a', 'c'] })).toEqual(['a', 'c'])
    expect(ids({ tags: ['Pool', 'Ubud'] })).toEqual(['a'])
    expect(ids({ regions: ['Germany'], tags: ['Ubud'] })).toEqual([])
  })

  it('narrows bookings by channel and market but keeps the units, so occupancy reads as a share', () => {
    const rows = [
      booking({ listingId: 'a', channel: 'Airbnb', country: 'AU' }),
      booking({ id: 'b2', listingId: 'b', channel: 'Direct', country: 'AU' }),
      booking({ id: 'b3', listingId: 'b', channel: 'Airbnb', country: 'DE' }),
      booking({ id: 'b4', listingId: 'c', channel: 'Airbnb', country: 'AU' }),
    ]
    const inScope = scopeUnits(units, { ...EMPTY_SCOPE, regions: ['Bali'] })
    const kept = scopeBookings(rows, inScope, { ...EMPTY_SCOPE, regions: ['Bali'], channels: ['Airbnb'], countries: ['AU'] })
    expect(kept.map(b => b.id)).toEqual(['b1'])
    expect(periodPerformance(kept, inScope, SEPT, 'USD').availableNights).toBe(60)
  })
})

describe('inactive and deleted listings', () => {
  const anchor = '2026-10-07'
  const active = toAnalyticsUnits(listings.value)
  const retired = retiredUnits(anchor)

  it('counts a closed listing as available only before it closed', () => {
    expect(unitAvailableNights({}, SEPT)).toBe(30)
    expect(unitAvailableNights({ endedOn: '2026-09-11' }, SEPT)).toBe(10)
    expect(unitAvailableNights({ endedOn: '2026-08-01' }, SEPT)).toBe(0)
    const p = periodPerformance([booking()], [unit(), unit({ listingId: 'l2', endedOn: '2026-09-11' })], SEPT, 'USD')
    expect(p.availableNights).toBe(40)
    expect(p.revpar).toBeCloseTo(300 / 40)
  })

  it('leaves retired listings out unless the scope includes their kind', () => {
    const all = [...active, ...retired]
    const ids = (include: ('inactive' | 'deleted')[]) => scopeUnits(all, { ...EMPTY_SCOPE, includeRetired: include }).map(u => u.listingId)
    expect(ids([])).toHaveLength(active.length)
    expect(ids(['deleted']).filter(id => id.startsWith('retired-'))).toEqual(['retired-villa-bukit-sari', 'retired-ferienwohnung-am-see'])
    expect(ids(['inactive', 'deleted'])).toHaveLength(all.length)
  })

  it('books nothing on or after a listing closed, and keeps its history before', () => {
    const rows = buildAnalyticsBookings(retired, anchor)
    for (const u of retired) {
      const own = rows.filter(b => b.listingId === u.listingId)
      expect(own.length).toBeGreaterThan(20)
      expect(own.every(b => b.checkOut <= u.endedOn!)).toBe(true)
    }
  })

  it('never reshuffles active listings when retired ones join the portfolio', () => {
    const alone = buildAnalyticsBookings(active, anchor)
    const withRetired = buildAnalyticsBookings([...active, ...retired], anchor).filter(b => !b.listingId.startsWith('retired-'))
    expect(withRetired).toEqual(alone)
  })

  it('reads an undated inactive listing as selling nothing after today', () => {
    const rows = buildAnalyticsBookings([unit({ listingId: 'x', lifecycle: 'inactive' })], anchor)
    expect(rows.every(b => b.checkIn <= anchor)).toBe(true)
  })

  it('marks retired rows, and links only listings that have a page', () => {
    const rows = listingPerformance([], [unit(), ...retired], SEPT, null)
    expect(rows.map(r => [r.lifecycle, r.linkable])).toEqual([['active', true], ['deleted', false], ['inactive', false], ['deleted', false]])
  })
})
