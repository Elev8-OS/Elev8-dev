import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { computed } from 'vue'
import { declineReasonLabel, needsAnswer, REQUEST_ANSWER_HOURS } from '~/components/reservations/data/channel-requests'
import { nightsBetween } from '~/components/reservations/data/reservations'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useNotifications } from '~/composables/useNotifications'
import { newReservationConflicts, useReservationsModule } from '~/composables/useReservationsModule'

/** Mocked round trip for an answer sent to the channel. */
export const CHANNEL_ANSWER_DELAY_MS = 800
/** Mocked `POST /bookings/sync`. */
export const BOOKING_SYNC_DELAY_MS = 1200

export interface AnswerResult {
  ok: boolean
  error?: string
}

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function localDay(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Requests to book and Airbnb alterations: the answers a channel waits for.
 * Accepting a request makes it an unverified reservation (paid is not
 * verified); declining cancels it with the reason the channel passes on. An
 * accepted alteration rewrites the stay. Mock only: each answer is a timer
 * shaped like NextPax's `change-state` and `booking-alterations` calls.
 * Writes go through `useReservationsModule`, the owner of reservations.
 */
export function useChannelRequests() {
  const { reservations, updateReservation, updateReservationStatus } = useReservationsModule()
  const { createAlert } = useNotifications()
  // The "Sync bookings" mock brings in one more request, once per session.
  const syncedOnce = useState<boolean>('channel-requests-synced', () => false)

  /** Requests first (they expire), then alterations, oldest first. */
  const pending = computed(() => reservations.value
    .filter(needsAnswer)
    .sort((a, b) => Number(b.status === 'request') - Number(a.status === 'request')
      || (a.requestExpiresAt ?? a.alteration?.requestedAt ?? '').localeCompare(b.requestExpiresAt ?? b.alteration?.requestedAt ?? '')))

  function find(id: string) {
    return reservations.value.find(r => r.id === id)
  }

  function event(id: string, title: string, description: string): ActivityEvent {
    return {
      id: `act-${id}-${Date.now()}`,
      type: 'reservation',
      title,
      description,
      actor: useCurrentDashboardUser().currentUser.value?.name ?? 'Staff',
      timestamp: new Date().toISOString(),
      colorDot: 'blue',
    }
  }

  function log(id: string, title: string, description: string, patch: Partial<ReservationEntry> = {}) {
    const r = find(id)
    if (r)
      updateReservation(id, { ...patch, activity: [...r.activity, event(id, title, description)] })
  }

  /** Other stays already holding these dates, worded for the host. Null when the dates are free. */
  function clash(r: ReservationEntry, checkIn: string, checkOut: string): string | null {
    const others = reservations.value.filter(x => x.id !== r.id)
    const conflicts = newReservationConflicts({ listingId: r.listingId, checkIn, checkOut }, others)
    return conflicts.length ? `The dates overlap ${conflicts.map(c => c.guestName || 'a block').join(', ')}.` : null
  }

  async function acceptRequest(id: string): Promise<AnswerResult> {
    const r = find(id)
    if (!r || r.status !== 'request')
      return { ok: false, error: 'This request was already answered.' }
    const overlap = clash(r, r.checkIn, r.checkOut)
    if (overlap)
      return { ok: false, error: overlap }
    await wait(CHANNEL_ANSWER_DELAY_MS)
    updateReservationStatus(id, 'unverified')
    log(id, 'Request accepted', `${r.channel} confirmed the booking.`, { requestExpiresAt: undefined })
    return { ok: true }
  }

  async function declineRequest(id: string, reason: string): Promise<AnswerResult> {
    const r = find(id)
    if (!r || r.status !== 'request')
      return { ok: false, error: 'This request was already answered.' }
    if (!reason)
      return { ok: false, error: 'Pick a reason. The channel asks for one.' }
    await wait(CHANNEL_ANSWER_DELAY_MS)
    updateReservationStatus(id, 'cancelled')
    log(id, 'Request declined', `Reason sent to ${r.channel}: ${declineReasonLabel(reason)}.`, { requestExpiresAt: undefined })
    return { ok: true }
  }

  async function acceptAlteration(id: string): Promise<AnswerResult> {
    const r = find(id)
    const a = r?.alteration
    if (!r || !a)
      return { ok: false, error: 'This change was already answered.' }
    const overlap = (a.checkIn !== r.checkIn || a.checkOut !== r.checkOut) ? clash(r, a.checkIn, a.checkOut) : null
    if (overlap)
      return { ok: false, error: overlap }
    await wait(CHANNEL_ANSWER_DELAY_MS)
    log(id, 'Change accepted', `${r.channel} change ${a.channelAlterationId} applied.`, {
      checkIn: a.checkIn,
      checkOut: a.checkOut,
      nights: nightsBetween(a.checkIn, a.checkOut),
      guestCount: a.guestCount,
      totalPrice: a.totalPrice,
      alteration: undefined,
    })
    return { ok: true }
  }

  async function declineAlteration(id: string): Promise<AnswerResult> {
    const r = find(id)
    if (!r?.alteration)
      return { ok: false, error: 'This change was already answered.' }
    const code = r.alteration.channelAlterationId
    await wait(CHANNEL_ANSWER_DELAY_MS)
    log(id, 'Change declined', `${r.channel} change ${code} declined. The booking stays as it was.`, { alteration: undefined })
    return { ok: true }
  }

  /**
   * Pulls bookings the channels sent while the webhook was quiet. The mock
   * finds one new Airbnb request the first time, nothing after.
   */
  async function syncBookings(): Promise<number> {
    await wait(BOOKING_SYNC_DELAY_MS)
    if (syncedOnce.value)
      return 0
    syncedOnce.value = true
    const now = new Date()
    const request: ReservationEntry = {
      id: `res-req-sync-${now.getTime().toString(36)}`,
      guestId: 'guest-2',
      guestName: 'James Carter',
      guestEmail: 'james.carter@email.com',
      guestPhone: '+44 20 7946 0958',
      guestLanguage: 'English',
      guestNotes: '',
      listingId: 'lst-4',
      listingName: 'The R Villa Merapi',
      channel: 'Airbnb',
      checkIn: localDay(30),
      checkOut: localDay(33),
      nights: 3,
      guestCount: 2,
      totalPrice: 540,
      currency: 'USD',
      status: 'request',
      requestExpiresAt: new Date(now.getTime() + REQUEST_ANSWER_HOURS * 3_600_000).toISOString(),
      activity: [{ ...event('sync', 'Request to book', 'Received from Airbnb by Sync bookings.'), actor: 'Airbnb', channel: 'Airbnb' }],
    }
    reservations.value = [request, ...reservations.value]
    createAlert('BOOKING_REQUEST_RECEIVED', 'WARNING', { guest_name: request.guestName, listing_name: request.listingName, channel: request.channel, reservation_id: request.id })
    return 1
  }

  return { pending, acceptRequest, declineRequest, acceptAlteration, declineAlteration, syncBookings }
}
