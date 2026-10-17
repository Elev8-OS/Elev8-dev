// app/composables/useSchedule.ts
import type { RoleId, WeekDay, WorkingHours } from '~/components/users/data/roles'
import type { DayOffType, OverrideSegment, ScheduledDay, ScheduleOverride, ScheduleRotation, ShiftTemplate, ShiftTone } from '~/lib/schedule'
import { getCurrentInstance, onMounted } from 'vue'
import { toLocalDateKey } from '~/components/activities/data/activities'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useRoles } from '~/composables/useRoles'
import { useUsers } from '~/composables/useUsers'
import { eachDay } from '~/lib/activity-stats'
import { addDays, buildSeedSchedule, SEED_SHIFTS, carryOverOf, crossDayProblem, plannedMinutesOf, resolveSchedule, rotationDayFor, rotationProblem, segmentsProblem, shiftLength, hoursFromShifts, shiftForRoleHours, sortDays, workingHoursProblem, weekStart as weekMonday } from '~/lib/schedule'

export const SCHEDULE_STORAGE_KEY = 'elev8-schedule'
const SCHEDULE_STORE_VERSION = 4

interface StoredSchedule {
  v: number
  personDays: Record<string, WeekDay[]>
  /** A person's default shifts, in the order picked (the schedule sorts them by start). */
  personShifts: Record<string, string[]>
  shifts: ShiftTemplate[]
  overrides: ScheduleOverride[]
  /** One repeating rotation per person at most. */
  rotations: Record<string, ScheduleRotation>
}

// Guards on `typeof localStorage`, not `import.meta.client`: Vitest leaves that undefined.
const hasStorage = () => typeof localStorage !== 'undefined'

function load(): StoredSchedule | null {
  if (!hasStorage())
    return null
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY)
    if (!raw)
      return null
    const parsed = JSON.parse(raw) as StoredSchedule
    if (!Array.isArray(parsed.overrides) || !parsed.personDays || typeof parsed.personDays !== 'object')
      return null
    // Version 1 had no shifts: keep its days and overrides, start the shifts from the demo ones.
    if (parsed.v === 1)
      return { ...parsed, v: SCHEDULE_STORE_VERSION, shifts: buildSeedSchedule(new Date()).shifts, personShifts: {}, rotations: {} }
    if (parsed.v === 2) {
      // Version 2 had one default shift per person (an id) and at most one extra shift on a date (`second`).
      const legacy = parsed as unknown as { personShifts: Record<string, string>, overrides: (ScheduleOverride & { second?: OverrideSegment })[] }
      return {
        ...parsed,
        v: SCHEDULE_STORE_VERSION,
        rotations: {},
        personShifts: Object.fromEntries(Object.entries(legacy.personShifts ?? {}).map(([id, shiftId]) => [id, [shiftId]])),
        overrides: legacy.overrides.map(({ second, ...o }) => second ? { ...o, extra: [second] } : o),
      }
    }
    // Version 3 had no rotations.
    if (parsed.v === 3)
      return { ...parsed, v: SCHEDULE_STORE_VERSION, rotations: {} }
    return parsed.v === SCHEDULE_STORE_VERSION && parsed.rotations && typeof parsed.rotations === 'object' && Array.isArray(parsed.shifts) && parsed.personShifts && typeof parsed.personShifts === 'object' ? parsed : null
  }
  catch {
    return null
  }
}

function save(data: Omit<StoredSchedule, 'v'>) {
  if (!hasStorage())
    return
  try {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify({ v: SCHEDULE_STORE_VERSION, ...data }))
  }
  catch {
    // Quota or a blocked store: the schedule keeps working in memory.
  }
}

export interface DayOffInput {
  type: Exclude<DayOffType, 'weekly'>
  note?: string
}

export interface WorkingDayInput {
  /** A shift template: its name, hours and break are copied onto the day. Wins over `startTime`/`endTime`. */
  shiftId?: string
  startTime?: string
  endTime?: string
  /** More shifts the same day, in time order (up to `MAX_SHIFTS_PER_DAY` with the first). The first needs a shift or custom hours too. */
  extra?: { shiftId?: string, startTime?: string, endTime?: string }[]
  note?: string
}

export interface ShiftInput {
  name: string
  start: string
  end: string
  breakMinutes: number
  tone: ShiftTone
}

/** Why a shift cannot be saved, or undefined when it is fine. */
export function shiftProblem(input: ShiftInput, existing: ShiftTemplate[], selfId?: string): string | undefined {
  if (!input.name.trim())
    return 'Give the shift a name, for example Morning.'
  if (existing.some(t => t.id !== selfId && t.name.trim().toLowerCase() === input.name.trim().toLowerCase()))
    return 'A shift with this name already exists. Use another name.'
  if (!input.start || !input.end || input.start === input.end)
    return 'The shift has to end at a different time than it starts. An end before the start means it ends the next day.'
  if (input.breakMinutes < 0 || input.breakMinutes >= shiftLength(input.start, input.end))
    return `The break (${input.breakMinutes} min) has to be shorter than the shift (${shiftLength(input.start, input.end)} min). Pick a shorter break.`
  return undefined
}

/**
 * The schedule: a role's working hours are the default, a person can have their own weekly days, and
 * single dates can be overridden. Saved to `localStorage` (no backend in this demo). The saved copy is
 * read after mount, as in `useActivityReport`, so SSR hydration matches.
 */
export function useSchedule() {
  const { users } = useUsers()
  const { roles, getRole, updateRole } = useRoles()
  const { currentUser } = useCurrentDashboardUser()

  const seed = () => buildSeedSchedule(new Date())
  const personDays = useState<Record<string, WeekDay[]>>('schedule-person-days', () => seed().personDays)
  const personShifts = useState<Record<string, string[]>>('schedule-person-shifts', () => seed().personShifts)
  const shifts = useState<ShiftTemplate[]>('schedule-shifts', () => seed().shifts)
  const rotations = useState<Record<string, ScheduleRotation>>('schedule-rotations', () => ({}))
  const overrides = useState<ScheduleOverride[]>('schedule-overrides', () => seed().overrides)
  const restored = useState('schedule-restored', () => false)

  const persist = () => {
    if (restored.value)
      save({ personDays: personDays.value, personShifts: personShifts.value, shifts: shifts.value, overrides: overrides.value, rotations: rotations.value })
  }

  function restore() {
    if (restored.value || !hasStorage())
      return
    restored.value = true
    const stored = load()
    if (stored) {
      personDays.value = stored.personDays
      personShifts.value = stored.personShifts
      shifts.value = stored.shifts
      rotations.value = stored.rotations
      overrides.value = stored.overrides
    }
    convertRoleHours()
    persist()
  }

  /**
   * A fixed role saved before roles picked shifts only has plain times. Point it at the shift with the same
   * hours, or create one from them, so every role's hours live in the one shift list. Nothing else changes:
   * the hours a person works stay exactly as they were.
   */
  function convertRoleHours() {
    // First repair a role that points at a shift the saved list does not have (a list saved before the demo
    // shift existed): bring the demo shift back, or drop an id nobody knows, so a role never shows a blank shift.
    for (const role of [...roles.value]) {
      const ids = role.workingHours.shiftIds
      const has = (id: string) => shifts.value.some(t => t.id === id)
      const missing = ids?.filter(id => !has(id)) ?? []
      if (!ids || !missing.length)
        continue
      const demo = SEED_SHIFTS.filter(t => missing.includes(t.id))
      if (demo.length)
        shifts.value = [...shifts.value, ...demo.map(t => ({ ...t }))]
      const kept = ids.filter(id => has(id))
      if (kept.length !== ids.length)
        updateRole(role.id, { workingHours: { ...role.workingHours, shiftIds: kept.length ? kept : undefined } })
    }
    for (const role of roles.value) {
      const found = shiftForRoleHours(role.workingHours, shifts.value)
      if (!found)
        continue
      let id: string
      if ('id' in found) {
        id = found.id
      }
      else {
        id = `shift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
        shifts.value = [...shifts.value, { id, ...found.create }]
      }
      updateRole(role.id, { workingHours: { ...role.workingHours, shiftIds: [id] } })
    }
  }

  if (getCurrentInstance())
    onMounted(restore)
  else
    restore()

  const byKey = computed(() => new Map(overrides.value.map(o => [`${o.userId}|${o.date}`, o])))

  function overrideFor(userId: string, date: string): ScheduleOverride | undefined {
    return byKey.value.get(`${userId}|${date}`)
  }

  /** The days a person works in a normal week (their own, else the role's). */
  function weekDaysFor(userId: string): WeekDay[] {
    const hours = getRole(users.value.find(u => u.id === userId)?.roleId ?? '')?.workingHours
    return personDays.value[userId] ?? hours?.days ?? []
  }

  const shiftById = (id?: string) => id ? shifts.value.find(t => t.id === id) : undefined

  function scheduleFor(userId: string, date: string): ScheduledDay {
    const hours = getRole(users.value.find(u => u.id === userId)?.roleId ?? '')?.workingHours
    // A person with no known role keeps the old rule: every day but Sunday.
    return resolveSchedule(
      hours ?? { scheduleType: 'flexible', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
      personDays.value[userId],
      overrideFor(userId, date),
      date,
      (personShifts.value[userId] ?? []).map(shiftById).filter((t): t is ShiftTemplate => !!t),
      rotationDayFor(rotations.value[userId], date, shiftById),
      (hours?.shiftIds ?? []).map(shiftById).filter((t): t is ShiftTemplate => !!t),
    )
  }

  /** Paid minutes planned for a day: the shift's length minus its break. Undefined for a day off or one with no fixed hours. */
  function plannedMinutes(userId: string, date: string): number | undefined {
    return plannedMinutesOf(scheduleFor(userId, date))
  }

  function isWorkDay(userId: string, date: string): boolean {
    return scheduleFor(userId, date).working
  }

  /** Working days in the range, never counting days after `today`. */
  function workDaysFor(userId: string, range: { from: string, to: string }, today = toLocalDateKey(new Date())): number {
    return eachDay(range).filter(d => d <= today && isWorkDay(userId, d)).length
  }

  const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const dayName = (date: string) => dayFmt.format(new Date(`${date}T00:00:00`))

  /** The first clash, among these dates and the days next to them, of an overnight shift running into the next day's first shift. */
  function adjacentProblem(userId: string, dates: string[]): string | undefined {
    for (const d of dates) {
      const before = addDays(d, -1)
      const after = addDays(d, 1)
      const problem = crossDayProblem(scheduleFor(userId, before), scheduleFor(userId, d), dayName(before), dayName(d))
        ?? crossDayProblem(scheduleFor(userId, d), scheduleFor(userId, after), dayName(d), dayName(after))
      if (problem)
        return problem
    }
    return undefined
  }

  /** Four weeks from this week's Monday: where a change to a person's pattern is checked for clashes. */
  const patternWindow = () => Array.from({ length: 28 }, (_, i) => addDays(weekMonday(toLocalDateKey(new Date())), i))

  /** Runs a change to the schedule; if it leaves a clash on these dates, puts everything back and says why. */
  function guarded(userId: string, dates: string[], change: () => void): string | undefined {
    const before = { overrides: overrides.value, personDays: personDays.value, personShifts: personShifts.value, rotations: rotations.value }
    change()
    const problem = adjacentProblem(userId, dates)
    if (problem) {
      overrides.value = before.overrides
      personDays.value = before.personDays
      personShifts.value = before.personShifts
      rotations.value = before.rotations
      return problem
    }
    persist()
    return undefined
  }

  function upsert(userId: string, dates: string[], patch: Partial<ScheduleOverride> & Pick<ScheduleOverride, 'kind'>): string | undefined {
    const now = new Date().toISOString()
    const by = currentUser.value?.name ?? 'Manager'
    const keys = new Set(dates.map(d => `${userId}|${d}`))
    const fresh = dates.map<ScheduleOverride>(date => ({ id: `sch-${userId}-${date}`, userId, date, createdAt: now, createdBy: by, ...patch }))
    return guarded(userId, dates, () => {
      overrides.value = [...overrides.value.filter(o => !keys.has(`${o.userId}|${o.date}`)), ...fresh]
    })
  }

  /** Mark these dates as a day off. A date that is already off by the weekly days is left as it is. */
  function setDayOff(userId: string, dates: string[], input: DayOffInput): string | undefined {
    const note = input.note?.trim() || undefined
    return upsert(userId, dates, { kind: 'day_off', dayOffType: input.type, note })
  }

  /**
   * Add these dates as working days (an extra shift or a swap). Returns a reason when it was refused (shifts
   * that overlap, too many, or extra shifts with no hours on the first), otherwise nothing.
   */
  function setWorking(userId: string, dates: string[], input: WorkingDayInput = {}): string | undefined {
    const template = shiftById(input.shiftId)
    const hasHours = !!input.startTime && !!input.endTime
    const first = template
      ? { startTime: template.start, endTime: template.end, shiftId: template.id, shiftName: template.name, shiftTone: template.tone, breakMinutes: template.breakMinutes }
      : hasHours ? { startTime: input.startTime, endTime: input.endTime } : {}

    let extra: OverrideSegment[] | undefined
    if (input.extra?.length) {
      if (!first.startTime || !first.endTime)
        return 'Pick a shift or custom hours for the first shift before adding another one.'
      // A snapshot of each, like the first: a template can change or go later without touching this day.
      extra = input.extra.map((x) => {
        const t = shiftById(x.shiftId)
        return t
          ? { startTime: t.start, endTime: t.end, shiftId: t.id, shiftName: t.name, shiftTone: t.tone, breakMinutes: t.breakMinutes }
          : { startTime: x.startTime ?? '', endTime: x.endTime ?? '' }
      })
      const problem = segmentsProblem([{ start: first.startTime, end: first.endTime }, ...extra.map(x => ({ start: x.startTime, end: x.endTime }))])
      if (problem)
        return problem
    }
    return upsert(userId, dates, { kind: 'working', ...first, extra, note: input.note?.trim() || undefined })
  }

  /** Back to the weekly days: the date follows the person's pattern again. */
  function clearOverride(userId: string, dates: string[]): string | undefined {
    const keys = new Set(dates.map(d => `${userId}|${d}`))
    return guarded(userId, dates, () => {
      overrides.value = overrides.value.filter(o => !keys.has(`${o.userId}|${o.date}`))
    })
  }

  /** `null` drops the person's own days and goes back to the role's. */
  function setPersonDays(userId: string, days: WeekDay[] | null): string | undefined {
    return guarded(userId, patternWindow(), () => {
      const next = { ...personDays.value }
      if (days === null)
        delete next[userId]
      else
        next[userId] = sortDays(days)
      personDays.value = next
    })
  }

  /** A person's default shifts (one, or several for a split shift). An empty list goes back to the role's hours. Returns a reason when refused. */
  function setPersonShifts(userId: string, shiftIds: string[]): string | undefined {
    const templates = [...new Set(shiftIds)].map(shiftById).filter((t): t is ShiftTemplate => !!t)
    const ordered = [...templates].sort((a, b) => a.start.localeCompare(b.start))
    const problem = segmentsProblem(ordered.map(t => ({ start: t.start, end: t.end })))
    if (problem)
      return problem
    return guarded(userId, patternWindow(), () => {
      const next = { ...personShifts.value }
      if (ordered.length)
        next[userId] = ordered.map(t => t.id)
      else
        delete next[userId]
      personShifts.value = next
    })
  }

  function addShift(input: ShiftInput): ShiftTemplate | string {
    const problem = shiftProblem(input, shifts.value)
    if (problem)
      return problem
    const created: ShiftTemplate = { id: `shift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, ...input, name: input.name.trim() }
    shifts.value = [...shifts.value, created]
    persist()
    return created
  }

  /** Changes the template and the people who use it as their default. Days already set on a date keep their snapshot. */
  function updateShift(id: string, input: ShiftInput): string | undefined {
    const problem = shiftProblem(input, shifts.value, id)
    if (problem)
      return problem
    shifts.value = shifts.value.map(t => t.id === id ? { ...t, ...input, name: input.name.trim() } : t)
    persist()
    return undefined
  }

  /** Deleting a shift drops it from anyone's default shifts. Days already set on a date keep their snapshot. */
  function removeShift(id: string) {
    shifts.value = shifts.value.filter(t => t.id !== id)
    personShifts.value = Object.fromEntries(Object.entries(personShifts.value).map(([uid, ids]) => [uid, ids.filter(sid => sid !== id)] as const).filter(([, ids]) => ids.length))
    // A role that used it keeps working: its remaining shifts, or its plain start and end if none are left.
    for (const role of roles.value) {
      if (role.workingHours.shiftIds?.includes(id)) {
        const kept = role.workingHours.shiftIds.filter(sid => sid !== id)
        updateRole(role.id, { workingHours: { ...role.workingHours, shiftIds: kept.length ? kept : undefined } })
      }
    }
    // A rotation day left with none of its shifts becomes a day off.
    rotations.value = Object.fromEntries(Object.entries(rotations.value).map(([uid, r]) => [uid, {
      ...r,
      weeks: r.weeks.map(w => Object.fromEntries(Object.entries(w).map(([day, cell]) => {
        const kept = Array.isArray(cell) ? cell.filter(sid => sid !== id) : cell
        return [day, Array.isArray(kept) && !kept.length ? 'off' : kept]
      }))),
    }] as const))
    persist()
  }

  /**
   * Set a role's working hours: days, and for a fixed role its shifts. Sorted by start, and the plain start
   * and end are rewritten from them. Returns the reason when refused, with nothing changed.
   */
  function setRoleHours(roleId: RoleId, hours: WorkingHours): string | undefined {
    const problem = workingHoursProblem(hours, shiftById)
    if (problem)
      return problem
    const next: WorkingHours = { ...hours }
    if (hours.scheduleType === 'fixed' && hours.shiftIds?.length) {
      const templates = hours.shiftIds.map(shiftById).filter((t): t is ShiftTemplate => !!t)
      next.shiftIds = [...templates].sort((a, b) => a.start.localeCompare(b.start)).map(t => t.id)
      Object.assign(next, hoursFromShifts(templates))
    }
    else if (hours.scheduleType !== 'fixed') {
      next.shiftIds = undefined
    }
    updateRole(roleId, { workingHours: next })
    return undefined
  }

  function shiftUsage(id: string): { people: number, days: number, rotations: number, roles: number } {
    return {
      people: Object.values(personShifts.value).filter(ids => ids.includes(id)).length,
      days: overrides.value.filter(o => o.shiftId === id || o.extra?.some(x => x.shiftId === id)).length,
      roles: roles.value.filter(r => r.workingHours.shiftIds?.includes(id)).length,
      rotations: Object.values(rotations.value).filter(r => r.weeks.some(w => Object.values(w).some(c => Array.isArray(c) && c.includes(id)))).length,
    }
  }

  /**
   * Copy the dated changes of one week onto another for these people: the target week's own changes
   * are replaced, so the result is the source week. Only overrides move, the weekly pattern is shared.
   * Returns how many days were set, or the first clash (an overnight shift running into the next day) with
   * nothing changed.
   */
  function copyWeek(userIds: string[], fromMonday: string, toMonday: string): { count: number, problem?: string } {
    const ids = new Set(userIds)
    const offset = (d: string) => Math.round((new Date(`${d}T00:00:00`).getTime() - new Date(`${fromMonday}T00:00:00`).getTime()) / 86400000)
    const inWeek = (monday: string) => (o: ScheduleOverride) => ids.has(o.userId) && o.date >= monday && o.date <= addDays(monday, 6)
    const source = overrides.value.filter(inWeek(fromMonday))
    const now = new Date().toISOString()
    const by = currentUser.value?.name ?? 'Manager'
    const copies = source.map<ScheduleOverride>((o) => {
      const date = addDays(toMonday, offset(o.date))
      return { ...o, id: `sch-${o.userId}-${date}`, date, createdAt: now, createdBy: by }
    })
    const before = overrides.value
    overrides.value = [...overrides.value.filter(o => !inWeek(toMonday)(o)), ...copies]
    const week = Array.from({ length: 7 }, (_, i) => addDays(toMonday, i))
    for (const id of ids) {
      const problem = adjacentProblem(id, week)
      if (problem) {
        overrides.value = before
        return { count: 0, problem }
      }
    }
    persist()
    return { count: copies.length }
  }

  /** Counts the changes made, so an Undo can tell whether something else was changed after its own change. */
  const changeId = useState('schedule-change-id', () => 0)
  const bumpChange = () => ++changeId.value

  /** Everything the schedule keeps, as it is now. The state is only ever replaced, never edited in place, so references are enough. */
  function snapshot() {
    return {
      overrides: overrides.value,
      personDays: personDays.value,
      personShifts: personShifts.value,
      rotations: rotations.value,
      shifts: shifts.value,
      roleHours: Object.fromEntries(roles.value.map(r => [r.id, r.workingHours])),
    }
  }

  /** Puts a snapshot back, including the working hours of any role that changed since. */
  function restoreSnapshot(saved: ReturnType<typeof snapshot>) {
    overrides.value = saved.overrides
    personDays.value = saved.personDays
    personShifts.value = saved.personShifts
    rotations.value = saved.rotations
    shifts.value = saved.shifts
    for (const role of roles.value) {
      const before = saved.roleHours[role.id]
      if (before && JSON.stringify(before) !== JSON.stringify(role.workingHours))
        updateRole(role.id, { workingHours: before })
    }
    persist()
  }

  /** The time a shift of the day before is still running into this day, if any (an overnight shift). */
  function carryOverFor(userId: string, date: string): { until: string, name?: string } | undefined {
    return carryOverOf(scheduleFor(userId, addDays(date, -1)))
  }

  /**
   * Start or change a person's rotation: weeks that repeat by themselves from `startDate` (snapped to its Monday).
   * Returns the reason when refused (a clash inside the cycle, or no weeks).
   */
  function setRotation(userId: string, startDate: string, weeks: ScheduleRotation['weeks']): string | undefined {
    const rotation: ScheduleRotation = { userId, startDate: weekMonday(startDate), weeks }
    const problem = rotationProblem(rotation, shiftById)
    if (problem)
      return problem
    rotations.value = { ...rotations.value, [userId]: rotation }
    persist()
    return undefined
  }

  /** Stops a person's rotation: from then on they follow their weekly days and default shifts again. */
  function removeRotation(userId: string) {
    const next = { ...rotations.value }
    delete next[userId]
    rotations.value = next
    persist()
  }

  function overridesInRange(userId: string, range: { from: string, to: string }): ScheduleOverride[] {
    return overrides.value
      .filter(o => o.userId === userId && o.date >= range.from && o.date <= range.to)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  return {
    personDays,
    personShifts,
    shifts,
    overrides,
    plannedMinutes,
    setPersonShifts,
    setRoleHours,
    addShift,
    updateShift,
    removeShift,
    shiftUsage,
    copyWeek,
    carryOverFor,
    snapshot,
    restoreSnapshot,
    changeId,
    bumpChange,
    rotations,
    setRotation,
    removeRotation,
    overrideFor,
    weekDaysFor,
    scheduleFor,
    isWorkDay,
    workDaysFor,
    setDayOff,
    setWorking,
    clearOverride,
    setPersonDays,
    overridesInRange,
  }
}
