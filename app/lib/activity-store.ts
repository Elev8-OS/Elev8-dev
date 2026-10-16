import type { ActivityAuditEntry, ActivityLog } from '~/components/activities/data/activities'

/**
 * The saved copy of the activity report. There is no backend in this demo, so "the database" is
 * `localStorage` (same idea as `useUsers`): logs and the manager change history survive a reload.
 */

/** Bump when the stored shape changes, so an old copy is dropped instead of misread. */
export const ACTIVITY_STORE_VERSION = 1
export const ACTIVITY_STORAGE_KEY = 'elev8-activity-report'

export interface StoredActivityReport {
  v: number
  /** The latest day the demo data has been generated for. */
  throughDay: string
  logs: ActivityLog[]
  audit: ActivityAuditEntry[]
}

// Guards on `typeof localStorage`, not `import.meta.client`: Vitest leaves that undefined.
const hasStorage = () => typeof localStorage !== 'undefined'

export function loadActivityReport(): StoredActivityReport | null {
  if (!hasStorage())
    return null
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY)
    if (!raw)
      return null
    const parsed = JSON.parse(raw) as StoredActivityReport
    if (parsed.v !== ACTIVITY_STORE_VERSION || !Array.isArray(parsed.logs) || !Array.isArray(parsed.audit) || typeof parsed.throughDay !== 'string')
      return null
    return parsed
  }
  catch {
    return null
  }
}

export function saveActivityReport(report: Omit<StoredActivityReport, 'v'>): void {
  if (!hasStorage())
    return
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify({ v: ACTIVITY_STORE_VERSION, ...report }))
  }
  catch {
    // Quota or a blocked store: the report keeps working in memory.
  }
}

/**
 * A new day: add the demo logs for the days since the saved copy and keep everything saved as it is
 * (so a manager's edits, deletions and additions are never overwritten). Fresh ids carry the day so
 * they cannot clash with a saved one.
 */
export function growActivityReport(stored: StoredActivityReport, todayKey: string, fresh: ActivityLog[]): StoredActivityReport {
  if (stored.throughDay >= todayKey)
    return stored
  const added = fresh
    .filter(l => l.date > stored.throughDay)
    .map(l => ({ ...l, id: `${l.id}-${todayKey}` }))
  return { ...stored, throughDay: todayKey, logs: [...stored.logs, ...added] }
}
