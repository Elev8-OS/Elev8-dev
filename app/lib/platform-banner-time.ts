// Time helpers for platform broadcasts. Staff compose in one chosen timezone;
// every tenant reads the same instant in their own timezone, with UTC beside it
// so nobody has to guess which "02:00" is meant.

export interface BannerTimezone {
  id: string
  label: string
}

export const BANNER_TIMEZONES: BannerTimezone[] = [
  { id: 'UTC', label: 'UTC' },
  { id: 'Asia/Makassar', label: 'Bali (WITA, UTC+8)' },
  { id: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
  { id: 'Europe/Zurich', label: 'Zurich (CET / CEST)' },
  { id: 'Europe/Lisbon', label: 'Lisbon (WET / WEST)' },
]

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatters.set(timeZone, f)
  }
  return f
}

/** Offset of `timeZone` from UTC at the instant `utcMs`, in milliseconds. */
export function timezoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = partsFormatter(timeZone).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(utcMs / 1000) * 1000
}

/**
 * Turns a wall-clock date and time in `timeZone` into a UTC ISO string.
 * `date` is `YYYY-MM-DD`, `time` is `HH:mm`. Returns null for unusable input.
 */
export function zonedToInstant(date: string | null | undefined, time: string | null | undefined, timeZone: string): string | null {
  if (!date || !time) return null
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!d || !t) return null
  const guess = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]))
  // Two passes settle a wall time that sits across a DST change.
  let result = guess - timezoneOffsetMs(guess, timeZone)
  result = guess - timezoneOffsetMs(result, timeZone)
  const out = new Date(result)
  return Number.isNaN(out.getTime()) ? null : out.toISOString()
}

function dayKey(ms: number, timeZone: string): string {
  const p = partsFormatter(timeZone).formatToParts(new Date(ms))
  const get = (type: string) => p.find(x => x.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

function clock(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms))
}

function dayLabel(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(ms))
}

function zoneName(ms: number, timeZone: string): string {
  if (timeZone === 'UTC') return 'UTC'
  const part = new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' })
    .formatToParts(new Date(ms))
    .find(p => p.type === 'timeZoneName')?.value
  return part ?? timeZone
}

/** "Sat 12 Jun, 10:00 to 10:30 GMT+8". Spans two days when the window crosses midnight. */
export function formatRange(startIso: string, endIso: string, timeZone: string): string {
  const s = new Date(startIso).getTime()
  const e = new Date(endIso).getTime()
  if (Number.isNaN(s) || Number.isNaN(e)) return ''
  const zone = zoneName(s, timeZone)
  if (dayKey(s, timeZone) === dayKey(e, timeZone)) {
    return `${dayLabel(s, timeZone)}, ${clock(s, timeZone)} to ${clock(e, timeZone)} ${zone}`
  }
  return `${dayLabel(s, timeZone)}, ${clock(s, timeZone)} to ${dayLabel(e, timeZone)}, ${clock(e, timeZone)} ${zone}`
}

/** One instant, "Sat 12 Jun, 10:00 GMT+8". */
export function formatInstant(iso: string, timeZone: string): string {
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  return `${dayLabel(ms, timeZone)}, ${clock(ms, timeZone)} ${zoneName(ms, timeZone)}`
}

/** Local reading plus the UTC reading, unless the viewer is already on UTC. */
export function formatWindowForViewer(startIso: string, endIso: string, viewerTimeZone: string): { local: string, utc: string | null } {
  const local = formatRange(startIso, endIso, viewerTimeZone)
  if (viewerTimeZone === 'UTC') return { local, utc: null }
  return { local, utc: formatRange(startIso, endIso, 'UTC') }
}

/** `YYYY-MM-DD HH:mm UTC`, stable on server and client. */
export function formatUtc(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

/** "2d 4h", "3h 10m", "25m", "under 1m". Whole units only, two at most. */
export function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, targetMs - nowMs)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'under 1m'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  return `${mins}m`
}
