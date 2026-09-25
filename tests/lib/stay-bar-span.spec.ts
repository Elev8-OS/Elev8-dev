import { describe, expect, it } from 'vitest'
import { assignStayLanes, stayBarSpan } from '~/components/operations-calendar/data/operations-calendar'

// Mon 1 Mar to Sun 7 Mar 2027: 14 half-day columns, 0 to 13.
const WEEK = ['2027-03-01', '2027-03-02', '2027-03-03', '2027-03-04', '2027-03-05', '2027-03-06', '2027-03-07']

describe('stayBarSpan', () => {
  it('starts after midday on check-in day and ends before midday on check-out day', () => {
    // In Tue afternoon (half 3), out Thu morning (half 6 is Thu morning, so end is 7).
    expect(stayBarSpan('2027-03-02', '2027-03-04', WEEK)).toEqual({
      startHalf: 3,
      endHalf: 7,
      continuesBefore: false,
      continuesAfter: false,
    })
  })

  it('meets the next guest at midday on a turnover day instead of overlapping', () => {
    const leaving = stayBarSpan('2027-03-01', '2027-03-04', WEEK)!
    const arriving = stayBarSpan('2027-03-04', '2027-03-06', WEEK)!
    expect(leaving.endHalf).toBe(7)
    expect(arriving.startHalf).toBe(7)
  })

  it('runs a stay that began before the week from the first column, flat-edged', () => {
    expect(stayBarSpan('2027-02-25', '2027-03-03', WEEK)).toEqual({
      startHalf: 0,
      endHalf: 5,
      continuesBefore: true,
      continuesAfter: false,
    })
  })

  it('runs a stay that ends after the week to the last column, flat-edged', () => {
    expect(stayBarSpan('2027-03-06', '2027-03-12', WEEK)).toEqual({
      startHalf: 11,
      endHalf: 14,
      continuesBefore: false,
      continuesAfter: true,
    })
  })

  it('shows a departure on the first day as a morning-only bar, and an arrival on the last as an afternoon-only one', () => {
    expect(stayBarSpan('2027-02-26', '2027-03-01', WEEK)).toMatchObject({ startHalf: 0, endHalf: 1 })
    expect(stayBarSpan('2027-03-07', '2027-03-09', WEEK)).toMatchObject({ startHalf: 13, endHalf: 14 })
  })

  it('draws nothing for a stay outside the week, or one with no nights', () => {
    expect(stayBarSpan('2027-03-10', '2027-03-12', WEEK)).toBeNull()
    expect(stayBarSpan('2027-02-20', '2027-02-25', WEEK)).toBeNull()
    expect(stayBarSpan('2027-03-03', '2027-03-03', WEEK)).toBeNull()
  })
})

describe('assignStayLanes', () => {
  it('stacks a long stay apart from the shorter stays it overlaps', () => {
    const long = { startHalf: 0, endHalf: 14 }
    const leaving = { startHalf: 0, endHalf: 7 }
    const arriving = { startHalf: 9, endHalf: 14 }
    const { lanes, laneCount } = assignStayLanes([leaving, long, arriving])
    expect(laneCount).toBe(2)
    // The longest bar takes the first lane; the two that never overlap share the other.
    expect(lanes[1]).toBe(0)
    expect(lanes[0]).toBe(1)
    expect(lanes[2]).toBe(1)
  })

  it('keeps two guests that only meet at midday in one lane', () => {
    const { lanes, laneCount } = assignStayLanes([{ startHalf: 0, endHalf: 7 }, { startHalf: 7, endHalf: 12 }])
    expect(laneCount).toBe(1)
    expect(lanes).toEqual([0, 0])
  })

  it('opens a lane per stay when three overlap at once', () => {
    const span = { startHalf: 2, endHalf: 10 }
    expect(assignStayLanes([span, span, span])).toEqual({ lanes: [0, 1, 2], laneCount: 3 })
  })

  it('has no lanes for no stays', () => {
    expect(assignStayLanes([])).toEqual({ lanes: [], laneCount: 0 })
  })
})
