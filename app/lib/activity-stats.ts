import { parseLocalDateKey, toLocalDateKey } from '~/components/activities/data/activities'

/** Pure date and number helpers for the activity report. All dates are local `YYYY-MM-DD` keys. */

export interface DayRange {
  from: string
  to: string
}

/** Every day key from `range.from` to `range.to`, inclusive. */
export function eachDay(range: DayRange): string[] {
  const days: string[] = []
  const start = parseLocalDateKey(range.from)
  const end = parseLocalDateKey(range.to)
  for (let d = start; d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
    days.push(toLocalDateKey(d))
  return days
}

/** Sundays are the day off (Monday to Saturday, the 26 working days a month the users carry). */
export function isWorkDay(key: string): boolean {
  return parseLocalDateKey(key).getDay() !== 0
}

/** Working days in the range, never counting days after `today`. */
export function workDaysIn(range: DayRange, today = toLocalDateKey(new Date())): number {
  return eachDay(range).filter(d => d <= today && isWorkDay(d)).length
}

/** The range of the same length directly before this one. */
export function previousRange(range: DayRange): DayRange {
  const length = eachDay(range).length
  const start = parseLocalDateKey(range.from)
  const prevTo = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1)
  const prevFrom = new Date(prevTo.getFullYear(), prevTo.getMonth(), prevTo.getDate() - (length - 1))
  return { from: toLocalDateKey(prevFrom), to: toLocalDateKey(prevTo) }
}

export function median(values: number[]): number {
  if (!values.length)
    return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Whole-number change in percent, or undefined when there is nothing to compare with. */
export function deltaPercent(current: number, previous: number): number | undefined {
  if (previous <= 0)
    return undefined
  return Math.round(((current - previous) / previous) * 100)
}

/** `1 2 3 … 9 10` style page list around the current page. `null` is an ellipsis. */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7)
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  const pages = new Set([1, pageCount, page - 1, page, page + 1])
  if (page <= 3)
    [2, 3, 4].forEach(p => pages.add(p))
  if (page >= pageCount - 2)
    [pageCount - 1, pageCount - 2, pageCount - 3].forEach(p => pages.add(p))
  const sorted = [...pages].filter(p => p >= 1 && p <= pageCount).sort((a, b) => a - b)
  const out: (number | null)[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1)
      out.push(null)
    out.push(p)
  })
  return out
}
