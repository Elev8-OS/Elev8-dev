import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockRevenueSource } from '~/components/revenue/data/mock-source'

/** Drives the fake latency without waiting in real time. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync()
  return promise
}

beforeEach(() => {
  vi.useFakeTimers()
})

describe('mock source — portfolio', () => {
  it('returns rooms, findings, a summary and the not-assessable list', async () => {
    const source = createMockRevenueSource()
    const res = await settle(source.getPortfolio({
      basis: 'revenue',
      search: '',
      domain: 'all',
      minSeverity: 'all',
      gate: 'all',
    }))

    expect(res.rooms.length).toBeGreaterThan(0)
    expect(res.findings.length).toBeGreaterThan(0)
    expect(res.notAssessable.length).toBeGreaterThan(0)
    expect(res.summary.lastCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('counts degraded rooms so the portfolio banner has a number to show', async () => {
    const source = createMockRevenueSource()
    const res = await settle(source.getPortfolio({
      basis: 'revenue',
      search: '',
      domain: 'all',
      minSeverity: 'all',
      gate: 'all',
    }))
    const degraded = res.rooms.filter(r => r.syncState === 'degraded').length
    expect(res.summary.degradedRoomCount).toBe(degraded)
  })

  it('hands back a copy, so a caller mutating the result cannot corrupt the fixtures', async () => {
    const source = createMockRevenueSource()
    const first = await settle(source.getPortfolio({
      basis: 'revenue',
      search: '',
      domain: 'all',
      minSeverity: 'all',
      gate: 'all',
    }))
    first.rooms[0]!.name = 'MUTATED'

    const second = await settle(source.getPortfolio({
      basis: 'revenue',
      search: '',
      domain: 'all',
      minSeverity: 'all',
      gate: 'all',
    }))
    expect(second.rooms[0]!.name).not.toBe('MUTATED')
  })
})

describe('mock source — apply', () => {
  it('accepts an apply immediately and reports snapshot first', async () => {
    const source = createMockRevenueSource()
    const accepted = await settle(source.applyFinding({
      findingId: 'finding-1',
      basis: 'revenue',
    }))
    expect(accepted.applyId).toMatch(/^apply-/)
    expect(accepted.state).toBe('snapshot')
  })

  it('walks to live and only then offers a revert window', async () => {
    const source = createMockRevenueSource()
    const { applyId } = await settle(source.applyFinding({
      findingId: 'finding-1',
      basis: 'revenue',
    }))

    await vi.advanceTimersByTimeAsync(10_000)
    const status = await settle(source.getApplyStatus(applyId))

    expect(status.state).toBe('live')
    expect(status.policyVersionId).not.toBeNull()
    expect(status.revertableUntil).not.toBeNull()
  })

  it('records which fields a partial acceptance asked for', async () => {
    const source = createMockRevenueSource()
    const { applyId } = await settle(source.applyFinding({
      findingId: 'finding-1',
      basis: 'revenue',
      fieldLabels: ['Base price'],
    }))
    await vi.advanceTimersByTimeAsync(10_000)
    const status = await settle(source.getApplyStatus(applyId))
    expect(status.message).toContain('Base price')
  })

  it('throws for an unknown applyId rather than inventing a status', async () => {
    const source = createMockRevenueSource()
    // Attach the rejection handler before the fake timers fire. settle() runs
    // them before it returns the promise, so awaiting it here would leave the
    // rejection unhandled for a tick and Vitest would report it.
    const status = source.getApplyStatus('apply-nope')
    const assertion = expect(status).rejects.toThrow(/unknown apply/i)
    await vi.runAllTimersAsync()
    await assertion
  })
})

describe('mock source — scripted failures', () => {
  it('stops at recompute_unavailable when told to', async () => {
    const source = createMockRevenueSource({ scenario: 'recompute_unavailable' })
    const { applyId } = await settle(source.applyFinding({
      findingId: 'finding-1',
      basis: 'revenue',
    }))
    await vi.advanceTimersByTimeAsync(10_000)
    const status = await settle(source.getApplyStatus(applyId))
    expect(status.state).toBe('recompute_unavailable')
    expect(status.revertableUntil).toBeNull()
  })

  it('stops at push_failed when told to', async () => {
    const source = createMockRevenueSource({ scenario: 'push_failed' })
    const { applyId } = await settle(source.applyFinding({
      findingId: 'finding-1',
      basis: 'revenue',
    }))
    await vi.advanceTimersByTimeAsync(10_000)
    const status = await settle(source.getApplyStatus(applyId))
    expect(status.state).toBe('push_failed')
  })
})

describe('mock source — lookups', () => {
  it('returns a diagnosis for a room that has one, and null for one that does not', async () => {
    const source = createMockRevenueSource()
    expect(await settle(source.getRoomDiagnosis('room-suryas-2'))).not.toBeNull()
    expect(await settle(source.getRoomDiagnosis('room-does-not-exist'))).toBeNull()
  })

  it('returns null for an unknown finding instead of throwing', async () => {
    const source = createMockRevenueSource()
    expect(await settle(source.getFinding('finding-nope'))).toBeNull()
  })

  it('reports how many rooms a recheck queued', async () => {
    const source = createMockRevenueSource()
    const res = await settle(source.recheck({}))
    expect(res.roomsQueued).toBeGreaterThan(0)
    expect(res.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
