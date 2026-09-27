import type { StatusUpdate, Task, TaskStatus } from '@/components/tasks/data/schema'
import { mockTasks } from '@/components/tasks/data/tasks-mock'
import { useCurrentDashboardUser } from './useCurrentDashboardUser'
import { useHostBuddyInventorySync } from './useHostBuddyInventorySync'

export function useTaskStore() {
  const tasks = useState<Task[]>('tasks', () => mockTasks.map(t => ({ ...t })))
  const { syncOnCreate, syncOnStatusChange, syncOnDelete } = useHostBuddyInventorySync()

  function addTask(data: Omit<Task, 'id'>): Task {
    const id = `TASK-${Math.floor(1000 + Math.random() * 9000)}`
    const now = new Date().toISOString()
    // "<you> has created a new task for <listing>": the sentence is built from
    // `kind` by the timeline (`timelineSentence`), not stored here.
    const creator = useCurrentDashboardUser().currentUser.value?.name ?? 'Komang Juliantara'
    const task: Task = {
      ...data,
      id,
      createdAt: now,
      statusUpdates: [
        { date: now, actor: { name: creator, kind: 'staff' }, kind: 'created', progress: 0 },
        ...(data.statusUpdates || []),
      ],
    }
    tasks.value = [...tasks.value, task]
    syncOnCreate(task)
    return task
  }

  function updateTask(id: string, data: Partial<Omit<Task, 'id'>>) {
    tasks.value = tasks.value.map(t =>
      t.id === id ? { ...t, ...data } : t,
    )
  }

  function addStatusUpdate(id: string, entry: StatusUpdate) {
    tasks.value = tasks.value.map((t) => {
      if (t.id !== id)
        return t
      const updates = [...(t.statusUpdates || []), entry]
      return { ...t, statusUpdates: updates, progress: entry.progress ?? t.progress }
    })
  }

  function updateStatus(id: string, status: TaskStatus) {
    const task = tasks.value.find(t => t.id === id)
    if (!task)
      return
    tasks.value = tasks.value.map(t => t.id === id ? { ...t, status } : t)
    syncOnStatusChange(task, status)
  }

  function addImage(id: string, base64: string) {
    tasks.value = tasks.value.map((t) => {
      if (t.id !== id)
        return t
      const images = [...(t.images || []), base64]
      return { ...t, images }
    })
  }

  function deleteTask(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (task)
      syncOnDelete(task)
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  return {
    tasks,
    addTask,
    updateTask,
    addStatusUpdate,
    updateStatus,
    addImage,
    deleteTask,
  }
}
