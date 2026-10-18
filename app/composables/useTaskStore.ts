import type { StatusUpdate, Task, TaskStatus } from '@/components/tasks/data/schema'
import { mockTasks } from '@/components/tasks/data/tasks-mock'
import { useCurrentDashboardUser } from './useCurrentDashboardUser'
import { useHostBuddyInventorySync } from './useHostBuddyInventorySync'

/** What the Edit Task form can change. The assignee changes through `reassignTask`. */
export type TaskEdit = Partial<Pick<Task, 'title' | 'description' | 'listing' | 'priority' | 'dueDate' | 'images'>>

/** The word each field is in "changed the title and due date". */
const EDIT_WORDS: Record<keyof TaskEdit, string> = {
  title: 'title',
  description: 'instructions',
  listing: 'listing',
  priority: 'priority',
  dueDate: 'due date',
  images: 'images',
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b))
    return JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
  return (a ?? '') === (b ?? '')
}

export function useTaskStore() {
  const tasks = useState<Task[]>('tasks', () => mockTasks.map(t => ({ ...t })))
  const { syncOnCreate, syncOnStatusChange, syncOnDelete } = useHostBuddyInventorySync()

  /**
   * `created` overrides parts of the "has created a new task" entry, e.g. a
   * scheduled task credits whoever set up the schedule and notes it.
   */
  function addTask(data: Omit<Task, 'id'>, options: { created?: Partial<StatusUpdate> } = {}): Task {
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
        { date: now, actor: { name: creator, kind: 'staff' }, kind: 'created', progress: 0, ...options.created },
        ...(data.statusUpdates || []),
      ],
    }
    // Newest first, so a new task is on the first page of the table.
    tasks.value = [task, ...tasks.value]
    syncOnCreate(task)
    return task
  }

  function updateTask(id: string, data: Partial<Omit<Task, 'id'>>) {
    tasks.value = tasks.value.map(t =>
      t.id === id ? { ...t, ...data } : t,
    )
  }

  function actorName(): string {
    return useCurrentDashboardUser().currentUser.value?.name ?? 'Komang Juliantara'
  }

  /**
   * Saves an edit and logs "<you> changed the title and due date". Fields that
   * did not change are left out of the sentence; an edit that changes nothing
   * logs nothing. Never touches the assignee (see `reassignTask`), the status
   * or the progress. Returns the words that changed.
   */
  function editTask(id: string, data: TaskEdit): string[] {
    const task = tasks.value.find(t => t.id === id)
    if (!task)
      return []
    const changes = (Object.keys(EDIT_WORDS) as Array<keyof TaskEdit>)
      .filter(key => key in data && !sameValue(task[key], data[key]))
      .map(key => EDIT_WORDS[key])
    if (!changes.length)
      return []
    tasks.value = tasks.value.map(t => t.id === id
      ? {
          ...t,
          ...data,
          statusUpdates: [...(t.statusUpdates || []), {
            date: new Date().toISOString(),
            actor: { name: actorName(), kind: 'staff' as const },
            kind: 'edited' as const,
            changes,
          }],
        }
      : t)
    return changes
  }

  /**
   * Hands the task to someone else (or a role). The reason is required and
   * shows under "<you> reassigned the task to <name>". Status and progress
   * carry over: a task at 30% stays at 30%.
   */
  function reassignTask(id: string, to: { value: string, label: string, type: 'role' | 'person' }, reason: string): boolean {
    const task = tasks.value.find(t => t.id === id)
    const note = reason.trim()
    if (!task || !note || task.assignee === to.value)
      return false
    tasks.value = tasks.value.map(t => t.id === id
      ? {
          ...t,
          assignee: to.value,
          assigneeType: to.type,
          statusUpdates: [...(t.statusUpdates || []), {
            date: new Date().toISOString(),
            actor: { name: actorName(), kind: 'staff' as const },
            kind: 'reassigned' as const,
            assignedTo: to.label,
            note,
          }],
        }
      : t)
    return true
  }

  /**
   * A progress entry also moves the status: any progress starts a "not started"
   * task, and 100% completes it (through `updateStatus`, so the inventory sync
   * still runs). 0% never changes the status.
   */
  function addStatusUpdate(id: string, entry: StatusUpdate) {
    const before = tasks.value.find(t => t.id === id)
    tasks.value = tasks.value.map((t) => {
      if (t.id !== id)
        return t
      const updates = [...(t.statusUpdates || []), entry]
      return { ...t, statusUpdates: updates, progress: entry.progress ?? t.progress }
    })
    if (!before || entry.progress === undefined)
      return
    if (entry.progress >= 100 && before.status !== 'completed')
      updateStatus(id, 'completed')
    else if (entry.progress > 0 && entry.progress < 100 && before.status === 'not started')
      updateStatus(id, 'in progress')
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
    editTask,
    reassignTask,
    addStatusUpdate,
    updateStatus,
    addImage,
    deleteTask,
  }
}
