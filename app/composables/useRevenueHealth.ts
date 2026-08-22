import type {
  ApplyState,
  HealthDomain,
  HealthFinding,
  HealthRoom,
  HealthSeverity,
  ObjectiveBasis,
} from '~/components/revenue/data/health'
import { computed, ref } from 'vue'
import {
  healthFindings,
  healthRooms,
  healthSummary,
} from '~/components/revenue/data/health'

export type ApplyScenario = 'success' | 'recompute_unavailable' | 'push_failed'

export interface RevenueHealthFilters {
  search: string
  domain: HealthDomain | 'all'
  minSeverity: HealthSeverity | 'all'
}

/** Ranking order for severity — also used to resolve a room's worst finding. */
const SEVERITY_RANK: Record<HealthSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
}

/** Steps the apply pipeline walks through, and how long each takes in the fixture. */
const PIPELINE: { state: ApplyState, delayMs: number }[] = [
  { state: 'saved', delayMs: 350 },
  { state: 'written', delayMs: 900 },
  { state: 'verified', delayMs: 800 },
  { state: 'recomputed', delayMs: 1400 },
  { state: 'live', delayMs: 700 },
]

export function useRevenueHealth() {
  const basis = useState<ObjectiveBasis>('revenue-health-basis', () => 'revenue')
  const findings = useState<HealthFinding[]>('revenue-health-findings', () => [...healthFindings])
  const rooms = useState<HealthRoom[]>('revenue-health-rooms', () => [...healthRooms])
  const applyStates = useState<Record<string, ApplyState>>('revenue-health-apply', () => ({}))
  const dismissed = useState<string[]>('revenue-health-dismissed', () => [])

  const filters = ref<RevenueHealthFilters>({
    search: '',
    domain: 'all',
    minSeverity: 'all',
  })

  const summary = healthSummary

  function getRoom(roomId: string) {
    return rooms.value.find(room => room.id === roomId)
  }

  function getFinding(findingId: string) {
    return findings.value.find(finding => finding.id === findingId)
  }

  /** Money on the active basis. Rendering always states which basis it is. */
  function amountFor(finding: HealthFinding) {
    return finding.money[basis.value].amount
  }

  const openFindings = computed(() =>
    findings.value.filter(finding => !dismissed.value.includes(finding.id) && applyStates.value[finding.id] !== 'live'),
  )

  const visibleFindings = computed(() => {
    const query = filters.value.search.trim().toLowerCase()
    const floor = filters.value.minSeverity === 'all' ? 0 : SEVERITY_RANK[filters.value.minSeverity]

    return openFindings.value
      .filter((finding) => {
        if (filters.value.domain !== 'all' && finding.domain !== filters.value.domain)
          return false
        if (SEVERITY_RANK[finding.severity] < floor)
          return false
        if (!query)
          return true
        const room = getRoom(finding.roomId)
        const haystack = `${finding.headline} ${room?.name ?? ''} ${room?.location ?? ''}`.toLowerCase()
        return haystack.includes(query)
      })
      .sort((a, b) => amountFor(b) - amountFor(a))
  })

  function findingsForRoom(roomId: string) {
    return visibleFindings.value.filter(finding => finding.roomId === roomId)
  }

  /**
   * Rows for the portfolio table. `atStake` is the room's LARGEST single
   * opportunity, never a sum — two findings on the same nights would
   * double-count, and a total nobody can reconstruct destroys the ranking.
   */
  const portfolioRows = computed(() => {
    return rooms.value
      .map((room) => {
        const roomFindings = findingsForRoom(room.id)
        const worst = roomFindings.reduce<HealthFinding | undefined>((acc, finding) => {
          if (!acc)
            return finding
          return SEVERITY_RANK[finding.severity] > SEVERITY_RANK[acc.severity] ? finding : acc
        }, undefined)

        const counts = roomFindings.reduce<Partial<Record<HealthSeverity, number>>>((acc, finding) => {
          acc[finding.severity] = (acc[finding.severity] ?? 0) + 1
          return acc
        }, {})

        return {
          room,
          findings: roomFindings,
          worst,
          counts,
          atStake: roomFindings.reduce((max, finding) => Math.max(max, amountFor(finding)), 0),
        }
      })
      .filter(row => row.findings.length > 0 || row.room.syncState !== 'live')
      .sort((a, b) => b.atStake - a.atStake)
  })

  const stats = computed(() => {
    const list = visibleFindings.value
    const largest = list.reduce<HealthFinding | undefined>((acc, finding) => {
      if (!acc)
        return finding
      return amountFor(finding) > amountFor(acc) ? finding : acc
    }, undefined)

    return {
      largest,
      largestRoom: largest ? getRoom(largest.roomId) : undefined,
      open: list.length,
      critical: list.filter(finding => finding.severity === 'critical').length,
      high: list.filter(finding => finding.severity === 'high').length,
      roomsNeedingAttention: rooms.value.filter(room => room.syncState === 'degraded' || room.syncState === 'paused').length,
    }
  })

  function applyStateFor(findingId: string): ApplyState {
    return applyStates.value[findingId] ?? 'idle'
  }

  function setApplyState(findingId: string, state: ApplyState) {
    applyStates.value = { ...applyStates.value, [findingId]: state }
  }

  /**
   * Walks the pipeline with fixture timings so the states are reviewable.
   * The real flow writes a policy version, hands it to the reconciler, verifies
   * by read-back, then triggers a recompute — see the specification, §15.4.
   */
  function applyFinding(findingId: string, scenario: ApplyScenario = 'success') {
    let elapsed = 0

    for (const step of PIPELINE) {
      elapsed += step.delayMs

      if (scenario === 'recompute_unavailable' && step.state === 'recomputed') {
        setTimeoutSafe(() => setApplyState(findingId, 'recompute_unavailable'), elapsed)
        return
      }
      if (scenario === 'push_failed' && step.state === 'live') {
        setTimeoutSafe(() => setApplyState(findingId, 'push_failed'), elapsed)
        return
      }

      setTimeoutSafe(() => setApplyState(findingId, step.state), elapsed)
    }
  }

  function revertFinding(findingId: string) {
    const next = { ...applyStates.value }
    delete next[findingId]
    applyStates.value = next
  }

  function dismissFinding(findingId: string) {
    if (!dismissed.value.includes(findingId))
      dismissed.value = [...dismissed.value, findingId]
  }

  function restoreFinding(findingId: string) {
    dismissed.value = dismissed.value.filter(id => id !== findingId)
  }

  function resetFilters() {
    filters.value = { search: '', domain: 'all', minSeverity: 'all' }
  }

  return {
    basis,
    filters,
    findings,
    rooms,
    summary,
    openFindings,
    visibleFindings,
    portfolioRows,
    stats,
    dismissed,
    amountFor,
    getRoom,
    getFinding,
    findingsForRoom,
    applyStateFor,
    applyFinding,
    revertFinding,
    dismissFinding,
    restoreFinding,
    resetFilters,
  }
}

/** Timers only run client-side; SSR must not schedule state changes. */
function setTimeoutSafe(fn: () => void, delay: number) {
  if (import.meta.client)
    window.setTimeout(fn, delay)
}
