# PRD: Owner Portal — Property Owner Management, Statements & Performance Dashboard

**Status:** V1 + V2 Implementation Complete
**Owner:** Juli (Product)
**Module:** Owners, Owner Statements, Owner Portal (external)
**Integration:** Cockpit (bookings), Channex (availability sync), Notifications
**Last Updated:** 2026-08-19

---

## TL;DR (Developer Quickstart)

**What is this?** A dedicated, white-labeled Owner Portal for external property owners, plus the tenant-side tools to onboard and manage them.

**Two isolated surfaces, one shared domain:**
- **Tenant (staff) surface** — `/owners` (owner directory, 3-step onboarding, detail sheet with permissions) and `/owner-statements` (monthly Draft → Published workflow, next-period adjustments).
- **Owner (external) surface** — `/owner-portal` with magic-link login, a 12-month performance dashboard, published statement archive + read-only statement detail, and a My Stays reservation calendar. Uses a dedicated `owner-portal` layout with tenant branding.

**What does it do?**
- Owners are a new external client type — separate dataset and session, never the internal `role-owner`.
- Staff assigns properties/rooms to owners with **ownership %** (≤100% per scope) and **commission rules** (flat / tiered / hybrid).
- Monthly statements are computed from a deterministic mock ledger, published as **immutable snapshots**, and corrected via **next-period adjustments** (never recalculated in place).
- Every owner-visible value is **ownership-share-scaled** and **field-permission-gated** (Full Transparency / Financial Summary / custom matrix).
- Owners see **only their own data** — the owner filter is always the outer filter, even for co-owners of the same property.

**Key files:**
| File | Purpose |
|---|---|
| `app/pages/owners/index.vue` | Tenant: owner directory + onboarding + detail sheet |
| `app/pages/owner-statements/index.vue` | Tenant: draft queue, publish, adjustments |
| `app/pages/owner-portal/{index,login,stays,statements}.vue` | External: dashboard, login, stays, archive |
| `app/components/owners/` | Tenant components (table, KPIs, onboarding, detail, permissions, commission editor) |
| `app/components/owner-portal/` | Portal components (dashboard, charts, statement detail, reservation calendar) |
| `app/components/owners/data/` | Domain types + seeds (owners, ledger, statements, commission rules, permissions, stays, reservations) |
| `app/composables/useOwners.ts` | Owner CRUD, mappings, status transitions |
| `app/composables/useOwnerPortal.ts` | Owner-scoped facade selectors (no raw arrays exposed) |
| `app/composables/useOwnerDashboard.ts` | 12-month time series + YoY deltas |
| `app/composables/useOwnerStatements.ts` | Generation, publish, issues, adjustments |
| `app/composables/useOwnerStays.ts` | Stay conflict detection, cap warnings, sync states |
| `app/composables/useOwnerPermissions.ts` | Template + per-owner field visibility |
| `app/composables/useOwnerAuth.ts` | Demo magic-link session |
| `app/layouts/owner-portal.vue` | White-labeled portal layout |

**Dashboard chart layout (canonical):** revenue-trend area chart spans **full width at top**; Occupancy, ADR, Booking Sources, and Guest Ratings sit in **half-width cards beneath**. ADR is always its own standalone chart, never bundled into another.

---

## Table of Contents
1. Problem Statement
2. Feature Summary
3. Scope
4. Roles & Access
5. Architecture Overview
6. Data Model
7. Business Rules
8. User Flows
9. Component Specifications
10. State Management
11. Notifications
12. Acceptance Criteria
13. Known Gaps
14. Dependencies & Open Questions
15. File Inventory

---

## 1. Problem Statement

Property owners currently receive ad-hoc, non-transparent payouts and have no self-service view of their properties' performance. Staff manage ownership relationships through spreadsheets — ownership shares, commission structures, and who-can-see-what are not tracked anywhere.

**Owner Portal fixes this:** staff get a structured owner directory with validated ownership/commission rules and a monthly statement workflow; owners get a branded portal showing exactly what they're entitled to see — performance trends, published statements, and a calendar to block their own stays — with strict isolation between owners.

---

## 2. Feature Summary

| Sub-feature | What it does |
|---|---|
| **Owner directory** | Tenant-side CRUD for external owners (name, contact, language, statement currency, status) with invite / activate / deactivate / reactivate. |
| **Onboarding (3-step)** | Basics → property/room assignments with ownership % + commission rule → permission template + invite-now toggle. Blocks duplicate email, >100% ownership, invalid commission config. |
| **Commission rules** | Flat (%), tiered (progressive revenue bands), hybrid (fixed monthly + %). Effective-dated per owner + property. |
| **Field permissions** | Templates (Full Transparency / Financial Summary) or per-owner custom matrix over 7 dashboard fields + 6 statement fields. Hidden fields are omitted, never dimmed. |
| **Monthly statements** | Deterministic generation from a dedicated mock ledger → Draft → Publish (immutable snapshot) → archive. |
| **Adjustments** | Post-publication corrections become next-period adjustment lines; published values never change in place. |
| **Owner issues** | One open issue per statement line; staff sees it and gets a notification. |
| **Portal login** | Mock email magic-link; generic "link sent" state (no email enumeration); demo secure link for seeded owners. |
| **Performance dashboard** | 4 KPI cards (Gross/Net Revenue, Occupancy, ADR) with YoY badges; 12-month trend charts; property picker when >1 assignment; owner-use nights KPI. |
| **Statement detail** | Read-only drill-down: summary KPIs with prior-period deltas, channel breakdown, per-reservation table, adjustments, print-to-PDF, raise issue. |
| **My Stays** | Airbnb-style month grid of guest stays + owner blocks; create/edit/remove owner blocks with conflict checking and annual owner-use cap advisory. |
| **Owner isolation** | Owner filter is always the outer filter; portal composables never expose raw source arrays; co-owners cannot see each other's data. |

---

## 3. Scope

**In scope:**
- Tenant owner directory, onboarding, profile management, assignments, ownership shares, commission rules
- Permission templates + per-owner field visibility (dashboard + statement)
- Deterministic owner statement calculation from a dedicated mock ledger
- Monthly Draft → Published workflow, immutable snapshots, next-period adjustments
- One open issue per statement line, surfaced to staff with notification
- Separate `/owner-portal` realm with mock magic-link login and route guards
- Branded portal layout (tenant logo, favicon, branding color variables)
- Owner dashboard: KPI strip + 12-month + YoY charts (revenue full-width; occupancy, ADR, sources, ratings half-width)
- Statement archive + read-only detail with per-reservation drill-down, channel breakdown, prior-period comparison
- Print-to-PDF export (`window.print()`) with dedicated print stylesheet
- Owner self-stay create / modify / cancel, conflict checking, annual cap warnings, mock downstream sync states
- Staff + owner notifications for statement, stay, conflict, issue, and cap events
- Automated domain, isolation, composable, and component tests

**Out of scope (V1/V2):**
- Real email delivery / auth provider (login is a demo magic-link)
- Real Cockpit or Channex API calls (sync states are simulated client-side)
- Real scheduled jobs (draft generation is a manual button)
- Real PDF/XLSX file generation (PDF = browser print; XLSX = mock toast)
- Payout execution
- Cross-tenant owner account switching
- Threaded dispute conversations
- Custom date-range statements
- Cross-property comparison, LLM narrative summaries, chart→statement drill-down, multi-language (see §13 Known Gaps)

---

## 4. Roles & Access

| Role | Access |
|---|---|
| **Admin** | Full: manage owners, onboarding, commission rules, permissions, generate/publish statements, record adjustments, view issues |
| **Guest Experience Manager** | Onboard/activate owners, view statements, resolve owner issues |
| **Owner (external)** | Portal only: own dashboard, published statements, My Stays, raise issues. Never tenant surfaces, never other owners' data |

External owners are stored in a separate dataset with a separate mocked session. The existing internal `role-owner` staff role is untouched.

---

## 5. Architecture Overview

One shared Owner domain, two isolated UI surfaces.

```
┌─ Tenant staff surface ──────────────────────────────┐
│ /owners                 /owner-statements           │
│  OwnersTable              Draft queue               │
│  OwnerOnboardingDialog    Publish flow              │
│  OwnerDetailSheet         Record adjustment         │
└──────────────────────┬──────────────────────────────┘
                       │ owner-scoped selectors only
┌──────────────────────▼──────────────────────────────┐
│ Shared domain layer                                 │
│  types + seeds (owners, ledger, statements,         │
│  commission, permissions, stays, reservations)      │
│  composables: useOwners, useOwnerAuth,              │
│  useOwnerPermissions, useOwnerStatements,           │
│  useOwnerStays, useOwnerPortal (facade),            │
│  useOwnerDashboard, useOwnerStatementDetail         │
└──────────────────────┬──────────────────────────────┘
                       │ currentOwner-scoped data only
┌──────────────────────▼──────────────────────────────┐
│ Owner portal surface (white-labeled)                │
│ /owner-portal/login   → /owner-portal               │
│   PortalDashboard       statements/[id]  stays      │
└─────────────────────────────────────────────────────┘
```

### Architecture properties
- **Facade pattern:** owner-facing code queries only through `useOwnerPortal` owner-scoped selectors. It never receives the complete owner directory or unfiltered statements, stays, mappings, commission rules, or issues.
- **Owner filter is outer:** every selector filters by owner mapping *before* property, period, status, or search filters. Co-ownership of one property does not weaken isolation.
- **Permission gate is composable-side:** composables apply `canViewDashboardField` / `canViewStatementField` and return empty series/sections when gated off. Components just `v-if` on empty data — they never check permissions directly.
- **Immutable published statements:** `publishedSnapshot` is a frozen deep clone; corrections flow to the next period only.
- **One shared layout + branding:** `owner-portal` layout applies tenant branding CSS variables and favicon without changing the dashboard theme.

---

## 6. Data Model

```
Owner {
  id, name, email, phone,
  language: 'en' | 'id',
  statementCurrency: 'IDR' | 'USD' | 'AUD' | 'SGD' | 'EUR',
  status: 'draft' | 'invited' | 'active' | 'inactive',
  annualOwnerUseNightCap?: number,
  invitedAt?, activatedAt?, createdAt, updatedAt
}

OwnerPropertyMapping {
  id, ownerId, listingId, unitId?,
  ownershipPercentage,          // ≤100% across owners of same scope
  commissionRuleId,
  effectiveFrom, effectiveTo?
}

CommissionRule = discriminated union {
  flat     { rate }                                  // % of revenue basis
  tiered   { tiers: [{ upTo, rate }] }               // progressive bands
  hybrid   { fixedAmount, rate }                     // fixed + %
} + { ownerId?, listingId?, name, effectiveFrom, effectiveTo? }

OwnerPermissionConfig {
  ownerId, templateId: 'full_transparency' | 'financial_summary' | 'custom',
  dashboardFields: { grossRevenue, netRevenue, occupancy, adr,
                     bookingSources, upcomingReservations, guestRatings },
  statementFields: { revenueLines, expenseDetails, commissionDetails,
                     taxesAndFees, adjustments, netPayout }
}

OwnerLedgerEntry {                                   // deterministic mock ledger
  id, ownerId, listingId, period (YYYY-MM), currency,
  grossRevenue, expenses, taxes, platformFees,
  sources: [{ source, revenue, reservations }],
  occupiedNights, availableNights, nightlyRateSum, reservationCount,
  averageRating, ratingsCount, upcomingReservations,
  isPriorPeriodAdjustment, adjustsPeriod?, adjustmentReason?
}

OwnerStatement {
  id, ownerId, listingId, period,
  status: 'draft' | 'published',
  lines: OwnerStatementLine[],
  currency, totalAmount,
  publishedSnapshot?, publishedBy?, publishedAt?,
  issues: OwnerIssue[]
}
OwnerStatementLine { id, category: revenue|expense|commission|tax|fee|adjustment,
                     label, amount }
OwnerIssue { id, lineId?, description, amount, resolvedAt? }

OwnerStay {
  id, ownerId, listingId, unitId?,
  checkIn, checkOut, nights, notes?,
  status: 'active' | 'cancelled',
  countsAgainstOwnerUseCap: boolean,
  syncState: { cockpit|channex|notifications: 'pending'|'synced'|'failed' },
  cancelledAt?, cancellationReason?, createdAt, updatedAt
}

OwnerReservation {
  id, type: 'guest' | 'owner_block', listingId, roomTypeId?, roomId?,
  guestName?, channel?, note?, checkIn, checkOut, status
}

OwnerSession { ownerId, authenticatedAt }            // mock auth, per-owner
```

**Persistence:** all state via `useState` (Nuxt), no backend. Auth session is a demo magic-link; no real tokens.

---

## 7. Business Rules

### 7.1 Statement calculation
```
Gross booking revenue
− operating expenses
− management commission        (per active commission rule)
− taxes and fees
± prior-period adjustments
= net owner payout
```
- Ownership share is applied to property financials **before** owner totals.
- Every monetary component is rounded to 2dp at the domain boundary so displayed sums are exact.
- The rule active for the statement period wins (latest `effectiveFrom`).
- Post-publication refunds/cancellations/corrections become **linked adjustment lines in the next monthly draft**.

### 7.2 Commission math
- **Flat:** `rate%` of revenue basis.
- **Tiered:** progressive bands — each band applies only to the revenue within it; revenue above the top (open) band is not charged.
- **Hybrid:** `fixedAmount + rate%`.

### 7.3 Ownership invariant
Active ownership percentages across all owners of one `(listingId, unitId)` scope must total **≤ 100%**, validated at create/update with a 2-pass batch guard.

### 7.4 Permissions
- Configs are initialized from a template, then become an owner-specific snapshot.
- Changing a template never silently updates existing owners — staff must explicitly reapply it.
- Dashboard fields: gross revenue, net revenue, occupancy, ADR, booking sources, upcoming reservations, guest ratings.
- Statement fields: revenue lines, expense details, commission details, taxes and fees, adjustments, net payout.
- **Hidden fields are omitted from owner UI, not rendered disabled.**

### 7.5 Isolation
An owner must never access another owner's profile, mapping, ownership share, commission rule, statement, issue, or stay — including on co-owned properties. Field permissions control *presentation only*, never ownership boundaries.

### 7.6 Stay conflicts
- Intervals are `[checkIn, checkOut)` — a stay ending on another booking's check-in does not conflict.
- Conflict sources: guest reservations, active owner stays, blocked dates. Cancelled records ignored; modification excludes the stay being edited.
- Conflict blocks confirmation and names the conflicting dates + source. No staff override in V1.
- Annual owner-use night cap is **advisory** — exceeding it warns + notifies staff but does not block.

### 7.7 Dashboard metrics
- Ownership-share-scaled rollups from the ledger; `isPriorPeriodAdjustment` rows excluded from the top-level series.
- Occupancy = `occupiedNights / availableNights`; ADR = `nightlyRateSum / reservationCount`.
- Net revenue = `grossRevenue − expenses − taxes − platformFees`.
- **YoY** compares the current period to the same period last year → `{ absolute, percent }`; falls back to "—" when no prior-year row exists.
- Owner-use nights are tracked separately and never affect revenue occupancy/ADR.
- All metrics emit in `owner.statementCurrency`.

---

## 8. User Flows

### 8.1 Staff — onboard an owner
1. `/owners` → **Add Owner** → 3-step dialog (details → assignments + commission → permissions).
2. Step 2 assigns a property/room, sets ownership %, picks flat/tiered/hybrid commission (live rebalance keeps total ≤100%).
3. Step 3 picks a permission template (or customizes the matrix) and toggles **Invite now**.
4. Submit → owner created (`invited`), appears in the directory; invalid configs blocked inline.

### 8.2 Staff — publish monthly statements
1. `/owner-statements` → pick period → **Generate monthly drafts** (idempotent; simulates the scheduled job).
2. Review draft cards → **Publish** (two-step Review → Confirm, duplicate-click guarded) → snapshot frozen, notification fires, owner portal gains the statement.
3. Post-publication corrections → **Record adjustment** → appears as an adjustment line in the next period's draft.

### 8.3 Owner — log in
1. `/owner-portal/login` → enter email → generic "we sent you a link" state.
2. Demo: **Open secure link** → session created for a seeded owner → branded portal.
3. Unauthenticated access to portal routes redirects to login.

### 8.4 Owner — understand performance
1. `/owner-portal` → KPI strip (Gross/Net Revenue, Occupancy, ADR) with YoY badges.
2. Full-width revenue trend (gross + net, prior-year overlay) → half-width Occupancy, ADR, Sources, Ratings charts.
3. Property picker (only when >1 assignment) filters every metric; hidden fields simply don't render.

### 8.5 Owner — read a statement
1. Statements archive (published only, permission-gated columns) → detail.
2. Summary KPIs with prior-period deltas, channel breakdown, collapsible per-reservation table, adjustments.
3. **Export PDF** → `window.print()` (chrome hidden, print-only header, `@page` margins). **Raise an Issue** → one open issue per line.

### 8.6 Owner — block a personal stay
1. **My Stays** → month grid (guest stays emerald, owner blocks amber) → **New owner reservation**.
2. Pick property/room + dates + note → mandatory conflict check → confirm when clear.
3. Sync states per target (Cockpit / Channex / Notifications); failed sync preserves the stay and offers **Retry**.

---

## 9. Component Specifications

### 9.1 Tenant surface (`app/components/owners/`)
- **OwnersKpis** — Total / Active / Invited / Properties assigned
- **OwnersTable** — avatar, property badges with %, ownership total, commission type badges, currency, status, row actions (view / invite / activate / deactivate / reactivate)
- **OwnerOnboardingDialog** — 3-step sheet; exports `OwnerOnboardingDraft`
- **OwnerDetailSheet** — Overview / Properties & Commission / Permissions / Statements tabs
- **OwnerPermissionMatrix** — dashboard + statement field toggles, readonly vs interactive
- **CommissionRuleEditor** — flat / tiered / hybrid drafts
- **lib/ownership-rebalance** — pure `remainingShare()` / `rebalanceSiblings()` helpers

### 9.2 Portal surface (`app/components/owner-portal/`)
- **PortalDashboard** — header + property picker, "No metrics are visible" empty state, KPI strip with `PortalYoYBadge`, chart grid, upcoming reservations, owner-use nights
- **PortalRevenueChart** — area chart, gross + net + prior-year overlay, **full width**
- **PortalOccupancyChart / PortalAdrChart / PortalSourcesChart / PortalRatingsChart** — half-width charts (ADR is always standalone)
- **PortalKpiCard / PortalYoYBadge / PortalStatementPeriodDelta** — reusable tiles/badges
- **PortalStatementDetail** — read-only detail with print stylesheet (`data-print-target`, `@media print`)
- **PortalStatementSummary / PortalChannelBreakdown / PortalStatementReservations / PortalStatementAdjustments** — detail sections
- **PortalRaiseIssueDialog / PortalExportButtons** — issue + PDF/XLSX actions
- **PortalReservationCalendar** — Airbnb-style month grid, property/room-type dropdowns, month nav, overlapping reservation bars
- **PortalOwnerReservationPopover / PortalStayDialog / PortalSyncStatus** — stay interactions
- **PortalSidebar / PortalHeader / PortalMagicLinkForm / PortalPropertyPicker** — chrome + login + selector

### 9.3 Tenant statements (`app/components/owner-statements/`)
- **StatementPublishDialog** — two-step Review → Confirm, canonical line order (revenue → expenses → commission → taxes → adjustments → net payout), in-flight guard, open-issue count

---

## 10. State Management

| Composable | State keys | Owns |
|---|---|---|
| `useOwners` | `elev8-tenant-owners`, `-owner-property-mappings`, `-commission-rules`, `-permissions`, search/status/property filters | Owner CRUD, mappings, status transitions, filters |
| `useOwnerAuth` | `elev8-owner-portal-session`, `-pending-email` | Magic link, demo link, logout, route guard |
| `useOwnerPermissions` | `elev8-owner-permissions` | Templates, per-owner visibility checks |
| `useOwnerStatements` | `elev8-owner-statements`, `-statement-issues`, `-statement-adjustments`, `-owner-export-activity` | Generate, publish, issues, adjustments, export |
| `useOwnerStays` | `elev8-owner-stays` | Conflict detection, CRUD, cap, sync, retry |
| `useOwnerPortal` | *(reads the above)* | Facade: currentOwner, assignedProperties, visibleStatements, myStays, myIssues, propertyMetrics, permission checks. **No raw arrays exposed.** |
| `useOwnerDashboard` | *(reads ledger + portal)* | 12-month series, current period, YoY deltas, per-series permission gating |
| `useOwnerStatementDetail` | *(reads portal + statements)* | Per-statement enrichment: reservations, channel breakdown, prior period, adjustments; `isNotFound` |

---

## 11. Notifications

| Alert type | Severity | Route |
|---|---|---|
| `OWNER_STATEMENT_DRAFT_READY` | INFO | `/owner-statements` |
| `OWNER_STATEMENT_PUBLISHED` | INFO | `/owner-portal/statements` |
| `OWNER_ISSUE_RAISED` | WARNING | `/owner-statements` |
| `OWNER_STAY_CONFIRMED` | INFO | `/owner-portal/stays` |
| `OWNER_STAY_CONFLICT` | WARNING | `/owner-portal/stays` |
| `OWNER_USE_CAP_EXCEEDED` | WARNING | `/owners` |

All use the existing generic notification creator; routes point to the appropriate staff or portal surface.

---

## 12. Acceptance Criteria

- [ ] Staff can onboard an owner (basics → assignments → permissions) with validation: duplicate email, >100% ownership, invalid commission config all blocked inline.
- [ ] Ownership totals across owners of one property/room scope can never exceed 100%.
- [ ] Staff can generate monthly drafts for a period (deterministic + idempotent), review, and publish; published statements are immutable.
- [ ] Post-publication corrections create next-period adjustment lines; published values never change in place.
- [ ] Owners can enter the branded portal via the mock magic-link flow; inactive owners and unauthenticated routes are rejected.
- [ ] Owners see only assigned properties, ownership-share-scaled values, and permission-allowed fields — hidden fields are omitted entirely.
- [ ] No owner can access another owner's profile, mappings, statements, stays, issues, or commission rules — including co-owners of the same property.
- [ ] Dashboard shows revenue trend full-width with Occupancy, ADR, Sources, and Ratings as half-width charts; YoY badges render when prior-year data exists; "No metrics are visible" empty state when everything is gated off.
- [ ] Statement detail shows summary KPIs, channel breakdown, per-reservation drill-down, adjustments, and print-to-PDF; `isNotFound` renders identically for missing / not-yet-published / another-owner's statement.
- [ ] Owners can create / modify / cancel owner blocks with `[checkIn, checkOut)` conflict semantics; annual cap warns but does not block; failed sync preserves the stay with Retry.
- [ ] Notifications fire for draft ready, published, issue raised, stay confirmed, conflict, and cap exceeded.
- [ ] Unit + component tests cover commission math, ledger/ownership-share rounding, isolation (all owner-boundaries), permissions snapshot behavior, publish immutability, and conflict boundaries.

---

## 13. Known Gaps

| Gap | Detail | Risk |
|---|---|---|
| **Real authentication** | Login is a demo magic-link (`acceptDemoLink`); no real email delivery, OAuth, or password flow | Owners can't self-register; demo only |
| **Real statement generation** | Drafts are generated from `mockOwnerLedgerEntries` (~111 rows), not from live Finance data | Statements won't match real bookings until the ledger is wired to actual revenue |
| **Real integration sync** | Cockpit / Channex sync states are simulated client-side; no real API calls | Availability can drift from the real channel manager |
| **Real exports** | PDF = browser `window.print()`; XLSX = mock toast | No structured file artifacts for accounting |
| **Payout execution** | Statements stop at "net payout" display; no disbursement | Owners see expected payout, not actual payment |
| **Threaded dispute conversations** | Issues are one-per-line with no discussion thread | Finance/owner back-and-forth happens out of band |
| **Custom date-range statements** | Monthly periods only | Owners with irregular seasons can't get ad-hoc ranges |
| **Cross-property comparison** | Single property at a time via picker | Owners with multiple properties can't compare side-by-side |
| **LLM narrative summaries** | Charts/KPIs only; no "revenue up 12% driven by X" insights | Story still requires human interpretation |
| **Multi-language** | UI/English only; owner `language` field stored but charts/labels not translated | Indonesian owners get English-only experience |
| **Mixed-currency sums** | Ledgers across currencies (IDR + USD) summed as raw numbers — no FX fixture | Co-owned cross-currency properties show approximate totals |
| **Real-time updates** | Refresh on page load only | Dashboard/statements stale until reload |

---

## 14. Dependencies & Open Questions

1. **Auth provider** — real magic-link/OAuth vendor for owner login (Auth0, Clerk, custom)? V1/V2 keep the demo link; production needs a decision. *Needs product decision.*
2. **Ledger source** — should statement generation read from the Finance module's real cost data, or is a dedicated owner ledger (as shipped) the source of truth? *Needs product decision.*
3. **Statement cadence** — monthly confirmed as the unit; revisit if owners request custom ranges (§13).
4. **Payout execution** — is net owner payout meant to feed an actual disbursement (bank transfer, gateway) in a later phase? Currently display-only.
5. **Owner self-registration** — do owners get accounts created by staff only (current), or a self-serve signup with property-claim flow? *Needs product decision.*
6. **Commission basis** — flat/tiered/hybrid currently apply to gross revenue; confirm the basis definition with Finance before wiring real ledger data.

---

## 15. File Inventory

```
TENANT SURFACE
  app/pages/owners/index.vue
  app/pages/owner-statements/index.vue
  app/components/owners/            (OwnersTable, OwnersKpis, OwnerFilters,
                                     OwnerDetailSheet, OwnerOnboardingDialog,
                                     OwnerPermissionMatrix, CommissionRuleEditor,
                                     onboarding steps, lib/ownership-rebalance)
  app/components/owner-statements/  (StatementPublishDialog)

PORTAL SURFACE
  app/pages/owner-portal/index.vue
  app/pages/owner-portal/login.vue
  app/pages/owner-portal/stays.vue
  app/pages/owner-portal/statements/index.vue
  app/pages/owner-portal/statements/[id].vue
  app/components/owner-portal/      (PortalDashboard, PortalSidebar, PortalHeader,
                                     PortalMagicLinkForm, PortalPropertyPicker,
                                     PortalKpiCard, PortalYoYBadge,
                                     PortalRevenueChart, PortalOccupancyChart,
                                     PortalAdrChart, PortalSourcesChart,
                                     PortalRatingsChart, PortalStatementDetail,
                                     PortalStatementSummary, PortalStatementPeriodDelta,
                                     PortalChannelBreakdown, PortalStatementReservations,
                                     PortalStatementAdjustments, PortalRaiseIssueDialog,
                                     PortalExportButtons, PortalReservationCalendar,
                                     PortalOwnerReservationPopover, PortalStayDialog,
                                     PortalSyncStatus)
  app/layouts/owner-portal.vue

DATA + COMPOSABLES
  app/components/owners/data/       (owners, owner-ledger, owner-statements,
                                     owner-statement-reservations, commission-rules,
                                     owner-permissions, owner-stays, owner-reservations,
                                     owner-reservations-seed)
  app/lib/owner-reservations-layout.ts
  app/composables/useOwners.ts
  app/composables/useOwnerAuth.ts
  app/composables/useOwnerPermissions.ts
  app/composables/useOwnerStatements.ts
  app/composables/useOwnerStays.ts
  app/composables/useOwnerPortal.ts
  app/composables/useOwnerDashboard.ts
  app/composables/useOwnerStatementDetail.ts

NAV + NOTIFICATIONS
  app/constants/menus.ts             (Owners, Owner Statements, Owner Portal (Demo))
  app/components/notifications/data/alerts.ts

TESTS
  tests/composables/useOwnerPortal.spec.ts         (isolation contract)
  tests/composables/useOwnerDashboard.spec.ts
  tests/composables/useOwnerStatementDetail.spec.ts
  tests/composables/useOwnerStatements.spec.ts
  tests/composables/useOwnerStays.spec.ts
  tests/composables/useOwners.spec.ts
  tests/composables/useOwnerAuth.spec.ts
  tests/composables/useOwnerPermissions.spec.ts
  tests/lib/owner-commissions.spec.ts
  tests/lib/owner-ledger.spec.ts
  tests/lib/owner-reservations-layout.spec.ts
  tests/components/owners/OwnerOnboardingDialog.spec.ts
```
