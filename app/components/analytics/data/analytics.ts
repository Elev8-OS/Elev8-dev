/**
 * Portfolio analytics: data and derivations.
 *
 * Framework-free, the same split as `gm-dashboard.ts`: `useAnalytics` owns the
 * reactive state and calls in here.
 *
 * ⚠️ The bookings are generated, not read from `reservations/data/reservations.ts`.
 * Those are dated Jul-Sep 2026 on a handful of listings, which cannot fill a
 * 12-month trend, a year-on-year comparison or a booking pace chart. So, like
 * the GM dashboard, a deterministic portfolio is generated from the real
 * listings (ids, names, tags, nightly rates) and anchored to the day the page
 * is opened. Same anchor in, same numbers out.
 *
 * Money rules: revenue is never converted. Each listing earns in one currency,
 * and every money figure is for one chosen currency, computed over the
 * listings that earn in it. Occupancy, counts and durations span every listing.
 */

import { addIsoDays, isoDiffDays, isoRange, mulberry32, regionOf } from '~/components/gm/data/gm-dashboard'

export type AnalyticsChannel = 'Airbnb' | 'Booking.com' | 'Direct'

export const ANALYTICS_CHANNELS: AnalyticsChannel[] = ['Airbnb', 'Booking.com', 'Direct']

export interface AnalyticsUnit {
  listingId: string
  listingName: string
  location: string
  region: 'Bali' | 'Germany'
  tags: string[]
  currency: string
  nightlyRate: number
  capacity: number
  /**
   * Inactive and deleted listings still carry their past stays, so analytics
   * can count them on request. Hidden by default.
   */
  lifecycle: UnitLifecycle
  /**
   * First day the listing no longer sells (deactivated or deleted). Nights
   * from then on are neither booked nor available, so a listing deleted in
   * March does not drag down occupancy for April. Absent on an inactive
   * listing whose date is unknown: it sells nothing after today.
   */
  endedOn?: string
  /** Analytics-only demo history with no listing behind it (see `retired-listings.ts`). */
  demoOnly?: boolean
}

export type UnitLifecycle = 'active' | 'inactive' | 'deleted'
export type RetiredLifecycle = Exclude<UnitLifecycle, 'active'>

export const LIFECYCLE_LABELS: Record<UnitLifecycle, string> = {
  active: 'Active',
  inactive: 'Inactive',
  deleted: 'Deleted',
}

export interface AnalyticsBooking {
  id: string
  listingId: string
  channel: AnalyticsChannel
  currency: string
  /** ISO dates, `YYYY-MM-DD`. */
  bookedOn: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  nightlyRate: number
  /** Days from booking to arrival. */
  leadDays: number
  /** ISO 3166 alpha-2. */
  country: string
  /** Set when the guest cancelled; a cancelled booking holds no nights. */
  cancelledOn?: string
}

/* ----------------------------------------------------------------- units */

interface ListingLike {
  id: string
  name: string
  location: string
  tags: string[]
  capacity: number
  status?: 'active' | 'inactive'
  pricing: { nightlyRate: number }
  unitTypes?: { pricing?: { currency?: string } }[]
}

/**
 * The currency a listing earns in: its rate plan's, else the market's. The
 * German listings carry no rate plan yet, and reading them as USD would put
 * a Black Forest chalet in the same revenue total as a Bali villa.
 */
export function unitCurrency(listing: ListingLike): string {
  const fromPlan = listing.unitTypes?.find(t => t.pricing?.currency)?.pricing?.currency
  if (fromPlan)
    return fromPlan
  return regionOf(listing.location) === 'Germany' ? 'EUR' : 'USD'
}

/**
 * One sellable unit per listing, the denominator occupancy is quoted against.
 * Inactive listings are kept, flagged, and left to the scope filter.
 */
export function toAnalyticsUnits(listings: ListingLike[]): AnalyticsUnit[] {
  return listings
    .map(l => ({
      listingId: l.id,
      listingName: l.name,
      location: l.location,
      region: regionOf(l.location),
      tags: l.tags,
      currency: unitCurrency(l),
      nightlyRate: l.pricing.nightlyRate,
      capacity: l.capacity,
      lifecycle: l.status === 'inactive' ? 'inactive' as const : 'active' as const,
    }))
}

/** Last day a unit sells, exclusive: its end date, today for an undated inactive one, else the window end. */
function unitStopsOn(unit: AnalyticsUnit, anchorIso: string, windowEnd: string): string {
  if (unit.endedOn)
    return unit.endedOn
  return unit.lifecycle === 'active' ? windowEnd : addIsoDays(anchorIso, 1)
}

/** Stable per listing, so including or excluding other listings never reshuffles this one's stays. */
function listingSeed(listingId: string): number {
  let h = 2166136261
  for (let i = 0; i < listingId.length; i++)
    h = Math.imul(h ^ listingId.charCodeAt(i), 16777619)
  return h >>> 0
}

/* -------------------------------------------------------------- generator */

/** Demand by calendar month (0 = January), 1 = average. */
const SEASONALITY: Record<AnalyticsUnit['region'], number[]> = {
  // Dry season and the Christmas peak; February and November are the troughs.
  Bali: [0.95, 0.8, 0.85, 0.9, 0.95, 1.05, 1.25, 1.3, 1.1, 0.95, 0.8, 1.2],
  Germany: [0.7, 0.75, 0.85, 0.95, 1.05, 1.15, 1.3, 1.3, 1.1, 1, 0.8, 1],
}

const COUNTRY_WEIGHTS: Record<AnalyticsUnit['region'], [string, number][]> = {
  Bali: [['AU', 30], ['US', 12], ['GB', 10], ['DE', 9], ['NL', 6], ['SG', 7], ['JP', 5], ['FR', 6], ['ID', 8], ['CH', 3], ['CN', 4]],
  Germany: [['DE', 52], ['CH', 12], ['NL', 9], ['AT', 8], ['DK', 5], ['GB', 4], ['US', 4], ['FR', 3], ['BE', 3]],
}

const CHANNEL_PROFILE: Record<AnalyticsChannel, { weight: number, meanLead: number, cancelRate: number }> = {
  'Airbnb': { weight: 0.45, meanLead: 40, cancelRate: 0.07 },
  'Booking.com': { weight: 0.34, meanLead: 30, cancelRate: 0.15 },
  'Direct': { weight: 0.21, meanLead: 65, cancelRate: 0.04 },
}

function weighted<T>(rand: () => number, entries: [T, number][]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = rand() * total
  for (const [value, w] of entries) {
    roll -= w
    if (roll < 0)
      return value
  }
  return entries.at(-1)![0]
}

function monthOf(iso: string): number {
  return Number(iso.slice(5, 7)) - 1
}

/**
 * Two years back, so a 12-month period still has a full year before it to
 * compare against, and six months ahead for the booking pace.
 */
export const HISTORY_DAYS = 2 * 365 + 7
export const FUTURE_DAYS = 190

export function buildAnalyticsBookings(units: AnalyticsUnit[], anchorIso: string, seed = 51_017): AnalyticsBooking[] {
  const windowStart = addIsoDays(anchorIso, -HISTORY_DAYS)
  const windowEnd = addIsoDays(anchorIso, FUTURE_DAYS)
  const bookings: AnalyticsBooking[] = []

  units.forEach((unit) => {
    const rand = mulberry32(seed + listingSeed(unit.listingId))
    const season = SEASONALITY[unit.region]
    const stopOn = unitStopsOn(unit, anchorIso, windowEnd)
    let cursor = addIsoDays(windowStart, Math.floor(rand() * 6))
    let sequence = 0

    while (isoDiffDays(cursor, stopOn) >= 2) {
      const demand = season[monthOf(cursor)]!
      const wanted = Math.max(1, Math.round((unit.region === 'Germany' ? 2 : 3) + rand() * rand() * 12))
      const checkIn = cursor
      // The last stay before a listing closes ends on its closing day.
      const nights = Math.min(wanted, isoDiffDays(checkIn, stopOn))
      const checkOut = addIsoDays(checkIn, nights)
      const channel = weighted(rand, ANALYTICS_CHANNELS.map(c => [c, CHANNEL_PROFILE[c].weight]))
      const profile = CHANNEL_PROFILE[channel]
      // Exponential lead time, longer in high season when guests plan ahead.
      const leadDays = Math.min(330, Math.round(-Math.log(1 - rand() * 0.999) * profile.meanLead * demand))
      const bookedOn = addIsoDays(checkIn, -leadDays)
      const rate = Math.round(unit.nightlyRate * (0.75 + demand * 0.3) * (0.92 + rand() * 0.16))
      const cancelled = rand() < profile.cancelRate
      const country = weighted(rand, COUNTRY_WEIGHTS[unit.region])
      const guests = 1 + Math.floor(rand() * Math.max(1, Math.min(unit.capacity, 6)))

      // A stay that will only be booked after today does not exist yet, which
      // is what makes the months ahead read as "on the books so far".
      if (bookedOn <= anchorIso) {
        let cancelledOn: string | undefined
        if (cancelled) {
          const latest = checkIn < anchorIso ? checkIn : anchorIso
          const span = Math.max(0, isoDiffDays(bookedOn, latest))
          cancelledOn = addIsoDays(bookedOn, Math.floor(rand() * (span + 1)))
        }
        bookings.push({
          id: `an-${unit.listingId}-${sequence}`,
          listingId: unit.listingId,
          channel,
          currency: unit.currency,
          bookedOn,
          checkIn,
          checkOut,
          nights,
          guests,
          nightlyRate: rate,
          leadDays,
          country,
          cancelledOn,
        })
        sequence += 1
      }

      // Busy months turn over the same day; quiet ones leave the unit empty.
      const gapChance = Math.min(0.9, Math.max(0.15, 1.15 - demand * 0.7))
      const gap = rand() < gapChance ? 1 + Math.floor(rand() * (demand < 1 ? 6 : 3)) : 0
      cursor = addIsoDays(checkOut, gap)
    }
  })

  return bookings
}

/* ----------------------------------------------------------------- periods */

export type AnalyticsPeriodPreset = '7d' | '30d' | '90d' | '12m' | 'this_month' | 'last_month' | 'ytd' | 'last_year' | 'custom'

export const ANALYTICS_PERIODS: { value: AnalyticsPeriodPreset, label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'last_year', label: 'Last calendar year' },
  { value: 'custom', label: 'Custom range' },
]

export type AnalyticsCompareMode = 'previous' | 'last_year' | 'none'

export const ANALYTICS_COMPARE_MODES: { value: AnalyticsCompareMode, label: string }[] = [
  { value: 'previous', label: 'Previous period' },
  { value: 'last_year', label: 'Same period last year' },
  { value: 'none', label: 'No comparison' },
]

/** Inclusive ISO date range. */
export interface DateSpan {
  start: string
  end: string
}

export function spanDays(span: DateSpan): number {
  return isoDiffDays(span.start, span.end) + 1
}

/** The same calendar date a year earlier; 29 February becomes the 28th. */
export function shiftYear(iso: string, years = -1): string {
  return `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`.replace(/-02-29$/, '-02-28')
}

/**
 * Earliest day a custom range may start: the bookings reach two years back,
 * and a range needs a full year behind it for the last-year comparison.
 */
export function earliestRangeStart(anchorIso: string): string {
  return addIsoDays(anchorIso, -(HISTORY_DAYS - 366))
}

/**
 * The chosen period. Presets end on the anchor day, except the closed
 * calendar ones. A custom range is clamped to what the data covers and never
 * runs past today: the months ahead are read on the Booking pace chart, where
 * "booked so far" is compared with "booked so far", not with final figures.
 */
export function resolvePeriod(preset: AnalyticsPeriodPreset, anchorIso: string, custom?: DateSpan | null): DateSpan {
  const year = Number(anchorIso.slice(0, 4))
  const monthStart = `${anchorIso.slice(0, 7)}-01`
  switch (preset) {
    case '7d': return { start: addIsoDays(anchorIso, -6), end: anchorIso }
    case '30d': return { start: addIsoDays(anchorIso, -29), end: anchorIso }
    case '90d': return { start: addIsoDays(anchorIso, -89), end: anchorIso }
    case '12m': return { start: addIsoDays(anchorIso, -364), end: anchorIso }
    case 'this_month': return { start: monthStart, end: anchorIso }
    case 'last_month': {
      const end = addIsoDays(monthStart, -1)
      return { start: `${end.slice(0, 7)}-01`, end }
    }
    case 'ytd': return { start: `${year}-01-01`, end: anchorIso }
    case 'last_year': return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` }
    case 'custom': {
      if (!custom)
        return resolvePeriod('30d', anchorIso)
      const min = earliestRangeStart(anchorIso)
      const start = custom.start < min ? min : custom.start > anchorIso ? anchorIso : custom.start
      const end = custom.end > anchorIso ? anchorIso : custom.end < start ? start : custom.end
      return { start, end }
    }
  }
}

/**
 * The comparison mode a period reads best against: periods of a year or
 * more, and calendar periods, against last year so seasonality cancels out;
 * short rolling windows against the stretch right before them.
 */
export function defaultCompareMode(preset: AnalyticsPeriodPreset): AnalyticsCompareMode {
  return preset === '12m' || preset === 'ytd' || preset === 'last_year' || preset === 'this_month' || preset === 'last_month'
    ? 'last_year'
    : 'previous'
}

/** The comparison period, or null with comparison turned off. */
export function comparisonPeriod(mode: AnalyticsCompareMode, span: DateSpan): DateSpan | null {
  if (mode === 'none')
    return null
  if (mode === 'last_year')
    return { start: shiftYear(span.start), end: shiftYear(span.end) }
  const days = spanDays(span)
  return { start: addIsoDays(span.start, -days), end: addIsoDays(span.start, -1) }
}

export function comparisonLabel(mode: AnalyticsCompareMode): string {
  if (mode === 'none')
    return ''
  return mode === 'last_year' ? 'vs same period last year' : 'vs previous period'
}

/** `8 Sep 2026 - 7 Oct 2026`, for the custom range label and the subtitle. */
export function formatSpan(span: DateSpan): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  return span.start === span.end ? fmt(span.start) : `${fmt(span.start)} - ${fmt(span.end)}`
}

/* ---------------------------------------------------------------- filters */

export interface AnalyticsScope {
  regions: string[]
  listingIds: string[]
  /** AND logic, like the Listings index. */
  tags: string[]
  channels: AnalyticsChannel[]
  /** Guest markets, ISO 3166 alpha-2. */
  countries: string[]
  /** Retired listings to count alongside the active ones; none by default. */
  includeRetired: RetiredLifecycle[]
}

export const EMPTY_SCOPE: AnalyticsScope = { regions: [], listingIds: [], tags: [], channels: [], countries: [], includeRetired: [] }

/** Active, or a retired kind the scope asks for. */
export function lifecycleIncluded(unit: Pick<AnalyticsUnit, 'lifecycle'>, include: RetiredLifecycle[]): boolean {
  return unit.lifecycle === 'active' || include.includes(unit.lifecycle)
}

/** Units in scope: region and listing pick any of, tags need all, retired ones only when included. */
export function scopeUnits(units: AnalyticsUnit[], scope: AnalyticsScope): AnalyticsUnit[] {
  return units.filter(u =>
    lifecycleIncluded(u, scope.includeRetired)
    && (!scope.regions.length || scope.regions.includes(u.region))
    && (!scope.listingIds.length || scope.listingIds.includes(u.listingId))
    && scope.tags.every(t => u.tags.includes(t)))
}

/**
 * Bookings in scope. Channel and market narrow the bookings but not the units,
 * so occupancy then reads as "share of nights sold through Airbnb" (or to
 * Australian guests), against the same available nights.
 */
export function scopeBookings(bookings: AnalyticsBooking[], units: AnalyticsUnit[], scope: AnalyticsScope): AnalyticsBooking[] {
  const ids = new Set(units.map(u => u.listingId))
  return bookings.filter(b =>
    ids.has(b.listingId)
    && (!scope.channels.length || scope.channels.includes(b.channel))
    && (!scope.countries.length || scope.countries.includes(b.country)))
}

/* --------------------------------------------------------------- metrics */

/**
 * What a booking's nights inside a span are worth. Gross by default; the
 * net and owner-net valuers live in `revenue-basis.ts`.
 */
export type BookingValuer = (b: AnalyticsBooking, span: DateSpan) => number

export function grossValue(b: AnalyticsBooking, span: DateSpan): number {
  return nightsIn(b, span) * b.nightlyRate
}

/** Nights `unit` could be sold in `span`: all of them, or those before it closed. */
export function unitAvailableNights(unit: Pick<AnalyticsUnit, 'endedOn'>, span: DateSpan): number {
  if (!unit.endedOn)
    return spanDays(span)
  return nightsIn({ checkIn: span.start, checkOut: unit.endedOn }, span)
}

function availableNightsOf(units: Pick<AnalyticsUnit, 'endedOn'>[], span: DateSpan): number {
  return units.reduce((sum, u) => sum + unitAvailableNights(u, span), 0)
}

export function isCancelled(b: AnalyticsBooking): boolean {
  return b.cancelledOn !== undefined
}

/** Nights of `b` inside `span` (arrival night counts, departure night does not). */
export function nightsIn(b: Pick<AnalyticsBooking, 'checkIn' | 'checkOut'>, span: DateSpan): number {
  const from = b.checkIn > span.start ? b.checkIn : span.start
  const endExclusive = addIsoDays(span.end, 1)
  const to = b.checkOut < endExclusive ? b.checkOut : endExclusive
  return Math.max(0, isoDiffDays(from, to))
}

export interface PeriodPerformance {
  /** Revenue earned on nights inside the period, in `currency` only. */
  revenue: number
  currency: string
  occupiedNights: number
  availableNights: number
  /** 0..1, across every unit. */
  occupancy: number
  /** Per night sold, in `currency`. */
  adr: number
  /** Per night available on the units earning in `currency`. */
  revpar: number
  /** Stays arriving in the period. */
  stays: number
  /** Mean nights per arriving stay, null without stays. */
  avgStayLength: number | null
  /** Mean booking window of arriving stays, null without stays. */
  avgLeadDays: number | null
  /** Share of bookings made in the period that were cancelled, null without bookings. */
  cancellationRate: number | null
}

/**
 * Stay-date figures: revenue and occupancy count the nights that fall inside
 * the period, stays and their averages count arrivals, and the cancellation
 * rate reads bookings by the day they were made.
 */
export function periodPerformance(
  bookings: AnalyticsBooking[],
  units: AnalyticsUnit[],
  span: DateSpan,
  currency: string,
  value: BookingValuer = grossValue,
): PeriodPerformance {
  const availableInCurrency = availableNightsOf(units.filter(u => u.currency === currency), span)
  let revenue = 0
  let occupiedNights = 0
  let soldInCurrency = 0
  const arrivals: AnalyticsBooking[] = []
  let made = 0
  let cancelled = 0

  for (const b of bookings) {
    if (b.bookedOn >= span.start && b.bookedOn <= span.end) {
      made += 1
      if (isCancelled(b))
        cancelled += 1
    }
    if (isCancelled(b))
      continue
    const n = nightsIn(b, span)
    occupiedNights += n
    if (b.currency === currency) {
      revenue += n ? value(b, span) : 0
      soldInCurrency += n
    }
    if (b.checkIn >= span.start && b.checkIn <= span.end)
      arrivals.push(b)
  }

  const availableNights = availableNightsOf(units, span)
  const mean = (values: number[]) => values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
  return {
    revenue,
    currency,
    occupiedNights,
    availableNights,
    occupancy: availableNights ? occupiedNights / availableNights : 0,
    adr: soldInCurrency ? revenue / soldInCurrency : 0,
    revpar: availableInCurrency ? revenue / availableInCurrency : 0,
    stays: arrivals.length,
    avgStayLength: mean(arrivals.map(b => b.nights)),
    avgLeadDays: mean(arrivals.map(b => b.leadDays)),
    cancellationRate: made ? cancelled / made : null,
  }
}

/** Currencies earned in, most units first: the currency picker's options. */
export function currenciesOf(units: AnalyticsUnit[]): string[] {
  const counts = new Map<string, number>()
  for (const u of units)
    counts.set(u.currency, (counts.get(u.currency) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c)
}

/* ----------------------------------------------------------------- trend */

export type TrendGrain = 'day' | 'week' | 'month'

export interface TrendBucket {
  /** Display label, from the current period. */
  label: string
  span: DateSpan
  /** Shorter than a whole week or month because the period cuts it. */
  partial: boolean
}

/** Days up to a month, weeks up to about a quarter, months beyond. */
export function trendGrain(span: DateSpan): TrendGrain {
  const days = spanDays(span)
  if (days <= 31)
    return 'day'
  if (days <= 120)
    return 'week'
  return 'month'
}

function shortDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function shortMonth(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  // `Oct 2026`, not `Oct 26`, which reads as a day.
  return new Date(y!, m! - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

/** Last day of `iso`'s month. */
function monthEnd(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  const day = new Date(y!, m!, 0).getDate()
  return `${iso.slice(0, 7)}-${String(day).padStart(2, '0')}`
}

/** Splits a span into buckets; the first and last month may be partial. */
export function trendBuckets(span: DateSpan, grain: TrendGrain): TrendBucket[] {
  if (grain === 'day')
    return isoRange(span.start, spanDays(span)).map(d => ({ label: shortDay(d), span: { start: d, end: d }, partial: false }))
  const buckets: TrendBucket[] = []
  let start = span.start
  while (start <= span.end) {
    const naturalEnd = grain === 'week' ? addIsoDays(start, 6) : monthEnd(start)
    const end = naturalEnd < span.end ? naturalEnd : span.end
    const partial = end !== naturalEnd || (grain === 'month' && !start.endsWith('-01'))
    buckets.push({ label: grain === 'week' ? shortDay(start) : shortMonth(start), span: { start, end }, partial })
    start = addIsoDays(end, 1)
  }
  return buckets
}

export interface TrendPoint {
  label: string
  span: DateSpan
  partial: boolean
  current: PeriodPerformance
  /** The comparison period's bucket in the same position, if it has one. */
  previous: PeriodPerformance | null
}

/**
 * The current and comparison periods bucketed the same way, paired by
 * position: bucket 3 of this period beside bucket 3 of the last.
 */
export function trendSeries(
  bookings: AnalyticsBooking[],
  units: AnalyticsUnit[],
  span: DateSpan,
  previous: DateSpan | null,
  currency: string,
  value: BookingValuer = grossValue,
): TrendPoint[] {
  const grain = trendGrain(span)
  const prior = previous ? trendBuckets(previous, grain) : []
  return trendBuckets(span, grain).map((bucket, i) => ({
    label: bucket.label,
    span: bucket.span,
    partial: bucket.partial,
    current: periodPerformance(bookings, units, bucket.span, currency, value),
    previous: prior[i] ? periodPerformance(bookings, units, prior[i]!.span, currency, value) : null,
  }))
}

/* -------------------------------------------------------- distributions */

/** Non-cancelled stays arriving in the span. */
export function arrivalsIn(bookings: AnalyticsBooking[], span: DateSpan): AnalyticsBooking[] {
  return bookings.filter(b => !isCancelled(b) && b.checkIn >= span.start && b.checkIn <= span.end)
}

export interface ChannelShare {
  channel: AnalyticsChannel
  stays: number
  /** Revenue of those stays in the chosen currency. */
  revenue: number
  /** Whole percent of all arriving stays. */
  percent: number
}

export function channelMix(arrivals: AnalyticsBooking[], currency: string, value: BookingValuer = grossValue): ChannelShare[] {
  return ANALYTICS_CHANNELS
    .map((channel) => {
      const rows = arrivals.filter(b => b.channel === channel)
      return {
        channel,
        stays: rows.length,
        // The whole stay, on the chosen basis.
        revenue: rows.filter(b => b.currency === currency).reduce((s, b) => s + value(b, { start: b.checkIn, end: addIsoDays(b.checkOut, -1) }), 0),
        percent: arrivals.length ? Math.round((rows.length / arrivals.length) * 100) : 0,
      }
    })
    .filter(s => s.stays > 0)
    .sort((a, b) => b.stays - a.stays)
}

export const LEAD_TIME_BUCKETS: { label: string, min: number, max: number }[] = [
  { label: '0-3 d', min: 0, max: 3 },
  { label: '4-7 d', min: 4, max: 7 },
  { label: '8-14 d', min: 8, max: 14 },
  { label: '15-30 d', min: 15, max: 30 },
  { label: '31-60 d', min: 31, max: 60 },
  { label: '61-90 d', min: 61, max: 90 },
  { label: '90+ d', min: 91, max: Infinity },
]

export function leadTimeDistribution(arrivals: Pick<AnalyticsBooking, 'leadDays'>[]): { label: string, stays: number }[] {
  return LEAD_TIME_BUCKETS.map(bucket => ({
    label: bucket.label,
    stays: arrivals.filter(b => b.leadDays >= bucket.min && b.leadDays <= bucket.max).length,
  }))
}

const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria',
  AU: 'Australia',
  BE: 'Belgium',
  CH: 'Switzerland',
  CN: 'China',
  DE: 'Germany',
  DK: 'Denmark',
  FR: 'France',
  GB: 'United Kingdom',
  ID: 'Indonesia',
  JP: 'Japan',
  NL: 'Netherlands',
  SG: 'Singapore',
  US: 'United States',
}

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code
}

export interface OriginShare {
  country: string
  name: string
  stays: number
  /** 0..1 of all arriving stays. */
  share: number
}

/** The `limit` biggest markets, the rest folded into "Other". */
export function guestOrigins(arrivals: Pick<AnalyticsBooking, 'country'>[], limit = 6): OriginShare[] {
  const counts = new Map<string, number>()
  for (const b of arrivals)
    counts.set(b.country, (counts.get(b.country) ?? 0) + 1)
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const top = sorted.slice(0, limit).map(([country, stays]) => ({ country, name: countryName(country), stays, share: stays / arrivals.length }))
  const rest = sorted.slice(limit).reduce((s, [, n]) => s + n, 0)
  if (rest)
    top.push({ country: 'other', name: 'Other', stays: rest, share: rest / arrivals.length })
  return top
}

/* ----------------------------------------------------------------- pace */

export interface PacePoint {
  /** `YYYY-MM`. */
  month: string
  label: string
  /** Occupancy on the books today, 0..1. */
  onBooks: number
  /** Occupancy that same month a year earlier had on the books a year ago today, 0..1. */
  lastYear: number
}

/**
 * Booking pace: how full each coming month is today, against how full the
 * same month last year was on this day last year. A booking counts when it
 * was made on or before the cut-off and not cancelled by then.
 */
export function bookingPace(bookings: AnalyticsBooking[], units: AnalyticsUnit[], anchorIso: string, months = 6): PacePoint[] {
  const asOf = (cutoff: string, span: DateSpan) => {
    const live = bookings.filter(b => b.bookedOn <= cutoff && (!b.cancelledOn || b.cancelledOn > cutoff))
    const nights = live.reduce((s, b) => s + nightsIn(b, span), 0)
    const available = availableNightsOf(units, span)
    return available ? nights / available : 0
  }
  const points: PacePoint[] = []
  let start = anchorIso
  for (let i = 0; i < months; i++) {
    const end = monthEnd(start)
    const span = { start, end }
    points.push({
      month: start.slice(0, 7),
      label: shortMonth(start),
      onBooks: asOf(anchorIso, span),
      lastYear: asOf(shiftYear(anchorIso), { start: shiftYear(start), end: shiftYear(end) }),
    })
    start = addIsoDays(end, 1)
  }
  return points
}

/* -------------------------------------------------------------- listings */

export interface ListingPerformanceRow {
  listingId: string
  listingName: string
  lifecycle: UnitLifecycle
  /** Opens `/listings/:id`: false for deleted and demo-only listings, which have no page. */
  linkable: boolean
  location: string
  currency: string
  revenue: number
  occupancy: number
  /** Occupancy change against the comparison period, in points (0..1 scale); null without one. */
  occupancyDelta: number | null
  adr: number
  revpar: number
  stays: number
}

/** One row per unit, each in the currency that listing earns in. */
export function listingPerformance(
  bookings: AnalyticsBooking[],
  units: AnalyticsUnit[],
  span: DateSpan,
  previous: DateSpan | null,
  value: BookingValuer = grossValue,
): ListingPerformanceRow[] {
  const byListing = new Map<string, AnalyticsBooking[]>()
  for (const b of bookings) {
    const list = byListing.get(b.listingId)
    if (list)
      list.push(b)
    else byListing.set(b.listingId, [b])
  }
  return units.map((unit) => {
    const own = byListing.get(unit.listingId) ?? []
    const now = periodPerformance(own, [unit], span, unit.currency, value)
    const before = previous ? periodPerformance(own, [unit], previous, unit.currency, value) : null
    return {
      listingId: unit.listingId,
      listingName: unit.listingName,
      lifecycle: unit.lifecycle,
      linkable: unit.lifecycle !== 'deleted' && !unit.demoOnly,
      location: unit.location,
      currency: unit.currency,
      revenue: now.revenue,
      occupancy: now.occupancy,
      occupancyDelta: before ? now.occupancy - before.occupancy : null,
      adr: now.adr,
      revpar: now.revpar,
      stays: now.stays,
    }
  })
}

/* --------------------------------------------------------------- display */

/** `USD 18.4K` for chart axes; the ISO code always leads. */
export function formatCompactMoney(amount: number, currency: string): string {
  const n = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(amount)
  return `${currency} ${n}`
}

export const channelIcons: Record<AnalyticsChannel, string> = {
  'Airbnb': 'logos:airbnb-icon',
  'Booking.com': 'simple-icons:bookingdotcom',
  'Direct': 'lucide:globe',
}

export const channelColors: Record<AnalyticsChannel, string> = {
  'Airbnb': 'var(--viz-2)',
  'Booking.com': 'var(--viz-1)',
  'Direct': 'var(--viz-3)',
}
