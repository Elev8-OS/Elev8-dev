import type { ApplyStatus, RevenueDataSource } from '~/components/revenue/data/contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { roomDiagnoses } from '~/components/revenue/data/diagnosis'
import { useRevenueHealth } from '~/composables/useRevenueHealth'
import { setRevenueSource } from '~/composables/useRevenueSource'

/**
 * A real diagnosis (borrowed from the fixtures, so every field is valid)
 * re-pointed at room-a with its gate failing at `conversion`. Room B is left
 * without a diagnosis, so the gate filter has something to tell them apart by.
 */
const roomADiagnosis = {
  ...roomDiagnoses[0]!,
  roomId: 'room-a',
  gate: { ...roomDiagnoses[0]!.gate, firstFailing: 'conversion' as const },
}

/**
 * A source with two rooms and three findings, small enough to reason about.
 * Room A has the bigger single finding; room B has more findings in total, so
 * a naive sum would rank them the wrong way round.
 */
function stubSource(): RevenueDataSource {
  const money = (amount: number) => ({
    revenue: { amount, low: amount / 2, high: amount * 2, currency: 'USD' },
    margin: { amount: amount / 2, low: amount / 4, high: amount, currency: 'USD' },
  })
  const finding = (id: string, roomId: string, amount: number, severity: 'critical' | 'high' | 'low') => ({
    id,
    roomId,
    domain: 'pricing' as const,
    severity,
    headline: `Finding ${id}`,
    windowLabel: 'Next 30 days',
    money: money(amount),
    confidence: 0.8,
    changes: [{ label: 'Base price', from: '$100', to: '$120' }],
    supporting: [],
    against: [],
    unknowns: [],
    checkKey: 'pricing.test',
    checkVersion: 1,
    horizonBand: '0–30 days',
    expiresInDays: 5,
    autonomyBand: '±5%',
    acceptedCount: 0,
  })
  const room = (id: string, name: string) => ({
    id,
    name,
    location: 'Canggu',
    syncState: 'live' as const,
    costInputsConfirmed: true,
    inHoldout: false,
    adrVsSet: 0,
    trend: [0.5, 0.5],
    trendReference: 0.5,
  })

  return {
    getPortfolio: async () => ({
      rooms: [room('room-a', 'Room A'), room('room-b', 'Room B')],
      findings: [
        finding('f-a1', 'room-a', 900, 'high'),
        finding('f-b1', 'room-b', 500, 'critical'),
        finding('f-b2', 'room-b', 500, 'low'),
      ],
      notAssessable: [{ roomId: 'room-z', name: 'Room Z', missing: 'comp-set not resolved' }],
      summary: {
        lastCheckedAt: '2026-09-11T04:12:00.000Z',
        appliedThisWeek: 14,
        appliedAutomatically: 9,
        upliftPercent: 3.1,
        upliftRoomsMeasured: 42,
        roomsTotal: 46,
        degradedRoomCount: 0,
      },
    }),
    getRoomDiagnosis: async (roomId: string) => (roomId === 'room-a' ? roomADiagnosis : null),
    getFinding: async () => null,
    applyFinding: async () => ({ applyId: 'apply-1', state: 'snapshot' as const }),
    getApplyStatus: async () => ({
      applyId: 'apply-1',
      findingId: 'f-a1',
      state: 'live' as const,
      policyVersionId: 'pv-1',
      message: null,
      revertableUntil: '2026-09-18T00:00:00.000Z',
    }),
    revertApply: async () => {},
    dismissFinding: async () => {},
    recheck: async () => ({ startedAt: '2026-09-11T04:30:00.000Z', roomsQueued: 2 }),
  }
}

beforeEach(() => {
  setRevenueSource(stubSource())
})

async function loaded() {
  const health = useRevenueHealth()
  await health.load()
  return health
}

describe('useRevenueHealth — ranking', () => {
  it('ranks a room by its largest single finding, never by the sum', async () => {
    const health = await loaded()
    const rows = health.portfolioRows.value

    // Room A: one finding at 900. Room B: two at 500, summing to 1000.
    // A naive sum would put Room B first. It must not.
    expect(rows[0]!.room.id).toBe('room-a')
    expect(rows[0]!.atStake).toBe(900)
    expect(rows[1]!.atStake).toBe(500)
  })

  it('picks the worst finding by severity, not by money', async () => {
    const health = await loaded()
    const roomB = health.portfolioRows.value.find(row => row.room.id === 'room-b')
    // Both of room B's findings are 500; the critical one is the worst.
    expect(roomB!.worst!.severity).toBe('critical')
  })

  it('re-ranks when the basis switches', async () => {
    const health = await loaded()
    health.basis.value = 'margin'
    expect(health.portfolioRows.value[0]!.atStake).toBe(450)
  })
})

describe('useRevenueHealth — filters', () => {
  it('filters by severity floor, keeping everything at or above it', async () => {
    const health = await loaded()
    health.filters.value.minSeverity = 'high'
    const ids = health.visibleFindings.value.map(finding => finding.id)
    expect(ids).toContain('f-a1')
    expect(ids).toContain('f-b1')
    expect(ids).not.toContain('f-b2')
  })

  it('searches across listing name as well as headline', async () => {
    const health = await loaded()
    health.filters.value.search = 'Room B'
    const ids = health.visibleFindings.value.map(finding => finding.id)
    expect(ids).toEqual(['f-b1', 'f-b2'])
  })

  it('clears every filter at once', async () => {
    const health = await loaded()
    health.filters.value.search = 'zzz'
    health.filters.value.minSeverity = 'critical'
    health.resetFilters()
    expect(health.visibleFindings.value).toHaveLength(3)
  })

  it('narrows to rooms whose diagnosis names that failing gate', async () => {
    const health = await loaded()
    // Only room-a has a diagnosis (see roomADiagnosis), and it fails at
    // 'conversion'. Room B has no diagnosis at all, so it must drop out.
    health.filters.value.gate = 'conversion'
    const ids = health.visibleFindings.value.map(finding => finding.id)
    expect(ids).toEqual(['f-a1'])
  })
})

describe('useRevenueHealth — stats and disclosure', () => {
  it('names the largest opportunity across the whole portfolio', async () => {
    const health = await loaded()
    expect(health.stats.value.largest!.id).toBe('f-a1')
    expect(health.stats.value.largestRoom!.id).toBe('room-a')
  })

  it('carries the not-assessable rooms through, so completeness is visible', async () => {
    const health = await loaded()
    expect(health.notAssessable.value).toHaveLength(1)
    expect(health.notAssessable.value[0]!.missing).toBe('comp-set not resolved')
  })
})

describe('useRevenueHealth — dismissal', () => {
  it('removes a dismissed finding from the open list', async () => {
    const health = await loaded()
    await health.dismissFinding('f-a1')
    expect(health.visibleFindings.value.map(f => f.id)).not.toContain('f-a1')
  })

  it('drops a room from the table once its last finding is gone', async () => {
    const health = await loaded()
    await health.dismissFinding('f-a1')
    expect(health.portfolioRows.value.map(row => row.room.id)).not.toContain('room-a')
  })

  it('puts the finding back when the source rejects the dismissal', async () => {
    const source = stubSource()
    source.dismissFinding = async () => { throw new Error('network down') }
    setRevenueSource(source)

    const health = useRevenueHealth()
    await health.load()
    await health.dismissFinding('f-a1')

    // The write never landed, so the finding must still be on screen.
    expect(health.visibleFindings.value.map(f => f.id)).toContain('f-a1')
    expect(health.loadError.value).toBe('network down')
  })
})

describe('useRevenueHealth — recheck', () => {
  it('calls the source and records when it last ran', async () => {
    const source = stubSource()
    const spy = vi.spyOn(source, 'recheck')
    setRevenueSource(source)

    const health = useRevenueHealth()
    await health.load()
    await health.recheck()

    expect(spy).toHaveBeenCalledOnce()
  })
})

describe('useRevenueHealth — apply write path', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function statusAt(state: ApplyStatus['state'], message: string): ApplyStatus {
    return {
      applyId: 'apply-1',
      findingId: 'f-a1',
      state,
      policyVersionId: state === 'snapshot' ? null : 'pv-1',
      message,
      revertableUntil: state === 'live' ? '2026-09-18T00:00:00.000Z' : null,
    }
  }

  it('polls through to live, writing each state and its message as it goes', async () => {
    const source = stubSource()
    source.getApplyStatus = vi.fn()
      .mockResolvedValueOnce(statusAt('saved', 'Saved as a new policy version.'))
      .mockResolvedValueOnce(statusAt('written', 'Written and confirmed.'))
      .mockResolvedValueOnce(statusAt('live', 'Live on three channels.'))
    setRevenueSource(source)

    const health = useRevenueHealth()
    await health.load()

    const applyPromise = health.applyFinding('f-a1')
    await vi.runAllTimersAsync()
    await applyPromise

    expect(health.applyStateFor('f-a1')).toBe('live')
    expect(health.applyMessageFor('f-a1')).toBe('Live on three channels.')
    // 'live' is terminal, so the finding drops off the open list.
    expect(health.visibleFindings.value.map(f => f.id)).not.toContain('f-a1')
  })

  it('ends on a failure state when the source scripts one', async () => {
    const source = stubSource()
    source.getApplyStatus = vi.fn()
      .mockResolvedValueOnce(statusAt('written', 'Written and confirmed.'))
      .mockResolvedValueOnce({
        applyId: 'apply-1',
        findingId: 'f-a1',
        state: 'push_failed',
        policyVersionId: 'pv-1',
        message: 'The channel manager rejected 14 of 60 room-dates.',
        revertableUntil: null,
      })
    setRevenueSource(source)

    const health = useRevenueHealth()
    await health.load()

    const applyPromise = health.applyFinding('f-a1', 'push_failed')
    await vi.runAllTimersAsync()
    await applyPromise

    expect(health.applyStateFor('f-a1')).toBe('push_failed')
    expect(health.applyMessageFor('f-a1')).toBe('The channel manager rejected 14 of 60 room-dates.')
    // A failure is terminal but not live, so the finding stays visible for retry.
    expect(health.visibleFindings.value.map(f => f.id)).toContain('f-a1')
  })
})
