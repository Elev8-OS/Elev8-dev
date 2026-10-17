import type { AttendanceRecord } from '~/components/attendance/data/attendance'
import { spansMidnight } from '~/lib/schedule'

/** Pure helpers for a cell of the Schedule week grid: short hours, and one status for a day. */

/** What Attendance has for a shift of a day: the record, or a missed shift. */
export interface AttendanceEntry {
  segment: number
  record?: AttendanceRecord
  absent: boolean
}

/** `10` for 10:00 and `07` for 07:00, `07:30` otherwise. */
export function shortTime(time: string): string {
  return time.endsWith(':00') ? time.slice(0, 2) : time
}

/** `10-18`, `07:30-16:30`, `22-06 +1` for a shift past midnight. */
export function shortRange(start: string, end: string): string {
  return `${shortTime(start)}-${shortTime(end)}${spansMidnight(start, end) ? ' +1' : ''}`
}

export type DayStatusKind = 'absent' | 'no-checkout' | 'late' | 'early' | 'open' | 'ok'

export interface DayStatus {
  kind: DayStatusKind
  label: string
  icon: string
  /** True for the ones that need a look (shown in the destructive colour). */
  problem: boolean
}

const STATUS: Record<DayStatusKind, Omit<DayStatus, 'kind'>> = {
  'absent': { label: 'Absent', icon: 'lucide:user-x', problem: true },
  'no-checkout': { label: 'No check-out', icon: 'lucide:log-out', problem: true },
  'late': { label: 'Late', icon: 'lucide:clock-alert', problem: true },
  'early': { label: 'Left early', icon: 'lucide:log-out', problem: true },
  'open': { label: 'Working', icon: 'lucide:circle-dot', problem: false },
  'ok': { label: 'On time', icon: 'lucide:check', problem: false },
}

/** The status of one shift. */
export function entryStatus(entry: AttendanceEntry, date: string, today: string): DayStatusKind {
  if (!entry.record)
    return 'absent'
  const r = entry.record
  if (!r.clockOut)
    return date < today ? 'no-checkout' : 'open'
  if (r.clockInLate)
    return 'late'
  if (r.clockOutEarly)
    return 'early'
  return 'ok'
}

const ORDER: DayStatusKind[] = ['absent', 'no-checkout', 'late', 'early', 'open', 'ok']

/** One status for the whole day: the worst of its shifts (absent first, on time last). Undefined with nothing to say. */
export function dayStatus(entries: AttendanceEntry[], date: string, today: string): DayStatus | undefined {
  if (!entries.length)
    return undefined
  const kinds = entries.map(e => entryStatus(e, date, today))
  const worst = ORDER.find(k => kinds.includes(k))!
  return { kind: worst, ...STATUS[worst] }
}

/** `08:05 to 17:02`, `(+1)` past midnight, `now` while still working today, `no check-out` for a past day. */
export function clockedLabel(r: AttendanceRecord, date: string, today: string): string {
  const out = r.clockOut ? `${r.clockOut}${r.clockOutNextDay ? ' (+1)' : ''}` : (date < today ? 'no check-out' : 'now')
  return `${r.clockIn} to ${out}`
}
