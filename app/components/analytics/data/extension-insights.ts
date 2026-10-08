/**
 * Stay extensions on the Reservations tab. A stay counts by its ARRIVAL in the
 * period (as stays and length of stay do); money counts the added nights that
 * fall INSIDE the period (as revenue does). Two shapes, as in the real flow:
 * a direct stay grows in place (`extendedNights`), an OTA stay keeps its dates
 * and the added nights sit on a linked direct booking (`extensionOf`).
 */

import type { AnalyticsBooking, BookingValuer, DateSpan } from '~/components/analytics/data/analytics'
import { grossValue, isCancelled, trendBuckets, trendGrain } from '~/components/analytics/data/analytics'
import { CHANNEL_FEES } from '~/components/analytics/data/revenue-basis'
import { addIsoDays } from '~/components/gm/data/gm-dashboard'

const inSpan = (iso: string, span: DateSpan) => iso >= span.start && iso <= span.end

/** The part of `span` that covers the added nights of a stay, or null. */
function addedNightsSpan(b: AnalyticsBooking, span: DateSpan): DateSpan | null {
  if (!b.extendedNights)
    return null
  const start = addIsoDays(b.checkOut, -b.extendedNights)
  const end = addIsoDays(b.checkOut, -1)
  const clipped = { start: start > span.start ? start : span.start, end: end < span.end ? end : span.end }
  return clipped.start <= clipped.end ? clipped : null
}

/** Fees the host did not pay because OTA nights were rebooked direct: the OTA's cut minus card fees. */
function feesSavedRate(otaChannel: AnalyticsBooking['channel']): number {
  const ota = CHANNEL_FEES[otaChannel]
  const direct = CHANNEL_FEES.Direct
  return Math.max(0, ota.ota + ota.payment - direct.ota - direct.payment)
}

export interface ExtensionSummary {
  /** Confirmed stays arriving in the period (linked extension bookings are not stays of their own). */
  stays: number
  /** Of those, how many were extended. */
  extended: number
  /** `extended / stays`, null without stays. */
  rate: number | null
  /** Nights added to those stays. */
  extraNights: number
  avgExtraNights: number | null
  /** Of `extended`, OTA stays carried on through a linked direct booking. */
  viaDirect: number
  /** Added nights inside the period, in `currency`, on the revenue basis. */
  revenue: number
  /** Added nights from direct stays, the rest of `revenue` came from OTA stays rebooked direct. */
  revenueInPlace: number
  revenueViaDirect: number
  /** Fees not paid on OTA nights rebooked direct, in `currency`, gross. */
  feesSaved: number
}

export function extensionSummary(bookings: AnalyticsBooking[], span: DateSpan, currency: string, value: BookingValuer = grossValue): ExtensionSummary {
  const live = bookings.filter(b => !isCancelled(b))
  const linkedByParent = new Map<string, AnalyticsBooking>()
  for (const b of live) {
    if (b.extensionOf)
      linkedByParent.set(b.extensionOf, b)
  }

  const arriving = live.filter(b => !b.extensionOf && inSpan(b.checkIn, span))
  let extended = 0
  let extraNights = 0
  let viaDirect = 0
  for (const b of arriving) {
    const linked = linkedByParent.get(b.id)
    const added = b.extendedNights ?? linked?.nights ?? 0
    if (!added)
      continue
    extended += 1
    extraNights += added
    if (linked)
      viaDirect += 1
  }

  let revenueInPlace = 0
  let revenueViaDirect = 0
  let feesSaved = 0
  const parents = new Map(live.map(b => [b.id, b]))
  for (const b of live) {
    if (b.currency !== currency)
      continue
    const own = addedNightsSpan(b, span)
    if (own)
      revenueInPlace += value(b, own)
    if (b.extensionOf) {
      revenueViaDirect += value(b, span)
      const parent = parents.get(b.extensionOf)
      if (parent)
        feesSaved += grossValue(b, span) * feesSavedRate(parent.channel)
    }
  }

  return {
    stays: arriving.length,
    extended,
    rate: arriving.length ? extended / arriving.length : null,
    extraNights,
    avgExtraNights: extended ? extraNights / extended : null,
    viaDirect,
    revenue: revenueInPlace + revenueViaDirect,
    revenueInPlace,
    revenueViaDirect,
    feesSaved,
  }
}

export interface ExtensionRevenuePoint {
  label: string
  inPlace: number
  viaDirect: number
}

/** Added-night revenue per trend bucket, split by how the stay was extended. */
export function extensionRevenueSeries(bookings: AnalyticsBooking[], span: DateSpan, currency: string, value: BookingValuer = grossValue): ExtensionRevenuePoint[] {
  return trendBuckets(span, trendGrain(span)).map((bucket) => {
    const s = extensionSummary(bookings, bucket.span, currency, value)
    return { label: bucket.label, inPlace: Math.round(s.revenueInPlace), viaDirect: Math.round(s.revenueViaDirect) }
  })
}
