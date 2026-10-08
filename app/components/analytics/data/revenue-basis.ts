/**
 * Revenue basis: what a sold night is worth on the Analytics page.
 *
 * - gross:     the room price the guest paid, taxes excluded (they are
 *              collected for the authorities, not earned)
 * - net:       gross minus the OTA commission and payment processing fees
 * - owner_net: net minus the management commission in the owner's contract,
 *              worked out with the same `calculateCommission` the owner
 *              statements use, so a rate means the same thing on both pages
 *
 * Operating expenses are not deducted on any basis: they are not tied to a
 * night, so they cannot be spread over a trend line honestly. The owner
 * statement remains the place for profit after expenses.
 */

import type { AnalyticsBooking, AnalyticsChannel, BookingValuer, DateSpan } from '~/components/analytics/data/analytics'
import type { CommissionRule } from '~/components/owners/data/commission-rules'
import type { OwnerPropertyMapping } from '~/components/owners/data/owners'
import { grossValue, isCancelled, nightsIn } from '~/components/analytics/data/analytics'
import { addIsoDays, isoDiffDays } from '~/components/gm/data/gm-dashboard'
import { calculateCommission, findEffectiveCommissionRule } from '~/components/owners/data/commission-rules'

export type RevenueBasis = 'gross' | 'net' | 'owner_net'

export const REVENUE_BASES: { value: RevenueBasis, label: string, title: string, hint: string }[] = [
  { value: 'gross', label: 'Gross', title: 'gross', hint: 'Room price the guest paid, before any fees. Taxes excluded.' },
  { value: 'net', label: 'Net', title: 'net', hint: 'After OTA commission and payment fees.' },
  { value: 'owner_net', label: 'Owner net', title: 'owner net', hint: 'Net, minus the management commission in each owner contract.' },
]

/**
 * Fees per channel as a share of gross. Demo rates: a live version reads the
 * payout each reservation actually carries. Airbnb is on host-only fees, as
 * property managers usually are; direct bookings pay card processing.
 */
export const CHANNEL_FEES: Record<AnalyticsChannel, { ota: number, payment: number }> = {
  'Airbnb': { ota: 0.15, payment: 0 },
  'Booking.com': { ota: 0.15, payment: 0 },
  'Direct': { ota: 0, payment: 0.029 },
}

/** Share of gross left after the channel's fees. */
export function netFactor(channel: AnalyticsChannel): number {
  const fees = CHANNEL_FEES[channel]
  return 1 - fees.ota - fees.payment
}

/** `YYYY-MM-DD` of the last day of `month` (`YYYY-MM`). */
function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(y!, m!, 0).getDate()).padStart(2, '0')}`
}

/** The calendar-month pieces of `span`, each clipped to it. */
function monthSegments(span: DateSpan): { month: string, span: DateSpan }[] {
  const out: { month: string, span: DateSpan }[] = []
  let start = span.start
  while (start <= span.end) {
    const month = start.slice(0, 7)
    const last = monthEnd(month)
    const end = last < span.end ? last : span.end
    out.push({ month, span: { start, end } })
    start = addIsoDays(end, 1)
  }
  return out
}

/* ------------------------------------------------------ owner commission */

/**
 * Management commission per listing and month, as a share of that month's
 * gross. Commission rules are monthly (tiered bands, a hybrid's fixed fee),
 * so the commission is computed on the whole listing-month, then carried by
 * each night in proportion to its gross. Every night therefore keeps its
 * share when a channel or market filter picks out some of the bookings.
 *
 * Co-owners: each owner's rule applies to their ownership share; a share no
 * owner holds pays no commission. A month with no revenue carries no
 * commission, so a hybrid's fixed fee is not charged on an empty month here.
 */
export type CommissionRates = Map<string, number>

const rateKey = (listingId: string, month: string) => `${listingId}|${month}`

export function buildCommissionRates(
  bookings: AnalyticsBooking[],
  mappings: OwnerPropertyMapping[],
  rules: CommissionRule[],
): CommissionRates {
  const contracted = new Set(mappings.map(m => m.listingId))
  const totals = new Map<string, { gross: number, fees: number }>()
  for (const b of bookings) {
    if (isCancelled(b) || !contracted.has(b.listingId))
      continue
    const span = { start: b.checkIn, end: addIsoDays(b.checkOut, -1) }
    if (isoDiffDays(span.start, span.end) < 0)
      continue
    for (const seg of monthSegments(span)) {
      const gross = nightsIn(b, seg.span) * b.nightlyRate
      const key = rateKey(b.listingId, seg.month)
      const t = totals.get(key) ?? { gross: 0, fees: 0 }
      t.gross += gross
      t.fees += gross * (1 - netFactor(b.channel))
      totals.set(key, t)
    }
  }

  const rates: CommissionRates = new Map()
  for (const [key, t] of totals) {
    if (t.gross <= 0)
      continue
    const [listingId, month] = key.split('|') as [string, string]
    const end = monthEnd(month)
    let commission = 0
    for (const m of mappings) {
      if (m.listingId !== listingId || m.effectiveFrom > end || (m.effectiveTo && m.effectiveTo < end))
        continue
      const rule = findEffectiveCommissionRule(rules, m.ownerId, listingId, month)
        ?? rules.find(r => r.id === m.commissionRuleId)
      if (!rule)
        continue
      const share = m.ownershipPercentage / 100
      // Platform fees are itemised so a net-basis rule deducts exactly them;
      // analytics has no operating expenses or taxes to deduct.
      commission += calculateCommission(rule, t.gross * share, {
        platformFees: t.fees * share,
        operatingExpenses: 0,
        taxes: 0,
      })
    }
    rates.set(key, Math.min(1, commission / t.gross))
  }
  return rates
}

/* ---------------------------------------------------------------- values */

export function makeValuer(basis: RevenueBasis, rates: CommissionRates = new Map()): BookingValuer {
  if (basis === 'gross')
    return grossValue
  if (basis === 'net')
    return (b, span) => grossValue(b, span) * netFactor(b.channel)
  return (b, span) => {
    // Only the months the stay touches inside the span, never the whole span.
    const from = b.checkIn > span.start ? b.checkIn : span.start
    const lastNight = addIsoDays(b.checkOut, -1)
    const to = lastNight < span.end ? lastNight : span.end
    if (from > to)
      return 0
    let total = 0
    for (const seg of monthSegments({ start: from, end: to })) {
      const gross = nightsIn(b, seg.span) * b.nightlyRate
      total += gross * (netFactor(b.channel) - (rates.get(rateKey(b.listingId, seg.month)) ?? 0))
    }
    return total
  }
}

/* ------------------------------------------------------------- breakdown */

export interface RevenueBreakdown {
  gross: number
  otaCommission: number
  paymentFees: number
  net: number
  managementCommission: number
  ownerNet: number
}

/** Gross down to owner net for the nights inside `span`, in one currency. */
export function revenueBreakdown(
  bookings: AnalyticsBooking[],
  span: DateSpan,
  currency: string,
  rates: CommissionRates,
): RevenueBreakdown {
  const ownerNet = makeValuer('owner_net', rates)
  const out: RevenueBreakdown = { gross: 0, otaCommission: 0, paymentFees: 0, net: 0, managementCommission: 0, ownerNet: 0 }
  for (const b of bookings) {
    if (isCancelled(b) || b.currency !== currency)
      continue
    const gross = grossValue(b, span)
    if (!gross)
      continue
    const fees = CHANNEL_FEES[b.channel]
    const owner = ownerNet(b, span)
    out.gross += gross
    out.otaCommission += gross * fees.ota
    out.paymentFees += gross * fees.payment
    out.net += gross * netFactor(b.channel)
    out.ownerNet += owner
    out.managementCommission += gross * netFactor(b.channel) - owner
  }
  return out
}
