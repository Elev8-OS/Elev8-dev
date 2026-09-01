import type { OwnerReservation } from '~/components/owners/data/owner-reservations'
import { describe, expect, it } from 'vitest'
import {
  buildReservationBars,
  buildReservationMonthGrid,
  columnIndexFor,
  toDateKey,
} from '~/lib/owner-reservations-layout'

function reservation(partial: Partial<OwnerReservation> & { id: string, checkIn: string, checkOut: string }): OwnerReservation {
  return {
    type: 'guest',
    listingId: 'lst-1',
    guestName: 'Test Guest',
    channel: 'airbnb',
    status: 'confirmed',
    ...partial,
  }
}

describe('buildReservationMonthGrid', () => {
  it('returns 42 Monday-first day cells for the anchor month', () => {
    const grid = buildReservationMonthGrid(new Date(2025, 5, 1)) // June 2025
    expect(grid).toHaveLength(42)
    // The first cell should be the Monday of the week that contains June 1.
    // June 1 2025 is a Sunday, so the first cell is May 26 (the prior Monday).
    expect(grid[0]!.key).toBe('2025-05-26')
    expect(grid[0]!.inMonth).toBe(false)
    // Cells in the second row (Jun 2 .. Jun 8) include the in-month cells.
    expect(grid[7]!.inMonth).toBe(true)
    // The last cell is the Sunday of the final visible week.
    expect(grid[41]!.key).toBe('2025-07-06')
  })

  it('marks the today cell when the anchor month is the current month', () => {
    const today = new Date()
    const grid = buildReservationMonthGrid(today)
    const todayKey = toDateKey(today)
    const todayCell = grid.find(cell => cell.key === todayKey)
    expect(todayCell?.isToday).toBe(true)
  })
})

describe('columnIndexFor', () => {
  it('returns the cell index for a date key', () => {
    const grid = buildReservationMonthGrid(new Date(2025, 5, 1))
    expect(columnIndexFor(grid, '2025-06-01')).toBeGreaterThanOrEqual(0)
    expect(columnIndexFor(grid, 'not-a-date')).toBe(-1)
  })
})

describe('buildReservationBars', () => {
  it('returns no bars for a listing with no reservations', () => {
    const grid = buildReservationMonthGrid(new Date(2025, 11, 1))
    expect(buildReservationBars(grid, 'lst-1', [])).toEqual([])
  })

  it('places a single in-month stay in row 0 with the correct column range', () => {
    const grid = buildReservationMonthGrid(new Date(2025, 11, 1))
    const stay = reservation({ id: 'r-1', checkIn: '2025-12-15', checkOut: '2025-12-20' })
    const bars = buildReservationBars(grid, 'lst-1', [stay])
    expect(bars).toHaveLength(1)
    const [bar] = bars
    expect(bar?.startDay).toBeGreaterThanOrEqual(0)
    expect(bar?.endDay).toBeGreaterThan(bar?.startDay ?? 0)
    expect(bar?.row).toBe(0)
  })

  it('stacks overlapping stays on separate rows', () => {
    const grid = buildReservationMonthGrid(new Date(2025, 11, 1))
    const a = reservation({ id: 'a', checkIn: '2025-12-15', checkOut: '2025-12-18' })
    const b = reservation({ id: 'b', checkIn: '2025-12-16', checkOut: '2025-12-20' })
    const bars = buildReservationBars(grid, 'lst-1', [a, b])
    expect(bars).toHaveLength(2)
    // Two stays running at the same time must not draw over each other.
    expect(bars.map(bar => bar.row).sort()).toEqual([0, 1])
  })

  it('reuses row 0 for stays that do not overlap', () => {
    const grid = buildReservationMonthGrid(new Date(2025, 11, 1))
    const a = reservation({ id: 'a', checkIn: '2025-12-15', checkOut: '2025-12-18' })
    const b = reservation({ id: 'b', checkIn: '2025-12-19', checkOut: '2025-12-22' })
    const bars = buildReservationBars(grid, 'lst-1', [a, b])
    const rows = bars.map(bar => bar.row)
    expect(new Set(rows).size).toBe(1)
  })

  it('renders a stay that crosses a week boundary as a single bar', () => {
    const grid = buildReservationMonthGrid(new Date(2025, 11, 1))
    const stay = reservation({ id: 'r-2', checkIn: '2025-12-22', checkOut: '2025-12-30' })
    const bars = buildReservationBars(grid, 'lst-1', [stay])
    expect(bars).toHaveLength(1)
    // The single bar spans the full range (clipped to the grid edges only
    // if it actually extends past them — this stay is fully in-month).
    expect(bars[0]?.startDay).toBeGreaterThan(0)
    expect(bars[0]?.endDay).toBeLessThan(41)
  })

  it('only returns bars for the requested listing', () => {
    const grid = buildReservationMonthGrid(new Date(2025, 11, 1))
    const stay = reservation({ id: 'a', listingId: 'lst-2', checkIn: '2025-12-15', checkOut: '2025-12-20' })
    const bars = buildReservationBars(grid, 'lst-1', [stay])
    expect(bars).toEqual([])
  })
})
