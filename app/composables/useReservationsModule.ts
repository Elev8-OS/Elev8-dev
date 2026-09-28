import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type { GuestProfile, ReservationDraft, ReservationEntry, ReservationRoomLine, ReservationStatus } from '~/components/reservations/data/reservations'
import { cleanerOptions } from '~/components/cleaning/data/cleaning-jobs'
import { listings } from '~/components/listings/data/listings'
import { generateCleaningJobsForReservation, resolveDefaultCleaningSchedule } from '~/components/reservations/data/cleaning-schedule'
import { generateGuestId, generateReservationId, initialGuests, initialReservations, nightsBetween } from '~/components/reservations/data/reservations'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { usePromoRedemption } from '~/composables/usePromoRedemption'

export interface ReservationFilters {
  search: string
  status: ReservationStatus | 'all'
  listings: string[]
  dateFrom: string
  dateTo: string
}

export interface UnitConflict {
  reservationId: string
  guestName: string
  checkIn: string
  checkOut: string
  roomLine: ReservationRoomLine
}

function rangesOverlap(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut
}

export const DEFAULT_CHECK_IN_TIME = '14:00'
export const DEFAULT_CHECK_OUT_TIME = '11:00'

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/

/** Statuses a stay can no longer be extended from. */
export const NON_EXTENDABLE_STATUSES: ReservationStatus[] = ['cancelled', 'checked_out']
/** Once the guest is in (or the stay is over), the check-in time is history. */
export const CHECK_IN_TIME_LOCKED_STATUSES: ReservationStatus[] = ['checked_in', 'checked_out', 'cancelled']
/** A checked-in guest can still get a late check-out; a finished stay cannot. */
export const CHECK_OUT_TIME_LOCKED_STATUSES: ReservationStatus[] = ['checked_out', 'cancelled']

/** IDR has no minor unit; everything else rounds to cents. */
function roundForCurrency(amount: number, currency: string): number {
  return currency === 'IDR' ? Math.round(amount) : Math.round(amount * 100) / 100
}

function isPerNightLine(line: ReservationRoomLine): boolean {
  return (line.priceMode ?? 'per_night') === 'per_night'
}

export interface ExtensionQuote {
  extraNights: number
  newNights: number
  nightlyRate: number
  amount: number
  newTotal: number
  /** true when the rate comes from the booked room lines and is not editable. */
  rateFromRooms: boolean
}

export function useReservationsModule() {
  // Shallow copy: a reservation's array fields (folioItems, activity, rooms,
  // charges...) are still the same array object as the seed's. Nothing
  // mutates one of those arrays in place today, so this is latent, not live,
  // but a future `push` onto e.g. `folioItems` would corrupt the shared seed
  // across every test and every other reservation reusing it. Always
  // spread-replace the array, never mutate it in place.
  const reservations = useState<ReservationEntry[]>('reservations-entries', () =>
    initialReservations.map(r => ({ ...r })))
  const guests = useState<GuestProfile[]>('reservations-guests', () =>
    initialGuests.map(g => ({ ...g })))

  const filters = useState<ReservationFilters>('reservations-filters', () => ({
    search: '',
    status: 'all',
    listings: [],
    dateFrom: '',
    dateTo: '',
  }))

  /** Reservations that already book the given unit in the given date range. */
  function getUnitConflicts(unitId: string, listingId: string, checkIn: string, checkOut: string, excludeReservationId?: string): UnitConflict[] {
    const conflicts: UnitConflict[] = []
    for (const r of reservations.value) {
      if (excludeReservationId && r.id === excludeReservationId)
        continue
      if (r.listingId !== listingId)
        continue
      if (!r.rooms?.length)
        continue
      if (!rangesOverlap(checkIn, checkOut, r.checkIn, r.checkOut))
        continue
      for (const line of r.rooms) {
        if (line.unitId === unitId) {
          conflicts.push({
            reservationId: r.id,
            guestName: r.guestName,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            roomLine: line,
          })
          break
        }
      }
    }
    return conflicts
  }

  function getConflictedUnitIds(listingId: string, checkIn: string, checkOut: string, excludeReservationId?: string): Set<string> {
    const ids = new Set<string>()
    for (const r of reservations.value) {
      if (excludeReservationId && r.id === excludeReservationId)
        continue
      if (r.listingId !== listingId)
        continue
      if (!r.rooms?.length)
        continue
      if (!rangesOverlap(checkIn, checkOut, r.checkIn, r.checkOut))
        continue
      for (const line of r.rooms)
        ids.add(line.unitId)
    }
    return ids
  }

  const filteredReservations = computed(() => {
    return reservations.value.filter((r) => {
      if (filters.value.status !== 'all' && r.status !== filters.value.status)
        return false
      if (filters.value.listings.length > 0 && !filters.value.listings.includes(r.listingId))
        return false
      if (filters.value.dateFrom && r.checkIn < filters.value.dateFrom)
        return false
      if (filters.value.dateTo && r.checkIn > filters.value.dateTo)
        return false
      if (filters.value.search) {
        const q = filters.value.search.toLowerCase()
        const haystack = `${r.guestName} ${r.guestEmail} ${r.listingName} ${r.id}`.toLowerCase()
        if (!haystack.includes(q))
          return false
      }
      return true
    })
  })

  const today = new Date().toISOString().split('T')[0] ?? ''

  const stats = computed(() => {
    let upcoming = 0
    let current = 0
    let past = 0
    let cancelled = 0
    for (const r of reservations.value) {
      if (r.status === 'cancelled') {
        cancelled++
        continue
      }
      if (r.checkIn > today)
        upcoming++
      else if (r.checkOut >= today)
        current++
      else
        past++
    }
    return { upcoming, current, past, cancelled }
  })

  function getGuestById(id: string): GuestProfile | null {
    return guests.value.find(g => g.id === id) ?? null
  }

  function getReservationsForGuest(guestId: string): ReservationEntry[] {
    return reservations.value
      .filter(r => r.guestId === guestId)
      .sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1))
  }

  /** A profile for someone who has not stayed before. */
  function createGuestFromDraft(draft: ReservationDraft): GuestProfile {
    const guest: GuestProfile = {
      id: generateGuestId(),
      name: draft.guestName.trim(),
      email: draft.guestEmail?.trim() ?? '',
      phone: draft.guestPhone?.trim() ?? '',
      language: draft.guestLanguage?.trim() || 'English',
      notes: draft.guestNotes?.trim() ?? '',
      previousStays: 0,
      tags: [],
      createdAt: today,
    }
    guests.value = [guest, ...guests.value]
    return guest
  }

  /**
   * Which person this booking belongs to. An explicit pick wins, because staff
   * said who it is. Otherwise this is a new guest and gets a profile.
   *
   * Deliberately no matching on email or phone: a wrong merge shows one guest
   * another's stay history and spend, while a missed match only costs a
   * "welcome back", so linking an unlinked booking stays a human decision.
   */
  function resolveGuestId(draft: ReservationDraft & { guestId?: string }): string {
    const picked = draft.guestId?.trim()
    if (picked && guests.value.some(g => g.id === picked))
      return picked
    return createGuestFromDraft(draft).id
  }

  function createReservation(draft: ReservationDraft & { status?: ReservationStatus }): { success: boolean, id?: string } {
    if (!draft.guestName.trim() || !draft.listingId.trim() || !draft.checkIn.trim() || !draft.checkOut.trim())
      return { success: false }

    const status = draft.status ?? 'verified'
    // An owner stay or a manual block holds the calendar; it is not a guest
    // booking, so it must not manufacture a guest profile. `useOwnerStayApprovals`
    // creates these with a name but no email or phone, and a repeat owner stay
    // would otherwise add a second empty profile every time.
    const isCalendarBlock = status === 'blocked' || status === 'owner_request'

    const id = generateReservationId()

    let cleaningSchedule = (draft as any).cleaningSchedule
    if (!cleaningSchedule && !isCalendarBlock && draft.listingId) {
      const listing = listings.value.find(l => l.id === draft.listingId)
      if (listing?.maintenance?.defaultCleaningSchedule) {
        cleaningSchedule = resolveDefaultCleaningSchedule(listing.maintenance.defaultCleaningSchedule, draft.checkIn)
      }
    }

    const entry: ReservationEntry = {
      ...draft,
      id,
      guestId: isCalendarBlock ? (draft.guestId?.trim() ?? '') : resolveGuestId(draft),
      status,
      activity: [],
      ...(cleaningSchedule ? { cleaningSchedule } : {}),
    }
    reservations.value = [entry, ...reservations.value]

    if (cleaningSchedule && !isCalendarBlock) {
      try {
        const jobInputs = generateCleaningJobsForReservation({
          reservation: entry,
          schedule: cleaningSchedule,
          cleaners: cleanerOptions,
        })
        useCleaningJobs().applyReservationSchedule(id, jobInputs)
      }
      catch {
        // Safe for headless / test environments
      }
    }

    return { success: true, id }
  }

  /**
   * Completed stays for this guest. Derived rather than stored, so it moves the
   * moment a booking is added and cannot go stale the way GuestProfile
   * .previousStays did.
   */
  function getPreviousStayCount(guestId: string): number {
    return reservations.value.filter(r =>
      r.guestId === guestId
      && r.status !== 'cancelled'
      && r.status !== 'blocked'
      && r.checkOut < today,
    ).length
  }

  function updateGuestNotes(id: string, notes: string) {
    guests.value = guests.value.map(g =>
      g.id === id ? { ...g, notes } : g,
    )
  }

  function updateReservationStatus(id: string, status: ReservationStatus) {
    reservations.value = reservations.value.map(r =>
      r.id === id ? { ...r, status } : r,
    )
    // When a stay is checked in, feed any connected government registration
    // provider (APOA / AVS) so guest reports become due automatically.
    if (status === 'checked_in') {
      const updated = reservations.value.find(r => r.id === id)
      if (updated) {
        try {
          useGuestRegistration().syncForReservation(updated)
        }
        catch { /* provider may be unavailable during SSR */ }
      }
    }
    // A cancelled stay gives its promo codes back: free upsell orders are cancelled and
    // the redemption no longer counts against the code's usage limit.
    if (status === 'cancelled')
      usePromoRedemption().releaseForReservation(id)
  }

  function updateReservation(id: string, patch: Partial<ReservationEntry>) {
    reservations.value = reservations.value.map(r =>
      r.id === id ? { ...r, ...patch } : r,
    )
  }

  function listingBasics(listingId: string) {
    return listings.value.find(l => l.id === listingId)?.resources?.basics
  }

  /** The stay's agreed check-in time, else the listing's, else the house default. */
  function getCheckInTime(r: ReservationEntry): string {
    return r.checkInTime ?? getListingCheckInTime(r.listingId)
  }

  function getListingCheckInTime(listingId: string): string {
    return listingBasics(listingId)?.checkInTime ?? DEFAULT_CHECK_IN_TIME
  }

  /** The stay's agreed check-out time, else the listing's, else the house default. */
  function getCheckOutTime(r: ReservationEntry): string {
    return r.checkOutTime ?? getListingCheckOutTime(r.listingId)
  }

  function getListingCheckOutTime(listingId: string): string {
    return listingBasics(listingId)?.checkOutTime ?? DEFAULT_CHECK_OUT_TIME
  }

  function actorName(): string {
    return useCurrentDashboardUser().currentUser.value?.name ?? 'Staff'
  }

  function activityEvent(kind: string, title: string, description: string): ActivityEvent {
    return {
      id: `act-${kind}-${Date.now()}`,
      type: 'reservation',
      title,
      description,
      actor: actorName(),
      timestamp: new Date().toISOString(),
      colorDot: 'blue',
    }
  }

  /**
   * Sets this stay's check-in and/or check-out time. A time equal to the
   * listing's own clears the override, so the stay follows the listing again.
   * Check-in is fixed once the guest is in; check-out once the stay is over.
   */
  function updateReservationTimes(id: string, times: { checkInTime?: string, checkOutTime?: string }): { success: boolean, error?: string } {
    const r = reservations.value.find(x => x.id === id)
    if (!r)
      return { success: false, error: 'Reservation not found.' }
    if (times.checkInTime !== undefined && CHECK_IN_TIME_LOCKED_STATUSES.includes(r.status))
      return { success: false, error: 'The check-in time can no longer be changed for this stay.' }
    if (times.checkOutTime !== undefined && CHECK_OUT_TIME_LOCKED_STATUSES.includes(r.status))
      return { success: false, error: 'The check-out time can no longer be changed for this stay.' }
    for (const t of [times.checkInTime, times.checkOutTime]) {
      if (t !== undefined && !TIME_PATTERN.test(t))
        return { success: false, error: 'Enter a time as HH:MM.' }
    }

    const patch: Partial<ReservationEntry> = {}
    const changes: string[] = []
    if (times.checkInTime !== undefined && times.checkInTime !== getCheckInTime(r)) {
      changes.push(`check-in ${getCheckInTime(r)} to ${times.checkInTime}`)
      patch.checkInTime = times.checkInTime === getListingCheckInTime(r.listingId) ? undefined : times.checkInTime
    }
    if (times.checkOutTime !== undefined && times.checkOutTime !== getCheckOutTime(r)) {
      changes.push(`check-out ${getCheckOutTime(r)} to ${times.checkOutTime}`)
      patch.checkOutTime = times.checkOutTime === getListingCheckOutTime(r.listingId) ? undefined : times.checkOutTime
    }
    if (!changes.length)
      return { success: true }

    const description = changes.join(', ')
    const event = activityEvent('stay-times', 'Reservation time changed', description.charAt(0).toUpperCase() + description.slice(1))
    reservations.value = reservations.value.map(x =>
      x.id === id ? { ...x, ...patch, activity: [...x.activity, event] } : x,
    )
    return { success: true }
  }

  /** Nightly rate an extension is priced at when the stay has no room lines. */
  function defaultNightlyRate(r: ReservationEntry): number {
    if (r.rooms?.length)
      return roundForCurrency(r.rooms.filter(isPerNightLine).reduce((sum, l) => sum + l.pricePerNight, 0), r.currency)
    const base = r.priceDetails?.subtotal || r.totalPrice
    return roundForCurrency(base / Math.max(r.nights, 1), r.currency)
  }

  /**
   * Prices moving check-out to `newCheckOut`. Room-line stays are priced from
   * their per-night lines (flat-rate lines do not grow), so the Edit dialog,
   * which rebuilds the total from the lines, lands on the same number.
   */
  function quoteExtension(r: ReservationEntry, newCheckOut: string, nightlyRate?: number): ExtensionQuote {
    const extraNights = Math.max(nightsBetween(r.checkOut, newCheckOut), 0)
    const rateFromRooms = Boolean(r.rooms?.length)
    const rate = rateFromRooms ? defaultNightlyRate(r) : Math.max(nightlyRate ?? defaultNightlyRate(r), 0)
    const amount = roundForCurrency(rate * extraNights, r.currency)
    return {
      extraNights,
      newNights: r.nights + extraNights,
      nightlyRate: rate,
      amount,
      newTotal: roundForCurrency(r.totalPrice + amount, r.currency),
      rateFromRooms,
    }
  }

  /**
   * Stays that already hold the listing (or, for room-line bookings, one of
   * the same units) in the nights the extension would add.
   */
  function getExtensionConflicts(id: string, newCheckOut: string): ReservationEntry[] {
    const r = reservations.value.find(x => x.id === id)
    if (!r || newCheckOut <= r.checkOut)
      return []
    const ownUnits = new Set((r.rooms ?? []).map(l => l.unitId))
    return reservations.value.filter((other) => {
      if (other.id === r.id || other.listingId !== r.listingId || other.status === 'cancelled')
        return false
      if (other.status === 'inquiry' && other.blocksAvailability === false)
        return false
      if (!rangesOverlap(r.checkOut, newCheckOut, other.checkIn, other.checkOut))
        return false
      // Both booked by unit: only a shared unit collides.
      if (ownUnits.size && other.rooms?.length)
        return other.rooms.some(l => ownUnits.has(l.unitId))
      return true
    })
  }

  function extendReservation(id: string, input: { checkOut: string, nightlyRate?: number }): { success: boolean, error?: string } {
    const r = reservations.value.find(x => x.id === id)
    if (!r)
      return { success: false, error: 'Reservation not found.' }
    if (NON_EXTENDABLE_STATUSES.includes(r.status))
      return { success: false, error: 'This stay can no longer be extended.' }
    if (input.checkOut <= r.checkOut)
      return { success: false, error: 'Pick a check-out date after the current one.' }
    const conflicts = getExtensionConflicts(id, input.checkOut)
    if (conflicts.length)
      return { success: false, error: `Those nights are already booked by ${conflicts[0]!.guestName}.` }

    const quote = quoteExtension(r, input.checkOut, input.nightlyRate)
    const rooms = r.rooms?.map(l => isPerNightLine(l)
      ? { ...l, lineTotal: roundForCurrency(l.pricePerNight * quote.newNights, r.currency) }
      : l)
    // The folio owns `priceDetails.extras`; the extension only moves the room
    // subtotal and keeps guestPaid / payout in step, as the folio does.
    const priceDetails = r.priceDetails
      ? {
          ...r.priceDetails,
          subtotal: roundForCurrency(r.priceDetails.subtotal + quote.amount, r.currency),
          guestPaid: roundForCurrency(r.priceDetails.guestPaid + quote.amount, r.currency),
          payout: roundForCurrency(r.priceDetails.payout + quote.amount, r.currency),
        }
      : undefined

    const amountLabel = `${r.currency} ${quote.amount.toLocaleString('en-US', { minimumFractionDigits: r.currency === 'IDR' ? 0 : 2, maximumFractionDigits: r.currency === 'IDR' ? 0 : 2 })}`
    const event = activityEvent(
      'extend',
      'Stay extended',
      `${quote.extraNights} night${quote.extraNights === 1 ? '' : 's'} added, check-out moved from ${r.checkOut} to ${input.checkOut} · ${amountLabel}`,
    )

    reservations.value = reservations.value.map(x =>
      x.id === id
        ? {
            ...x,
            checkOut: input.checkOut,
            nights: quote.newNights,
            totalPrice: quote.newTotal,
            ...(rooms ? { rooms } : {}),
            ...(priceDetails ? { priceDetails } : {}),
            activity: [...x.activity, event],
          }
        : x,
    )
    return { success: true }
  }

  function reset() {
    reservations.value = initialReservations.map(r => ({ ...r }))
    guests.value = initialGuests.map(g => ({ ...g }))
    filters.value = { search: '', status: 'all', listings: [], dateFrom: '', dateTo: '' }
  }

  return {
    reservations,
    guests,
    filters,
    filteredReservations,
    stats,
    getGuestById,
    getReservationsForGuest,
    createReservation,
    getPreviousStayCount,
    updateGuestNotes,
    updateReservationStatus,
    updateReservation,
    getUnitConflicts,
    getConflictedUnitIds,
    getCheckInTime,
    getListingCheckInTime,
    getCheckOutTime,
    getListingCheckOutTime,
    updateReservationTimes,
    defaultNightlyRate,
    quoteExtension,
    getExtensionConflicts,
    extendReservation,
    reset,
  }
}
