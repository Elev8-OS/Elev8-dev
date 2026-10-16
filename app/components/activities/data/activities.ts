// app/components/activities/data/activities.ts
import type { CleaningType } from '~/components/operations-calendar/data/operations-calendar'
import { listings } from '~/components/listings/data/listings'
import { cleaningTypeLabels } from '~/components/operations-calendar/data/operations-calendar'

/** What the time was logged against: a cleaning job, a task, or free time tracked with the activity tracker. */
export type ActivityLogType = 'cleaning' | 'task' | 'tracker'

export const activityLogTypeMeta: Record<ActivityLogType, { label: string, icon: string }> = {
  cleaning: { label: 'Cleaning', icon: 'lucide:brush-cleaning' },
  task: { label: 'Task', icon: 'lucide:list-checks' },
  tracker: { label: 'Activity tracker', icon: 'lucide:timer' },
}

/**
 * The kinds of cleaning a cleaning log is filed under: the same types the Operations Calendar and the
 * cleaning checklists use (Daily, Check-out, Mid-stay, Custom, Vacant upkeep).
 */
export const CLEANING_LOG_TYPES: CleaningType[] = ['daily', 'check_out', 'mid_stay', 'custom', 'vacant']

/** What a cleaning log is called: its cleaning type, e.g. "Check-out cleaning". */
export function cleaningLogTitle(cleaningType: CleaningType): string {
  return cleaningTypeLabels[cleaningType]
}

/** Only housekeeping people clean. Everyone else logs tasks and activity tracker time. */
export const CLEANING_ROLE_IDS: string[] = ['role-housekeeping', 'role-housekeeping-manager']

export const ACTIVITY_LOG_TYPES: ActivityLogType[] = ['cleaning', 'task', 'tracker']

/** The types a person with this role can log. */
export function loggableTypes(roleId: string | undefined): ActivityLogType[] {
  return ACTIVITY_LOG_TYPES.filter(t => t !== 'cleaning' || (!!roleId && CLEANING_ROLE_IDS.includes(roleId)))
}

export interface ActivityLog {
  id: string
  userId: string
  listingId: string
  listingName: string
  /** The room of a multi-unit listing. Unset means the whole property (or a single-unit listing). */
  unitId?: string
  unitName?: string
  /**
   * The finished work this log is the time for: a cleaning job (type `cleaning`) or a task (type `task`).
   * One person can log a job or task once, so the Operations Calendar and the report agree on one piece of work.
   */
  cleaningJobId?: string
  taskId?: string
  /** Only set for people assigned to several tenants. Everyone else works in their one tenant. */
  tenantId?: string
  type: ActivityLogType
  /** For `cleaning` logs: which kind of cleaning. The title is its label. Unset for task and tracker logs. */
  cleaningType?: CleaningType
  title: string
  /** Local `YYYY-MM-DD`. */
  date: string
  durationMinutes: number
  notes?: string
  /** Added by a manager instead of logged by the person. */
  manual?: boolean
  /** Set when a manager changed the time or note after it was logged. */
  editedAt?: string
  editedBy?: string
}

/**
 * A cleaning job or a task that is finished and assigned to a person, so the time for it can be logged.
 * It is read from the Cleaning and Tasks modules, never copied: it disappears once a log is linked to it.
 */
export interface FinishedWork {
  kind: 'cleaning_job' | 'task'
  id: string
  type: 'cleaning' | 'task'
  /** "Check-out cleaning" for a cleaning, the task's title for a task. */
  title: string
  cleaningType?: CleaningType
  listingId: string
  listingName: string
  unitId?: string
  unitName?: string
  /** Local `YYYY-MM-DD` the work was done. */
  date: string
  /** Known for a cleaning (its checklist report or its plan). A task has no time, the person enters it. */
  minutes?: number
}

export type ActivityAuditAction = 'added' | 'edited' | 'deleted'

/** One manager change to a person's logged time. Kept even after the log itself is deleted. */
export interface ActivityAuditEntry {
  id: string
  /** ISO timestamp. */
  at: string
  /** Name of the manager who made the change. */
  by: string
  action: ActivityAuditAction
  /** The staff member whose time changed. */
  userId: string
  /** Local `YYYY-MM-DD` of the log. */
  date: string
  title: string
  listingName: string
  /** `20m to 1h 20m`, `Added 45m`, `Removed 1h 05m`. */
  detail: string
}

/** `Villa Luwa · Master Suite`, or just the listing when the log has no room. */
export function logPlace(log: Pick<ActivityLog, 'listingName' | 'unitName'>): string {
  return log.unitName ? `${log.listingName} · ${log.unitName}` : log.listingName
}

/** The rooms of a multi-unit listing, flat. Empty for a single-unit listing. */
export function listingRooms(listingId: string): { id: string, name: string }[] {
  const listing = listings.value.find(l => l.id === listingId)
  if (!listing || listing.unitType !== 'multi')
    return []
  return (listing.unitTypes ?? []).flatMap(ut => ut.units.map(u => ({ id: u.id, name: u.name })))
}

/** Local `YYYY-MM-DD` (not `toISOString`, which shifts a UTC+8 date). */
export function toLocalDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

/** `20m`, `3h`, `3h 05m`. */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0)
    return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`
}

interface StaffTemplate {
  userId: string
  /** Titles per type this person typically logs. */
  titles: Partial<Record<ActivityLogType, string[]>>
  /** Typical minutes per type: [min, max]. Cleaning uses `CLEANING_MINUTES` instead, by kind of cleaning. */
  minutes: Partial<Record<ActivityLogType, [number, number]>>
  /** The kinds of cleaning this person does. */
  cleaningTypes?: CleaningType[]
  /** Logs per working day: [min, max]. */
  perDay: [number, number]
  /** Days back (from today) after which nothing is logged. */
  lastLoggedDaysAgo?: number
}

/** Typical minutes per kind of cleaning: a check-out takes far longer than a daily tidy. */
const CLEANING_MINUTES: Record<CleaningType, [number, number]> = {
  daily: [25, 60],
  check_out: [90, 180],
  mid_stay: [45, 90],
  custom: [30, 120],
  vacant: [20, 45],
}

const STAFF: StaffTemplate[] = [
  {
    userId: 'user-1',
    titles: { task: ['Reviewed guest feedback', 'Updated welcome guide', 'Checked arrival details'], tracker: ['Guest inbox follow-up'] },
    minutes: { task: [15, 45], tracker: [30, 90] },
    perDay: [3, 6],
  },
  {
    userId: 'user-2',
    titles: { task: ['Pool pump inspection', 'AC servicing check', 'Pricing review'], tracker: ['Property walk-through'] },
    minutes: { task: [25, 70], tracker: [45, 120] },
    perDay: [3, 6],
  },
  {
    userId: 'user-3',
    titles: { task: ['Replaced garden lighting', 'Roof inspection', 'Listing photo update'], tracker: ['Property walk-through'] },
    minutes: { task: [30, 80], tracker: [45, 100] },
    perDay: [3, 5],
  },
  {
    userId: 'user-6',
    titles: { cleaning: [], task: ['Restocked cleaning supplies', 'Updated cleaning checklist'] },
    minutes: { task: [20, 40] },
    cleaningTypes: ['check_out', 'daily', 'vacant', 'custom'],
    perDay: [3, 6],
  },
  {
    userId: 'user-7',
    titles: { cleaning: [], task: ['Laundry run'] },
    minutes: { task: [20, 50] },
    cleaningTypes: ['daily', 'check_out', 'mid_stay'],
    perDay: [3, 6],
  },
  {
    userId: 'user-8',
    titles: { tracker: ['Pool maintenance'], task: ['Pool chemical check'] },
    minutes: { tracker: [40, 90], task: [15, 30] },
    perDay: [1, 1],
    lastLoggedDaysAgo: 28,
  },
]

/** Small deterministic generator so the mock data is the same on every load. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const ACTIVITY_HISTORY_DAYS = 90

/**
 * Seed logs for the last `ACTIVITY_HISTORY_DAYS` days, relative to `today`.
 * `listingIdsByUser` limits each person to their assigned listings.
 */
export function buildSeedActivityLogs(
  today: Date,
  listingIdsByUser: Record<string, string[]>,
  /** People assigned to more than one tenant: the tenants their time is spread over. */
  tenantIdsByUser: Record<string, string[]> = {},
): ActivityLog[] {
  const rand = mulberry32(8128)
  // Its own generator, so adding tenants leaves every other generated value as it was.
  const tenantRand = mulberry32(4421)
  // Same for rooms: a log at a multi-unit listing names a room about two times in three.
  const roomRand = mulberry32(7013)
  const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
  const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)]!
  const logs: ActivityLog[] = []
  let counter = 0

  /** The first tenant gets about half of the time, the rest share the other half. */
  function tenantFor(userId: string): string | undefined {
    const ids = tenantIdsByUser[userId]
    if (!ids || ids.length < 2)
      return undefined
    const roll = tenantRand()
    if (roll < 0.5)
      return ids[0]
    return ids[1 + Math.floor(((roll - 0.5) / 0.5) * (ids.length - 1))]
  }

  for (const staff of STAFF) {
    const ids = (listingIdsByUser[staff.userId] ?? []).filter(id => listings.value.some(l => l.id === id))
    if (!ids.length)
      continue
    for (let back = 0; back < ACTIVITY_HISTORY_DAYS; back++) {
      if (staff.lastLoggedDaysAgo !== undefined && back < staff.lastLoggedDaysAgo)
        continue
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back)
      // Sundays off, and about one weekday in eight.
      if (day.getDay() === 0 || rand() < 0.12)
        continue
      const count = between(staff.perDay[0], staff.perDay[1])
      for (let i = 0; i < count; i++) {
        const types = Object.keys(staff.titles) as ActivityLogType[]
        const type = pick(types)
        const listingId = pick(ids)
        const listing = listings.value.find(l => l.id === listingId)!
        counter += 1
        // Cleaning is filed under a kind of cleaning; its title is that kind's label.
        const cleaningType: CleaningType | undefined = type === 'cleaning' ? pick<CleaningType>(staff.cleaningTypes ?? ['daily']) : undefined
        const title = cleaningType ? cleaningLogTitle(cleaningType) : pick(staff.titles[type]!)
        const [min, max] = cleaningType ? CLEANING_MINUTES[cleaningType] : (staff.minutes[type] ?? [20, 60])
        const rooms = listingRooms(listingId)
        const room = rooms.length && roomRand() < 0.65 ? rooms[Math.floor(roomRand() * rooms.length)] : undefined
        logs.push({
          id: `actlog-${counter}`,
          userId: staff.userId,
          listingId,
          listingName: listing.name,
          unitId: room?.id,
          unitName: room?.name,
          tenantId: tenantFor(staff.userId),
          type,
          cleaningType,
          title,
          date: toLocalDateKey(day),
          durationMinutes: Math.round(between(min, max) / 5) * 5,
        })
      }
    }
  }
  return logs
}
