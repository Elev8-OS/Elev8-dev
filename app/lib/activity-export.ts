import type { SheetData } from 'write-excel-file/browser'
import type { ActivityStaffRow } from '~/composables/useActivityReport'
import { formatDuration } from '~/components/activities/data/activities'

/** Excel (.xlsx) export of the Time and Activities report: one row per person. */

const COLUMNS = [
  { header: 'Staff', width: 28 },
  { header: 'Role', width: 26 },
  { header: 'Total activity', width: 14 },
  { header: 'Total time', width: 12 },
  { header: 'Target time', width: 12 },
  { header: 'Of target (%)', width: 13 },
  { header: 'Days not logged', width: 16 },
  { header: 'Longer than usual', width: 18 },
  { header: 'Finished, not logged', width: 20 },
]

export function buildActivitySheet(rows: ActivityStaffRow[]): SheetData {
  const header = COLUMNS.map(c => ({ value: c.header, fontWeight: 'bold' as const }))
  const body = rows.map(r => [
    { value: r.name },
    { value: r.roleName },
    { value: r.count, type: Number },
    { value: formatDuration(r.minutes) },
    // A listing filter has no target to compare with, so those cells stay empty.
    { value: r.targetMinutes ? formatDuration(r.targetMinutes) : undefined },
    { value: r.targetMinutes ? Math.round((r.minutes / r.targetMinutes) * 100) : undefined, type: Number },
    { value: r.missingDays, type: Number },
    { value: r.longCount, type: Number },
    { value: r.unloggedWork, type: Number },
  ])
  return [header, ...body] as SheetData
}

export function activityExportFileName(from: string, to: string): string {
  return `activities-${from}_${to}.xlsx`
}

/** Writes and downloads the workbook. The writer is loaded only on demand. */
export async function downloadActivityXlsx(rows: ActivityStaffRow[], from: string, to: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(buildActivitySheet(rows), {
    sheet: 'Activities',
    columns: COLUMNS.map(c => ({ width: c.width })),
    stickyRowsCount: 1,
  }).toFile(activityExportFileName(from, to))
}
