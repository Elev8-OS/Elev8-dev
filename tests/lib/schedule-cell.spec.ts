import { describe, expect, it } from 'vitest'
import { clockedLabel, dayStatus, shortRange, shortTime } from '~/lib/schedule-cell'

const rec = (over: Record<string, unknown> = {}) => ({ id: 'r', userId: 'u', date: '2026-10-14', listingId: 'l', clockIn: '08:00', clockOut: '17:00', clockInLate: false, clockOutEarly: false, clockInPhoto: false, clockOutPhoto: false, ...over })
const entry = (over: Record<string, unknown> = {}, segment = 1) => ({ segment, record: rec(over), absent: false })
const absent = (segment = 1) => ({ segment, record: undefined, absent: true })
const today = '2026-10-17'

describe('short hours', () => {
  it('drops the minutes when they are zero', () => {
    expect(shortTime('10:00')).toBe('10')
    expect(shortTime('07:00')).toBe('07')
    expect(shortTime('07:30')).toBe('07:30')
    expect(shortRange('10:00', '18:00')).toBe('10-18')
    expect(shortRange('07:30', '16:30')).toBe('07:30-16:30')
    expect(shortRange('22:00', '06:00')).toBe('22-06 +1')
  })
})

describe('dayStatus', () => {
  it('has nothing to say without entries', () => {
    expect(dayStatus([], '2026-10-14', today)).toBeUndefined()
  })

  it('reads one shift', () => {
    expect(dayStatus([entry()], '2026-10-14', today)).toMatchObject({ kind: 'ok', label: 'On time', problem: false })
    expect(dayStatus([entry({ clockInLate: true })], '2026-10-14', today)).toMatchObject({ kind: 'late', problem: true })
    expect(dayStatus([entry({ clockOutEarly: true })], '2026-10-14', today)).toMatchObject({ kind: 'early', problem: true })
    expect(dayStatus([absent()], '2026-10-14', today)).toMatchObject({ kind: 'absent', problem: true })
  })

  it('tells a missing check-out on a past day from a shift still running today', () => {
    expect(dayStatus([entry({ clockOut: undefined })], '2026-10-14', today)).toMatchObject({ kind: 'no-checkout', problem: true })
    expect(dayStatus([entry({ clockOut: undefined })], today, today)).toMatchObject({ kind: 'open', label: 'Working', problem: false })
  })

  it('takes the worst of a split-shift day', () => {
    expect(dayStatus([entry(), absent(2)], '2026-10-14', today)?.kind).toBe('absent')
    expect(dayStatus([entry({ clockInLate: true }), entry({ clockOutEarly: true }, 2)], '2026-10-14', today)?.kind).toBe('late')
    expect(dayStatus([entry(), entry({}, 2)], '2026-10-14', today)?.kind).toBe('ok')
  })
})

describe('clockedLabel', () => {
  it('says what was clocked', () => {
    expect(clockedLabel(rec() as never, '2026-10-14', today)).toBe('08:00 to 17:00')
    expect(clockedLabel(rec({ clockIn: '22:00', clockOut: '06:00', clockOutNextDay: true }) as never, '2026-10-14', today)).toBe('22:00 to 06:00 (+1)')
    expect(clockedLabel(rec({ clockOut: undefined }) as never, '2026-10-14', today)).toBe('08:00 to no check-out')
    expect(clockedLabel(rec({ clockOut: undefined }) as never, today, today)).toBe('08:00 to now')
  })
})
