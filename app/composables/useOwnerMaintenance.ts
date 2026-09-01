// Owner maintenance records — cost-bearing work order lifecycle (Flow 10B).
//
// Threshold rule: repairs whose estimated cost is at or above the tenant
// config threshold require owner approval before the vendor starts. Below
// threshold they proceed straight through. For urgent cases staff can
// emergency-override past a missing owner response.

import type { AlertType } from '~/components/notifications/data/alerts'
import type {
  MaintenanceOwnerApprovalStatus,
  MaintenanceRecord,
  MaintenanceRecordInput,
} from '~/components/owners/data/owner-maintenance'
import { mockMaintenanceRecords, ownerMaintenanceConfig } from '~/components/owners/data/owner-maintenance'
import { useNotifications } from '~/composables/useNotifications'
import { useTaskStore } from '~/composables/useTaskStore'

export type CreateMaintenanceRecordResult
  = | { ok: true, record: MaintenanceRecord, requiresApproval: boolean }
    | { ok: false, error: string }

export type OwnerMaintenanceRespondResult
  = | { ok: true, record: MaintenanceRecord }
    | { ok: false, reason: 'not_found' | 'not_awaiting_approval' | 'already_decided' }

export type OwnerMaintenanceActionResult
  = | { ok: true, record: MaintenanceRecord }
    | { ok: false, reason: 'not_found' | 'invalid_status' }

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

function emitMaintenanceAlert(
  type: 'MAINTENANCE_APPROVAL_REQUESTED' | 'MAINTENANCE_COMPLETED',
  severity: 'INFO' | 'WARNING',
  context: Record<string, unknown>,
): void {
  useNotifications().createAlert(type as AlertType, severity, context)
}

export function useOwnerMaintenance() {
  const records = useState<MaintenanceRecord[]>(
    'elev8-owner-maintenance',
    () => structuredClone(mockMaintenanceRecords),
  )

  /** The Tasks-module task mirroring a record, if it still exists. */
  function taskForRecord(record: Pick<MaintenanceRecord, 'taskId'>) {
    if (!record.taskId)
      return undefined
    const { tasks } = useTaskStore()
    return tasks.value.find(t => t.id === record.taskId)
  }

  /** The maintenance record behind a mirrored task, if any. */
  function recordForTask(taskId: string): MaintenanceRecord | undefined {
    return records.value.find(r => r.taskId === taskId)
  }

  /** Move the mirrored task to `status`, when the record has one. */
  function setMirroredTaskStatus(
    record: Pick<MaintenanceRecord, 'taskId'>,
    status: string,
  ): void {
    if (!record.taskId)
      return
    const { tasks } = useTaskStore()
    tasks.value = tasks.value.map(t => t.id === record.taskId ? { ...t, status } : t)
  }

  function recordIdTaken(id: string): boolean {
    return records.value.some(r => r.id === id)
  }

  /**
   * Create a record from a Tasks / Damage & Issue report. Above the tenant
   * approval threshold the record waits for owner approval before the vendor
   * starts; otherwise it proceeds directly.
   */
  function createRecord(input: MaintenanceRecordInput): CreateMaintenanceRecordResult {
    if (!input.title.trim())
      return { ok: false, error: 'Title is required.' }
    if (input.estimatedCost < 0)
      return { ok: false, error: 'Estimated cost cannot be negative.' }

    const requiresApproval = input.estimatedCost >= ownerMaintenanceConfig.approvalThreshold
    const timestamp = nowIso()
    const record: MaintenanceRecord = {
      id: deriveUniqueId('mnt', recordIdTaken),
      ownerId: input.ownerId,
      listingId: input.listingId,
      title: input.title.trim(),
      description: input.description.trim(),
      reportedAt: timestamp,
      reportedBy: input.reportedBy,
      status: requiresApproval ? 'awaiting_owner_approval' : 'reported',
      estimatedCost: input.estimatedCost,
      ownerApproval: { status: requiresApproval ? 'pending' : 'not_required' },
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    // PRD 5.4.3 — mirror the maintenance item into the Tasks module so staff
    // manage it through the existing lifecycle, tagged with the owner id. The
    // returned id is stored on the record so the two stay linkable.
    const { addTask } = useTaskStore()
    const task = addTask({
      title: record.title,
      status: requiresApproval ? 'todo' : 'in progress',
      priority: 'high',
      listing: record.listingId,
      description: record.description,
      ownerId: record.ownerId,
      ownerVisible: true,
      source: 'manual',
    })
    record.taskId = task.id
    records.value = [...records.value, record]

    if (requiresApproval) {
      emitMaintenanceAlert('MAINTENANCE_APPROVAL_REQUESTED', 'WARNING', {
        recordId: record.id,
        ownerId: record.ownerId,
        listingId: record.listingId,
        title: record.title,
        estimatedCost: record.estimatedCost,
        threshold: ownerMaintenanceConfig.approvalThreshold,
        currency: ownerMaintenanceConfig.currency,
      })
    }

    return { ok: true, record, requiresApproval }
  }

  /**
   * Owner responds to a cost approval request (Flow 10B step 4).
   * Approve → vendor assigned; reject → record cancelled.
   */
  function ownerRespond(recordId: string, approve: boolean, note?: string): OwnerMaintenanceRespondResult {
    const record = records.value.find(r => r.id === recordId)
    if (!record)
      return { ok: false, reason: 'not_found' }
    if (record.status !== 'awaiting_owner_approval')
      return { ok: false, reason: 'not_awaiting_approval' }
    if (record.ownerApproval.status === 'approved' || record.ownerApproval.status === 'rejected')
      return { ok: false, reason: 'already_decided' }

    const timestamp = nowIso()
    const status: MaintenanceRecord['status'] = approve ? 'vendor_assigned' : 'cancelled'
    const approvalStatus: MaintenanceOwnerApprovalStatus = approve ? 'approved' : 'rejected'
    const updated: MaintenanceRecord = {
      ...record,
      status,
      ownerApproval: {
        status: approvalStatus,
        decidedAt: timestamp,
        decidedBy: 'owner',
        note,
      },
      updatedAt: timestamp,
    }
    records.value = records.value.map(r => r.id === recordId ? updated : r)
    // Keep the mirrored task in step: an approved cost releases the vendor,
    // a rejected one cancels the work.
    setMirroredTaskStatus(updated, approve ? 'in progress' : 'canceled')
    return { ok: true, record: updated }
  }

  /**
   * Staff overrides past a missing owner response for urgent repairs.
   * Recorded retroactively for the owner (Flow 10B — emergency approval).
   */
  function emergencyOverride(recordId: string, actor: string, note: string): OwnerMaintenanceActionResult {
    const record = records.value.find(r => r.id === recordId)
    if (!record)
      return { ok: false, reason: 'not_found' }
    if (record.status !== 'awaiting_owner_approval')
      return { ok: false, reason: 'invalid_status' }

    const timestamp = nowIso()
    const updated: MaintenanceRecord = {
      ...record,
      status: 'in_progress',
      ownerApproval: {
        status: 'emergency_override',
        decidedAt: timestamp,
        decidedBy: actor,
        note,
      },
      updatedAt: timestamp,
    }
    records.value = records.value.map(r => r.id === recordId ? updated : r)
    return { ok: true, record: updated }
  }

  /** Move a record forward (vendor assigned / in progress) after owner approval. */
  function advanceRecord(recordId: string, nextStatus: 'in_progress' | 'vendor_assigned', vendorName?: string): OwnerMaintenanceActionResult {
    const record = records.value.find(r => r.id === recordId)
    if (!record)
      return { ok: false, reason: 'not_found' }

    const updated: MaintenanceRecord = {
      ...record,
      status: nextStatus,
      vendorName: vendorName ?? record.vendorName,
      updatedAt: nowIso(),
    }
    records.value = records.value.map(r => r.id === recordId ? updated : r)
    return { ok: true, record: updated }
  }

  /**
   * Complete a repair: attach the final invoice + before/after photos and
   * record the actual cost. Owners get a completion notification.
   */
  function completeRecord(
    recordId: string,
    actualCost: number,
    options: { invoiceId?: string, photosBefore?: string[], photosAfter?: string[] } = {},
  ): OwnerMaintenanceActionResult {
    const record = records.value.find(r => r.id === recordId)
    if (!record)
      return { ok: false, reason: 'not_found' }
    if (record.status === 'completed' || record.status === 'cancelled')
      return { ok: false, reason: 'invalid_status' }

    const updated: MaintenanceRecord = {
      ...record,
      status: 'completed',
      actualCost,
      invoiceId: options.invoiceId ?? record.invoiceId,
      photosBefore: options.photosBefore ?? record.photosBefore,
      photosAfter: options.photosAfter ?? record.photosAfter,
      updatedAt: nowIso(),
    }
    records.value = records.value.map(r => r.id === recordId ? updated : r)

    emitMaintenanceAlert('MAINTENANCE_COMPLETED', 'INFO', {
      recordId: updated.id,
      ownerId: updated.ownerId,
      listingId: updated.listingId,
      title: updated.title,
      actualCost: updated.actualCost,
    })

    return { ok: true, record: updated }
  }

  /** Mark a completed record as synced to a statement period (Flow 9 deduction). */
  function syncToStatement(recordId: string, period: string): OwnerMaintenanceActionResult {
    const record = records.value.find(r => r.id === recordId)
    if (!record)
      return { ok: false, reason: 'not_found' }
    if (record.status !== 'completed')
      return { ok: false, reason: 'invalid_status' }

    const updated: MaintenanceRecord = {
      ...record,
      syncedToStatementPeriod: period,
      updatedAt: nowIso(),
    }
    records.value = records.value.map(r => r.id === recordId ? updated : r)
    return { ok: true, record: updated }
  }

  /** Owner-scoped selector — isolation first, status filters second. */
  function recordsForOwner(ownerId: string): MaintenanceRecord[] {
    return records.value
      .filter(record => record.ownerId === ownerId)
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  /** Records currently waiting on the owner's cost approval. */
  const openApprovals = computed(() => records.value
    .filter(record => record.status === 'awaiting_owner_approval')
    .slice()
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)))

  return {
    records,
    openApprovals,
    createRecord,
    ownerRespond,
    emergencyOverride,
    advanceRecord,
    completeRecord,
    syncToStatement,
    recordsForOwner,
    taskForRecord,
    recordForTask,
    setMirroredTaskStatus,
  }
}
