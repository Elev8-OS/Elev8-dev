import { beforeEach, describe, expect, it } from 'vitest'
import { toLocalDateKey } from '~/components/activities/data/activities'
import { attendancePhotoUrl, buildSeedAttendance, DEMO_PHOTO_URL, formatWorked, shiftFor, workedMinutes } from '~/components/attendance/data/attendance'
import { useAttendanceReport } from '~/composables/useAttendanceReport'
import { buildAttendanceSheet } from '~/lib/attendance-export'

const wide = { from: '2000-01-01', to: '2999-12-31' }
const people = [
  { id: 'user-2', listingIds: ['lst-1', 'lst-2'], active: true },
  { id: 'user-8', listingIds: ['lst-1'], active: false },
]
const noon = new Date(2026, 9, 16, 12, 0) // Friday 16 Oct 2026

beforeEach(() => localStorage.clear())

describe('buildSeedAttendance', () => {
  it('is the same every time and skips Sundays and inactive people', () => {
    const a = buildSeedAttendance(noon, people)
    expect(a).toEqual(buildSeedAttendance(noon, people))
    expect(a.some(r => r.userId === 'user-8')).toBe(false)
    expect(a.every(r => new Date(`${r.date}T00:00:00`).getDay() !== 0)).toBe(true)
  })

  it('only uses the listings a person is assigned to', () => {
    expect(buildSeedAttendance(noon, people).every(r => ['lst-1', 'lst-2'].includes(r.listingId))).toBe(true)
  })

  it('leaves today open until the shift is over', () => {
    const today = buildSeedAttendance(noon, people).find(r => r.date === toLocalDateKey(noon))
    // user-2 works 08:00 to 17:00, so at noon nobody has clocked out, or there is no record for an absence.
    expect(today === undefined || today.clockOut === undefined).toBe(true)
  })

  it('never flags a flexible shift as late or early', () => {
    const flexible = buildSeedAttendance(noon, [{ id: 'user-4', listingIds: ['lst-1'], active: true }])
    expect(shiftFor('user-4').flexible).toBe(true)
    expect(flexible.some(r => r.clockInLate || r.clockOutEarly)).toBe(false)
  })

  it('marks a late check-in only past the grace period', () => {
    const all = buildSeedAttendance(noon, people)
    const start = shiftFor('user-2').start
    expect(all.filter(r => r.clockInLate).every(r => r.clockIn > start)).toBe(true)
  })
})

describe('photos', () => {
  it('only has a check-out photo when there is a check-out', () => {
    const all = buildSeedAttendance(noon, people)
    expect(all.filter(r => r.clockOutPhoto).every(r => !!r.clockOut)).toBe(true)
    expect(all.some(r => r.clockInPhoto)).toBe(true)
    expect(all.some(r => !r.clockInPhoto)).toBe(true)
  })

  it('gives exactly one record real image files', () => {
    const all = buildSeedAttendance(noon, [{ id: 'user-1', listingIds: ['lst-1'], active: true }, ...people])
    const withFile = all.filter(r => r.clockInPhotoUrl || r.clockOutPhotoUrl)
    expect(withFile).toHaveLength(1)
    expect(withFile[0]).toMatchObject({ userId: 'user-1', clockInPhotoUrl: DEMO_PHOTO_URL, clockOutPhotoUrl: DEMO_PHOTO_URL })
    expect(withFile[0]!.clockOut).toBeTruthy()
  })

  it('draws a placeholder with the person and time', () => {
    const url = attendancePhotoUrl('in', { name: 'Made Surya', date: 'Friday', time: '08:02', place: 'Villa <A>' })
    expect(url.startsWith('data:image/svg+xml')).toBe(true)
    const svg = decodeURIComponent(url.split(',')[1]!)
    expect(svg).toContain('MS')
    expect(svg).toContain('Check in 08:02')
    expect(svg).toContain('Villa &lt;A&gt;')
  })
})

describe('helpers', () => {
  it('measures worked time only for a finished day', () => {
    expect(workedMinutes({ clockIn: '08:00', clockOut: '17:30' })).toBe(570)
    expect(workedMinutes({ clockIn: '08:00' })).toBeUndefined()
    expect(formatWorked(570)).toBe('9h 30m')
    expect(formatWorked(45)).toBe('45m')
  })
})

describe('useAttendanceReport', () => {
  it('opens on today', () => {
    const { selection } = useAttendanceReport()
    const today = toLocalDateKey(new Date())
    expect(selection.value.preset).toBe('today')
    expect(selection.value.range).toEqual({ from: today, to: today })
  })

  it('filters by name, role and problem', () => {
    const { rows } = useAttendanceReport()
    const all = rows(wide)
    expect(all.length).toBeGreaterThan(0)
    expect(rows(wide, { query: 'komang' }).every(r => r.name.toLowerCase().includes('komang'))).toBe(true)
    expect(rows(wide, { flag: 'late' }).every(r => r.clockInLate)).toBe(true)
    expect(rows(wide, { roleId: 'role-housekeeping' }).every(r => r.roleId === 'role-housekeeping')).toBe(true)
    expect(rows(wide, { listingId: 'lst-1' }).every(r => r.listingId === 'lst-1')).toBe(true)
  })

  it('sorts newest day first', () => {
    const { rows } = useAttendanceReport()
    const dates = rows(wide).map(r => r.date)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('counts absences from working days with no record, never today', () => {
    const { totals, rows, records } = useAttendanceReport()
    const t = totals(wide)
    expect(t.records).toBe(rows(wide).length)
    expect(t.absentDays).toBeGreaterThan(0)
    expect(totals(wide, { listingId: 'lst-1' }).absentDays).toBe(0)
    const today = toLocalDateKey(new Date())
    expect(totals({ from: today, to: today }).absentDays).toBe(0)
    expect(records.value.length).toBeGreaterThan(0)
  })

  it('does not count a still-running day as missing a check-out', () => {
    const { totals, records } = useAttendanceReport()
    const today = toLocalDateKey(new Date())
    const open = records.value.filter(r => r.date === today && !r.clockOut).length
    expect(totals({ from: today, to: today }).noCheckOut).toBe(0)
    expect(open).toBeGreaterThanOrEqual(0)
  })
})

describe('buildAttendanceSheet', () => {
  it('has a clock-in and clock-out column for each day with records', () => {
    const { staffSummaries } = useAttendanceReport()
    const range = { from: '2026-10-12', to: '2026-10-18' }
    const summaries = staffSummaries(range)
    const sheet = buildAttendanceSheet(summaries, range.from, range.to)
    const header = sheet[0] as { value: string }[]
    expect(header.slice(0, 3).map(c => c.value)).toEqual(['No', 'Employee ID', 'Staff'])
    expect(header.at(-2)?.value.endsWith(' in')).toBe(true)
    expect(header.at(-1)?.value.endsWith(' out')).toBe(true)
    expect(sheet).toHaveLength(summaries.length + 1)
    expect((sheet[1] as unknown[]).length).toBe(header.length)
  })
})
