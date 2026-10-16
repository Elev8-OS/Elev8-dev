import type { ActivityLog } from '~/components/activities/data/activities'
import { beforeEach, describe, expect, it } from 'vitest'
import { ACTIVITY_STORAGE_KEY, ACTIVITY_STORE_VERSION, growActivityReport, loadActivityReport, saveActivityReport } from '~/lib/activity-store'

function log(id: string, date: string, extra: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id,
    userId: 'user-7',
    listingId: 'lst-1',
    listingName: 'Villa',
    type: 'task',
    title: 'Laundry run',
    date,
    durationMinutes: 30,
    ...extra,
  }
}

beforeEach(() => localStorage.clear())

describe('saved activity report', () => {
  it('round-trips what was saved', () => {
    expect(loadActivityReport()).toBeNull()
    saveActivityReport({ throughDay: '2026-10-16', logs: [log('a', '2026-10-16')], audit: [] })
    expect(loadActivityReport()).toMatchObject({ v: ACTIVITY_STORE_VERSION, throughDay: '2026-10-16', logs: [{ id: 'a' }], audit: [] })
  })

  it('drops a copy it cannot trust instead of misreading it', () => {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, '{not json')
    expect(loadActivityReport()).toBeNull()
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify({ v: ACTIVITY_STORE_VERSION + 1, throughDay: '2026-10-16', logs: [], audit: [] }))
    expect(loadActivityReport()).toBeNull()
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify({ v: ACTIVITY_STORE_VERSION, throughDay: 5, logs: [], audit: [] }))
    expect(loadActivityReport()).toBeNull()
  })
})

describe('growActivityReport', () => {
  const stored = { v: ACTIVITY_STORE_VERSION, throughDay: '2026-10-14', logs: [log('keep', '2026-10-10'), log('manual', '2026-10-14', { manual: true })], audit: [] }

  it('adds only the days since the saved copy, and never touches what is saved', () => {
    const fresh = [log('f1', '2026-10-12'), log('f2', '2026-10-15'), log('f3', '2026-10-16')]
    const grown = growActivityReport(stored, '2026-10-16', fresh)
    expect(grown.throughDay).toBe('2026-10-16')
    expect(grown.logs.slice(0, 2)).toEqual(stored.logs)
    expect(grown.logs.slice(2).map(l => l.date)).toEqual(['2026-10-15', '2026-10-16'])
    expect(new Set(grown.logs.map(l => l.id)).size).toBe(grown.logs.length)
    expect(grown.logs.slice(2).every(l => l.id.endsWith('-2026-10-16'))).toBe(true)
  })

  it('does nothing on the same day, and not for a clock set back', () => {
    expect(growActivityReport(stored, '2026-10-14', [log('f', '2026-10-15')])).toBe(stored)
    expect(growActivityReport(stored, '2026-10-01', [log('f', '2026-10-15')])).toBe(stored)
  })
})
