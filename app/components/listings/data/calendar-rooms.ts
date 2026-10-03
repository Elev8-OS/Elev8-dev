import type { Booking, Listing } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { reservationUnitIds } from '~/composables/useReservationsModule'

/**
 * The rooms a stay occupies, for the listing calendar's rooms timeline: a
 * Reservations-module stay's priced room lines, else the rooms it was assigned
 * to (`reservationUnitIds`). A listing booking, or a reservation with neither,
 * is drawn in the "Not assigned to a room" row. Unique, in booking order.
 */
export function stayUnitIds(booking: Pick<Booking, 'id'>, reservations: ReservationEntry[]): string[] {
  const r = reservations.find(x => x.id === booking.id)
  return r ? [...new Set(reservationUnitIds(r).filter(Boolean))] : []
}

/** The room names a stay occupies, for the guest list ("Master Suite, Pool Unit"). */
export function stayUnitNames(booking: Pick<Booking, 'id'>, reservations: ReservationEntry[], listing: Pick<Listing, 'unitTypes'>): string[] {
  const units = (listing.unitTypes ?? []).flatMap(t => t.units)
  return stayUnitIds(booking, reservations).map(id => units.find(u => u.id === id)?.name ?? id)
}

/**
 * Whether the calendar can put this stay in a room: only a Reservations-module
 * stay without priced room lines. A listing booking has no record to write to;
 * a priced stay changes rooms in its reservation.
 */
export function canAssignRoom(booking: Pick<Booking, 'id' | 'type'>, reservations: ReservationEntry[]): boolean {
  const r = reservations.find(x => x.id === booking.id)
  return Boolean(r) && booking.type !== 'block' && !r!.rooms?.length
}

/** One day column of the rooms timeline. */
export interface TimelineDay {
  key: string
  day: number
  /** One-letter weekday, e.g. "M". */
  weekday: string
  isToday: boolean
  isBlocked: boolean
}
