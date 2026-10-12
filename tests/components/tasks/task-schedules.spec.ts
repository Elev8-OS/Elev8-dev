import type { TaskSchedule, TaskScheduleInput } from '~/components/tasks/data/schedule'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, describeRecurrence, dueOccurrences, occurrences, todayKey, upcomingOccurrences } from '~/components/tasks/data/schedule'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useTaskSchedules } from '~/composables/useTaskSchedules'
import { useTaskStore } from '~/composables/useTaskStore'

function schedule(over: Partial<TaskSchedule> = {}): TaskSchedule {
  return {
    id: 'SCH-T',
    title: 'Pool cleaning',
    instructions: 'Pool cleaning\nSkim and brush.',
    listings: ['The R Villa Merapi'],
    priority: 'medium',
    frequency: 'weekly',
    interval: 1,
    weekdays: [1],
    startDate: '2026-10-12', // a Monday
    end: { type: 'never' },
    leadDays: 0,
    status: 'active',
    createdAt: '2026-10-01T00:00:00Z',
    createdBy: 'Komang Juliantara',
    generated: [],
    ...over,
  }
}

function input(over: Partial<TaskScheduleInput> = {}): TaskScheduleInput {
  const { id, title, status, createdAt, createdBy, generated, ...rest } = schedule()
  return { ...rest, ...over }
}

describe('occurrences', () => {
  it('repeats daily every N days', () => {
    const s = schedule({ frequency: 'daily', interval: 3, weekdays: [] })
    expect(upcomingOccurrences(s, '2026-10-12', 3)).toEqual(['2026-10-12', '2026-10-15', '2026-10-18'])
  })

  it('repeats weekly on the picked days, Monday-first, skipping days before the start', () => {
    // Starts on a Wednesday, repeats Mon and Thu: the first Monday is next week.
    const s = schedule({ startDate: '2026-10-14', weekdays: [1, 4] })
    expect(upcomingOccurrences(s, '2026-10-01', 4)).toEqual(['2026-10-15', '2026-10-19', '2026-10-22', '2026-10-26'])
  })

  it('skips the off weeks of an every-2-weeks schedule', () => {
    const s = schedule({ interval: 2, weekdays: [1, 5] })
    expect(upcomingOccurrences(s, '2026-10-12', 4)).toEqual(['2026-10-12', '2026-10-16', '2026-10-26', '2026-10-30'])
  })

  it('lands a monthly schedule started on the 31st on the last day of short months', () => {
    const s = schedule({ frequency: 'monthly', weekdays: [], startDate: '2026-12-31' })
    expect(upcomingOccurrences(s, '2026-12-01', 3)).toEqual(['2026-12-31', '2027-01-31', '2027-02-28'])
  })

  it('stops after N times and at the end date', () => {
    expect([...occurrences(schedule({ end: { type: 'after', count: 2 } }))]).toEqual(['2026-10-12', '2026-10-19'])
    expect([...occurrences(schedule({ end: { type: 'on', date: '2026-10-26' } }))]).toEqual(['2026-10-12', '2026-10-19', '2026-10-26'])
  })

  it('makes tasks only for dates within the lead time, never the past, never while paused', () => {
    const s = schedule({ frequency: 'daily', weekdays: [], startDate: '2026-10-01', leadDays: 2 })
    expect(dueOccurrences(s, '2026-10-12')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14'])
    expect(dueOccurrences({ ...s, status: 'paused' }, '2026-10-12')).toEqual([])
  })

  it('reads as a sentence', () => {
    expect(describeRecurrence(schedule({ weekdays: [4, 1] }))).toBe('Weekly on Mon, Thu')
    expect(describeRecurrence(schedule({ frequency: 'monthly', interval: 3, startDate: '2026-10-22' }))).toBe('Every 3 months on the 22nd')
    expect(describeRecurrence(schedule({ frequency: 'daily', end: { type: 'after', count: 5 } }))).toBe('Daily, 5 times')
  })
})

describe('useTaskSchedules', () => {
  beforeEach(() => {
    useCurrentDashboardUser().setCurrentUserId('user-1')
    // Start without the demo schedules so counts are exact.
    useTaskSchedules().schedules.value = []
  })

  it('makes one task per listing for a date that has come due, crediting the schedule', () => {
    const today = todayKey()
    const { tasks } = useTaskStore()
    const { addSchedule } = useTaskSchedules()
    const { schedule: made, created } = addSchedule(input({
      frequency: 'daily',
      weekdays: [],
      startDate: today,
      listings: ['The R Villa Merapi', 'Villa Sunset Cliff'],
      leadDays: 0,
    }))

    expect(created).toHaveLength(2)
    expect(created.map(t => t.listing)).toEqual(['The R Villa Merapi', 'Villa Sunset Cliff'])
    expect(created.every(t => t.dueDate === today && t.scheduleId === made.id && t.title === 'Pool cleaning')).toBe(true)
    expect(tasks.value.filter(t => t.scheduleId === made.id)).toHaveLength(2)
    expect(created[0]!.statusUpdates![0]).toMatchObject({ kind: 'created', icon: 'lucide:repeat' })
  })

  it('does not make the same task twice, or again after it was deleted', () => {
    const today = todayKey()
    const { tasks, deleteTask } = useTaskStore()
    const { addSchedule, generateDueTasks } = useTaskSchedules()
    const { schedule: made, created } = addSchedule(input({ frequency: 'daily', weekdays: [], startDate: today }))

    expect(generateDueTasks()).toEqual([])
    deleteTask(created[0]!.id)
    expect(generateDueTasks()).toEqual([])
    expect(tasks.value.some(t => t.scheduleId === made.id)).toBe(false)
  })

  it('waits for the lead time before making a future task', () => {
    const { addSchedule } = useTaskSchedules()
    const { created } = addSchedule(input({ frequency: 'daily', weekdays: [], startDate: addDays(todayKey(), 5), leadDays: 2 }))
    expect(created).toEqual([])
  })

  it('makes nothing while paused and catches up on resume', () => {
    const { addSchedule, setScheduleStatus } = useTaskSchedules()
    const start = addDays(todayKey(), 1)
    const { schedule: made } = addSchedule(input({ frequency: 'daily', weekdays: [], startDate: start, leadDays: 0 }))
    setScheduleStatus(made.id, 'paused')
    expect(setScheduleStatus(made.id, 'active')).toEqual([])
    const { schedules, updateSchedule } = useTaskSchedules()
    // Pulling the start to today makes today's task on save.
    expect(updateSchedule(made.id, input({ frequency: 'daily', weekdays: [], startDate: todayKey() }))).toHaveLength(1)
    expect(schedules.value[0]!.generated).toHaveLength(1)
  })

  it('leaves the tasks it made when the schedule is deleted', () => {
    const { tasks } = useTaskStore()
    const { addSchedule, deleteSchedule, schedules } = useTaskSchedules()
    const { schedule: made } = addSchedule(input({ frequency: 'daily', weekdays: [], startDate: todayKey() }))
    deleteSchedule(made.id)
    expect(schedules.value).toEqual([])
    expect(tasks.value.some(t => t.scheduleId === made.id)).toBe(true)
  })
})
