// Owner stay approval flow — the "Book My Stay" submission path (Flow 4 / PRD 5.2).
//
// When an owner submits a stay request from the portal, the booking mode
// decides the path:
//   - mode 'direct'  → the stay is created immediately (subject to quota).
//   - mode 'request' → the stay lands in the GM/Admin approval queue as
//     `pending_approval`.
//
// Seasonal quotas (non-accumulating windows) block direct bookings that
// exceed a window's remaining nights and warn request-mode bookings.
//
// Approving promotes the stay to `active` and provisions downstream
// operations (cleaning jobs + smart-lock code via `useOwnerStayOperations`).
// Rejecting records a reason that the owner sees in the portal.

import type { AlertType } from '~/components/notifications/data/alerts'
import type { QuotaCheckResult } from '~/components/owners/data/owner-quotas'
import type { OwnerStayApprovalRequest } from '~/components/owners/data/owner-stay-approvals'
import type { OwnerStay } from '~/components/owners/data/owner-stays'
import { mockOwnerStayApprovals } from '~/components/owners/data/owner-stay-approvals'
import { useNotifications } from '~/composables/useNotifications'
import { useOwnerQuotas } from '~/composables/useOwnerQuotas'
import { useOwnerStayOperations } from '~/composables/useOwnerStayOperations'
import { useOwnerStays } from '~/composables/useOwnerStays'
import { useReservationsModule } from '~/composables/useReservationsModule'

export interface OwnerStayRequestInput {
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
  guestReservations?: Array<{ id: string, listingId: string, unitId?: string, checkIn: string, checkOut: string, status?: string | number }>
  blockedDates?: Array<string | { id?: string, listingId?: string, unitId?: string, startDate?: string, endDate?: string, date?: string }>
}

export type OwnerStayRequestResult
  = | { ok: true, stay: OwnerStay, requiredApproval: boolean, autoApproved: boolean, requestId?: string }
    | { ok: false, reason: 'conflict' | 'invalid_dates' | 'quota_exceeded' | 'annual_cap_exceeded', conflicts?: unknown[], quota?: QuotaCheckResult }

export type DecideStayApprovalResult
  = | { ok: true, stay: OwnerStay }
    | { ok: false, reason: 'not_found' | 'already_decided' }

function clone<T>(value: T): T {
  return structuredClone(value)
}

function nowIso(): string {
  return new Date().toISOString()
}

function deriveUniqueId(prefix: string, isTaken: (id: string) => boolean): string {
  let id = ''
  do {
    id = `${prefix}-${globalThis.crypto.randomUUID()}`
  } while (isTaken(id))
  return id
}

type OwnerStayApprovalAlertType
  = | 'OWNER_STAY_REQUESTED'
    | 'OWNER_STAY_REJECTED'

function emitApprovalAlert(
  type: OwnerStayApprovalAlertType,
  severity: 'INFO' | 'WARNING',
  context: Record<string, unknown>,
): void {
  useNotifications().createAlert(type as AlertType, severity, context)
}

export function useOwnerStayApprovals() {
  const requests = useState<OwnerStayApprovalRequest[]>(
    'elev8-owner-stay-approvals',
    () => clone(mockOwnerStayApprovals),
  )
  const { createStay, detectConflicts, getCapWarning } = useOwnerStays()
  const { provisionOwnerStayOperations } = useOwnerStayOperations()
  const { getBookingMode, checkQuota } = useOwnerQuotas()
  const { createReservation } = useReservationsModule()

  /**
   * Mirror a pending owner stay request into the Reservations module as an
   * `owner_request` reservation (PRD 5.4.2) so staff see it in Reservations
   * and the Cockpit queue.
   */
  function syncOwnerRequestReservation(stay: OwnerStay, listingName: string): string | undefined {
    const result = createReservation({
      guestName: stay.guestName,
      guestEmail: '',
      guestPhone: '',
      guestLanguage: 'en',
      guestNotes: '',
      listingId: stay.listingId,
      listingName,
      channel: 'Direct',
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      nights: stay.nights,
      guestCount: stay.guestCount ?? 1,
      totalPrice: 0,
      currency: 'IDR',
      status: 'owner_request',
      blockReason: 'Owner stay — pending approval',
      bookingNote: `Owner request ${stay.id}`,
    })
    return result.id
  }

  function requestIdTaken(id: string): boolean {
    return requests.value.some(r => r.id === id)
  }

  /**
   * Submit an owner stay request from the portal (PRD 5.2).
   *
   * Booking mode decides the path:
   *   - 'direct' → create stay immediately (active), subject to seasonal quota.
   *   - 'request' → create stay pending_approval + queue row for GM/Admin.
   *
   * Seasonal quota windows are checked first: a direct booking that would
   * exceed a window's remaining nights is blocked; a request-mode booking
   * is still queued (staff decides).
   */
  function requestStay(input: OwnerStayRequestInput): OwnerStayRequestResult {
    const conflictResult = detectConflicts({
      listingId: input.listingId,
      unitId: input.unitId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guestReservations: input.guestReservations,
      blockedDates: input.blockedDates,
    })
    if (conflictResult.length > 0)
      return { ok: false, reason: 'conflict', conflicts: conflictResult }

    const mode = getBookingMode(input.ownerId, input.listingId)
    const quota = checkQuota(input.ownerId, input.listingId, input.checkIn, input.checkOut)

    // Direct mode: annual use cap exceeded blocks the booking outright.
    // `annualCap` is the per-owner cap (0 / absent = no cap). We only
    // enforce a finite cap — no cap means the owner can stay freely.
    const annualCap = input.annualCap && input.annualCap > 0 ? input.annualCap : null
    if (mode === 'direct' && annualCap) {
      const capWarning = getCapWarning(input.ownerId, input.checkIn, input.checkOut, annualCap)
      if (capWarning.exceeds)
        return { ok: false, reason: 'annual_cap_exceeded' }
    }

    // Direct mode: quota exceeded blocks the booking outright.
    if (mode === 'direct' && quota.exceeded)
      return { ok: false, reason: 'quota_exceeded', quota }

    // Request mode: quota is advisory — the request still queues, staff decides.
    const timestamp = nowIso()

    if (mode === 'direct') {
      const result = createStay({
        ownerId: input.ownerId,
        listingId: input.listingId,
        unitId: input.unitId,
        guestName: input.guestName,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guestCount: input.guestCount,
        countsAgainstOwnerUseCap: input.countsAgainstOwnerUseCap,
        notes: input.notes,
        annualCap: input.annualCap,
        source: 'owner_request',
        status: 'active',
        guestReservations: input.guestReservations,
        blockedDates: input.blockedDates,
      })
      if (!result.ok)
        return result
      // Provision ops for direct bookings too (Flow 5).
      void provisionOwnerStayOperations(result.stay)
      return { ok: true, stay: result.stay, requiredApproval: false, autoApproved: true }
    }

    // Request mode — manual approval queue.
    const stayResult = createStay({
      ownerId: input.ownerId,
      listingId: input.listingId,
      unitId: input.unitId,
      guestName: input.guestName,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guestCount: input.guestCount,
      countsAgainstOwnerUseCap: input.countsAgainstOwnerUseCap,
      notes: input.notes,
      annualCap: input.annualCap,
      source: 'owner_request',
      status: 'pending_approval',
      guestReservations: input.guestReservations,
      blockedDates: input.blockedDates,
    })
    if (!stayResult.ok)
      return stayResult

    const request: OwnerStayApprovalRequest = {
      id: deriveUniqueId('osa', requestIdTaken),
      stayId: stayResult.stay.id,
      ownerId: input.ownerId,
      listingId: input.listingId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights: stayResult.stay.nights,
      guestCount: input.guestCount,
      reason: input.notes,
      requestedAt: timestamp,
      status: 'pending',
    }
    requests.value = [...requests.value, request]

    // PRD 5.4.2 — mirror the request into Reservations with an owner_request status.
    syncOwnerRequestReservation(stayResult.stay, input.listingId)

    emitApprovalAlert('OWNER_STAY_REQUESTED', 'WARNING', {
      requestId: request.id,
      stayId: stayResult.stay.id,
      ownerId: input.ownerId,
      listingId: input.listingId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guestCount: input.guestCount,
    })

    return { ok: true, stay: stayResult.stay, requiredApproval: true, autoApproved: false, requestId: request.id }
  }

  /** GM/Admin approves a pending request → stay active + downstream ops. */
  function approveRequest(requestId: string, decidedBy: string): DecideStayApprovalResult {
    const request = requests.value.find(r => r.id === requestId)
    if (!request)
      return { ok: false, reason: 'not_found' }
    if (request.status !== 'pending')
      return { ok: false, reason: 'already_decided' }

    const timestamp = nowIso()
    const { updateStayStatus } = useOwnerStayOperations()
    const result = updateStayStatus(request.stayId, 'active', { decidedBy, decidedAt: timestamp })

    // Flip the mirrored reservation to a confirmed block (PRD 5.4.2).
    const { reservations } = useReservationsModule()
    reservations.value = reservations.value.map(r =>
      r.bookingNote === `Owner request ${request.stayId}` ? { ...r, status: 'verified' } : r)

    requests.value = requests.value.map(r => r.id === requestId
      ? { ...r, status: 'approved' as const, decidedBy, decidedAt: timestamp }
      : r)

    return { ok: true, stay: result.stay }
  }

  /** GM/Admin rejects a pending request → stay rejected with a reason for the owner. */
  function rejectRequest(requestId: string, decidedBy: string, reason: string): DecideStayApprovalResult {
    const request = requests.value.find(r => r.id === requestId)
    if (!request)
      return { ok: false, reason: 'not_found' }
    if (request.status !== 'pending')
      return { ok: false, reason: 'already_decided' }

    const timestamp = nowIso()
    const { updateStayStatus } = useOwnerStayOperations()
    const result = updateStayStatus(request.stayId, 'rejected', { decidedBy, decidedAt: timestamp, reason })

    // Mirror the rejection onto the reservation (PRD 5.4.2).
    const { reservations } = useReservationsModule()
    reservations.value = reservations.value.map(r =>
      r.bookingNote === `Owner request ${request.stayId}` ? { ...r, status: 'cancelled' } : r)

    requests.value = requests.value.map(r => r.id === requestId
      ? { ...r, status: 'rejected' as const, decidedBy, decidedAt: timestamp, decisionReason: reason }
      : r)

    emitApprovalAlert('OWNER_STAY_REJECTED', 'INFO', {
      stayId: request.stayId,
      ownerId: request.ownerId,
      listingId: request.listingId,
      checkIn: request.checkIn,
      checkOut: request.checkOut,
      reason,
    })

    return { ok: true, stay: result.stay }
  }

  const pendingRequests = computed(() => requests.value
    .filter(r => r.status === 'pending')
    .slice()
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)))

  return {
    requests,
    pendingRequests,
    requestStay,
    approveRequest,
    rejectRequest,
  }
}
