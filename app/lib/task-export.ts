import type { SheetData } from 'write-excel-file/browser'
import type { Task } from '~/components/tasks/data/schema'
import { assigneeOptions, priorities, statuses } from '~/components/tasks/data/data'
import { taskCompletedAt } from '~/components/tasks/data/timeline'
import { stayDateToCell } from '~/lib/reservation-export'

/** Excel (.xlsx) export of the Tasks table: the rows the filters, search and sorting show. */

type ColumnKind = 'text' | 'number' | 'date' | 'datetime'

interface ExportColumn {
  header: string
  width: number
  kind: ColumnKind
  value: (t: Task) => string | number | undefined
}

function labelOf(options: { value: string, label: string }[], value: string | undefined) {
  return options.find(o => o.value === value)?.label ?? value
}

export const TASK_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Task ID', width: 12, kind: 'text', value: t => t.id },
  { header: 'Title', width: 36, kind: 'text', value: t => t.title },
  { header: 'Instructions', width: 48, kind: 'text', value: t => t.description },
  { header: 'Status', width: 14, kind: 'text', value: t => labelOf(statuses, t.status) },
  { header: 'Progress %', width: 11, kind: 'number', value: t => t.progress },
  { header: 'Priority', width: 10, kind: 'text', value: t => labelOf(priorities, t.priority) },
  { header: 'Assignee', width: 22, kind: 'text', value: t => labelOf(assigneeOptions, t.assignee) },
  { header: 'Assignee Type', width: 13, kind: 'text', value: t => t.assigneeType === 'role' ? 'Role' : t.assigneeType === 'person' ? 'Person' : undefined },
  { header: 'Listing', width: 34, kind: 'text', value: t => t.listing },
  { header: 'Room', width: 18, kind: 'text', value: t => t.unitName },
  { header: 'Due Date', width: 12, kind: 'date', value: t => t.dueDate },
  { header: 'Created At', width: 18, kind: 'datetime', value: t => t.createdAt },
  { header: 'Completed At', width: 18, kind: 'datetime', value: t => taskCompletedAt(t) },
  { header: 'Owner Maintenance', width: 18, kind: 'text', value: t => t.ownerVisible ? 'Yes' : undefined },
  { header: 'From Schedule', width: 14, kind: 'text', value: t => t.scheduleId ? 'Yes' : undefined },
  { header: 'Inventory Item', width: 24, kind: 'text', value: t => t.linkedInventoryItemName },
]

function cell(column: ExportColumn, t: Task) {
  const raw = column.value(t)
  if (raw === undefined || raw === null || raw === '')
    return null
  switch (column.kind) {
    case 'date': {
      const date = stayDateToCell(String(raw))
      return date ? { type: Date, value: date, format: 'yyyy-mm-dd' } : { type: String, value: String(raw) }
    }
    case 'datetime': {
      const date = new Date(String(raw))
      return Number.isNaN(date.getTime()) ? { type: String, value: String(raw) } : { type: Date, value: date, format: 'yyyy-mm-dd hh:mm' }
    }
    case 'number':
      return { type: Number, value: Number(raw) }
    default:
      return { type: String, value: String(raw) }
  }
}

export function buildTasksSheet(tasks: Task[]): SheetData {
  const header = TASK_EXPORT_COLUMNS.map(c => ({ value: c.header, fontWeight: 'bold' as const }))
  const rows = tasks.map(t => TASK_EXPORT_COLUMNS.map(c => cell(c, t)))
  return [header, ...rows] as SheetData
}

/** `tasks-2026-10-18.xlsx`, with the LOCAL date (`toISOString` shifts a UTC+8 date). */
export function tasksExportFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `tasks-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.xlsx`
}

/** Writes and downloads the workbook. The writer is loaded only on demand. */
export async function downloadTasksXlsx(tasks: Task[]) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(buildTasksSheet(tasks), {
    sheet: 'Tasks',
    columns: TASK_EXPORT_COLUMNS.map(c => ({ width: c.width })),
    stickyRowsCount: 1,
  }).toFile(tasksExportFileName())
}
