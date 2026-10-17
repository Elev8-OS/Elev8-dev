import type { SheetData } from 'write-excel-file/browser'
import type { AttendanceStaffSummary } from '~/composables/useAttendanceReport'
import { parseLocalDateKey } from '~/components/activities/data/activities'
import { eachDay } from '~/lib/activity-stats'

/** Excel (.xlsx) export of Attendance: one row per person, then a Clock-in and Clock-out column for every day. */

const FIXED = [
  { header: 'No', width: 5 },
  { header: 'Employee ID', width: 14 },
  { header: 'Staff', width: 26 },
  { header: 'Role', width: 26 },
  { header: 'Date joined', width: 13 },
  { header: 'Total present', width: 13 },
  { header: 'Total absence', width: 13 },
  { header: 'Total late in', width: 13 },
  { header: 'Total early out', width: 14 },
  { header: 'Total no check out', width: 18 },
]

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

/** Days that carry a record for somebody. Days nobody clocked in on (Sundays) are left out. */
export function attendanceExportDays(summaries: AttendanceStaffSummary[], from: string, to: string): string[] {
  return eachDay({ from, to }).filter(d => summaries.some(s => s.byDate[d] || Object.keys(s.byDate).some(k => k.startsWith(`${d}|`))))
}

/** A column pair per day, plus a pair per extra shift ("shift 2", "shift 3") on days somebody worked a split shift. */
export function attendanceExportColumns(summaries: AttendanceStaffSummary[], from: string, to: string): { key: string, label: string }[] {
  return attendanceExportDays(summaries, from, to).flatMap((d) => {
    const label = dayFmt.format(parseLocalDateKey(d))
    const cols = [{ key: d, label }]
    const most = Math.max(1, ...summaries.flatMap(s => Object.keys(s.byDate).filter(k => k.startsWith(`${d}|`)).map(k => Number(k.split('|')[1]))))
    for (let n = 2; n <= most; n++)
      cols.push({ key: `${d}|${n}`, label: `${label}, shift ${n}` })
    return cols
  })
}

export function buildAttendanceSheet(summaries: AttendanceStaffSummary[], from: string, to: string): SheetData {
  const days = attendanceExportColumns(summaries, from, to)
  const bold = (value: string) => ({ value, fontWeight: 'bold' as const })
  const header = [
    ...FIXED.map(c => bold(c.header)),
    ...days.flatMap(c => [bold(`${c.label} in`), bold(`${c.label} out`)]),
  ]
  const body = summaries.map((s, i) => [
    { value: i + 1, type: Number },
    { value: s.employeeNumber },
    { value: s.name },
    { value: s.roleName },
    { value: s.joined },
    { value: s.present, type: Number },
    { value: s.absent, type: Number },
    { value: s.late, type: Number },
    { value: s.early, type: Number },
    { value: s.noCheckOut, type: Number },
    ...days.flatMap((c) => {
      const r = s.byDate[c.key]
      return [{ value: r?.clockIn ?? '-' }, { value: r ? (r.clockOut ? `${r.clockOut}${r.clockOutNextDay ? ' (+1)' : ''}` : '-') : '-' }]
    }),
  ])
  return [header, ...body] as SheetData
}

export function attendanceExportFileName(from: string, to: string): string {
  return `attendance-${from}_${to}.xlsx`
}

/** Writes and downloads the workbook. The writer is loaded only on demand. */
export async function downloadAttendanceXlsx(summaries: AttendanceStaffSummary[], from: string, to: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const days = attendanceExportColumns(summaries, from, to)
  await writeXlsxFile(buildAttendanceSheet(summaries, from, to), {
    sheet: 'Attendance',
    columns: [...FIXED.map(c => ({ width: c.width })), ...days.flatMap(() => [{ width: 12 }, { width: 12 }])],
    stickyRowsCount: 1,
    stickyColumnsCount: 3,
  }).toFile(attendanceExportFileName(from, to))
}
