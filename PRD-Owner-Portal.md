# PRD: Owner Portal — Owner Management, Contracts, Statements, Self-Booking & Performance

**Status:** Implemented (mock/demo) — Phases 1–3 in codebase · 9 forward decisions taken, see §19
**Owner:** Juli (Product)
**Modules:** Owners (staff), Owner Statements, Owner Documents, Owner Portal (external)
**Touches:** Cockpit, Reservations, Cleaning Jobs, Smart Lock, Notifications, Tenant Branding, Channex (simulated)
**Last Updated:** 2026-09-01
**Supersedes:** the V1+V2 revision of this file (see git history) — that revision predates contracts,
e-signature, operational fees, self-booking quotas, the approval queue, ops provisioning, the Document
Center, maintenance approvals, dispute threads and the portal access log, and still documents the retired
`/owners` route.

> This document is written **from the code**, not from intent. Every rule, guard, status and side effect
> below was read out of `app/components/owners/`, `app/components/owner-portal/`, `app/composables/useOwner*.ts`,
> `app/pages/owner-portal/`, `app/pages/users/index.vue` and `app/middleware/owner-portal.global.ts`.
> Where the code and the original intent disagree, §18 records the discrepancy rather than hiding it.

---

## 1. TL;DR (Developer Quickstart)

**What it is.** A white-labeled portal for external property owners, plus the staff-side tooling to
onboard them, contract them, pay them out on paper, and govern what they are allowed to see.

**Two surfaces, one domain layer, strict one-way isolation.**

| Surface | Route(s) | Who |
|---|---|---|
| Staff — owner roster, statements, documents | `/users` → **Owners** tab (sub-tabs: Owners / Statements / Documents) | Tenant staff |
| Staff — statements (standalone) | `/owner-statements` | Tenant staff (unlinked from nav) |
| Staff — documents (standalone) | `/owner-documents` | Tenant staff (unlinked from nav) |
| Staff — stay approval queue | `/cockpit` → Stay Requests panel | GM / Admin |
| Owner — login | `/owner-portal/login` | Owner (no session) |
| Owner — contract e-sign | `/owner-portal/contract` | Owner (no session — deliberate) |
| Owner — dashboard | `/owner-portal` | Owner (session) |
| Owner — statement archive / detail | `/owner-portal/statements`, `/owner-portal/statements/[id]` | Owner (session) |
| Owner — My Stays | `/owner-portal/stays` | Owner (session) |
| Owner — documents | `/owner-portal/documents` | Owner (session) |
| Owner — maintenance | `/owner-portal/maintenance` | Owner (session) |

Sidebar exposes exactly one entry — **Owner Portal (Demo)** → `/owner-portal/login`. Staff owner tooling
is reached through **Users**; `/owner-statements` and `/owner-documents` are reachable by URL and by
notification deep-link only.

**Three hard gates before an owner can see anything:** the owner record must be `active`, the magic link
must not be `revoked`, and the contract must be **e-signed**. All three are enforced in
`useOwnerAuth.acceptDemoLink()`. ⚠️ **D4 replaces this** — magic links go away and the gates become
*account active · role is `role-owner` · contract signed*. See §19.1.

**Everything an owner sees is filtered twice:** by `session.ownerId` (outer filter, always) and by the
per-owner field permission map (inner filter). Ownership-share scaling is applied on top for co-owned
properties.

**Key files**

| File | Purpose |
|---|---|
| `app/pages/users/index.vue` | Staff hub — Users / Owners / Roles tabs |
| `app/pages/owner-portal/*.vue` | Portal pages (login, contract, dashboard, statements, stays, documents, maintenance) |
| `app/layouts/owner-portal.vue` | Brand-aware portal shell |
| `app/middleware/owner-portal.global.ts` | Session guard with two public exceptions |
| `app/components/owners/**` | Staff components + the whole domain data layer (`data/`) |
| `app/components/owner-portal/**` | Portal components (charts, calendar, statement detail) |
| `app/composables/useOwner*.ts` | 15 composables — see §8 |
| `app/lib/owner-contract-pdf.ts`, `app/lib/owner-statement-pdf.ts` | Real jsPDF generators |
| `app/lib/owner-reservations-layout.ts` | Pure month-grid + bar layout for the stays calendar |
| `app/components/owners/lib/ownership-rebalance.ts` | Pure ownership-share math |

---

## 2. Problem Statement

Villa owners in Bali hand their property to a manager and then go dark. They ask the same questions by
WhatsApp every month — *how much did I make, why is this deduction here, can I use my own villa in
August, when is the repair happening, where is my contract* — and every answer is a manual export, a
screenshot, or a phone call. Meanwhile staff have no structured way to record ownership splits,
commission terms, cost-sharing, or who is allowed to see what.

The cost is threefold: staff time lost to reporting, owner trust lost to opacity, and revenue lost when
owners block peak dates with no rules in place.

## 3. Goals & Non-Goals

**Goals**
1. One statement of record per (owner, listing, month) that is **frozen** once the owner has seen it.
2. Owner self-service for the four recurring questions: performance, statements, own-use stays, documents.
3. Configurable transparency — the manager decides per owner which numbers are visible.
4. Rules, not negotiation, for owner self-booking: annual cap, seasonal quotas, approval mode.
5. A contract that must be signed before access, and that lives where the owner can re-read it.
6. Every owner-visible number derived from the owner's actual ownership share.

**Non-Goals (this phase)**
- Real authentication, real email delivery, real payouts.
- Real channel-manager or accounting writes (Channex / Cockpit sync is simulated).
- Owner self-registration or property claiming.
- Multi-language portal (owner `language` is stored, UI is English).
- FX conversion across currencies.

## 4. Scope

**In scope (built):** owner CRUD + status lifecycle; 4-step onboarding; ownership shares with a 100%
per-scope invariant and proportional rebalancing; commission rules (flat / tiered / hybrid, gross or net
basis with selectable deductions); per-(owner, listing) operational cost share; contract generation,
send, e-signature and PDF; magic-link session with access audit log, revoke and regenerate; field-level
portal permissions with two templates plus custom; monthly statement generation, preview, publish with
immutable snapshot, next-period adjustments, per-line dispute threads, PDF/XLSX export; 12-month
performance dashboard with YoY; owner-use stays with conflict detection, annual cap, seasonal quotas,
two booking modes, approval queue, automatic cleaning + smart-lock provisioning and release; Document
Center with per-document visibility and versioning; maintenance records with a cost-approval threshold
and emergency override; 21 notification alert types.

**Out of scope (not built):** everything in §18.

## 5. Personas & Roles

| Role | Surface | Capability |
|---|---|---|
| **Admin / GM** | Staff | Full owner CRUD, permissions, contracts, quotas, booking mode, revoke access, publish statements, approve stays, emergency-override maintenance |
| **Finance** | Staff | Generate/preview/publish statements, record adjustments, resolve disputes |
| **Owner (external)** | Portal | Read own dashboard + statements, e-sign contract, raise per-line issues, create/cancel own stays, download own documents, approve/reject maintenance cost |

Owners are a **separate dataset and a separate session** from staff `User`/`Role`. An owner is never an
internal user; `OwnerSession` lives in its own state bucket and the staff sidebar is never rendered in
the portal layout.

---

## 6. Architecture

```
                       ┌──────────────────────────────────────┐
   STAFF  /users ──────▶│  useOwners        useOwnerStatements │
   /cockpit ───────────▶│  useOwnerPermissions  useOwnerQuotas │
   /owner-statements ──▶│  useOwnerContracts    useOwnerDocs   │
   /owner-documents ───▶│  useOwnerMaintenance  useOwnerFees   │
                       └───────────────┬──────────────────────┘
                                       │  shared useState buckets
                                       │  (no server, no LocalStorage)
                       ┌───────────────▼──────────────────────┐
   OWNER  /owner-portal│  useOwnerAuth  →  session.ownerId    │
                       │  useOwnerPortal  (owner-scoped facade)│
                       │  useOwnerDashboard  useOwnerStmtDetail│
                       └───────────────┬──────────────────────┘
                                       │ side effects
                    ┌──────────────────┼───────────────────┐
             useCleaningJobs      useSmartLock        useNotifications
                                  useReservationsModule
```

**Isolation invariant.** `useOwnerPortal` is the only read path the portal uses for owner data, and its
public API deliberately exposes **no raw arrays** — no `allOwners`, `allStatements`, `allStays`,
`allIssues`. Every selector applies `session.ownerId` as the **outer** filter; property / period /
status filters run only on the already-owner-scoped subset. This is what makes a 50/50 co-owner of
`lst-3` unable to read the other co-owner's statement, commission rule or stay even though both rows
live in the same array. The issue selector is the only two-hop join (issue → statementId → owner) and it
is owner-scoped on both sides.

---

## 7. Domain Model

All types live in `app/components/owners/data/` and are re-exported from `data/index.ts`.

### 7.1 Owner & ownership

```ts
Owner {
  id, name, email, phone
  language: 'en' | 'id'
  statementCurrency: 'IDR' | 'USD' | 'AUD' | 'SGD' | 'EUR'
  status: 'draft' | 'invited' | 'active' | 'inactive'
  annualOwnerUseNightCap?: number          // 0/absent = no cap
  magicLinkStatus?: 'active' | 'revoked' | 'regenerated'
  magicLinkLastGeneratedAt?, accessRevokedAt?, invitedAt?, activatedAt?
  createdAt, updatedAt
}

OwnerPropertyMapping {
  id, ownerId, listingId
  unitId?                                   // scopes ownership to one room
  ownershipPercentage                       // Σ ≤ 100 per (listingId, unitId)
  commissionRuleId
  effectiveFrom, effectiveTo?
}

OwnerOperationalFee { id, ownerId, listingId, percentage /* 0–100 owner-borne */, updatedAt }
```

### 7.2 Commission

```ts
CommissionRule =
  | { type: 'flat',   rate }                       // % of base
  | { type: 'tiered', tiers: [{ upTo|null, rate }] } // marginal bands
  | { type: 'hybrid', fixedAmount, rate }          // fixed + % of base
  & { id, ownerId, listingId, name, effectiveFrom, effectiveTo?,
      basis?: 'gross' | 'net',
      basisDeductions?: ('operating_expenses'|'taxes'|'platform_fees')[] }
```

### 7.3 Contract

```ts
OwnerContract {
  id, ownerId, listingIds[]                  // owner-level, never per-listing
  status: 'draft' | 'sent' | 'signed'
  terms: { commissionType: 'fixed_net'|'gross', rate, fixedAmount?, basis,
           includedServices[], operationalFee /* 0–100 */ }
  generatedAt, sentAt?, signedAt?
  signature?: { name, signedAt, imageDataUrl? }   // drawn PNG
  documentId?                                     // Document Center entry
}
```

### 7.4 Permissions

```ts
OwnerPermissionConfig {
  ownerId
  templateId: 'full_transparency' | 'financial_summary' | 'custom'
  dashboard: Record<'grossRevenue'|'netRevenue'|'occupancy'|'adr'
                   |'bookingSources'|'upcomingReservations'|'guestRatings', boolean>
  statement: Record<'revenueLines'|'expenseDetails'|'commissionDetails'
                   |'taxesAndFees'|'adjustments'|'netPayout', boolean>
  updatedAt
}
```

`financial_summary` is **strict**: only `netRevenue`, `occupancy`, `adr`, `commissionDetails`,
`netPayout` are on. Everything else is off.

### 7.5 Ledger & statement

```ts
OwnerLedgerEntry {                       // one row per (owner, listing, period)
  id, ownerId, listingId, period /* YYYY-MM */, currency
  grossRevenue, expenses, taxes, platformFees
  sources: [{ source, revenue, reservations, nights }]
  occupiedNights, availableNights, nightlyRateSum, reservationCount
  averageRating, ratingsCount
  upcomingReservations[]
  isPriorPeriodAdjustment, adjustsPeriod?, adjustmentReason?
}

OwnerStatement {
  id, ownerId, listingId, period, currency
  status: 'draft' | 'in_preview' | 'published'
  lines: OwnerStatementLine[]            // category: revenue|expense|commission|tax|fee|adjustment
  totalAmount
  publishedAt?, publishedBy?
  publishedSnapshot?: { lines, totalAmount, currency }   // frozen at publish
  issues: OwnerStatementIssue[]
}

OwnerStatementIssue {
  id, statementId, lineId?, description, amount, createdAt, resolvedAt?
  thread?: [{ id, author: 'owner'|'staff', at, message }]
  resolution?: { type: 'explained'|'adjusted', resolvedBy, resolvedAt, note?, adjustmentId? }
}

OwnerStatementAdjustment { id, ownerStatementId, ownerId, listingId, period, nextPeriod, amount, reason, createdAt }
OwnerExportActivity     { id, format: 'pdf'|'xlsx', statementId, ownerId, ownerName, listingId, period, actor, createdAt }
```

### 7.6 Stays, quotas, approvals

```ts
OwnerStay {
  id, ownerId, listingId, unitId?
  guestName, checkIn, checkOut, nights, guestCount?
  countsAgainstOwnerUseCap: boolean
  status: 'pending_approval' | 'active' | 'rejected' | 'cancelled'
  source?: 'owner_request' | 'staff_block'
  approval?:      { decidedBy, decidedAt, reason? }
  cancelRequest?: { requestedAt, reason, status, decidedBy?, decidedAt? }   // see §18.1
  cleaningTaskIds?: { pre: string[], post: string[] }
  accessCodeId?, reservationId?, notes?
  syncState: Record<'cockpit'|'channex'|'notifications', 'pending'|'synced'|'failed'>
  cancelledAt?, cancellationReason?
}

OwnerBookingModeConfig { ownerId, listingId, mode: 'direct' | 'request' }
OwnerSeasonalQuota     { id, ownerId, listingId, startDate, endDate, maxNights }  // non-accumulating
OwnerStayApprovalRequest { id, stayId, ownerId, listingId, checkIn, checkOut, nights,
                           guestCount?, reason?, requestedAt,
                           status: 'pending'|'approved'|'rejected',
                           decidedBy?, decidedAt?, decisionReason? }
```

### 7.7 Documents, maintenance, access log

```ts
OwnerDocument {
  id, title, category: 'contract'|'tax'|'insurance'|'invoice'|'other'
  fileName, fileSize, mimeType, uploadedBy, uploadedAt
  visibility: 'all_owners' | 'specific_owner'
  ownerIds[]        // when specific_owner
  listingIds?       // when all_owners → every owner mapped to these listings
  version, previousVersionId?, content
}

MaintenanceRecord {
  id, ownerId, listingId, title, description, reportedAt, reportedBy
  status: 'reported'|'in_progress'|'vendor_assigned'|'awaiting_owner_approval'|'completed'|'cancelled'
  estimatedCost, actualCost?, vendorName?
  ownerApproval: { status: 'not_required'|'pending'|'approved'|'rejected'|'emergency_override',
                   decidedAt?, decidedBy?, note? }
  photosBefore?[], photosAfter?[], invoiceId?, syncedToStatementPeriod?
}
// Tenant config: { approvalThreshold: 500_000, currency: 'IDR' }

PortalAccessLogEntry {
  id, ownerId, actor /* staff id | 'owner' | 'system' */, at, note?
  action: 'link_generated'|'link_revoked'|'link_regenerated'|'link_used'
        | 'otp_sent'|'otp_verified'|'session_expired'
}
```

### 7.8 Seed data

3 owners (Wayan Sari — sole owner of `lst-1`, full transparency, `direct` mode, 14-night cap;
I Putu Antara — 50% of `lst-3` + 100% of `lst-8`, financial summary, `request` mode on `lst-8`;
Ni Kadek Deviani — `invited`, 50% co-owner of `lst-3`, contract `sent` and therefore **locked out**),
4 mappings, 4 commission rules (one per flavour incl. a net-basis hybrid), 3 contracts (2 signed,
1 sent), 86 ledger entries spanning 2025-07 → 2026-11, 19 statements, 6 stays (active / cancelled /
pending / rejected / friend-stay not counting against cap), 2 approval requests, 4 seasonal quotas
(incl. a `maxNights: 0` peak-season lockout), 5 documents (one at version 2), 4 maintenance records,
5 access-log entries, 8 portal calendar reservations, 12 per-statement reservations.

`initialReservations` grew from 8 to **14 rows**: six are the seeded owner-stay mirrors
(`ost-res-1`…`ost-res-6`), one per seeded `OwnerStay`, so owner-occupied dates are visible on
`/reservations` from a cold start and not only for stays created at runtime. Without them the seeded
stays pointed at reservation ids that did not exist — and because nothing persists, every reload
started from that broken state. `ost-4`/`ost-5`/`ost-6` gained the matching `reservationId` (1–3
already had one).

---

## 8. Composables & State

No owner state is persisted. Every bucket is `useState` seeded from the module fixtures, so **a browser
reload resets the entire module** — including the portal session (deliberate: the real implementation
would use an httpOnly cookie).

| Composable | Owns | Key exports |
|---|---|---|
| `useOwners` | `elev8-tenant-owners`, `elev8-owner-property-mappings`, `elev8-owner-commission-rules`, `elev8-owner-permissions`, 3 filter keys | `createOwner`, `updateOwner`, `inviteOwner`, `activateOwner`, `deactivateOwner`, `reactivateOwner`, `addMapping`, `updateMapping`, `removeMapping`, `addRule`, `updateRule`, `updatePermissions`, `validateOwnership`, `filteredOwners`, `byId` |
| `useOwnerAuth` | `elev8-owner-portal-session`, `elev8-owner-pending-email`, `elev8-owner-portal-access-log` | `requestMagicLink`, `acceptDemoLink`, `getPendingContract`, `logout`, `isAuthenticated`, `revokeAccess`*, `regenerateAccess`*, `markLinkGenerated`*, `getAccessLog`* |
| `useOwnerPortal` | — (facade) | `currentOwner`, `assignedProperties`, `visibleStatements`, `myStays`, `myIssues`, `dashboardMetrics`, `propertyMetrics`, `ownerUseNights`, `canViewDashboardField`, `canViewStatementField` |
| `useOwnerPermissions` | shares `elev8-owner-permissions` | `applyTemplate`, `updateDashboardField`, `updateStatementField`, `updatePermissions`, `canView*Field` |
| `useOwnerContracts` | `elev8-owner-contracts` | `generateContract`, `sendContract`, `signContract`, `getContractForOwner`, `hasSignedContract` |
| `useOwnerOperationalFees` | `elev8-owner-operational-fees` | `getFeeFor`, `feesForOwner`, `saveFee` |
| `useOwnerStatements` | `elev8-owner-statements`, `-statement-issues`, `-statement-adjustments`, `-export-activity` | `generateForPeriod`, `updateStatementLines`, `publish`, `raiseIssue`, `addIssueMessage`, `resolveIssue`, `resolveIssueWithResolution`, `recordAdjustment`, `mockExport`, `moveToPreview`*, `backToDraft`* |
| `useOwnerStatementDetail` | — | `detail` (reservations, channel breakdown, prior-period delta, adjustments), `isNotFound` |
| `useOwnerDashboard` | — | `timeSeries`, `currentPeriod`, 4 chart series, `yoyChange`, `hasYearOverYearData`, `hasVisibleMetrics` |
| `useOwnerStays` | `elev8-owner-stays` | `detectConflicts`, `getCapWarning`, `ownerUseNightsForYear`, `createStay`, `updateStay`, `cancelStay`, `retrySync`, `linkReservation`, `setMirroredReservationStatus`, `stayForReservation`, `approveCancelRequest`*, `denyCancelRequest`* |
| `useOwnerQuotas` | `elev8-owner-seasonal-quotas`, `elev8-owner-booking-modes` | `getBookingMode`, `setBookingMode`, `checkQuota`, `getRemainingQuota`, `upsertQuota`, `removeQuota` |
| `useOwnerStayApprovals` | `elev8-owner-stay-approvals` | `requestStay`, `approveRequest`, `rejectRequest`, `pendingRequestForStay`, `pendingRequests` |
| `useOwnerStayOperations` | — | `provisionOwnerStayOperations`, `releaseStayOperations`, `updateStayStatus`, `checkUpcomingStays` |
| `useOwnerDocuments` | `elev8-owner-documents` | `getDocumentsForOwner`, `uploadDocument`, `updateDocumentVersion`, `getDocumentHistory`, `downloadDocument` |
| `useOwnerMaintenance` | `elev8-owner-maintenance` | `createRecord`, `ownerRespond`, `emergencyOverride`, `advanceRecord`, `completeRecord`, `syncToStatement`, `recordsForOwner`, `openApprovals` |

\* implemented and tested but **called by no component** — see §18.1 and §18.5.

**Cross-composable couplings worth knowing.**
- `useOwners` and `useOwnerPermissions` share `elev8-owner-permissions`; both initialize through
  `normalizePermissionsSeed(...)`, so whichever runs first seeds identical strict configs. Init-order
  drift is impossible by construction.
- `useOwnerAuth` reads the shared `elev8-tenant-owners` bucket (not the static seed) so a `revokeAccess`
  propagates to the login check immediately. It seeds that key with the module reference, whereas
  `useOwners` seeds it with a `structuredClone` — see §18.2 for the consequence.
- Mutations always use spread/replace (`state.value = state.value.map(...)`), never in-place property
  assignment, per the project's reactivity rule.

---

## 9. Business Rules

### 9.1 Ownership
- **R1.** Σ `ownershipPercentage` per `(listingId, unitId)` scope must be ≤ 100, counting stored mappings
  plus every draft row in the current form. Enforced twice: in `useOwners.createOwner`/`addMapping`/
  `updateMapping` and in the onboarding step-2 guard, so the two can't drift.
- **R2.** A new draft row auto-fills the **remaining** share for its scope (`remainingShare`); a fully
  allocated scope falls back to 0 so the row is visibly unallocated rather than silently over-allocating.
- **R3.** Editing one row's share **rebalances siblings in the same scope proportionally**
  (`rebalanceSiblings`) so the scope total stays at 100. Switching a row's listing does not rebalance —
  it re-auto-fills for the new scope.
- **R4.** Clearing a row's property resets its share to 0.
- **R5.** `deactivateOwner` only guards the *status* transition (the owner must currently be `active`).
  It does **not** check whether deactivating leaves a property scope without ownership coverage, and it
  deliberately preserves `activatedAt` — deactivating does not erase history.

### 9.2 Commission
- **R6.** `rate` is a percentage 0–100 throughout the domain; helpers divide by 100 internally.
- **R7.** Base = gross minus the rule's selected deductions. `basisDeductions` wins over the legacy
  `basis: 'net'` (which means all three deducted). A legacy net rule with no itemised amounts falls back
  to `opts.netRevenue`. The base is floored at 0.
- **R8.** `flat` = base × rate. `hybrid` = fixedAmount + base × rate. `tiered` = **marginal**: each band
  charged at its own rate; revenue above the top *capped* tier is **not charged** (only an `upTo: null`
  top tier is open-ended).
- **R9.** Effective rule for a period = rules whose `[effectiveFrom, effectiveTo]` contains the **last
  day** of the period; ties broken by latest `effectiveFrom`.
- **R10.** All currency crosses `roundCurrency` (2 dp) at the domain boundary.
- **R11.** Operational costs are **never** part of the commission percentage. They are a separate
  per-(owner, listing) percentage (100 = owner covers everything) set at onboarding, carried into the
  contract terms and PDF, and shown as its own statement line.

### 9.3 Statements
- **R12.** Line signs: revenue positive; expense / commission / tax / fee negative; adjustment signed.
  Lines sum to the net payout.
- **R13.** `generateForPeriod(period)` requires `YYYY-MM`. It is **idempotent** per
  `(owner, listing, period)` and skips — counting into `skipped` — inactive owners, mappings not
  effective at period end, missing ledger entry, and mappings with no effective commission rule (a
  config gap must not produce a zero-commission draft).
- **R14.** Lifecycle: `draft → in_preview → published`. `moveToPreview` only from `draft`;
  `backToDraft` only from `in_preview`; `publish` from `draft` or `in_preview`.
- **R15.** `updateStatementLines` refuses unless `status === 'draft'`. Published statements are immutable.
- **R16.** Publish deep-copies `lines`/`totalAmount`/`currency` into `publishedSnapshot` and stamps
  `publishedAt`/`publishedBy`. Later edits to the live lines cannot leak into what the owner was shown.
- **R17.** Post-publication corrections are `OwnerStatementAdjustment` rows against **`nextPeriod`**.
  `recordAdjustment` derives `ownerId`/`listingId`/`period` from the published source, so a caller cannot
  point an adjustment at a statement it doesn't belong to. It refuses non-published sources.
- **R18.** **One open issue per statement line.** A second `raiseIssue` on the same line returns the
  existing open issue with `existing: true` instead of creating a duplicate.
- **R19.** Resolving an issue records `type: 'explained' | 'adjusted'`; the thread is preserved after
  resolution.

### 9.4 Permissions & isolation
- **R20.** Owner filter is the **outer** filter in every portal selector; no raw array is ever exposed.
- **R21.** Flipping any individual field marks the owner `templateId: 'custom'` so later template edits
  don't trample the override.
- **R22.** Template resolution always goes through `buildOwnerPermissionConfig` with `structuredClone`,
  so mutating the template array afterwards cannot change already-saved owner configs.
- **R23.** A dashboard with every metric hidden renders the "No metrics are visible" empty state, not a
  broken layout.

### 9.5 Stays
- **R24.** Date intervals are **`[checkIn, checkOut)`** everywhere. A stay ending exactly when another
  starts is not a conflict.
- **R25.** Conflicts are detected against three sources within the same `(listingId, unitId)` scope:
  non-cancelled **guest reservations**, **blocked dates**, and other **`active`** owner stays. A
  conflict blocks creation and emits `OWNER_STAY_CONFLICT` (CRITICAL). ⚠️ **Two of those three sources
  are never supplied from the portal** — see §18.6.
- **R26.** Annual owner-use cap is counted **per calendar year** over `active` stays with
  `countsAgainstOwnerUseCap`. A range spanning a year boundary is split and each year checked
  separately; the first exceeding year is reported. Default cap constant is 30 nights; the per-owner
  `annualOwnerUseNightCap` overrides it, and 0/absent means **no cap**.
- **R27.** Seasonal quotas are **non-accumulating** windows per (owner, listing): unused nights never
  roll over. `checkQuota` returns per-window `usedNights` / `requestedNights` / `remaining`.
- **R28.** Booking mode decides the path:
  - `direct` → stay created immediately as `active`; **annual cap exceeded blocks**, **quota exceeded
    blocks**; ops provisioned right away.
  - `request` → stay created as `pending_approval` and queued; quota is **advisory only** (staff decides);
    the request is mirrored into Reservations and `OWNER_STAY_REQUESTED` (WARNING) fires.
- **R29.** Approving promotes the stay to `active` and provisions ops. Rejecting stores a
  `decisionReason` that the owner sees in the portal.
- **R30.** Cancellation is **always immediate self-service** — no staff approval, at any notice.
- **R31.** Only `active` stays are directly editable by the owner; `pending_approval` stays are not.
- **R32.** Each stay carries three independent sync states (cockpit / channex / notifications), each
  retryable individually.

### 9.5a Reservations mirroring
- **R47.** **Every owner stay is mirrored into the Reservations module**, so staff see owner-occupied
  dates on `/reservations` next to guest bookings. Status follows the stay:

  | Stay event | Mirrored reservation status |
  |---|---|
  | Created in `request` mode | `owner_request` · blockReason "Owner stay — pending approval" |
  | Created in `direct` mode | `unverified` · blockReason "Owner stay" |
  | Request approved | `unverified` · blockReason "Owner stay" |
  | Request rejected | `cancelled` |
  | Stay cancelled by the owner | `cancelled` |

  The mirror also carries the resolved listing **name**, the stay's guest name, `totalPrice: 0`,
  `guestCount` from the stay, and `channel: 'Direct'`.
- **R48.** The link is `OwnerStay.reservationId`, written when the mirror is created.
  `bookingNote = "Owner request {stayId}"` is retained as a fallback match so rows created before the
  id was stored keep working. Both directions of the join go through one pair of helpers:
  `useOwnerStays.stayForReservation(reservationId, bookingNote?)` reads reservation → stay (id first,
  note as fallback) and `setMirroredReservationStatus` writes stay → reservation with the same dual
  match, so the two can never disagree.
- **R49.** `owner_request` is the **only** owner-specific `ReservationStatus`. It has its own label
  ("Owner Request") and badge, so it appears in the Reservations table, its status filter (built from
  `reservationStatusLabels`), the detail sheet and the guest page with no per-surface work.
  A **confirmed** owner stay deliberately carries no owner-specific marker in the table (D9): it reads
  as a normal `unverified` · `Direct` row, and the only traces are `blockReason: 'Owner stay'` and the
  `bookingNote`, neither of which is a rendered column.
- **R50.** A pending request can be decided from **three surfaces**, all calling the same
  `approveRequest` / `rejectRequest`:

  | Surface | Shape |
  |---|---|
  | `/cockpit` → Stay Requests | The triage queue. Always visible, with an empty state |
  | `/reservations` → panel above the filters | The same `OwnerStayApprovalsPanel`, **hidden when the queue is empty** |
  | `/reservations` → row `⋯` menu | Per-row **Approve owner stay** / **Reject owner stay…**, shown only on `owner_request` rows |

  Rejection always requires a reason (confirm disabled until non-empty). Deciding on any surface clears
  the item from all three, since `pendingRequests` filters on `status === 'pending'`.
- **R51.** `pendingRequestForStay(stayId)` returns a request only while it is `pending`, so an
  already-decided stay cannot be actioned twice from a stale view.

### 9.6 Ops provisioning (on a confirmed stay)
- **R33.** Pre-arrival cleaning job at `checkIn − 1 day, 11:00 +08:00` and post-stay cleaning at
  `checkOut, 11:00 +08:00` — both 180 min, priority high, team Housekeeping, linked by `reservationId = stay.id`.
- **R34.** When the listing has any paired smart lock, a range-bound access code is generated for the
  **first** lock, `checkIn 14:00 → checkOut 11:00 +08:00`, purpose "Owner stay".
- **R35.** On release: the access code is revoked and the **pre-arrival** job is deleted; the post-stay
  cleaning is left in place (the property still needs cleaning).
- **R36.** Stays checking in within 48 h emit `OWNER_STAY_APPROACHING` (INFO).

### 9.7 Documents & maintenance
- **R37.** A document is visible to an owner when it is `specific_owner` and lists them, **or**
  `all_owners` and the owner is mapped to one of its `listingIds`. This is what keeps co-ownership terms
  isolated.
- **R38.** New versions **bump `version` and chain `previousVersionId`**; revisions are never deleted.
- **R39.** Maintenance with `estimatedCost ≥ approvalThreshold` (500,000 IDR) enters
  `awaiting_owner_approval` and emits `MAINTENANCE_APPROVAL_REQUESTED` (WARNING) before any vendor
  starts. Below threshold it proceeds directly.
- **R40.** Staff can `emergencyOverride` past a missing owner response, recording an
  `emergency_override` approval status with a mandatory note.
- **R41.** A completed record can be synced to a statement period, stamping `syncedToStatementPeriod`.

### 9.8 Access
- **R42.** `requestMagicLink` **always** returns `{ sent: true }` regardless of whether the email exists —
  no owner-list enumeration via the login endpoint.
- **R43.** `acceptDemoLink` refuses on: no pending email, unknown email, `magicLinkStatus === 'revoked'`,
  or **unsigned contract**. Owner `status` is enforced through the same directory read.
- **R44.** `revokeAccess` sets `magicLinkStatus: 'revoked'`, logs it, **invalidates any live session
  immediately**, and emits `OWNER_LINK_REVOKED` (WARNING). It refuses for an already-inactive owner.
- **R45.** `regenerateAccess` refuses for an inactive owner ("reactivate first") and returns a fresh
  one-time URL.
- **R46.** Every lifecycle event is appended to the access log with actor and timestamp.

---

## 10. Flow Catalogue

Complete list of flows implemented in the codebase. **S** = staff-initiated, **O** = owner-initiated,
**A** = automatic.

### F1 · Onboard an owner (S)
`/users` → Owners tab → **Create ▾ → Owner** → `OwnerOnboardingDialog` (Sheet, 4 clickable steps).

1. **Basics** — name, email, phone, language, statement currency. Validated: email required and unique.
2. **Assignments** — one card per property: `PropertyPicker` (single-select, id-keyed), ownership %,
   operational costs covered %, effective-from, and an inline `CommissionRuleEditor`. "Add another" picks
   the first not-yet-assigned listing and auto-fills the remaining share; the commission rule for a new
   row starts **blank** rather than defaulting to a standard rate. Step guard mirrors R1.
3. **Permissions** — pick `full_transparency` / `financial_summary` / customize via
   `OwnerPermissionMatrix`; toggle **invite now**.
4. **Self-booking** — annual owner-use night cap + seasonal quota windows per assigned property.

On submit: `createOwner` (owner + mappings + rules + permissions, status `invited` or `draft`), then
`saveFee` per mapping, then `upsertQuota` per window. Toast names the outcome; the parent opens the new
owner's detail sheet.

### F2 · Browse & filter the roster (S)
`OwnersTable` — columns: **Owner** (avatar with a deterministic per-name colour), **Properties**,
**Ownership**, **Commission**, **Currency**, **Status**, and a row dropdown for the lifecycle actions.
Search / status / property filters live in `useOwners` (`filteredOwners`).

### F3 · Owner status lifecycle (S)
`draft → invited → active → inactive → active`, via `inviteOwner`, `activateOwner`, `deactivateOwner`,
`reactivateOwner` in the roster row menu. Illegal transitions return a typed error
(`Cannot transition owner from X to Y.`), never throw. See R5 for what is *not* guarded.

### F4 · Edit account & portal permissions (S)
`OwnerDetailSheet` → **Overview**: two independently editable cards — Account (name, email, phone,
language, currency, annual cap) and Portal permissions (template switch or per-field matrix). Read mode
renders locked muted rows with On/Off badges; edit mode renders clickable toggles.

### F5 · Edit properties, shares, fees & commission (S)
`OwnerDetailSheet` → **Properties**: one row per mapping showing listing, share, operational fee and
commission basis label. Edit dialog changes all four at once (mapping + fee + rule), enforcing R1–R3.
Add dialog auto-picks an unassigned listing.

### F6 · Contract generate → send → sign (S + O)
Staff work the contract from `OwnerDetailSheet` → **Properties** tab (bottom card, below the mappings):
**Send magic link to sign** when `draft`, **Regenerate from terms** while not yet `signed`, **Download
PDF** only once `signed`, plus a link through to the Document Center. `generateContract` builds it from
the owner's commission terms + operational fee; `sendContract` emits `OWNER_CONTRACT_SENT`. The owner lands on
`/owner-portal/contract` (reachable **without** a session by design), reviews covered listings,
commission basis text, included services and operational fee, draws a signature in `OwnerSignaturePad`,
ticks agreement, and signs. `signContract` stamps `signedAt` + signature image, emits
`OWNER_CONTRACT_SIGNED`, and calls `ensureContractDocument` so a contract-category document appears in
the owner's Document Center. Only then does `acceptDemoLink` stop refusing (R43).

### F7 · Configure self-booking rules (S)
`OwnerDetailSheet` → **Booking & Access**: the annual owner-use night cap (with an explanatory tooltip;
0 = no limit), a per-property booking-mode `Select` (`direct` / `request`, each with a plain-language
description of what it means), and seasonal quota CRUD with formatted `DD MMM YYYY` ranges. Shows an
empty state until at least one property is assigned. Despite the tab name, the **magic-link lifecycle
is not surfaced here** — see §18.5.

### F8 · Magic-link login (O)
`/owner-portal/login` → email → `requestMagicLink` (always success, R42) → "Check your email" state →
**Open demo secure link** → `acceptDemoLink`. On refusal the form checks `getPendingContract()`: if the
owner exists but hasn't signed, it routes to `/owner-portal/contract`; otherwise it shows a generic
"could not be opened" error. Success mints the session, logs `link_used`, and lands on `/owner-portal`.

### F9 · Revoke / regenerate portal access (S) — **domain only, no UI**
`revokeAccess` (R44), `regenerateAccess` (R45), `markLinkGenerated` and `getAccessLog` are fully
implemented, audited and tested (24 tests in `useOwnerAuth.spec.ts`), but **no component calls them** —
the access log and the revoke/regenerate controls were never built. See §18.5. The behaviour they
implement is still real for anything that calls the composable directly.

### F10 · Owner dashboard (O)
`/owner-portal` → `PortalDashboard`. Property picker over `assignedProperties`; KPI strip (Gross, Net,
Occupancy, ADR — each permission-gated) with `PortalYoYBadge` when prior-year data exists; an
owner-use-nights card; a **full-width revenue trend** chart with prior-year series, then half-width
Occupancy, ADR, Booking Sources and Guest Ratings cards; and an upcoming-reservations list.

**Share scaling is applied to money, not to rates.** `useOwnerDashboard` multiplies `grossRevenue`,
`expenses`, `taxes`, `platformFees` and `nightlyRateSum` by `ownershipPercentage / 100`; `occupiedNights`
and `availableNights` are left alone, so occupancy stays a true rate for the property rather than a
fraction of one. A 50% co-owner of `lst-3` sees half the revenue and the full occupancy percentage.
Empty state per R23.

### F11 · Statement archive (O)
`/owner-portal/statements` → `PortalStatementsArchive`. **Published statements only**, newest period
first, each row showing property, period and — if `netPayout` is visible — the payout figure.

### F12 · Read a statement & raise a per-line issue (O)
`/owner-portal/statements/[id]` → `PortalStatementDetail`: summary card, line items (each category gated
by the matching statement permission), channel breakdown, per-booking reservation table, adjustments
panel, prior-period delta, and export buttons. Any line can open `PortalRaiseIssueDialog`; submitting
calls `raiseIssue` (R18) and emits `OWNER_ISSUE_RAISED` (WARNING). A line that already has an open issue
shows the existing one instead of a second form.

### F13 · Export a statement (O)
PDF = `window.print()` against the print-oriented layout (portal chrome is tagged
`data-portal-chrome` so it can be excluded). XLSX = `mockExport('xlsx')` → a logged
`OwnerExportActivity` row + toast, no file. A complete branded A4 generator exists at
`app/lib/owner-statement-pdf.ts` but is **not wired to either button** (§18.8). By contrast the
*contract* PDF generator **is** wired, from the detail sheet and the portal contract page.

### F14 · Generate, preview & publish statements (S)
Owners tab → **Statements** (or `/owner-statements`) → `OwnerStatementsPanel`: rolling 12-month period
selector → **Generate** (R13, reports created/skipped) → draft queue → `StatementPublishDialog`, a
two-step review → confirm dialog with a fixed display order (revenue → expenses → commission → taxes →
adjustments → net payout), an in-flight flag that blocks duplicate publishes, and value locking once
published. `publish` freezes the snapshot (R16) and emits `OWNER_STATEMENT_PUBLISHED`.

### F15 · Correct a published statement (S)
Adjustment dialog → `recordAdjustment` (R17). The frozen statement is never touched; the correction
surfaces against the next period and in the owner's adjustments panel.

### F16 · Resolve a dispute (S)
`addIssueMessage` builds the thread; `resolveIssueWithResolution` closes it as `explained` or `adjusted`
(optionally linking the adjustment id) and emits `OWNER_ISSUE_RESPONDED` (INFO).

### F17 · Create an owner stay (O)
`/owner-portal/stays` → `PortalReservationCalendar`: a single-property six-week month grid with property
info + occupancy stats, property / room-type selector, month-year navigation and the owner's remaining
quota for the selected listing. Reservations render as absolutely-positioned bars over the day cells —
guest stays emerald, owner blocks amber. Per `app/lib/owner-reservations-layout.ts`, **each reservation
produces exactly one contiguous bar**, never split per week; `wrapsBackward` / `wrapsForward` flag a bar
clipped by the grid edge, and overlapping stays deliberately overlap on the same line. (The component's
own header comment still claims bars are split across weeks — stale, the lib is authoritative.)
**New owner reservation** →
`PortalStayDialog`. Submitting calls `requestStay`, which runs conflict detection (R25) → booking mode
(R28) → cap (R26) / quota (R27), then either creates an `active` stay and provisions ops, or files an
approval request. Typed refusals: `conflict`, `annual_cap_exceeded`, `quota_exceeded`, `invalid_dates`.
Either way the stay is **mirrored onto the Reservations page** per R47 — `owner_request` when it
queues, `unverified` when it is confirmed outright.

### F18 · Approve or reject a stay request (S)
Three entry points (R50), all on the same two functions:

1. **`/cockpit` → Stay Requests** — `OwnerStayApprovalsPanel`, the triage queue, enriched with owner and
   listing names.
2. **`/reservations` → panel above the filters** — the *same component*, wrapped in a card that is
   hidden while the queue is empty. Sits above the filter bar so it never reads as part of the filtered
   list.
3. **`/reservations` → row `⋯` menu** — **Approve owner stay** runs immediately;
   **Reject owner stay…** opens a reason dialog. Shown only on `owner_request` rows. The row resolves
   its request through `stayForReservation` → `pendingRequestForStay`; if nothing open is found it
   toasts an explanation rather than failing silently.

**Approve** → `approveRequest` → stay `active` + `provisionOwnerStayOperations` (R33–R35) + the mirrored
reservation flips to `unverified`. **Reject** → mandatory reason → stay `rejected`, request `rejected`,
the mirror flips to `cancelled`, and `OWNER_STAY_REJECTED` (INFO) carries the reason the owner reads in
the portal.

### F19 · Edit / cancel a stay & retry sync (O)
Owner edits an `active` stay (re-running conflict + cap checks) or cancels it immediately (R30 →
`OWNER_STAY_CANCELLED` WARNING), which also releases the mirrored reservation to `cancelled` so the
dates stop reading as occupied on `/reservations`. `PortalSyncStatus` shows the three sync targets and
offers a per-target **Retry**.

### F20 · Document Center (S + O)
Staff upload with category and visibility (`all_owners` + listings, or `specific_owner` + owners), bump
versions, inspect version history and download — from the Owners tab → **Documents** or
`/owner-documents`. Owners see only their own permitted set (R37) at `/owner-portal/documents` with
search and download. Uploads and version bumps emit `DOCUMENT_UPLOADED` (INFO).

### F21 · Maintenance cost approval (S + O)
Staff create a record; ≥ threshold it waits on the owner (R39). The owner approves or rejects with an
optional note at `/owner-portal/maintenance` (`ownerRespond`). Staff can emergency-override (R40),
advance status, complete with actual cost + invoice id (`MAINTENANCE_COMPLETED` INFO), and sync the cost
into a statement period (R41).

### F22 · Automatic side effects (A)
Ops provisioning and release (R33–R35), the 48 h upcoming-stay reminder (R36), and the 21 notification
emissions in §11.

---

## 11. Notifications

All owner alerts route through `useNotifications.createAlert(type, severity, context)` and appear in the
staff bell dropdown. Severity and deep-link target as implemented:

| Alert | Severity | Deep link | Emitted by |
|---|---|---|---|
| `OWNER_STATEMENT_DRAFT_READY` | INFO | `/owner-statements` | `generateForPeriod` (per draft) |
| `OWNER_STATEMENT_PUBLISHED` | INFO | `/owner-portal/statements` | `publish` |
| `OWNER_ISSUE_RAISED` | WARNING | `/owner-statements` | `raiseIssue` |
| `OWNER_ISSUE_RESPONDED` | INFO | — | `resolveIssueWithResolution` |
| `OWNER_STAY_CONFLICT` | **CRITICAL** | `/owner-portal/stays` | `createStay`, `updateStay` |
| `OWNER_STAY_CONFIRMED` | INFO | `/owner-portal/stays` | `createStay`, `updateStay` |
| `OWNER_STAY_REQUESTED` | WARNING | `/cockpit` | `requestStay` (request mode) |
| `OWNER_STAY_REJECTED` | INFO | `/owner-portal/stays` | `rejectRequest` |
| `OWNER_STAY_CANCELLED` | WARNING | `/cockpit` | `cancelStay` |
| `OWNER_STAY_APPROACHING` | INFO | `/owner-portal/stays` | `checkUpcomingStays` (48 h) |
| `OWNER_USE_CAP_EXCEEDED` | WARNING | `/users` | `createStay`, `updateStay` |
| `OWNER_LINK_REVOKED` | WARNING | `/users` | `revokeAccess` (no UI caller — §18.5) |
| `OWNER_CONTRACT_SENT` | INFO | `/owner-portal/contract` | `sendContract` |
| `OWNER_CONTRACT_SIGNED` | INFO | — | `signContract` |
| `DOCUMENT_UPLOADED` | INFO | `/owner-portal/documents` | `uploadDocument`, `updateDocumentVersion` |
| `MAINTENANCE_APPROVAL_REQUESTED` | WARNING | `/owner-portal/maintenance` | `createRecord` (≥ threshold) |
| `MAINTENANCE_COMPLETED` | INFO | `/owner-portal/maintenance` | `completeRecord` |
| `OWNER_BOOKING_MODE_CHANGED` | — | — | declared, **not emitted** |

`OWNER_STAY_CONFLICT` is the only CRITICAL owner alert — a double-booked property is a revenue and guest
incident, not an FYI.

---

## 12. Screen Specifications

### 12.1 Staff — `/users` Owners tab
Header with **Create ▾** (User / Owner), a 3-card KPI strip (users total/active/inactive), and top-level
tabs Users / **Owners** (count badge) / Roles. The Owners tab nests Owners / Statements / Documents.
Whole page is wrapped in `<ClientOnly>` with a skeleton fallback (SSR hydration rule).

### 12.2 Staff — `OwnerDetailSheet`
Sheet with 4 horizontally scrollable tabs (scroll-fade indicators appear only on the edge that still
has hidden tabs), reduced from an earlier 7-tab layout:

| Tab | Contents |
|---|---|
| **Overview** | Account card + Portal-permissions card, each independently editable |
| **Properties** | One row per mapping (listing · share · operational fee · commission basis) with an add/edit dialog that changes all four at once, **plus the contract card** (send / regenerate / download PDF / open Document Center) |
| **Financials** | The owner's statements with the publish dialog |
| **Booking & Access** | Annual owner-use cap, per-property booking mode, seasonal quotas |

### 12.3 Portal shell — `app/layouts/owner-portal.vue`
Tenant-branded: Guest-Guide colour tokens applied as scoped CSS variables, tenant primary logo, tenant
favicon via `useHead`. Login renders a centered card with the logo above it; every other route renders
`PortalSidebar` (Overview / Statements / My Stays / Documents / Maintenance) + `PortalHeader`
("Welcome back, {name}" + Sign out) inside a `SidebarProvider`.

### 12.4 Staff — `/reservations` owner surfaces
Two owner-specific additions to an otherwise unchanged page:

- **Pending owner stay requests** card between the KPI strip and the filter bar. Reuses
  `OwnerStayApprovalsPanel`; `v-if="pendingRequests.length"` so it disappears when the queue is empty
  (unlike the Cockpit, which is a triage page and keeps its empty state). Styled with theme tokens
  (`bg-muted/40`, muted icon) — the destructive count badge carries the urgency.
- **Row `⋯` actions** on `owner_request` rows only: *Approve owner stay* and *Reject owner stay…*,
  after a separator, the reject item in destructive text. The reject dialog names the owner and dates
  and requires a reason.

### 12.5 Portal route guard — `owner-portal.global.ts`
Any `/owner-portal/*` path without a session redirects to `/owner-portal/login`, with **two deliberate
exceptions**: `/owner-portal/login` and `/owner-portal/contract` (the owner must be able to sign before
they have access).

---

## 13. Validation & Error Taxonomy

Every mutation returns a typed result envelope; nothing throws for expected failure.

| Domain | Refusals |
|---|---|
| Owner | `Email is required.`, `An owner with this email already exists.`, `Owner not found.`, ownership-overflow message naming the scope, illegal status transition, deactivation coverage guard |
| Mapping / rule | `Mapping not found.`, `Commission rule not found.`, ownership overflow |
| Statement | `Invalid period "…" — expected YYYY-MM`, `not_publishable`, `not_editable`, `statement_not_found`, `not_published`, `invalid_line`, `issue_not_found`, `already_resolved` |
| Stay | `invalid_dates`, `conflict` (+ conflict list), `annual_cap_exceeded`, `quota_exceeded`, `not_found`, `already_cancelled`, `pending_approval`, `no_cancel_request`, `already_decided` |
| Contract | `not_found`, `invalid_status` |
| Document | upload validation, `ok: false` with message on download of a missing document |
| Maintenance | `not_found`, `not_awaiting_approval`, `already_decided` |
| Auth | `acceptDemoLink` returns a bare `{ ok: false }` — no reason leaked to the client; `Owner is already inactive.`, `Owner is inactive — reactivate before regenerating the link.` |

UI convention: `toast.success` / `toast.error` / `toast.info` for every mutation outcome; inline
destructive-red text for field-level validation.

---

## 14. Test Coverage

396 owner-related tests across 24 files. Nine were added for the Reservations mirroring: five covering
every stay-event → reservation-status transition (including regressions for the listing-name bug and the
stale-cancellation bug), and four for the row-action path — `stayForReservation` by id and by
`bookingNote` plus both miss cases, `pendingRequestForStay` returning only open requests, and
approve/reject resolved from a seeded reservation row.

| Area | File | Tests |
|---|---|---|
| Statement lifecycle | `tests/composables/useOwnerStatements.spec.ts` | 66 |
| Owner-scoped isolation | `useOwnerPortal.spec.ts` | 48 |
| Owner CRUD + ownership | `useOwners.spec.ts` | 55 |
| Permissions + snapshot semantics | `useOwnerPermissions.spec.ts` | 40 |
| Auth, gates, access log | `useOwnerAuth.spec.ts` | 24 |
| Stays, conflicts, caps | `useOwnerStays.spec.ts` | 23 |
| Dashboard time series | `useOwnerDashboard.spec.ts` | 12 |
| Quotas | `useOwnerQuotas.spec.ts` | 10 |
| Stay approvals + Reservations mirroring | `useOwnerStayApprovals.spec.ts` | 17 |
| Statement detail | `useOwnerStatementDetail.spec.ts` | 7 |
| Maintenance | `useOwnerMaintenance.spec.ts` | 7 |
| Documents / contracts | `useOwnerDocuments.spec.ts`, `useOwnerContracts.spec.ts` | 5 + 5 |
| Ops provisioning | `useOwnerStayOperations.spec.ts` | 3 |
| Onboarding wizard | `components/owners/OwnerOnboardingDialog.spec.ts` | 19 |
| Commission math | `lib/owner-commissions.spec.ts` | 12 |
| Calendar layout | `lib/owner-reservations-layout.spec.ts` | 9 |
| Ledger math | `lib/owner-ledger.spec.ts` | 9 |
| Portal components | `PortalReservationCalendar`, `PortalStatementDetail`, `PortalStays`, `PortalMagicLinkForm`, `PortalDashboard` | 10 / 8 / 5 / 5 / 3 |
| Publish dialog | `owner-statements/StatementPublishDialog.spec.ts` | 8 |

`in_preview`, the cancel-request decisions and the magic-link lifecycle are covered by composable tests
only — no component exercises them, because no component calls them (§18.1, §18.5).

**Whole-suite position.** Measured against a clean baseline of the same commit:

| | Failed | Passed | Total |
|---|---|---|---|
| Clean baseline | 19 | 751 | 770 |
| With this session's work | **13** | **766** | 779 |

The six repaired tests are all in `OwnerOnboardingDialog.spec.ts` — they were red on `main` because the
shared `PropertyPicker` could not select a property (id/name mismatch between what it emitted and what
the onboarding form expected), which also made step 2 of the wizard unusable. `vue-tsc` sits at 191
errors before and after, all pre-existing.

**Currently failing (3 owner tests, all pre-existing):**
1. `useOwnerPortal.spec.ts` › "exposes upcomingReservations from the owner's current period ledger only"
2. `StatementPublishDialog.spec.ts` › "a published statement has no editable controls"
3. `PortalMagicLinkForm.spec.ts` › "shows the current owner and clears the session on sign out" —
   `useSidebar()` injection error from `SidebarTrigger` inside `PortalHeader` under test.

---

## 15. Acceptance Criteria

- [x] An owner cannot log in until active, unrevoked **and** contract-signed.
- [x] `requestMagicLink` gives an identical response for known and unknown emails.
- [x] Ownership per `(listingId, unitId)` can never exceed 100%, from either the wizard or the detail sheet.
- [x] Flat, tiered (marginal) and hybrid commission all compute to 2 dp, on gross or a deduction-selected net base.
- [x] Publishing freezes a snapshot; editing the live lines afterwards does not change the owner's view.
- [x] A published statement cannot be edited; corrections appear as next-period adjustments.
- [x] A second issue on the same line returns the existing open issue.
- [x] A co-owner of the same property cannot read the other co-owner's statement, rule or stay.
- [x] Hiding every dashboard metric yields the explicit empty state.
- [x] An owner stay overlapping a guest reservation, blocked date or other active stay is refused with the conflicting rows.
- [x] `direct` mode blocks on cap/quota; `request` mode queues with quota advisory only.
- [x] Approving a request provisions two cleaning jobs and (where a lock exists) an access code; cancelling revokes the code and deletes the pre-arrival job.
- [x] Owners see only documents shared with them specifically or via a listing they own.
- [x] Maintenance ≥ 500,000 IDR waits for the owner unless emergency-overridden.
- [x] The portal renders tenant logo, favicon and Guest-Guide colours.
- [x] Every owner stay appears on `/reservations` — from a cold start, not only when created at runtime.
- [x] Cancelling an owner stay releases its mirrored reservation, so the dates stop reading as occupied.
- [x] A pending request can be approved or rejected from the Cockpit, the `/reservations` panel, or the
      row menu, and deciding on one clears it from all three.
- [x] Rejecting always requires a reason.

Not yet true (see §18.6, §18.7): an owner cannot book over a confirmed guest booking; cancelling a stay
revokes its door code.

---

## 16. Dependencies

`useCleaningJobs`, `useSmartLock`, `useReservationsModule`, `useNotifications`, `useTaskStore`,
`useTenantBranding`, `listings` (for names, seasonal rates, unit types), `jspdf`,
`@internationalized/date`, TanStack-style plain tables, shadcn-vue primitives.

---

## 17. Non-Functional Notes

- **Reactivity** — every owner mutation replaces state via spread; no in-place property assignment.
- **SSR** — `/users` and the portal's Reka-UI-heavy surfaces are `<ClientOnly>`-wrapped to avoid
  hydration mismatches (same class of bug as the Listings table icon reuse).
- **Purity** — commission math, ledger math, ownership rebalancing and calendar layout are pure modules
  with dedicated unit tests, deliberately framework-free.
- **Accessibility** — icon-only buttons carry `aria-label`s; the calendar and sync chips expose
  `aria-label`; dialogs use the shadcn `Dialog`/`Sheet` primitives.
- **Print** — the statement detail layout marks portal chrome with `data-portal-chrome` so the PDF path
  (`window.print()`) can exclude it.

---

## 18. Known Gaps & Defects

Ordered by how likely they are to bite. Items 18.1–18.7 are **findings from reading the code**, not
previously documented; **18.8 is the accepted-gap register**. Since the 2026-09-01 decisions, **18.1 and
18.3 are resolved as deletions**, most of 18.5 is superseded by D4, and four rows of 18.8 are closed —
each annotated inline. **§18.2, §18.4, §18.6 and §18.7 remain open work**, and §18.6 is the one with a
guest-facing consequence.

### 18.1 The 72-hour cancellation-approval path is dead code
`CANCEL_CUTOFF_HOURS = 72`, `isWithinCancelWindow()`, `hoursUntilCheckIn()`, the
`OwnerStay.cancelRequest` field and both `approveCancelRequest` / `denyCancelRequest` are implemented
and typed — but **no UI or composable ever creates a `cancelRequest`**, and neither decide function has
a caller outside its own module. `cancelStay` always cancels immediately (R30).

> **Decided — D1: delete it.** Owner cancellation stays immediate self-service, guarded only by a
> confirmation dialog. That dialog already exists in `app/pages/owner-portal/stays.vue`
> (`cancelTarget` → reason textarea → `confirmCancel`), so the UI side needs nothing. The work is
> removal only: `CANCEL_CUTOFF_HOURS`, `isWithinCancelWindow`, `hoursUntilCheckIn`,
> `OwnerStay.cancelRequest`, `approveCancelRequest`, `denyCancelRequest`, and the `no_cancel_request` /
> `already_decided` refusals that only those two functions returned.

### 18.2 Statement generation cannot see owners created at runtime
`generateForPeriod` reads the **module seed arrays** — `mockOwners`, `mockOwnerPropertyMappings`,
`mockCommissionRules` — not the reactive `useOwners` buckets. `useOwners` seeds
`elev8-owner-property-mappings` and `elev8-owner-commission-rules` with `structuredClone`, so a mapping
or rule created through onboarding is **never visible to generation**, and a newly onboarded owner will
never receive a statement. (Owners themselves are borderline: `useOwnerAuth` seeds the shared owner
bucket by reference while `useOwners` seeds it with a clone, so whether a new owner appears in
`mockOwners` depends on which composable initialized first — an init-order coupling that should not
decide business behaviour.) `StatementPublishDialog` and `OwnerStatementsPanel` also resolve owner names
from `mockOwners`, so a runtime owner would render as a raw id. **Fix:** read `useOwners()` state in all
four places.

### 18.3 The high-season approval rule is not wired
`isHighSeasonRange(listingId, checkIn, checkOut)` exists, is documented as "Flow 4, Rule A vs B", is
exported from the data barrel — and is **called by nothing**. `OwnerStayApprovalsPanel`'s header comment
still describes itself as "the high-season manual path", but `requestStay` routes purely on the
per-(owner, listing) `bookingMode`. A stay in peak season under `direct` mode is auto-approved as long
as quota and cap allow. Either wire `isHighSeasonRange` into `requestStay` as an additional
force-to-queue condition, or drop it and correct the comments.

> **Decided — D2: drop it.** There is no forced approval on season. Owner self-booking is governed by
> the quota windows and the booking mode alone — exactly how `requestStay` already behaves. Delete
> `isHighSeasonRange`, remove it from the data barrel, and fix the stale comments in
> `OwnerStayApprovalsPanel.vue` and `owner-stay-approvals.ts` that still describe a high-season path.

### 18.4 `PortalStays.vue` is orphaned
`/owner-portal/stays` renders `PortalReservationCalendar` + `PortalStayDialog`. `PortalStays.vue` is
mounted only by its own spec file. It duplicates cancel/retry logic that now lives in the page. Delete
it (and its spec) or fold it back in — right now 5 tests guard a component no user can reach.

### 18.5 Three implemented sub-systems have no UI at all
Fully built, typed, audited and unit-tested — but no component calls them, so no user can reach them:

| Sub-system | Composable API | Missing surface |
|---|---|---|
| **Magic-link lifecycle (Flow 8 admin side)** — ⚠️ *superseded by D4, do not build* | `revokeAccess`, `regenerateAccess`, `markLinkGenerated`, `getAccessLog` + the 7-action `PortalAccessLogEntry` enum and `portalAccessActionLabels` | An access-log panel with Revoke / Regenerate. The **Booking & Access** tab name implies it, but the tab only holds cap + booking mode + quotas — `OwnerDetailSheet` does not even import `useOwnerAuth`. Consequence today: `OWNER_LINK_REVOKED` can never fire, and R44's session invalidation is unreachable. **D4 removes magic links entirely**, so this panel should never be built — the whole sub-system gets deleted instead. |
| **Statement preview state** | `moveToPreview`, `backToDraft` | `in_preview` is a real status in the type union and the publish path accepts it, but staff can only go `draft → published`. The "review it exactly as the owner will see it" step described in the code comments does not exist in the UI. |
| **Late-cancel approval** | `approveCancelRequest`, `denyCancelRequest` | See §18.1. |

Each is a small wiring job, not new design — the domain logic is already there and tested.

### 18.6 Conflict detection is inert from the owner portal
R25 promises three conflict sources, but `PortalStayDialog` calls `requestStay` with **neither
`guestReservations` nor `blockedDates`** — it passes only owner, listing, dates, guest count and notes.
`detectConflicts` therefore checks the one source it reads from its own state (other `active` owner
stays) and silently sees an empty list for the other two.

**Consequence: an owner can currently book dates that overlap a confirmed guest booking.** The guard
exists, is correct and is unit-tested with reservations injected — it is simply never handed the data in
the running app.

The fix is small (pass `useReservationsModule().reservations` and the listing's `blockedDates` into
`requestStay`), but it **changes behaviour**: owners would start being refused dates they can book
today, so it wants a deliberate go-ahead rather than a silent patch. One caveat once it lands — owner
stays are now mirrored into Reservations (R47), so the mirrors must be filtered out of the conflict
source or an owner stay will conflict with its own reservation. `OwnerStay.reservationId` (R48) makes
that filter a one-liner.

### 18.7 Cancelling a stay never releases its cleaning jobs or door code
`releaseStayOperations` implements R35 — revoke the smart-lock code, delete the pre-arrival cleaning job
— and is **called by nothing except its own test**. `cancelStay` updates the stay and (since this
revision) the mirrored reservation, but never releases the provisioned operations.

**Consequence: a cancelled owner stay leaves a live door code on the lock and two cleaning jobs on the
schedule.** The access code is the serious half.

Wiring it is one call in `cancelStay`, but it revokes real door access, so it is listed here rather than
folded into the mirroring fix.

### 18.8 Platform gaps (known, accepted for this phase)

| Gap | Detail | Risk |
|---|---|---|
| **No persistence** | Zero owner state touches LocalStorage or a server; every bucket is `useState` seeded from fixtures | A reload wipes every owner, statement, stay and session created in-session |
| **Real authentication** | Demo magic link accepted on the same device; no email, token, expiry or httpOnly cookie | Demo only; no real security boundary |
| **Real ledger** | Statements derive from 86 hand-authored ledger rows, not live Finance data | Numbers will not match real bookings until wired — **direction set by D3: read from the Finance module** |
| **Real integration sync** | `syncState` for cockpit / channex / notifications is simulated; `retrySync` flips a flag | Availability can silently drift from the real channel manager |
| **XLSX export** | `mockExport('xlsx')` logs activity and toasts; no file | No structured artifact for accounting |
| **PDF wiring** | Owner-facing PDF is `window.print()`. `app/lib/owner-statement-pdf.ts` — a complete branded A4 generator (header, owner split, cost share, payout figure, deduction summary, per-booking table) — has **zero callers** | A finished generator ships dead while owners get a browser print-out |
| ~~**Payout execution**~~ | **Closed by D5** — net payout is display-only by design; the transfer happens by bank outside Elev8 and the system does not track it | None. No longer a gap |
| **`OWNER_BOOKING_MODE_CHANGED`** | Alert type declared with label, icon and route but never emitted | Silent config change |
| **OTP actions** | `otp_sent` / `otp_verified` / `session_expired` exist in the access-log enum with no emitter | Audit trail incomplete for a future 2FA flow |
| **Multi-currency sums** | IDR + USD ledgers summed as raw numbers; no FX fixture | **Closed by D7** as a design rule — no conversion, ever. But the rule must now be *enforced*: a cross-currency scope should be refused at mapping time rather than silently summed (see D7) |
| **Multi-language** | Owner `language` stored, portal is English-only | Indonesian owners get an English portal |
| ~~**Custom date ranges**~~ | **Closed by D6** — monthly (`YYYY-MM`) is the only unit by design | None. No longer a gap |
| **Cross-property comparison** | One property at a time via the picker | Multi-property owners can't compare side by side |
| **Owner self-registration** | Staff-created only | No self-serve onboarding |
| **Real-time updates** | Values refresh on navigation only | Stale until reload |

---

## 19. Decisions

Seven of the eight questions in the previous revision are now decided (2026-09-01), plus two decisions
taken while building the Reservations mirroring (D9, D10). Sections 1&ndash;18 describe the code
**as built**; this section is the **forward** record &mdash; what changes, and what work each decision
implies. One item remains open.

| # | Decision | Effect |
|---|---|---|
| **D1** | Owner cancellation needs **no approval** &mdash; a confirmation dialog is enough | Deletes the dead 72 h path (§18.1). Confirms R30 as final |
| **D2** | **No forced approval.** Quota settings + booking mode govern self-booking | Deletes `isHighSeasonRange` (§18.3) |
| **D3** | Statement data comes from the **Finance module**, not a dedicated owner ledger | Replaces the 86-row fixture; largest data-layer change |
| **D4** | **No magic link.** Owners log in on the same page as staff; a detected owner role renders the portal | Removes the whole magic-link sub-system; see §19.1 |
| **D5** | Net payout is **display-only** | Closes the payout gap with zero work |
| **D6** | **Monthly statements only** (`YYYY-MM`) | Closes the custom-range gap with zero work |
| **D7** | **No FX conversion** &mdash; a statement is single-currency | Closes the FX gap, but adds a guard (§19.2) |
| **D9** | Mirror status semantics: pending `owner_request`, confirmed `unverified`, released `cancelled`. **No `Owner` channel, no `owner_stay` status** | Settles R47/R49; see §19.3 |
| **D10** | A request can be decided from the Cockpit queue, a panel on `/reservations`, or the row menu | R50 |
| **Q8** | *Open* &mdash; confirm with Finance that `basisDeductions` maps 1:1 to their ledger components | Blocks D3's wiring |

---

### 19.1 D4 — unified login, role-based surface

The largest of the seven. Owners stop having a separate front door: they sign in at the **same login
page as staff**, and the app decides what to render from their role.

**Target flow**

1. Owner enters email + password at the shared login page (today `app/components/auth/SignIn.vue`, a
   mock that hard-codes `demo@gmail.com` / `password` and always lands on `/`).
2. On success the app resolves the account's role. Staff roles land on `/`; an account carrying
   **`role-owner`** lands on `/owner-portal`.
3. `role-owner` **already exists** in the staff role system (`app/components/users/data/roles.ts`) —
   so this needs no new role, only routing that reads it. Note this reverses an explicit constraint in
   the V1 document, which said owners are "never the internal `role-owner`".
4. Contract gate still holds: an authenticated owner who has not signed is routed to
   `/owner-portal/contract`. This is *simpler* than today — the route stops needing its session-less
   exception and becomes "session required, contract not yet signed".

**Gates become** (replacing the three in §1): account **active** · role is **`role-owner`** ·
contract **e-signed**.

**Delete**

| Deleted | Notes |
|---|---|
| `requestMagicLink`, `acceptDemoLink` | The whole demo-link handshake |
| `PortalMagicLinkForm.vue`, `/owner-portal/login` | Replaced by the shared login page |
| `revokeAccess`, `regenerateAccess`, `markLinkGenerated` | Revoking access becomes "deactivate the account" — one mechanism instead of two |
| `Owner.magicLinkStatus`, `magicLinkLastGeneratedAt`, `accessRevokedAt` | No link to have a status |
| `OWNER_LINK_REVOKED` alert | Nothing left to emit it |
| Log actions `link_generated`, `link_revoked`, `link_regenerated`, `link_used` | See below |
| **R42, R44, R45** | Superseded. R43's contract check and R46's audit obligation survive |

**Keep, with changes**

- **R42's intent survives, ownership moves.** Not leaking whether an email exists is still required —
  it just becomes the shared login page's responsibility, for staff and owners alike, rather than
  something the owner portal solves for itself.
- **The access log survives, its vocabulary changes.** `PortalAccessLogEntry` keeps its shape; the four
  `link_*` actions give way to `login` / `logout` / `session_expired`. `otp_sent` / `otp_verified`
  become live rather than dead if the shared login gains 2FA. Whether this log stays owner-specific or
  folds into a general account audit is a sub-decision worth taking deliberately.
- **The portal layout, sidebar and every owner-scoped selector are untouched.** `useOwnerPortal` reads
  `session.ownerId`; only *how that session is minted* changes. This is why D4 is a large deletion but
  a small rewrite.

**Assumption to confirm.** "Detect their role" reads most naturally as: an owner has an account in the
same auth space carrying `role-owner`, while the `Owner` record keeps the business data (shares,
commission, statements, quotas) and is linked by id. Two datasets, one credential. The alternative —
giving the `Owner` record its own credentials — would keep the datasets fully separate but means two
auth paths behind one form, which is the thing D4 is trying to remove. **Proceeding on the linked-account
reading**; say so if you meant the other.

---

### 19.2 D7 — the no-conversion rule needs a guard

Answering "no conversion" closes the FX gap as a *design* question, but it does not make today's
behaviour correct. Right now a co-owned property whose ledger currency differs from an owner's
`statementCurrency` still gets summed as raw numbers, which produces a wrong figure silently rather than
refusing.

Making D7 real means one guard: a statement must be single-currency, so a mapping that would place an
owner on a property in a currency other than their `statementCurrency` should be **refused at mapping
time** (onboarding step 2 and the detail-sheet edit dialog), with a message naming both currencies.
That turns an invisible arithmetic error into a visible configuration error at the point someone can
fix it. Small change, and it is what makes the rule true.

---

### 19.3 D9 — how the mirror status landed where it did

Three shapes were built and two were reverted. Recording the path so it is not re-litigated:

| Attempt | Confirmed stay | Channel | Outcome |
|---|---|---|---|
| 1 | `blocked` · blockReason "Owner stay" | `Direct` | Rejected — an owner stay is a reservation, not a manual calendar block |
| 2 | `unverified` | new `Owner` channel | Channel reverted — owner use is not a distribution channel, and the signal belongs in the status |
| 3 | new `owner_stay` status | `Direct` | Reverted — not worth a new status |
| **Final** | **`unverified`** | **`Direct`** | Shipped |

**Consequence, accepted:** a confirmed owner stay is **indistinguishable from a guest booking** in the
Reservations table — same `Unverified` badge, same `Direct` channel. Only *pending* requests stand out,
via the `Owner Request` badge. The record still carries `blockReason: 'Owner stay'` and
`bookingNote: 'Owner request {stayId}'`, so if confirmed owner nights ever need to be identifiable the
cheap options are surfacing `blockReason` as a column or reviving the `owner_stay` status — both without
reintroducing a channel.

Two side effects of getting here that are worth knowing:
- The `channel` union (`'Airbnb' | 'Booking.com' | 'Direct'`) was widened and narrowed again with no
  consumer breakage, which confirms nothing outside the mirror had started depending on `'Owner'`.
- `owner_stay` still exists elsewhere in the codebase as an unrelated identifier — the
  `OwnerStayConflictType`, the operations-calendar `CalendarEventType`, and the `OWNER_STAY_*` alert
  types. Only the short-lived `ReservationStatus` member was removed.

---

### 19.4 Work implied, in dependency order

1. **Deletions** — D1, D2, and the D4 magic-link removal. No new design, no dependencies; also removes
   two of the five §18 findings and most of §18.5.
2. **The D7 mapping guard** — one validation, mirrored in the two places R1 is already enforced.
3. **D4 routing** — role resolution on the shared login, the portal redirect, and the contract-gate
   move from session-less to session-required.
4. **§18.2 fix** — make `generateForPeriod` read `useOwners()` state instead of the seed arrays. Worth
   doing *before* D3, because D3 replaces the data source and this bug is about reading the wrong
   *store*; fixing it first keeps the two changes separable.
5. **D3, once Q8 is answered** — repoint statement generation at Finance. The largest change, and the
   one that finally makes the numbers real.

D5 and D6 require no work: they ratify what is already built.

---

## 20. File Inventory

**Pages (11)**
```
app/pages/users/index.vue                        # staff hub (Owners tab)
app/pages/owner-statements/index.vue             # staff statements (standalone)
app/pages/owner-documents/index.vue              # staff documents (standalone)
app/pages/cockpit.vue                            # hosts OwnerStayApprovalsPanel
app/pages/owner-portal/login.vue
app/pages/owner-portal/contract.vue
app/pages/owner-portal/index.vue
app/pages/owner-portal/statements/index.vue
app/pages/owner-portal/statements/[id].vue
app/pages/owner-portal/stays.vue
app/pages/owner-portal/documents.vue
app/pages/owner-portal/maintenance.vue
```

**Layout & middleware**
```
app/layouts/owner-portal.vue
app/middleware/owner-portal.global.ts
```

**Staff components (16)** — `app/components/owners/`
`OwnersTable`, `OwnerFilters`, `OwnerOnboardingDialog`, `OwnerOnboardingBasics`,
`OwnerOnboardingAssignments`, `OwnerOnboardingPermissions`, `OwnerOnboardingSelfBooking`,
`OwnerDetailSheet`, `OwnerPermissionMatrix`, `CommissionRuleEditor`, `OwnerStatementsPanel`,
`StatementTable`, `OwnerDocumentsPanel`, `OwnerMaintenancePanel`, `OwnerStayApprovalsPanel`
· plus `app/components/owner-statements/StatementPublishDialog.vue`

**Portal components (26)** — `app/components/owner-portal/`
`PortalMagicLinkForm`, `PortalSidebar`, `PortalHeader`, `PortalDashboard`, `PortalKpiCard`,
`PortalPropertyPicker`, `PortalYoYBadge`, `PortalRevenueChart`, `PortalOccupancyChart`,
`PortalAdrChart`, `PortalSourcesChart`, `PortalRatingsChart`, `PortalChannelBreakdown`,
`PortalStatementsArchive`, `PortalStatementDetail`, `PortalStatementSummary`,
`PortalStatementReservations`, `PortalStatementAdjustments`, `PortalStatementPeriodDelta`,
`PortalRaiseIssueDialog`, `PortalExportButtons`, `PortalReservationCalendar`,
`PortalOwnerReservationPopover`, `PortalStayDialog`, `PortalStays` (orphaned, §18.4), `PortalSyncStatus`
· plus `app/components/OwnerSignaturePad.vue`

**Data layer (17)** — `app/components/owners/data/`
`index.ts`, `owners.ts`, `commission-rules.ts`, `owner-contracts.ts`, `owner-operational-fees.ts`,
`owner-permissions.ts`, `owner-portal-access.ts`, `owner-ledger.ts`, `owner-statements.ts`,
`owner-statement-reservations.ts`, `owner-stays.ts`, `owner-stay-approvals.ts`, `owner-quotas.ts`,
`owner-reservations.ts`, `owner-reservations-seed.ts`, `owner-documents.ts`, `owner-maintenance.ts`

**Composables (15)** — see §8 · **Libs (4)** — `owner-contract-pdf.ts`, `owner-statement-pdf.ts`,
`owner-reservations-layout.ts`, `owners/lib/ownership-rebalance.ts`

**Reservations-module files this feature touches**
```
app/components/reservations/data/reservations.ts   # 6 owner-stay mirror seed rows
app/components/reservations/ReservationTable.vue   # approveOwnerStay / rejectOwnerStay row actions
app/pages/reservations/index.vue                   # approvals panel + row handlers + reject dialog
app/components/reservations/ReservationStatusBadge.vue  # owner_request badge (pre-existing)
```

**Tests (24 files, 387 tests)** — see §14
