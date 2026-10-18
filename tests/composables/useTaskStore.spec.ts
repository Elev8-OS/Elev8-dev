import type { Task } from '~/components/tasks/data/schema'
import { beforeEach, describe, expect, it } from 'vitest'
import { mockTasks } from '~/components/tasks/data/tasks-mock'
import { useTaskStore } from '~/composables/useTaskStore'

const actor = { name: 'Komang Juliantara', kind: 'staff' as const }

function entry(progress: number) {
  return { date: new Date().toISOString(), actor, kind: progress >= 100 ? 'completed' as const : 'progress' as const, progress }
}

describe('useTaskStore addStatusUpdate', () => {
  let id: string

  beforeEach(() => {
    const tasks = useState<Task[]>('tasks')
    tasks.value = mockTasks.map(t => ({ ...t }))
    const fresh = tasks.value.find(t => t.status === 'not started')!
    id = fresh.id
  })

  it('starts a not started task on any progress', () => {
    const { tasks, addStatusUpdate } = useTaskStore()
    addStatusUpdate(id, entry(30))
    expect(tasks.value.find(t => t.id === id)?.status).toBe('in progress')
  })

  it('leaves the status alone at 0%', () => {
    const { tasks, addStatusUpdate } = useTaskStore()
    addStatusUpdate(id, entry(0))
    expect(tasks.value.find(t => t.id === id)?.status).toBe('not started')
  })

  it('completes the task at 100%', () => {
    const { tasks, addStatusUpdate } = useTaskStore()
    addStatusUpdate(id, entry(100))
    expect(tasks.value.find(t => t.id === id)?.status).toBe('completed')
  })
})
