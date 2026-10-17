import type { WeekDay, WorkingHours } from '~/components/users/data/roles'
import { parseLocalDateKey, toLocalDateKey } from '~/components/activities/data/activities'
import { WEEK_DAYS } from '~/components/users/data/roles'

/**
 * Who works when. The role's `workingHours` is the default, a person can have their own weekly days
 * (`personDays`), and a single date can be overridden (a day off, or an extra working day). Pure
 * functions only: `useSchedule` holds the state. All dates are local `YYYY-MM-DD` keys.
 */

export type DayOffType = 'weekly' | 'leave' | 'sick' | 'holiday' | 'swap' | 'other'

export const DAY_OFF_TYPES: { value: Exclude<DayOffType, 'weekly'>, label: string }[] = [
  { value: 'leave', label: 'Leave' },
  { value: 'sick', label: 'Sick day' },
  { value: 'holiday', label: 'Public holiday' },
  { value: 'swap', label: 'Day swap' },
  { value: 'other', label: 'Other' },
]

export function dayOffLabel(type: DayOffType): string {
  return type === 'weekly' ? 'Day off' : DAY_OFF_TYPES.find(t => t.value === type)?.label ?? 'Day off'
}

export type ShiftTone = 'primary' | 'warning' | 'chart-1' | 'chart-3' | 'chart-5'

/** Static class strings (Tailwind only sees whole class names). Theme tokens only. */
export const SHIFT_TONES: { value: ShiftTone, label: string, cell: string, dot: string }[] = [
  { value: 'primary', label: 'Primary', cell: 'border-primary/40 bg-primary/10', dot: 'bg-primary' },
  { value: 'warning', label: 'Gold', cell: 'border-warning/60 bg-warning/15', dot: 'bg-warning' },
  { value: 'chart-1', label: 'Light blue', cell: 'border-chart-1/60 bg-chart-1/15', dot: 'bg-chart-1' },
  { value: 'chart-3', label: 'Blue', cell: 'border-chart-3/50 bg-chart-3/10', dot: 'bg-chart-3' },
  { value: 'chart-5', label: 'Deep blue', cell: 'border-chart-5/50 bg-chart-5/10', dot: 'bg-chart-5' },
]

export const toneOf = (tone?: ShiftTone) => SHIFT_TONES.find(t => t.value === tone) ?? SHIFT_TONES[0]!

/** A named set of hours (Morning, Afternoon...) that can be a person's default or set on a date. */
export interface ShiftTemplate {
  id: string
  name: string
  /** `HH:mm`. An end earlier than the start means the shift runs past midnight into the next day. */
  start: string
  end: string
  /** Unpaid minutes inside the shift. */
  breakMinutes: number
  tone: ShiftTone
}

/** An extra shift of a day (the second, third...). Same snapshot rule as the first: name, tone and break are copied from the template. */
export interface OverrideSegment {
  startTime: string
  endTime: string
  shiftId?: string
  shiftName?: string
  shiftTone?: ShiftTone
  breakMinutes?: number
}

/** One person, one date. `day_off` takes the day away, `working` adds it (optionally with its own hours). */
export interface ScheduleOverride {
  id: string
  userId: string
  date: string
  kind: 'day_off' | 'working'
  dayOffType?: Exclude<DayOffType, 'weekly'>
  /** `HH:mm`. A `working` override without hours keeps the role's hours. */
  startTime?: string
  endTime?: string
  /**
   * Set when the day was given a shift. The shift's name, hours and break are copied into this
   * override (a snapshot), so editing or deleting the template later never changes a day already set.
   * The id is provenance only.
   */
  shiftId?: string
  shiftName?: string
  shiftTone?: ShiftTone
  breakMinutes?: number
  /** More shifts the same day (a split shift), in time order. Only with hours on the first one; each starts after the one before it ends. */
  extra?: OverrideSegment[]
  note?: string
  createdAt: string
  createdBy: string
}

export interface ScheduledShift {
  /** Unset for a flexible schedule: no fixed hours. */
  start?: string
  end?: string
  flexible: boolean
  /** Set when the day comes from a named shift. */
  name?: string
  tone?: ShiftTone
  breakMinutes?: number
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Paid minutes of a fixed shift (length minus its break), or undefined without fixed hours. */
export function shiftMinutes(shift: ScheduledShift): number | undefined {
  if (shift.flexible || !shift.start || !shift.end)
    return undefined
  return Math.max(0, shiftLength(shift.start, shift.end) - (shift.breakMinutes ?? 0))
}

/** Minutes from start to end. An end earlier than the start runs past midnight (22:00 to 06:00 is 8 hours). */
export function shiftLength(start: string, end: string): number {
  const length = toMinutes(end) - toMinutes(start)
  return length > 0 ? length : length + 1440
}

/** True when the shift ends on the next day. */
export function spansMidnight(start: string, end: string): boolean {
  return toMinutes(end) <= toMinutes(start)
}

export function templateShift(t: ShiftTemplate): ScheduledShift {
  return { start: t.start, end: t.end, flexible: false, name: t.name, tone: t.tone, breakMinutes: t.breakMinutes }
}

export type ScheduleSource = 'role' | 'person' | 'rotation' | 'override'

export type ScheduledDay =
  /** `shift` is the first of `segments`. A split shift has two, in time order. */
  | { working: true, shift: ScheduledShift, segments: ScheduledShift[], source: ScheduleSource, note?: string }
  | { working: false, reason: DayOffType, source: ScheduleSource, note?: string }

const DAY_BY_INDEX: WeekDay[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function weekDayOf(dateKey: string): WeekDay {
  return DAY_BY_INDEX[parseLocalDateKey(dateKey).getDay()]!
}

function shiftOf(hours: WorkingHours): ScheduledShift {
  if (hours.scheduleType === 'fixed' && hours.startTime && hours.endTime)
    return { start: hours.startTime, end: hours.endTime, flexible: false }
  return { flexible: true }
}

/** The days a person works in a normal week: their own days if set, else the role's. */
export function effectiveDays(hours: WorkingHours, personDays?: WeekDay[]): WeekDay[] {
  return personDays ?? hours.days
}

/** One day of a rotation: a day off, or the shifts worked (ids of shift templates). */
export type RotationCell = 'off' | string[]

/**
 * A pattern of one or more weeks that repeats by itself. Week 1 is the week of `startDate` (a Monday), then
 * week 2, and so on, and after the last week it starts again. A weekday missing from a week is a day off.
 * It sits between a dated override and the person's weekly days, and only applies from `startDate`.
 */
export interface ScheduleRotation {
  userId: string
  /** Monday, `YYYY-MM-DD`. */
  startDate: string
  weeks: Partial<Record<WeekDay, RotationCell>>[]
}

export const MAX_ROTATION_WEEKS = 8

function daysBetween(from: string, to: string): number {
  return Math.round((parseLocalDateKey(to).getTime() - parseLocalDateKey(from).getTime()) / 86400000)
}

/** The rotation cell for a date: undefined before it starts (or with no rotation), else `off` or the shift templates. */
export function rotationDayFor(rotation: ScheduleRotation | undefined, dateKey: string, byId: (id: string) => ShiftTemplate | undefined): 'off' | ShiftTemplate[] | undefined {
  if (!rotation || !rotation.weeks.length || dateKey < rotation.startDate)
    return undefined
  const weekIndex = Math.floor(daysBetween(rotation.startDate, weekStart(dateKey)) / 7) % rotation.weeks.length
  const cell = rotation.weeks[weekIndex]?.[weekDayOf(dateKey)]
  if (!cell || cell === 'off')
    return 'off'
  const templates = cell.map(byId).filter((t): t is ShiftTemplate => !!t)
  return templates.length ? templates : 'off'
}

/** What one person does on one date. The override wins, then the person's weekly days (with their default shift), then the role. */
export function resolveSchedule(
  hours: WorkingHours,
  personDays: WeekDay[] | undefined,
  override: ScheduleOverride | undefined,
  dateKey: string,
  personShifts?: ShiftTemplate[],
  /** What the person's rotation says for this date (`rotationDayFor`), if they have one running. */
  rotationDay?: 'off' | ShiftTemplate[],
  /** The templates of the role's `shiftIds`. Without them the role's plain start and end are its hours. */
  roleShifts?: ShiftTemplate[],
): ScheduledDay {
  const roleSegments = roleShifts?.length
    ? roleShifts.map(templateShift).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
    : [shiftOf(hours)]
  if (override?.kind === 'day_off')
    return { working: false, reason: override.dayOffType ?? 'other', source: 'override', note: override.note }
  if (override?.kind === 'working') {
    const hasHours = !!override.startTime && !!override.endTime
    const shift: ScheduledShift = hasHours
      ? { start: override.startTime, end: override.endTime, flexible: false, name: override.shiftName, tone: override.shiftTone, breakMinutes: override.breakMinutes }
      : roleSegments[0]!
    // Without hours of its own the day keeps all of the role's shifts.
    const segments = hasHours
      ? [shift, ...(override.extra ?? []).map<ScheduledShift>(x => ({ start: x.startTime, end: x.endTime, flexible: false, name: x.shiftName, tone: x.shiftTone, breakMinutes: x.breakMinutes }))]
      : roleSegments
    return { working: true, shift, segments, source: 'override', note: override.note }
  }
  if (rotationDay === 'off')
    return { working: false, reason: 'weekly', source: 'rotation' }
  if (rotationDay) {
    const segments = rotationDay.map(templateShift).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
    return { working: true, shift: segments[0]!, segments, source: 'rotation' }
  }
  const days = effectiveDays(hours, personDays)
  if (!days.includes(weekDayOf(dateKey)))
    return { working: false, reason: 'weekly', source: personDays ? 'person' : 'role' }
  const own = (personShifts ?? []).map(templateShift).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
  const source = personDays || own.length ? 'person' : 'role'
  const segments = own.length ? own : roleSegments
  return { working: true, shift: segments[0]!, segments, source }
}

/**
 * Why a role's working hours cannot be saved, or undefined: at least one day, and a fixed role needs shifts
 * (that do not overlap) or, for a role that has none, a start and an end at different times.
 */
export function workingHoursProblem(hours: WorkingHours, byId?: (id: string) => ShiftTemplate | undefined): string | undefined {
  if (!hours.days.length)
    return 'Pick at least one working day.'
  if (hours.scheduleType !== 'fixed')
    return undefined
  if (hours.shiftIds?.length) {
    const templates = hours.shiftIds.map(id => byId?.(id)).filter((t): t is ShiftTemplate => !!t)
    if (byId && templates.length !== hours.shiftIds.length)
      return 'A shift this role used was deleted. Pick another one.'
    const ordered = [...templates].sort((a, b) => a.start.localeCompare(b.start))
    const problem = segmentsProblem(ordered.map(t => ({ start: t.start, end: t.end })))
    if (problem)
      return problem
    // Every working day has the same shifts, so an overnight one must end before the next working day's first starts.
    const segments = ordered.map(templateShift)
    const plan: ScheduledDay = { working: true, shift: segments[0]!, segments, source: 'role' }
    for (const [i, day] of WEEK_DAYS.entries()) {
      const next = WEEK_DAYS[(i + 1) % 7]!
      if (hours.days.includes(day) && hours.days.includes(next)) {
        const clash = crossDayProblem(plan, plan, longDayName(day), longDayName(next))
        if (clash)
          return clash
      }
    }
    return undefined
  }
  if (!hours.startTime || !hours.endTime || hours.startTime === hours.endTime)
    return 'Fixed hours need a start and an end at different times. Pick a shift, or give both times.'
  return undefined
}

/** A role's `startTime` and `endTime` from its shifts: the first start and the last end (kept for plain-time readers). */
export function hoursFromShifts(templates: ShiftTemplate[]): { startTime: string, endTime: string } | undefined {
  const sorted = [...templates].sort((a, b) => a.start.localeCompare(b.start))
  return sorted.length ? { startTime: sorted[0]!.start, endTime: sorted.at(-1)!.end } : undefined
}

/**
 * For a fixed role that only has plain times: the shift with the same start and end (any break), or the
 * shift to create from them. Undefined for a flexible role, one that already has shifts, or one with no times.
 */
export function shiftForRoleHours(hours: WorkingHours, shifts: ShiftTemplate[]): { id: string } | { create: Omit<ShiftTemplate, 'id'> } | undefined {
  if (hours.scheduleType !== 'fixed' || hours.shiftIds?.length || !hours.startTime || !hours.endTime || hours.startTime === hours.endTime)
    return undefined
  const same = shifts.find(t => t.start === hours.startTime && t.end === hours.endTime)
  return same
    ? { id: same.id }
    : { create: { name: `${hours.startTime} to ${hours.endTime}`, start: hours.startTime, end: hours.endTime, breakMinutes: 0, tone: 'primary' } }
}

export function shiftLabel(shift: ScheduledShift): string {
  if (shift.flexible || !shift.start || !shift.end)
    return 'Flexible'
  return `${shift.start} to ${shift.end}${spansMidnight(shift.start, shift.end) ? ' (+1)' : ''}`
}

/** `10:00 to 18:00`, `Flexible`, `Day off` or the kind of leave. A split shift reads `07:00 to 11:00, 16:00 to 20:00`. */
export function scheduleLabel(day: ScheduledDay): string {
  if (!day.working)
    return dayOffLabel(day.reason)
  return day.segments.map(shiftLabel).join(', ')
}

/** `Morning, 07:00 to 15:00` for a named shift, else the plain label. A split shift names each part. */
export function scheduleLabelLong(day: ScheduledDay): string {
  if (!day.working)
    return scheduleLabel(day)
  return day.segments.map(s => s.name ? `${s.name}, ${shiftLabel(s)}` : shiftLabel(s)).join(' and ')
}

export const MAX_SHIFTS_PER_DAY = 4

/**
 * Why these shifts cannot be one day, or undefined. Each needs different start and end times, each starts after
 * the one before it ends, and a shift that runs past midnight has to be the last of the day (the next
 * day has its own schedule). At most `MAX_SHIFTS_PER_DAY`.
 */
export function segmentsProblem(parts: { start: string, end: string }[]): string | undefined {
  if (parts.length > MAX_SHIFTS_PER_DAY)
    return `A day can have at most ${MAX_SHIFTS_PER_DAY} shifts. Remove one.`
  let previousEnd = -1
  let previous: { start: string, end: string } | undefined
  for (const [i, p] of parts.entries()) {
    if (!p.start || !p.end || p.start === p.end)
      return `Shift ${i + 1} has to end at a different time than it starts. Pick an end time, or one before the start if it ends the next day.`
    const start = toMinutes(p.start)
    if (start <= previousEnd) {
      return previousEnd > 1440
        ? `Shift ${i} runs past midnight, so it has to be the last of the day. Remove the shifts after it, or end it by midnight.`
        : `Shift ${i + 1} has to start after shift ${i} ends (${previous!.end}). It starts at ${p.start}, so start it at ${previous!.end} or later.`
    }
    previousEnd = start + shiftLength(p.start, p.end)
    previous = p
  }
  return undefined
}

const LONG_DAY: Record<WeekDay, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }
export const longDayName = (day: WeekDay) => LONG_DAY[day]

/**
 * The time a shift of the day before is still running into this day: its last shift's end, when that shift ran
 * past midnight. Undefined when nothing carries over.
 */
export function carryOverOf(previous: ScheduledDay | undefined): { until: string, name?: string } | undefined {
  if (!previous?.working)
    return undefined
  const last = previous.segments.at(-1)
  return last?.start && last.end && spansMidnight(last.start, last.end) ? { until: last.end, name: last.name } : undefined
}

/**
 * Why two days in a row clash, or undefined: the first one's last shift runs past midnight and the next
 * day's first shift starts before it has ended. `previousName` and `nextName` are for the message ("Monday").
 */
export function crossDayProblem(previous: ScheduledDay | undefined, next: ScheduledDay | undefined, previousName: string, nextName: string): string | undefined {
  const carry = carryOverOf(previous)
  if (!carry || !next?.working)
    return undefined
  const first = next.shift
  if (first.flexible || !first.start || first.start >= carry.until)
    return undefined
  return `${previousName}'s overnight shift runs until ${carry.until}, after ${nextName}'s first shift starts at ${first.start}. Start ${nextName}'s shift at ${carry.until} or later, or end the overnight shift earlier.`
}

/**
 * Why a rotation cannot be saved, or undefined: 1 to `MAX_ROTATION_WEEKS` weeks, valid shifts on each day,
 * and no overnight shift running into the first shift of the next day (the last day of the cycle runs into
 * the first, as it repeats).
 */
export function rotationProblem(rotation: ScheduleRotation, byId: (id: string) => ShiftTemplate | undefined): string | undefined {
  if (!rotation.weeks.length || rotation.weeks.length > MAX_ROTATION_WEEKS)
    return `A rotation is 1 to ${MAX_ROTATION_WEEKS} weeks. Pick how many weeks it lasts.`
  const cycle: { day: WeekDay, plan: ScheduledDay }[] = []
  for (const week of rotation.weeks) {
    for (const day of WEEK_DAYS) {
      const cell = week[day]
      const templates = !cell || cell === 'off' ? [] : cell.map(byId).filter((t): t is ShiftTemplate => !!t)
      const ordered = [...templates].sort((a, b) => a.start.localeCompare(b.start))
      const problem = segmentsProblem(ordered.map(t => ({ start: t.start, end: t.end })))
      if (problem)
        return `${longDayName(day)}: ${problem}`
      const segments = ordered.map(templateShift)
      cycle.push({ day, plan: segments.length ? { working: true, shift: segments[0]!, segments, source: 'rotation' } : { working: false, reason: 'weekly', source: 'rotation' } })
    }
  }
  for (const [i, entry] of cycle.entries()) {
    const next = cycle[(i + 1) % cycle.length]!
    const problem = crossDayProblem(entry.plan, next.plan, longDayName(entry.day), longDayName(next.day))
    if (problem)
      return problem
  }
  return undefined
}

/**
 * Paid minutes planned for a day: the sum of its shifts' paid time (length minus break). Undefined for a day
 * off, and for a single shift without a name (the role's hours or custom hours), where the person's
 * `hoursPerDay` stands in.
 */
export function plannedMinutesOf(day: ScheduledDay): number | undefined {
  if (!day.working)
    return undefined
  if (day.segments.length === 1 && !day.shift.name)
    return undefined
  const parts = day.segments.map(shiftMinutes)
  return parts.every(p => p === undefined) ? undefined : parts.reduce<number>((sum, p) => sum + (p ?? 0), 0)
}

/** Dates from `from` to `to` inclusive. Empty if `to` is before `from`. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  const end = parseLocalDateKey(to)
  for (let d = parseLocalDateKey(from); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
    out.push(toLocalDateKey(d))
  return out
}

/** Monday of the week that holds `dateKey`. */
export function weekStart(dateKey: string): string {
  const d = parseLocalDateKey(dateKey)
  const back = (d.getDay() + 6) % 7
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back))
}

export function addDays(dateKey: string, days: number): string {
  const d = parseLocalDateKey(dateKey)
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

/** Keeps week order whatever order the toggles were clicked in. */
export function sortDays(days: WeekDay[]): WeekDay[] {
  return WEEK_DAYS.filter(d => days.includes(d))
}

/**
 * Demo schedule. Roles that are flexible list all seven days, so the demo people get Sunday off as
 * their own weekly days (the day off used to be hardcoded). A few dated overrides make the page
 * show something: one past day off (the attendance seed honours it), two coming up.
 */
export const SEED_SHIFTS: ShiftTemplate[] = [
  { id: 'shift-morning', name: 'Morning', start: '07:00', end: '15:00', breakMinutes: 30, tone: 'warning' },
  { id: 'shift-day', name: 'Day', start: '08:00', end: '17:00', breakMinutes: 60, tone: 'primary' },
  { id: 'shift-afternoon', name: 'Afternoon', start: '12:00', end: '20:00', breakMinutes: 30, tone: 'chart-5' },
  { id: 'shift-office', name: 'Office', start: '10:00', end: '18:00', breakMinutes: 0, tone: 'chart-1' },
  { id: 'shift-night', name: 'Night', start: '22:00', end: '06:00', breakMinutes: 30, tone: 'chart-3' },
]

export function buildSeedSchedule(now: Date): { personDays: Record<string, WeekDay[]>, personShifts: Record<string, string[]>, shifts: ShiftTemplate[], overrides: ScheduleOverride[] } {
  const today = toLocalDateKey(now)
  const monToSat: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const make = (userId: string, offset: number, o: Partial<ScheduleOverride> & Pick<ScheduleOverride, 'kind'>): ScheduleOverride => {
    const date = addDays(today, offset)
    return { id: `sch-${userId}-${date}`, userId, date, createdAt: now.toISOString(), createdBy: 'Demo', ...o }
  }
  return {
    shifts: SEED_SHIFTS.map(t => ({ ...t })),
    personShifts: {},
    personDays: {
      'user-1': monToSat,
      'user-2': monToSat,
      'user-3': monToSat,
      'user-5': monToSat,
      'user-7': monToSat,
    },
    overrides: [
      make('user-3', -5, { kind: 'day_off', dayOffType: 'sick', note: 'Fever' }),
      make('user-2', 3, { kind: 'day_off', dayOffType: 'leave', note: 'Ceremony in the village' }),
      make('user-2', 4, { kind: 'day_off', dayOffType: 'leave', note: 'Ceremony in the village' }),
      make('user-7', 5, { kind: 'working', startTime: '07:00', endTime: '15:00', shiftId: 'shift-morning', shiftName: 'Morning', shiftTone: 'warning', breakMinutes: 30, note: 'Covering a villa turnover' }),
      make('user-3', -2, { kind: 'working', startTime: '07:00', endTime: '11:00', extra: [{ startTime: '16:00', endTime: '20:00' }], note: 'Early arrivals and late check-ins' }),
      make('user-6', 1, { kind: 'working', startTime: '12:00', endTime: '20:00', shiftId: 'shift-afternoon', shiftName: 'Afternoon', shiftTone: 'chart-5', breakMinutes: 30, note: 'Late arrivals' }),
    ],
  }
}
