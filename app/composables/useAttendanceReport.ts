// app/composables/useAttendanceReport.ts
import type { AttendanceRecord } from '~/components/attendance/data/attendance'
import type { ActivityPresetId, ActivityRange } from '~/composables/useActivityReport'
import { toLocalDateKey } from '~/components/activities/data/activities'
import { buildSeedAttendance } from '~/components/attendance/data/attendance'
import { listings } from '~/components/listings/data/listings'
import { rangeForPreset } from '~/composables/useActivityReport'
import { useRoles } from '~/composables/useRoles'
import { useSchedule } from '~/composables/useSchedule'
import { useUsers } from '~/composables/useUsers'
import { eachDay } from '~/lib/activity-stats'

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
  /** Scheduled shifts up to yesterday with no record (days, when nobody has a split shift). 0 while a listing or flag filter is on. */
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
  /** Keyed by day; the second and later shifts of a split-shift day are keyed `<day>|2`, `<day>|3`... */
  byDate: Record<string, AttendanceRecord>
}

export function useAttendanceReport() {
  const { users } = useUsers()
  const { roles } = useRoles()
  const { scheduleFor } = useSchedule()

  const records = useState<AttendanceRecord[]>('attendance-records', () =>
    buildSeedAttendance(new Date(), users.value.map(u => ({ id: u.id, listingIds: u.listingIds, active: u.status === 'active' })), scheduleFor))

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
      .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name) || (a.segment ?? 1) - (b.segment ?? 1))
  }

  /**
   * Scheduled shifts up to yesterday with no record, for people who have ever clocked in. A split-shift day
   * has two shifts, so missing only the second counts once. Without split shifts this is a count of days.
   */
  function absentDaysFor(userId: string, range: ActivityRange): number {
    const mine = records.value.filter(r => r.userId === userId)
    if (!mine.length)
      return 0
    const have = new Set(mine.map(r => `${r.date}|${r.segment ?? 1}`))
    const first = mine.reduce((min, r) => r.date < min ? r.date : min, mine[0]!.date)
    const today = todayKey()
    let missed = 0
    for (const d of eachDay(range)) {
      if (d >= today || d < first)
        continue
      const day = scheduleFor(userId, d)
      if (!day.working)
        continue
      for (let seg = 1; seg <= day.segments.length; seg++) {
        if (!have.has(`${d}|${seg}`))
          missed++
      }
    }
    return missed
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
          // Days, not shifts: a split-shift day with two records is one day present.
          present: new Set(mine.map(r => r.date)).size,
          absent: filters.listingId || filters.flag ? 0 : absentDaysFor(id, range),
          late: mine.filter(r => r.clockInLate).length,
          early: mine.filter(r => r.clockOutEarly).length,
          noCheckOut: mine.filter(r => !r.clockOut && r.date < todayKey()).length,
          // A later shift of the day is keyed `<date>|<n>`, so a day can carry every record.
          byDate: Object.fromEntries(mine.map(r => [r.segment && r.segment > 1 ? `${r.date}|${r.segment}` : r.date, r])),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  const byShift = computed(() => new Map(records.value.map(r => [`${r.userId}|${r.date}|${r.segment ?? 1}`, r])))
  /** The first day each person has a record: nothing before it counts as an absence (the data starts there). */
  const firstRecordDay = computed(() => {
    const first = new Map<string, string>()
    for (const r of records.value) {
      const seen = first.get(r.userId)
      if (!seen || r.date < seen)
        first.set(r.userId, r.date)
    }
    return first
  })

  /**
   * What happened on a day against the schedule, one entry per shift that has a record or was missed. Only for
   * days up to today. A scheduled shift on a past day with no record is `absent` (today is never absent: the day
   * is not over). A record on a day off is kept, so work on a day off shows.
   */
  function attendanceStatus(userId: string, date: string): { segment: number, record?: AttendanceRecord, absent: boolean }[] {
    const today = todayKey()
    if (date > today)
      return []
    const day = scheduleFor(userId, date)
    const planned = day.working ? day.segments.length : 0
    const first = firstRecordDay.value.get(userId)
    const out: { segment: number, record?: AttendanceRecord, absent: boolean }[] = []
    for (let segment = 1; segment <= Math.max(planned, 4); segment++) {
      const record = byShift.value.get(`${userId}|${date}|${segment}`)
      const absent = !record && segment <= planned && date < today && !!first && date >= first
      if (record || absent)
        out.push({ segment, record, absent })
    }
    return out
  }

  return { records, selection, earliestDate, rows, totals, staffSummaries, roleName, listingName, attendanceStatus }
}
