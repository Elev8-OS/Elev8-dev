import type { NotAssessableRoom, PortfolioSummary } from '~/components/revenue/data/contract'
import type { GateStage, RejectionReason, RoomDiagnosis } from '~/components/revenue/data/diagnosis'
import type {
  ApplyState,
  HealthDomain,
  HealthFinding,
  HealthRoom,
  HealthSeverity,
  ObjectiveBasis,
} from '~/components/revenue/data/health'
import { computed, ref } from 'vue'
import { emptyPortfolioQuery, isTerminalApplyState } from '~/components/revenue/data/contract'
import {
  gateStageDomain,
  objectiveForContract,
} from '~/components/revenue/data/diagnosis'
import { useRevenueSource } from '~/composables/useRevenueSource'

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

/** How often the apply status is polled while it is in flight. */
const APPLY_POLL_MS = 300

export function useRevenueHealth() {
  const basis = useState<ObjectiveBasis>('revenue-health-basis', () => 'revenue')
  const findings = useState<HealthFinding[]>('revenue-health-findings', () => [])
  const rooms = useState<HealthRoom[]>('revenue-health-rooms', () => [])
  const diagnoses = useState<Record<string, RoomDiagnosis | null>>('revenue-health-diagnoses', () => ({}))
  const notAssessable = useState<NotAssessableRoom[]>('revenue-health-not-assessable', () => [])
  const summary = useState<PortfolioSummary | null>('revenue-health-summary', () => null)
  const isLoading = useState<boolean>('revenue-health-loading', () => false)
  /** False until the first `load()` settles, success or failure. */
  const hasLoaded = useState<boolean>('revenue-health-has-loaded', () => false)
  const loadError = useState<string | null>('revenue-health-error', () => null)
  const applyStates = useState<Record<string, ApplyState>>('revenue-health-apply', () => ({}))
  /** applyId returned by the source for the finding's current (or last) apply. */
  const applyIds = useState<Record<string, string>>('revenue-health-apply-ids', () => ({}))
  /** Plain-language sentence from the polled ApplyStatus, for ApplyPipeline to render verbatim. */
  const applyMessages = useState<Record<string, string | null>>('revenue-health-apply-messages', () => ({}))
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

  const source = useRevenueSource()

  /**
   * Fills the store from the source. Safe to call repeatedly; the page calls it
   * on mount and the Re-check button calls it again.
   */
  async function load() {
    isLoading.value = true
    loadError.value = null
    try {
      const res = await source.getPortfolio({ ...emptyPortfolioQuery(), basis: basis.value })
      rooms.value = res.rooms
      findings.value = res.findings
      notAssessable.value = res.notAssessable
      summary.value = res.summary

      // Diagnoses are per room and the portfolio shows at most one open at a
      // time, so fetch them together rather than on every expand.
      const entries = await Promise.all(
        res.rooms.map(async room => [room.id, await source.getRoomDiagnosis(room.id)] as const),
      )
      diagnoses.value = Object.fromEntries(entries)
    }
    catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Could not load listing health.'
    }
    finally {
      isLoading.value = false
      hasLoaded.value = true
    }
  }

  async function recheck() {
    try {
      await source.recheck({})
    }
    catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Could not re-check the portfolio.'
      return
    }
    await load()
  }

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
        if (filters.value.gate !== 'all' && diagnoses.value[finding.roomId]?.gate.firstFailing !== filters.value.gate)
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

        const diagnosis = diagnoses.value[room.id] ?? undefined

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

  function setApplyMessage(findingId: string, message: string | null) {
    applyMessages.value = { ...applyMessages.value, [findingId]: message }
  }

  function applyMessageFor(findingId: string): string | null {
    return applyMessages.value[findingId] ?? null
  }

  /**
   * Polls `getApplyStatus` until it reaches a terminal state, writing each
   * state (and its message) into local state as it goes so the UI updates the
   * same way it did with the fixture timings.
   *
   * Not SSR-guarded: it only ever runs after `applyFinding`, which itself
   * only ever runs from a client click handler, so there is no server-side
   * path into this function to guard against.
   *
   * Guards against a superseded apply: if `applyIds` no longer points at this
   * `applyId` (a newer apply started for the same finding), the loop stops
   * rather than clobbering the newer poll's state.
   */
  async function pollApplyStatus(findingId: string, applyId: string) {
    while (true) {
      if (applyIds.value[findingId] !== applyId)
        return

      let status
      try {
        status = await source.getApplyStatus(applyId)
      }
      catch (error) {
        loadError.value = error instanceof Error ? error.message : 'Could not check the apply status.'
        return
      }

      setApplyState(findingId, status.state)
      setApplyMessage(findingId, status.message)

      if (isTerminalApplyState(status.state))
        return

      await new Promise<void>(resolve => setTimeout(resolve, APPLY_POLL_MS))
    }
  }

  /**
   * Writes the apply through the port: POST accepts and returns an applyId,
   * then the client polls `getApplyStatus` until a terminal state (spec
   * §15.4). `scenario` is a mock-only affordance the real backend ignores —
   * see `ApplyRequest` in contract.ts.
   */
  async function applyFinding(findingId: string, scenario: ApplyScenario = 'success') {
    try {
      const accepted = await source.applyFinding({ findingId, basis: basis.value, scenario })
      applyIds.value = { ...applyIds.value, [findingId]: accepted.applyId }
      setApplyState(findingId, accepted.state)
      await pollApplyStatus(findingId, accepted.applyId)
    }
    catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Could not apply that finding.'
    }
  }

  async function revertFinding(findingId: string) {
    const applyId = applyIds.value[findingId]

    try {
      if (applyId)
        await source.revertApply(applyId)
    }
    catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Could not revert that finding.'
      return
    }

    const nextStates = { ...applyStates.value }
    delete nextStates[findingId]
    applyStates.value = nextStates

    const nextIds = { ...applyIds.value }
    delete nextIds[findingId]
    applyIds.value = nextIds

    const nextMessages = { ...applyMessages.value }
    delete nextMessages[findingId]
    applyMessages.value = nextMessages
  }

  async function dismissFinding(findingId: string, reason?: RejectionReason) {
    const previousRejections = rejections.value
    const previousDismissed = dismissed.value

    if (reason)
      rejections.value = { ...rejections.value, [findingId]: reason }
    if (!dismissed.value.includes(findingId))
      dismissed.value = [...dismissed.value, findingId]

    try {
      await source.dismissFinding({ findingId, reason: reason ?? 'not_now' })
    }
    catch (error) {
      // Put the finding back. Leaving it hidden would show a clean portfolio
      // built on a write the server rejected.
      rejections.value = previousRejections
      dismissed.value = previousDismissed
      loadError.value = error instanceof Error ? error.message : 'Could not dismiss that finding.'
    }
  }

  /**
   * Rejecting with a reason. The reason is the point: it is the cheapest
   * product signal we get, and each one adjusts a threshold, a ceiling or a
   * prompt rule. It never trains a model — fitting one operator's taste would
   * cost the reproducibility the measurement depends on.
   */
  async function rejectFinding(findingId: string, reason: RejectionReason) {
    await dismissFinding(findingId, reason)
  }

  function rejectionFor(findingId: string) {
    return rejections.value[findingId]
  }

  function toggleExpanded(roomId: string) {
    expanded.value = expanded.value === roomId ? null : roomId
  }

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
    load,
    recheck,
    isLoading,
    hasLoaded,
    loadError,
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
    applyMessageFor,
    applyFinding,
    revertFinding,
    dismissFinding,
    restoreFinding,
    resetFilters,
  }
}
