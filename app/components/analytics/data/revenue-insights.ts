/**
 * Revenue tab figures. Every function reads the same scoped bookings and the
 * same `BookingValuer` as the Overview, so a total here always matches the
 * Revenue card there. One currency at a time, never converted.
 */

import type { AnalyticsBooking, AnalyticsChannel, BookingValuer, DateSpan, ListingPerformanceRow } from '~/components/analytics/data/analytics'
import type { CommissionRates, RevenueBreakdown } from '~/components/analytics/data/revenue-basis'
import { ANALYTICS_CHANNELS, isCancelled, nightsIn, trendBuckets, trendGrain } from '~/components/analytics/data/analytics'
import { revenueBreakdown } from '~/components/analytics/data/revenue-basis'
import { addIsoDays } from '~/components/gm/data/gm-dashboard'

/* ------------------------------------------------------ revenue by channel */

export interface ChannelRevenuePoint {
  label: string
  /** Revenue earned on nights in the bucket, per channel. */
  byChannel: Record<AnalyticsChannel, number>
  total: number
}

/** Revenue per bucket, split by channel, on the chosen basis. */
export function channelRevenueSeries(
  bookings: AnalyticsBooking[],
  span: DateSpan,
  currency: string,
  value: BookingValuer,
): ChannelRevenuePoint[] {
  const inCurrency = bookings.filter(b => !isCancelled(b) && b.currency === currency)
  return trendBuckets(span, trendGrain(span)).map((bucket) => {
    const byChannel = Object.fromEntries(ANALYTICS_CHANNELS.map(c => [c, 0])) as Record<AnalyticsChannel, number>
    for (const b of inCurrency) {
      if (nightsIn(b, bucket.span))
        byChannel[b.channel] += value(b, bucket.span)
    }
    return { label: bucket.label, byChannel, total: ANALYTICS_CHANNELS.reduce((s, c) => s + byChannel[c], 0) }
  })
}

/* ------------------------------------------------------ gross to owner net */

export interface BreakdownPoint extends RevenueBreakdown {
  label: string
}

/** Gross down to owner net per bucket; the stack of the four parts adds up to gross. */
export function breakdownSeries(
  bookings: AnalyticsBooking[],
  span: DateSpan,
  currency: string,
  rates: CommissionRates,
): BreakdownPoint[] {
  return trendBuckets(span, trendGrain(span)).map(bucket => ({
    label: bucket.label,
    ...revenueBreakdown(bookings, bucket.span, currency, rates),
  }))
}

/* --------------------------------------------------------- by listing */

/**
 * Listings earning in `currency`, highest revenue first. Listings in another
 * currency are counted, not ranked: amounts in two currencies do not compare.
 */
export function rankListingsByRevenue(rows: ListingPerformanceRow[], currency: string): {
  ranked: ListingPerformanceRow[]
  otherCurrency: number
} {
  const ranked = rows.filter(r => r.currency === currency).sort((a, b) => b.revenue - a.revenue || a.listingName.localeCompare(b.listingName))
  return { ranked, otherCurrency: rows.length - ranked.length }
}

/* --------------------------------------------------------- ADR by weekday */

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export interface WeekdayRate {
  day: typeof WEEKDAYS[number]
  /** Average value per night sold on that weekday, null with none sold. */
  adr: number | null
  nights: number
}

/** Monday = 0. Local-date arithmetic, matching the rest of the module. */
function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(y!, m! - 1, d!).getDay() + 6) % 7
}

/**
 * ADR per night of the week, by the night's own date (a Friday arrival's
 * Saturday night counts as Saturday). Values come from the chosen basis.
 */
export function adrByWeekday(
  bookings: AnalyticsBooking[],
  span: DateSpan,
  currency: string,
  value: BookingValuer,
): WeekdayRate[] {
  const revenue = Array.from({ length: 7 }, () => 0)
  const nights = Array.from({ length: 7 }, () => 0)
  for (const b of bookings) {
    if (isCancelled(b) || b.currency !== currency || !nightsIn(b, span))
      continue
    let night = b.checkIn > span.start ? b.checkIn : span.start
    const stop = b.checkOut <= addIsoDays(span.end, 1) ? b.checkOut : addIsoDays(span.end, 1)
    while (night < stop) {
      const i = weekdayIndex(night)
      revenue[i]! += value(b, { start: night, end: night })
      nights[i]! += 1
      night = addIsoDays(night, 1)
    }
  }
  return WEEKDAYS.map((day, i) => ({ day, adr: nights[i] ? revenue[i]! / nights[i]! : null, nights: nights[i]! }))
}
