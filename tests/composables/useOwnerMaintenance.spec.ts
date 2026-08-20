import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockMaintenanceRecords } from '~/components/owners/data/owner-maintenance'
import { useOwnerMaintenance } from '~/composables/useOwnerMaintenance'

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

function resetState() {
  const records = useState('elev8-owner-maintenance')
  records.value = structuredClone(mockMaintenanceRecords)
  notificationsMock.callLog.length = 0
}

describe('useOwnerMaintenance', () => {
  beforeEach(() => {
    resetState()
  })

  it('creates a below-threshold record without owner approval', () => {
    const { createRecord, records } = useOwnerMaintenance()
    const result = createRecord({
      ownerId: 'own-1',
      listingId: 'lst-1',
      title: 'Fix garden tap',
      description: 'Leaking outdoor tap',
      estimatedCost: 150_000,
      reportedBy: 'staff-4',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.requiresApproval).toBe(false)
      expect(result.record.status).toBe('reported')
      expect(result.record.ownerApproval.status).toBe('not_required')
    }
    expect(records.value.length).toBe(mockMaintenanceRecords.length + 1)
    expect(notificationsMock.callLog.some(call => call.type === 'MAINTENANCE_APPROVAL_REQUESTED')).toBe(false)
  })

  it('routes an above-threshold record into awaiting_owner_approval', () => {
    const { createRecord } = useOwnerMaintenance()
    const result = createRecord({
      ownerId: 'own-1',
      listingId: 'lst-1',
      title: 'Roof repair',
      description: 'Leaking roof over master bedroom',
      estimatedCost: 2_000_000,
      reportedBy: 'staff-2',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.requiresApproval).toBe(true)
      expect(result.record.status).toBe('awaiting_owner_approval')
      expect(result.record.ownerApproval.status).toBe('pending')
    }
    expect(notificationsMock.callLog.some(call => call.type === 'MAINTENANCE_APPROVAL_REQUESTED')).toBe(true)
  })

  it('owner approval assigns the vendor', () => {
    const { createRecord, ownerRespond } = useOwnerMaintenance()
    const created = createRecord({
      ownerId: 'own-1',
      listingId: 'lst-1',
      title: 'Roof repair',
      description: 'Leaking roof',
      estimatedCost: 2_000_000,
      reportedBy: 'staff-2',
    })
    if (!created.ok)
      throw new Error('expected record')

    const result = ownerRespond(created.record.id, true, 'Approved — use preferred vendor')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.record.status).toBe('vendor_assigned')
      expect(result.record.ownerApproval.status).toBe('approved')
      expect(result.record.ownerApproval.decidedBy).toBe('owner')
    }
  })

  it('owner rejection cancels the record', () => {
    const { createRecord, ownerRespond } = useOwnerMaintenance()
    const created = createRecord({
      ownerId: 'own-1',
      listingId: 'lst-1',
      title: 'Roof repair',
      description: 'Leaking roof',
      estimatedCost: 2_000_000,
      reportedBy: 'staff-2',
    })
    if (!created.ok)
      throw new Error('expected record')

    const result = ownerRespond(created.record.id, false, 'Get a second quote first')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.record.status).toBe('cancelled')
      expect(result.record.ownerApproval.status).toBe('rejected')
    }
  })

  it('emergency override proceeds without the owner response', () => {
    const { createRecord, emergencyOverride } = useOwnerMaintenance()
    const created = createRecord({
      ownerId: 'own-1',
      listingId: 'lst-1',
      title: 'Emergency AC',
      description: 'AC down with guests in house',
      estimatedCost: 900_000,
      reportedBy: 'staff-2',
    })
    if (!created.ok)
      throw new Error('expected record')

    const result = emergencyOverride(created.record.id, 'staff-1', 'Guests in house — override')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.record.status).toBe('in_progress')
      expect(result.record.ownerApproval.status).toBe('emergency_override')
    }
  })

  it('completing a record attaches cost and notifies the owner', () => {
    const { completeRecord, syncToStatement } = useOwnerMaintenance()
    const done = completeRecord('mnt-4', 480_000, { invoiceId: 'odoc-inv-4' })

    expect(done.ok).toBe(true)
    if (done.ok) {
      expect(done.record.status).toBe('completed')
      expect(done.record.actualCost).toBe(480_000)
      expect(done.record.invoiceId).toBe('odoc-inv-4')
    }
    expect(notificationsMock.callLog.some(call => call.type === 'MAINTENANCE_COMPLETED')).toBe(true)

    const synced = syncToStatement('mnt-4', '2026-08')
    expect(synced.ok).toBe(true)
    if (synced.ok)
      expect(synced.record.syncedToStatementPeriod).toBe('2026-08')
  })

  it('scopes records by owner', () => {
    const { recordsForOwner } = useOwnerMaintenance()
    const wayan = recordsForOwner('own-1')
    const putu = recordsForOwner('own-2')

    expect(wayan.every(r => r.ownerId === 'own-1')).toBe(true)
    expect(putu.every(r => r.ownerId === 'own-2')).toBe(true)
    // Co-owner isolation: no record leaks across owners.
    expect(wayan.some(r => r.ownerId === 'own-2')).toBe(false)
  })
})
