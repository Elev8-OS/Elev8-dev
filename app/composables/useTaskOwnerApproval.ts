// Owner cost approval on tasks.
//
// A task that will cost the owner money can be marked `ownerApprovalRequired`
// when it is created. Such a task is **blocked** until the owner approves it in
// their portal, and completing it requires a receipt whose amount becomes the
// task's `finalInvoiceAmount`.
//
// The task is the single record: there is no parallel maintenance row to keep
// in step. Staff work it on /tasks, the owner sees it in their portal.

import type { Task } from '~/components/tasks/data/schema'
import { listings } from '~/components/listings/data/listings'
import { useNotifications } from '~/composables/useNotifications'
import { useOwners } from '~/composables/useOwners'
import { useTaskStore } from '~/composables/useTaskStore'

export interface TaskReceiptInput {
  fileName: string
  fileSize: number
  mimeType: string
  /** Amount read off the receipt — becomes `finalInvoiceAmount`. */
  amount: number
}

export type TaskApprovalResult
  = | { ok: true, task: Task }
    | { ok: false, reason: 'not_found' | 'not_awaiting_approval' | 'already_decided' }

export type TaskCompleteResult
  = | { ok: true, task: Task }
    | { ok: false, reason: 'not_found' | 'blocked_on_owner' | 'receipt_required' | 'invalid_amount' }

function nowIso(): string {
  return new Date().toISOString()
}

export function useTaskOwnerApproval() {
  const { tasks, updateTask, addStatusUpdate } = useTaskStore()

  function fmtIdr(amount: number): string {
    return `IDR ${amount.toLocaleString('id-ID')}`
  }

  /**
   * The owner of the property a task belongs to. `task.listing` holds the
   * listing NAME by convention, so it is resolved name -> id -> mapping.
   * Returns the first owner mapped to that listing.
   */
  function ownerForTask(task: Pick<Task, 'listing'>): { id: string, name: string } | null {
    if (!task.listing)
      return null
    const listing = listings.value.find(l => l.name === task.listing || l.id === task.listing)
    if (!listing)
      return null
    const { mappings, byId } = useOwners()
    const mapping = mappings.value.find(m => m.listingId === listing.id)
    if (!mapping)
      return null
    const owner = byId(mapping.ownerId)
    return owner ? { id: owner.id, name: owner.name } : null
  }

  /** True while a task is waiting on its owner and must not be started. */
  function isBlockedOnOwner(task: Pick<Task, 'ownerApprovalRequired' | 'ownerApprovalStatus'>): boolean {
    return task.ownerApprovalRequired === true && task.ownerApprovalStatus !== 'approved'
  }

  /** Why work cannot start, or null when it can. */
  function startBlockedReason(task: Pick<Task, 'ownerApprovalRequired' | 'ownerApprovalStatus'>): string | null {
    if (!task.ownerApprovalRequired)
      return null
    if (task.ownerApprovalStatus === 'approved')
      return null
    if (task.ownerApprovalStatus === 'rejected')
      return 'The owner rejected this cost. Work cannot start.'
    return 'Waiting for the owner to approve the cost before work can start.'
  }

  /** Owner approves the quoted cost — the task becomes startable. */
  function ownerApprove(taskId: string, note?: string): TaskApprovalResult {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task)
      return { ok: false, reason: 'not_found' }
    if (!task.ownerApprovalRequired)
      return { ok: false, reason: 'not_awaiting_approval' }
    if (task.ownerApprovalStatus === 'approved' || task.ownerApprovalStatus === 'rejected')
      return { ok: false, reason: 'already_decided' }

    const at = nowIso()
    updateTask(taskId, {
      ownerApprovalStatus: 'approved',
      ownerApprovalNote: note,
      ownerApprovalDecidedAt: at,
    })
    // The approval is part of the task's history, not just a field.
    const owner = task.ownerId ? useOwners().byId(task.ownerId) : undefined
    const quoted = task.estimatedCost !== undefined ? ` of ${fmtIdr(task.estimatedCost)}` : ''
    addStatusUpdate(taskId, {
      date: at,
      actor: { name: owner?.name ?? 'Owner', kind: 'owner' },
      note: `approved the cost${quoted}${note ? ` — “${note}”` : ''}`,
      progress: task.progress ?? 0,
    })
    return { ok: true, task: tasks.value.find(t => t.id === taskId)! }
  }

  /** Owner rejects the cost — the task is cancelled. */
  function ownerReject(taskId: string, note: string): TaskApprovalResult {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task)
      return { ok: false, reason: 'not_found' }
    if (!task.ownerApprovalRequired)
      return { ok: false, reason: 'not_awaiting_approval' }
    if (task.ownerApprovalStatus === 'approved' || task.ownerApprovalStatus === 'rejected')
      return { ok: false, reason: 'already_decided' }

    const at = nowIso()
    updateTask(taskId, {
      status: 'canceled',
      ownerApprovalStatus: 'rejected',
      ownerApprovalNote: note,
      ownerApprovalDecidedAt: at,
    })
    const rejectingOwner = task.ownerId ? useOwners().byId(task.ownerId) : undefined
    addStatusUpdate(taskId, {
      date: at,
      actor: { name: rejectingOwner?.name ?? 'Owner', kind: 'owner' },
      note: `declined the cost — “${note}”`,
      progress: task.progress ?? 0,
    })
    return { ok: true, task: tasks.value.find(t => t.id === taskId)! }
  }

  /**
   * Complete a task with its receipt. The receipt is mandatory for any task
   * that went through owner approval — it is the evidence behind the actual
   * cost the owner is charged.
   */
  function completeWithReceipt(taskId: string, input: TaskReceiptInput | null): TaskCompleteResult {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task)
      return { ok: false, reason: 'not_found' }
    if (isBlockedOnOwner(task))
      return { ok: false, reason: 'blocked_on_owner' }
    if (task.ownerApprovalRequired && !input)
      return { ok: false, reason: 'receipt_required' }
    if (input && !(input.amount > 0))
      return { ok: false, reason: 'invalid_amount' }

    const at = nowIso()
    updateTask(taskId, {
      status: 'done',
      ...(input
        ? {
            receipt: {
              fileName: input.fileName,
              fileSize: input.fileSize,
              mimeType: input.mimeType,
              uploadedAt: at,
            },
            finalInvoiceAmount: input.amount,
          }
        : {}),
    })

    // Put the outcome in the timeline. The amount and its receipt go in as
    // structured `cost` data so the timeline can render a card, rather than
    // the reader having to parse it out of a sentence.
    addStatusUpdate(taskId, {
      date: at,
      actor: { name: 'Komang Juliantara', kind: 'staff' },
      icon: input ? 'lucide:receipt' : undefined,
      note: input ? 'completed the task and uploaded the receipt' : 'completed the task',
      progress: 100,
      ...(input
        ? {
            cost: {
              amount: input.amount,
              currency: 'IDR',
              quoted: task.estimatedCost,
              receipt: {
                fileName: input.fileName,
                fileSize: input.fileSize,
                mimeType: input.mimeType,
              },
            },
          }
        : {}),
    })
    return { ok: true, task: tasks.value.find(t => t.id === taskId)! }
  }

  /** Tasks still waiting on any owner — the staff-side queue. */
  const pendingOwnerApprovals = computed(() =>
    tasks.value.filter(t => t.ownerApprovalRequired && t.ownerApprovalStatus === 'pending'))

  /** Owner-visible tasks for one owner, newest first. */
  function tasksForOwner(ownerId: string): Task[] {
    return tasks.value
      .filter(t => t.ownerVisible && t.ownerId === ownerId)
      .slice()
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  }

  /** Owner-visible tasks for one owner that need their decision. */
  function approvalsForOwner(ownerId: string): Task[] {
    return tasksForOwner(ownerId).filter(t =>
      t.ownerApprovalRequired && t.ownerApprovalStatus === 'pending')
  }

  /** Fired when a task is created needing owner approval. */
  function notifyApprovalRequested(task: Task): void {
    useNotifications().createAlert('MAINTENANCE_APPROVAL_REQUESTED' as never, 'WARNING', {
      taskId: task.id,
      ownerId: task.ownerId,
      listing: task.listing,
      title: task.title,
      estimatedCost: task.estimatedCost,
    })
  }

  return {
    ownerForTask,
    isBlockedOnOwner,
    startBlockedReason,
    ownerApprove,
    ownerReject,
    completeWithReceipt,
    pendingOwnerApprovals,
    tasksForOwner,
    approvalsForOwner,
    notifyApprovalRequested,
  }
}
