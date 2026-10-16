// app/components/attendance/data/attendance.ts
import { toLocalDateKey } from '~/components/activities/data/activities'

/** One person's clock-in and clock-out for one day. A working day with no record is an absence. */
export interface AttendanceRecord {
  id: string
  userId: string
  /** Local `YYYY-MM-DD`. */
  date: string
  listingId: string
  /** `HH:mm`. */
  clockIn: string
  /** `HH:mm`, unset while the person is still clocked in or forgot to clock out. */
  clockOut?: string
  clockInLate: boolean
  clockOutEarly: boolean
  clockInNote?: string
  clockOutNote?: string
  /** The selfie taken at the door. The mock has no files, so the sheet draws a placeholder for it. */
  clockInPhoto: boolean
  clockOutPhoto: boolean
  /** A stored file for the photo. Unset means the sheet draws the placeholder. */
  clockInPhotoUrl?: string
  clockOutPhotoUrl?: string
}

/** The one demo record that carries real image files instead of the drawn placeholder. */
export const DEMO_PHOTO_USER_ID = 'user-1'
export const DEMO_PHOTO_URL = '/avatars/avatartion.png'

export interface AttendanceShift {
  start: string
  end: string
  /** A flexible shift has no fixed hours, so nobody is late or early. */
  flexible: boolean
}

/** Minutes after the shift start (or before its end) that still count as on time. */
export const ATTENDANCE_GRACE_MINUTES = 10

export const ATTENDANCE_HISTORY_DAYS = 90

/** Shift per seed user. Anyone else gets `DEFAULT_SHIFT`. */
const SHIFTS: Record<string, AttendanceShift> = {
  'user-1': { start: '08:30', end: '17:30', flexible: false },
  'user-2': { start: '08:00', end: '17:00', flexible: false },
  'user-3': { start: '08:15', end: '17:15', flexible: false },
  'user-4': { start: '09:00', end: '18:00', flexible: true },
  'user-5': { start: '08:30', end: '18:00', flexible: true },
  'user-6': { start: '07:00', end: '16:00', flexible: false },
  'user-7': { start: '07:30', end: '16:30', flexible: false },
}

export const DEFAULT_SHIFT: AttendanceShift = { start: '08:00', end: '17:00', flexible: false }

export function shiftFor(userId: string): AttendanceShift {
  return SHIFTS[userId] ?? DEFAULT_SHIFT
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function toClock(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

/** Minutes between clock-in and clock-out, or undefined while the day is still open. */
export function workedMinutes(record: Pick<AttendanceRecord, 'clockIn' | 'clockOut'>): number | undefined {
  if (!record.clockOut)
    return undefined
  return Math.max(0, toMinutes(record.clockOut) - toMinutes(record.clockIn))
}

/** `7h 30m`, `45m`. */
export function formatWorked(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0)
    return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`
}

/** Small deterministic generator so the mock data is the same on every load. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const LATE_NOTES = ['Traffic on the bypass', 'Ceremony in the village', 'Scooter trouble', 'Rain']
const EARLY_NOTES = ['Doctor appointment', 'Family matter', 'Finished the plan early']

/**
 * Seed records for the last `ATTENDANCE_HISTORY_DAYS` days, relative to `now`.
 * Sundays are the day off. About one working day in fourteen is an absence (no record). Today a person
 * is only clocked out once their shift is over. Inactive people have no records.
 */
export function buildSeedAttendance(
  now: Date,
  people: { id: string, listingIds: string[], active: boolean }[],
): AttendanceRecord[] {
  const records: AttendanceRecord[] = []
  const todayKey = toLocalDateKey(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  people.forEach((person, personIndex) => {
    if (!person.active || !person.listingIds.length)
      return
    const rand = mulberry32(5170 + personIndex * 97)
    // Its own generator, so photos leave every other generated value as it was.
    const photoRand = mulberry32(3301 + personIndex * 53)
    const shift = shiftFor(person.id)
    const start = toMinutes(shift.start)
    const end = toMinutes(shift.end)

    for (let daysAgo = ATTENDANCE_HISTORY_DAYS; daysAgo >= 0; daysAgo--) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo)
      const date = toLocalDateKey(day)
      // Draw first so every person keeps the same sequence whatever the calendar does.
      const absentRoll = rand()
      const lateRoll = rand()
      const lateBy = 12 + Math.floor(rand() * 40)
      const jitter = Math.floor(rand() * 9) - 4
      const earlyRoll = rand()
      const earlyBy = 15 + Math.floor(rand() * 60)
      const forgotRoll = rand()
      const listingRoll = rand()
      if (day.getDay() === 0 || absentRoll < 0.07)
        continue
      const inPhotoRoll = photoRand()
      const outPhotoRoll = photoRand()
      // Nobody has clocked in yet before their shift starts today.
      if (date === todayKey && nowMinutes < start - 15)
        continue

      const late = !shift.flexible && lateRoll < 0.12
      const clockInAt = late ? start + lateBy : start + jitter
      const early = !shift.flexible && earlyRoll < 0.08
      const clockOutAt = early ? end - earlyBy : end + Math.floor(jitter * 2)
      const isToday = date === todayKey
      const stillOpen = isToday && nowMinutes < clockOutAt
      const forgot = !isToday && forgotRoll < 0.03

      const clockOut = stillOpen || forgot ? undefined : toClock(clockOutAt)
      records.push({
        id: `att-${person.id}-${date}`,
        userId: person.id,
        date,
        listingId: person.listingIds[Math.floor(listingRoll * person.listingIds.length)]!,
        clockIn: toClock(clockInAt),
        clockOut,
        clockInPhoto: inPhotoRoll > 0.06,
        clockOutPhoto: !!clockOut && outPhotoRoll > 0.06,
        clockInLate: late && lateBy > ATTENDANCE_GRACE_MINUTES,
        clockOutEarly: early && earlyBy > ATTENDANCE_GRACE_MINUTES && !stillOpen && !forgot,
        clockInNote: late ? LATE_NOTES[Math.floor(listingRoll * LATE_NOTES.length)] : undefined,
        clockOutNote: early && !stillOpen && !forgot ? EARLY_NOTES[Math.floor(listingRoll * EARLY_NOTES.length)] : undefined,
      })
    }
  })

  // One record with real files, so the viewer can be tried on an actual image: the latest finished day of the demo user.
  const demo = records.filter(r => r.userId === DEMO_PHOTO_USER_ID && r.clockOut).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (demo) {
    demo.clockInPhoto = true
    demo.clockOutPhoto = true
    demo.clockInPhotoUrl = DEMO_PHOTO_URL
    demo.clockOutPhotoUrl = DEMO_PHOTO_URL
  }
  return records
}

/**
 * A placeholder for the clock-in or clock-out selfie, as an SVG data URL: the person's initials, what it
 * is and when. Drawn on demand so the saved records stay small.
 */
export function attendancePhotoUrl(kind: 'in' | 'out', who: { name: string, date: string, time: string, place: string }): string {
  const initials = who.name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('')
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1280" viewBox="0 0 960 1280">`
    + `<rect width="960" height="1280" fill="#e5e7eb"/>`
    + `<circle cx="480" cy="520" r="210" fill="#9ca3af"/>`
    + `<text x="480" y="580" font-family="Inter,Arial,sans-serif" font-size="170" font-weight="600" text-anchor="middle" fill="#f9fafb">${esc(initials)}</text>`
    + `<rect x="0" y="1020" width="960" height="260" fill="#111827" fill-opacity="0.72"/>`
    + `<text x="48" y="1100" font-family="Inter,Arial,sans-serif" font-size="52" font-weight="600" fill="#fff">${kind === 'in' ? 'Check in' : 'Check out'} ${esc(who.time)}</text>`
    + `<text x="48" y="1170" font-family="Inter,Arial,sans-serif" font-size="38" fill="#e5e7eb">${esc(who.date)}</text>`
    + `<text x="48" y="1226" font-family="Inter,Arial,sans-serif" font-size="34" fill="#d1d5db">${esc(who.place.slice(0, 44))}</text>`
    + `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
