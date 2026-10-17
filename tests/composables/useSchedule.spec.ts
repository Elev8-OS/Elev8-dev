import { beforeEach, describe, expect, it } from 'vitest'
import { SCHEDULE_STORAGE_KEY, shiftProblem, useSchedule } from '~/composables/useSchedule'

beforeEach(() => localStorage.clear())

describe('useSchedule', () => {
  it('reads the role: a fixed role is off on its weekly days off, a seeded flexible person is off on Sunday', () => {
    const { scheduleFor, isWorkDay, overrides } = useSchedule()
    // The demo overrides are relative to today, so clear them to test the plain role and weekly days.
    overrides.value = []
    // user-8 is a pool person on a fixed role: Monday to Friday, 10:00 to 18:00.
    expect(scheduleFor('user-8', '2026-10-14')).toMatchObject({ working: true, shift: { start: '10:00', end: '18:00' } })
    expect(isWorkDay('user-8', '2026-10-17')).toBe(false)
    // user-2 is a flexible Listing Manager with seeded Monday to Saturday.
    expect(isWorkDay('user-2', '2026-10-17')).toBe(true)
    expect(isWorkDay('user-2', '2026-10-18')).toBe(false)
  })

  it('sets and clears a day off, several dates at once, and saves the change', () => {
    const { isWorkDay, setDayOff, clearOverride, scheduleFor } = useSchedule()
    setDayOff('user-8', ['2026-10-14', '2026-10-15'], { type: 'leave', note: '  Trip  ' })
    expect(isWorkDay('user-8', '2026-10-14')).toBe(false)
    expect(scheduleFor('user-8', '2026-10-15')).toMatchObject({ reason: 'leave', note: 'Trip' })
    expect(JSON.parse(localStorage.getItem(SCHEDULE_STORAGE_KEY)!).overrides.some((o: { date: string }) => o.date === '2026-10-14')).toBe(true)
    clearOverride('user-8', ['2026-10-14'])
    expect(isWorkDay('user-8', '2026-10-14')).toBe(true)
    expect(isWorkDay('user-8', '2026-10-15')).toBe(false)
  })

  it('replaces an earlier override for the same day instead of stacking', () => {
    const { overrides, setDayOff, setWorking, scheduleFor } = useSchedule()
    setDayOff('user-8', ['2026-10-17'], { type: 'other' })
    setWorking('user-8', ['2026-10-17'], { startTime: '07:00', endTime: '15:00' })
    expect(overrides.value.filter(o => o.userId === 'user-8' && o.date === '2026-10-17')).toHaveLength(1)
    expect(scheduleFor('user-8', '2026-10-17')).toMatchObject({ working: true, shift: { start: '07:00' } })
  })

  it('ignores half a custom hour range', () => {
    const { setWorking, scheduleFor } = useSchedule()
    setWorking('user-8', ['2026-10-17'], { startTime: '07:00' })
    expect(scheduleFor('user-8', '2026-10-17')).toMatchObject({ working: true, shift: { start: '10:00', end: '18:00' } })
  })

  it('gives a person their own weekly days, and drops them with null', () => {
    const { setPersonDays, isWorkDay, weekDaysFor } = useSchedule()
    setPersonDays('user-8', ['Sat', 'Mon'])
    expect(weekDaysFor('user-8')).toEqual(['Mon', 'Sat'])
    expect(isWorkDay('user-8', '2026-10-17')).toBe(true)
    setPersonDays('user-8', null)
    expect(isWorkDay('user-8', '2026-10-17')).toBe(false)
  })

  it('counts working days for a person up to today, days off excluded', () => {
    const { workDaysFor, setDayOff } = useSchedule()
    const range = { from: '2026-10-12', to: '2026-10-18' }
    expect(workDaysFor('user-8', range, '2026-10-18')).toBe(5)
    setDayOff('user-8', ['2026-10-13'], { type: 'sick' })
    expect(workDaysFor('user-8', range, '2026-10-18')).toBe(4)
    expect(workDaysFor('user-8', range, '2026-10-14')).toBe(2)
  })
})

describe('shifts', () => {
  const base = { name: 'Late', start: '14:00', end: '22:00', breakMinutes: 30, tone: 'chart-3' as const }

  it('starts with the demo shifts and adds, edits and deletes one', () => {
    const { shifts, addShift, updateShift, removeShift } = useSchedule()
    expect(shifts.value.map(t => t.name)).toEqual(['Morning', 'Day', 'Afternoon', 'Office', 'Night'])
    const created = addShift(base)
    expect(typeof created).toBe('object')
    const id = (created as { id: string }).id
    expect(updateShift(id, { ...base, name: 'Late shift' })).toBeUndefined()
    expect(shifts.value.find(t => t.id === id)?.name).toBe('Late shift')
    removeShift(id)
    expect(shifts.value.some(t => t.id === id)).toBe(false)
  })

  it('refuses a shift with no name, a duplicate name, the same start and end, or a break as long as the shift', () => {
    const { shifts } = useSchedule()
    expect(shiftProblem({ ...base, name: '  ' }, shifts.value)).toBeTruthy()
    expect(shiftProblem({ ...base, name: 'morning' }, shifts.value)).toMatch(/already exists/)
    expect(shiftProblem({ ...base, start: '14:00', end: '14:00' }, shifts.value)).toMatch(/different time than it starts/)
    // 15:00 to 14:00 runs past midnight: 23 hours, so it is fine; the break still has to fit.
    expect(shiftProblem({ ...base, start: '15:00', end: '14:00' }, shifts.value)).toBeUndefined()
    expect(shiftProblem({ ...base, start: '14:00', end: '14:30', breakMinutes: 30 }, shifts.value)).toMatch(/break/)
    expect(shiftProblem({ ...base, name: 'Morning' }, shifts.value, 'shift-morning')).toBeUndefined()
  })

  it('gives a person a default shift, and drops it when the shift is deleted', () => {
    const { setPersonShifts, scheduleFor, removeShift, personShifts } = useSchedule()
    expect(setPersonShifts('user-8', ['shift-morning'])).toBeUndefined()
    expect(scheduleFor('user-8', '2026-10-14')).toMatchObject({ working: true, shift: { name: 'Morning', start: '07:00' } })
    removeShift('shift-morning')
    expect(personShifts.value['user-8']).toBeUndefined()
    expect(scheduleFor('user-8', '2026-10-14')).toMatchObject({ shift: { start: '10:00', end: '18:00' } })
  })

  it('freezes a shift set on a date: editing or deleting the template never changes it', () => {
    const { setWorking, updateShift, removeShift, scheduleFor, shiftUsage } = useSchedule()
    setWorking('user-8', ['2026-10-14'], { shiftId: 'shift-afternoon' })
    expect(shiftUsage('shift-afternoon').days).toBeGreaterThan(0)
    updateShift('shift-afternoon', { name: 'Afternoon', start: '13:00', end: '21:00', breakMinutes: 30, tone: 'chart-5' })
    removeShift('shift-afternoon')
    expect(scheduleFor('user-8', '2026-10-14')).toMatchObject({ working: true, shift: { name: 'Afternoon', start: '12:00', end: '20:00' } })
  })

  it('plans paid minutes for a named shift, and none for a day off', () => {
    const { plannedMinutes, setWorking } = useSchedule()
    // The role's own shift (Office, 10:00 to 18:00, no break) is named too: 8 hours.
    expect(plannedMinutes('user-8', '2026-10-14')).toBe(480)
    setWorking('user-8', ['2026-10-14'], { shiftId: 'shift-morning' })
    expect(plannedMinutes('user-8', '2026-10-14')).toBe(450)
  })

  it('copies one week of changes onto another, replacing what was there', () => {
    const { setDayOff, setWorking, copyWeek, scheduleFor, overrides } = useSchedule()
    setDayOff('user-8', ['2026-10-13'], { type: 'leave' })
    setWorking('user-8', ['2026-10-17'], { shiftId: 'shift-morning' })
    setDayOff('user-8', ['2026-10-21'], { type: 'sick' }) // already in the target week
    expect(copyWeek(['user-8'], '2026-10-12', '2026-10-19')).toEqual({ count: 2 })
    expect(scheduleFor('user-8', '2026-10-20')).toMatchObject({ working: false, reason: 'leave' })
    expect(scheduleFor('user-8', '2026-10-24')).toMatchObject({ working: true, shift: { name: 'Morning' } })
    expect(scheduleFor('user-8', '2026-10-21')).toMatchObject({ working: true })
    expect(overrides.value.filter(o => o.userId === 'user-8' && o.date >= '2026-10-19' && o.date <= '2026-10-25')).toHaveLength(2)
  })

  it('reads a version 1 saved copy, keeping its overrides and adding the demo shifts', () => {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify({ v: 1, personDays: { 'user-8': ['Mon'] }, overrides: [] }))
    const { weekDaysFor, shifts } = useSchedule()
    expect(weekDaysFor('user-8')).toEqual(['Mon'])
    expect(shifts.value).toHaveLength(5)
  })
})

describe('split shifts', () => {
  it('sets two shifts on a day, with the second a snapshot of its template', () => {
    const { setWorking, scheduleFor, updateShift, plannedMinutes } = useSchedule()
    expect(setWorking('user-8', ['2026-10-14'], { startTime: '07:00', endTime: '11:00', extra: [{ shiftId: 'shift-afternoon' }] })).toBeUndefined()
    updateShift('shift-afternoon', { name: 'Afternoon', start: '14:00', end: '22:00', breakMinutes: 0, tone: 'chart-5' })
    const day = scheduleFor('user-8', '2026-10-14')
    expect(day.working && day.segments.map(s => s.start)).toEqual(['07:00', '12:00'])
    expect(plannedMinutes('user-8', '2026-10-14')).toBe(240 + 450)
  })

  it('refuses an overlapping second shift, or one with no hours on the first, and saves nothing', () => {
    const { setWorking, overrideFor } = useSchedule()
    expect(setWorking('user-8', ['2026-10-14'], { startTime: '07:00', endTime: '15:00', extra: [{ startTime: '12:00', endTime: '20:00' }] })).toMatch(/Shift 2 has to start after shift 1 ends/)
    expect(setWorking('user-8', ['2026-10-14'], { extra: [{ startTime: '16:00', endTime: '20:00' }] })).toMatch(/first shift/)
    expect(overrideFor('user-8', '2026-10-14')).toBeUndefined()
  })

  it('counts a second shift as a use of its template', () => {
    const { setWorking, shiftUsage } = useSchedule()
    const before = shiftUsage('shift-afternoon').days
    setWorking('user-8', ['2026-10-14'], { startTime: '07:00', endTime: '11:00', extra: [{ shiftId: 'shift-afternoon' }] })
    expect(shiftUsage('shift-afternoon').days).toBe(before + 1)
  })
})

describe('more than two shifts, overnight shifts and split default shifts', () => {
  it('takes up to four shifts a day and refuses a fifth', () => {
    const { setWorking, scheduleFor } = useSchedule()
    const three = [{ startTime: '09:00', endTime: '11:00' }, { startTime: '12:00', endTime: '14:00' }, { startTime: '15:00', endTime: '17:00' }]
    expect(setWorking('user-8', ['2026-10-14'], { startTime: '06:00', endTime: '08:00', extra: three })).toBeUndefined()
    const day = scheduleFor('user-8', '2026-10-14')
    expect(day.working && day.segments).toHaveLength(4)
    expect(setWorking('user-8', ['2026-10-15'], { startTime: '05:00', endTime: '06:00', extra: [{ startTime: '07:00', endTime: '08:00' }, ...three] })).toMatch(/at most 4 shifts/)
  })

  it('accepts an overnight shift and only as the last shift of the day', () => {
    const { setWorking, addShift, plannedMinutes } = useSchedule()
    expect(addShift({ name: 'Late night', start: '23:00', end: '03:00', breakMinutes: 30, tone: 'chart-3' })).toMatchObject({ start: '23:00', end: '03:00' })
    expect(setWorking('user-8', ['2026-10-14'], { shiftId: 'shift-night' })).toBeUndefined()
    expect(plannedMinutes('user-8', '2026-10-14')).toBe(450)
    expect(setWorking('user-8', ['2026-10-15'], { shiftId: 'shift-night', extra: [{ startTime: '23:00', endTime: '23:30' }] })).toMatch(/has to be the last of the day/)
    expect(setWorking('user-8', ['2026-10-16'], { startTime: '08:00', endTime: '12:00', extra: [{ shiftId: 'shift-night' }] })).toBeUndefined()
  })

  it('gives a person several default shifts, ordered by start, and refuses overlapping ones', () => {
    const { setPersonShifts, scheduleFor, personShifts } = useSchedule()
    expect(setPersonShifts('user-8', ['shift-afternoon', 'shift-morning'])).toMatch(/Shift 2 has to start after shift 1 ends/)
    expect(personShifts.value['user-8']).toBeUndefined()
    expect(setPersonShifts('user-8', ['shift-night', 'shift-morning'])).toBeUndefined()
    expect(personShifts.value['user-8']).toEqual(['shift-morning', 'shift-night'])
    const day = scheduleFor('user-8', '2026-10-14')
    expect(day.working && day.segments.map(s => s.name)).toEqual(['Morning', 'Night'])
    expect(setPersonShifts('user-8', [])).toBeUndefined()
    expect(personShifts.value['user-8']).toBeUndefined()
  })

  it('drops a deleted shift from a person with several', () => {
    const { setPersonShifts, removeShift, personShifts } = useSchedule()
    setPersonShifts('user-8', ['shift-night', 'shift-morning'])
    removeShift('shift-night')
    expect(personShifts.value['user-8']).toEqual(['shift-morning'])
    removeShift('shift-morning')
    expect(personShifts.value['user-8']).toBeUndefined()
  })

  it('reads a version 2 copy: one default shift becomes a list, a second shift becomes extra', () => {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify({
      v: 2,
      personDays: {},
      personShifts: { 'user-8': 'shift-day' },
      shifts: [{ id: 'shift-day', name: 'Day', start: '08:00', end: '17:00', breakMinutes: 60, tone: 'primary' }],
      overrides: [{ id: 'o', userId: 'user-8', date: '2026-10-14', kind: 'working', startTime: '07:00', endTime: '11:00', second: { startTime: '16:00', endTime: '20:00' }, createdAt: '', createdBy: '' }],
    }))
    const { personShifts, overrides, scheduleFor } = useSchedule()
    expect(personShifts.value['user-8']).toEqual(['shift-day'])
    expect(overrides.value[0]).toMatchObject({ extra: [{ startTime: '16:00', endTime: '20:00' }] })
    expect(overrides.value[0]).not.toHaveProperty('second')
    const day = scheduleFor('user-8', '2026-10-14')
    expect(day.working && day.segments).toHaveLength(2)
  })
})

describe('rotations and overnight clashes', () => {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
  const week = (id: string) => Object.fromEntries(weekdays.map(d => [d, [id]]))

  it('runs a rotation from its start date, and a dated change still wins', () => {
    const { setRotation, scheduleFor, setDayOff, overrides } = useSchedule()
    overrides.value = []
    expect(setRotation('user-8', '2026-10-14', [week('shift-morning'), week('shift-afternoon')])).toBeUndefined()
    // The start date snaps to its Monday.
    expect(scheduleFor('user-8', '2026-10-13')).toMatchObject({ working: true, source: 'rotation', shift: { name: 'Morning' } })
    expect(scheduleFor('user-8', '2026-10-20')).toMatchObject({ shift: { name: 'Afternoon' } })
    expect(scheduleFor('user-8', '2026-10-27')).toMatchObject({ shift: { name: 'Morning' } })
    expect(scheduleFor('user-8', '2026-10-17')).toMatchObject({ working: false, source: 'rotation' })
    // Before it starts the weekly days apply (user-8's role: 10:00 to 18:00).
    expect(scheduleFor('user-8', '2026-10-09')).toMatchObject({ source: 'role', shift: { start: '10:00' } })
    setDayOff('user-8', ['2026-10-14'], { type: 'sick' })
    expect(scheduleFor('user-8', '2026-10-14')).toMatchObject({ working: false, reason: 'sick', source: 'override' })
  })

  it('stops a rotation, and a deleted shift becomes a day off in it', () => {
    const { setRotation, removeRotation, removeShift, scheduleFor, rotations, shiftUsage } = useSchedule()
    setRotation('user-8', '2026-10-12', [week('shift-morning')])
    expect(shiftUsage('shift-morning').rotations).toBe(1)
    removeShift('shift-morning')
    expect(rotations.value['user-8']!.weeks[0]!.Mon).toBe('off')
    expect(scheduleFor('user-8', '2026-10-14')).toMatchObject({ working: false })
    removeRotation('user-8')
    expect(rotations.value['user-8']).toBeUndefined()
    expect(scheduleFor('user-8', '2026-10-14')).toMatchObject({ working: true, source: 'role' })
  })

  it('refuses a rotation with a clash and does not save it', () => {
    const { setRotation, rotations, addShift } = useSchedule()
    const early = addShift({ name: 'Early', start: '05:00', end: '13:00', breakMinutes: 0, tone: 'warning' }) as { id: string }
    expect(setRotation('user-8', '2026-10-12', [{ Mon: [early.id], Sun: ['shift-night'] }])).toMatch(/overnight shift runs until 06:00/)
    expect(rotations.value['user-8']).toBeUndefined()
  })

  it('refuses a date change that clashes with the neighbouring day and puts everything back', () => {
    const { setWorking, scheduleFor, overrides } = useSchedule()
    overrides.value = []
    expect(setWorking('user-8', ['2026-10-12'], { shiftId: 'shift-night' })).toBeUndefined()
    // Tuesday's first shift at 05:00 starts before Monday's night shift ends at 06:00.
    expect(setWorking('user-8', ['2026-10-13'], { startTime: '05:00', endTime: '13:00' })).toMatch(/Mon 12 Oct's overnight shift runs until 06:00, after Tue 13 Oct's first shift starts at 05:00/)
    expect(scheduleFor('user-8', '2026-10-13')).toMatchObject({ source: 'role', shift: { start: '10:00' } })
    // Starting at 12:00 is fine, and the cell carries over.
    expect(setWorking('user-8', ['2026-10-13'], { startTime: '12:00', endTime: '20:00' })).toBeUndefined()
  })

  it('reports what an overnight shift carries into the next morning', () => {
    const { setWorking, carryOverFor, overrides } = useSchedule()
    overrides.value = []
    setWorking('user-8', ['2026-10-12'], { shiftId: 'shift-night' })
    expect(carryOverFor('user-8', '2026-10-13')).toMatchObject({ until: '06:00', name: 'Night' })
    expect(carryOverFor('user-8', '2026-10-12')).toBeUndefined()
  })

  it('refuses copying a week that would leave a clash, and changes nothing', () => {
    const { setWorking, copyWeek, overrides } = useSchedule()
    overrides.value = []
    // Last week's Sunday night runs into the copied week's Monday early shift.
    setWorking('user-8', ['2026-10-11'], { shiftId: 'shift-night' })
    setWorking('user-8', ['2026-10-05'], { startTime: '05:00', endTime: '13:00' })
    const before = overrides.value
    const result = copyWeek(['user-8'], '2026-10-05', '2026-10-12')
    expect(result.problem).toMatch(/overnight shift runs until 06:00/)
    expect(overrides.value).toEqual(before)
  })

  it('reads a version 3 copy: no rotations yet', () => {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify({ v: 3, personDays: {}, personShifts: { 'user-8': ['shift-day'] }, shifts: [{ id: 'shift-day', name: 'Day', start: '08:00', end: '17:00', breakMinutes: 60, tone: 'primary' }], overrides: [] }))
    const { rotations, personShifts } = useSchedule()
    expect(rotations.value).toEqual({})
    expect(personShifts.value['user-8']).toEqual(['shift-day'])
  })
})

describe('roles pick shifts', () => {
  it('takes a fixed role\'s hours from its shifts, even when the plain times disagree', async () => {
    const { useRoles } = await import('~/composables/useRoles')
    const { scheduleFor } = useSchedule()
    const { updateRole, getRole } = useRoles()
    // The pool role works the Office shift (10:00 to 18:00).
    expect(scheduleFor('user-8', '2026-10-14')).toMatchObject({ working: true, source: 'role', shift: { name: 'Office', start: '10:00', end: '18:00' } })
    updateRole('role-pool', { workingHours: { ...getRole('role-pool')!.workingHours, shiftIds: ['shift-morning'] } })
    expect(scheduleFor('user-8', '2026-10-14')).toMatchObject({ shift: { name: 'Morning', start: '07:00' } })
    updateRole('role-pool', { workingHours: { ...getRole('role-pool')!.workingHours, shiftIds: ['shift-day', 'shift-night'] } })
    const day = scheduleFor('user-8', '2026-10-14')
    expect(day.working && day.segments.map(s => s.name)).toEqual(['Day', 'Night'])
  })

  it('keeps the plain times when a role\'s shift is gone, and cleans the role when a shift is deleted', async () => {
    const { useRoles } = await import('~/composables/useRoles')
    const { scheduleFor, removeShift, shiftUsage } = useSchedule()
    const { getRole } = useRoles()
    expect(shiftUsage('shift-office').roles).toBeGreaterThan(1)
    removeShift('shift-office')
    expect(getRole('role-pool')!.workingHours.shiftIds).toBeUndefined()
    expect(scheduleFor('user-8', '2026-10-14')).toMatchObject({ working: true, shift: { start: '10:00', end: '18:00' } })
    expect(scheduleFor('user-8', '2026-10-14')).not.toMatchObject({ shift: { name: 'Office' } })
  })

  it('converts a saved role that only has plain times: the shift with the same hours, or a new one', async () => {
    const { useRoles } = await import('~/composables/useRoles')
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify({ v: 4, personDays: {}, personShifts: {}, rotations: {}, overrides: [], shifts: [
      { id: 'shift-office', name: 'Office', start: '10:00', end: '18:00', breakMinutes: 0, tone: 'chart-1' },
    ] }))
    const { roles, updateRole } = useRoles()
    updateRole('role-pool', { workingHours: { scheduleType: 'fixed', startTime: '10:00', endTime: '18:00', days: ['Mon', 'Tue'] } })
    updateRole('role-gardener', { workingHours: { scheduleType: 'fixed', startTime: '06:30', endTime: '14:30', days: ['Mon'] } })
    const { shifts } = useSchedule()
    // useSchedule ran before the edits above, so run the conversion the way a reload does.
    useState('schedule-restored').value = false
    const again = useSchedule()
    expect(roles.value.find(r => r.id === 'role-pool')!.workingHours.shiftIds).toEqual(['shift-office'])
    const gardener = roles.value.find(r => r.id === 'role-gardener')!.workingHours
    expect(gardener.shiftIds).toHaveLength(1)
    expect(again.shifts.value.find(t => t.id === gardener.shiftIds![0])).toMatchObject({ name: '06:30 to 14:30', start: '06:30', end: '14:30' })
    expect(shifts.value.length).toBeGreaterThanOrEqual(2)
  })
})

describe('setRoleHours', () => {
  it('saves a role\'s days and shifts sorted by start, with the plain times following them', async () => {
    const { useRoles } = await import('~/composables/useRoles')
    const { setRoleHours, scheduleFor } = useSchedule()
    const { getRole } = useRoles()
    const base = getRole('role-pool')!.workingHours
    expect(setRoleHours('role-pool', { ...base, days: ['Mon', 'Tue'], shiftIds: ['shift-night', 'shift-morning'] })).toBeUndefined()
    const saved = getRole('role-pool')!.workingHours
    expect(saved).toMatchObject({ days: ['Mon', 'Tue'], shiftIds: ['shift-morning', 'shift-night'], startTime: '07:00', endTime: '06:00' })
    expect(scheduleFor('user-8', '2026-10-14')).toMatchObject({ working: false })
    expect(scheduleFor('user-8', '2026-10-13')).toMatchObject({ working: true, shift: { name: 'Morning' } })
  })

  it('drops the shifts when a role becomes flexible', async () => {
    const { useRoles } = await import('~/composables/useRoles')
    const { setRoleHours } = useSchedule()
    const { getRole } = useRoles()
    expect(setRoleHours('role-pool', { ...getRole('role-pool')!.workingHours, scheduleType: 'flexible' })).toBeUndefined()
    expect(getRole('role-pool')!.workingHours.shiftIds).toBeUndefined()
  })

  it('refuses no days, overlapping shifts, a missing shift and a night shift that runs into the next day, and changes nothing', async () => {
    const { useRoles } = await import('~/composables/useRoles')
    const { setRoleHours, addShift } = useSchedule()
    const { getRole } = useRoles()
    const before = JSON.stringify(getRole('role-pool')!.workingHours)
    const base = getRole('role-pool')!.workingHours
    expect(setRoleHours('role-pool', { ...base, days: [] })).toMatch(/at least one working day/)
    expect(setRoleHours('role-pool', { ...base, shiftIds: ['shift-morning', 'shift-office'] })).toMatch(/Shift 2 has to start after shift 1 ends/)
    expect(setRoleHours('role-pool', { ...base, shiftIds: ['shift-gone'] })).toMatch(/was deleted/)
    const early = addShift({ name: 'Early', start: '05:00', end: '09:00', breakMinutes: 0, tone: 'warning' }) as { id: string }
    // Early 05:00 to 09:00 and Night 22:00 to 06:00 every working day: Monday's night runs into Tuesday's early.
    expect(setRoleHours('role-pool', { ...base, shiftIds: [early.id, 'shift-night'] })).toMatch(/overnight shift runs until 06:00/)
    expect(JSON.stringify(getRole('role-pool')!.workingHours)).toBe(before)
    // The same shifts are fine when the next day is not a working day (Friday only).
    expect(setRoleHours('role-pool', { ...base, days: ['Fri'], shiftIds: [early.id, 'shift-night'] })).toBeUndefined()
  })
})

describe('roles pointing at a missing shift', () => {
  it('brings a missing demo shift back instead of leaving the role with a blank shift', async () => {
    const { useRoles } = await import('~/composables/useRoles')
    // A shift list saved before the Office shift existed.
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify({ v: 4, personDays: {}, personShifts: {}, rotations: {}, overrides: [], shifts: [
      { id: 'shift-morning', name: 'Morning', start: '07:00', end: '15:00', breakMinutes: 30, tone: 'warning' },
    ] }))
    const { shifts, scheduleFor } = useSchedule()
    const { getRole } = useRoles()
    expect(getRole('role-pool')!.workingHours.shiftIds).toEqual(['shift-office'])
    expect(shifts.value.some(t => t.id === 'shift-office' && t.name === 'Office')).toBe(true)
    expect(scheduleFor('user-8', '2026-10-14')).toMatchObject({ shift: { name: 'Office', start: '10:00' } })
  })

  it('drops a shift id nobody knows and converts the role from its plain times', async () => {
    const { useRoles } = await import('~/composables/useRoles')
    const { updateRole, getRole } = useRoles()
    updateRole('role-gardener', { workingHours: { scheduleType: 'fixed', shiftIds: ['shift-lost'], startTime: '10:00', endTime: '18:00', days: ['Mon'] } })
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify({ v: 4, personDays: {}, personShifts: {}, rotations: {}, overrides: [], shifts: [
      { id: 'shift-office', name: 'Office', start: '10:00', end: '18:00', breakMinutes: 0, tone: 'chart-1' },
    ] }))
    const { shifts } = useSchedule()
    expect(getRole('role-gardener')!.workingHours.shiftIds).toEqual(['shift-office'])
    expect(shifts.value.every(t => t.id !== 'shift-lost')).toBe(true)
  })
})
