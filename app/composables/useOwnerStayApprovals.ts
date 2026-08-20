// Owner stay approval flow — the "Book My Stay" submission path (Flow 4).
//
// When an owner submits a stay request from the portal:
//   - Dates outside the listing's high season → auto-approved immediately.
//   - Dates overlapping high season (or flagged for revenue risk) → land in
//     the GM/Admin approval queue as `pending_approval`.
//
// Approving promotes the stay to `active` and provisions downstream
// operations (cleaning jobs + smart-lock code via `useOwnerStayOperations`).
// Rejecting records a reason that the owner sees in the portal.

import type { AlertType } from '~/components/notifications/data/alerts'
import type { OwnerStayApprovalRequest } from '~/components/owners/data/owner-stay-approvals'
import type { OwnerStay } from '~/components/owners/data/owner-stays'
import { isHighSeasonRange, mockOwnerStayApprovals } from '~/components/owners/data/owner-stay-approvals'
import { useNotifications } from '~/composables/useNotifications'
import { useOwnerStayOperations } from '~/composables/useOwnerStayOperations'
import { useOwnerStays } from '~/composables/useOwnerStays'

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
    | { ok: false, reason: 'conflict' | 'invalid_dates', conflicts?: unknown[] }

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
  const { createStay, detectConflicts } = useOwnerStays()
  const { provisionOwnerStayOperations } = useOwnerStayOperations()

  function requestIdTaken(id: string): boolean {
    return requests.value.some(r => r.id === id)
  }

  /**
   * Submit an owner stay request from the portal (Flow 4).
   *
   * Evaluates the auto-approval rule: dates fully outside high season
   * auto-approve; overlapping high-season dates go to the GM/Admin queue.
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

    const isHighSeason = isHighSeasonRange(input.listingId, input.checkIn, input.checkOut)
    const timestamp = nowIso()

    if (!isHighSeason) {
      // Rule A — auto-approve.
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
      // Provision ops for auto-approved stays too (Flow 5).
      void provisionOwnerStayOperations(result.stay)
      return { ok: true, stay: result.stay, requiredApproval: false, autoApproved: true }
    }

    // Rule B — manual approval queue.
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
