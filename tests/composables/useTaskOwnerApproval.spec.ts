import type { Task } from '~/components/tasks/data/schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockTasks } from '~/components/tasks/data/tasks-mock'
import { useTaskOwnerApproval } from '~/composables/useTaskOwnerApproval'
import { useTaskStore } from '~/composables/useTaskStore'

const notificationsMock = vi.hoisted(() => ({
  callLog: [] as Array<{ type: string, severity: string }>,
  spy: {
    createAlert: (type: string, severity: string) => {
      notificationsMock.callLog.push({ type, severity })
    },
  },
}))

vi.mock('~/composables/useNotifications', () => ({
  useNotifications: () => notificationsMock.spy,
}))

function resetState() {
  const tasks = useState<Task[]>('tasks')
  tasks.value = mockTasks.map(t => ({ ...t }))
  notificationsMock.callLog.length = 0
}

function taskById(id: string): Task | undefined {
  return useTaskStore().tasks.value.find(t => t.id === id)
}

describe('useTaskOwnerApproval', () => {
  beforeEach(() => {
    resetState()
  })

  // --- The gate --------------------------------------------------------------

  it('blocks a task that is waiting on its owner', () => {
    const { isBlockedOnOwner, startBlockedReason } = useTaskOwnerApproval()
    const pending = taskById('TASK-OWN-002')!

    expect(pending.ownerApprovalStatus).toBe('pending')
    expect(isBlockedOnOwner(pending)).toBe(true)
    expect(startBlockedReason(pending)).toMatch(/Waiting for the owner/)
  })

  it('does not block a task that needs no approval, or one already approved', () => {
    const { isBlockedOnOwner, startBlockedReason } = useTaskOwnerApproval()

    const noApproval = taskById('TASK-OWN-004')!
    expect(isBlockedOnOwner(noApproval)).toBe(false)
    expect(startBlockedReason(noApproval)).toBeNull()

    const approved = taskById('TASK-OWN-003')!
    expect(approved.ownerApprovalStatus).toBe('approved')
    expect(isBlockedOnOwner(approved)).toBe(false)
    expect(startBlockedReason(approved)).toBeNull()
  })

  it('keeps a rejected task blocked, with its own reason', () => {
    const { ownerReject, isBlockedOnOwner, startBlockedReason } = useTaskOwnerApproval()
    ownerReject('TASK-OWN-002', 'Get another quote.')

    const rejected = taskById('TASK-OWN-002')!
    expect(isBlockedOnOwner(rejected)).toBe(true)
    expect(startBlockedReason(rejected)).toMatch(/rejected this cost/)
  })

  // --- Owner decisions -------------------------------------------------------

  it('approves a pending cost and leaves the task startable', () => {
    const { ownerApprove, isBlockedOnOwner } = useTaskOwnerApproval()
    const result = ownerApprove('TASK-OWN-002', 'Go ahead.')

    expect(result.ok).toBe(true)
    const task = taskById('TASK-OWN-002')!
    expect(task.ownerApprovalStatus).toBe('approved')
    expect(task.ownerApprovalNote).toBe('Go ahead.')
    expect(task.ownerApprovalDecidedAt).toBeTruthy()
    expect(isBlockedOnOwner(task)).toBe(false)
    // Approving does not start the work by itself.
    expect(task.status).toBe('todo')
  })

  it('cancels the task when the owner rejects the cost', () => {
    const { ownerReject } = useTaskOwnerApproval()
    const result = ownerReject('TASK-OWN-002', 'Too expensive.')

    expect(result.ok).toBe(true)
    const task = taskById('TASK-OWN-002')!
    expect(task.ownerApprovalStatus).toBe('rejected')
    expect(task.status).toBe('canceled')
  })

  it('refuses a second decision, and a decision on a task needing none', () => {
    const { ownerApprove, ownerReject } = useTaskOwnerApproval()
    expect(ownerApprove('TASK-OWN-002').ok).toBe(true)

    const second = ownerApprove('TASK-OWN-002')
    expect(second.ok).toBe(false)
    if (!second.ok)
      expect(second.reason).toBe('already_decided')

    const notRequired = ownerReject('TASK-OWN-004', 'no')
    expect(notRequired.ok).toBe(false)
    if (!notRequired.ok)
      expect(notRequired.reason).toBe('not_awaiting_approval')

    const missing = ownerApprove('TASK-NOPE')
    expect(missing.ok).toBe(false)
    if (!missing.ok)
      expect(missing.reason).toBe('not_found')
  })

  // --- Completing with a receipt --------------------------------------------

  it('refuses to complete a task still waiting on the owner', () => {
    const { completeWithReceipt } = useTaskOwnerApproval()
    const result = completeWithReceipt('TASK-OWN-002', {
      fileName: 'r.pdf',
      fileSize: 100,
      mimeType: 'application/pdf',
      amount: 1_000_000,
    })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.reason).toBe('blocked_on_owner')
  })

  it('requires a receipt for an owner-charged task', () => {
    const { ownerApprove, completeWithReceipt } = useTaskOwnerApproval()
    ownerApprove('TASK-OWN-002')

    const noReceipt = completeWithReceipt('TASK-OWN-002', null)
    expect(noReceipt.ok).toBe(false)
    if (!noReceipt.ok)
      expect(noReceipt.reason).toBe('receipt_required')
  })

  it('rejects a receipt with no usable amount', () => {
    const { ownerApprove, completeWithReceipt } = useTaskOwnerApproval()
    ownerApprove('TASK-OWN-002')

    const result = completeWithReceipt('TASK-OWN-002', {
      fileName: 'r.pdf',
      fileSize: 100,
      mimeType: 'application/pdf',
      amount: 0,
    })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.reason).toBe('invalid_amount')
  })

  it('records the receipt and its amount as the actual cost on completion', () => {
    const { ownerApprove, completeWithReceipt } = useTaskOwnerApproval()
    ownerApprove('TASK-OWN-002')

    const result = completeWithReceipt('TASK-OWN-002', {
      fileName: 'receipt-ac.jpg',
      fileSize: 240_000,
      mimeType: 'image/jpeg',
      amount: 1_180_000,
    })
    expect(result.ok).toBe(true)

    const task = taskById('TASK-OWN-002')!
    expect(task.status).toBe('done')
    expect(task.progress).toBe(100)
    expect(task.finalInvoiceAmount).toBe(1_180_000)
    expect(task.receipt?.fileName).toBe('receipt-ac.jpg')
    expect(task.receipt?.uploadedAt).toBeTruthy()
  })

  it('lets a task with no owner charge complete without a receipt', () => {
    const { completeWithReceipt } = useTaskOwnerApproval()
    const result = completeWithReceipt('TASK-OWN-004', null)

    expect(result.ok).toBe(true)
    expect(taskById('TASK-OWN-004')!.status).toBe('done')
  })

  // --- Scoping ---------------------------------------------------------------

  it('scopes owner-visible tasks to the owner, and the queue to pending ones', () => {
    const { tasksForOwner, approvalsForOwner, pendingOwnerApprovals } = useTaskOwnerApproval()

    const putu = tasksForOwner('own-2').map(t => t.id)
    expect(putu).toContain('TASK-OWN-002')
    expect(putu).toContain('TASK-OWN-004')
    expect(putu).not.toContain('TASK-OWN-001')

    expect(approvalsForOwner('own-2').map(t => t.id)).toEqual(['TASK-OWN-002'])
    expect(approvalsForOwner('own-1')).toEqual([])
    expect(pendingOwnerApprovals.value.map(t => t.id)).toEqual(['TASK-OWN-002'])
  })

  it('never leaks another owner\'s tasks', () => {
    const { tasksForOwner } = useTaskOwnerApproval()
    for (const task of tasksForOwner('own-1'))
      expect(task.ownerId).toBe('own-1')
  })

  it('resolves the owner to ask from the task listing name', () => {
    const { ownerForTask } = useTaskOwnerApproval()
    // lst-1 is owned outright by Wayan Sari.
    expect(ownerForTask({ listing: '5BR Pool the R Villa Luwa – Serene near Canggu' })?.id).toBe('own-1')
    expect(ownerForTask({ listing: 'Not a listing' })).toBeNull()
    expect(ownerForTask({ listing: undefined })).toBeNull()
  })
  // --- Timeline entries ------------------------------------------------------

  it('records the actual cost and receipt in the timeline on completion', () => {
    const { ownerApprove, completeWithReceipt } = useTaskOwnerApproval()
    ownerApprove('TASK-OWN-002')
    const before = taskById('TASK-OWN-002')!.statusUpdates?.length ?? 0

    completeWithReceipt('TASK-OWN-002', {
      fileName: 'receipt-ac.jpg',
      fileSize: 240_000,
      mimeType: 'image/jpeg',
      amount: 1_180_000,
    })

    const task = taskById('TASK-OWN-002')!
    const updates = task.statusUpdates ?? []
    expect(updates.length).toBe(before + 1)
    const last = updates[updates.length - 1]!
    expect(last.progress).toBe(100)
    // Actor and verb are separate fields now — the feed renders them as
    // "<bold name> <grey verb>".
    expect(last.actor).toEqual({ name: 'Komang Juliantara', kind: 'staff' })
    expect(last.note).toBe('completed the task and uploaded the receipt')
    expect(last.icon).toBe('lucide:receipt')
    // The reported bug: the cost from the receipt never reached the timeline.
    // It is structured data now, so the timeline can render it as a card.
    expect(last.cost).toEqual({
      amount: 1_180_000,
      currency: 'IDR',
      quoted: 1_250_000,
      receipt: { fileName: 'receipt-ac.jpg', fileSize: 240_000, mimeType: 'image/jpeg' },
    })
  })

  it('notes an overspend against the quote', () => {
    const { ownerApprove, completeWithReceipt } = useTaskOwnerApproval()
    ownerApprove('TASK-OWN-002')
    completeWithReceipt('TASK-OWN-002', {
      fileName: 'r.pdf',
      fileSize: 100,
      mimeType: 'application/pdf',
      amount: 1_400_000,
    })

    const last = (taskById('TASK-OWN-002')!.statusUpdates ?? []).at(-1)!
    // The card derives over/under from amount vs quoted, so both must be present.
    expect(last.cost!.amount).toBe(1_400_000)
    expect(last.cost!.quoted).toBe(1_250_000)
  })

  it('records the owner decision in the timeline', () => {
    const { ownerApprove } = useTaskOwnerApproval()
    ownerApprove('TASK-OWN-002', 'Go ahead.')

    const updates = taskById('TASK-OWN-002')!.statusUpdates ?? []
    const last = updates[updates.length - 1]!
    expect(last.actor).toEqual({ name: 'I Putu Antara', kind: 'owner' })
    expect(last.note).toContain('approved the cost')
    // Amounts group with dots, Indonesian style.
    expect(last.note).toContain('IDR 1.250.000')
    expect(last.note).toContain('Go ahead.')
  })

  it('records a decline in the timeline', () => {
    const { ownerReject } = useTaskOwnerApproval()
    ownerReject('TASK-OWN-002', 'Get a second quote.')

    const last = (taskById('TASK-OWN-002')!.statusUpdates ?? []).at(-1)!
    expect(last.actor).toEqual({ name: 'I Putu Antara', kind: 'owner' })
    expect(last.note).toContain('declined the cost')
    expect(last.note).toContain('Get a second quote.')
  })

  it('completes without a cost note when there is no receipt', () => {
    const { completeWithReceipt } = useTaskOwnerApproval()
    completeWithReceipt('TASK-OWN-004', null)

    const updates = taskById('TASK-OWN-004')!.statusUpdates ?? []
    const last = updates[updates.length - 1]!
    expect(last.note).toBe('completed the task')
    expect(last.progress).toBe(100)
    // No receipt means no cost card and no receipt icon.
    expect(last.cost).toBeUndefined()
    expect(last.icon).toBeUndefined()
  })
})
