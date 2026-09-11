# Revenue Engine API contract

This document specifies the eight HTTP endpoints the "Listing Health" module
needs from the backend (internally called the Revenue Engine). It is written
for a backend engineer who has not seen the frontend code. No knowledge of
the frontend framework is assumed anywhere in this document.

**What this module is.** It audits a tenant's rental listings ("rooms") for
revenue and pricing problems — a price sitting below the comparable set, a
minimum-stay rule that loses money after turnover cost, a listing whose search
visibility collapsed, and so on. Each problem the engine detects is a
"finding." A tenant reviews a finding and can apply it (the engine writes new
settings and pushes them to the channels), dismiss it, or ask for a fresh
check ("recheck").

**Source of truth.** Every type below is copied verbatim from the frontend's
own contract file, `app/components/revenue/data/contract.ts`, and the two
files it re-exports from, `app/components/revenue/data/health.ts` and
`app/components/revenue/data/diagnosis.ts`. If this document and that file
ever disagree, the file wins — but they should never disagree, because this
document is meant to be regenerated from it. The frontend currently talks to
an in-memory mock that returns exactly these shapes; a compiling (but unused)
HTTP adapter at `app/components/revenue/data/http-source.ts` exists purely to
prove this contract is implementable — it is not wired up to any UI yet.

**What this document does not do.** It does not define authentication, error
response formats, pagination, or rate limiting, because the source contract
does not define them either. Where the backend genuinely has to decide
something not covered here, it is listed under "Open, for the backend team"
at the end rather than guessed at.

---

## Four rules

These are the four rules most likely to be gotten wrong, because each one
looks like it could reasonably be done the other way.

### 1. Apply is asynchronous

`POST /api/revenue/findings/:findingId/apply` returns immediately with an
`applyId` and a state of `snapshot`. It does **not** wait for the write to
finish. The apply itself walks six steps — `snapshot`, `saved`, `written`,
`verified`, `recomputed`, `live` — and `written` alone can take the better
part of a second once a channel-manager push is involved; `recomputed` can
take longer still if it waits on a pricing provider's own recompute cycle.
The client is expected to poll `GET /api/revenue/applies/:applyId` until the
state stops changing.

**Why this rule exists:** a handler that blocks the HTTP request until the
finding is fully `live` will time out behind any reverse proxy or load
balancer with a normal request timeout, and it turns a six-step pipeline that
the UI wants to show progress for into an opaque multi-second hang.

### 2. `lastCheckedAt` is ISO 8601 — but the freshness fields are not

`PortfolioSummary.lastCheckedAt`, `ApplyStatus.revertableUntil`, and
`RecheckAccepted.startedAt` must each be a real ISO 8601 timestamp string,
e.g. `"2026-09-11T04:12:00.000Z"`.

**Why this rule exists:** the API must never send a pre-formatted,
already-relative string such as `"Today 04:12"` for these three fields.
Formatting a timestamp into the viewer's own locale and relative-time
phrasing is the frontend's job, and it can only do that from a real,
parseable timestamp. A pre-formatted string also cannot be correctly
re-rendered when the viewer's clock, locale, or timezone differs from the
server's.

**The deliberate exception:** every `observedAt` field — in `EvidenceItem`,
`ChannelFunnel`, `MdvCompset`, `MarketPosition`, `Posture`, `MarginBlock`, and
`FreshnessItem` — and `MarginBlock.accountingAsOf` are the opposite: **the
backend sends a pre-formatted, human-readable string** (`"14h ago"`,
`"1d ago"`, `"live"`, `"curated"`, `"last closed month"`) and the frontend
renders it verbatim. These fields express freshness as *credibility to an
operator* — how much to trust a claim — rather than a point in time the
client computes with, so the backend chooses the wording, including
non-time values like `"curated"` or `"live"` that a timestamp could not
represent at all.

### 3. `notAssessable` must be populated

`PortfolioResponse.notAssessable` is the list of rooms the audit could not
reach — for example, a room whose comparable set has not resolved yet. Each
entry names the room and states, in a plain-language sentence, what is
missing (e.g. `"comp-set not resolved"`).

**Why this rule exists:** if the portfolio query fails to resolve a room's
diagnosis, catching that failure and quietly omitting the room from
`notAssessable` (or returning an empty array because the underlying check
errored rather than because every room really was assessable) makes a broken
audit look exactly like a clean one. A tenant seeing zero unassessable rooms
must be able to trust that every room really was checked, not that the checks
silently failed. See spec §11.

### 4. `degradedRoomCount` drives the portfolio banner

`PortfolioSummary.degradedRoomCount` must be the count of rooms whose
`HealthRoom.syncState` is exactly `'degraded'` — not `'paused'`, not
`'partial'`, and not a count of endpoint errors encountered while building
the response.

**Why this rule exists:** this single number is what decides whether the
portfolio-wide banner in the UI shows at all (spec §15.8) — zero means no
banner. If this number ever counts something other than rooms actually in the
`degraded` sync state (for instance, if it is repurposed to mean "requests
that failed" during an incident), the banner either fires when nothing is
wrong or stays silent while rooms genuinely are stale.

---

## Endpoint summary

| # | Method & path | Purpose | Spec section |
|---|---|---|---|
| 1 | [`GET /api/revenue/portfolio`](#1-get-apirevenueportfolio) | List rooms + findings + summary for the portfolio table | §15.2 |
| 2 | [`GET /api/revenue/rooms/:roomId/diagnosis`](#2-get-apirevenueroomsroomiddiagnosis) | Full evidence behind a room's gate/funnel/comp-set/margin state | depth two beneath §15.2 |
| 3 | [`GET /api/revenue/findings/:findingId`](#3-get-apirevenuefindingsfindingid) | One finding's full recommendation card content | §15.3 |
| 4 | [`POST /api/revenue/findings/:findingId/apply`](#4-post-apirevenuefindingsfindingidapply) | Start applying a finding (async — see Rule 1) | §15.3 item 8, §15.4 |
| 5 | [`GET /api/revenue/applies/:applyId`](#5-get-apirevenueappliesapplyid) | Poll the state of an in-flight or finished apply | §15.4 |
| 6 | [`POST /api/revenue/applies/:applyId/revert`](#6-post-apirevenueappliesapplyidrevert) | Undo a `live` apply | §15.4 step 6 |
| 7 | [`POST /api/revenue/findings/:findingId/dismiss`](#7-post-apirevenuefindingsfindingiddismiss) | Reject a finding with a structured reason, optionally suppress it | §11, §11.5 |
| 8 | [`POST /api/revenue/recheck`](#8-post-apirevenuerecheck) | Re-run the audit, for one room or the whole portfolio | §15.2 ("Re-check now") |

---

## 1. `GET /api/revenue/portfolio`

**Serves:** the portfolio table, its KPI tiles, and the "N rooms not
assessable" disclosure line (spec §15.2).

**Query parameters** — `PortfolioQuery`:

```ts
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
```

`ObjectiveBasis`, `HealthDomain`, `HealthSeverity`, and `GateStage` are defined
in the Shared types appendix below.

**Response** — `PortfolioResponse`:

```ts
export interface PortfolioResponse {
  rooms: HealthRoom[]
  findings: HealthFinding[]
  summary: PortfolioSummary
  notAssessable: NotAssessableRoom[]
}
```

```ts
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
```

```ts
/** A room a check could not reach. Named, never silently dropped (spec §11). */
export interface NotAssessableRoom {
  roomId: string
  name: string
  /** Plain language, shown verbatim. e.g. "comp-set not resolved". */
  missing: string
}
```

`HealthRoom` and `HealthFinding` are the full domain objects, defined in the
Shared types appendix — see Rules 2, 3, and 4 above for the fields in this
response that carry the most risk of a subtly wrong implementation.

---

## 2. `GET /api/revenue/rooms/:roomId/diagnosis`

**Serves:** the room diagnosis screen — per-channel funnel, gate state,
comparable-set, commercial posture, margin, and per-element freshness. This
is the drill-down one level beneath the portfolio table in spec §15.2; it is
what a tenant opens to see the full evidence behind a room's numbers, whether
or not that room currently has an open finding.

**Path parameter:** `roomId` — a `HealthRoom.id`.

**Response:** `RoomDiagnosis | null`. `null` means this room has no diagnosis
available yet (a "claims nothing rather than guessing" state — the audit has
not produced evidence for this room, as opposed to the room being fine).

```ts
export interface RoomDiagnosis {
  roomId: string
  contract: ContractType
  gate: GateState
  funnels: ChannelFunnel[]
  compset: MdvCompset
  market: MarketPosition
  posture: Posture
  margin: MarginBlock
  freshness: FreshnessItem[]
}
```

Every nested type (`ContractType`, `GateState`, `ChannelFunnel`, `MdvCompset`,
`MarketPosition`, `Posture`, `MarginBlock`, `FreshnessItem`, and the types
each of those in turn depends on) is defined verbatim in the Shared types
appendix.

---

## 3. `GET /api/revenue/findings/:findingId`

**Serves:** the recommendation card (spec §15.3) — the full argument for one
finding: the money estimate on both bases, the field changes it proposes,
supporting evidence, counter-evidence, named unknowns, confidence, an
operations constraint note where one applies, and the check's identity and
version.

**Path parameter:** `findingId` — a `HealthFinding.id`.

**Response:** `HealthFinding | null`. `null` means the finding is no longer
available — already applied, already dismissed, or expired (spec §15.3,
"finding no longer available").

```ts
export interface HealthFinding {
  id: string
  roomId: string
  domain: HealthDomain
  severity: HealthSeverity
  headline: string
  windowLabel: string
  money: Record<ObjectiveBasis, MoneyEstimate>
  /** 0–1. Decays with horizon and with signal staleness. */
  confidence: number
  changes: FieldChange[]
  /** Required. A check that cannot argue its own counter-case is not ready. */
  supporting: EvidenceItem[]
  against: EvidenceItem[]
  unknowns: string[]
  constraint?: ConstraintNote
  agreement?: EvidenceItem
  checkKey: string
  checkVersion: number
  horizonBand: string
  expiresInDays: number
  autonomyBand: string
  acceptedCount: number
}
```

`MoneyEstimate`, `FieldChange`, `EvidenceItem`, and `ConstraintNote` are
defined in the Shared types appendix.

**Note on partial acceptance (spec §15.3 item 8):** `FieldChange.label` is
the identifier the client uses to request applying only some of a finding's
changes — see `ApplyRequest.fieldLabels` in endpoint 4 below.

---

## 4. `POST /api/revenue/findings/:findingId/apply`

**Serves:** the primary action on the recommendation card (spec §15.3 item
8, labelled "Apply") and the entire apply pipeline (spec §15.4). **Read Rule
1 above before implementing this endpoint.**

**Path parameter:** `findingId`.

**Body** — `ApplyRequest`:

```ts
export interface ApplyRequest {
  findingId: string
  /**
   * Spec §15.3 item 8, partial acceptance. Each entry is a `FieldChange.label`
   * from the finding. Omit or leave empty to apply every changed field.
   */
  fieldLabels?: string[]
  basis: ObjectiveBasis
}
```

`ApplyRequest` above is the logical request shape; on the wire, `findingId`
travels only in the path segment. The reference adapter's request body
carries just `fieldLabels` and `basis` — it does not repeat `findingId`.
`fieldLabels` omitted or empty means "apply every field this finding
changes."

**Response** — `ApplyAccepted`:

```ts
/**
 * Apply is long-running: six steps, each of which can fail. The POST returns
 * immediately with an id, and the client polls `getApplyStatus`. A backend that
 * blocks until `live` will time out behind any proxy.
 */
export interface ApplyAccepted {
  applyId: string
  state: ApplyState
}
```

The returned `state` is expected to be `'snapshot'` — the first step of the
pipeline, which captures the finding's prior values before anything is
written (this is also what a later revert restores). The six-step pipeline,
in order, is:

```ts
export const APPLY_PIPELINE = [
  'snapshot',
  'saved',
  'written',
  'verified',
  'recomputed',
  'live',
] as const
```

Three terminal failure states exist alongside the six in-progress states.
`ApplyState` (defined in `health.ts`) is the full union:

```ts
export type ApplyState
  = | 'idle' | 'snapshot' | 'saved' | 'written' | 'verified' | 'recomputed' | 'live'
    | 'recompute_unavailable' | 'push_failed' | 'stale'
```

`'idle'` is a client-only resting state before any apply has been started —
the backend never needs to return it. The other nine values are meaningful
backend states:

- `stale` — spec §15.4 step 1: the finding's underlying signals changed since
  it was generated, so it was re-validated before writing and found stale.
  Nothing downstream of `snapshot` ran. **This is a distinct outcome from a
  normal failure** — the correct response to the tenant is "re-run the check
  and see if the recommendation still holds," not "retry the same apply."
- `recompute_unavailable` — settings were written successfully but the
  pricing provider's own recompute did not run (or is not available), so the
  written values are live in the engine but the guest-facing price has not
  yet reflected them.
- `push_failed` — the write to the channel manager was rejected (in whole or
  in part). Guests still see the old price.
- `live` — every step succeeded and the change is visible to guests.

---

## 5. `GET /api/revenue/applies/:applyId`

**Serves:** polling the apply pipeline strip (spec §15.4) so the client can
show progress and, on completion, either a "live, revert available for N
days" state or the specific failure state.

**Path parameter:** `applyId`, from the `ApplyAccepted` response of endpoint
4.

**Response** — `ApplyStatus`:

```ts
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
```

The client is expected to keep calling this endpoint until `state` is `live`
or one of the terminal failure states listed under endpoint 4 (see
`isTerminalApplyState` in `contract.ts`, which treats `live` and every state
with a defined failure step as terminal). There is no `Retry-After` or
recommended polling interval defined in the contract; see "Open, for the
backend team" below.

---

## 6. `POST /api/revenue/applies/:applyId/revert`

**Serves:** the revert action offered once an apply reaches `live` (spec
§15.4 step 6 — "revert available for seven days" in the reference UI copy).

**Path parameter:** `applyId`.

**Body:** none.

**Response:** `void` — no response body. A successful call restores the
values captured at `snapshot` time (via `policyVersionId`) and pushes that
restoration through the same write path an apply uses. What the reference UI
shows after a successful revert is simply the finding returning to its
pre-apply state; the contract does not define a body describing that state,
so the client is expected to re-fetch (endpoint 3) if it needs the finding's
current values after a revert.

The contract does not define what happens if `revert` is called after
`revertableUntil` has passed, or on an `applyId` that never reached `live`.
See "Open, for the backend team" below.

---

## 7. `POST /api/revenue/findings/:findingId/dismiss`

**Serves:** the reject/dismiss flow (spec §11) and the suppression window a
dismissal can set (spec §11.5).

**Path parameter:** `findingId`.

**Body** — `DismissRequest`:

```ts
export interface DismissRequest {
  findingId: string
  reason: RejectionReason
  /** Spec §11.5: a dismissal suppresses the check for a duration. */
  suppressForDays?: number
}
```

`DismissRequest` above is the logical request shape; on the wire, `findingId`
travels only in the path segment. The reference adapter's request body
carries just `reason` and `suppressForDays` — it does not repeat `findingId`.

`RejectionReason` (defined in `diagnosis.ts`) is a fixed set of six
structured reasons — not free text — because what a dismissal means depends
on which one is given:

```ts
/** Rejection is a first-class outcome, and the reason is what makes it useful. */
export type RejectionReason
  = | 'too_aggressive' | 'diagnosis_wrong' | 'not_now'
    | 'owner_forbids' | 'not_operable' | 'wrong_lever'
```

Each reason has a distinct effect the backend should honour, not just log:

```ts
export const rejectionEffects: Record<RejectionReason, string> = {
  too_aggressive: 'Lowers the ceiling for this lever on this room.',
  diagnosis_wrong: 'Flags the evidence for review — the most useful answer.',
  not_now: 'Cooldown only. Not counted against the finding.',
  owner_forbids: 'Belongs on the contract as a limit; we will suggest recording it.',
  not_operable: 'Points at a capacity limit the optimiser did not know.',
  wrong_lever: 'Feeds straight back into how the lever is chosen.',
}
```

`suppressForDays`, when present, means the same check must not raise a new
finding for this room within that many days, even if the underlying
condition still holds.

**Response:** `void` — no response body.

---

## 8. `POST /api/revenue/recheck`

**Serves:** the "Re-check now" action on the portfolio view (spec §15.2),
which re-runs the audit either for a single room or, if no room is
specified, for the entire portfolio.

**Body** — `RecheckRequest`:

```ts
export interface RecheckRequest {
  /** Omit for the whole portfolio. */
  roomId?: string
}
```

**Response** — `RecheckAccepted`:

```ts
export interface RecheckAccepted {
  startedAt: string
  roomsQueued: number
}
```

`startedAt` must be ISO 8601 (Rule 2). This is also fire-and-forget from the
client's point of view in the current UI — the reference frontend does not
poll a recheck to completion; it re-fetches the portfolio (endpoint 1)
afterward on its own timer or the next time the tenant opens the page. If the
backend needs the client to know when a recheck actually finishes, that is
not something this contract currently provides — see "Open, for the backend
team" below.

---

## The port, for reference

All eight endpoints correspond one-to-one with the eight methods of the
`RevenueDataSource` interface, which is the single interface every screen in
the frontend reads through:

```ts
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
```

The frontend's own record of method-to-path, kept next to the interface so a
renamed path cannot leave documentation like this one stale:

```ts
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

---

## Shared types appendix

Everything below is copied verbatim from `app/components/revenue/data/health.ts`
and `app/components/revenue/data/diagnosis.ts`, and is referenced by the
endpoint responses above.

### From `health.ts`

```ts
/** Domains the engine audits. Pricing and restrictions are deep in V1. */
export type HealthDomain
  = | 'pricing' | 'restrictions' | 'market'
    | 'visibility' | 'commercial' | 'guest_experience' | 'operations'

export type HealthSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

/** The tenant chooses which basis ranks the portfolio. Both are always computed. */
export type ObjectiveBasis = 'revenue' | 'margin'

/**
 * Tenant-facing signal families. Deliberately NOT one per source — `market`
 * draws on the pricing provider and the market-data source, `demand` on the
 * market-data source and our own booking pace. A vendor is never named on a
 * data surface, because a claim usually spans several sources.
 */
export type SignalFamily
  = | 'market' | 'demand' | 'performance'
    | 'operations' | 'calendar' | 'benchmark'

export type SyncState = 'live' | 'partial' | 'paused' | 'degraded'
```

```ts
/**
 * A banded estimate. The band is not decoration: a point estimate without one
 * invites false precision, and the ranking is only as good as its inputs.
 */
export interface MoneyEstimate {
  amount: number
  low: number
  high: number
  currency: string
  /** Margin basis only. False ⇒ the estimate rests on derived costs. */
  costInputsConfirmed?: boolean
}

export interface EvidenceItem {
  claim: string
  family: SignalFamily
  metric: string
  /** Human-readable age. Freshness is credibility, so it is always shown. */
  observedAt: string
}

export interface FieldChange {
  label: string
  from: string
  to: string
  /** Rendered as context rather than a change, so nothing surprises after apply. */
  unchanged?: boolean
}

export interface ConstraintNote {
  title: string
  body: string
  /** 0–100. Soft warning above 85, hard block at 100. */
  utilisation?: number
}
```

```ts
export interface HealthRoom {
  id: string
  name: string
  location: string
  syncState: SyncState
  /** Margin basis is de-confidenced while this is false. */
  costInputsConfirmed: boolean
  /** Excluded from auto-apply so realised uplift can be measured. */
  inHoldout: boolean
  /** Our realised ADR against the comparable-set median, in percent. */
  adrVsSet: number
  /** Realised ADR, 30 days — normalised 0–1 for the sparkline. */
  trend: number[]
  /** Comp-set median on the same scale, drawn as a reference line. */
  trendReference: number
}
```

(`HealthFinding` is quoted in full under endpoint 3 above rather than
repeated here.)

### From `diagnosis.ts`

```ts
/**
 * The owner contract decides what the engine optimises. This is NOT a tenant
 * preference: on a guaranteed-rent room every margin gain belongs to us, on a
 * gross-share room optimising margin works against our own fee. Same field
 * also decides whether the owner may see the cost side — only a net-share
 * owner has a contractual claim to verify a deduction.
 */
export type ContractType = 'guaranteed_rent' | 'net_share' | 'fixed_fee' | 'gross_share'
```

```ts
export type GateStage = 'impressions' | 'ctr' | 'conversion' | 'price'
```

(`gateStageLabels` and `gateStageDomain`, both UI label maps rather than wire
types, sit between this and the next declaration in the source file and are
omitted here as not part of the contract.)

```ts
export type GateVerdict = 'healthy' | 'failing' | 'unknown'

export interface GateState {
  /** Verdict per stage, in funnel order. */
  stages: { stage: GateStage, verdict: GateVerdict, note?: string }[]
  /** First stage that fails, if any. Decides what may be raised. */
  firstFailing?: GateStage
  /** Plain sentence for the operator: what is released and what waits. */
  releasedNote: string
  /** Which yardstick the verdicts used. */
  benchmark: 'cohort' | 'own_history'
  cohortSize: number
}
```

```ts
export type FunnelChannel = 'booking' | 'airbnb'
```

(`funnelChannelLabels`, a UI label map rather than a wire type, sits between
this and the next declaration in the source file and is omitted here as not
part of the contract.)

```ts
export interface FunnelStageValue {
  /** Rate as a fraction, or null when the stage cannot be measured yet. */
  rate: number | null
  cohortRate: number | null
  /** Absolute count behind the rate — small denominators are marked, not hidden. */
  count: number
}

export interface ChannelFunnel {
  channel: FunnelChannel
  /**
   * Booking counts backwards over a trailing window; Airbnb reports forward
   * per stay date. The two are never compared — only each against its cohort.
   */
  direction: 'trailing' | 'forward'
  windowLabel: string
  impressions: number
  view: FunnelStageValue
  booking: FunnelStageValue
  /**
   * False where the forward window is shorter than the booking window, which
   * is the normal case in a 0–9 day market. A zero there is not a red flag,
   * it is an unmeasurable stage — and it renders as such.
   */
  bookingMeasurable: boolean
  unmeasurableReason?: string
  /** Below this the rate is greyed and labelled thin. */
  thinData: boolean
  observedAt: string
}
```

```ts
/** Named competitors: answers "against whom", with the match reasoning. */
export interface CompsetCompetitor {
  name: string
  distanceKm: number
  score: number
  adrDeltaPercent: number
  reviewScore: number | null
  reviewCount: number
}

export interface MdvCompset {
  tracked: number
  competitors: CompsetCompetitor[]
  /** How the match is weighted, in percent. Shown because it explains the set. */
  weights: { label: string, weight: number }[]
  ourReviewScore: number | null
  ourReviewCount: number
  observedAt: string
}
```

```ts
/** Panel view: answers "how the market stands", per date. */
export interface MarketPosition {
  percentile: number
  windowLabel: string
  marketOccupancy: number
  occupancyStly: number | null
  availableListings: number
  supplyDeltaPercent: number
  panelSize: number
  bandLabel: string
  observedAt: string
}
```

```ts
export interface Programme {
  label: string
  detail?: string
  active: boolean
}

export interface Posture {
  /**
   * The stack multiplies rather than adds: discounts cut what the guest pays,
   * commissions take a share of what is left. Nobody computes this today
   * because every position lives in a different screen.
   */
  effectiveTakeRate: number
  commissionPct: number
  contributors: string[]
  programmes: Programme[]
  /** No comparison to the set: competitor programme settings are not sold. */
  cohortTakeRate: number | null
  observedAt: string
}
```

```ts
export interface ChannelFee {
  channel: FunnelChannel
  cleaningFee: number
  /** Positive when the fee does not cover the turnover cost on that channel. */
  shortfall: number
}

export interface MarginBlock {
  currency: string
  costPerTurnover: number
  costState: 'measured' | 'estimated'
  /** Share of cleanings in the window with recorded time. */
  trackedCleanings: number
  totalCleanings: number
  fees: ChannelFee[]
  /** Accounting components arrive with month-end, so they lag by design. */
  accountingAsOf: string
  observedAt: string
}
```

```ts
/** One stamp per element, because a single "last check" hides real spread. */
export interface FreshnessItem {
  label: string
  observedAt: string
}
```

(`RoomDiagnosis` is quoted in full under endpoint 2 above, and
`RejectionReason` under endpoint 7, rather than repeated here.)

---

## Open, for the backend team

These are not answered anywhere in `contract.ts`, `health.ts`, or
`diagnosis.ts`. Rather than guess, they are listed here for the backend team
to decide:

- **Authentication.** No auth scheme, header, or token shape is defined
  anywhere in the contract.
- **Error responses.** No error body shape, status-code convention, or
  validation-error format is defined. `getRoomDiagnosis` and `getFinding` use
  a `null` response body to mean "not found / not available" (this is
  explicit in the contract); every other endpoint has no defined behaviour
  for a not-found or invalid-input case.
- **Polling interval for `GET /applies/:applyId`.** No `Retry-After` header,
  recommended interval, or maximum poll duration is defined. The reference
  mock's own pipeline steps take between 250ms and 1400ms each; a real
  provider push may take longer, and the contract does not say what the
  client should do if polling continues for an extended period.
- **Recheck completion.** `POST /recheck` returns `roomsQueued` but the
  contract defines no way for the client to learn when a recheck (of one
  room or the whole portfolio) has actually finished, beyond re-fetching the
  portfolio and comparing `lastCheckedAt`.
- **Revert after the window, or on a non-`live` apply.** The contract defines
  `revertableUntil` but not what `POST /applies/:applyId/revert` should
  return if called after that timestamp, or on an apply that never reached
  `live`.
- **Pagination and rate limiting.** `GET /portfolio` returns full `rooms[]`
  and `findings[]` arrays with no pagination parameters defined anywhere in
  `PortfolioQuery`. Whether that remains true at production scale, and
  whether any of these endpoints need rate limiting, is not specified here.
