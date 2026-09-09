/**
 * General Manager dashboard — portfolio data.
 *
 * Framework-free on purpose: the composable owns the reactive state and calls
 * in here, the same split used by `datev.ts` and `promo-code-form.ts`.
 *
 * The dashboard is a portfolio view of *tonight*, so it needs a dense window
 * of stays around the current date. The seeded mock reservations in
 * `reservations/data/reservations.ts` are dated Jul-Sep 2026 and cover only a
 * handful of listings, which leaves an occupancy chart with nothing to draw.
 * So the stays here are generated deterministically from the real listings
 * (real ids, names, locations and nightly rates) and anchored to the day the
 * dashboard is opened. Same seed in, same portfolio out — reloading never
 * reshuffles the numbers.
 */

import type { ReservationStatus } from '~/components/reservations/data/reservations'

export type GmChannel = 'Airbnb' | 'Booking.com' | 'Direct'

/**
 * The subset of `ReservationStatus` a generated portfolio can be in. Deliberately
 * the app's own status union rather than a parallel one, so the table can hand a
 * stay straight to `ReservationStatusBadge` and the colours, labels and wording
 * match the reservations page instead of drifting from it.
 */
export type GmStayStatus = Extract<
  ReservationStatus,
  'unverified' | 'verified' | 'checked_in' | 'checked_out'
>

export type GmRegion = 'all' | 'Bali' | 'Germany'

export interface GmUnit {
  id: string
  listingId: string
  listingName: string
  location: string
  region: Exclude<GmRegion, 'all'>
  nightlyRate: number
  capacity: number
}

export interface GmStay {
  id: string
  listingId: string
  listingName: string
  location: string
  region: Exclude<GmRegion, 'all'>
  guestName: string
  initials: string
  channel: GmChannel
  /** ISO date, YYYY-MM-DD. */
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  nightlyRate: number
  total: number
  status: GmStayStatus
  /** Local arrival estimate, "HH:MM". Arrivals only. */
  eta?: string
  balanceDue: number
}

/** One column of the bidirectional occupancy chart. */
export interface GmDayFlow {
  date: string
  arrivals: number
  departures: number
  occupied: number
  /** 0..1 */
  occupancy: number
}

export interface GmRevenuePoint {
  date: string
  revenue: number
}

export interface GmPeriodMetrics {
  revenue: number
  occupiedNights: number
  availableNights: number
  /** 0..1 */
  occupancy: number
  adr: number
  revpar: number
}

export interface GmKpiSet {
  unitCount: number
  occupancyTonight: number
  /** Percentage points against the same night a week ago. */
  occupancyDelta: number
  adr: number
  /** Relative change against the previous 30 days. */
  adrDelta: number
  revpar: number
  revparDelta: number
  revenue30d: number
  revenue30dDelta: number
  arrivalsToday: number
  departuresToday: number
  inHouseUnits: number
  inHouseGuests: number
  unassignedArrivals: number
}

export interface GmDayBookings {
  arrivals: GmStay[]
  departures: GmStay[]
  stayovers: GmStay[]
}

/* ------------------------------------------------------------------ dates */

/** `Date` -> `YYYY-MM-DD`, read in the viewer's own timezone. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1))
}

/** Calendar arithmetic in UTC, so a DST boundary cannot drop or repeat a day. */
export function addIsoDays(iso: string, days: number): string {
  const dt = parseIso(iso)
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function isoDiffDays(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000)
}

export function isoRange(startIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addIsoDays(startIso, i))
}

export function isWeekend(iso: string): boolean {
  const day = parseIso(iso).getUTCDay()
  return day === 0 || day === 6
}

/** `2026-09-08` -> `Sep 8`. */
export function formatDayShort(iso: string): string {
  return parseIso(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** `2026-09-08` -> `Tue`. */
export function formatWeekday(iso: string): string {
  return parseIso(iso).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
}

/** `2026-09-08` -> `8`. */
export function formatDayNumber(iso: string): string {
  return String(parseIso(iso).getUTCDate())
}

/** `2026-09-08` -> `Tuesday, 8 September 2026`. */
export function formatDayLong(iso: string): string {
  return parseIso(iso).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/* ----------------------------------------------------------------- stays */

/** Deterministic PRNG, so the portfolio is stable across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!
}

const GUEST_NAMES = [
  'Anna Schmidt',
  'Yuki Tanaka',
  'Marco Rossi',
  'Sophie Dubois',
  'Liam O\'Connor',
  'Emma Thompson',
  'Lars Nielsen',
  'Priya Sharma',
  'Mateo Fernández',
  'Nina Kowalski',
  'Daniel Weber',
  'Chloe Martin',
  'Hiroshi Sato',
  'Isabella Costa',
  'Tom Bakker',
  'Freya Lindqvist',
  'Omar Haddad',
  'Grace Kim',
  'Lucas Moreau',
  'Maja Novak',
  'Ethan Walker',
  'Clara Fischer',
  'Rin Watanabe',
  'Diego Alvarez',
  'Elena Petrova',
  'Jonas Krüger',
  'Amelia Clarke',
  'Sven Johansson',
  'Leila Rahimi',
  'Noah Dupont',
] as const

const CHANNEL_WEIGHTS: { channel: GmChannel, weight: number }[] = [
  { channel: 'Airbnb', weight: 0.45 },
  { channel: 'Booking.com', weight: 0.34 },
  { channel: 'Direct', weight: 0.21 },
]

function pickChannel(rand: () => number): GmChannel {
  const roll = rand()
  let cumulative = 0
  for (const entry of CHANNEL_WEIGHTS) {
    cumulative += entry.weight
    if (roll < cumulative)
      return entry.channel
  }
  return 'Direct'
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function regionOf(location: string): Exclude<GmRegion, 'all'> {
  return location.includes('Germany') ? 'Germany' : 'Bali'
}

interface ListingLike {
  id: string
  name: string
  location: string
  capacity: number
  status?: 'active' | 'inactive'
  pricing: { nightlyRate: number }
}

/**
 * One sellable unit per listing. Multi-unit listings do carry their own
 * `unitTypes[].units[]`, but the portfolio view counts properties, which is
 * the denominator a GM quotes occupancy against.
 */
export function toGmUnits(listings: ListingLike[]): GmUnit[] {
  return listings
    .filter(listing => listing.status !== 'inactive')
    .map(listing => ({
      id: listing.id,
      listingId: listing.id,
      listingName: listing.name,
      location: listing.location,
      region: regionOf(listing.location),
      nightlyRate: listing.pricing.nightlyRate,
      capacity: listing.capacity,
    }))
}

export interface BuildStaysOptions {
  pastDays?: number
  futureDays?: number
  seed?: number
}

/**
 * `buildKpis` compares the last 30 days against the 30 before them, so the
 * portfolio has to reach 60 days back. Generating less makes the prior period
 * partly empty, which inflates every trend badge — a portfolio built with 45
 * days of history reported RevPAR up 119%.
 */
export const KPI_LOOKBACK_DAYS = 60

export function buildGmStays(
  units: GmUnit[],
  anchorIso: string,
  options: BuildStaysOptions = {},
): GmStay[] {
  const {
    pastDays = KPI_LOOKBACK_DAYS + 10,
    futureDays = 45,
    seed = 80_211,
  } = options
  const windowStart = addIsoDays(anchorIso, -pastDays)
  const windowEnd = addIsoDays(anchorIso, futureDays)
  const stays: GmStay[] = []

  units.forEach((unit, unitIndex) => {
    const rand = mulberry32(seed + unitIndex * 7919)
    // Stagger the first arrival so the whole portfolio does not turn over on
    // the same day.
    let cursor = addIsoDays(windowStart, Math.floor(rand() * 6))
    let sequence = 0

    while (isoDiffDays(cursor, windowEnd) >= 2) {
      const nights = 2 + Math.floor(rand() * 8)
      const checkIn = cursor
      const checkOut = addIsoDays(checkIn, nights)
      const weekendNights = isoRange(checkIn, nights).filter(isWeekend).length
      // Weekend nights sell higher, and the rate is nudged per stay so ADR is
      // not a single flat number across the portfolio.
      const rate = Math.round(
        unit.nightlyRate
        * (1 + (weekendNights / nights) * 0.18)
        * (0.9 + rand() * 0.25),
      )
      const guestName = pick(rand, GUEST_NAMES)
      const daysToArrival = isoDiffDays(anchorIso, checkIn)
      const channel = pickChannel(rand)

      let status: GmStayStatus
      if (isoDiffDays(checkOut, anchorIso) >= 0)
        status = 'checked_out'
      // `checked_in` means already in house, which is why a guest arriving
      // TODAY is not one: they are still expected at their ETA. Treating
      // today's arrivals as checked in also made `unassignedArrivals`
      // permanently 0, since every arrival was overwritten before its
      // verification state could show.
      else if (daysToArrival < 0)
        status = 'checked_in'
      else status = daysToArrival <= 3 && rand() < 0.25 ? 'unverified' : 'verified'

      stays.push({
        id: `gm-stay-${unit.id}-${sequence}`,
        listingId: unit.listingId,
        listingName: unit.listingName,
        location: unit.location,
        region: unit.region,
        guestName,
        initials: initialsOf(guestName),
        channel,
        checkIn,
        checkOut,
        nights,
        guests: 1 + Math.floor(rand() * Math.max(1, Math.min(unit.capacity, 6))),
        nightlyRate: rate,
        total: rate * nights,
        status,
        eta: `${String(13 + Math.floor(rand() * 9)).padStart(2, '0')}:${rand() < 0.5 ? '00' : '30'}`,
        // Direct bookings are the ones that still owe on arrival.
        balanceDue: channel === 'Direct' && daysToArrival >= 0 && rand() < 0.4
          ? Math.round(rate * nights * 0.5)
          : 0,
      })

      // A same-day turnover is the common case; otherwise the unit sits empty
      // for a night or four. Together this lands occupancy near 75%.
      const gap = rand() < 0.45 ? 0 : 1 + Math.floor(rand() * 5)
      cursor = addIsoDays(checkOut, gap)
      sequence += 1
    }
  })

  return stays
}

/* ----------------------------------------------------------- derivations */

/** A stay occupies a night when `checkIn <= date < checkOut`. */
export function occupiesNight(stay: GmStay, iso: string): boolean {
  return stay.checkIn <= iso && iso < stay.checkOut
}

export function arrivalsOn(stays: GmStay[], iso: string): GmStay[] {
  return stays
    .filter(stay => stay.checkIn === iso)
    .sort((a, b) => (a.eta ?? '').localeCompare(b.eta ?? '') || a.listingName.localeCompare(b.listingName))
}

export function departuresOn(stays: GmStay[], iso: string): GmStay[] {
  return stays
    .filter(stay => stay.checkOut === iso)
    .sort((a, b) => a.listingName.localeCompare(b.listingName))
}

/** In-house on `iso` and not leaving that morning. */
export function stayoversOn(stays: GmStay[], iso: string): GmStay[] {
  return stays
    .filter(stay => occupiesNight(stay, iso) && stay.checkIn !== iso)
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut) || a.listingName.localeCompare(b.listingName))
}

export function bookingsOn(stays: GmStay[], iso: string): GmDayBookings {
  return {
    arrivals: arrivalsOn(stays, iso),
    departures: departuresOn(stays, iso),
    stayovers: stayoversOn(stays, iso),
  }
}

export function buildDayFlow(stays: GmStay[], dayIsos: string[], unitCount: number): GmDayFlow[] {
  return dayIsos.map((iso) => {
    const occupied = stays.filter(stay => occupiesNight(stay, iso)).length
    return {
      date: iso,
      arrivals: stays.filter(stay => stay.checkIn === iso).length,
      departures: stays.filter(stay => stay.checkOut === iso).length,
      occupied,
      occupancy: unitCount > 0 ? occupied / unitCount : 0,
    }
  })
}

/** Revenue is recognised per night sold, on the night it is sold. */
export function buildRevenueSeries(stays: GmStay[], dayIsos: string[]): GmRevenuePoint[] {
  return dayIsos.map(iso => ({
    date: iso,
    revenue: stays.reduce((sum, stay) => sum + (occupiesNight(stay, iso) ? stay.nightlyRate : 0), 0),
  }))
}

export function periodMetrics(
  stays: GmStay[],
  startIso: string,
  days: number,
  unitCount: number,
): GmPeriodMetrics {
  const dayIsos = isoRange(startIso, days)
  let revenue = 0
  let occupiedNights = 0

  for (const iso of dayIsos) {
    for (const stay of stays) {
      if (occupiesNight(stay, iso)) {
        revenue += stay.nightlyRate
        occupiedNights += 1
      }
    }
  }

  const availableNights = unitCount * days
  return {
    revenue,
    occupiedNights,
    availableNights,
    occupancy: availableNights > 0 ? occupiedNights / availableNights : 0,
    adr: occupiedNights > 0 ? revenue / occupiedNights : 0,
    revpar: availableNights > 0 ? revenue / availableNights : 0,
  }
}

/** Relative change, and 0 rather than Infinity when the base period is empty. */
export function relativeDelta(current: number, prior: number): number {
  if (prior === 0)
    return current === 0 ? 0 : 1
  return (current - prior) / prior
}

export function buildKpis(stays: GmStay[], anchorIso: string, unitCount: number): GmKpiSet {
  const inHouse = stays.filter(stay => occupiesNight(stay, anchorIso))
  const tonightOccupancy = unitCount > 0 ? inHouse.length / unitCount : 0
  const weekAgo = addIsoDays(anchorIso, -7)
  const weekAgoOccupancy = unitCount > 0
    ? stays.filter(stay => occupiesNight(stay, weekAgo)).length / unitCount
    : 0

  const current = periodMetrics(stays, addIsoDays(anchorIso, -29), 30, unitCount)
  const prior = periodMetrics(stays, addIsoDays(anchorIso, -59), 30, unitCount)
  const arrivals = arrivalsOn(stays, anchorIso)

  return {
    unitCount,
    occupancyTonight: tonightOccupancy,
    occupancyDelta: tonightOccupancy - weekAgoOccupancy,
    adr: current.adr,
    adrDelta: relativeDelta(current.adr, prior.adr),
    revpar: current.revpar,
    revparDelta: relativeDelta(current.revpar, prior.revpar),
    revenue30d: current.revenue,
    revenue30dDelta: relativeDelta(current.revenue, prior.revenue),
    arrivalsToday: arrivals.length,
    departuresToday: departuresOn(stays, anchorIso).length,
    inHouseUnits: inHouse.length,
    inHouseGuests: inHouse.reduce((sum, stay) => sum + stay.guests, 0),
    unassignedArrivals: arrivals.filter(stay => stay.status === 'unverified').length,
  }
}

/* ----------------------------------------------------- guest sentiment */

/**
 * A conversation as the sentiment panel needs to read it. Structural, not the
 * whole `Conversation`, so the rules below stay testable without the inbox
 * store.
 */
export interface AttentionConversation {
  id: string
  guestName: string
  guestInitials: string
  listingName: string
  sentiment: string
  sentimentNote: string
  status: string | null
  lastMessageAt: string
  actionCategory?: string
  actionPriority?: string
}

export interface RegionScopeResult<T> {
  rows: T[]
  /**
   * Rows dropped because their property could not be placed in the selected
   * region. Surfaced in the UI rather than swallowed: only about half the mock
   * conversations name a listing that exists in `listings`, so silently
   * hiding them would look like the inbox had gone quiet.
   */
  excluded: number
}

export function buildRegionByListingName(units: GmUnit[]): Map<string, Exclude<GmRegion, 'all'>> {
  return new Map(units.map(unit => [unit.listingName, unit.region]))
}

/**
 * Conversations are keyed by listing *name*, not id, so a region filter can
 * only reach the ones whose name resolves to a known listing.
 */
export function scopeToRegion<T extends { listingName: string }>(
  rows: T[],
  region: GmRegion,
  regionByListingName: Map<string, Exclude<GmRegion, 'all'>>,
): RegionScopeResult<T> {
  if (region === 'all')
    return { rows, excluded: 0 }
  const kept = rows.filter(row => regionByListingName.get(row.listingName) === region)
  return { rows: kept, excluded: rows.length - kept.length }
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, default: 2 }

/**
 * What the GM should look at first: anything flagged `action_needed`, then by
 * priority, then the most recent message — an old grumble that nobody flagged
 * should not outrank a live one.
 */
export function sortByAttention<T extends AttentionConversation>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    (Number(b.status === 'action_needed') - Number(a.status === 'action_needed'))
    || ((PRIORITY_RANK[a.actionPriority ?? 'default'] ?? 2) - (PRIORITY_RANK[b.actionPriority ?? 'default'] ?? 2))
    || (new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()))
}

export interface GmSentimentSummary {
  negative: number
  actionNeeded: number
  /** Negative conversations whose property is outside the selected region. */
  excluded: number
}

export function summariseSentiment(
  rows: AttentionConversation[],
  excluded: number,
): GmSentimentSummary {
  return {
    negative: rows.length,
    actionNeeded: rows.filter(row => row.status === 'action_needed').length,
    excluded,
  }
}

/* -------------------------------------------------------------- display */

export const gmChannelIcons: Record<GmChannel, string> = {
  'Airbnb': 'logos:airbnb-icon',
  'Booking.com': 'simple-icons:bookingdotcom',
  'Direct': 'lucide:globe',
}

/** Compact money for KPI tiles and chart axes: `$18.4k`. */
export function formatCompactMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

/** Full money for tooltips and table cells: `$1,240`. */
export function formatMoney(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`
}

/** Signed relative change for a trend badge: `+12.5%`. */
export function formatSignedPercent(ratio: number, digits = 1): string {
  const value = ratio * 100
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
}

/** Signed percentage *points*, for occupancy which is already a percentage. */
export function formatSignedPoints(points: number, digits = 1): string {
  const value = points * 100
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)} pts`
}
