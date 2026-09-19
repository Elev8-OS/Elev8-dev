// Deriving owner ledger rows from real reservations.
//
// `mockOwnerLedgerEntries` is a hand-written fixture covering the three seeded
// owners. Anyone created through the UI has no rows in it, so statement
// generation found nothing to draw and silently produced nothing — the owner
// existed, was mapped to a property, and still never received a statement.
//
// This module fills that gap by rolling the app's own reservations up into the
// same shape. Seeded rows always win: the demo figures the rest of the portal
// is built around must not shift underneath it.
//
// Framework-free, like the rest of `owners/data`. Reservations arrive as a
// structural `LedgerSourceReservation` rather than the full `ReservationEntry`,
// so the rules stay testable without the reservations store (same approach as
// `resolveLockTargets` and the GM dashboard's `AttentionConversation`).

import type { OwnerLedgerEntry, OwnerLedgerSource, OwnerLedgerSourceBreakdown, OwnerLedgerUpcomingReservation } from './owner-ledger'
import type { OwnerPropertyMapping } from './owners'

/** The reservation fields a ledger roll-up actually reads. */
export interface LedgerSourceReservation {
  id: string
  listingId: string
  /** ISO `YYYY-MM-DD`, check-in night, inclusive. */
  checkIn: string
  /** ISO `YYYY-MM-DD`, check-out day, exclusive. */
  checkOut: string
  nights: number
  currency: string
  /** `'Airbnb' | 'Booking.com' | 'Direct'` in this app. */
  channel: string
  status: string
  totalPrice: number
  guestName?: string
  /** Set on owner stays and calendar blocks. Its presence means "not a guest booking". */
  blockReason?: string
  priceDetails?: {
    subtotal: number
    cleaningFee: number
    serviceFee: number
    tax: number
    extras: number
    guestPaid: number
    commission: number
    payout: number
  }
}

/**
 * Statuses that represent money actually earned from a guest.
 *
 * `cancelled` and `blocked` earned nothing, `owner_request` is the owner
 * staying in their own property, and an `inquiry` has not been booked. Mirrors
 * `GUEST_STAY_STATUSES` in the damage-protection module, for the same reason:
 * counting an owner block as revenue would pay them for their own holiday.
 */
export const LEDGER_REVENUE_STATUSES: readonly string[] = [
  'unverified',
  'verified',
  'checked_in',
  'checked_out',
]

/** `BookingChannel` (`'Airbnb'`) to the ledger's own vocabulary (`'airbnb'`). */
const CHANNEL_TO_SOURCE: Record<string, OwnerLedgerSource> = {
  'airbnb': 'airbnb',
  'booking.com': 'booking_com',
  'booking_com': 'booking_com',
  'direct': 'direct',
  'agoda': 'agoda',
  'vrbo': 'vrbo',
  'expedia': 'expedia',
}

export function channelToLedgerSource(channel: string): OwnerLedgerSource {
  return CHANNEL_TO_SOURCE[channel.trim().toLowerCase()] ?? 'direct'
}

/** `2026-07-14` -> `2026-07`. */
export function periodOf(isoDate: string): string {
  return isoDate.slice(0, 7)
}

/** Nights in a `YYYY-MM` period, the denominator for occupancy. */
export function nightsInPeriod(period: string): number {
  const [year, month] = period.split('-').map(Number)
  if (!year || !month)
    return 0
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Which period a stay's revenue belongs to.
 *
 * Dated by CHECK-OUT, when the service is complete, matching how the DATEV
 * export scopes a booking. A stay running 28 Jun to 3 Jul is July revenue in
 * both places, so a tenant's owner statement and their tax file cannot
 * disagree about which month a booking landed in.
 */
export function revenuePeriodOf(reservation: LedgerSourceReservation): string {
  return periodOf(reservation.checkOut)
}

/**
 * Did this stay earn the owner money?
 *
 * ⚠️ The status alone is not enough. An owner stay is seeded as a normal
 * `unverified` reservation carrying `blockReason: 'Owner stay'` and
 * `totalPrice: 0`, so a status-only filter lets it through and bills the owner
 * for their own holiday — the exact thing excluding `owner_request` was meant
 * to prevent. Any `blockReason` at all means this is a block, not a booking.
 */
export function isLedgerRevenue(reservation: LedgerSourceReservation): boolean {
  if (reservation.blockReason !== undefined && reservation.blockReason.trim() !== '')
    return false
  return LEDGER_REVENUE_STATUSES.includes(reservation.status)
}

interface ReservationMoney {
  gross: number
  tax: number
  platformFee: number
}

/**
 * Split one reservation into the ledger's money columns.
 *
 * `grossRevenue` is everything the guest paid, because a statement subtracts
 * tax and commission from it further down; netting them here would deduct them
 * twice. Without a `priceDetails` block only `totalPrice` is known, and the
 * split is reported as zero rather than guessed at a plausible-looking rate.
 */
export function reservationMoney(reservation: LedgerSourceReservation): ReservationMoney {
  const details = reservation.priceDetails
  if (!details)
    return { gross: reservation.totalPrice, tax: 0, platformFee: 0 }
  return {
    gross: details.guestPaid,
    tax: details.tax,
    platformFee: details.commission,
  }
}

export interface DeriveLedgerInput {
  ownerId: string
  mapping: Pick<OwnerPropertyMapping, 'listingId'>
  period: string
  reservations: LedgerSourceReservation[]
  /** Stamped on the derived row; injected so callers can keep one timestamp per pass. */
  now: string
}

export interface DeriveLedgerResult {
  entry: OwnerLedgerEntry | null
  /** Currencies present in the period that this row does NOT cover. */
  skippedCurrencies: string[]
}

/**
 * Roll one (owner, listing, period) up from reservations.
 *
 * Figures are the LISTING's full total, not the owner's share. That is the
 * convention the seed already uses: both co-owners of lst-3 carry the same
 * 110,000,000, and `useOwnerDashboard` applies `ownershipPercentage` on top.
 * Pre-scaling here would be halved a second time downstream.
 */
export function deriveLedgerEntry(input: DeriveLedgerInput): DeriveLedgerResult {
  const { ownerId, mapping, period, reservations, now } = input

  const inPeriod = reservations.filter(
    r => r.listingId === mapping.listingId
      && isLedgerRevenue(r)
      && revenuePeriodOf(r) === period,
  )
  if (inPeriod.length === 0)
    return { entry: null, skippedCurrencies: [] }

  // One row carries one currency. A listing should only ever bill in one, but
  // if it does not, the majority is reported and the rest are named rather
  // than added in — there is no FX rate in this app, so a blended figure would
  // be money in no currency at all.
  const byCurrency = new Map<string, LedgerSourceReservation[]>()
  for (const r of inPeriod) {
    const bucket = byCurrency.get(r.currency) ?? []
    bucket.push(r)
    byCurrency.set(r.currency, bucket)
  }
  const ranked = Array.from(byCurrency.entries())
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  const [currency, rows] = ranked[0]!
  const skippedCurrencies = ranked.slice(1).map(([code]) => code)

  let grossRevenue = 0
  let taxes = 0
  let platformFees = 0
  let occupiedNights = 0
  const sourceMap = new Map<OwnerLedgerSource, OwnerLedgerSourceBreakdown>()

  for (const r of rows) {
    const money = reservationMoney(r)
    grossRevenue += money.gross
    taxes += money.tax
    platformFees += money.platformFee
    occupiedNights += r.nights

    const source = channelToLedgerSource(r.channel)
    const existing = sourceMap.get(source)
    if (existing) {
      existing.revenue += money.gross
      existing.reservations += 1
      existing.nights += r.nights
    }
    else {
      sourceMap.set(source, { source, revenue: money.gross, reservations: 1, nights: r.nights })
    }
  }

  const availableNights = nightsInPeriod(period)

  return {
    entry: {
      id: `led-derived-${ownerId}-${mapping.listingId}-${period}`,
      ownerId,
      listingId: mapping.listingId,
      period,
      currency,
      grossRevenue,
      // No per-reservation operating cost exists anywhere in the app, so this
      // is reported as zero rather than estimated. A statement that invents a
      // cleaning cost understates a payout by a number nobody can source.
      expenses: 0,
      taxes,
      platformFees,
      sources: Array.from(sourceMap.values()),
      // A stay spanning a month boundary is billed in its check-out month, so
      // its nights can exceed that month's length. Occupancy is capped to keep
      // the ratio a percentage.
      occupiedNights: Math.min(occupiedNights, availableNights),
      availableNights,
      // The seed keeps `nightlyRateSum` equal to `grossRevenue`, which makes
      // the dashboard's ADR the average booking value. Mirrored so derived
      // rows read the same way as seeded ones.
      nightlyRateSum: grossRevenue,
      reservationCount: rows.length,
      // Reservations carry no rating, and inventing one would put a score on a
      // property nobody reviewed.
      averageRating: 0,
      ratingsCount: 0,
      upcomingReservations: upcomingAfter(period, reservations, mapping.listingId, currency),
      isPriorPeriodAdjustment: false,
      createdAt: now,
      updatedAt: now,
    },
    skippedCurrencies,
  }
}

/** Qualifying stays that check out after the period being reported. */
function upcomingAfter(
  period: string,
  reservations: LedgerSourceReservation[],
  listingId: string,
  currency: string,
): OwnerLedgerUpcomingReservation[] {
  return reservations
    .filter(r => r.listingId === listingId
      && r.currency === currency
      && isLedgerRevenue(r)
      && revenuePeriodOf(r) > period)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .map(r => ({
      id: r.id,
      guestName: r.guestName ?? 'Guest',
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nights,
      source: channelToLedgerSource(r.channel),
      totalAmount: reservationMoney(r).gross,
    }))
}

/** Every `YYYY-MM` with qualifying revenue for a listing, oldest first. */
export function revenuePeriodsForListing(
  reservations: LedgerSourceReservation[],
  listingId: string,
): string[] {
  const periods = new Set<string>()
  for (const r of reservations) {
    if (r.listingId === listingId && isLedgerRevenue(r))
      periods.add(revenuePeriodOf(r))
  }
  return Array.from(periods).sort()
}

export interface DeriveMissingInput {
  mappings: OwnerPropertyMapping[]
  reservations: LedgerSourceReservation[]
  /** Already-seeded rows. A match on (owner, listing, period) is never replaced. */
  seeded: OwnerLedgerEntry[]
  now: string
}

/**
 * Every ledger row the reservations imply that the fixture does not already
 * provide.
 *
 * Seeded rows win on purpose. The portal's demo numbers, and the tests pinned
 * to them, are built on the fixture; recomputing those periods from
 * reservations would move figures the rest of the app treats as stable.
 */
export function deriveMissingLedgerEntries(input: DeriveMissingInput): OwnerLedgerEntry[] {
  const { mappings, reservations, seeded, now } = input
  const seededKeys = new Set(seeded.map(e => `${e.ownerId}::${e.listingId}::${e.period}`))
  const derived: OwnerLedgerEntry[] = []

  for (const mapping of mappings) {
    for (const period of revenuePeriodsForListing(reservations, mapping.listingId)) {
      const key = `${mapping.ownerId}::${mapping.listingId}::${period}`
      if (seededKeys.has(key))
        continue
      // A mapping that had not started yet cannot earn: a statement for a
      // period before the owner took the property on would pay them for
      // someone else's revenue.
      if (mapping.effectiveFrom.slice(0, 7) > period)
        continue
      if (mapping.effectiveTo !== undefined && mapping.effectiveTo.slice(0, 7) < period)
        continue

      const { entry } = deriveLedgerEntry({
        ownerId: mapping.ownerId,
        mapping,
        period,
        reservations,
        now,
      })
      if (entry) {
        derived.push(entry)
        seededKeys.add(key)
      }
    }
  }

  return derived
}
