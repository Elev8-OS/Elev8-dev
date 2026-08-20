import type { OwnerStay } from '~/components/owners/data/owner-stays'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockOwnerStays } from '~/components/owners/data/owner-stays'
import { useOwnerStayOperations } from '~/composables/useOwnerStayOperations'

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

const cleaningMock = vi.hoisted(() => ({
  createJob: vi.fn((input: Record<string, unknown>) => ({ id: `cln-ops-${Date.now()}`, ...input })),
  deleteJob: vi.fn(),
  resolveListingName: vi.fn((listingId: string) => `Listing ${listingId}`),
}))

vi.mock('~/composables/useCleaningJobs', () => ({
  useCleaningJobs: () => cleaningMock,
}))

const smartLockMock = vi.hoisted(() => ({
  getLocksForListing: vi.fn(() => [{ id: 'lock-1' }]),
  generateAccessCode: vi.fn(async () => ({ success: true, code: { id: 'code-1' } })),
  revokeAccessCode: vi.fn(),
}))

vi.mock('~/composables/useSmartLock', () => ({
  useSmartLock: () => smartLockMock,
}))

function resetState() {
  const stays = useState<OwnerStay[]>('elev8-owner-stays')
  stays.value = structuredClone(mockOwnerStays)
  notificationsMock.callLog.length = 0
  cleaningMock.createJob.mockClear()
  cleaningMock.deleteJob.mockClear()
  smartLockMock.getLocksForListing.mockClear()
  smartLockMock.generateAccessCode.mockClear()
  smartLockMock.revokeAccessCode.mockClear()
}

describe('useOwnerStayOperations', () => {
  beforeEach(() => {
    resetState()
  })

  it('provisions pre + post cleaning jobs and a smart-lock code on approval', async () => {
    const { stays, updateStayStatus } = useOwnerStayOperations()
    const target = stays.value.find(s => s.id === 'ost-5')!
    expect(target.status).toBe('pending_approval')

    const result = updateStayStatus('ost-5', 'active', { decidedBy: 'staff-1', decidedAt: new Date().toISOString() })

    expect(result.ok).toBe(true)
    expect(result.stay.status).toBe('active')
    // 2 cleaning jobs: pre (checkIn - 1) and post (checkOut).
    expect(cleaningMock.createJob).toHaveBeenCalledTimes(2)
    // Smart-lock code generated for the stay window.
    expect(smartLockMock.generateAccessCode).toHaveBeenCalledWith(expect.objectContaining({
      reservationId: 'ost-5',
      scheduleType: 'range',
    }))

    await vi.waitFor(() => {
      const updated = stays.value.find(s => s.id === 'ost-5')
      expect(updated?.cleaningTaskIds?.pre).toHaveLength(1)
      expect(updated?.cleaningTaskIds?.post).toHaveLength(1)
      expect(updated?.accessCodeId).toBe('code-1')
      expect(updated?.syncState).toEqual({ cockpit: 'synced', channex: 'synced', notifications: 'synced' })
    })
  })

  it('does not provision a lock when the listing has no locks', async () => {
    const { stays, updateStayStatus } = useOwnerStayOperations()
    smartLockMock.getLocksForListing.mockReturnValueOnce([])

    const result = updateStayStatus('ost-5', 'active', { decidedBy: 'staff-1', decidedAt: new Date().toISOString() })
    // Provision is fire-and-forget; wait until it settles.
    await vi.waitFor(() => {
      const updated = stays.value.find(s => s.id === 'ost-5')
      expect(updated?.cleaningTaskIds?.pre).toHaveLength(1)
    })
    expect(smartLockMock.generateAccessCode).not.toHaveBeenCalled()
    expect(stays.value.find(s => s.id === 'ost-5')?.accessCodeId).toBeUndefined()
    void result
  })

  it('releases the access code and deletes the pre-arrival cleaning job on cancellation', async () => {
    const { stays, releaseStayOperations } = useOwnerStayOperations()
    // ost-1 has an accessCodeId + cleaning task ids in the seed.
    const target = stays.value.find(s => s.id === 'ost-1')!
    await releaseStayOperations(target)

    expect(smartLockMock.revokeAccessCode).toHaveBeenCalledWith(target.accessCodeId)
    expect(cleaningMock.deleteJob).toHaveBeenCalledWith('cln-ost-1-pre')
    // Post-stay job is NOT deleted.
    expect(cleaningMock.deleteJob).not.toHaveBeenCalledWith('cln-ost-1-post')
    const updated = stays.value.find(s => s.id === 'ost-1')
    expect(updated?.accessCodeId).toBeUndefined()
  })
})
