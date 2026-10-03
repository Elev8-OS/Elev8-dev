import type { ReservationStatus } from '~/components/reservations/data/reservations'

/**
 * Solid fills for stay bars on the listing calendar, keyed like
 * `reservationStatusClasses`. That map is the light tint badges and the
 * Operations Calendar use; a bar on a month grid reads better filled, so the
 * listing calendar keeps its own solid set rather than changing the shared one.
 */
export const stayBarClasses: Record<ReservationStatus, string> = {
  unverified: 'bg-zinc-400 text-white border-zinc-400',
  verified: 'bg-green-500 text-white border-green-500',
  checked_in: 'bg-orange-500 text-white border-orange-500',
  checked_out: 'bg-blue-500 text-white border-blue-500',
  cancelled: 'bg-muted text-muted-foreground border-border line-through',
  blocked: 'bg-zinc-900 text-white border-zinc-900',
  inquiry: 'bg-amber-500 text-white border-amber-500',
  owner_request: 'bg-violet-500 text-white border-violet-500',
}
