/**
 * What a channel asks the host to answer on a reservation: a request to book
 * (NextPax `POST /bookings/:id/change-state`, `reservation` or `cancelled` with
 * a reason) and an Airbnb alteration (`GET /booking-alterations`, answered with
 * `POST /booking-alterations/:id`). Pure; imports types only.
 */
import type { ReservationEntry } from './reservations'
import type { BookingChannel } from '~/components/listings/data/listings'

/** A change the guest asked for on the channel. Airbnb only, as in NextPax. */
export interface BookingAlteration {
  id: string
  /** The channel's own id for the alteration, sent back with the answer. */
  channelAlterationId: string
  requestedAt: string
  checkIn: string
  checkOut: string
  guestCount: number
  /** The new total the channel quotes, in the reservation's currency. */
  totalPrice: number
  /** What the guest wrote with it. */
  note?: string
}

/** How long a channel waits for an answer before it withdraws the request. */
export const REQUEST_ANSWER_HOURS = 24

export interface DeclineReason {
  value: string
  label: string
  /** Only offered on these channels. Missing = every channel. */
  channels?: BookingChannel[]
}

/** The reasons NextPax passes on, worded for hosts. Some exist on one channel only. */
export const DECLINE_REASONS: DeclineReason[] = [
  { value: 'dates_unavailable', label: 'The dates are no longer available' },
  { value: 'not_a_fit', label: 'The stay is not a good fit for this listing' },
  { value: 'better_reservation', label: 'Waiting for a better reservation', channels: ['Airbnb'] },
  { value: 'details_incomplete', label: 'The guest\'s details are incomplete', channels: ['Booking.com'] },
  { value: 'outside_checkin_hours', label: 'Arrival is outside check-in hours', channels: ['Booking.com'] },
  { value: 'other', label: 'Something else' },
]

export function declineReasonsFor(channel: BookingChannel): DeclineReason[] {
  return DECLINE_REASONS.filter(r => !r.channels || r.channels.includes(channel))
}

export const declineReasonLabel = (value: string) => DECLINE_REASONS.find(r => r.value === value)?.label ?? value

/** The host owes the channel an answer on this reservation. */
export const needsAnswer = (r: Pick<ReservationEntry, 'status' | 'alteration'>) => r.status === 'request' || !!r.alteration

/** "Answer within 18 h", "Answer within 40 min", or "Expired". */
export function requestTimeLeft(expiresAt: string | undefined, now: Date = new Date()): { expired: boolean, label: string } {
  if (!expiresAt)
    return { expired: false, label: `Answer within ${REQUEST_ANSWER_HOURS} h` }
  const minutes = Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 60_000)
  if (Number.isNaN(minutes))
    return { expired: false, label: `Answer within ${REQUEST_ANSWER_HOURS} h` }
  if (minutes <= 0)
    return { expired: true, label: 'Expired' }
  return { expired: false, label: minutes < 60 ? `Answer within ${minutes} min` : `Answer within ${Math.floor(minutes / 60)} h` }
}

export interface AlterationChange {
  key: 'dates' | 'guests' | 'total'
  label: string
  from: string
  to: string
}

/** Only what the alteration actually changes, so the host reads the difference, not a form. */
export function alterationChanges(r: ReservationEntry, formatMoney: (amount: number, currency: string) => string): AlterationChange[] {
  const a = r.alteration
  if (!a)
    return []
  const changes: AlterationChange[] = []
  if (a.checkIn !== r.checkIn || a.checkOut !== r.checkOut)
    changes.push({ key: 'dates', label: 'Dates', from: `${r.checkIn} to ${r.checkOut}`, to: `${a.checkIn} to ${a.checkOut}` })
  if (a.guestCount !== r.guestCount)
    changes.push({ key: 'guests', label: 'Guests', from: String(r.guestCount), to: String(a.guestCount) })
  if (a.totalPrice !== r.totalPrice)
    changes.push({ key: 'total', label: 'Total', from: formatMoney(r.totalPrice, r.currency), to: formatMoney(a.totalPrice, r.currency) })
  return changes
}
