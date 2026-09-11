/**
 * The wire contract for the Listing Health surfaces.
 *
 * Framework-free on purpose: this is the file a backend engineer reads to
 * learn what each screen needs, so it must not require knowing Vue. Domain
 * objects (HealthFinding, HealthRoom, RoomDiagnosis) keep living in
 * health.ts and diagnosis.ts and are re-exported from here.
 */
import type { ApplyState } from './health'

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
