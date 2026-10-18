import type { Task } from '~/components/tasks/data/schema'
import { describe, expect, it } from 'vitest'
import { buildTasksSheet, TASK_EXPORT_COLUMNS, tasksExportFileName } from '~/lib/task-export'

const task: Task = {
  id: 'TASK-1001',
  title: 'Fix the gate',
  status: 'in progress',
  priority: 'high',
  assignee: 'housekeeping',
  assigneeType: 'role',
  listing: 'The R Villa Merapi',
  dueDate: '2026-10-20',
  progress: 40,
  createdAt: '2026-10-18T08:30:00Z',
}

describe('buildTasksSheet', () => {
  it('writes a bold header row and one row per task', () => {
    const sheet = buildTasksSheet([task, { ...task, id: 'TASK-1002' }]) as any[][]
    expect(sheet).toHaveLength(3)
    expect(sheet[0].map(c => c.value)).toEqual(TASK_EXPORT_COLUMNS.map(c => c.header))
    expect(sheet[0][0].fontWeight).toBe('bold')
  })

  it('uses labels for status, priority and assignee, and numbers for progress', () => {
    const row = (buildTasksSheet([task]) as any[][])[1]
    const at = (h: string) => row[TASK_EXPORT_COLUMNS.findIndex(c => c.header === h)]
    expect(at('Status').value).toBe('In progress')
    expect(at('Priority').value).toBe('High')
    expect(at('Assignee').value).toBe('Housekeeping')
    expect(at('Progress %')).toEqual({ type: Number, value: 40 })
  })

  it('writes the due date as a UTC midnight date so UTC+8 does not shift it back', () => {
    const row = (buildTasksSheet([task]) as any[][])[1]
    const due = row[TASK_EXPORT_COLUMNS.findIndex(c => c.header === 'Due Date')]
    expect(due.type).toBe(Date)
    expect(due.value.toISOString()).toBe('2026-10-20T00:00:00.000Z')
  })

  it('leaves missing values empty', () => {
    const row = (buildTasksSheet([{ ...task, listing: undefined, dueDate: undefined }]) as any[][])[1]
    expect(row[TASK_EXPORT_COLUMNS.findIndex(c => c.header === 'Listing')]).toBeNull()
    expect(row[TASK_EXPORT_COLUMNS.findIndex(c => c.header === 'Due Date')]).toBeNull()
  })
})

describe('tasksExportFileName', () => {
  it('uses the local date', () => {
    expect(tasksExportFileName(new Date(2026, 9, 5))).toBe('tasks-2026-10-05.xlsx')
  })
})

describe('completed At', () => {
  const at = (t: Task) => (buildTasksSheet([t]) as any[][])[1][TASK_EXPORT_COLUMNS.findIndex(c => c.header === 'Completed At')]

  it('is the last completed timeline entry of a completed task', () => {
    const done = { ...task, status: 'completed' as const, statusUpdates: [
      { date: '2026-10-18T08:30:00Z', actor: { name: 'A', kind: 'staff' as const }, kind: 'created' as const },
      { date: '2026-10-19T10:00:00Z', actor: { name: 'A', kind: 'staff' as const }, kind: 'completed' as const, progress: 100 },
    ] }
    expect(at(done).value.toISOString()).toBe('2026-10-19T10:00:00.000Z')
  })

  it('is empty while the task is not completed', () => {
    expect(at(task)).toBeNull()
  })
})
