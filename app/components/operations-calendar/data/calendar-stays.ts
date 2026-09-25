import type { StayLike } from '~/components/cleaning/data/cleaning-link'
import type { Booking } from '~/components/listings/data/listings'
import type { ReservationEntry, ReservationStatus } from '~/components/reservations/data/reservations'

/**
 * Every stay at a property, from BOTH places the app keeps them.
 *
 * ⚠️ The app holds stays in two disjoint datasets that never sync: the
 * Reservations module (`useReservationsModule`, what the Reservations page,
 * damage protection, city tax and the folio read) and `listing.bookings` (the
 * listing mock data the Operations Calendar was built on). No stay is in both,
 * by id or by listing and dates. Until they are merged into one source, every
 * surface that answers "who is staying here" reads the union through this
 * module, so the calendar, the cleaning form and the cleaning's automatic link
 * can never disagree about it.
 */

/**
 * The block reason an owner stay carries once it is drawn as a block. Named once,
 * because it is also how `bookingReservationStatus` tells an owner stay from a
 * maintenance block again.
 */
export const OWNER_STAY_BLOCK_REASON = 'Owner stay'

/** A stay from either source, in the shape the cleaning link rule reads. */
export interface CalendarStay extends StayLike {
  guestName: string
  origin: 'reservation' | 'listing_booking'
}

/**
 * A Reservations-module stay in the calendar's `Booking` shape.
 *
 * Owner stays and maintenance blocks become `type: 'block'`, the convention
 * `listing.bookings` already uses (a block named "Owner stay"), so the calendar
 * draws them as the blocks they are rather than as guests.
 */
export function reservationToBooking(r: ReservationEntry): Booking {
  const base = {
    id: r.id,
    guestName: r.guestName,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    nights: r.nights,
    adults: r.guestAdults,
    children: r.guestChildren,
    infants: r.guestInfants,
    revenue: r.totalPrice ?? 0,
    source: r.channel,
  }
  if (r.status === 'owner_request')
    return { ...base, type: 'block', status: 'verified', blockReason: OWNER_STAY_BLOCK_REASON }
  if (r.status === 'blocked')
    return { ...base, type: 'block', status: 'verified', blockReason: r.guestNotes || 'Blocked' }
  return { ...base, type: 'reservation', status: r.status }
}

/**
 * A calendar booking's status in the Reservations vocabulary, which is what the
 * status colours are keyed by. A booking's own statuses are a subset of it; a
 * block is an owner stay when it carries `OWNER_STAY_BLOCK_REASON`, otherwise a
 * maintenance block.
 */
export function bookingReservationStatus(booking: Pick<Booking, 'type' | 'status' | 'blockReason'>): ReservationStatus {
  if (booking.type === 'block')
    return booking.blockReason === OWNER_STAY_BLOCK_REASON ? 'owner_request' : 'blocked'
  return booking.status
}

/** One listing's bookings from both sources, by check-in. */
export function mergedBookingsFor(
  listingId: string,
  listingBookings: Booking[],
  reservations: ReservationEntry[],
): Booking[] {
  const fromReservations = reservations
    .filter(r => r.listingId === listingId)
    .map(reservationToBooking)
  return [...listingBookings, ...fromReservations]
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
}

/**
 * Every stay from both sources, for the cleaning link rule.
 *
 * A listing block is `blocked`, so the rule never links a cleaning to it; a
 * reservation keeps its own status, so an owner stay still counts as a stay.
 */
export function allStays(
  listings: { id: string, bookings: Booking[] }[],
  reservations: ReservationEntry[],
): CalendarStay[] {
  const fromListings: CalendarStay[] = listings.flatMap(l => l.bookings.map(b => ({
    id: b.id,
    listingId: l.id,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    status: b.type === 'block' ? 'blocked' : b.status,
    guestName: b.guestName,
    origin: 'listing_booking' as const,
  })))
  const fromReservations: CalendarStay[] = reservations.map(r => ({
    id: r.id,
    listingId: r.listingId,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    status: r.status,
    rooms: r.rooms,
    guestName: r.guestName,
    origin: 'reservation' as const,
  }))
  return [...fromReservations, ...fromListings]
}
