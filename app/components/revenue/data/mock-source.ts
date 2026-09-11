/**
 * The mock adapter. Reads the fixtures and adds the latency and the scripted
 * pipeline that make the states reviewable.
 *
 * Everything a real backend would own lives here rather than in the
 * composable, so swapping to `http-source.ts` changes one line and no screen.
 */
import type {
  ApplyAccepted,
  ApplyRequest,
  ApplyStatus,
  DismissRequest,
  HealthFinding,
  PortfolioQuery,
  PortfolioResponse,
  RecheckAccepted,
  RecheckRequest,
  RevenueDataSource,
  RoomDiagnosis,
} from './contract'
import type { ApplyState } from './health'
import { diagnosisFor, notAssessableRooms } from './diagnosis'
import { healthFindings, healthRooms, healthSummary } from './health'

export type MockApplyScenario = 'success' | 'recompute_unavailable' | 'push_failed' | 'stale'

export interface MockSourceOptions {
  /** Which ending the scripted pipeline takes. Default `success`. */
  scenario?: MockApplyScenario
  /** Multiplier on every delay. 0 makes the source synchronous, for tests. */
  speed?: number
}

/** Each step and how long it takes before the next one lands. */
const SCRIPT: { state: ApplyState, delayMs: number }[] = [
  { state: 'snapshot', delayMs: 250 },
  { state: 'saved', delayMs: 350 },
  { state: 'written', delayMs: 900 },
  { state: 'verified', delayMs: 800 },
  { state: 'recomputed', delayMs: 1400 },
  { state: 'live', delayMs: 700 },
]

const MESSAGES: Partial<Record<ApplyState, string>> = {
  snapshot: 'Prior state captured for every field this change touches. That snapshot is what a revert restores and what the outcome is measured against.',
  saved: 'Saved as a new policy version. Nothing is live yet.',
  written: 'Your settings are in place and confirmed. The new nightly prices are being computed now.',
  verified: 'Your settings are in place and confirmed. The new nightly prices are being computed now.',
  recomputed: 'New prices received. Pushing to the channels.',
  live: 'Live on three channels. Outcome measurement is scheduled.',
  recompute_unavailable: 'Your settings are live; the new prices are not yet. The pricing engine could not recalculate on demand, so prices will update on the normal daily cycle. Any curve shown until then is Elev8\'s own estimate.',
  push_failed: 'Guests are still seeing the old price on 14 dates. The channel manager rejected 14 of 60 room-dates. Retrying automatically and escalated to the team.',
  stale: 'The signals behind this finding went stale while it sat open. Nothing was written. Re-check the room and read the new numbers before applying.',
}

/** Deep copy, so a caller mutating a response cannot reach the fixtures. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface ApplyRecord {
  applyId: string
  findingId: string
  state: ApplyState
  policyVersionId: string | null
  message: string | null
  revertableUntil: string | null
  fieldLabels: string[]
}

export function createMockRevenueSource(options: MockSourceOptions = {}): RevenueDataSource {
  const scenario = options.scenario ?? 'success'
  const speed = options.speed ?? 1
  const applies = new Map<string, ApplyRecord>()
  let counter = 0

  const delay = (ms: number) => wait(ms * speed)

  function runScript(record: ApplyRecord) {
    let elapsed = 0

    for (const step of SCRIPT) {
      elapsed += step.delayMs * speed

      // A stale re-validation fails before anything is written (spec §15.4 step 1).
      if (scenario === 'stale' && step.state === 'saved') {
        setTimeout(() => finish(record, 'stale'), elapsed)
        return
      }
      if (scenario === 'recompute_unavailable' && step.state === 'recomputed') {
        setTimeout(() => finish(record, 'recompute_unavailable'), elapsed)
        return
      }
      if (scenario === 'push_failed' && step.state === 'live') {
        setTimeout(() => finish(record, 'push_failed'), elapsed)
        return
      }

      const state = step.state
      setTimeout(() => advance(record, state), elapsed)
    }
  }

  function advance(record: ApplyRecord, state: ApplyState) {
    record.state = state
    record.message = MESSAGES[state] ?? null

    if (state === 'saved')
      record.policyVersionId = `pv-${record.applyId.replace('apply-', '')}`

    if (state === 'live') {
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      record.revertableUntil = until.toISOString()
      if (record.fieldLabels.length)
        record.message = `${MESSAGES.live} Applied: ${record.fieldLabels.join(', ')}.`
    }
  }

  function finish(record: ApplyRecord, state: ApplyState) {
    record.state = state
    record.message = MESSAGES[state] ?? null
    record.revertableUntil = null
  }

  return {
    async getPortfolio(_query: PortfolioQuery): Promise<PortfolioResponse> {
      await delay(120)
      const rooms = clone(healthRooms)
      return {
        rooms,
        findings: clone(healthFindings),
        notAssessable: clone(notAssessableRooms),
        summary: {
          lastCheckedAt: new Date().toISOString(),
          appliedThisWeek: healthSummary.appliedThisWeek,
          appliedAutomatically: healthSummary.appliedAutomatically,
          upliftPercent: healthSummary.upliftPercent,
          upliftRoomsMeasured: healthSummary.upliftRoomsMeasured,
          roomsTotal: healthSummary.roomsTotal,
          degradedRoomCount: rooms.filter(room => room.syncState === 'degraded').length,
        },
      }
    },

    async getRoomDiagnosis(roomId: string): Promise<RoomDiagnosis | null> {
      await delay(80)
      const found = diagnosisFor(roomId)
      return found ? clone(found) : null
    },

    async getFinding(findingId: string): Promise<HealthFinding | null> {
      await delay(80)
      const found = healthFindings.find(finding => finding.id === findingId)
      return found ? clone(found) : null
    },

    async applyFinding(req: ApplyRequest): Promise<ApplyAccepted> {
      await delay(60)
      counter += 1
      const record: ApplyRecord = {
        applyId: `apply-${counter}`,
        findingId: req.findingId,
        state: 'snapshot',
        policyVersionId: null,
        message: MESSAGES.snapshot ?? null,
        revertableUntil: null,
        fieldLabels: req.fieldLabels ?? [],
      }
      applies.set(record.applyId, record)
      runScript(record)
      return { applyId: record.applyId, state: record.state }
    },

    async getApplyStatus(applyId: string): Promise<ApplyStatus> {
      await delay(30)
      const record = applies.get(applyId)
      if (!record)
        throw new Error(`Unknown apply: ${applyId}`)
      return clone(record)
    },

    async revertApply(applyId: string): Promise<void> {
      await delay(200)
      const record = applies.get(applyId)
      if (!record)
        throw new Error(`Unknown apply: ${applyId}`)
      applies.delete(applyId)
    },

    async dismissFinding(_req: DismissRequest): Promise<void> {
      await delay(80)
    },

    async recheck(req: RecheckRequest): Promise<RecheckAccepted> {
      await delay(400)
      return {
        startedAt: new Date().toISOString(),
        roomsQueued: req.roomId ? 1 : healthRooms.length,
      }
    },
  }
}
