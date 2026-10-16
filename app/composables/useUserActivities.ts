// app/composables/useUserActivities.ts
import type { ActivityLog } from '~/components/activities/data/activities'
import type { UserActivity } from '~/components/users/data/user-activities'
import { logPlace, parseLocalDateKey } from '~/components/activities/data/activities'
import { seedActivities } from '~/components/users/data/user-activities'
import { useActivityReport } from '~/composables/useActivityReport'

const STORAGE_KEY = 'elev8-tenant-user-activities'

function hasStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function loadFromStorage(): UserActivity[] | null {
  if (!hasStorage())
    return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return null
    return JSON.parse(raw) as UserActivity[]
  }
  catch {
    return null
  }
}

/**
 * A time-tracked log as a profile feed entry. The Activities report is the only writer of these logs;
 * the profile reads them, so a log added, edited or deleted there shows up here and nowhere is it copied.
 * A log only has a day, so it sits at noon of that day.
 */
export function trackedLogToActivity(log: ActivityLog): UserActivity {
  const day = parseLocalDateKey(log.date)
  return {
    id: `tracked-${log.id}`,
    userId: log.userId,
    type: log.type,
    title: log.title,
    description: log.notes,
    listingName: logPlace(log),
    timestamp: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString(),
    dateOnly: true,
    source: 'activities',
    durationMinutes: log.durationMinutes,
  }
}

export function useUserActivities() {
  // Events that are not time-tracked work: guest messages, sign-ins, check-ins, maintenance.
  const activities = useState<UserActivity[]>('user-activities', () => {
    const stored = loadFromStorage()
    return stored ?? JSON.parse(JSON.stringify(seedActivities))
  })

  const { logs: trackedLogs } = useActivityReport()

  function getActivitiesForUser(userId: string): UserActivity[] {
    const tracked = trackedLogs.value.filter(l => l.userId === userId).map(trackedLogToActivity)
    return [...activities.value.filter(a => a.userId === userId), ...tracked]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  }

  function recentActivitiesForUser(userId: string, limit = 5): UserActivity[] {
    return getActivitiesForUser(userId).slice(0, limit)
  }

  function lastActivityForUser(userId: string): UserActivity | undefined {
    return getActivitiesForUser(userId)[0]
  }

  function activityCountByUser(userId: string, withinDays = 30): number {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - withinDays)
    const cutoffIso = cutoff.toISOString()
    return getActivitiesForUser(userId).filter(a => a.timestamp >= cutoffIso).length
  }

  return {
    activities,
    getActivitiesForUser,
    recentActivitiesForUser,
    lastActivityForUser,
    activityCountByUser,
  }
}
