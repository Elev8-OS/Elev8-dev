/**
 * Scheduled (recurring) tasks.
 *
 * A schedule is a task template plus a repeat rule: "Pool cleaning every
 * Monday at Villa Merapi", "AC service every 3 months at three listings". It
 * never shows up in the task list itself. `useTaskSchedules().generateDueTasks`
 * turns each occurrence into a real task `leadDays` before it is due, one task
 * per listing, so the team works it like any other task.
 *
 * Dates are local `YYYY-MM-DD` strings throughout (`toISOString()` would shift
 * a UTC+8 midnight to the day before).
 */

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly'

export type ScheduleEnd
  = | { type: 'never' }
    | { type: 'on', date: string }
    | { type: 'after', count: number }

export type ScheduleStatus = 'active' | 'paused'

export interface TaskSchedule {
  id: string
  /** Typed in the form; becomes the title of every task the schedule makes. */
  title: string
  /** Optional, may be empty. */
  instructions: string
  /** Listing NAMES (what `Task.listing` stores). Each occurrence makes one task per listing; empty = one task with no listing. */
  listings: string[]
  assignee?: string
  assigneeType?: 'role' | 'person'
  priority: string
  images?: string[]
  frequency: ScheduleFrequency
  /** Every N days / weeks / months. */
  interval: number
  /** Weekly only: 0 = Sunday … 6 = Saturday. */
  weekdays: number[]
  /** The first due date; a monthly schedule repeats on this day of the month. */
  startDate: string
  end: ScheduleEnd
  /** How many days before its due date each task is created (0 = on the day). */
  leadDays: number
  status: ScheduleStatus
  createdAt: string
  createdBy: string
  /**
   * `${dueDate}|${listing}` of every task this schedule has already made, so a
   * task someone deleted is not made again on the next run.
   */
  generated: string[]
}

export type TaskScheduleInput = Omit<TaskSchedule, 'id' | 'status' | 'createdAt' | 'createdBy' | 'generated'>

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
/** Monday-first, the order the weekday picker shows. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export const FREQUENCY_UNIT: Record<ScheduleFrequency, [string, string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
}

/** Safety cap on how far an occurrence walk goes. */
const MAX_STEPS = 5000

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function todayKey(): string {
  return dayKey(new Date())
}

export function addDays(key: string, days: number): string {
  const d = parseDay(key)
  d.setDate(d.getDate() + days)
  return dayKey(d)
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Every due date of a schedule in order, from its start date, honouring its
 * end rule. A monthly schedule started on the 31st lands on the last day of
 * shorter months. Stops at `until` (inclusive) when given; a schedule that
 * never ends needs one.
 */
export function* occurrences(
  schedule: Pick<TaskSchedule, 'frequency' | 'interval' | 'weekdays' | 'startDate' | 'end'>,
  until?: string,
): Generator<string> {
  const interval = Math.max(1, Math.floor(schedule.interval || 1))
  const endDate = schedule.end.type === 'on' ? schedule.end.date : undefined
  const maxCount = schedule.end.type === 'after' ? Math.max(0, schedule.end.count) : Infinity
  const limit = [endDate, until].filter(Boolean).sort()[0]
  let count = 0

  function* emit(key: string): Generator<string, boolean> {
    if (limit && key > limit)
      return false
    if (count >= maxCount)
      return false
    count++
    yield key
    return true
  }

  if (schedule.frequency === 'daily') {
    for (let i = 0; i < MAX_STEPS; i++) {
      if (!(yield* emit(addDays(schedule.startDate, i * interval))))
        return
    }
    return
  }

  if (schedule.frequency === 'weekly') {
    const start = parseDay(schedule.startDate)
    const days = schedule.weekdays.length ? schedule.weekdays : [start.getDay()]
    // Monday of the start week; every `interval`-th week from there is "on".
    const weekStart = addDays(schedule.startDate, -((start.getDay() + 6) % 7))
    const offsets = [...new Set(days)].map(d => (d + 6) % 7).sort((a, b) => a - b)
    for (let w = 0; w < MAX_STEPS; w++) {
      const monday = addDays(weekStart, w * interval * 7)
      for (const offset of offsets) {
        const key = addDays(monday, offset)
        if (key < schedule.startDate)
          continue
        if (!(yield* emit(key)))
          return
      }
    }
    return
  }

  const start = parseDay(schedule.startDate)
  for (let i = 0; i < MAX_STEPS; i++) {
    const monthIndex = start.getMonth() + i * interval
    const year = start.getFullYear() + Math.floor(monthIndex / 12)
    const month = ((monthIndex % 12) + 12) % 12
    const day = Math.min(start.getDate(), daysInMonth(year, month))
    if (!(yield* emit(dayKey(new Date(year, month, day)))))
      return
  }
}

/** The next `limit` due dates on or after `from`. */
export function upcomingOccurrences(schedule: TaskSchedule, from: string, limit: number): string[] {
  const out: string[] = []
  // Bounded by `limit`, so a never-ending schedule is fine here.
  for (const key of occurrences(schedule)) {
    if (key < from)
      continue
    out.push(key)
    if (out.length >= limit)
      break
  }
  return out
}

export function nextOccurrence(schedule: TaskSchedule, from: string): string | null {
  return upcomingOccurrences(schedule, from, 1)[0] ?? null
}

/**
 * Due dates whose task should exist by `today`: due today or later, and
 * within the lead time. Past occurrences are never backfilled.
 */
export function dueOccurrences(schedule: TaskSchedule, today: string): string[] {
  if (schedule.status !== 'active')
    return []
  const horizon = addDays(today, Math.max(0, schedule.leadDays))
  return [...occurrences(schedule, horizon)].filter(key => key >= today)
}

export function generatedKey(dueDate: string, listing: string | undefined): string {
  return `${dueDate}|${listing ?? ''}`
}

function ordinal(n: number): string {
  const rem = n % 100
  if (rem >= 11 && rem <= 13)
    return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
export function formatDay(key: string): string {
  return dateFormat.format(parseDay(key))
}

/** "Weekly on Mon, Thu", "Every 3 months on the 15th", "Daily, 10 times". */
export function describeRecurrence(
  schedule: Pick<TaskSchedule, 'frequency' | 'interval' | 'weekdays' | 'startDate' | 'end'>,
): string {
  const interval = Math.max(1, Math.floor(schedule.interval || 1))
  const [one, many] = FREQUENCY_UNIT[schedule.frequency]
  let text = interval === 1
    ? { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[schedule.frequency]
    : `Every ${interval} ${interval === 1 ? one : many}`

  if (schedule.frequency === 'weekly') {
    const days = schedule.weekdays.length ? schedule.weekdays : [parseDay(schedule.startDate).getDay()]
    const ordered = WEEKDAY_ORDER.filter(d => days.includes(d))
    text += ` on ${ordered.map(d => WEEKDAY_SHORT[d]).join(', ')}`
  }
  else if (schedule.frequency === 'monthly') {
    text += ` on the ${ordinal(parseDay(schedule.startDate).getDate())}`
  }

  if (schedule.end.type === 'on')
    text += `, until ${formatDay(schedule.end.date)}`
  else if (schedule.end.type === 'after')
    text += `, ${schedule.end.count} ${schedule.end.count === 1 ? 'time' : 'times'}`
  return text
}
