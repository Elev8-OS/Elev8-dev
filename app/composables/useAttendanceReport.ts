// app/composables/useAttendanceReport.ts
import type { AttendanceRecord } from '~/components/attendance/data/attendance'
import type { ActivityPresetId, ActivityRange } from '~/composables/useActivityReport'
import { toLocalDateKey } from '~/components/activities/data/activities'
import { buildSeedAttendance } from '~/components/attendance/data/attendance'
import { listings } from '~/components/listings/data/listings'
import { rangeForPreset } from '~/composables/useActivityReport'
import { useRoles } from '~/composables/useRoles'
import { useUsers } from '~/composables/useUsers'
import { eachDay, isWorkDay } from '~/lib/activity-stats'

export type AttendanceFlag = 'late' | 'early' | 'open'

export interface AttendanceFilters {
  /** Matches the staff name. */
  query?: string
  roleId?: string
  /** Only records at this listing. A listing filter hides absences, which have no place. */
  listingId?: string
  /** Only records with this problem: a late check-in, an early check-out or no check-out. */
  flag?: AttendanceFlag
}

export interface AttendanceRow extends AttendanceRecord {
  name: string
  roleId: string
  roleName: string
  avatarUrl?: string
  listingName: string
}

export interface AttendanceTotals {
  records: number
  staff: number
  late: number
  early: number
  /** Past days with a check-in and no check-out. Today's open days are still running, so they do not count. */
  noCheckOut: number
  /** Working days up to yesterday with no record. 0 while a listing or flag filter is on. */
  absentDays: number
  /** Share of check-ins that were on time, in percent. Undefined with no records. */
  onTimePct?: number
}

/** One person across the range, for the Excel export. */
export interface AttendanceStaffSummary {
  userId: string
  name: string
  employeeNumber: string
  roleName: string
  joined: string
  present: number
  absent: number
  late: number
  early: number
  noCheckOut: number
  byDate: Record<string, AttendanceRecord>
}

export function useAttendanceReport() {
  const { users } = useUsers()
  const { roles } = useRoles()

  const records = useState<AttendanceRecord[]>('attendance-records', () =>
    buildSeedAttendance(new Date(), users.value.map(u => ({ id: u.id, listingIds: u.listingIds, active: u.status === 'active' }))))

  /** The chosen range. The report opens on today, as the day-to-day question is who is in. */
  const selection = useState<{ preset: ActivityPresetId, range: ActivityRange }>('attendance-range', () => ({
    preset: 'today',
    range: rangeForPreset('today'),
  }))

  const todayKey = () => toLocalDateKey(new Date())

  const earliestDate = computed(() =>
    records.value.reduce<string | undefined>((min, r) => (!min || r.date < min ? r.date : min), undefined))

  const roleName = (roleId: string) => roles.value.find(r => r.id === roleId)?.name ?? roleId
  const listingName = (id: string) => listings.value.find(l => l.id === id)?.name ?? id

  function matchesFlag(r: AttendanceRecord, flag?: AttendanceFlag): boolean {
    if (!flag)
      return true
    if (flag === 'late')
      return r.clockInLate
    if (flag === 'early')
      return r.clockOutEarly
    return !r.clockOut && r.date < todayKey()
  }

  function staffMatches(userId: string, filters: AttendanceFilters): boolean {
    const user = users.value.find(u => u.id === userId)
    if (!user)
      return false
    if (filters.roleId && user.roleId !== filters.roleId)
      return false
    const q = filters.query?.trim().toLowerCase()
    return !q || user.name.toLowerCase().includes(q)
  }

  /** The records in the range that pass the filters, newest day first then by name. */
  function rows(range: ActivityRange, filters: AttendanceFilters = {}): AttendanceRow[] {
    return records.value
      .filter(r => r.date >= range.from && r.date <= range.to)
      .filter(r => staffMatches(r.userId, filters))
      .filter(r => !filters.listingId || r.listingId === filters.listingId)
      .filter(r => matchesFlag(r, filters.flag))
      .map((r) => {
        const user = users.value.find(u => u.id === r.userId)!
        return {
          ...r,
          name: user.name,
          roleId: user.roleId,
          roleName: roleName(user.roleId),
          avatarUrl: user.avatarUrl,
          listingName: listingName(r.listingId),
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))
  }

  /** Working days up to yesterday with no record, for people who have ever clocked in. */
  function absentDaysFor(userId: string, range: ActivityRange): number {
    const have = new Set(records.value.filter(r => r.userId === userId).map(r => r.date))
    if (!have.size)
      return 0
    const first = [...have].sort()[0]!
    const today = todayKey()
    return eachDay(range).filter(d => d < today && d >= first && isWorkDay(d) && !have.has(d)).length
  }

  function totals(range: ActivityRange, filters: AttendanceFilters = {}): AttendanceTotals {
    const inRange = rows(range, filters)
    const today = todayKey()
    const onTime = inRange.filter(r => !r.clockInLate).length
    const peopleWithRecords = new Set(records.value.map(r => r.userId))
    const absentDays = filters.listingId || filters.flag
      ? 0
      : [...peopleWithRecords].filter(id => staffMatches(id, filters)).reduce((sum, id) => sum + absentDaysFor(id, range), 0)
    return {
      records: inRange.length,
      staff: new Set(inRange.map(r => r.userId)).size,
      late: inRange.filter(r => r.clockInLate).length,
      early: inRange.filter(r => r.clockOutEarly).length,
      noCheckOut: inRange.filter(r => !r.clockOut && r.date < today).length,
      absentDays,
      onTimePct: inRange.length ? Math.round((onTime / inRange.length) * 100) : undefined,
    }
  }

  /** One summary per person with records in the range, by name, for the Excel export. */
  function staffSummaries(range: ActivityRange, filters: AttendanceFilters = {}): AttendanceStaffSummary[] {
    const inRange = rows(range, filters)
    const ids = [...new Set(inRange.map(r => r.userId))]
    return ids
      .map((id) => {
        const user = users.value.find(u => u.id === id)!
        const mine = inRange.filter(r => r.userId === id)
        return {
          userId: id,
          name: user.name,
          employeeNumber: user.employeeNumber,
          roleName: roleName(user.roleId),
          joined: user.createdAt.slice(0, 10),
          present: mine.length,
          absent: filters.listingId || filters.flag ? 0 : absentDaysFor(id, range),
          late: mine.filter(r => r.clockInLate).length,
          early: mine.filter(r => r.clockOutEarly).length,
          noCheckOut: mine.filter(r => !r.clockOut && r.date < todayKey()).length,
          byDate: Object.fromEntries(mine.map(r => [r.date, r])),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  return { records, selection, earliestDate, rows, totals, staffSummaries, roleName, listingName }
}
