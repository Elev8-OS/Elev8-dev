import type { AlertType } from '~/components/notifications/data/alerts'
import type {
  OwnerStay,
  OwnerStayCancelRequest,
  OwnerStaySource,
  OwnerStayStatus,
  OwnerStaySyncState,
  OwnerStaySyncTarget,
} from '~/components/owners/data/owner-stays'
import type { ReservationStatus } from '~/components/reservations/data/reservations'
import { CANCEL_CUTOFF_HOURS, mockOwnerStays } from '~/components/owners/data/owner-stays'
import { useNotifications } from '~/composables/useNotifications'
import { useReservationsModule } from '~/composables/useReservationsModule'

export type OwnerStayConflictType = 'guest_reservation' | 'blocked_date' | 'owner_stay'

export interface GuestReservationConflictInput {
  id: string
  listingId: string
  unitId?: string
  checkIn: string
  checkOut: string
  status?: string | number
}

export interface BlockedDateConflictInput {
  id?: string
  listingId?: string
  unitId?: string
  startDate?: string
  endDate?: string
  date?: string
}

export interface OwnerStayConflict {
  type: OwnerStayConflictType
  id: string
  listingId: string
  unitId?: string
  checkIn: string
  checkOut: string
  start: string
  end: string
  source: 'guest_reservation' | 'blocked_date' | 'owner_stay'
}

export interface DetectConflictsInput {
  listingId: string
  unitId?: string
  checkIn: string
  checkOut: string
  guestReservations?: GuestReservationConflictInput[]
  /** Alias accepted for callers that already call these records reservations. */
  reservations?: GuestReservationConflictInput[]
  blockedDates?: Array<string | BlockedDateConflictInput>
  excludeStayId?: string
}

export interface OwnerStaySyncOptions {
  syncFailureTargets?: OwnerStaySyncTarget[]
}

export interface OwnerStayCreateInput extends OwnerStaySyncOptions {
  ownerId: string
  listingId: string
  unitId?: string
  guestName: string
  checkIn: string
  checkOut: string
  guestCount?: number
  countsAgainstOwnerUseCap?: boolean
  notes?: string
  annualCap?: number
  /** How the stay was created — portal requests are approval-gated, staff blocks are direct. */
  source?: OwnerStaySource
  /** Initial status — defaults to 'active' (direct create). Approval flow passes 'pending_approval'. */
  status?: OwnerStayStatus
  reservationId?: string
  guestReservations?: GuestReservationConflictInput[]
  reservations?: GuestReservationConflictInput[]
  blockedDates?: Array<string | BlockedDateConflictInput>
}

export interface OwnerStayUpdateInput extends OwnerStaySyncOptions {
  ownerId?: string
  listingId?: string
  unitId?: string | null
  guestName?: string
  checkIn?: string
  checkOut?: string
  guestCount?: number
  countsAgainstOwnerUseCap?: boolean
  notes?: string | null
  annualCap?: number
  guestReservations?: GuestReservationConflictInput[]
  reservations?: GuestReservationConflictInput[]
  blockedDates?: Array<string | BlockedDateConflictInput>
}

export interface OwnerUseCapWarning {
  exceeds: boolean
  ownerId: string
  year: number
  usedNights: number
  requestedNights: number
  projectedNights: number
  cap: number
}

export type CreateOwnerStayResult
  = | { ok: true, stay: OwnerStay, capWarning?: OwnerUseCapWarning }
    | { ok: false, reason: 'conflict' | 'invalid_dates', conflicts?: OwnerStayConflict[] }

export type UpdateOwnerStayResult
  = | { ok: true, stay: OwnerStay, capWarning?: OwnerUseCapWarning }
    | { ok: false, reason: 'not_found' | 'conflict' | 'invalid_dates', conflicts?: OwnerStayConflict[] }

export type CancelOwnerStayResult
  = | { ok: true }
    | { ok: false, reason: 'not_found' | 'already_cancelled' | 'pending_approval' }

export type DecideCancelRequestResult
  = | { ok: true }
    | { ok: false, reason: 'not_found' | 'no_cancel_request' | 'already_decided' }

export type RetryOwnerStaySyncResult
  = | { ok: true }
    | { ok: false, reason: 'not_found' | 'invalid_target' }

export const DEFAULT_ANNUAL_OWNER_USE_CAP = 30
const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

export function hoursUntilCheckIn(checkIn: string): number {
  const checkInMs = Date.parse(`${checkIn}T00:00:00Z`)
  if (!Number.isFinite(checkInMs))
    return Number.POSITIVE_INFINITY
  return Math.round((checkInMs - Date.now()) / HOUR_MS)
}

/** True when the stay is within the cancellation window (≤ cutoff hours before check-in). */
export function isWithinCancelWindow(checkIn: string): boolean {
  return hoursUntilCheckIn(checkIn) <= CANCEL_CUTOFF_HOURS
}

interface DateRange {
  checkIn: string
  checkOut: string
}

export function dateRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

export function countNights(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00Z`)
  const end = Date.parse(`${checkOut}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end))
    return 0
  return Math.max(0, Math.round((end - start) / DAY_MS))
}

function nowIso(): string {
  return new Date().toISOString()
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function hasValidDateRange(range: DateRange): boolean {
  return Boolean(range.checkIn && range.checkOut)
    && countNights(range.checkIn, range.checkOut) > 0
}

function recordsShareScope(
  requestedListingId: string,
  requestedUnitId: string | undefined,
  recordListingId: string | undefined,
  recordUnitId: string | undefined,
): boolean {
  if (recordListingId && recordListingId !== requestedListingId)
    return false
  if (!recordListingId)
    return false
  if (requestedUnitId && recordUnitId && requestedUnitId !== recordUnitId)
    return false
  return true
}

function isCancelled(status: string | number | undefined): boolean {
  if (status === 2)
    return true
  if (typeof status !== 'string')
    return false
  const normalized = status.trim().toLowerCase()
  return normalized === 'cancelled' || normalized === 'canceled'
}

function blockedDateRange(
  entry: string | BlockedDateConflictInput,
): { start: string, end: string, id: string, listingId?: string, unitId?: string } | null {
  if (typeof entry === 'string') {
    return { start: entry, end: nextDate(entry), id: `blocked-${entry}` }
  }

  const start = entry.startDate ?? entry.date
  if (!start)
    return null
  const end = entry.endDate && entry.endDate !== start ? entry.endDate : nextDate(start)
  return {
    start,
    end,
    id: entry.id ?? `blocked-${start}-${end}`,
    listingId: entry.listingId,
    unitId: entry.unitId,
  }
}

function nextDate(date: string): string {
  const timestamp = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(timestamp))
    return date
  return new Date(timestamp + DAY_MS).toISOString().slice(0, 10)
}

function syncStateFor(failures: OwnerStaySyncTarget[] = []): Record<OwnerStaySyncTarget, OwnerStaySyncState> {
  return {
    cockpit: failures.includes('cockpit') ? 'failed' : 'synced',
    channex: failures.includes('channex') ? 'failed' : 'synced',
    notifications: failures.includes('notifications') ? 'failed' : 'synced',
  }
}

type OwnerStayAlertType
  = | 'OWNER_STAY_CONFIRMED'
    | 'OWNER_STAY_CONFLICT'
    | 'OWNER_STAY_CANCELLED'
    | 'OWNER_USE_CAP_EXCEEDED'

function emitOwnerStayAlert(
  type: OwnerStayAlertType,
  severity: 'INFO' | 'WARNING' | 'CRITICAL',
  context: Record<string, unknown>,
): void {
  useNotifications().createAlert(type as AlertType, severity, context)
}

export function useOwnerStays() {
  const stays = useState<OwnerStay[]>('elev8-owner-stays', () => clone(mockOwnerStays))

  /**
   * Every owner stay is mirrored into the Reservations module so staff see
   * owner-occupied dates on the Reservations page alongside guest bookings.
   * The link is `OwnerStay.reservationId`; `bookingNote` is kept as a
   * fallback match for stays seeded before the id was stored.
   */
  function ownerStayBookingNote(stayId: string): string {
    return `Owner request ${stayId}`
  }

  /**
   * Resolve the owner stay behind a reservation row. Prefers the stored
   * `reservationId` link and falls back to the `bookingNote` marker, mirroring
   * how `setMirroredReservationStatus` matches in the other direction.
   */
  function stayForReservation(
    reservationId: string,
    bookingNote?: string,
  ): OwnerStay | undefined {
    const byId = stays.value.find(stay => stay.reservationId === reservationId)
    if (byId)
      return byId
    if (!bookingNote?.startsWith('Owner request '))
      return undefined
    const stayId = bookingNote.slice('Owner request '.length).trim()
    return stays.value.find(stay => stay.id === stayId)
  }

  /** Attach the mirrored reservation id to a stay (one-way, id is never reused). */
  function linkReservation(stayId: string, reservationId: string | undefined): void {
    if (!reservationId)
      return
    stays.value = stays.value.map(stay => stay.id === stayId
      ? { ...stay, reservationId, updatedAt: nowIso() }
      : stay)
  }

  /**
   * Move the mirrored reservation of a stay to `status`. Matches on the
   * stored `reservationId` first and falls back to the `bookingNote`
   * marker, so pre-existing rows keep working.
   */
  function setMirroredReservationStatus(
    stay: Pick<OwnerStay, 'id' | 'reservationId'>,
    status: ReservationStatus,
    blockReason?: string,
  ): void {
    const { reservations } = useReservationsModule()
    const note = ownerStayBookingNote(stay.id)
    reservations.value = reservations.value.map(reservation =>
      reservation.id === stay.reservationId || reservation.bookingNote === note
        ? { ...reservation, status, ...(blockReason ? { blockReason } : {}) }
        : reservation)
  }

  function detectConflicts(input: DetectConflictsInput): OwnerStayConflict[] {
    if (!hasValidDateRange(input))
      return []

    const conflicts: OwnerStayConflict[] = []
    const reservations = input.guestReservations ?? input.reservations ?? []

    for (const reservation of reservations) {
      if (isCancelled(reservation.status))
        continue
      if (!recordsShareScope(input.listingId, input.unitId, reservation.listingId, reservation.unitId))
        continue
      if (!dateRangesOverlap(input.checkIn, input.checkOut, reservation.checkIn, reservation.checkOut))
        continue
      conflicts.push({
        type: 'guest_reservation',
        source: 'guest_reservation',
        id: reservation.id,
        listingId: reservation.listingId,
        unitId: reservation.unitId,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        start: reservation.checkIn,
        end: reservation.checkOut,
      })
    }

    for (const blocked of input.blockedDates ?? []) {
      const range = blockedDateRange(blocked)
      if (!range || !recordsShareScope(input.listingId, input.unitId, range.listingId ?? input.listingId, range.unitId))
        continue
      if (!dateRangesOverlap(input.checkIn, input.checkOut, range.start, range.end))
        continue
      conflicts.push({
        type: 'blocked_date',
        source: 'blocked_date',
        id: range.id,
        listingId: range.listingId ?? input.listingId,
        unitId: range.unitId,
        checkIn: range.start,
        checkOut: range.end,
        start: range.start,
        end: range.end,
      })
    }

    for (const stay of stays.value) {
      if (stay.status !== 'active' || stay.id === input.excludeStayId)
        continue
      if (!recordsShareScope(input.listingId, input.unitId, stay.listingId, stay.unitId))
        continue
      if (!dateRangesOverlap(input.checkIn, input.checkOut, stay.checkIn, stay.checkOut))
        continue
      conflicts.push({
        type: 'owner_stay',
        source: 'owner_stay',
        id: stay.id,
        listingId: stay.listingId,
        unitId: stay.unitId,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        start: stay.checkIn,
        end: stay.checkOut,
      })
    }

    return conflicts
  }

  function ownerUseNightsForYear(ownerId: string, year: number, excludeStayId?: string): number {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year + 1}-01-01`
    return stays.value
      .filter(stay => stay.ownerId === ownerId
        && stay.status === 'active'
        && stay.countsAgainstOwnerUseCap
        && stay.id !== excludeStayId
        && dateRangesOverlap(stay.checkIn, stay.checkOut, yearStart, yearEnd))
      .reduce((total, stay) => {
        const overlapStart = stay.checkIn > yearStart ? stay.checkIn : yearStart
        const overlapEnd = stay.checkOut < yearEnd ? stay.checkOut : yearEnd
        return total + countNights(overlapStart, overlapEnd)
      }, 0)
  }

  function getCapWarning(
    ownerId: string,
    checkIn: string,
    checkOut: string,
    cap = DEFAULT_ANNUAL_OWNER_USE_CAP,
    excludeStayId?: string,
  ): OwnerUseCapWarning {
    const warnings: OwnerUseCapWarning[] = []
    let segmentStart = checkIn

    while (segmentStart < checkOut) {
      const year = Number(segmentStart.slice(0, 4))
      if (!Number.isFinite(year))
        break

      const yearEnd = `${year + 1}-01-01`
      const segmentEnd = checkOut < yearEnd ? checkOut : yearEnd
      const requestedNights = countNights(segmentStart, segmentEnd)
      const usedNights = ownerUseNightsForYear(ownerId, year, excludeStayId)
      const projectedNights = usedNights + requestedNights
      warnings.push({
        exceeds: projectedNights > cap,
        ownerId,
        year,
        usedNights,
        requestedNights,
        projectedNights,
        cap,
      })
      segmentStart = segmentEnd
    }

    const exceededWarning = warnings.find(warning => warning.exceeds)
    if (exceededWarning)
      return exceededWarning
    if (warnings[0])
      return warnings[0]

    const year = Number(checkIn.slice(0, 4))
    const usedNights = ownerUseNightsForYear(ownerId, year, excludeStayId)
    return {
      exceeds: usedNights > cap,
      ownerId,
      year,
      usedNights,
      requestedNights: 0,
      projectedNights: usedNights,
      cap,
    }
  }

  function createStay(input: OwnerStayCreateInput): CreateOwnerStayResult {
    if (!hasValidDateRange(input))
      return { ok: false, reason: 'invalid_dates' }

    const conflicts = detectConflicts(input)
    if (conflicts.length > 0) {
      emitOwnerStayAlert('OWNER_STAY_CONFLICT', 'CRITICAL', {
        ownerId: input.ownerId,
        listingId: input.listingId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        conflicts,
      })
      return { ok: false, reason: 'conflict', conflicts }
    }

    const timestamp = nowIso()
    const syncState = syncStateFor(input.syncFailureTargets)
    const stay: OwnerStay = {
      id: `ost-${globalThis.crypto.randomUUID()}`,
      ownerId: input.ownerId,
      listingId: input.listingId,
      unitId: input.unitId,
      guestName: input.guestName,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights: countNights(input.checkIn, input.checkOut),
      guestCount: input.guestCount,
      countsAgainstOwnerUseCap: input.countsAgainstOwnerUseCap ?? true,
      status: input.status ?? 'active',
      source: input.source ?? 'owner_request',
      reservationId: input.reservationId,
      notes: input.notes,
      syncState,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    stays.value = [...stays.value, stay]

    // Only fully-confirmed stays fire the confirmation notification; pending
    // ones are notified by the approval flow (OWNER_STAY_REQUESTED).
    if (stay.status === 'active') {
      emitOwnerStayAlert('OWNER_STAY_CONFIRMED', 'INFO', {
        stayId: stay.id,
        ownerId: stay.ownerId,
        listingId: stay.listingId,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
      })
    }

    const capWarning = stay.countsAgainstOwnerUseCap
      ? getCapWarning(stay.ownerId, stay.checkIn, stay.checkOut, input.annualCap ?? DEFAULT_ANNUAL_OWNER_USE_CAP, stay.id)
      : undefined
    if (capWarning?.exceeds) {
      emitOwnerStayAlert('OWNER_USE_CAP_EXCEEDED', 'WARNING', {
        stayId: stay.id,
        ...capWarning,
        ownerId: stay.ownerId,
      })
    }

    return { ok: true, stay, ...(capWarning ? { capWarning } : {}) }
  }

  function updateStay(stayId: string, input: OwnerStayUpdateInput): UpdateOwnerStayResult {
    const current = stays.value.find(stay => stay.id === stayId)
    if (!current)
      return { ok: false, reason: 'not_found' }
    // Only fully-confirmed stays are directly editable by the owner; pending
    // ones are amended via the approval request, rejected/cancelled are frozen.
    if (current.status !== 'active')
      return { ok: false, reason: 'not_found' }

    const candidate: OwnerStay = {
      ...current,
      ownerId: input.ownerId ?? current.ownerId,
      listingId: input.listingId ?? current.listingId,
      unitId: input.unitId === null ? undefined : input.unitId ?? current.unitId,
      guestName: input.guestName ?? current.guestName,
      checkIn: input.checkIn ?? current.checkIn,
      checkOut: input.checkOut ?? current.checkOut,
      guestCount: input.guestCount ?? current.guestCount,
      countsAgainstOwnerUseCap: input.countsAgainstOwnerUseCap ?? current.countsAgainstOwnerUseCap,
      notes: input.notes === null ? undefined : input.notes ?? current.notes,
      id: current.id,
      status: current.status,
      syncState: current.syncState,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
    }
    if (!hasValidDateRange(candidate))
      return { ok: false, reason: 'invalid_dates' }

    const conflicts = detectConflicts({
      listingId: candidate.listingId,
      unitId: candidate.unitId,
      checkIn: candidate.checkIn,
      checkOut: candidate.checkOut,
      guestReservations: input.guestReservations,
      reservations: input.reservations,
      blockedDates: input.blockedDates,
      excludeStayId: stayId,
    })
    if (conflicts.length > 0) {
      emitOwnerStayAlert('OWNER_STAY_CONFLICT', 'CRITICAL', {
        stayId,
        ownerId: candidate.ownerId,
        listingId: candidate.listingId,
        checkIn: candidate.checkIn,
        checkOut: candidate.checkOut,
        conflicts,
      })
      return { ok: false, reason: 'conflict', conflicts }
    }

    const syncState = syncStateFor(input.syncFailureTargets)
    const updated: OwnerStay = {
      ...candidate,
      nights: countNights(candidate.checkIn, candidate.checkOut),
      syncState,
      updatedAt: nowIso(),
    }
    stays.value = stays.value.map(stay => stay.id === stayId ? updated : stay)
    emitOwnerStayAlert('OWNER_STAY_CONFIRMED', 'INFO', {
      stayId: updated.id,
      ownerId: updated.ownerId,
      listingId: updated.listingId,
      checkIn: updated.checkIn,
      checkOut: updated.checkOut,
      modified: true,
    })

    const capWarning = updated.countsAgainstOwnerUseCap
      ? getCapWarning(updated.ownerId, updated.checkIn, updated.checkOut, input.annualCap ?? DEFAULT_ANNUAL_OWNER_USE_CAP, updated.id)
      : undefined
    if (capWarning?.exceeds) {
      emitOwnerStayAlert('OWNER_USE_CAP_EXCEEDED', 'WARNING', {
        stayId: updated.id,
        ...capWarning,
        ownerId: updated.ownerId,
      })
    }
    return { ok: true, stay: updated, ...(capWarning ? { capWarning } : {}) }
  }

  /**
   * Cancel an owner stay (Flow 7).
   *
   * The owner can always cancel self-serve: the stay is cancelled
   * immediately, cleaning jobs are released and the smart-lock code is
   * revoked — no staff approval is required.
   */
  function cancelStay(
    stayId: string,
    cancellationReason?: string,
    options: OwnerStaySyncOptions = {},
  ): CancelOwnerStayResult {
    const current = stays.value.find(stay => stay.id === stayId)
    if (!current)
      return { ok: false, reason: 'not_found' }
    if (current.status === 'cancelled')
      return { ok: false, reason: 'already_cancelled' }
    if (current.status === 'pending_approval')
      return { ok: false, reason: 'pending_approval' }

    const timestamp = nowIso()

    // Immediate cancellation — no approval required.
    stays.value = stays.value.map(stay => stay.id === stayId
      ? {
          ...stay,
          status: 'cancelled' as OwnerStayStatus,
          cancelledAt: timestamp,
          cancellationReason,
          cancelRequest: undefined,
          syncState: syncStateFor(options.syncFailureTargets),
          updatedAt: timestamp,
        }
      : stay)
    // Release the mirrored reservation so cancelled owner dates stop
    // showing as occupied on the Reservations page.
    setMirroredReservationStatus(current, 'cancelled')
    emitOwnerStayAlert('OWNER_STAY_CANCELLED', 'WARNING', {
      stayId,
      ownerId: current.ownerId,
      listingId: current.listingId,
      checkIn: current.checkIn,
      checkOut: current.checkOut,
      requiresApproval: false,
    })
    return { ok: true }
  }

  /**
   * GM/Admin approves a pending cancellation request → the stay is cancelled
   * and downstream ops (cleaning + access code) are released.
   */
  function approveCancelRequest(stayId: string, decidedBy: string): DecideCancelRequestResult {
    const current = stays.value.find(stay => stay.id === stayId)
    if (!current)
      return { ok: false, reason: 'not_found' }
    if (!current.cancelRequest)
      return { ok: false, reason: 'no_cancel_request' }
    if (current.cancelRequest.status !== 'pending')
      return { ok: false, reason: 'already_decided' }

    const timestamp = nowIso()
    stays.value = stays.value.map(stay => stay.id === stayId
      ? {
          ...stay,
          status: 'cancelled' as OwnerStayStatus,
          cancelledAt: timestamp,
          cancellationReason: current.cancelRequest?.reason,
          cancelRequest: {
            ...(current.cancelRequest as OwnerStayCancelRequest),
            status: 'approved',
            decidedBy,
            decidedAt: timestamp,
          },
          updatedAt: timestamp,
        }
      : stay)
    return { ok: true }
  }

  /** GM/Admin denies a pending cancellation request → the stay stays active. */
  function denyCancelRequest(stayId: string, decidedBy: string): DecideCancelRequestResult {
    const current = stays.value.find(stay => stay.id === stayId)
    if (!current)
      return { ok: false, reason: 'not_found' }
    if (!current.cancelRequest)
      return { ok: false, reason: 'no_cancel_request' }
    if (current.cancelRequest.status !== 'pending')
      return { ok: false, reason: 'already_decided' }

    const timestamp = nowIso()
    stays.value = stays.value.map(stay => stay.id === stayId
      ? {
          ...stay,
          cancelRequest: {
            ...(current.cancelRequest as OwnerStayCancelRequest),
            status: 'denied',
            decidedBy,
            decidedAt: timestamp,
          },
          updatedAt: timestamp,
        }
      : stay)
    return { ok: true }
  }

  function retrySync(stayId: string, target: OwnerStaySyncTarget): RetryOwnerStaySyncResult {
    if (!['cockpit', 'channex', 'notifications'].includes(target))
      return { ok: false, reason: 'invalid_target' }
    const current = stays.value.find(stay => stay.id === stayId)
    if (!current)
      return { ok: false, reason: 'not_found' }

    stays.value = stays.value.map(stay => stay.id === stayId
      ? {
          ...stay,
          syncState: { ...stay.syncState, [target]: 'synced' },
          updatedAt: nowIso(),
        }
      : stay)
    return { ok: true }
  }

  return {
    stays,
    detectConflicts,
    createStay,
    updateStay,
    cancelStay,
    approveCancelRequest,
    denyCancelRequest,
    retrySync,
    ownerUseNightsForYear,
    getCapWarning,
    linkReservation,
    setMirroredReservationStatus,
    stayForReservation,
  }
}
