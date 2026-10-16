import { describe, expect, it } from 'vitest'
import { deltaPercent, eachDay, isWorkDay, median, pageWindow, previousRange, workDaysIn } from '~/lib/activity-stats'

describe('eachDay', () => {
  it('lists every day inclusive, across a month end', () => {
    expect(eachDay({ from: '2026-09-29', to: '2026-10-02' })).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
    expect(eachDay({ from: '2026-10-16', to: '2026-10-16' })).toEqual(['2026-10-16'])
  })
})

describe('working days', () => {
  it('treats only Sunday as a day off', () => {
    expect(isWorkDay('2026-10-17')).toBe(true) // Saturday
    expect(isWorkDay('2026-10-18')).toBe(false) // Sunday
  })

  it('does not count days after today', () => {
    const range = { from: '2026-10-12', to: '2026-10-18' }
    expect(workDaysIn(range, '2026-10-20')).toBe(6)
    expect(workDaysIn(range, '2026-10-14')).toBe(3)
  })
})

describe('previousRange', () => {
  it('is the same length directly before', () => {
    expect(previousRange({ from: '2026-10-10', to: '2026-10-16' })).toEqual({ from: '2026-10-03', to: '2026-10-09' })
    expect(previousRange({ from: '2026-10-16', to: '2026-10-16' })).toEqual({ from: '2026-10-15', to: '2026-10-15' })
    expect(previousRange({ from: '2026-10-01', to: '2026-10-31' })).toEqual({ from: '2026-08-31', to: '2026-09-30' })
  })
})

describe('median and delta', () => {
  it('takes the middle value', () => {
    expect(median([])).toBe(0)
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('has no change to show without a previous value', () => {
    expect(deltaPercent(120, 100)).toBe(20)
    expect(deltaPercent(50, 100)).toBe(-50)
    expect(deltaPercent(10, 0)).toBeUndefined()
  })
})

describe('pageWindow', () => {
  it('shows every page when there are few', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('collapses the far pages into ellipses', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, null, 20])
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20])
    expect(pageWindow(20, 20)).toEqual([1, null, 17, 18, 19, 20])
  })
})
