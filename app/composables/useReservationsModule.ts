import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type { ExtensionDirection, ExtensionPaymentMethod, GuestDocument, GuestProfile, ReservationDraft, ReservationEntry, ReservationRoomLine, ReservationStatus, StayExtension } from '~/components/reservations/data/reservations'
import type { ReservationDateBasis } from '~/lib/reservation-period'
import { cleanerOptions } from '~/components/cleaning/data/cleaning-jobs'
import { hasCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import { listings } from '~/components/listings/data/listings'
import { generateCleaningJobsForReservation, resolveDefaultCleaningSchedule } from '~/components/reservations/data/cleaning-schedule'
import { DOCUMENT_KIND_LABELS, generateGuestId, generateReservationId, initialGuests, initialReservations, isActiveExtension, nightsBetween, reservationStatusLabels } from '~/components/reservations/data/reservations'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { usePromoRedemption } from '~/composables/usePromoRedemption'
import { matchesReservationPeriod } from '~/lib/reservation-period'

export interface ReservationFilters {
  search: string
  status: ReservationStatus | 'all'
  listings: string[]
  dateFrom: string
  dateTo: string
  /** Which date the range applies to; 'stay' keeps a month-crossing stay in both months. */
  dateBasis: ReservationDateBasis
  /**
   * extended: stays with an extension, plus their linked extension bookings.
   * unpaid: the same, narrowed to extensions whose payment is still pending.
   */
  extension: 'all' | 'extended' | 'unpaid'
}

export interface UnitConflict {
  reservationId: string
  guestName: string
  checkIn: string
  checkOut: string
  /** The priced room line booking the unit; absent when the stay was only assigned to it (`assignedUnitIds`). */
  roomLine?: ReservationRoomLine
}

/**
 * The units a reservation occupies: its priced room lines, else the rooms it
 * was assigned to on the listing calendar (`assignedUnitIds`).
 */
export function reservationUnitIds(r: Pick<ReservationEntry, 'rooms' | 'assignedUnitIds'>): string[] {
  return r.rooms?.length ? r.rooms.map(line => line.unitId) : (r.assignedUnitIds ?? [])
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
/** Once the guest is in, the arrival can no longer move earlier. */
export const NON_EARLY_ARRIVAL_STATUSES: ReservationStatus[] = ['checked_in', 'checked_out', 'cancelled']
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

/** Exactly one of the two: `checkOut` adds nights after the stay, `checkIn` before it (early arrival). */
export interface ExtensionInput {
  checkOut?: string
  checkIn?: string
  nightlyRate?: number
}

function extensionTarget(input: ExtensionInput): { direction: ExtensionDirection, date: string } {
  return input.checkIn ? { direction: 'before', date: input.checkIn } : { direction: 'after', date: input.checkOut ?? '' }
}

/** Local calendar day, matching how checkIn / checkOut are written. */
function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const next = new Date(y!, m! - 1, d! + days)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
}

/** How an extension is being paid, decided by `useStayExtension` before it is recorded. */
export interface ExtensionPaymentInput {
  method: ExtensionPaymentMethod
  status: 'pending' | 'paid'
  paymentRequestId?: string
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
    dateBasis: 'stay',
    extension: 'all',
  }))

  /** Reservations that already book the given unit in the given date range. */
  function getUnitConflicts(unitId: string, listingId: string, checkIn: string, checkOut: string, excludeReservationId?: string): UnitConflict[] {
    const conflicts: UnitConflict[] = []
    for (const r of reservations.value) {
      if (excludeReservationId && r.id === excludeReservationId)
        continue
      if (r.listingId !== listingId)
        continue
      if (!reservationUnitIds(r).includes(unitId))
        continue
      if (!rangesOverlap(checkIn, checkOut, r.checkIn, r.checkOut))
        continue
      conflicts.push({
        reservationId: r.id,
        guestName: r.guestName,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        roomLine: r.rooms?.find(line => line.unitId === unitId),
      })
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
      if (!reservationUnitIds(r).length)
        continue
      if (!rangesOverlap(checkIn, checkOut, r.checkIn, r.checkOut))
        continue
      for (const unitId of reservationUnitIds(r))
        ids.add(unitId)
    }
    return ids
  }

  /**
   * Whether a stay matches the extension filter. A linked extension booking
   * matches through the extension on its parent that created it, so the pair
   * is listed (and nested) together.
   */
  function matchesExtensionFilter(r: ReservationEntry, mode: ReservationFilters['extension']): boolean {
    if (mode === 'all')
      return true
    const wanted = (e: StayExtension) => isActiveExtension(e) && (mode === 'extended' || e.paymentStatus === 'pending')
    if (r.extensions?.some(wanted))
      return true
    if (!r.extensionOf)
      return false
    const parent = reservations.value.find(x => x.id === r.extensionOf)
    return Boolean(parent?.extensions?.some(e => e.linkedReservationId === r.id && wanted(e)))
  }

  const filteredReservations = computed(() => {
    return reservations.value.filter((r) => {
      if (filters.value.status !== 'all' && r.status !== filters.value.status)
        return false
      if (!matchesExtensionFilter(r, filters.value.extension ?? 'all'))
        return false
      if (filters.value.listings.length > 0 && !filters.value.listings.includes(r.listingId))
        return false
      if (!matchesReservationPeriod(r, { from: filters.value.dateFrom, to: filters.value.dateTo }, filters.value.dateBasis ?? 'stay'))
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
      // No cleaning steps, no cleaning: the default is not applied (`cleaning-steps.ts`).
      if (listing?.maintenance?.defaultCleaningSchedule && hasCleaningSteps(listing)) {
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

  /**
   * Which stays a status change applies to. A stay and its linked extension
   * bookings are one guest stay, so they share a status: changing either
   * moves the whole group. Two exceptions: cancelling an extension cancels
   * only that extension (the guest keeps the original nights), and an
   * extension already cancelled is never brought back.
   */
  function statusGroupIds(id: string, status: ReservationStatus): string[] {
    const r = reservations.value.find(x => x.id === id)
    if (!r)
      return []
    if (r.extensionOf && status === 'cancelled')
      return [id]
    const rootId = r.extensionOf ?? r.id
    const children = reservations.value
      .filter(x => x.extensionOf === rootId && (x.id === id || x.status !== 'cancelled'))
      .map(x => x.id)
    return [rootId, ...children]
  }

  /**
   * Returns every stay the status landed on (the group, see `statusGroupIds`).
   * A cancel also cancels the extension records it ends: all of them when the
   * stay goes, the one that made a linked booking when only that goes. The
   * operational clean-up (payment link, door codes, cleaning) is
   * `useStayExtension().cancelStay` / `cancelExtension`, which call this.
   */
  function updateReservationStatus(id: string, status: ReservationStatus): string[] {
    const ids = statusGroupIds(id, status)
    if (!ids.length)
      return []
    const label = reservationStatusLabels[status]
    const target = reservations.value.find(x => x.id === id)
    const cancelling = status === 'cancelled'
    const now = new Date().toISOString()
    reservations.value = reservations.value.map((r) => {
      if (!ids.includes(r.id))
        return r
      // The stay itself going: every extension on it ends.
      const next: ReservationEntry = cancelling && r.id === id && r.extensions?.length
        ? { ...r, extensions: r.extensions.map(e => isActiveExtension(e) ? cancelledRecord(e, now) : e) }
        : r
      if (r.id === id || r.status === status)
        return { ...next, status }
      // A mirrored change says where it came from, on the stay it landed on.
      const event = activityEvent(`status-sync-${r.id}`, 'Status updated', `Set to ${label} with ${id}`)
      return { ...next, status, activity: [...next.activity, event] }
    })
    // A linked booking cancelled on its own: its parent is not in the group, but its record ends too.
    if (cancelling && target?.extensionOf && !ids.includes(target.extensionOf)) {
      reservations.value = reservations.value.map(r => r.id === target.extensionOf && r.extensions?.length
        ? { ...r, extensions: r.extensions.map(e => isActiveExtension(e) && e.linkedReservationId === id ? cancelledRecord(e, now) : e) }
        : r)
    }
    // When a stay is checked in, feed any connected government registration
    // provider (APOA / AVS) so guest reports become due automatically. Once per
    // guest stay: an extension carries the same guests, so only the root reports.
    if (status === 'checked_in') {
      const updated = reservations.value.find(r => r.id === ids[0])
      if (updated) {
        try {
          useGuestRegistration().syncForReservation(updated)
        }
        catch { /* provider may be unavailable during SSR */ }
      }
    }
    // A cancelled stay gives its promo codes back: free upsell orders are cancelled and
    // the redemption no longer counts against the code's usage limit.
    if (status === 'cancelled') {
      for (const groupId of ids)
        usePromoRedemption().releaseForReservation(groupId)
    }
    return ids
  }

  /**
   * Puts a stay in a room from the listing calendar, without touching its
   * price (`assignedUnitIds`, never a room line). Refused for a stay that has
   * priced room lines (change those in the reservation), for a room of another
   * listing, and for a room another live stay already holds on those dates.
   */
  function assignRoom(reservationId: string, unitId: string): { success: boolean, error?: string } {
    const r = reservations.value.find(x => x.id === reservationId)
    if (!r)
      return { success: false, error: 'Reservation not found.' }
    if (r.rooms?.length)
      return { success: false, error: 'This stay has priced rooms. Change them in the reservation.' }
    const listing = listings.value.find(l => l.id === r.listingId)
    const unit = listing?.unitTypes?.flatMap(t => t.units).find(u => u.id === unitId)
    if (!unit)
      return { success: false, error: 'That room is not part of this listing.' }
    const taken = getUnitConflicts(unitId, r.listingId, r.checkIn, r.checkOut, r.id)
      .filter(c => reservations.value.find(x => x.id === c.reservationId)?.status !== 'cancelled')
    if (taken.length)
      return { success: false, error: `${unit.name} is taken by ${taken[0]!.guestName} on these dates.` }
    updateReservation(r.id, { assignedUnitIds: [unitId] })
    return { success: true }
  }

  function unassignRoom(reservationId: string) {
    updateReservation(reservationId, { assignedUnitIds: undefined })
  }

  function updateReservation(id: string, patch: Partial<ReservationEntry>) {
    reservations.value = reservations.value.map(r =>
      r.id === id ? { ...r, ...patch } : r,
    )
  }

  /**
   * Staff upload or replace one identity document. A guest holds at most one of
   * each kind, so a new file replaces the old one. `guestId` is left unset for
   * the main guest. The agreement is generated from the house rules, never uploaded.
   */
  function saveGuestDocument(reservationId: string, input: { guestId?: string, kind: Exclude<GuestDocument['kind'], 'agreement'>, fileName: string, url: string }): { success: boolean, error?: string } {
    const r = reservations.value.find(x => x.id === reservationId)
    if (!r)
      return { success: false, error: 'Reservation not found.' }
    const guest = input.guestId ? r.guests?.find(g => g.id === input.guestId) : undefined
    if (input.guestId && !guest)
      return { success: false, error: 'Guest not found on this reservation.' }
    if (guest && input.kind === 'signature')
      return { success: false, error: 'Only the main guest signs.' }
    const guestName = guest?.name ?? r.guestName
    const docs = r.identity?.documents ?? []
    const existing = docs.find(d => d.kind === input.kind && d.guestId === input.guestId)
    const label = DOCUMENT_KIND_LABELS[input.kind]
    const doc: GuestDocument = {
      id: existing?.id ?? `doc-${input.kind}-${Date.now()}`,
      kind: input.kind,
      ...(input.guestId ? { guestId: input.guestId } : {}),
      name: `${label} — ${guestName}`,
      url: input.url,
      uploadedAt: new Date().toISOString(),
      fileName: input.fileName,
    }
    const documents = existing ? docs.map(d => d.id === existing.id ? doc : d) : [...docs, doc]
    const event = activityEvent('doc', existing ? 'Document replaced' : 'Document uploaded', `${label} for ${guestName} (${input.fileName}).`)
    updateReservation(r.id, {
      identity: { status: r.identity?.status ?? 'pending', ...r.identity, documents },
      activity: [...r.activity, event],
    })
    return { success: true }
  }

  function removeGuestDocument(reservationId: string, documentId: string) {
    const r = reservations.value.find(x => x.id === reservationId)
    const doc = r?.identity?.documents.find(d => d.id === documentId)
    if (!r || !doc || doc.kind === 'agreement')
      return
    const guestName = (doc.guestId && r.guests?.find(g => g.id === doc.guestId)?.name) || r.guestName
    const event = activityEvent('doc', 'Document removed', `${DOCUMENT_KIND_LABELS[doc.kind]} for ${guestName}.`)
    updateReservation(r.id, {
      identity: { ...r.identity!, documents: r.identity!.documents.filter(d => d.id !== documentId) },
      activity: [...r.activity, event],
    })
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
   * Where the next extension starts: the stay's own check-out or, for an OTA
   * stay already extended through linked direct bookings, the last of those.
   */
  function extensionStart(r: ReservationEntry): string {
    return reservations.value
      .filter(x => x.extensionOf === r.id && x.status !== 'cancelled')
      .reduce((end, x) => x.checkOut > end ? x.checkOut : end, r.checkOut)
  }

  /**
   * Where the next early arrival ends: the stay's own check-in or, for an OTA
   * stay that already arrives early through linked direct bookings, the
   * earliest of those.
   */
  function earlyArrivalEnd(r: ReservationEntry): string {
    return reservations.value
      .filter(x => x.extensionOf === r.id && x.status !== 'cancelled')
      .reduce((start, x) => x.checkIn < start ? x.checkIn : start, r.checkIn)
  }

  /** The nights an extension adds: `[from, to)`. `date` is the new check-out (`after`) or check-in (`before`). */
  function extensionRange(r: ReservationEntry, date: string, direction: ExtensionDirection = 'after'): { from: string, to: string } {
    return direction === 'before'
      ? { from: date, to: earlyArrivalEnd(r) }
      : { from: extensionStart(r), to: date }
  }

  /**
   * Prices moving check-out to `date` (or, `before`, check-in back to `date`).
   * Room-line stays are priced from their per-night lines (flat-rate lines do
   * not grow), so the Edit dialog, which rebuilds the total from the lines,
   * lands on the same number. `newNights` / `newTotal` describe an in-place
   * extension; a linked OTA extension bills only `amount`, on its own booking.
   */
  function quoteExtension(r: ReservationEntry, date: string, nightlyRate?: number, direction: ExtensionDirection = 'after'): ExtensionQuote {
    const { from, to } = extensionRange(r, date, direction)
    const extraNights = Math.max(nightsBetween(from, to), 0)
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
   * the same units) in the nights the extension would add. The stay's own
   * linked extension bookings never count against it.
   */
  function getExtensionConflicts(id: string, date: string, direction: ExtensionDirection = 'after'): ReservationEntry[] {
    const r = reservations.value.find(x => x.id === id)
    if (!r)
      return []
    const { from, to } = extensionRange(r, date, direction)
    if (to <= from)
      return []
    const ownUnits = new Set((r.rooms ?? []).map(l => l.unitId))
    return reservations.value.filter((other) => {
      if (other.id === r.id || other.extensionOf === r.id || other.listingId !== r.listingId || other.status === 'cancelled')
        return false
      if (other.status === 'inquiry' && other.blocksAvailability === false)
        return false
      if (!rangesOverlap(from, to, other.checkIn, other.checkOut))
        return false
      // Both booked by unit: only a shared unit collides.
      if (ownUnits.size && other.rooms?.length)
        return other.rooms.some(l => ownUnits.has(l.unitId))
      return true
    })
  }

  function validateExtension(id: string, date: string, direction: ExtensionDirection = 'after'): { r?: ReservationEntry, error?: string } {
    const r = reservations.value.find(x => x.id === id)
    if (!r)
      return { error: 'Reservation not found.' }
    if (NON_EXTENDABLE_STATUSES.includes(r.status))
      return { error: 'This stay can no longer be extended.' }
    if (direction === 'before') {
      if (NON_EARLY_ARRIVAL_STATUSES.includes(r.status))
        return { error: 'The guest has already checked in, so the arrival can no longer move earlier.' }
      if (date >= earlyArrivalEnd(r))
        return { error: 'Pick a check-in date before the current one.' }
      if (date < todayIso())
        return { error: 'The new check-in cannot be in the past.' }
    }
    else if (date <= extensionStart(r)) {
      return { error: 'Pick a check-out date after the current one.' }
    }
    const conflicts = getExtensionConflicts(id, date, direction)
    if (conflicts.length)
      return { error: `Those nights are already booked by ${conflicts[0]!.guestName}.` }
    return { r }
  }

  /** `previous` is the boundary that moves (old check-out, or old check-in for `before`), `next` where it lands. */
  function buildExtension(r: ReservationEntry, direction: ExtensionDirection, previous: string, next: string, quote: ExtensionQuote, payment: ExtensionPaymentInput, linkedReservationId?: string): StayExtension {
    const now = new Date().toISOString()
    return {
      id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      direction,
      ...(direction === 'before'
        ? { previousCheckIn: previous, newCheckIn: next }
        : { previousCheckOut: previous, newCheckOut: next }),
      extraNights: quote.extraNights,
      nightlyRate: quote.nightlyRate,
      amount: quote.amount,
      currency: r.currency,
      paymentMethod: payment.method,
      paymentStatus: payment.status,
      ...(payment.paymentRequestId ? { paymentRequestId: payment.paymentRequestId } : {}),
      ...(payment.status === 'paid' ? { paidAt: now } : {}),
      ...(linkedReservationId ? { linkedReservationId } : {}),
      createdAt: now,
      createdBy: actorName(),
    }
  }

  function cancelledRecord(e: StayExtension, at: string): StayExtension {
    return {
      ...e,
      cancelledAt: at,
      cancelledBy: actorName(),
      ...(e.paymentStatus === 'paid' ? { refundStatus: 'due' as const } : {}),
    }
  }

  /**
   * Whether this one extension can be cancelled on its own. Only the
   * outermost of its direction (the latest check-out, the earliest arrival),
   * so a chain never has a gap, and only before its nights have begun.
   */
  function canCancelExtension(id: string, extensionId: string): { ok: boolean, error?: string } {
    const r = reservations.value.find(x => x.id === id)
    const ext = r?.extensions?.find(e => e.id === extensionId)
    if (!r || !ext)
      return { ok: false, error: 'Extension not found.' }
    if (!isActiveExtension(ext))
      return { ok: false, error: 'This extension is already cancelled.' }
    if (r.status === 'cancelled' || r.status === 'checked_out')
      return { ok: false, error: 'This stay is over.' }
    const before = ext.direction === 'before'
    const sameWay = (r.extensions ?? []).filter(e => isActiveExtension(e) && (e.direction === 'before') === before)
    if (sameWay.at(-1)?.id !== ext.id)
      return { ok: false, error: before ? 'Cancel the earlier arrival first.' : 'Cancel the later extension first.' }
    const today = todayIso()
    if (before && (r.status === 'checked_in' || today >= ext.newCheckIn!))
      return { ok: false, error: 'The guest has already arrived for the earlier nights.' }
    if (!before && today >= ext.previousCheckOut!)
      return { ok: false, error: 'The guest is already staying the added nights.' }
    return { ok: true }
  }

  /**
   * Takes one extension back: in place, the stay's dates, nights, price and
   * room lines return to what they were; for an OTA stay, the linked booking
   * is cancelled (the OTA booking was never touched). A paid extension is left
   * with a refund due; `guestPaid` moves only when it is marked refunded.
   */
  function cancelExtension(id: string, extensionId: string): { success: boolean, error?: string, extension?: StayExtension } {
    const check = canCancelExtension(id, extensionId)
    if (!check.ok)
      return { success: false, error: check.error }
    const r = reservations.value.find(x => x.id === id)!
    const ext = r.extensions!.find(e => e.id === extensionId)!
    const before = ext.direction === 'before'
    const now = new Date().toISOString()
    const nightsLabel = `${ext.extraNights} night${ext.extraNights === 1 ? '' : 's'}`
    const refund = ext.paymentStatus === 'paid' ? ` · ${moneyLabel(ext.amount, ext.currency)} refund due` : ''

    if (ext.linkedReservationId) {
      const event = activityEvent('extension-cancel', before ? 'Early arrival cancelled' : 'Extension cancelled', `${nightsLabel} on direct booking ${ext.linkedReservationId} cancelled${refund}`)
      reservations.value = reservations.value.map((x) => {
        if (x.id === id)
          return { ...x, extensions: x.extensions!.map(e => e.id === extensionId ? cancelledRecord(e, now) : e), activity: [...x.activity, event] }
        if (x.id === ext.linkedReservationId) {
          const linkedEvent = activityEvent('status-sync-cancel', 'Status updated', `Set to ${reservationStatusLabels.cancelled}, the extension of ${id} was cancelled`)
          return { ...x, status: 'cancelled' as const, activity: [...x.activity, linkedEvent] }
        }
        return x
      })
      usePromoRedemption().releaseForReservation(ext.linkedReservationId)
      return { success: true, extension: ext }
    }

    const nights = Math.max(r.nights - ext.extraNights, 1)
    const rooms = r.rooms?.map(l => isPerNightLine(l)
      ? { ...l, lineTotal: roundForCurrency(l.pricePerNight * nights, r.currency) }
      : l)
    const priceDetails = r.priceDetails
      ? {
          ...r.priceDetails,
          subtotal: roundForCurrency(r.priceDetails.subtotal - ext.amount, r.currency),
          payout: roundForCurrency(r.priceDetails.payout - ext.amount, r.currency),
        }
      : undefined
    const cleaningSchedule = before && r.cleaningSchedule && r.cleaningSchedule.type !== 'checkout'
      ? { ...r.cleaningSchedule, startDate: shiftDate(r.cleaningSchedule.startDate, ext.extraNights) }
      : undefined
    const event = activityEvent(
      'extension-cancel',
      before ? 'Early arrival cancelled' : 'Extension cancelled',
      `${nightsLabel} removed, ${before ? `check-in back to ${ext.previousCheckIn}` : `check-out back to ${ext.previousCheckOut}`}${refund}`,
    )
    reservations.value = reservations.value.map(x => x.id === id
      ? {
          ...x,
          ...(before ? { checkIn: ext.previousCheckIn! } : { checkOut: ext.previousCheckOut! }),
          nights,
          totalPrice: roundForCurrency(x.totalPrice - ext.amount, x.currency),
          ...(rooms ? { rooms } : {}),
          ...(priceDetails ? { priceDetails } : {}),
          ...(cleaningSchedule ? { cleaningSchedule } : {}),
          extensions: x.extensions!.map(e => e.id === extensionId ? cancelledRecord(e, now) : e),
          activity: [...x.activity, event],
        }
      : x)
    const previousNights = r.nights
    void import('~/composables/useDamageProtection')
      .then(m => m.useDamageProtection().reassessOnExtension(id, previousNights))
    return { success: true, extension: ext }
  }

  /** The money for a cancelled, paid extension went back: guestPaid drops on the stay that was billed. */
  function markExtensionRefunded(id: string, extensionId: string): boolean {
    const r = reservations.value.find(x => x.id === id)
    const ext = r?.extensions?.find(e => e.id === extensionId)
    if (!r || !ext || ext.refundStatus !== 'due')
      return false
    const billedId = ext.linkedReservationId ?? r.id
    const refundedAt = new Date().toISOString()
    const event = activityEvent('extension-refund', 'Extension refunded', `${moneyLabel(ext.amount, ext.currency)} for ${ext.extraNights} cancelled night${ext.extraNights === 1 ? '' : 's'}`)
    reservations.value = reservations.value.map((x) => {
      let next = x
      if (x.id === id) {
        next = {
          ...next,
          extensions: (next.extensions ?? []).map(e => e.id === extensionId ? { ...e, refundStatus: 'refunded' as const, refundedAt } : e),
          activity: [...next.activity, event],
        }
      }
      if (x.id === billedId && next.priceDetails)
        next = { ...next, priceDetails: { ...next.priceDetails, guestPaid: roundForCurrency(Math.max(next.priceDetails.guestPaid - ext.amount, 0), next.currency) } }
      return next
    })
    return true
  }

  function moneyLabel(amount: number, currency: string): string {
    const digits = currency === 'IDR' ? 0 : 2
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
  }

  /**
   * Moves the stay's own check-out (or, with `checkIn`, its check-in back for
   * an early arrival). Without `payment` the added nights count as paid (the
   * original behaviour); with a pending payment `guestPaid` waits for
   * `markExtensionPaid`.
   */
  function extendReservation(id: string, input: ExtensionInput & { payment?: ExtensionPaymentInput }): { success: boolean, error?: string, extensionId?: string } {
    const { direction, date } = extensionTarget(input)
    const { r, error } = validateExtension(id, date, direction)
    if (!r)
      return { success: false, error }

    const payment = input.payment ?? { method: 'already_paid', status: 'paid' }
    const paid = payment.status === 'paid'
    const quote = quoteExtension(r, date, input.nightlyRate, direction)
    const before = direction === 'before'
    const rooms = r.rooms?.map(l => isPerNightLine(l)
      ? { ...l, lineTotal: roundForCurrency(l.pricePerNight * quote.newNights, r.currency) }
      : l)
    // The folio owns `priceDetails.extras`; the extension only moves the room
    // subtotal and keeps payout in step, as the folio does. guestPaid follows
    // the money: it moves now only when the nights are already paid.
    const priceDetails = r.priceDetails
      ? {
          ...r.priceDetails,
          subtotal: roundForCurrency(r.priceDetails.subtotal + quote.amount, r.currency),
          guestPaid: paid ? roundForCurrency(r.priceDetails.guestPaid + quote.amount, r.currency) : r.priceDetails.guestPaid,
          payout: roundForCurrency(r.priceDetails.payout + quote.amount, r.currency),
        }
      : undefined

    const extension = buildExtension(r, direction, before ? r.checkIn : r.checkOut, date, quote, payment)
    const nightsLabel = `${quote.extraNights} night${quote.extraNights === 1 ? '' : 's'}`
    const event = activityEvent(
      'extend',
      before ? 'Early arrival' : 'Stay extended',
      `${nightsLabel} added, ${before ? `check-in moved from ${r.checkIn}` : `check-out moved from ${r.checkOut}`} to ${date} · ${moneyLabel(quote.amount, r.currency)}${paid ? '' : ' (payment pending)'}`,
    )
    // A recurring cleaning rhythm keeps its offset from arrival.
    const cleaningSchedule = before && r.cleaningSchedule && r.cleaningSchedule.type !== 'checkout'
      ? { ...r.cleaningSchedule, startDate: shiftDate(r.cleaningSchedule.startDate, -quote.extraNights) }
      : undefined

    reservations.value = reservations.value.map(x =>
      x.id === id
        ? {
            ...x,
            ...(before ? { checkIn: date } : { checkOut: date }),
            ...(cleaningSchedule ? { cleaningSchedule } : {}),
            nights: quote.newNights,
            totalPrice: quote.newTotal,
            ...(rooms ? { rooms } : {}),
            ...(priceDetails ? { priceDetails } : {}),
            extensions: [...(x.extensions ?? []), extension],
            activity: [...x.activity, event],
          }
        : x,
    )
    // Damage protection prices by 30-night package and re-opens the choice across
    // a band. ⚠️ Dynamic import: useDamageProtection imports this composable, so a
    // static import would close a cycle (same rule as useInbox and upsells).
    const previousNights = r.nights
    void import('~/composables/useDamageProtection')
      .then(m => m.useDamageProtection().reassessOnExtension(id, previousNights))
    return { success: true, extensionId: extension.id }
  }

  /**
   * Extends an OTA stay without touching it: the channel owns the booking's
   * dates and price, so the added nights become a direct booking for the same
   * guest and rooms, starting where the stay (or its last extension) ends, or,
   * for an early arrival (`checkIn`), ending where it (or its earliest early
   * arrival) begins. The extension is recorded on the OTA stay; the new booking
   * is billed.
   */
  function extendViaLinkedBooking(id: string, input: ExtensionInput & { payment: ExtensionPaymentInput }): { success: boolean, error?: string, extensionId?: string, linkedReservationId?: string } {
    const { direction, date } = extensionTarget(input)
    const { r, error } = validateExtension(id, date, direction)
    if (!r)
      return { success: false, error }

    const before = direction === 'before'
    const { from, to } = extensionRange(r, date, direction)
    const quote = quoteExtension(r, date, input.nightlyRate, direction)
    const paid = input.payment.status === 'paid'
    // Per-night room lines carry over for the added nights; a flat-rate line
    // was paid once on the OTA booking and is not charged again.
    const rooms = r.rooms
      ?.filter(isPerNightLine)
      .map(l => ({ ...l, id: `${l.id}-ext`, lineTotal: roundForCurrency(l.pricePerNight * quote.extraNights, r.currency) }))
    const draft: ReservationDraft & Partial<ReservationEntry> = {
      guestId: r.guestId,
      guestName: r.guestName,
      guestEmail: r.guestEmail,
      guestPhone: r.guestPhone,
      guestLanguage: r.guestLanguage,
      guestNotes: r.guestNotes,
      guestFirstName: r.guestFirstName,
      guestLastName: r.guestLastName,
      listingId: r.listingId,
      listingName: r.listingName,
      channel: 'Direct',
      checkIn: from,
      checkOut: to,
      nights: quote.extraNights,
      guestCount: r.guestCount,
      guestAdults: r.guestAdults,
      guestChildren: r.guestChildren,
      guestInfants: r.guestInfants,
      totalPrice: quote.amount,
      currency: r.currency,
      priceDetails: {
        subtotal: quote.amount,
        cleaningFee: 0,
        serviceFee: 0,
        tax: 0,
        extras: 0,
        guestPaid: paid ? quote.amount : 0,
        commission: 0,
        payout: quote.amount,
      },
      ...(rooms?.length ? { rooms } : {}),
      ...(r.assignedUnitIds?.length ? { assignedUnitIds: r.assignedUnitIds } : {}),
      // The guest is the one already in the house: carry the stay's cleaning
      // rhythm over the added nights instead of the listing default.
      ...(r.cleaningSchedule ? { cleaningSchedule: { ...r.cleaningSchedule, startDate: from } } : {}),
      bookingNote: before
        ? `Early arrival for ${r.channel} reservation ${r.id}.`
        : `Extension of ${r.channel} reservation ${r.id}.`,
      extensionOf: r.id,
      // One guest stay, one status (see `statusGroupIds`).
      status: r.status,
    }
    const created = createReservation(draft)
    if (!created.success || !created.id)
      return { success: false, error: 'Could not create the extension booking.' }
    const linkedId = created.id

    const extension = before
      ? buildExtension(r, direction, to, from, quote, input.payment, linkedId)
      : buildExtension(r, direction, from, to, quote, input.payment, linkedId)
    const nightsLabel = `${quote.extraNights} night${quote.extraNights === 1 ? '' : 's'}`
    const parentEvent = activityEvent(
      'extend',
      before ? 'Early arrival' : 'Stay extended',
      `${nightsLabel} added from ${from} to ${to} as direct booking ${linkedId}, the ${r.channel} reservation is unchanged · ${moneyLabel(quote.amount, r.currency)}${paid ? '' : ' (payment pending)'}`,
    )
    const linkedEvent = activityEvent(
      'extension-of',
      before ? 'Created as an early arrival' : 'Created as an extension',
      `${nightsLabel} ${before ? 'before' : 'added to'} ${r.channel} reservation ${r.id}`,
    )

    reservations.value = reservations.value.map((x) => {
      if (x.id === id)
        return { ...x, extensions: [...(x.extensions ?? []), extension], activity: [...x.activity, parentEvent] }
      if (x.id === linkedId)
        return { ...x, activity: [...x.activity, linkedEvent] }
      return x
    })
    return { success: true, extensionId: extension.id, linkedReservationId: linkedId }
  }

  /**
   * Records the money for a pending extension: guestPaid moves on the stay
   * that was billed (the linked booking for an OTA extension).
   */
  function markExtensionPaid(id: string, extensionId: string): boolean {
    const r = reservations.value.find(x => x.id === id)
    const ext = r?.extensions?.find(e => e.id === extensionId)
    if (!r || !ext || ext.paymentStatus === 'paid' || !isActiveExtension(ext))
      return false
    const billedId = ext.linkedReservationId ?? r.id
    const paidAt = new Date().toISOString()
    const event = activityEvent('extension-paid', 'Extension paid', `${moneyLabel(ext.amount, ext.currency)} for ${ext.extraNights} added night${ext.extraNights === 1 ? '' : 's'}`)
    reservations.value = reservations.value.map((x) => {
      let next = x
      if (x.id === id) {
        next = {
          ...next,
          extensions: (next.extensions ?? []).map(e => e.id === extensionId ? { ...e, paymentStatus: 'paid' as const, paidAt } : e),
          activity: [...next.activity, event],
        }
      }
      if (x.id === billedId && next.priceDetails)
        next = { ...next, priceDetails: { ...next.priceDetails, guestPaid: roundForCurrency(next.priceDetails.guestPaid + ext.amount, next.currency) } }
      return next
    })
    return true
  }

  function reset() {
    reservations.value = initialReservations.map(r => ({ ...r }))
    guests.value = initialGuests.map(g => ({ ...g }))
    filters.value = { search: '', status: 'all', listings: [], dateFrom: '', dateTo: '', dateBasis: 'stay', extension: 'all' }
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
    saveGuestDocument,
    removeGuestDocument,
    getUnitConflicts,
    assignRoom,
    unassignRoom,
    getConflictedUnitIds,
    getCheckInTime,
    getListingCheckInTime,
    getCheckOutTime,
    getListingCheckOutTime,
    updateReservationTimes,
    defaultNightlyRate,
    quoteExtension,
    getExtensionConflicts,
    extensionStart,
    earlyArrivalEnd,
    extensionRange,
    extendReservation,
    extendViaLinkedBooking,
    markExtensionPaid,
    canCancelExtension,
    cancelExtension,
    markExtensionRefunded,
    reset,
  }
}
