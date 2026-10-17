import type { ActivityAuditEntry, ActivityLog, ActivityLogType, FinishedWork } from '~/components/activities/data/activities'
import type { CleaningType } from '~/components/operations-calendar/data/operations-calendar'
import type { DayRange } from '~/lib/activity-stats'
// app/composables/useActivityReport.ts
import { getCurrentInstance, onMounted } from 'vue'
import { ACTIVITY_LOG_TYPES, buildSeedActivityLogs, cleaningLogTitle, formatDuration, listingRooms, loggableTypes, logPlace, toLocalDateKey } from '~/components/activities/data/activities'
import { listings } from '~/components/listings/data/listings'
import { normalizeCleaningType } from '~/components/operations-calendar/data/operations-calendar'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useRoles } from '~/composables/useRoles'
import { useSchedule } from '~/composables/useSchedule'
import { useTaskStore } from '~/composables/useTaskStore'
import { useTenants } from '~/composables/useTenants'
import { useUsers } from '~/composables/useUsers'
import { eachDay, median, previousRange } from '~/lib/activity-stats'
import { growActivityReport, loadActivityReport, saveActivityReport } from '~/lib/activity-store'

export type ActivityPresetId = 'today' | 'last7' | 'last14' | 'thisMonth' | 'lastMonth' | 'custom'

export const ACTIVITY_PRESETS: { id: Exclude<ActivityPresetId, 'custom'>, label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last14', label: 'Last 2 weeks' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
]

export type ActivityRange = DayRange

export interface ActivityFilters {
  /** Matches the staff name. */
  query?: string
  roleId?: string
  /** Only time logged at this listing. */
  listingId?: string
  /** With `listingId`: only time logged in this room of it. Unset means the whole listing. */
  unitId?: string
  /** Also count time logged for the person's other tenants. Off by default: only the active tenant counts. */
  includeOtherTenants?: boolean
}

export type ActivityByType = Record<ActivityLogType, number>

export interface ActivityListingSummary {
  listingId: string
  listingName: string
  count: number
  minutes: number
}

export interface ActivityStaffRow {
  userId: string
  name: string
  roleId: string
  roleName: string
  avatarUrl?: string
  count: number
  minutes: number
  /** Hours per day times working days so far in the range. 0 when a listing filter is on. */
  targetMinutes: number
  /** Minutes per day across the range, oldest first. */
  daily: number[]
  /** Working days up to yesterday with nothing logged. */
  missingDays: number
  /** Cleaning jobs and tasks of this person that are finished in the range with no log linked to them. */
  unloggedWork: number
  /** Logs that took clearly longer than usual for the same work. */
  longCount: number
}

/** Logs of the same work on the same day at the same listing, shown as one row. */
export interface ActivityRowGroup {
  key: string
  logs: ActivityLog[]
  minutes: number
}

export interface ActivityDayGroup {
  date: string
  rows: ActivityRowGroup[]
  count: number
  minutes: number
}

export interface ActivityTenantOption {
  id: string
  name: string
}

export interface ActivityDayPoint {
  date: string
  minutes: number
  workDay: boolean
}

export interface ActivityTotals {
  staff: number
  count: number
  minutes: number
  byType: ActivityByType
  /** Same length directly before the range. Undefined when the history does not reach back that far. */
  previous?: { count: number, minutes: number }
}

export function rangeForPreset(preset: Exclude<ActivityPresetId, 'custom'>, today = new Date()): ActivityRange {
  const day = (offset: number) => toLocalDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset))
  switch (preset) {
    case 'today':
      return { from: day(0), to: day(0) }
    case 'last7':
      return { from: day(-6), to: day(0) }
    case 'last14':
      return { from: day(-13), to: day(0) }
    case 'thisMonth':
      return { from: toLocalDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: day(0) }
    case 'lastMonth':
      return {
        from: toLocalDateKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: toLocalDateKey(new Date(today.getFullYear(), today.getMonth(), 0)),
      }
  }
}

const emptyByType = (): ActivityByType => ({ cleaning: 0, task: 0, tracker: 0 })

/** A log counts as long when it is well over the usual time for the same work. Needs a few samples first. */
const LONG_FACTOR = 1.5
const LONG_MIN_EXTRA = 15
const LONG_MIN_SAMPLES = 5

/** Time and activity report: what each person logged, per day and per listing. */
export function useActivityReport() {
  const { users } = useUsers()
  const { getRole } = useRoles()
  const { isWorkDay, plannedMinutes } = useSchedule()
  const { currentUser } = useCurrentDashboardUser()
  const { tenants, byId: tenantById } = useTenants()
  const { jobs: cleaningJobs } = useCleaningJobs()
  const { tasks } = useTaskStore()

  /** The tenant picked in the sidebar. Same state and default as the tenant switcher. */
  const activeTenantId = useState<string>('active-tenant-id', () => tenants.value[0]?.id ?? '')

  // The demo report: made the same way on the server and in the browser, so hydration matches. The saved
  // copy is read after mount (`restore`): Nuxt hands the browser the server's state and never re-runs this
  // initialiser, so reading localStorage here would be ignored after a reload (and the next save would
  // then overwrite what was saved).
  const makeDemoLogs = (now: Date) => {
    const byUser: Record<string, string[]> = {}
    const tenantsByUser: Record<string, string[]> = {}
    for (const u of users.value) {
      byUser[u.id] = u.listingIds
      if (u.assignedTenantIds?.length)
        tenantsByUser[u.id] = u.assignedTenantIds
    }
    return buildSeedActivityLogs(now, byUser, tenantsByUser)
  }

  const boot = useState('activity-report-boot', () => ({ throughDay: toLocalDateKey(new Date()) }))
  const logs = useState<ActivityLog[]>('activity-logs', () => makeDemoLogs(new Date()))
  const audit = useState<ActivityAuditEntry[]>('activity-audit', () => [])
  /** True once the saved copy has been read (or created). Nothing is written before that. */
  const restored = useState('activity-report-restored', () => false)

  /** Write the report to the saved copy. Called after every manager change. */
  const persist = () => {
    if (restored.value)
      saveActivityReport({ throughDay: boot.value.throughDay, logs: logs.value, audit: audit.value })
  }

  /**
   * Open the saved report. On a new day it is only topped up with the days since it was saved, so what
   * managers added, edited or deleted is never overwritten by new demo data. With nothing saved yet,
   * the demo report on screen becomes the saved one.
   */
  function restore() {
    if (restored.value || typeof localStorage === 'undefined')
      return
    restored.value = true
    const now = new Date()
    const todayKey = toLocalDateKey(now)
    const stored = loadActivityReport()
    if (!stored) {
      saveActivityReport({ throughDay: boot.value.throughDay, logs: logs.value, audit: audit.value })
      return
    }
    const grown = growActivityReport(stored, todayKey, stored.throughDay < todayKey ? makeDemoLogs(now) : [])
    boot.value = { throughDay: grown.throughDay }
    logs.value = grown.logs
    audit.value = grown.audit
    if (grown !== stored)
      saveActivityReport(grown)
  }

  // In a component, wait until it is mounted (after hydration). Anywhere else there is no hydration to wait for.
  if (getCurrentInstance())
    onMounted(restore)
  else
    restore()

  /** The chosen range, kept so the detail page opens on the same days as the list. */
  const selection = useState<{ preset: ActivityPresetId, range: ActivityRange }>('activity-range', () => ({
    preset: 'last7',
    range: rangeForPreset('last7'),
  }))

  const inRange = (log: ActivityLog, range: ActivityRange) => log.date >= range.from && log.date <= range.to

  /** People with logs in several tenants. Everyone else has one tenant, so tenants never split their time. */
  function tenantsFor(userId: string): ActivityTenantOption[] {
    const ids = users.value.find(u => u.id === userId)?.assignedTenantIds ?? []
    if (ids.length < 2)
      return []
    return ids.map(id => ({ id, name: tenantById(id)?.name ?? id }))
  }

  const tenantName = (id?: string) => id ? tenantById(id)?.name ?? id : undefined

  /** Types a person can log, from their role. Used when adding time. */
  const loggableTypesFor = (userId: string): ActivityLogType[] => loggableTypes(users.value.find(u => u.id === userId)?.roleId)

  /** Types to show for a person: what their role allows, plus any they already have logs for (a role can change). */
  function shownTypesFor(userId: string): ActivityLogType[] {
    const allowed = new Set(loggableTypesFor(userId))
    for (const l of logs.value) {
      if (l.userId === userId)
        allowed.add(l.type)
    }
    return ACTIVITY_LOG_TYPES.filter(t => allowed.has(t))
  }

  /** A log at the filtered listing, and in the filtered room when one is chosen. */
  const atPlace = (log: ActivityLog, f: { listingId?: string, unitId?: string }) =>
    log.listingId === f.listingId && (!f.unitId || log.unitId === f.unitId)

  /** Logs without a tenant belong to the person's own tenant, so they always count. */
  const inActiveTenant = (log: ActivityLog) => !log.tenantId || log.tenantId === activeTenantId.value
  const pool = (includeOtherTenants?: boolean) => includeOtherTenants ? logs.value : logs.value.filter(inActiveTenant)

  /** Usual minutes per kind of work: the median of every log with the same type and title. */
  const typical = computed(() => {
    const groups = new Map<string, number[]>()
    for (const l of logs.value) {
      const key = `${l.type}|${l.title}`
      groups.set(key, [...(groups.get(key) ?? []), l.durationMinutes])
    }
    const out = new Map<string, number>()
    for (const [key, values] of groups) {
      if (values.length >= LONG_MIN_SAMPLES)
        out.set(key, median(values))
    }
    return out
  })

  function isLong(log: ActivityLog): boolean {
    const usual = typical.value.get(`${log.type}|${log.title}`)
    return usual !== undefined && log.durationMinutes > usual * LONG_FACTOR && log.durationMinutes - usual >= LONG_MIN_EXTRA
  }

  /** People who have ever logged time, so a quiet week still lists them. */
  const trackedUserIds = computed(() => new Set(logs.value.map(l => l.userId)))

  const earliestDate = computed(() =>
    logs.value.reduce<string | undefined>((min, l) => (!min || l.date < min ? l.date : min), undefined))

  function targetMinutes(userId: string, range: ActivityRange): number {
    const user = users.value.find(u => u.id === userId)
    if (!user)
      return 0
    // A day with a named shift is that shift's paid length; any other working day is the person's hoursPerDay.
    const today = toLocalDateKey(new Date())
    return eachDay(range)
      .filter(d => d <= today && isWorkDay(userId, d))
      .reduce((sum, d) => sum + (plannedMinutes(userId, d) ?? Math.round(user.hoursPerDay * 60)), 0)
  }

  /** One row per person, busiest first. Active people who logged nothing are kept so gaps show. */
  function staffRows(range: ActivityRange, filters: ActivityFilters = {}): ActivityStaffRow[] {
    const days = eachDay(range)
    const today = toLocalDateKey(new Date())
    const query = filters.query?.trim().toLowerCase()
    const rows: ActivityStaffRow[] = []

    for (const user of users.value) {
      if (filters.roleId && user.roleId !== filters.roleId)
        continue
      if (query && !user.name.toLowerCase().includes(query))
        continue

      const inPeriod = pool(filters.includeOtherTenants).filter(l => l.userId === user.id && inRange(l, range))
      const own = filters.listingId ? inPeriod.filter(l => atPlace(l, filters)) : inPeriod
      const hasHistory = trackedUserIds.value.has(user.id)
      if (filters.listingId ? !own.length : (!own.length && !(hasHistory && user.status === 'active')))
        continue

      const perDay = new Map<string, number>()
      for (const l of own)
        perDay.set(l.date, (perDay.get(l.date) ?? 0) + l.durationMinutes)
      const loggedDays = new Set(inPeriod.map(l => l.date))

      rows.push({
        userId: user.id,
        name: user.name,
        roleId: user.roleId,
        roleName: getRole(user.roleId)?.name ?? '',
        avatarUrl: user.avatarUrl,
        count: own.length,
        minutes: own.reduce((sum, l) => sum + l.durationMinutes, 0),
        // Partial time (one listing, or one tenant of several) is not comparable with a full working day.
        targetMinutes: filters.listingId || (tenantsFor(user.id).length && !filters.includeOtherTenants) ? 0 : targetMinutes(user.id, range),
        daily: days.map(d => perDay.get(d) ?? 0),
        // Today is left out: the day is not over, so nothing logged yet is not a gap.
        missingDays: hasHistory && user.status === 'active'
          ? days.filter(d => d < today && isWorkDay(user.id, d) && !loggedDays.has(d)).length
          : 0,
        longCount: own.filter(isLong).length,
        unloggedWork: finishedWorkFor(user.id, range).length,
      })
    }
    return rows.sort((a, b) => b.minutes - a.minutes)
  }

  function totals(range: ActivityRange, filters: ActivityFilters = {}): ActivityTotals {
    const rows = staffRows(range, filters)
    const ids = new Set(rows.map(r => r.userId))
    const byType = emptyByType()
    for (const l of pool(filters.includeOtherTenants)) {
      if (!ids.has(l.userId) || !inRange(l, range))
        continue
      if (filters.listingId && !atPlace(l, filters))
        continue
      byType[l.type] += l.durationMinutes
    }

    const prev = previousRange(range)
    const reachesBack = !!earliestDate.value && prev.from >= earliestDate.value
    const prevRows = reachesBack ? staffRows(prev, filters) : []
    return {
      staff: rows.filter(r => r.count > 0).length,
      count: rows.reduce((sum, r) => sum + r.count, 0),
      minutes: rows.reduce((sum, r) => sum + r.minutes, 0),
      byType,
      previous: reachesBack
        ? { count: prevRows.reduce((s, r) => s + r.count, 0), minutes: prevRows.reduce((s, r) => s + r.minutes, 0) }
        : undefined,
    }
  }

  /** A person's logs grouped by day (newest first), with same-work logs folded into one row. */
  function dayGroups(userId: string, range: ActivityRange, filter: { types?: ActivityLogType[], cleaningTypes?: CleaningType[], query?: string, includeOtherTenants?: boolean } = {}): ActivityDayGroup[] {
    const query = filter.query?.trim().toLowerCase()
    const byDate = new Map<string, ActivityLog[]>()
    for (const log of pool(filter.includeOtherTenants)) {
      if (log.userId !== userId || !inRange(log, range))
        continue
      if (filter.types?.length && !filter.types.includes(log.type))
        continue
      // The kinds of cleaning only narrow cleaning logs; a task or tracker log is not affected.
      if (log.type === 'cleaning' && filter.cleaningTypes?.length && !(log.cleaningType && filter.cleaningTypes.includes(log.cleaningType)))
        continue
      if (query && !`${log.title} ${logPlace(log)} ${log.notes ?? ''}`.toLowerCase().includes(query))
        continue
      byDate.set(log.date, [...(byDate.get(log.date) ?? []), log])
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dayLogs]) => {
        const rowsByKey = new Map<string, ActivityLog[]>()
        for (const l of dayLogs) {
          const key = `${l.type}|${l.title}|${l.listingId}|${l.unitId ?? ''}|${l.tenantId ?? ''}`
          rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), l])
        }
        return {
          date,
          count: dayLogs.length,
          minutes: dayLogs.reduce((sum, l) => sum + l.durationMinutes, 0),
          rows: [...rowsByKey.entries()].map(([key, group]) => ({
            key: `${date}|${key}`,
            logs: group,
            minutes: group.reduce((sum, l) => sum + l.durationMinutes, 0),
          })),
        }
      })
  }

  /** Minutes for every day of the range, including empty days, oldest first. */
  function dailySeries(userId: string, range: ActivityRange, includeOtherTenants = false): ActivityDayPoint[] {
    const perDay = new Map<string, number>()
    for (const l of pool(includeOtherTenants)) {
      if (l.userId === userId && inRange(l, range))
        perDay.set(l.date, (perDay.get(l.date) ?? 0) + l.durationMinutes)
    }
    return eachDay(range).map(date => ({ date, minutes: perDay.get(date) ?? 0, workDay: isWorkDay(userId, date) }))
  }

  function listingSummary(userId: string, range: ActivityRange, includeOtherTenants = false): ActivityListingSummary[] {
    const map = new Map<string, ActivityListingSummary>()
    for (const log of pool(includeOtherTenants)) {
      if (log.userId !== userId || !inRange(log, range))
        continue
      const prev = map.get(log.listingId)
      map.set(log.listingId, {
        listingId: log.listingId,
        listingName: log.listingName,
        count: (prev?.count ?? 0) + 1,
        minutes: (prev?.minutes ?? 0) + log.durationMinutes,
      })
    }
    return [...map.values()].sort((a, b) => b.minutes - a.minutes)
  }

  /** A person's minutes per type of work in the range. */
  function byTypeFor(userId: string, range: ActivityRange, includeOtherTenants = false): ActivityByType {
    const out = emptyByType()
    for (const l of pool(includeOtherTenants)) {
      if (l.userId === userId && inRange(l, range))
        out[l.type] += l.durationMinutes
    }
    return out
  }

  /** How many cleaning logs a person has of each kind of cleaning in the range. Kinds with none are left out. */
  function cleaningKindCounts(userId: string, range: ActivityRange, includeOtherTenants = false): Partial<Record<CleaningType, number>> {
    const out: Partial<Record<CleaningType, number>> = {}
    for (const l of pool(includeOtherTenants)) {
      if (l.userId === userId && l.type === 'cleaning' && l.cleaningType && inRange(l, range))
        out[l.cleaningType] = (out[l.cleaningType] ?? 0) + 1
    }
    return out
  }

  /** Logs in the range that the active-tenant view leaves out. */
  function otherTenantCount(userId: string, range: ActivityRange): number {
    return logs.value.filter(l => l.userId === userId && inRange(l, range) && !inActiveTenant(l)).length
  }

  /** Listings a person can log time against: their assigned ones. */
  function listingsFor(userId: string) {
    const ids = users.value.find(u => u.id === userId)?.listingIds ?? []
    return listings.value.filter(l => ids.includes(l.id)).map(l => ({ id: l.id, name: l.name }))
  }

  /**
   * Cleaning jobs (status done) and tasks (completed) that belong to this person and have no log linked to
   * them yet, newest first. The Cleaning and Tasks modules own that work; this only reads it. A cleaner is
   * matched by user id (the housekeeping cleaners are users), else by name; a task by its person assignee's
   * name (tasks keep names, not ids). A cleaning only counts for a role that can log cleaning, and a task
   * needs a listing, because a log is filed under one.
   */
  function finishedWorkFor(userId: string, range?: ActivityRange): FinishedWork[] {
    const user = users.value.find(u => u.id === userId)
    if (!user)
      return []
    const linkedJobs = new Set(logs.value.filter(l => l.userId === userId && l.cleaningJobId).map(l => l.cleaningJobId))
    const linkedTasks = new Set(logs.value.filter(l => l.userId === userId && l.taskId).map(l => l.taskId))
    const out: FinishedWork[] = []

    if (loggableTypes(user.roleId).includes('cleaning')) {
      for (const job of cleaningJobs.value) {
        if (job.status !== 'done' || linkedJobs.has(job.id))
          continue
        const mine = job.cleanerIds.some((id, i) => id === user.id || (!users.value.some(u => u.id === id) && job.cleanerNames[i] === user.name))
        if (!mine)
          continue
        const cleaningType = normalizeCleaningType(job.source)
        out.push({
          kind: 'cleaning_job',
          id: job.id,
          type: 'cleaning',
          title: cleaningLogTitle(cleaningType),
          cleaningType,
          listingId: job.listingId,
          listingName: job.listingName,
          unitId: job.unitId ?? undefined,
          unitName: job.unitName ?? undefined,
          date: job.scheduledAt.slice(0, 10),
          minutes: job.feedback?.cleaningDurationMinutes ?? job.durationMinutes,
        })
      }
    }

    for (const task of tasks.value) {
      if (task.status !== 'completed' || task.assigneeType !== 'person' || task.assignee !== user.name || linkedTasks.has(task.id))
        continue
      const listing = listings.value.find(l => l.name === task.listing)
      if (!listing)
        continue
      const finishedAt = task.statusUpdates?.find(u => u.kind === 'completed')?.date ?? task.dueDate ?? task.createdAt
      out.push({
        kind: 'task',
        id: task.id,
        type: 'task',
        title: task.title,
        listingId: listing.id,
        listingName: listing.name,
        unitId: task.unitId,
        unitName: task.unitName,
        date: finishedAt ? toLocalDateKey(new Date(finishedAt)) : toLocalDateKey(new Date()),
      })
    }

    return out
      .filter(w => !range || (w.date >= range.from && w.date <= range.to))
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  const actorName = () => currentUser.value?.name ?? 'A manager'

  function record(entry: Omit<ActivityAuditEntry, 'id' | 'at' | 'by'>) {
    audit.value = [
      { ...entry, id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), by: actorName() },
      ...audit.value,
    ]
    persist()
  }

  /** A manager adds time the person forgot to log. */
  function addLog(input: { userId: string, listingId: string, unitId?: string | null, type: ActivityLogType, cleaningType?: CleaningType, cleaningJobId?: string, taskId?: string, title: string, date: string, durationMinutes: number, notes?: string }): ActivityLog | undefined {
    const listing = listings.value.find(l => l.id === input.listingId)
    if (!listing || !loggableTypesFor(input.userId).includes(input.type))
      return undefined
    // Cleaning is filed under a kind of cleaning and named after it. Other types need a title.
    if (input.type === 'cleaning' && !input.cleaningType)
      return undefined
    const title = input.type === 'cleaning' ? cleaningLogTitle(input.cleaningType!) : input.title.trim()
    if (!title)
      return undefined
    // A link has to point at finished work of this person that no log covers yet, and match the log's type.
    // Logs are one-to-one with the work, so the Operations Calendar and the report cannot double-count it.
    if ((input.cleaningJobId && input.type !== 'cleaning') || (input.taskId && input.type !== 'task'))
      return undefined
    const linked = input.cleaningJobId ?? input.taskId
    if (linked && !finishedWorkFor(input.userId).some(w => w.id === linked && w.kind === (input.cleaningJobId ? 'cleaning_job' : 'task')))
      return undefined
    // A room has to belong to the listing. No room means the whole property.
    const room = input.unitId ? listingRooms(listing.id).find(r => r.id === input.unitId) : undefined
    if (input.unitId && !room)
      return undefined
    const log: ActivityLog = {
      id: `actlog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      userId: input.userId,
      listingId: listing.id,
      listingName: listing.name,
      unitId: room?.id,
      unitName: room?.name,
      // Added in the active tenant, so it shows without switching the toggle on.
      tenantId: tenantsFor(input.userId).length ? activeTenantId.value : undefined,
      type: input.type,
      cleaningType: input.type === 'cleaning' ? input.cleaningType : undefined,
      cleaningJobId: input.cleaningJobId,
      taskId: input.taskId,
      title,
      date: input.date,
      durationMinutes: Math.max(0, Math.round(input.durationMinutes)),
      notes: input.notes?.trim() || undefined,
      manual: true,
      editedAt: new Date().toISOString(),
      editedBy: actorName(),
    }
    logs.value = [...logs.value, log]
    record({ action: 'added', userId: log.userId, date: log.date, title: log.title, listingName: logPlace(log), detail: `Added ${formatDuration(log.durationMinutes)}` })
    return log
  }

  /** Edit the time and note of one log. The type, listing and day stay as logged. */
  function updateLog(id: string, patch: { durationMinutes: number, notes?: string }) {
    const before = logs.value.find(l => l.id === id)
    if (!before)
      return
    const durationMinutes = Math.max(0, Math.round(patch.durationMinutes))
    const notes = patch.notes?.trim() || undefined
    if (durationMinutes === before.durationMinutes && notes === before.notes)
      return
    logs.value = logs.value.map(l => l.id === id
      ? { ...l, durationMinutes, notes, editedAt: new Date().toISOString(), editedBy: actorName() }
      : l)
    const parts: string[] = []
    if (durationMinutes !== before.durationMinutes)
      parts.push(`${formatDuration(before.durationMinutes)} to ${formatDuration(durationMinutes)}`)
    if (notes !== before.notes)
      parts.push('note changed')
    record({ action: 'edited', userId: before.userId, date: before.date, title: before.title, listingName: logPlace(before), detail: parts.join(', ') })
  }

  function removeLog(id: string) {
    const before = logs.value.find(l => l.id === id)
    if (!before)
      return
    logs.value = logs.value.filter(l => l.id !== id)
    record({ action: 'deleted', userId: before.userId, date: before.date, title: before.title, listingName: logPlace(before), detail: `Removed ${formatDuration(before.durationMinutes)}` })
  }

  function auditFor(userId: string): ActivityAuditEntry[] {
    return audit.value.filter(a => a.userId === userId)
  }

  return {
    logs,
    audit,
    selection,
    earliestDate,
    isLong,
    staffRows,
    totals,
    dayGroups,
    dailySeries,
    listingSummary,
    listingsFor,
    byTypeFor,
    cleaningKindCounts,
    finishedWorkFor,
    loggableTypesFor,
    shownTypesFor,
    otherTenantCount,
    tenantsFor,
    tenantName,
    activeTenantId,
    targetMinutes,
    addLog,
    updateLog,
    removeLog,
    auditFor,
  }
}
