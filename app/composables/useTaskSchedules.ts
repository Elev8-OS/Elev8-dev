import type { TaskSchedule, TaskScheduleInput } from '@/components/tasks/data/schedule'
import type { Task } from '@/components/tasks/data/schema'
import { describeRecurrence, dueOccurrences, generatedKey, todayKey } from '@/components/tasks/data/schedule'
import { mockTaskSchedules } from '@/components/tasks/data/schedules-mock'
import { useCurrentDashboardUser } from './useCurrentDashboardUser'
import { useTaskStore } from './useTaskStore'

/**
 * Recurring task schedules (see `components/tasks/data/schedule.ts`).
 *
 * ⚠️ A schedule only makes tasks when `generateDueTasks` runs: the Tasks page
 * calls it on mount, and every add / edit / resume here calls it straight
 * away. Tasks it made are ordinary tasks afterwards (`Task.scheduleId` is
 * provenance only): editing, pausing or deleting the schedule leaves them be.
 */
export function useTaskSchedules() {
  const schedules = useState<TaskSchedule[]>('task-schedules', () => mockTaskSchedules())
  const { addTask } = useTaskStore()

  function creatorName(): string {
    return useCurrentDashboardUser().currentUser.value?.name ?? 'Komang Juliantara'
  }

  /** Make every task that is due (within its lead time) and not made yet. */
  function generateDueTasks(today: string = todayKey()): Task[] {
    const created: Task[] = []
    const next = schedules.value.map((schedule) => {
      const made: string[] = []
      for (const dueDate of dueOccurrences(schedule, today)) {
        const targets = schedule.listings.length ? schedule.listings : [undefined]
        for (const listing of targets) {
          const key = generatedKey(dueDate, listing)
          if (schedule.generated.includes(key) || made.includes(key))
            continue
          made.push(key)
          created.push(addTask({
            title: schedule.title,
            status: 'not started',
            assignee: schedule.assignee,
            assigneeType: schedule.assignee ? schedule.assigneeType : undefined,
            priority: schedule.priority,
            listing,
            description: schedule.instructions || undefined,
            dueDate,
            images: schedule.images?.length ? [...schedule.images] : undefined,
            scheduleId: schedule.id,
          }, {
            created: {
              actor: { name: schedule.createdBy, kind: 'staff' },
              icon: 'lucide:repeat',
              note: `Scheduled task, repeats ${describeRecurrence(schedule).toLowerCase()}.`,
            },
          }))
        }
      }
      return made.length ? { ...schedule, generated: [...schedule.generated, ...made] } : schedule
    })
    if (created.length)
      schedules.value = next
    return created
  }

  function addSchedule(input: TaskScheduleInput): { schedule: TaskSchedule, created: Task[] } {
    const schedule: TaskSchedule = {
      ...input,
      id: `SCH-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: creatorName(),
      generated: [],
    }
    schedules.value = [...schedules.value, schedule]
    return { schedule, created: generateDueTasks() }
  }

  /**
   * Edits apply to tasks made from now on. `generated` is kept, so moving the
   * start date or listings never duplicates a task that already exists.
   */
  function updateSchedule(id: string, input: TaskScheduleInput): Task[] {
    schedules.value = schedules.value.map(s => s.id === id
      ? { ...s, ...input }
      : s)
    return generateDueTasks()
  }

  function setScheduleStatus(id: string, status: TaskSchedule['status']): Task[] {
    schedules.value = schedules.value.map(s => s.id === id ? { ...s, status } : s)
    return status === 'active' ? generateDueTasks() : []
  }

  function deleteSchedule(id: string) {
    schedules.value = schedules.value.filter(s => s.id !== id)
  }

  return {
    schedules,
    generateDueTasks,
    addSchedule,
    updateSchedule,
    setScheduleStatus,
    deleteSchedule,
  }
}
