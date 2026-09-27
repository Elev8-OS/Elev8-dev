import { describe, expect, it } from 'vitest'
import { isTaskCompleted, TASK_STATUS_LABELS, TASK_STATUSES, taskSchema } from '~/components/tasks/data/schema'
import { mockTasks } from '~/components/tasks/data/tasks-mock'
import { progressKindFor, timelineSentence } from '~/components/tasks/data/timeline'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useTaskStore } from '~/composables/useTaskStore'

describe('task statuses', () => {
  it('are exactly Not started, In progress and Completed', () => {
    expect([...TASK_STATUSES]).toEqual(['not started', 'in progress', 'completed'])
    expect(Object.values(TASK_STATUS_LABELS)).toEqual(['Not started', 'In progress', 'Completed'])
  })

  it('rejects the old ones, Cancelled included', () => {
    for (const old of ['todo', 'backlog', 'done', 'canceled']) {
      const parsed = taskSchema.safeParse({ id: 'x', title: 't', status: old, priority: 'low' })
      expect(parsed.success).toBe(false)
    }
  })

  it('seeds every mock task with one of the three', () => {
    expect(mockTasks.every(t => (TASK_STATUSES as readonly string[]).includes(t.status))).toBe(true)
  })

  it('reads only Completed as completed', () => {
    expect(isTaskCompleted({ status: 'completed' })).toBe(true)
    expect(isTaskCompleted({ status: 'in progress' })).toBe(false)
    expect(isTaskCompleted({ status: 'not started' })).toBe(false)
  })
})

describe('timeline sentences', () => {
  const task = { listing: 'Apartments Pererenan Public' }

  it('says who created the task, and for which listing', () => {
    expect(timelineSentence({ kind: 'created' }, task)).toBe('has created a new task for Apartments Pererenan Public')
    expect(timelineSentence({ kind: 'created' }, {})).toBe('has created a new task')
  })

  it('says how far through the task someone is', () => {
    expect(timelineSentence({ kind: 'progress', progress: 31 }, task)).toBe('is 31% through the task')
  })

  it('says who completed the task', () => {
    expect(timelineSentence({ kind: 'completed', progress: 100 }, task)).toBe('has completed the task')
  })

  it('leaves an entry with no kind to its own note', () => {
    expect(timelineSentence({ progress: 0 }, task)).toBeNull()
  })

  it('treats a 100% update as completing the task, not "100% through"', () => {
    expect(progressKindFor(31)).toBe('progress')
    expect(progressKindFor(100)).toBe('completed')
  })

  it('gives every seeded create, progress and completion entry a kind and a person', () => {
    const entries = mockTasks.flatMap(t => t.statusUpdates ?? [])
    const kinded = entries.filter(e => e.kind)
    expect(kinded.length).toBeGreaterThan(0)
    expect(kinded.every(e => !!e.actor?.name)).toBe(true)
    // The old stored sentences are gone; the sentence is built from the kind.
    expect(entries.some(e => /task created|created the task/i.test(e.note ?? ''))).toBe(false)
  })
})

describe('creating a task writes its first timeline entry', () => {
  it('as "<you> has created a new task for <listing>"', () => {
    useCurrentDashboardUser().setCurrentUserId('user-1')
    const { addTask } = useTaskStore()
    const created = addTask({ title: 'Fix the pump', status: 'not started', priority: 'high', listing: 'Villa One' })
    const first = created.statusUpdates![0]!
    expect(first.kind).toBe('created')
    expect(first.actor?.name).toBe('Komang Juliantara')
    expect(first.note).toBeUndefined()
    expect(`${first.actor!.name} ${timelineSentence(first, created)}`)
      .toBe('Komang Juliantara has created a new task for Villa One')
  })
})
