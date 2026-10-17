import { beforeEach, describe, expect, it } from 'vitest'
import { toLocalDateKey } from '~/components/activities/data/activities'
import { attendancePhotoUrl, buildSeedAttendance, DEMO_PHOTO_URL, formatWorked, shiftFor, workedMinutes } from '~/components/attendance/data/attendance'
import { useAttendanceReport } from '~/composables/useAttendanceReport'
import { useSchedule } from '~/composables/useSchedule'
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

describe('split shifts', () => {
  const todayKey = toLocalDateKey(noon)
  const yesterday = toLocalDateKey(new Date(noon.getFullYear(), noon.getMonth(), noon.getDate() - 1))
  const split = {
    working: true as const,
    source: 'override' as const,
    shift: { start: '07:00', end: '11:00', flexible: false },
    segments: [{ start: '07:00', end: '11:00', flexible: false }, { start: '16:00', end: '20:00', flexible: false }],
  }
  const person = [{ id: 'user-2', listingIds: ['lst-1'], active: true }]

  it('makes one record per shift of a split-shift day, each against its own hours', () => {
    const records = buildSeedAttendance(noon, person, (_id, date) => date === yesterday ? split : { working: true, source: 'role', shift: { start: '08:00', end: '17:00', flexible: false }, segments: [{ start: '08:00', end: '17:00', flexible: false }] })
    const day = records.filter(r => r.date === yesterday)
    // A day can lose a shift to the absence rolls, but never gets more than two, and the second is marked.
    expect(day.length).toBeLessThanOrEqual(2)
    expect(day.every(r => r.segment === undefined || r.segment === 2)).toBe(true)
    const second = day.find(r => r.segment === 2)
    if (second)
      expect(second.clockIn >= '15:00' && (second.clockOut ?? '20:00') <= '21:30').toBe(true)
    expect(records.filter(r => r.date !== yesterday && r.date !== todayKey).every(r => !r.segment)).toBe(true)
  })

  it('counts a missed second shift as an absence', () => {
    const { records, totals } = useAttendanceReport()
    const { overrides } = useSchedule()
    overrides.value = []
    const { setWorking } = useSchedule()
    // Yesterday: a finished day, so a shift nobody clocked is an absence whatever today's date is.
    const now = new Date()
    const day = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
    setWorking('user-2', [day], { startTime: '07:00', endTime: '11:00', extra: [{ startTime: '16:00', endTime: '20:00' }] })
    records.value = [{ id: 'a', userId: 'user-2', date: day, listingId: 'lst-1', clockIn: '07:00', clockOut: '11:00', clockInLate: false, clockOutEarly: false, clockInPhoto: false, clockOutPhoto: false }]
    const range = { from: day, to: day }
    expect(totals(range).absentDays).toBe(1)
    records.value = [...records.value, { id: 'b', userId: 'user-2', date: day, segment: 2, listingId: 'lst-1', clockIn: '16:00', clockOut: '20:00', clockInLate: false, clockOutEarly: false, clockInPhoto: false, clockOutPhoto: false }]
    expect(totals(range).absentDays).toBe(0)
  })
})

describe('split shift export', () => {
  const rec = (segment: 1 | 2, clockIn: string, clockOut: string) => ({ id: `r${segment}`, userId: 'user-2', date: '2026-10-14', ...(segment === 2 ? { segment } : {}), listingId: 'lst-1', clockIn, clockOut, clockInLate: false, clockOutEarly: false, clockInPhoto: false, clockOutPhoto: false })
  const summary = (byDate: Record<string, ReturnType<typeof rec>>) => ({ userId: 'user-2', name: 'Made', employeeNumber: 'E1', roleName: 'Listing Manager', joined: '2026-01-01', present: 1, absent: 0, late: 0, early: 0, noCheckOut: 0, byDate })

  it('adds a second in and out pair only on a day with a split shift', () => {
    const plain = buildAttendanceSheet([summary({ '2026-10-14': rec(1, '08:00', '17:00') })], '2026-10-14', '2026-10-14')
    expect(plain[0]).toHaveLength(12)
    const split = buildAttendanceSheet([summary({ '2026-10-14': rec(1, '07:00', '11:00'), '2026-10-14|2': rec(2, '16:00', '20:00') })], '2026-10-14', '2026-10-14')
    expect(split[0]).toHaveLength(14)
    const row = split[1] as { value: string }[]
    expect(row.slice(-4).map(c => c.value)).toEqual(['07:00', '11:00', '16:00', '20:00'])
  })
})

describe('overnight shifts', () => {
  const night = { working: true as const, source: 'role' as const, shift: { start: '22:00', end: '06:00', flexible: false }, segments: [{ start: '22:00', end: '06:00', flexible: false }] }

  it('works out the time across midnight and marks a check-out on the next day', () => {
    expect(workedMinutes({ clockIn: '22:00', clockOut: '06:00', clockOutNextDay: true })).toBe(480)
    expect(workedMinutes({ clockIn: '22:00', clockOut: '06:00' })).toBe(0)
    const records = buildSeedAttendance(noon, [{ id: 'user-2', listingIds: ['lst-1'], active: true }], () => night)
    const finished = records.filter(r => r.clockOut)
    expect(finished.length).toBeGreaterThan(10)
    // 22:00 to 06:00 ends on the next day, give or take the jitter: never an in-day check-out before the check-in.
    expect(finished.every(r => r.clockOutNextDay === true || r.clockOut! > r.clockIn)).toBe(true)
    expect(finished.filter(r => r.clockOutNextDay).every(r => r.clockOut! < '12:00')).toBe(true)
    expect(records.find(r => r.date === toLocalDateKey(noon))?.clockOut).toBeUndefined()
  })

  it('adds a (+1) to the export check-out', () => {
    const rec = { id: 'r', userId: 'user-2', date: '2026-10-14', listingId: 'lst-1', clockIn: '22:00', clockOut: '06:00', clockOutNextDay: true, clockInLate: false, clockOutEarly: false, clockInPhoto: false, clockOutPhoto: false }
    const sheet = buildAttendanceSheet([{ userId: 'user-2', name: 'Made', employeeNumber: 'E1', roleName: 'Role', joined: '2026-01-01', present: 1, absent: 0, late: 0, early: 0, noCheckOut: 0, byDate: { '2026-10-14': rec } }], '2026-10-14', '2026-10-14')
    expect((sheet[1] as { value: string }[]).at(-1)!.value).toBe('06:00 (+1)')
  })

  it('names the third shift columns of a day with three shifts', () => {
    const r = (segment: number) => ({ id: `r${segment}`, userId: 'user-2', date: '2026-10-14', segment, listingId: 'lst-1', clockIn: '08:00', clockOut: '09:00', clockInLate: false, clockOutEarly: false, clockInPhoto: false, clockOutPhoto: false })
    const sheet = buildAttendanceSheet([{ userId: 'user-2', name: 'Made', employeeNumber: 'E1', roleName: 'Role', joined: '2026-01-01', present: 1, absent: 0, late: 0, early: 0, noCheckOut: 0, byDate: { '2026-10-14': r(1), '2026-10-14|2': r(2), '2026-10-14|3': r(3) } }], '2026-10-14', '2026-10-14')
    const header = (sheet[0] as { value: string }[]).map(c => c.value)
    expect(header.slice(-6)).toEqual(['14 Oct in', '14 Oct out', '14 Oct, shift 2 in', '14 Oct, shift 2 out', '14 Oct, shift 3 in', '14 Oct, shift 3 out'])
  })
})

describe('attendanceStatus', () => {
  const rec = (userId: string, date: string, segment?: number) => ({ id: `${userId}-${date}-${segment ?? 1}`, userId, date, ...(segment ? { segment } : {}), listingId: 'lst-1', clockIn: '08:00', clockOut: '17:00', clockInLate: false, clockOutEarly: false, clockInPhoto: false, clockOutPhoto: false })
  const dayKey = (offset: number) => { const d = new Date(); return toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset)) }

  it('shows the record of a past shift, and an absence for one with no record', () => {
    const { records, attendanceStatus } = useAttendanceReport()
    const { overrides, setWorking } = useSchedule()
    overrides.value = []
    // user-2 is on Monday to Saturday: force the two days to be working days whatever today's weekday is.
    setWorking('user-2', [dayKey(-3), dayKey(-2), dayKey(-5)], { startTime: '08:00', endTime: '17:00' })
    records.value = [rec('user-2', dayKey(-5)), rec('user-2', dayKey(-3))]
    expect(attendanceStatus('user-2', dayKey(-3))).toEqual([{ segment: 1, record: expect.objectContaining({ clockIn: '08:00' }), absent: false }])
    expect(attendanceStatus('user-2', dayKey(-2))).toEqual([{ segment: 1, record: undefined, absent: true }])
  })

  it('does not call a day before the first record, today, or the future absent', () => {
    const { records, attendanceStatus } = useAttendanceReport()
    const { overrides, setWorking } = useSchedule()
    overrides.value = []
    setWorking('user-2', [dayKey(-8), dayKey(0), dayKey(2)], { startTime: '08:00', endTime: '17:00' })
    records.value = [rec('user-2', dayKey(-3))]
    expect(attendanceStatus('user-2', dayKey(-8))).toEqual([])
    expect(attendanceStatus('user-2', dayKey(0))).toEqual([])
    expect(attendanceStatus('user-2', dayKey(2))).toEqual([])
  })

  it('reports each shift of a split-shift day on its own, and keeps work on a day off', () => {
    const { records, attendanceStatus } = useAttendanceReport()
    const { overrides, setWorking, setDayOff } = useSchedule()
    overrides.value = []
    setWorking('user-2', [dayKey(-3)], { startTime: '07:00', endTime: '11:00', extra: [{ startTime: '16:00', endTime: '20:00' }] })
    records.value = [rec('user-2', dayKey(-3)), rec('user-2', dayKey(-6))]
    expect(attendanceStatus('user-2', dayKey(-3)).map(a => [a.segment, a.absent])).toEqual([[1, false], [2, true]])
    setDayOff('user-2', [dayKey(-6)], { type: 'leave' })
    expect(attendanceStatus('user-2', dayKey(-6))).toEqual([{ segment: 1, record: expect.objectContaining({ clockIn: '08:00' }), absent: false }])
  })
})
