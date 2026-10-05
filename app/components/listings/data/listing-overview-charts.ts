import type { Booking, Listing } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { stayUnitIds } from '~/components/listings/data/calendar-rooms'
import { reservationToBooking } from '~/components/operations-calendar/data/calendar-stays'
import { formatLocalDateKey } from '~/components/operations-calendar/data/operations-calendar'

// Figures for the charts on the listing Overview tab. They read the same stays
// as the Calendar tab (both sources, see `calendar-stays.ts`), so a month's
// occupancy here matches the Calendar tab's month stats for that month.

/** A guest stay with the currency its revenue is in. */
export interface OverviewStay extends Booking {
  currency: string
  /** Rooms the stay holds; one when it has no recorded room, or when read for one room. */
  rooms: number
}

export type OverviewPeriod = '3m' | '6m' | '12m' | 'all'

export const OVERVIEW_PERIODS: { value: OverviewPeriod, label: string, months: number | null }[] = [
  { value: '3m', label: 'Last 3 months', months: 3 },
  { value: '6m', label: 'Last 6 months', months: 6 },
  { value: '12m', label: 'Last 12 months', months: 12 },
  { value: 'all', label: 'All time', months: null },
]

/**
 * The currency a listing prices in. `listing.bookings` carry no currency of
 * their own, so they are read in this one.
 */
export function listingCurrency(listing: Pick<Listing, 'unitTypes'>): string {
  return listing.unitTypes?.find(t => t.pricing?.currency)?.pricing.currency ?? 'USD'
}

/** Rooms the listing has; a single unit (or no rooms set up yet) counts as one. */
export function listingRoomCount(listing: Pick<Listing, 'unitTypes'>): number {
  return Math.max(1, (listing.unitTypes ?? []).reduce((n, t) => n + t.units.length, 0))
}

/**
 * The listing's guest stays from both sources. Blocks, owner stays, cancelled
 * stays and inquiries earn nothing and hold no guest, so they are left out.
 * With `unitId`, only the stays in that room.
 */
export function overviewStays(
  listing: Pick<Listing, 'id' | 'bookings' | 'unitTypes'>,
  reservations: ReservationEntry[],
  unitId?: string | null,
): OverviewStay[] {
  const currency = listingCurrency(listing)
  const fromListing = listing.bookings.map(b => ({ ...b, currency }))
  const fromReservations = reservations
    .filter(r => r.listingId === listing.id)
    .map(r => ({ ...reservationToBooking(r), currency: r.currency }))
  return [...fromListing, ...fromReservations]
    .filter(b => b.type !== 'block' && b.status !== 'cancelled' && b.status !== 'inquiry')
    .map((b) => {
      const units = stayUnitIds(b, reservations)
      return unitId
        ? (units.includes(unitId) ? { ...b, rooms: 1 } : null)
        : { ...b, rooms: Math.max(1, units.length) }
    })
    .filter((b): b is OverviewStay => b !== null)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
}

/** `YYYY-MM` of the month `offset` months from `today`'s. */
function monthKey(today: Date, offset: number): string {
  const d = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Every night of a stay as a local `YYYY-MM-DD` key. */
function nightKeys(stay: Pick<Booking, 'checkIn' | 'checkOut'>): string[] {
  const keys: string[] = []
  const [y, m, d] = stay.checkIn.split('-').map(Number)
  const cursor = new Date(y!, m! - 1, d!)
  for (let key = formatLocalDateKey(cursor); key < stay.checkOut; cursor.setDate(cursor.getDate() + 1), key = formatLocalDateKey(cursor))
    keys.push(key)
  return keys
}

export interface MonthPerformance {
  /** `YYYY-MM` */
  period: string
  /** Revenue in the chosen currency, spread evenly over the stay's nights. */
  revenue: number
  /** Booked room-nights over available room-nights, 0-100. */
  occupancy: number
}

/**
 * January to December of `year`, booked future months included. A stay's revenue is split over
 * its nights, so a stay across a month end counts in both months. Occupancy
 * counts every stay whatever its currency; revenue only the chosen one (no
 * conversion).
 */
export function monthlyPerformance(
  stays: OverviewStay[],
  opts: { currency: string, rooms: number, year: number },
): MonthPerformance[] {
  const periods = Array.from({ length: 12 }, (_, i) => `${opts.year}-${String(i + 1).padStart(2, '0')}`)
  const revenue = new Map(periods.map(p => [p, 0]))
  const roomNights = new Map(periods.map(p => [p, 0]))
  for (const stay of stays) {
    const nights = nightKeys(stay)
    if (!nights.length)
      continue
    const perNight = stay.revenue / nights.length
    for (const night of nights) {
      const period = night.slice(0, 7)
      if (!roomNights.has(period))
        continue
      roomNights.set(period, roomNights.get(period)! + stay.rooms)
      if (stay.currency === opts.currency)
        revenue.set(period, revenue.get(period)! + perNight)
    }
  }
  return periods.map((period) => {
    const [y, m] = period.split('-').map(Number)
    const capacity = new Date(y!, m!, 0).getDate() * opts.rooms
    return {
      period,
      revenue: Math.round(revenue.get(period)!),
      occupancy: Math.min(100, Math.round((roomNights.get(period)! / capacity) * 100)),
    }
  })
}

/** Stays checking in within the period: the last `months` months up to the end of `today`'s month. */
export function staysInPeriod<T extends Pick<Booking, 'checkIn'>>(stays: T[], period: OverviewPeriod, today: Date): T[] {
  const months = OVERVIEW_PERIODS.find(p => p.value === period)?.months
  if (!months)
    return stays
  const first = `${monthKey(today, -months + 1)}-01`
  const last = `${monthKey(today, 0)}-31`
  return stays.filter(s => s.checkIn >= first && s.checkIn <= last)
}

/** Years with a stay night, plus `currentYear`, newest first: the Revenue & Occupancy year picker. */
export function stayYears(stays: Pick<Booking, 'checkIn' | 'checkOut'>[], currentYear: number): number[] {
  const years = new Set([currentYear])
  for (const s of stays) {
    const nights = nightKeys(s)
    if (nights.length) {
      years.add(Number(nights[0]!.slice(0, 4)))
      years.add(Number(nights.at(-1)!.slice(0, 4)))
    }
  }
  return [...years].sort((a, b) => b - a)
}

export interface SourceShare {
  source: string
  bookings: number
  /** Whole percent of all bookings in the set. */
  percent: number
}

/** Bookings per channel, most first. */
export function bookingSources(stays: Pick<Booking, 'source'>[]): SourceShare[] {
  const counts = new Map<string, number>()
  for (const s of stays)
    counts.set(s.source || 'Other', (counts.get(s.source || 'Other') ?? 0) + 1)
  return [...counts.entries()]
    .map(([source, bookings]) => ({ source, bookings, percent: Math.round((bookings / stays.length) * 100) }))
    .sort((a, b) => b.bookings - a.bookings || a.source.localeCompare(b.source))
}

export const STAY_LENGTH_BUCKETS: { label: string, min: number, max: number }[] = [
  { label: '1 night', min: 1, max: 1 },
  { label: '2 nights', min: 2, max: 2 },
  { label: '3 nights', min: 3, max: 3 },
  { label: '4-6 nights', min: 4, max: 6 },
  { label: '7-13 nights', min: 7, max: 13 },
  { label: '14+ nights', min: 14, max: Infinity },
]

/** Stays per length bucket, every bucket listed even when empty. */
export function stayLengthDistribution(stays: Pick<Booking, 'nights'>[]): { label: string, stays: number }[] {
  return STAY_LENGTH_BUCKETS.map(bucket => ({
    label: bucket.label,
    stays: stays.filter(s => s.nights >= bucket.min && s.nights <= bucket.max).length,
  }))
}

/** Mean nights per stay, or null with no stays. */
export function averageStayLength(stays: Pick<Booking, 'nights'>[]): number | null {
  if (!stays.length)
    return null
  return stays.reduce((sum, s) => sum + s.nights, 0) / stays.length
}
