/**
 * The wire contract for the Listing Health surfaces.
 *
 * Framework-free on purpose: this is the file a backend engineer reads to
 * learn what each screen needs, so it must not require knowing Vue. Domain
 * objects (HealthFinding, HealthRoom, RoomDiagnosis) keep living in
 * health.ts and diagnosis.ts and are re-exported from here.
 */
import type { GateStage, RejectionReason, RoomDiagnosis } from './diagnosis'
import type {
  ApplyState,
  HealthDomain,
  HealthFinding,
  HealthRoom,
  HealthSeverity,
  ObjectiveBasis,
} from './health'

/**
 * The six steps an apply walks, in order. Index is progress.
 *
 * `snapshot` is first and is not bookkeeping: it captures the prior state of
 * every field the write touches, which is both the undo and the baseline the
 * outcome is later measured against (spec §15.4).
 */
export const APPLY_PIPELINE = [
  'snapshot',
  'saved',
  'written',
  'verified',
  'recomputed',
  'live',
] as const

export type ApplyPipelineStep = typeof APPLY_PIPELINE[number]

/**
 * Which step each failure belongs to. A failure marks the step that actually
 * failed rather than the last one reached, so the strip stays readable.
 * `stale` is spec §15.4 step 1: signals went stale during re-validation, so
 * nothing past the snapshot ran.
 */
const FAILED_AT: Partial<Record<ApplyState, number>> = {
  stale: 0,
  recompute_unavailable: 4,
  push_failed: 5,
}

export function applyStepIndex(state: ApplyState): number {
  const index = (APPLY_PIPELINE as readonly string[]).indexOf(state)
  return index
}

export function failedStepIndex(state: ApplyState): number | null {
  return FAILED_AT[state] ?? null
}

export function isTerminalApplyState(state: ApplyState): boolean {
  return state === 'live' || failedStepIndex(state) !== null
}

export type {
  GateStage,
  HealthDomain,
  HealthFinding,
  HealthRoom,
  HealthSeverity,
  ObjectiveBasis,
  RejectionReason,
  RoomDiagnosis,
}

/* ---------------------------------------------------------------- portfolio */

export interface PortfolioQuery {
  basis: ObjectiveBasis
  search: string
  domain: HealthDomain | 'all'
  minSeverity: HealthSeverity | 'all'
  /**
   * Which funnel gate is failing. Not in spec §15.2; kept because it lets an
   * operator clear every visibility problem in one pass.
   */
  gate: GateStage | 'all'
}

export function emptyPortfolioQuery(): PortfolioQuery {
  return { basis: 'revenue', search: '', domain: 'all', minSeverity: 'all', gate: 'all' }
}

export interface PortfolioSummary {
  /** ISO 8601. The UI formats it; the API must not send a pre-formatted string. */
  lastCheckedAt: string
  appliedThisWeek: number
  appliedAutomatically: number
  upliftPercent: number
  upliftRoomsMeasured: number
  roomsTotal: number
  /** Spec §15.8: drives the portfolio-wide banner. 0 means no banner. */
  degradedRoomCount: number
}

/** A room a check could not reach. Named, never silently dropped (spec §11). */
export interface NotAssessableRoom {
  roomId: string
  name: string
  /** Plain language, shown verbatim. e.g. "comp-set not resolved". */
  missing: string
}

export interface PortfolioResponse {
  rooms: HealthRoom[]
  findings: HealthFinding[]
  summary: PortfolioSummary
  notAssessable: NotAssessableRoom[]
}

/* -------------------------------------------------------------------- apply */

export interface ApplyRequest {
  findingId: string
  /**
   * Spec §15.3 item 8, partial acceptance. Each entry is a `FieldChange.label`
   * from the finding. Omit or leave empty to apply every changed field.
   */
  fieldLabels?: string[]
  basis: ObjectiveBasis
  /**
   * Mock-only affordance. Picks which scripted ending `mock-source.ts` walks
   * this one apply to, overriding the source's constructor-level default. A
   * real backend has no notion of "scenario" and must ignore this field.
   */
  scenario?: 'success' | 'recompute_unavailable' | 'push_failed' | 'stale'
}

/**
 * Apply is long-running: six steps, each of which can fail. The POST returns
 * immediately with an id, and the client polls `getApplyStatus`. A backend that
 * blocks until `live` will time out behind any proxy.
 */
export interface ApplyAccepted {
  applyId: string
  state: ApplyState
}

export interface ApplyStatus {
  applyId: string
  findingId: string
  state: ApplyState
  /** Written at `saved`. Null before that. What a revert restores. */
  policyVersionId: string | null
  /** Plain-language sentence for the current state. Null when there is nothing to say. */
  message: string | null
  /** ISO 8601. Null unless state is `live`. */
  revertableUntil: string | null
}

/* ------------------------------------------------------------------ dismiss */

export interface DismissRequest {
  findingId: string
  reason: RejectionReason
  /** Spec §11.5: a dismissal suppresses the check for a duration. */
  suppressForDays?: number
}

/* ------------------------------------------------------------------ recheck */

export interface RecheckRequest {
  /** Omit for the whole portfolio. */
  roomId?: string
}

export interface RecheckAccepted {
  startedAt: string
  roomsQueued: number
}

/* --------------------------------------------------------------------- port */

/**
 * Every Listing Health screen reads through this. Implement it once against
 * the real API and the UI needs no change.
 */
export interface RevenueDataSource {
  getPortfolio: (query: PortfolioQuery) => Promise<PortfolioResponse>
  getRoomDiagnosis: (roomId: string) => Promise<RoomDiagnosis | null>
  getFinding: (findingId: string) => Promise<HealthFinding | null>
  applyFinding: (req: ApplyRequest) => Promise<ApplyAccepted>
  getApplyStatus: (applyId: string) => Promise<ApplyStatus>
  revertApply: (applyId: string) => Promise<void>
  dismissFinding: (req: DismissRequest) => Promise<void>
  recheck: (req: RecheckRequest) => Promise<RecheckAccepted>
}

/**
 * One entry per port method, kept next to the interface so a renamed path is
 * at least visible in the same diff. Nothing generates the doc from this map;
 * a test (`tests/lib/revenue-contract.spec.ts`) pins it against a literal
 * instead.
 */
export const REVENUE_ENDPOINTS: Record<keyof RevenueDataSource, string> = {
  getPortfolio: 'GET /api/revenue/portfolio',
  getRoomDiagnosis: 'GET /api/revenue/rooms/:roomId/diagnosis',
  getFinding: 'GET /api/revenue/findings/:findingId',
  applyFinding: 'POST /api/revenue/findings/:findingId/apply',
  getApplyStatus: 'GET /api/revenue/applies/:applyId',
  revertApply: 'POST /api/revenue/applies/:applyId/revert',
  dismissFinding: 'POST /api/revenue/findings/:findingId/dismiss',
  recheck: 'POST /api/revenue/recheck',
}
