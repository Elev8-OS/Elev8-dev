/**
 * Reservations tab figures. Counts read reservations by the date that matters
 * for the question: bookings and cancellations by the day they were made,
 * arrivals and departures by the day they happen, values and stay lengths by
 * arrival. Cancelled stays are left out of everything except cancellations.
 */

import type { AnalyticsBooking, BookingValuer, DateSpan } from '~/components/analytics/data/analytics'
import { isCancelled, trendBuckets, trendGrain } from '~/components/analytics/data/analytics'
import { addIsoDays } from '~/components/gm/data/gm-dashboard'

const inSpan = (iso: string | undefined, span: DateSpan) => !!iso && iso >= span.start && iso <= span.end

/* ------------------------------------------------------------- pickup */

export interface PickupPoint {
  label: string
  /** Bookings made in the bucket, whatever happened to them later. */
  booked: number
  /** Bookings cancelled in the bucket, whenever they were made. */
  cancelled: number
}

export function pickupSeries(bookings: AnalyticsBooking[], span: DateSpan): PickupPoint[] {
  return trendBuckets(span, trendGrain(span)).map(bucket => ({
    label: bucket.label,
    booked: bookings.filter(b => inSpan(b.bookedOn, bucket.span)).length,
    cancelled: bookings.filter(b => inSpan(b.cancelledOn, bucket.span)).length,
  }))
}

/* ---------------------------------------------------------- movements */

export interface MovementPoint {
  label: string
  arrivals: number
  departures: number
}

export function movementSeries(bookings: AnalyticsBooking[], span: DateSpan): MovementPoint[] {
  const live = bookings.filter(b => !isCancelled(b))
  return trendBuckets(span, trendGrain(span)).map(bucket => ({
    label: bucket.label,
    arrivals: live.filter(b => inSpan(b.checkIn, bucket.span)).length,
    departures: live.filter(b => inSpan(b.checkOut, bucket.span)).length,
  }))
}

/* -------------------------------------------------------------- party */

/**
 * Adults and children in a party. Generated stays carry a head count only, so
 * the split is derived from the booking id (no extra random draws, which
 * would reshuffle every generated stay): about a third of parties of three
 * or more bring one or two children, never leaving fewer than two adults.
 */
export function partyMix(b: Pick<AnalyticsBooking, 'id' | 'guests'>): { adults: number, children: number } {
  if (b.guests < 3)
    return { adults: b.guests, children: 0 }
  let h = 0
  for (let i = 0; i < b.id.length; i++)
    h = (h * 31 + b.id.charCodeAt(i)) >>> 0
  if (h % 3 !== 0)
    return { adults: b.guests, children: 0 }
  const children = Math.min(b.guests - 2, 1 + (h % 2))
  return { adults: b.guests - children, children }
}

export const PARTY_BUCKETS = [
  { label: '1 guest', min: 1, max: 1 },
  { label: '2 guests', min: 2, max: 2 },
  { label: '3 guests', min: 3, max: 3 },
  { label: '4 guests', min: 4, max: 4 },
  { label: '5 guests', min: 5, max: 5 },
  { label: '6+ guests', min: 6, max: Infinity },
]

export interface PartySummary {
  buckets: { label: string, stays: number }[]
  /** Mean guests per stay, null without stays. */
  avgGuests: number | null
  /** Share of stays with at least one child, 0..1. */
  withChildren: number
  adults: number
  children: number
}

export function partySummary(arrivals: AnalyticsBooking[]): PartySummary {
  let adults = 0
  let children = 0
  let withChildren = 0
  for (const b of arrivals) {
    const mix = partyMix(b)
    adults += mix.adults
    children += mix.children
    if (mix.children)
      withChildren += 1
  }
  return {
    buckets: PARTY_BUCKETS.map(p => ({ label: p.label, stays: arrivals.filter(b => b.guests >= p.min && b.guests <= p.max).length })),
    avgGuests: arrivals.length ? (adults + children) / arrivals.length : null,
    withChildren: arrivals.length ? withChildren / arrivals.length : 0,
    adults,
    children,
  }
}

/* ------------------------------------------- value and length per stay */

/** The whole stay on the chosen basis. */
export function stayTotal(b: AnalyticsBooking, value: BookingValuer): number {
  return value(b, { start: b.checkIn, end: addIsoDays(b.checkOut, -1) })
}

export interface StayAverages {
  /** Mean value per arriving stay in `currency`, null without one. */
  avgReservationValue: number | null
  /** Mean nights per arriving stay (every currency), null without one. */
  avgLengthOfStay: number | null
}

/** Averages over confirmed stays arriving in `span`. */
export function stayAverages(bookings: AnalyticsBooking[], span: DateSpan, currency: string, value: BookingValuer): StayAverages {
  const arriving = bookings.filter(b => !isCancelled(b) && inSpan(b.checkIn, span))
  const priced = arriving.filter(b => b.currency === currency)
  return {
    avgReservationValue: priced.length ? priced.reduce((s, b) => s + stayTotal(b, value), 0) / priced.length : null,
    avgLengthOfStay: arriving.length ? arriving.reduce((s, b) => s + b.nights, 0) / arriving.length : null,
  }
}

export interface StayAveragePoint {
  label: string
  current: StayAverages
  previous: StayAverages | null
}

/** Per bucket, paired with the comparison bucket in the same position (as the Overview trend is). */
export function stayAverageSeries(
  bookings: AnalyticsBooking[],
  span: DateSpan,
  previous: DateSpan | null,
  currency: string,
  value: BookingValuer,
): StayAveragePoint[] {
  const grain = trendGrain(span)
  const prior = previous ? trendBuckets(previous, grain) : []
  return trendBuckets(span, grain).map((bucket, i) => ({
    label: bucket.label,
    current: stayAverages(bookings, bucket.span, currency, value),
    previous: prior[i] ? stayAverages(bookings, prior[i]!.span, currency, value) : null,
  }))
}
