import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import type { CockpitRow } from '~/components/cockpit/data/cockpit'
import type { Booking } from '~/components/listings/data/listings'
import { describe, expect, it } from 'vitest'
import { roomCleaningStatus } from '~/components/cockpit/data/cockpit-cleaning'

const TODAY = '2026-10-09'

function stay(checkIn: string, checkOut: string, extra: Partial<Booking> = {}): Booking {
  return { id: `${checkIn}-${checkOut}`, guestName: 'Ana Silva', checkIn, checkOut, status: 'confirmed', type: 'reservation', ...extra } as Booking
}

function row(stays: Booking[], extra: Partial<CockpitRow> = {}): CockpitRow {
  return { id: 'lst-1', kind: 'unit', unitId: null, name: 'Whole property', capacity: 4, stays, ...extra }
}

function job(scheduledAt: string, status: CleaningJob['status'], extra: Partial<CleaningJob> = {}) {
  return { id: `job-${scheduledAt}-${status}`, listingId: 'lst-1', unitId: null, scheduledAt, status, cleanerNames: ['Made Surya'], source: 'check_out' as const, ...extra }
}

describe('roomCleaningStatus', () => {
  it('reads a room nobody has left as clean', () => {
    expect(roomCleaningStatus(row([]), 'lst-1', [], TODAY)?.state).toBe('clean')
  })

  it('marks a room dirty after a departure with no cleaning done since', () => {
    const status = roomCleaningStatus(row([stay('2026-10-05', '2026-10-09')]), 'lst-1', [job('2026-10-09T11:00:00+08:00', 'scheduled')], TODAY)
    expect(status?.state).toBe('dirty')
    expect(status?.detail).toContain('Next cleaning 9 Oct 11:00, Made Surya')
  })

  it('is clean again once the cleaning after the departure is done', () => {
    const status = roomCleaningStatus(row([stay('2026-10-01', '2026-10-05')]), 'lst-1', [job('2026-10-05T11:00:00+08:00', 'done')], TODAY)
    expect(status?.state).toBe('clean')
    expect(status?.detail).toContain('Last cleaned 5 Oct 11:00')
  })

  it('says a past cleaning that never started was missed', () => {
    const status = roomCleaningStatus(row([stay('2026-10-01', '2026-10-05')]), 'lst-1', [job('2026-10-05T11:00:00+08:00', 'scheduled')], TODAY)
    expect(status?.state).toBe('dirty')
    expect(status?.detail).toContain('missed')
  })

  it('shows a cleaning in progress today', () => {
    expect(roomCleaningStatus(row([stay('2026-10-01', '2026-10-09')]), 'lst-1', [job('2026-10-09T10:00:00+08:00', 'in_progress')], TODAY)?.state).toBe('cleaning')
  })

  it('reads a room with a guest who arrived before today as occupied', () => {
    expect(roomCleaningStatus(row([stay('2026-09-01', '2026-09-05'), stay('2026-10-07', '2026-10-12')]), 'lst-1', [], TODAY)?.state).toBe('occupied')
  })

  it('ignores blocks, cancelled stays and other rooms\' jobs', () => {
    const room = row([stay('2026-10-01', '2026-10-05', { type: 'block' }), stay('2026-10-02', '2026-10-06', { status: 'cancelled' })], { id: 'lst-1:u1', kind: 'room', unitId: 'u1' })
    expect(roomCleaningStatus(room, 'lst-1', [job('2026-10-09T10:00:00+08:00', 'in_progress', { unitId: 'u2' })], TODAY)?.state).toBe('clean')
  })

  it('gives the unassigned row no state', () => {
    expect(roomCleaningStatus(row([], { id: 'lst-1:unassigned', kind: 'unassigned' }), 'lst-1', [], TODAY)).toBeNull()
  })

  it('names the cleaning a click opens', () => {
    const ongoing = job(`${TODAY}T10:00:00+08:00`, 'in_progress')
    expect(roomCleaningStatus(row([]), 'lst-1', [ongoing], TODAY)?.jobId).toBe(ongoing.id)

    // Dirty: the next cleaning, else the missed one.
    const left = row([stay('2026-10-01', '2026-10-05')])
    const missed = job('2026-10-05T11:00:00+08:00', 'scheduled')
    const next = job('2026-10-10T11:00:00+08:00', 'scheduled')
    expect(roomCleaningStatus(left, 'lst-1', [missed, next], TODAY)?.jobId).toBe(next.id)
    expect(roomCleaningStatus(left, 'lst-1', [missed], TODAY)?.jobId).toBe(missed.id)

    // Clean: the last one done; none at all, nothing to open.
    const done = job('2026-10-05T11:00:00+08:00', 'done')
    expect(roomCleaningStatus(left, 'lst-1', [done, next], TODAY)?.jobId).toBe(done.id)
    expect(roomCleaningStatus(row([]), 'lst-1', [], TODAY)?.jobId).toBeUndefined()
  })
})
