import { describe, expect, it } from 'vitest'
import type { ScheduleOverride } from '~/lib/schedule'
import type { ShiftTemplate } from '~/lib/schedule'
import type { ScheduleRotation } from '~/lib/schedule'
import { SEED_SHIFTS, hoursFromShifts, shiftForRoleHours, workingHoursProblem } from '~/lib/schedule'
import { addDays, buildSeedSchedule, carryOverOf, crossDayProblem, rotationDayFor, rotationProblem, datesBetween, resolveSchedule, scheduleLabel, plannedMinutesOf, scheduleLabelLong, segmentsProblem, shiftLength, shiftMinutes, sortDays, spansMidnight, weekDayOf, weekStart } from '~/lib/schedule'

const fixed = { scheduleType: 'fixed' as const, startTime: '10:00', endTime: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const }
const flexible = { scheduleType: 'flexible' as const, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const }
const hours = (h: typeof fixed | typeof flexible) => ({ ...h, days: [...h.days] })

const override = (o: Partial<ScheduleOverride>): ScheduleOverride => ({
  id: 'x', userId: 'u', date: '2026-10-14', kind: 'day_off', dayOffType: 'leave', createdAt: '', createdBy: '', ...o,
})

describe('weekDayOf and dates', () => {
  it('names the weekday of a local date key', () => {
    expect(weekDayOf('2026-10-16')).toBe('Fri')
    expect(weekDayOf('2026-10-18')).toBe('Sun')
  })

  it('finds the Monday of a week, Sunday included', () => {
    expect(weekStart('2026-10-14')).toBe('2026-10-12')
    expect(weekStart('2026-10-18')).toBe('2026-10-12')
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
  })

  it('lists dates inclusively and adds days across a month', () => {
    expect(datesBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(datesBetween('2026-10-05', '2026-10-01')).toEqual([])
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  })

  it('keeps week order', () => {
    expect(sortDays(['Sat', 'Mon', 'Wed'])).toEqual(['Mon', 'Wed', 'Sat'])
  })
})

describe('resolveSchedule', () => {
  it('follows the role: its hours on its days, a weekly day off otherwise', () => {
    const wed = resolveSchedule(hours(fixed), undefined, undefined, '2026-10-14')
    expect(wed).toMatchObject({ working: true, source: 'role', shift: { start: '10:00', end: '18:00', flexible: false } })
    const sat = resolveSchedule(hours(fixed), undefined, undefined, '2026-10-17')
    expect(sat).toMatchObject({ working: false, reason: 'weekly', source: 'role' })
  })

  it('treats a flexible role as having no fixed hours', () => {
    const day = resolveSchedule(hours(flexible), undefined, undefined, '2026-10-18')
    expect(day).toMatchObject({ working: true, shift: { flexible: true } })
    expect(scheduleLabel(day)).toBe('Flexible')
  })

  it('lets a person own their weekly days, with the role hours', () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
    expect(resolveSchedule(hours(flexible), [...days], undefined, '2026-10-18')).toMatchObject({ working: false, reason: 'weekly', source: 'person' })
    expect(resolveSchedule(hours(fixed), [...days], undefined, '2026-10-17')).toMatchObject({ working: true, source: 'person', shift: { start: '10:00' } })
  })

  it('lets a dated day off win over a working weekday', () => {
    const day = resolveSchedule(hours(fixed), undefined, override({ dayOffType: 'sick', note: 'Fever' }), '2026-10-14')
    expect(day).toMatchObject({ working: false, reason: 'sick', source: 'override', note: 'Fever' })
    expect(scheduleLabel(day)).toBe('Sick day')
  })

  it('lets a working override add a weekly day off, with or without its own hours', () => {
    const own = resolveSchedule(hours(fixed), undefined, override({ kind: 'working', date: '2026-10-17', startTime: '07:00', endTime: '15:00' }), '2026-10-17')
    expect(own).toMatchObject({ working: true, source: 'override', shift: { start: '07:00', end: '15:00', flexible: false } })
    const plain = resolveSchedule(hours(fixed), undefined, override({ kind: 'working', date: '2026-10-17' }), '2026-10-17')
    expect(plain).toMatchObject({ working: true, shift: { start: '10:00', end: '18:00' } })
  })
})

describe('buildSeedSchedule', () => {
  it('is relative to today and gives one past and two coming days off', () => {
    const now = new Date(2026, 9, 16, 12, 0)
    const { overrides, personDays } = buildSeedSchedule(now)
    expect(overrides.filter(o => o.kind === 'day_off' && o.date < '2026-10-16')).toHaveLength(1)
    expect(overrides.filter(o => o.kind === 'day_off' && o.date > '2026-10-16')).toHaveLength(2)
    expect(personDays['user-1']).not.toContain('Sun')
  })
})

const morning: ShiftTemplate = { id: 'shift-morning', name: 'Morning', start: '07:00', end: '15:00', breakMinutes: 30, tone: 'warning' }

describe('shifts', () => {
  it('uses a person default shift on their working days, in place of the role hours', () => {
    const day = resolveSchedule(hours(fixed), undefined, undefined, '2026-10-14', [morning])
    expect(day).toMatchObject({ working: true, source: 'person', shift: { name: 'Morning', start: '07:00', end: '15:00', breakMinutes: 30 } })
    expect(scheduleLabelLong(day)).toBe('Morning, 07:00 to 15:00')
    // Still off on the role's weekly day off.
    expect(resolveSchedule(hours(fixed), undefined, undefined, '2026-10-17', [morning])).toMatchObject({ working: false, reason: 'weekly' })
  })

  it('lets a dated shift (a snapshot on the override) win over the default shift', () => {
    const o = override({ kind: 'working', startTime: '12:00', endTime: '20:00', shiftId: 'shift-afternoon', shiftName: 'Afternoon', shiftTone: 'chart-5', breakMinutes: 45 })
    const day = resolveSchedule(hours(fixed), undefined, o, '2026-10-14', [morning])
    expect(day).toMatchObject({ working: true, source: 'override', shift: { name: 'Afternoon', start: '12:00', breakMinutes: 45 } })
  })

  it('counts paid minutes as length minus break, and nothing without fixed hours', () => {
    expect(shiftMinutes({ start: '07:00', end: '15:00', flexible: false, breakMinutes: 30 })).toBe(450)
    expect(shiftMinutes({ start: '08:00', end: '17:00', flexible: false })).toBe(540)
    expect(shiftMinutes({ flexible: true })).toBeUndefined()
  })
})

describe('split shifts', () => {
  const split = override({ kind: 'working', startTime: '07:00', endTime: '11:00', shiftName: 'Early', breakMinutes: 0, extra: [{ startTime: '16:00', endTime: '20:00', shiftName: 'Late', breakMinutes: 0 }] })

  it('resolves two segments in time order, the first being the day shift', () => {
    const day = resolveSchedule(hours(fixed), undefined, split, '2026-10-14')
    expect(day).toMatchObject({ working: true, shift: { start: '07:00' } })
    if (!day.working)
      throw new Error('expected a working day')
    expect(day.segments.map(s => `${s.start}-${s.end}`)).toEqual(['07:00-11:00', '16:00-20:00'])
    expect(scheduleLabel(day)).toBe('07:00 to 11:00, 16:00 to 20:00')
    expect(scheduleLabelLong(day)).toBe('Early, 07:00 to 11:00 and Late, 16:00 to 20:00')
  })

  it('keeps a normal day to one segment', () => {
    const day = resolveSchedule(hours(fixed), undefined, undefined, '2026-10-14')
    expect(day.working && day.segments).toHaveLength(1)
  })

  it('adds the paid minutes of both shifts and leaves the gap out', () => {
    expect(plannedMinutesOf(resolveSchedule(hours(fixed), undefined, split, '2026-10-14'))).toBe(480)
    expect(plannedMinutesOf(resolveSchedule(hours(fixed), undefined, undefined, '2026-10-14'))).toBeUndefined()
  })

  it('refuses shifts that overlap, touch, or share a start and an end time', () => {
    const first = { start: '07:00', end: '11:00' }
    expect(segmentsProblem([first, { start: '16:00', end: '20:00' }])).toBeUndefined()
    expect(segmentsProblem([first, { start: '10:00', end: '14:00' }])).toMatch(/Shift 2 has to start after shift 1 ends/)
    expect(segmentsProblem([first, { start: '11:00', end: '14:00' }])).toMatch(/Shift 2 has to start after shift 1 ends/)
    expect(segmentsProblem([first, { start: '16:00', end: '16:00' }])).toMatch(/different time than it starts/)
  })
})

describe('more shifts and overnight shifts', () => {
  const four = [{ start: '05:00', end: '06:00' }, { start: '07:00', end: '08:00' }, { start: '09:00', end: '10:00' }, { start: '11:00', end: '12:00' }]

  it('allows four shifts a day, not five', () => {
    expect(segmentsProblem(four)).toBeUndefined()
    expect(segmentsProblem([...four, { start: '13:00', end: '14:00' }])).toMatch(/at most 4 shifts/)
  })

  it('measures a shift past midnight as the time across it', () => {
    expect(spansMidnight('22:00', '06:00')).toBe(true)
    expect(spansMidnight('08:00', '17:00')).toBe(false)
    expect(shiftLength('22:00', '06:00')).toBe(480)
    expect(shiftMinutes({ start: '22:00', end: '06:00', flexible: false, breakMinutes: 30 })).toBe(450)
  })

  it('labels it with the next day and lets it be last only', () => {
    const day = resolveSchedule(hours(fixed), undefined, override({ kind: 'working', startTime: '22:00', endTime: '06:00' }), '2026-10-14')
    expect(scheduleLabel(day)).toBe('22:00 to 06:00 (+1)')
    expect(segmentsProblem([{ start: '22:00', end: '06:00' }, { start: '23:00', end: '23:30' }])).toMatch(/has to be the last of the day/)
    expect(segmentsProblem([{ start: '08:00', end: '12:00' }, { start: '22:00', end: '06:00' }])).toBeUndefined()
  })

  it('uses a person\'s several default shifts in time order', () => {
    const night: ShiftTemplate = { id: 'n', name: 'Night', start: '22:00', end: '06:00', breakMinutes: 0, tone: 'chart-3' }
    const day = resolveSchedule(hours(fixed), undefined, undefined, '2026-10-14', [night, morning])
    expect(day.working && day.segments.map(s => s.name)).toEqual(['Morning', 'Night'])
    expect(day).toMatchObject({ source: 'person' })
  })
})

const byId = (id: string) => ({ M: morning, N: { id: 'N', name: 'Night', start: '22:00', end: '06:00', breakMinutes: 0, tone: 'chart-3' as const }, E: { id: 'E', name: 'Early', start: '05:00', end: '13:00', breakMinutes: 0, tone: 'warning' as const } } as Record<string, ShiftTemplate>)[id === 'M' || id === 'N' || id === 'E' ? id : 'M']

describe('overnight shifts across two dates', () => {
  const night = resolveSchedule(hours(fixed), undefined, override({ kind: 'working', date: '2026-10-12', startTime: '22:00', endTime: '06:00' }), '2026-10-12')
  const early = resolveSchedule(hours(fixed), undefined, override({ kind: 'working', date: '2026-10-13', startTime: '05:00', endTime: '13:00' }), '2026-10-13')
  const late = resolveSchedule(hours(fixed), undefined, override({ kind: 'working', date: '2026-10-13', startTime: '12:00', endTime: '20:00' }), '2026-10-13')

  it('reports what a night shift still carries into the next morning', () => {
    expect(carryOverOf(night)).toEqual({ until: '06:00', name: undefined })
    expect(carryOverOf(late)).toBeUndefined()
    expect(carryOverOf(undefined)).toBeUndefined()
  })

  it('refuses a first shift that starts before the night shift has ended, and allows one after it', () => {
    expect(crossDayProblem(night, early, 'Mon', 'Tue')).toMatch(/Mon's overnight shift runs until 06:00, after Tue's first shift starts at 05:00/)
    expect(crossDayProblem(night, late, 'Mon', 'Tue')).toBeUndefined()
    expect(crossDayProblem(night, { working: false, reason: 'leave', source: 'override' }, 'Mon', 'Tue')).toBeUndefined()
  })
})

describe('rotations', () => {
  // Week 1 (from Monday 2026-10-12): Morning Monday to Friday. Week 2: Night Monday to Friday. Weekends off.
  const rotation: ScheduleRotation = {
    userId: 'u',
    startDate: '2026-10-12',
    weeks: [
      Object.fromEntries(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => [d, ['M']])),
      Object.fromEntries(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => [d, ['N']])),
    ],
  }

  it('picks the week of the cycle for a date, and repeats after the last week', () => {
    const names = (d: string) => { const r = rotationDayFor(rotation, d, byId); return r === 'off' || !r ? r : r.map(t => t.name) }
    expect(names('2026-10-14')).toEqual(['Morning'])
    expect(names('2026-10-21')).toEqual(['Night'])
    expect(names('2026-10-28')).toEqual(['Morning'])
    expect(names('2026-11-04')).toEqual(['Night'])
    expect(names('2026-10-17')).toBe('off')
  })

  it('does nothing before it starts', () => {
    expect(rotationDayFor(rotation, '2026-10-09', byId)).toBeUndefined()
    expect(rotationDayFor(undefined, '2026-10-14', byId)).toBeUndefined()
  })

  it('sits between a dated change and the weekly days', () => {
    const rd = rotationDayFor(rotation, '2026-10-14', byId)
    expect(resolveSchedule(hours(fixed), undefined, undefined, '2026-10-14', undefined, rd)).toMatchObject({ working: true, source: 'rotation', shift: { name: 'Morning' } })
    expect(resolveSchedule(hours(fixed), undefined, override({ kind: 'day_off' }), '2026-10-14', undefined, rd)).toMatchObject({ working: false, source: 'override' })
    expect(resolveSchedule(hours(fixed), undefined, undefined, '2026-10-17', undefined, rotationDayFor(rotation, '2026-10-17', byId))).toMatchObject({ working: false, reason: 'weekly', source: 'rotation' })
  })

  it('refuses a cycle where a night shift runs into the next day\'s early shift, including the wrap to week 1', () => {
    expect(rotationProblem(rotation, byId)).toBeUndefined()
    const clash: ScheduleRotation = { ...rotation, weeks: [{ Mon: ['E'] }, { Sun: ['N'] }] }
    // Week 2's Sunday night runs into week 1's Monday early shift as the cycle repeats.
    expect(rotationProblem(clash, byId)).toMatch(/Sunday's overnight shift runs until 06:00, after Monday's first shift starts at 05:00/)
    expect(rotationProblem({ ...rotation, weeks: [] }, byId)).toMatch(/1 to 8 weeks/)
    expect(rotationProblem({ ...rotation, weeks: Array.from({ length: 9 }, () => ({})) }, byId)).toMatch(/1 to 8 weeks/)
  })
})

describe('workingHoursProblem', () => {
  it('needs a working day, and different start and end times for fixed hours', () => {
    expect(workingHoursProblem(hours(fixed))).toBeUndefined()
    expect(workingHoursProblem({ scheduleType: 'flexible', days: [] })).toMatch(/at least one working day/)
    expect(workingHoursProblem({ scheduleType: 'fixed', startTime: '10:00', endTime: '10:00', days: ['Mon'] })).toMatch(/different times/)
    expect(workingHoursProblem({ scheduleType: 'fixed', days: ['Mon'] })).toMatch(/start and an end/)
    // An end before the start is an overnight shift, not a mistake.
    expect(workingHoursProblem({ scheduleType: 'fixed', startTime: '22:00', endTime: '06:00', days: ['Mon'] })).toBeUndefined()
    expect(workingHoursProblem({ scheduleType: 'flexible', days: ['Mon'] })).toBeUndefined()
  })
})

describe('role shifts', () => {
  const office: ShiftTemplate = { id: 'o', name: 'Office', start: '10:00', end: '18:00', breakMinutes: 0, tone: 'chart-1' }
  const find = (id: string) => ({ o: office, m: morning } as Record<string, ShiftTemplate>)[id]

  it('uses the role\'s shifts as its hours, in time order, and keeps the plain times as a fallback', () => {
    const role = { scheduleType: 'fixed' as const, startTime: '09:00', endTime: '17:00', days: ['Mon' as const] }
    expect(resolveSchedule(role, undefined, undefined, '2026-10-12', undefined, undefined, [office, morning])).toMatchObject({ working: true, source: 'role', shift: { name: 'Morning' }, segments: [{ name: 'Morning' }, { name: 'Office' }] })
    expect(resolveSchedule(role, undefined, undefined, '2026-10-12')).toMatchObject({ shift: { start: '09:00', end: '17:00' } })
    // A working override with no hours keeps the role's shifts.
    const day = resolveSchedule(role, undefined, override({ kind: 'working', date: '2026-10-12' }), '2026-10-12', undefined, undefined, [office])
    expect(day).toMatchObject({ source: 'override', shift: { name: 'Office' } })
  })

  it('checks a fixed role\'s shifts: none missing, none overlapping', () => {
    const hoursWith = (shiftIds: string[]) => ({ scheduleType: 'fixed' as const, shiftIds, days: ['Mon' as const] })
    expect(workingHoursProblem(hoursWith(['o']), find)).toBeUndefined()
    expect(workingHoursProblem(hoursWith(['o', 'gone']), find)).toMatch(/was deleted/)
    // Morning (07:00 to 15:00) and Office (10:00 to 18:00) overlap.
    expect(workingHoursProblem(hoursWith(['m', 'o']), find)).toMatch(/Shift 2 has to start after shift 1 ends/)
    expect(workingHoursProblem(hoursWith(['o', 'o2']), id => id === 'o2' ? { ...office, id: 'o2', start: '19:00', end: '22:00' } : find(id))).toBeUndefined()
  })

  it('works out the plain times from shifts, and the shift for a role that only has times', () => {
    expect(hoursFromShifts([office, morning])).toEqual({ startTime: '07:00', endTime: '18:00' })
    expect(hoursFromShifts([])).toBeUndefined()
    const plain = { scheduleType: 'fixed' as const, startTime: '10:00', endTime: '18:00', days: ['Mon' as const] }
    expect(shiftForRoleHours(plain, [morning, office])).toEqual({ id: 'o' })
    expect(shiftForRoleHours({ ...plain, startTime: '06:30', endTime: '14:30' }, [office])).toMatchObject({ create: { name: '06:30 to 14:30', start: '06:30', end: '14:30', breakMinutes: 0 } })
    expect(shiftForRoleHours({ ...plain, shiftIds: ['o'] }, [office])).toBeUndefined()
    expect(shiftForRoleHours({ scheduleType: 'flexible', days: ['Mon'] }, [office])).toBeUndefined()
  })
})

describe('which shift can be added to a role', () => {
  it('only offers shifts that fit after the ones it already has (Back Office works Day 08:00 to 17:00)', () => {
    const byId = (id: string) => SEED_SHIFTS.find(t => t.id === id)
    const backOffice = { scheduleType: 'fixed' as const, shiftIds: ['shift-day'], days: ['Mon' as const, 'Tue' as const, 'Wed' as const, 'Thu' as const, 'Fri' as const] }
    const fits = SEED_SHIFTS.filter(t => t.id !== 'shift-day' && !workingHoursProblem({ ...backOffice, shiftIds: [...backOffice.shiftIds, t.id] }, byId))
    // Morning, Office and Afternoon all overlap the day shift; only the night shift starts after it ends.
    expect(fits.map(t => t.name)).toEqual(['Night'])
  })
})
