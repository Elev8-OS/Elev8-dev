import type { OwnerStay } from '~/components/owners/data/owner-stays'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockOwnerStays } from '~/components/owners/data/owner-stays'
import { mockOwnerStayApprovals } from '~/components/owners/data/owner-stay-approvals'
import { mockOwnerBookingModes, mockOwnerSeasonalQuotas } from '~/components/owners/data/owner-quotas'
import { useOwnerStayApprovals } from '~/composables/useOwnerStayApprovals'

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
  notificationsMock.callLog.length = 0
  cleaningMock.createJob.mockClear()
  smartLockMock.getLocksForListing.mockClear()
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
})
