import { describe, expect, it } from 'vitest'
import {
  formatCountdown,
  formatInstant, formatRange, formatUtc, formatWindowForViewer, timezoneOffsetMs, zonedToInstant,
} from '~/lib/platform-banner-time'

describe('zonedToInstant', () => {
  it('reads Bali wall time as UTC+8', () => {
    expect(zonedToInstant('2026-06-12', '10:00', 'Asia/Makassar')).toBe('2026-06-12T02:00:00.000Z')
  })

  it('leaves UTC untouched', () => {
    expect(zonedToInstant('2026-06-12', '02:00', 'UTC')).toBe('2026-06-12T02:00:00.000Z')
  })

  it('follows daylight saving in Zurich', () => {
    expect(zonedToInstant('2026-01-15', '12:00', 'Europe/Zurich')).toBe('2026-01-15T11:00:00.000Z')
    expect(zonedToInstant('2026-07-15', '12:00', 'Europe/Zurich')).toBe('2026-07-15T10:00:00.000Z')
  })

  it('returns null when a part is missing or malformed', () => {
    expect(zonedToInstant(null, '10:00', 'UTC')).toBeNull()
    expect(zonedToInstant('2026-06-12', '', 'UTC')).toBeNull()
    expect(zonedToInstant('12/06/2026', '10:00', 'UTC')).toBeNull()
  })
})

describe('timezoneOffsetMs', () => {
  it('is eight hours for Bali', () => {
    expect(timezoneOffsetMs(Date.UTC(2026, 5, 12), 'Asia/Makassar')).toBe(8 * 3_600_000)
  })
})

describe('formatting', () => {
  const start = '2026-06-12T02:00:00.000Z'
  const end = '2026-06-12T02:30:00.000Z'

  it('shows a same-day window once', () => {
    expect(formatRange(start, end, 'UTC')).toBe('Fri 12 Jun, 02:00 to 02:30 UTC')
  })

  it('shifts the clock into the viewer zone', () => {
    expect(formatRange(start, end, 'Asia/Makassar')).toMatch(/^Fri 12 Jun, 10:00 to 10:30 /)
  })

  it('names both days when the window crosses midnight in the viewer zone', () => {
    const out = formatRange('2026-06-12T15:30:00.000Z', '2026-06-12T16:30:00.000Z', 'Asia/Makassar')
    expect(out).toMatch(/Fri 12 Jun, 23:30 to Sat 13 Jun, 00:30/)
  })

  it('adds the UTC reading unless the viewer is on UTC', () => {
    expect(formatWindowForViewer(start, end, 'Asia/Makassar').utc).toBe('Fri 12 Jun, 02:00 to 02:30 UTC')
    expect(formatWindowForViewer(start, end, 'UTC').utc).toBeNull()
  })

  it('formats one instant and a stable UTC stamp', () => {
    expect(formatInstant(start, 'UTC')).toBe('Fri 12 Jun, 02:00 UTC')
    expect(formatUtc(start)).toBe('2026-06-12 02:00 UTC')
  })
})

describe('formatCountdown', () => {
  const t = Date.UTC(2026, 5, 12)
  it('uses the two largest whole units', () => {
    expect(formatCountdown(t + (2 * 1440 + 4 * 60 + 5) * 60_000, t)).toBe('2d 4h')
    expect(formatCountdown(t + (3 * 60 + 10) * 60_000, t)).toBe('3h 10m')
    expect(formatCountdown(t + 25 * 60_000, t)).toBe('25m')
  })
  it('drops a zero second unit', () => {
    expect(formatCountdown(t + 2 * 1440 * 60_000, t)).toBe('2d')
    expect(formatCountdown(t + 3 * 60 * 60_000, t)).toBe('3h')
  })
  it('never goes negative', () => {
    expect(formatCountdown(t - 5000, t)).toBe('under 1m')
    expect(formatCountdown(t + 30_000, t)).toBe('under 1m')
  })
})
