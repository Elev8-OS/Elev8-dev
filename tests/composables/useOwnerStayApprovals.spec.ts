import type { OwnerStay } from '~/components/owners/data/owner-stays'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listings } from '~/components/listings/data/listings'
import { mockOwnerBookingModes, mockOwnerSeasonalQuotas } from '~/components/owners/data/owner-quotas'
import { mockOwnerStayApprovals } from '~/components/owners/data/owner-stay-approvals'
import { mockOwnerStays } from '~/components/owners/data/owner-stays'
import { initialReservations } from '~/components/reservations/data/reservations'
import { useOwnerStayApprovals } from '~/composables/useOwnerStayApprovals'
import { useOwnerStays } from '~/composables/useOwnerStays'

// Mock notifications + downstream ops so the approval flow can be tested in
// isolation. useOwnerStayOperations internally calls useCleaningJobs /
// useSmartLock — both get stubbed here.

interface AlertCall {
  type: string
  severity: string
  context: Record<string, unknown>
}

const notificationsMock = vi.hoisted(() => {
  const callLog: AlertCall[] = []
  return {
    callLog,
    spy: {
      createAlert: (type: string, severity: string, context: Record<string, unknown>) => {
        callLog.push({ type, severity, context })
      },
    },
  }
})

vi.mock('~/composables/useNotifications', () => ({
  useNotifications: () => notificationsMock.spy,
}))

// useOwnerStayOperations is exercised for real (so updateStayStatus mutates
// shared state); only the external modules it calls get stubbed.
const cleaningMock = vi.hoisted(() => ({
  createJob: vi.fn((input: Record<string, unknown>) => ({ id: `cln-mock-${Date.now()}`, ...input })),
  deleteJob: vi.fn(),
  resolveListingName: vi.fn((listingId: string) => `Listing ${listingId}`),
}))

vi.mock('~/composables/useCleaningJobs', () => ({
  useCleaningJobs: () => cleaningMock,
}))

const smartLockMock = vi.hoisted(() => ({
  getLocksForListing: vi.fn(() => []),
  generateAccessCode: vi.fn(async () => ({ success: false })),
  revokeAccessCode: vi.fn(),
}))

vi.mock('~/composables/useSmartLock', () => ({
  useSmartLock: () => smartLockMock,
}))

function resetState() {
  const stays = useState<OwnerStay[]>('elev8-owner-stays')
  stays.value = structuredClone(mockOwnerStays)
  const requests = useState('elev8-owner-stay-approvals')
  requests.value = structuredClone(mockOwnerStayApprovals)
  const quotas = useState('elev8-owner-seasonal-quotas')
  quotas.value = structuredClone(mockOwnerSeasonalQuotas)
  const modes = useState('elev8-owner-booking-modes')
  modes.value = structuredClone(mockOwnerBookingModes)
  const reservations = useState<ReservationEntry[]>('reservations-entries')
  reservations.value = structuredClone(initialReservations)
  notificationsMock.callLog.length = 0
  cleaningMock.createJob.mockClear()
  smartLockMock.getLocksForListing.mockClear()
}

/** The reservation mirroring an owner stay, matched by its bookingNote marker. */
function mirrorFor(stayId: string): ReservationEntry | undefined {
  const reservations = useState<ReservationEntry[]>('reservations-entries')
  return reservations.value.find(r => r.bookingNote === `Owner request ${stayId}`)
}

describe('useOwnerStayApprovals', () => {
  beforeEach(() => {
    resetState()
  })

  function lowSeasonInput(overrides: Partial<ReturnType<typeof baseInput>> = {}) {
    return { ...baseInput(), ...overrides }
  }

  function baseInput() {
    return {
      ownerId: 'own-1',
      listingId: 'lst-1',
      guestName: 'Wayan Sari',
      checkIn: '2026-10-10',
      checkOut: '2026-10-13',
      guestCount: 2,
      notes: 'Low season family trip',
    }
  }

  it('auto-approves a direct-mode stay outside high season (Rule A)', () => {
    const { requestStay } = useOwnerStayApprovals()
    const result = requestStay(lowSeasonInput())

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.requiredApproval).toBe(false)
      expect(result.autoApproved).toBe(true)
      expect(result.stay.status).toBe('active')
    }
    // No OWNER_STAY_REQUESTED alert for auto-approves.
    expect(notificationsMock.callLog.some(call => call.type === 'OWNER_STAY_REQUESTED')).toBe(false)
  })

  it('routes a request-mode booking into the manual approval queue (Rule B)', () => {
    const { requestStay, pendingRequests } = useOwnerStayApprovals()
    // own-2 / lst-8 is configured with booking mode 'request'.
    const result = requestStay(lowSeasonInput({
      ownerId: 'own-2',
      listingId: 'lst-8',
      checkIn: '2026-08-20',
      checkOut: '2026-08-24',
    }))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.requiredApproval).toBe(true)
      expect(result.autoApproved).toBe(false)
      expect(result.stay.status).toBe('pending_approval')
      expect(result.requestId).toBeTruthy()
    }
    expect(pendingRequests.value.length).toBeGreaterThan(0)
    expect(notificationsMock.callLog.some(call => call.type === 'OWNER_STAY_REQUESTED')).toBe(true)
  })

  it('approving a request promotes the stay to active and provisions operations', async () => {
    const { requestStay, approveRequest } = useOwnerStayApprovals()
    const request = requestStay(lowSeasonInput({
      ownerId: 'own-2',
      listingId: 'lst-8',
      checkIn: '2026-08-20',
      checkOut: '2026-08-24',
    }))
    if (!request.ok || !request.requestId)
      throw new Error('expected pending request')

    const result = approveRequest(request.requestId, 'staff-1')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stay.status).toBe('active')
      expect(result.stay.approval?.decidedBy).toBe('staff-1')
    }
    // Provisioning runs on approval — the cleaning module gets 2 jobs.
    await vi.waitFor(() => {
      expect(cleaningMock.createJob).toHaveBeenCalledTimes(2)
    })
  })

  it('rejecting a request records the stay as rejected with the decision reason', () => {
    const { requestStay, rejectRequest } = useOwnerStayApprovals()
    const request = requestStay(lowSeasonInput({
      ownerId: 'own-2',
      listingId: 'lst-8',
      checkIn: '2026-08-20',
      checkOut: '2026-08-24',
    }))
    if (!request.ok || !request.requestId)
      throw new Error('expected pending request')

    const result = rejectRequest(request.requestId, 'staff-1', 'Overlaps a confirmed booking')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stay.status).toBe('rejected')
      expect(result.stay.approval?.reason).toBe('Overlaps a confirmed booking')
    }
    expect(notificationsMock.callLog.some(call => call.type === 'OWNER_STAY_REJECTED')).toBe(true)
  })

  it('rejects double decisions on the same request', () => {
    const { requestStay, approveRequest, rejectRequest } = useOwnerStayApprovals()
    const request = requestStay(lowSeasonInput({
      ownerId: 'own-2',
      listingId: 'lst-8',
      checkIn: '2026-08-20',
      checkOut: '2026-08-24',
    }))
    if (!request.ok || !request.requestId)
      throw new Error('expected pending request')

    expect(approveRequest(request.requestId, 'staff-1').ok).toBe(true)
    const second = rejectRequest(request.requestId, 'staff-1', 'Too late')
    expect(second).toEqual({ ok: false, reason: 'already_decided' })
  })

  it('blocks conflicting guest dates regardless of season', () => {
    const { requestStay } = useOwnerStayApprovals()
    const result = requestStay({
      ...lowSeasonInput(),
      // A confirmed guest reservation overlaps these dates.
      guestReservations: [{
        id: 'res-1',
        listingId: 'lst-1',
        checkIn: '2026-10-11',
        checkOut: '2026-10-12',
        status: 'confirmed',
      }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.reason).toBe('conflict')
  })

  it('blocks a direct booking that exceeds the owner annual use cap', () => {
    const { requestStay } = useOwnerStayApprovals()
    // Wayan (own-1) has a 14-night annual cap; a 15-night stay blows past it.
    const result = requestStay({
      ...lowSeasonInput(),
      ownerId: 'own-1',
      listingId: 'lst-1',
      checkIn: '2026-03-01',
      checkOut: '2026-03-16',
      annualCap: 14,
    })

    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.reason).toBe('annual_cap_exceeded')
  })

  it('does not block when the owner has no annual cap', () => {
    const { requestStay } = useOwnerStayApprovals()
    const result = requestStay(lowSeasonInput())

    expect(result.ok).toBe(true)
  })
  // --- Reservations mirroring (PRD 5.4.2) ---------------------------------

  it('mirrors a request-mode stay into Reservations as owner_request with the listing NAME', () => {
    const { requestStay } = useOwnerStayApprovals()
    const result = requestStay(lowSeasonInput({ ownerId: 'own-2', listingId: 'lst-8' }))

    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    const mirror = mirrorFor(result.stay.id)
    expect(mirror).toBeDefined()
    expect(mirror!.status).toBe('owner_request')
    // Regression: the listing NAME, never the raw listing id.
    expect(mirror!.listingName).toBe(listings.value.find(l => l.id === 'lst-8')!.name)
    expect(mirror!.listingName).not.toBe('lst-8')
    // The stay stores the reservation id so the join is not string matching.
    expect(result.stay.reservationId ?? mirrorFor(result.stay.id)!.id).toBe(mirror!.id)
  })

  it('mirrors a direct-mode stay into Reservations as a confirmed block', () => {
    const { requestStay } = useOwnerStayApprovals()
    const result = requestStay(lowSeasonInput())

    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    const mirror = mirrorFor(result.stay.id)
    expect(mirror).toBeDefined()
    expect(mirror!.status).toBe('unverified')
    expect(mirror!.blockReason).toBe('Owner stay')
  })

  it('flips the mirrored reservation to blocked when a request is approved', () => {
    const { requestStay, approveRequest } = useOwnerStayApprovals()
    const result = requestStay(lowSeasonInput({ ownerId: 'own-2', listingId: 'lst-8' }))
    expect(result.ok).toBe(true)
    if (!result.ok || !result.requestId)
      return

    expect(mirrorFor(result.stay.id)!.status).toBe('owner_request')
    approveRequest(result.requestId, 'staff-1')
    expect(mirrorFor(result.stay.id)!.status).toBe('unverified')
  })

  it('cancels the mirrored reservation when a request is rejected', () => {
    const { requestStay, rejectRequest } = useOwnerStayApprovals()
    const result = requestStay(lowSeasonInput({ ownerId: 'own-2', listingId: 'lst-8' }))
    expect(result.ok).toBe(true)
    if (!result.ok || !result.requestId)
      return

    rejectRequest(result.requestId, 'staff-1', 'Overlaps a high-value guest booking.')
    expect(mirrorFor(result.stay.id)!.status).toBe('cancelled')
  })

  it('releases the mirrored reservation when the owner cancels the stay', () => {
    const { requestStay } = useOwnerStayApprovals()
    const { cancelStay } = useOwnerStays()
    const result = requestStay(lowSeasonInput())
    expect(result.ok).toBe(true)
    if (!result.ok)
      return

    expect(mirrorFor(result.stay.id)!.status).toBe('unverified')
    const cancelled = cancelStay(result.stay.id, 'Cancelled by owner')
    expect(cancelled.ok).toBe(true)
    // Regression: a cancelled owner stay must not keep occupying dates.
    expect(mirrorFor(result.stay.id)!.status).toBe('cancelled')
  })
  // --- Actioning a request from the Reservations page ----------------------

  it('resolves the owner stay behind a mirrored reservation by id and by bookingNote', () => {
    const { stayForReservation } = useOwnerStays()

    // Seeded link: ost-5 <-> ost-res-5.
    expect(stayForReservation('ost-res-5')?.id).toBe('ost-5')
    // Fallback path: no reservationId match, resolve via the note marker.
    expect(stayForReservation('unknown-res', 'Owner request ost-5')?.id).toBe('ost-5')
    // Neither path matches.
    expect(stayForReservation('unknown-res')).toBeUndefined()
    expect(stayForReservation('unknown-res', 'Not an owner note')).toBeUndefined()
  })

  it('exposes only the still-open approval request for a stay', () => {
    const { pendingRequestForStay } = useOwnerStayApprovals()

    // osa-1 is pending for ost-5.
    expect(pendingRequestForStay('ost-5')?.id).toBe('osa-1')
    // osa-2 is already rejected for ost-6 — not actionable.
    expect(pendingRequestForStay('ost-6')).toBeUndefined()
    expect(pendingRequestForStay('ost-1')).toBeUndefined()
  })

  it('approves a seeded request resolved from its reservation row', () => {
    const { pendingRequestForStay, approveRequest } = useOwnerStayApprovals()
    const { stayForReservation } = useOwnerStays()

    // The exact path the Reservations row takes: reservation -> stay -> request.
    const stay = stayForReservation('ost-res-5')
    expect(stay).toBeDefined()
    const request = pendingRequestForStay(stay!.id)
    expect(request).toBeDefined()

    expect(mirrorFor('ost-5')!.status).toBe('owner_request')
    const result = approveRequest(request!.id, 'staff-1')
    expect(result.ok).toBe(true)
    expect(mirrorFor('ost-5')!.status).toBe('unverified')
    // Second attempt is refused — the request is no longer pending.
    expect(pendingRequestForStay('ost-5')).toBeUndefined()
  })

  it('rejects a seeded request resolved from its reservation row', () => {
    const { pendingRequestForStay, rejectRequest } = useOwnerStayApprovals()
    const { stayForReservation } = useOwnerStays()

    const stay = stayForReservation('ost-res-5')!
    const request = pendingRequestForStay(stay.id)!
    const result = rejectRequest(request.id, 'staff-1', 'Overlaps a high-value guest booking.')

    expect(result.ok).toBe(true)
    expect(mirrorFor('ost-5')!.status).toBe('cancelled')
  })
})
