import type { GateStage, RejectionReason } from '~/components/revenue/data/diagnosis'
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
  diagnosisFor,
  gateStageDomain,
  notAssessableRooms,
  objectiveForContract,
} from '~/components/revenue/data/diagnosis'
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
  /**
   * Which funnel gate is failing. Lets an operator work through every
   * visibility problem in one pass instead of hunting them room by room.
   */
  gate: GateStage | 'all'
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
  { state: 'snapshot', delayMs: 250 },
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
  /** Why a finding was rejected. Adjusts thresholds and ceilings, never a model. */
  const rejections = useState<Record<string, RejectionReason>>('revenue-health-rejections', () => ({}))
  const expanded = useState<string | null>('revenue-health-expanded', () => null)

  const filters = ref<RevenueHealthFilters>({
    search: '',
    domain: 'all',
    minSeverity: 'all',
    gate: 'all',
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
        if (filters.value.gate !== 'all' && diagnosisFor(finding.roomId)?.gate.firstFailing !== filters.value.gate)
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

        const diagnosis = diagnosisFor(room.id)

        /**
         * Worst domain is DERIVED from the gate, not chosen. The first funnel
         * stage that fails is the worst domain — which turns the column from a
         * label into a statement, and stops a price domain being shown for a
         * room that is simply not being clicked.
         */
        const failing = diagnosis?.gate.firstFailing
        const worstDomain = failing ? gateStageDomain[failing] : worst?.domain

        return {
          room,
          findings: roomFindings,
          worst,
          worstDomain,
          counts,
          diagnosis,
          /** Objective follows the owner contract, never a tenant-wide switch. */
          objective: diagnosis ? objectiveForContract(diagnosis.contract) : undefined,
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

  /**
   * Rejecting with a reason. The reason is the point: it is the cheapest
   * product signal we get, and each one adjusts a threshold, a ceiling or a
   * prompt rule. It never trains a model — fitting one operator's taste would
   * cost the reproducibility the measurement depends on.
   */
  function rejectFinding(findingId: string, reason: RejectionReason) {
    rejections.value = { ...rejections.value, [findingId]: reason }
    dismissFinding(findingId)
  }

  function rejectionFor(findingId: string) {
    return rejections.value[findingId]
  }

  function toggleExpanded(roomId: string) {
    expanded.value = expanded.value === roomId ? null : roomId
  }

  /**
   * Rooms a check could not reach. Without this line a portfolio with eight
   * findings reads as healthy while a dozen rooms were never assessed.
   */
  const notAssessable = computed(() => notAssessableRooms)

  function restoreFinding(findingId: string) {
    dismissed.value = dismissed.value.filter(id => id !== findingId)
  }

  function resetFilters() {
    filters.value = { search: '', domain: 'all', minSeverity: 'all', gate: 'all' }
  }

  return {
    basis,
    expanded,
    filters,
    notAssessable,
    rejectFinding,
    rejectionFor,
    toggleExpanded,
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
