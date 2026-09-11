# Revenue Data Contract and Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every Listing Health screen behind one typed data source, so a backend engineer can implement the real Revenue Engine API against a compiler-checked contract instead of reading Vue components.

**Architecture:** A framework-free `contract.ts` declares the request and response types plus the `RevenueDataSource` port. Two adapters implement it: `mock-source.ts` reads today's fixtures, `http-source.ts` calls real endpoints and ships as a stub. `useRevenueSource()` picks one. `useRevenueHealth` stops importing fixtures directly and reads through the port. Nothing on screen changes; the seam and the tests are the deliverable. This mirrors the `RmProvider` port pattern the spec already uses for pricing providers (spec §5).

**Tech Stack:** Nuxt 3, Vue 3 composition API, TypeScript, Vitest + jsdom, `@vue/test-utils`.

---

## Scope check: this is plan 1 of 6

The request was "implement everything missing", which spans five independent subsystems. Each needs its own plan, because each produces working, testable software on its own and they have a real dependency order. Do not attempt them as one plan.

| # | Plan | Covers | Depends on |
| --- | --- | --- | --- |
| **1** | **Revenue data contract and seam** (this document) | Typed port, mock and HTTP adapters, first tests, endpoint map | — |
| 2 | Pricing policy model and cost model | PP-457 core: full §6.2 policy surface, versioning, cost model with estimated/confirmed, consent field | 1 |
| 3 | Settings surfaces | PP-457 UI: Room→Revenue tab §15.5, 90-day preview, all of §15.7, drift escalation | 2 |
| 4 | Resolver and pipeline surfaces | PP-456: resolution-trace viewer, NextPax push state, portfolio degraded banner | 1 |
| 5 | Cockpit | PP-458 §15.6: resolved price, source badge, trace tooltip, inline and bulk override, date locks, capability-driven channel markup | 2, 4 |
| 6 | Health engine completion | PP-459 remainder: partial acceptance, impact panel §15.9, arbitration card, suppression, cannibalisation, attribution, shadow mode, autonomy config | 1, 2 |

Handoff note from the final review: `app/composables/usePriceLabs.ts` still imports `healthRooms` directly from the fixtures to build a room picker, so the seam has one hole left that a later plan should close.

Excluded throughout, with reasons: **PP-460** tenant-visible benchmark surfaces, because spec §24 requires legal clearance before any figure reaches a tenant surface — only the consent field is built, in plan 2. **PP-461**, because a second provider adapter needs a commercial account and the port it proves is backend, with no §15 surface.

This plan is first because every later plan adds a screen that needs data, and without the seam each one would hard-code another fixture import.

---

## File structure

**Create:**

| File | Responsibility |
| --- | --- |
| `app/components/revenue/data/contract.ts` | Framework-free. Pipeline ordering helpers, request and response types, the `RevenueDataSource` port. The single source of truth a backend engineer reads. |
| `app/components/revenue/data/mock-source.ts` | Implements the port over the existing fixtures. Owns the fake latency and the scripted apply pipeline. |
| `app/components/revenue/data/http-source.ts` | Implements the port with `$fetch` against the documented paths. Ships unused. |
| `app/composables/useRevenueSource.ts` | Chooses the adapter and exposes it. One line to switch. |
| `tests/lib/revenue-contract.spec.ts` | Pipeline helpers. Pure, no Vue. |
| `tests/lib/revenue-mock-source.spec.ts` | The mock adapter answers the port correctly. |
| `tests/composables/useRevenueHealth.spec.ts` | The composable's ranking and filtering rules, through the port. |
| `docs/superpowers/specs/2026-09-11-revenue-api-contract.md` | Endpoint map for the backend engineer. Attach to PP-459. |

**Modify:**

| File | Change |
| --- | --- |
| `app/composables/useRevenueHealth.ts` | Read through the port instead of importing `healthFindings` / `healthRooms`. |
| `app/components/revenue/ApplyPipeline.vue:12-37` | Delete the local `STEPS`, `ORDER` and `failedAt` and import the shared helpers. |

**Why `contract.ts` is separate from `health.ts`:** `health.ts` is 20 KB of fixture data with types mixed in. A backend engineer should not have to read 400 lines of Bali villa fixtures to find the payload shape. Types that describe the wire go in `contract.ts`; types that describe a domain object stay in `health.ts` and are re-exported.

---

## Task 1: Pipeline ordering helpers

The apply pipeline's step order and failure-position logic live inside `ApplyPipeline.vue` today, so nothing can test them and the contract cannot reference them. Extract first.

**Files:**
- Create: `app/components/revenue/data/contract.ts`
- Test: `tests/lib/revenue-contract.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/revenue-contract.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  APPLY_PIPELINE,
  applyStepIndex,
  failedStepIndex,
  isTerminalApplyState,
} from '~/components/revenue/data/contract'

describe('apply pipeline order', () => {
  it('runs snapshot first, because it is the undo and the measurement baseline', () => {
    expect(APPLY_PIPELINE[0]).toBe('snapshot')
    expect(APPLY_PIPELINE).toEqual([
      'snapshot', 'saved', 'written', 'verified', 'recomputed', 'live',
    ])
  })

  it('reports progress as an index, and -1 before anything starts', () => {
    expect(applyStepIndex('idle')).toBe(-1)
    expect(applyStepIndex('snapshot')).toBe(0)
    expect(applyStepIndex('live')).toBe(5)
  })

  it('places a failure at the step that failed, not the last one reached', () => {
    // The recompute could not run, so 'recomputed' (index 4) is the failed step.
    expect(failedStepIndex('recompute_unavailable')).toBe(4)
    // The channel manager rejected the push, so 'live' (index 5) failed.
    expect(failedStepIndex('push_failed')).toBe(5)
    // Signals went stale before the write, so nothing past 'snapshot' ran.
    expect(failedStepIndex('stale')).toBe(0)
    expect(failedStepIndex('live')).toBeNull()
    expect(failedStepIndex('idle')).toBeNull()
  })

  it('treats live and every failure as terminal, and progress states as not', () => {
    expect(isTerminalApplyState('live')).toBe(true)
    expect(isTerminalApplyState('push_failed')).toBe(true)
    expect(isTerminalApplyState('recompute_unavailable')).toBe(true)
    expect(isTerminalApplyState('stale')).toBe(true)
    expect(isTerminalApplyState('written')).toBe(false)
    expect(isTerminalApplyState('idle')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/revenue-contract.spec.ts`

Expected: FAIL. `Failed to resolve import "~/components/revenue/data/contract"`.

- [ ] **Step 3: Write the minimal implementation**

Create `app/components/revenue/data/contract.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/revenue-contract.spec.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/revenue/data/contract.ts tests/lib/revenue-contract.spec.ts
git commit -m "feat(revenue): extract the apply pipeline order into a testable contract"
```

---

## Task 2: The port and its payload types

**Files:**
- Modify: `app/components/revenue/data/contract.ts`
- Test: `tests/lib/revenue-contract.spec.ts`

- [ ] **Step 1: Write the failing test**

Extend the existing import at the top of `tests/lib/revenue-contract.spec.ts` so it reads:

```ts
import {
  APPLY_PIPELINE,
  applyStepIndex,
  emptyPortfolioQuery,
  failedStepIndex,
  isTerminalApplyState,
  REVENUE_ENDPOINTS,
} from '~/components/revenue/data/contract'
```

Then append these two blocks to the same file:

```ts
describe('contract defaults', () => {
  it('defaults a portfolio query to revenue basis with no filters applied', () => {
    expect(emptyPortfolioQuery()).toEqual({
      basis: 'revenue',
      search: '',
      domain: 'all',
      minSeverity: 'all',
      gate: 'all',
    })
  })

  it('names one endpoint per port method, so the doc and the code cannot drift', () => {
    expect(REVENUE_ENDPOINTS).toEqual({
      getPortfolio: 'GET /api/revenue/portfolio',
      getRoomDiagnosis: 'GET /api/revenue/rooms/:roomId/diagnosis',
      getFinding: 'GET /api/revenue/findings/:findingId',
      applyFinding: 'POST /api/revenue/findings/:findingId/apply',
      getApplyStatus: 'GET /api/revenue/applies/:applyId',
      revertApply: 'POST /api/revenue/applies/:applyId/revert',
      dismissFinding: 'POST /api/revenue/findings/:findingId/dismiss',
      recheck: 'POST /api/revenue/recheck',
    })
  })
})
```

Do not add a second `import { describe, expect, it } from 'vitest'` — the file already has one.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/revenue-contract.spec.ts`

Expected: FAIL. `REVENUE_ENDPOINTS is not exported`.

- [ ] **Step 3: Write the minimal implementation**

Append to `app/components/revenue/data/contract.ts`:

```ts
import type { GateStage, RejectionReason, RoomDiagnosis } from './diagnosis'
import type {
  HealthDomain,
  HealthFinding,
  HealthRoom,
  HealthSeverity,
  ObjectiveBasis,
} from './health'

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
  /** Which funnel gate is failing. Not in spec §15.2; kept because it lets an
   *  operator clear every visibility problem in one pass. */
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
 * One entry per port method. The endpoint doc is generated from this, so a
 * renamed path cannot leave the doc stale.
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/revenue-contract.spec.ts`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/revenue/data/contract.ts tests/lib/revenue-contract.spec.ts
git commit -m "feat(revenue): declare the data-source port and its payload types"
```

---

## Task 3: Mock adapter

**Files:**
- Create: `app/components/revenue/data/mock-source.ts`
- Test: `tests/lib/revenue-mock-source.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/revenue-mock-source.spec.ts`:

```ts
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
      basis: 'revenue', search: '', domain: 'all', minSeverity: 'all', gate: 'all',
    }))

    expect(res.rooms.length).toBeGreaterThan(0)
    expect(res.findings.length).toBeGreaterThan(0)
    expect(res.notAssessable.length).toBeGreaterThan(0)
    expect(res.summary.lastCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('counts degraded rooms so the portfolio banner has a number to show', async () => {
    const source = createMockRevenueSource()
    const res = await settle(source.getPortfolio({
      basis: 'revenue', search: '', domain: 'all', minSeverity: 'all', gate: 'all',
    }))
    const degraded = res.rooms.filter(r => r.syncState === 'degraded').length
    expect(res.summary.degradedRoomCount).toBe(degraded)
  })

  it('hands back a copy, so a caller mutating the result cannot corrupt the fixtures', async () => {
    const source = createMockRevenueSource()
    const first = await settle(source.getPortfolio({
      basis: 'revenue', search: '', domain: 'all', minSeverity: 'all', gate: 'all',
    }))
    first.rooms[0]!.name = 'MUTATED'

    const second = await settle(source.getPortfolio({
      basis: 'revenue', search: '', domain: 'all', minSeverity: 'all', gate: 'all',
    }))
    expect(second.rooms[0]!.name).not.toBe('MUTATED')
  })
})

describe('mock source — apply', () => {
  it('accepts an apply immediately and reports snapshot first', async () => {
    const source = createMockRevenueSource()
    const accepted = await settle(source.applyFinding({ findingId: 'finding-1', basis: 'revenue' }))
    expect(accepted.applyId).toMatch(/^apply-/)
    expect(accepted.state).toBe('snapshot')
  })

  it('walks to live and only then offers a revert window', async () => {
    const source = createMockRevenueSource()
    const { applyId } = await settle(source.applyFinding({ findingId: 'finding-1', basis: 'revenue' }))

    await vi.advanceTimersByTimeAsync(10_000)
    const status = await settle(source.getApplyStatus(applyId))

    expect(status.state).toBe('live')
    expect(status.policyVersionId).not.toBeNull()
    expect(status.revertableUntil).not.toBeNull()
  })

  it('records which fields a partial acceptance asked for', async () => {
    const source = createMockRevenueSource()
    const { applyId } = await settle(source.applyFinding({
      findingId: 'finding-1', basis: 'revenue', fieldLabels: ['Base price'],
    }))
    await vi.advanceTimersByTimeAsync(10_000)
    const status = await settle(source.getApplyStatus(applyId))
    expect(status.message).toContain('Base price')
  })

  it('throws for an unknown applyId rather than inventing a status', async () => {
    const source = createMockRevenueSource()
    await expect(settle(source.getApplyStatus('apply-nope'))).rejects.toThrow(/unknown apply/i)
  })
})

describe('mock source — scripted failures', () => {
  it('stops at recompute_unavailable when told to', async () => {
    const source = createMockRevenueSource({ scenario: 'recompute_unavailable' })
    const { applyId } = await settle(source.applyFinding({ findingId: 'finding-1', basis: 'revenue' }))
    await vi.advanceTimersByTimeAsync(10_000)
    const status = await settle(source.getApplyStatus(applyId))
    expect(status.state).toBe('recompute_unavailable')
    expect(status.revertableUntil).toBeNull()
  })

  it('stops at push_failed when told to', async () => {
    const source = createMockRevenueSource({ scenario: 'push_failed' })
    const { applyId } = await settle(source.applyFinding({ findingId: 'finding-1', basis: 'revenue' }))
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/revenue-mock-source.spec.ts`

Expected: FAIL. `Failed to resolve import "~/components/revenue/data/mock-source"`.

- [ ] **Step 3: Write the minimal implementation**

Create `app/components/revenue/data/mock-source.ts`:

```ts
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
      return { ...record }
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/revenue-mock-source.spec.ts`

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/revenue/data/mock-source.ts tests/lib/revenue-mock-source.spec.ts
git commit -m "feat(revenue): mock adapter implementing the data-source port"
```

---

## Task 4: The source composable

**Files:**
- Create: `app/composables/useRevenueSource.ts`

No test of its own: it is three lines of selection, and Task 5 exercises it through the composable that uses it.

- [ ] **Step 1: Write the implementation**

Create `app/composables/useRevenueSource.ts`:

```ts
/**
 * Picks the Listing Health data source.
 *
 * Swapping the prototype onto the real API is one line here. Keep it that way:
 * no screen and no other composable may import an adapter directly.
 */
import type { RevenueDataSource } from '~/components/revenue/data/contract'
import { createMockRevenueSource } from '~/components/revenue/data/mock-source'

let override: RevenueDataSource | null = null

/** Tests inject a source here. Production never calls this. */
export function setRevenueSource(source: RevenueDataSource | null) {
  override = source
}

export function useRevenueSource(): RevenueDataSource {
  if (override)
    return override

  // Swap for `createHttpRevenueSource()` when the endpoints in
  // REVENUE_ENDPOINTS exist.
  return createMockRevenueSource()
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx vue-tsc --noEmit -p tsconfig.json 2>&1 | grep -i revenue || echo "no revenue type errors"`

Expected: `no revenue type errors`.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useRevenueSource.ts
git commit -m "feat(revenue): one place that chooses the data source"
```

---

## Task 5: Read the composable through the port

`useRevenueHealth` currently imports `healthFindings` and `healthRooms` at module scope. Move it to the port, keeping every computed rule byte-identical, and pin those rules with the tests the module has never had.

**Files:**
- Modify: `app/composables/useRevenueHealth.ts`
- Test: `tests/composables/useRevenueHealth.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/composables/useRevenueHealth.spec.ts`:

```ts
import type { RevenueDataSource } from '~/components/revenue/data/contract'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setRevenueSource } from '~/composables/useRevenueSource'
import { useRevenueHealth } from '~/composables/useRevenueHealth'

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
    getRoomDiagnosis: async () => null,
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/composables/useRevenueHealth.spec.ts`

Expected: FAIL. `health.load is not a function`.

- [ ] **Step 3: Rewrite the composable's data access**

In `app/composables/useRevenueHealth.ts`, replace the fixture imports and the two `useState` seeds.

Delete these imports:

```ts
import {
  healthFindings,
  healthRooms,
  healthSummary,
} from '~/components/revenue/data/health'
import {
  diagnosisFor,
  gateStageDomain,
  notAssessableRooms,
  objectiveForContract,
} from '~/components/revenue/data/diagnosis'
```

Replace with:

```ts
import type { NotAssessableRoom, PortfolioSummary } from '~/components/revenue/data/contract'
import {
  gateStageDomain,
  objectiveForContract,
} from '~/components/revenue/data/diagnosis'
import { useRevenueSource } from '~/composables/useRevenueSource'
```

Replace the seeded state:

```ts
const findings = useState<HealthFinding[]>('revenue-health-findings', () => [...healthFindings])
const rooms = useState<HealthRoom[]>('revenue-health-rooms', () => [...healthRooms])
```

with empty state plus a loader:

```ts
const findings = useState<HealthFinding[]>('revenue-health-findings', () => [])
const rooms = useState<HealthRoom[]>('revenue-health-rooms', () => [])
const diagnoses = useState<Record<string, RoomDiagnosis | null>>('revenue-health-diagnoses', () => ({}))
const notAssessable = useState<NotAssessableRoom[]>('revenue-health-not-assessable', () => [])
const summary = useState<PortfolioSummary | null>('revenue-health-summary', () => null)
const isLoading = useState<boolean>('revenue-health-loading', () => false)
const loadError = useState<string | null>('revenue-health-error', () => null)

const source = useRevenueSource()

/**
 * Fills the store from the source. Safe to call repeatedly; the page calls it
 * on mount and the Re-check button calls it again.
 */
async function load() {
  isLoading.value = true
  loadError.value = null
  try {
    const res = await source.getPortfolio({
      basis: basis.value,
      search: '',
      domain: 'all',
      minSeverity: 'all',
      gate: 'all',
    })
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
  }
}

async function recheck() {
  await source.recheck({})
  await load()
}
```

Replace the local `diagnosisFor` calls. Every `diagnosisFor(room.id)` becomes `diagnoses.value[room.id] ?? undefined`, and the filter predicate's `diagnosisFor(finding.roomId)?.gate.firstFailing` becomes `diagnoses.value[finding.roomId]?.gate.firstFailing`.

Make `dismissFinding` and `rejectFinding` call the source:

```ts
async function dismissFinding(findingId: string, reason?: RejectionReason) {
  if (reason)
    rejections.value = { ...rejections.value, [findingId]: reason }
  if (!dismissed.value.includes(findingId))
    dismissed.value = [...dismissed.value, findingId]
  await source.dismissFinding({ findingId, reason: reason ?? 'not_now' })
}

async function rejectFinding(findingId: string, reason: RejectionReason) {
  await dismissFinding(findingId, reason)
}
```

Add the new values to the returned object:

```ts
return {
  // ...everything already returned...
  load,
  recheck,
  isLoading,
  loadError,
  notAssessable,
  summary,
}
```

Delete the old `const summary = healthSummary` line and the old `notAssessable` computed that returned `notAssessableRooms`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/composables/useRevenueHealth.spec.ts`

Expected: PASS, 11 tests.

- [ ] **Step 5: Load on mount, and wire the dead button**

In `app/pages/revenue/index.vue`, destructure the new members and call `load` on mount:

```ts
const {
  applyFinding, applyStateFor, basis, expanded, filters, isLoading,
  load, notAssessable, portfolioRows, recheck, rejectFinding,
  resetFilters, stats, summary,
} = useRevenueHealth()

onMounted(() => { load() })
```

Replace the dead button at line 62 and make the summary optional-safe:

```vue
<p class="text-xs text-muted-foreground">
  Last check {{ summary ? formatLastCheck(summary.lastCheckedAt) : '—' }} ·
  <button
    type="button"
    class="font-medium text-foreground underline-offset-2 hover:underline disabled:opacity-50"
    :disabled="isLoading"
    @click="onRecheck"
  >
    {{ isLoading ? 'Re-checking…' : 'Re-check now' }}
  </button>
</p>
```

with these helpers in the script block:

```ts
function formatLastCheck(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return sameDay ? `Today ${time}` : `${date.toLocaleDateString('en-GB')} ${time}`
}

async function onRecheck() {
  await recheck()
  toast.success('Re-checked every listing')
}
```

Add `import { toast } from 'vue-sonner'` to the page's imports.

- [ ] **Step 6: Verify the page still renders**

Run: `NODE_OPTIONS=--max-old-space-size=8192 pnpm dev --port 3100` then
`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/dashboard/revenue`

Expected: `200`. Open the page: the table is populated, "Re-check now" shows "Re-checking…" and toasts on completion.

- [ ] **Step 7: Commit**

```bash
git add app/composables/useRevenueHealth.ts app/pages/revenue/index.vue tests/composables/useRevenueHealth.spec.ts
git commit -m "feat(revenue): read listing health through the data-source port"
```

---

## Task 6: Delete the duplicated pipeline order

`ApplyPipeline.vue` keeps its own copy of the step order and the failure positions. Task 1 made a tested version; use it.

**Files:**
- Modify: `app/components/revenue/ApplyPipeline.vue:12-37`

- [ ] **Step 1: Replace the local constants**

Delete `STEPS`, `ORDER` and the `failedAt` computed. Keep `STEP_LABELS`, which is presentation. The script block becomes:

```ts
import type { ApplyState } from '~/components/revenue/data/health'
import { computed } from 'vue'
import {
  APPLY_PIPELINE,
  applyStepIndex,
  failedStepIndex,
} from '~/components/revenue/data/contract'
import { Button } from '~/components/ui/button'

const props = defineProps<{ state: ApplyState }>()
const emit = defineEmits<{ revert: [] }>()

const STEP_LABELS: Record<typeof APPLY_PIPELINE[number], string> = {
  snapshot: 'Snapshot taken',
  saved: 'Saved in Elev8',
  written: 'Written',
  verified: 'Verified',
  recomputed: 'Recalculated',
  live: 'Live on channels',
}

const failedAt = computed(() => failedStepIndex(props.state))

const reached = computed(() =>
  failedAt.value !== null ? failedAt.value - 1 : applyStepIndex(props.state),
)

function stepStatus(index: number) {
  if (failedAt.value === index)
    return 'failed'
  if (index <= reached.value)
    return 'done'
  if (index === reached.value + 1 && props.state !== 'live')
    return 'active'
  return 'waiting'
}
```

In the template, change `v-for="(step, index) in STEPS"` to `v-for="(step, index) in APPLY_PIPELINE"` and `index < STEPS.length - 1` to `index < APPLY_PIPELINE.length - 1`.

- [ ] **Step 2: Verify the pipeline still renders every state**

Run: `npx vitest run tests/lib/revenue-contract.spec.ts`

Expected: PASS. Then in the browser, open `/dashboard/revenue/finding-1`, click Apply, and confirm the strip walks all six steps; click "Push fails" on `finding-2` and confirm the cross lands on "Live on channels" and not on "Recalculated".

- [ ] **Step 3: Commit**

```bash
git add app/components/revenue/ApplyPipeline.vue
git commit -m "refactor(revenue): one definition of the apply pipeline order"
```

---

## Task 7: HTTP adapter and the endpoint document

The deliverable for the backend engineer.

**Files:**
- Create: `app/components/revenue/data/http-source.ts`
- Create: `docs/superpowers/specs/2026-09-11-revenue-api-contract.md`

- [ ] **Step 1: Write the adapter**

Create `app/components/revenue/data/http-source.ts`:

```ts
/**
 * The real adapter. Not wired up: `useRevenueSource` returns the mock until
 * these endpoints exist. Kept compiling so the contract cannot drift from a
 * plausible implementation.
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

const BASE = '/api/revenue'

export function createHttpRevenueSource(): RevenueDataSource {
  return {
    getPortfolio: (query: PortfolioQuery) =>
      $fetch<PortfolioResponse>(`${BASE}/portfolio`, { query }),

    getRoomDiagnosis: (roomId: string) =>
      $fetch<RoomDiagnosis | null>(`${BASE}/rooms/${roomId}/diagnosis`),

    getFinding: (findingId: string) =>
      $fetch<HealthFinding | null>(`${BASE}/findings/${findingId}`),

    applyFinding: (req: ApplyRequest) =>
      $fetch<ApplyAccepted>(`${BASE}/findings/${req.findingId}/apply`, {
        method: 'POST',
        body: { fieldLabels: req.fieldLabels ?? [], basis: req.basis },
      }),

    getApplyStatus: (applyId: string) =>
      $fetch<ApplyStatus>(`${BASE}/applies/${applyId}`),

    revertApply: (applyId: string) =>
      $fetch<void>(`${BASE}/applies/${applyId}/revert`, { method: 'POST' }),

    dismissFinding: (req: DismissRequest) =>
      $fetch<void>(`${BASE}/findings/${req.findingId}/dismiss`, {
        method: 'POST',
        body: { reason: req.reason, suppressForDays: req.suppressForDays },
      }),

    recheck: (req: RecheckRequest) =>
      $fetch<RecheckAccepted>(`${BASE}/recheck`, { method: 'POST', body: req }),
  }
}
```

- [ ] **Step 2: Write the endpoint document**

Create `docs/superpowers/specs/2026-09-11-revenue-api-contract.md` containing, for each of the eight endpoints: the method and path, the query or body, the response type, and the spec section it serves. Copy the type definitions verbatim from `contract.ts` rather than paraphrasing them, and state these four rules at the top:

1. **Apply is asynchronous.** `POST .../apply` returns an `applyId` immediately with state `snapshot`. The client polls `GET /applies/:applyId`. A handler that blocks until `live` will time out.
2. **`lastCheckedAt` is ISO 8601.** The API never sends a pre-formatted string such as "Today 04:12"; the UI formats it in the viewer's locale.
3. **`notAssessable` must be populated.** A room a check could not reach is named with its reason (spec §11). Returning an empty array because the query failed makes a broken portfolio look healthy.
4. **`degradedRoomCount` drives the portfolio banner** (spec §15.8) and must count rooms whose `syncState` is `degraded`, not errors.

- [ ] **Step 3: Verify the adapter type-checks**

Run: `npx vue-tsc --noEmit -p tsconfig.json 2>&1 | grep -i "http-source" || echo "http-source clean"`

Expected: `http-source clean`.

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run tests/lib/revenue-contract.spec.ts tests/lib/revenue-mock-source.spec.ts tests/composables/useRevenueHealth.spec.ts`

Expected: PASS, 30 tests across 3 files.

- [ ] **Step 5: Commit**

```bash
git add app/components/revenue/data/http-source.ts docs/superpowers/specs/2026-09-11-revenue-api-contract.md
git commit -m "feat(revenue): HTTP adapter and the endpoint contract for the backend"
```

---

## Self-review

**Spec coverage.** This plan covers the seam and the contract only; it deliberately implements no new screen. Of the audit's findings it closes three: the dead "Re-check now" button (Task 5 step 5), the duplicated pipeline order (Task 6), and the module's total absence of tests (27 tests). It creates the `stale` apply state the type already declared but nothing produced, which is spec §15.4 step 1, re-validate before applying. It does **not** close: partial acceptance beyond carrying `fieldLabels` on the wire, suppression beyond carrying `suppressForDays`, the impact panel, the arbitration card, cannibalisation, attribution, shadow mode, or the 60-day sparkline. Those belong to plans 2 through 6 and are listed in the scope table.

**Placeholder scan.** No TBDs. Every code step carries the code. Task 7 step 2 describes a document rather than quoting it in full, which is the one soft spot; it is bounded by naming the exact four rules and pointing at `contract.ts` as the source for the types, so the writer has nothing to invent.

**Type consistency.** `RevenueDataSource` method names match `REVENUE_ENDPOINTS` keys exactly, and Task 2's test asserts that. `ApplyState` is imported from `health.ts` everywhere rather than redeclared. `NotAssessableRoom` replaces the untyped inline shape in `diagnosis.ts`; the fixture there still satisfies it structurally, so no fixture edit is needed. `createMockRevenueSource` and `createHttpRevenueSource` share the `RevenueDataSource` return type, so the compiler catches a drift between them.

**One risk worth naming.** Task 5 changes `useRevenueHealth` from synchronous to loaded-on-mount. Any component reading `portfolioRows` before `load()` resolves now sees an empty array where it used to see fixtures. `app/pages/revenue/[id].vue` reads `getFinding` from the store, so it needs `load()` on mount too. Add that in Task 5 step 5 alongside the index page, or the finding page will show its "no longer available" empty state on a hard refresh.

---

## Execution handoff

Plan complete. Two execution options:

1. **Subagent-driven** (recommended) — a fresh subagent per task, reviewed between tasks.
2. **Inline execution** — tasks run in this session with checkpoints.
