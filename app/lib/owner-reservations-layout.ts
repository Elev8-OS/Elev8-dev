// Pure helpers for the owner-portal reservation calendar.
//
// The shared `getMonthGrid` lives in the operations calendar data layer;
// here we add the reservation-specific shape (date objects, in-month flag,
// today highlight) plus a bar builder that turns a flat list of
// reservations into single-row bars ready for absolute positioning. Each
// reservation produces exactly one bar — overlapping stays visually
// overlap on the same horizontal line, and reservations that cross a
// week boundary are NOT split into per-week segments.

import type { OwnerReservation, OwnerReservationBar, OwnerReservationDay } from '~/components/owners/data/owner-reservations'

/**
 * Return six weeks of Monday-first day cells for the calendar month that
 * contains `anchor`. Day cells outside the month carry `inMonth: false` so
 * the template can render them with reduced emphasis.
 */
export function buildReservationMonthGrid(anchor: Date): OwnerReservationDay[] {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const dayOfWeek = monthStart.getDay()
  // Snap to Monday: in JS, Sunday is 0; (0 + 6) % 7 = 6 days back from
  // Sunday gives the Monday of the same week.
  const offset = (dayOfWeek + 6) % 7
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - offset)
  gridStart.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cells: OwnerReservationDay[] = []
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + i)
    cells.push({
      key: toDateKey(date),
      date,
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      inMonth: date.getMonth() === anchor.getMonth() && date.getFullYear() === anchor.getFullYear(),
      isToday: date.getTime() === today.getTime(),
    })
  }
  return cells
}

/**
 * Format a `Date` as `YYYY-MM-DD` using the *local* date components.
 *
 * `Date#toISOString` always returns UTC, which is one calendar day behind
 * the user's intent for any time zone east of UTC (e.g. Bali is UTC+8,
 * midnight local is 16:00 the previous day in UTC). The reservation
 * grid is keyed by the user's local calendar day, so we must format from
 * the local getters.
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Map a date key (or `Date`) to its column index inside a 42-cell month grid. */
export function columnIndexFor(grid: OwnerReservationDay[], key: string | Date): number {
  const target = typeof key === 'string' ? key : toDateKey(key)
  return grid.findIndex(cell => cell.key === target)
}

/**
 * Convert a flat list of reservations into positioned bars for the given
 * listing, scoped to the month grid. Each reservation produces exactly
 * one bar on `row: 0` — overlapping stays visually overlap on the same
 * horizontal line, and reservations that cross a week boundary are
 * rendered as a single contiguous bar (never split into segments).
 *
 *   - Skips reservations entirely outside the grid.
 *   - Clamps `startDay` to 0 and `endDay` to the last in-grid cell so a
 *     stay that started before this month (or ends next month) still
 *     renders. The `wrapsBackward` / `wrapsForward` flags tell the
 *     component which edges ran past the grid so it can drop the
 *     half-cell inset at that edge.
 */
export function buildReservationBars(
  grid: OwnerReservationDay[],
  listingId: string,
  reservations: OwnerReservation[],
): OwnerReservationBar[] {
  if (reservations.length === 0)
    return []

  const lastIndex = grid.length - 1

  interface Segment {
    reservation: OwnerReservation
    startDay: number
    endDay: number
  }

  const segments: Segment[] = []
  for (const reservation of reservations) {
    if (reservation.listingId !== listingId)
      continue
    const startIndex = columnIndexFor(grid, reservation.checkIn)
    // Reservations with a checkOut before the grid are skipped.
    const endIndex = columnIndexFor(grid, reservation.checkOut)
    if (endIndex === -1)
      continue
    if (startIndex === -1 && endIndex >= 0) {
      // The bar starts before the grid — clamp to the first cell.
      segments.push({ reservation, startDay: 0, endDay: endIndex })
      continue
    }
    if (startIndex >= 0)
      segments.push({ reservation, startDay: startIndex, endDay: Math.min(endIndex, lastIndex) })
  }
  if (segments.length === 0)
    return []

  const bars: OwnerReservationBar[] = []
  // Each reservation produces exactly one bar — the calendar UI renders
  // every reservation on the same horizontal line (overlapping stays
  // visually overlap on that line), and never splits a reservation into
  // separate segments per visible week.
  for (const segment of segments) {
    const { reservation, startDay, endDay } = segment
    if (endDay < startDay)
      continue
    pushBar(grid, bars, reservation, startDay, endDay)
  }
  return bars
}

function pushBar(
  grid: OwnerReservationDay[],
  bars: OwnerReservationBar[],
  reservation: OwnerReservation,
  startDay: number,
  endDay: number,
) {
  const lastIndex = grid.length - 1
  const startsBeforeGrid = startDay < 0
  const endsAfterGrid = endDay > lastIndex
  const trimmedStart = Math.max(0, startDay)
  const trimmedEnd = Math.min(lastIndex, endDay)

  bars.push({
    id: `${reservation.id}-${trimmedStart}-${trimmedEnd}`,
    type: reservation.type,
    listingId: reservation.listingId,
    guestName: reservation.guestName,
    channel: reservation.channel,
    note: reservation.note,
    status: reservation.status,
    startDay: trimmedStart,
    endDay: trimmedEnd,
    row: 0,
    wrapsBackward: startsBeforeGrid,
    wrapsForward: endsAfterGrid,
  })
}
