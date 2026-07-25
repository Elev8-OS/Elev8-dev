# Owner Portal Phase 2 — Detailed Statements + Performance Dashboard

> **Date**: 2026-07-24
> **Module**: Owner Portal (Phase 2)
> **Status**: Approved (brainstorming complete)
> **Depends on**: Phase 1 owner portal (`/owner-portal`, `useOwnerPortal`, `useOwnerPermissions`, `mockOwnerLedgerEntries`, `mockOwnerStatements`), `@unovis/vue` chart library (already in `package.json`), `mockExport` from `useOwnerStatements`.

---

## 1. Overview

Phase 1 of the Owner Portal shipped the foundation: a brand-aware owner login, a basic dashboard (KPI cards + upcoming reservations), a published-statements archive, statement detail with raise-issue flow, magic-link authentication, and owner self-stay create/modify/cancel with conflict detection and annual-cap warnings.

The single biggest gap reported by owners is **"I can see a number, but I can't see the story behind it."** Phase 2 fixes this by adding:

1. **A rich performance dashboard** at `/owner-portal` — replacing the current minimal KPI strip with 12-month + YoY trend charts covering revenue, occupancy, ADR, booking sources, and guest ratings.
2. **An enhanced statement detail** at `/owner-portal/statements/[id]` — adding per-reservation drill-down, channel breakdown, prior-period comparison, and detailed adjustments to the existing per-line statement.

### Key features

- **4 charts on the dashboard** — revenue trend (area, gross + net), occupancy + ADR combo (line + bar), booking sources (stacked bar), guest ratings (line + count)
- **12-month time range + YoY** — comparative overlay if prior-year data exists for the same `(ownerId, listingId, periodMonth)`
- **Property picker** — already exists in Phase 1; continues to filter all metrics to the selected listing
- **Statement drill-down** — per-reservation table, channel breakdown, prior-period comparison, adjustments detail
- **Real PDF export** — `window.print()` with a `@media print` stylesheet; browser saves as PDF
- **Permission-respecting** — every chart and section respects `useOwnerPermissions.canViewDashboardField()` / `canViewStatementField()`. Fields gated off are hidden, not just dimmed
- **Owner isolation** — both new composables preserve the existing invariant: the owner filter is always the outer one

### Why this matters

Today, an owner who logs in sees a single number for gross revenue and a list of upcoming reservations. They cannot tell whether the number is up or down vs last month, whether Airbnb is their strongest channel, whether their average rating is trending up, or where the revenue in that statement actually came from. Phase 2 answers all of those in one screen.

### Out of scope (Phase 2)

- Real LLM-generated narrative summaries ("Revenue was up 12% this month driven by 2 long bookings on Airbnb")
- Cross-property comparison chart side-by-side (kept: a single property at a time; user picks via the existing property picker)
- Currency conversion (mixed-currency ledgers for an owner are still summed as raw numbers; per the existing comment in `useOwnerPortal.ts`, FX fixtures don't exist)
- Staff-side dashboard equivalents (the data layer is reusable, but staff UI is out of scope)
- Real-time push / live updates (refresh on page load only)
- Multi-language chart label translations (English only for v2)
- Drill-down from a chart bar to filtered statement list (future)

---

## 2. High-Level Architecture

```
┌─ Browser ──────────────────────────────────────────────────────────┐
│                                                                     │
│  Page (/owner-portal/index.vue)                                    │
│   └─ <PortalDashboard>                                            │
│        ├─ <PortalPropertyPicker>      ← useOwnerPortal.assignedProperties
│        ├─ KPI strip (4× <PortalKpiCard>)                            │
│        │    └─ <PortalYoYBadge> per card ← useOwnerDashboard.yoyChange()
│        ├─ Chart grid 2×2                                            │
│        │    ├─ <PortalRevenueChart>      (area, gross+net, YoY)   │
│        │    ├─ <PortalOccupancyAdrChart> (line + bar combo)        │
│        │    ├─ <PortalSourcesChart>      (stacked bar)            │
│        │    └─ <PortalRatingsChart>      (line + count)           │
│        ├─ Upcoming reservations list (existing)                    │
│        └─ Owner-use nights KPI (existing)                          │
│                                                                     │
│  Page (/owner-portal/statements/[id].vue)                           │
│   └─ <PortalStatementDetail :statement-id>                         │
│        ├─ Header (back link, listing, period, published)           │
│        ├─ <PortalExportButtons>  ← PDF → window.print()            │
│        ├─ <PortalStatementSummary>                                 │
│        │    └─ 4× KPI tile, each with <PortalStatementPeriodDelta> │
│        ├─ <PortalChannelBreakdown>                                 │
│        ├─ <PortalStatementReservations>  (collapsible)             │
│        ├─ <PortalStatementAdjustments>  (v-if adjustments.length)  │
│        ├─ Existing per-line section (revenue / expenses / etc.)    │
│        ├─ Net payout section (existing)                            │
│        └─ <PortalRaiseIssueDialog>  (existing)                     │
│                                                                     │
│  Composables                                                        │
│   ├─ useOwnerPortal()              ← unchanged, facade             │
│   ├─ useOwnerDashboard()           ← NEW, 12-month + YoY series    │
│   ├─ useOwnerStatementDetail()     ← NEW, per-statement enrichment │
│   └─ useOwnerPermissions()         ← unchanged                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ Data layer ────────────────────────────────────────────────────────┐
│  Fixtures (app/components/owners/data/)                            │
│   ├─ owner-ledger.ts              ← EXTENDED in place: 12 months   │
│   │                                  × 3 owners × 2 listings       │
│   │                                  + ~3 prior-period adjustments │
│   │                                  + YoY rows for 2025            │
│   ├─ owner-statements.ts          ← EXTENDED: more periods covered │
│   └─ owner-statement-reservations.ts ← NEW: per-statement lists    │
└─────────────────────────────────────────────────────────────────────┘
```

### Architecture properties

- **Two new composables, one purpose each.** `useOwnerDashboard` owns the 12-month time series + YoY deltas. `useOwnerStatementDetail` owns the per-statement enrichment (channels, prior-period, reservations, adjustments). Neither is a "kitchen sink" — they have a single clear purpose.
- **`useOwnerPortal` stays a facade.** It continues to expose owner-scoped selectors and the `selectedPropertyId` ref. The dashboard and statement detail pages compose the facade + the new composables.
- **Permission integration is composable-side.** Each new composable reads `useOwnerPermissions` and applies the field-level gate before returning data. The chart components only render if the underlying field is visible.
- **Owner isolation preserved.** Both new composables read `useOwnerPortal().currentOwnerId` and apply the owner filter FIRST. The existing test in `useOwnerPortal.spec.ts` is the model; new tests in `useOwnerDashboard.spec.ts` and `useOwnerStatementDetail.spec.ts` enforce the same property.
- **Print-friendly by default.** The statement detail page is wrapped in a `data-print-target` div. A scoped `<style>` in `PortalStatementDetail.vue` (or a global `app/assets/css/print.css`) hides chrome when `media: print`. The export button calls `window.print()`.

---

## 3. Data layer changes

### 3.1 Extended `mockOwnerLedgerEntries`

**Current state:** 6 rows (3 owners × 1-2 listings × 1-2 months each, plus 1 prior-period adjustment).

**Target:** ~80 rows covering 12 months × 3 owners × 2 listings, plus 3 prior-period adjustments spread across the year, plus YoY rows for 2025.

**Per-row shape (unchanged):**
```ts
interface OwnerLedgerEntry {
  id: string
  ownerId: string
  listingId: string
  period: string         // YYYY-MM
  currency: string
  grossRevenue: number
  expenses: number
  taxes: number
  platformFees: number
  sources: OwnerLedgerSourceBreakdown[]
  occupiedNights: number
  availableNights: number
  nightlyRateSum: number
  reservationCount: number
  averageRating: number
  ratingsCount: number
  upcomingReservations: OwnerLedgerUpcomingReservation[]
  isPriorPeriodAdjustment: boolean
  adjustsPeriod?: string
  adjustmentReason?: string
  createdAt: string
  updatedAt: string
}
```

**Coverage plan:**
- 3 owners × 2 listings × 12 months = 72 base rows
- 3 prior-period adjustments (one per owner) = 3 rows
- 2025 YoY rows for the same `(ownerId, listingId)` covering 2025-07 → 2025-12 = 36 rows (the first 6 months of 2026 are compared against 2025-07..2025-12)
- Total: ~111 rows

**Trend shape:** Realistic Bali/Swiss seasonality baked into the fixture. Bali listings (own-1, part of own-2): low season Apr-Sep, peak Jul-Aug and Dec. Swiss listings (own-2 lst-8, own-3 lst-3): winter peak (Dec-Feb), summer trough.

**YoY deltas:** Prior-year rows are present at the same shape. The dashboard joins `period` to `period-1y` to compute percent change. For owners where 2025 data is missing, the YoY chevron falls back to "no prior year" (no chevron, "—" tooltip).

### 3.2 New `owner-statement-reservations.ts`

Per `OwnerStatement.id`, a list of reservations that contributed to that period's revenue. Owner-visible surface for the per-statement drill-down.

```ts
import type { OwnerLedgerSource } from './owner-ledger'

export interface OwnerReservationForStatement {
  id: string
  statementId: string
  guestName: string
  source: OwnerLedgerSource
  checkIn: string     // ISO date
  checkOut: string    // ISO date
  nights: number
  grossAmount: number
  channelFee: number
  netToOwner: number
}

export const mockOwnerReservationsForPeriod: OwnerReservationForStatement[]
```

**Coverage:** 3-8 entries per published statement. For each statement, the gross amounts sum to roughly the statement's revenue line.

### 3.3 Extended `mockOwnerStatements`

The current 4 statements are kept. New statements are added so that every Phase 1 owner has at least 6 published statements (covering 6 months of 2026) instead of just 1-2. This makes the archive non-trivial and lets the prior-period comparison find a prior period for most statements.

**Shape unchanged.** Only adds rows.

### 3.4 Unchanged

- `Owner`, `OwnerPropertyMapping`, `OwnerStatement`, `OwnerStatementIssue` types
- `useOwnerAuth`, `useOwnerPermissions`, `useOwners`, `useOwnerStatements`
- `mockOwners`, `mockOwnerProperties`, `mockCommissionRules` (the existing seed)

---

## 4. Composable design

### 4.1 `useOwnerDashboard`

**Owns:** 12-month performance dataset for the current owner + selected property.

**File:** `app/composables/useOwnerDashboard.ts`

**State inputs:**
- `useOwnerPortal().currentOwnerId` — owner filter (outer)
- `useOwnerPortal().selectedPropertyId` — property filter (inner)
- `useOwnerPortal().assignedProperties` — drives the property picker
- `useOwnerPermissions().canViewDashboardField` — gates every metric

**Computed outputs:**

```ts
export interface OwnerDashboardMonth {
  period: string                                  // YYYY-MM
  grossRevenue: number
  netRevenue: number
  occupancy: number                               // 0..1
  adr: number
  reservationCount: number
  sources: OwnerLedgerSourceBreakdown[]
  averageRating: number | null
  ratingsCount: number
  topSource: OwnerLedgerSource | null
}

export interface OwnerDashboardTimeSeries {
  months: OwnerDashboardMonth[]                   // chronological, oldest → newest
  priorYearMonths: OwnerDashboardMonth[]          // same length, prior year
  currency: string                                // owner's statementCurrency
}

export interface OwnerYoYChange {
  absolute: number
  percent: number | null                          // null if division by zero
}
```

**Exposed API:**

```ts
export function useOwnerDashboard(): {
  /** Full 12-month time series for the current owner + selected property. */
  timeSeries: ComputedRef<OwnerDashboardTimeSeries>
  /** Current period metrics (latest non-adjustment period). */
  currentPeriod: ComputedRef<OwnerDashboardMonth | null>
  /** Convenience: array of {period, grossRevenue, netRevenue} for chart consumption. */
  monthlyRevenueSeries: ComputedRef<{ period: string, grossRevenue: number, netRevenue: number }[]>
  /** Convenience: {period, occupancy, adr}[] for combo chart. */
  monthlyOccupancyAdrSeries: ComputedRef<{ period: string, occupancy: number, adr: number }[]>
  /** Convenience: {period, airbnb: number, booking_com: number, ...}[] for stacked bar. */
  monthlySourcesSeries: ComputedRef<Record<string, number>[]>
  /** Convenience: {period, averageRating, ratingsCount}[] for line chart. */
  monthlyRatingsSeries: ComputedRef<{ period: string, averageRating: number | null, ratingsCount: number }[]>
  /** YoY delta for a given field, comparing current period to same period last year. */
  yoyChange: (field: 'grossRevenue' | 'netRevenue' | 'occupancy' | 'adr') => ComputedRef<OwnerYoYChange | null>
  /** True if any prior-year data exists. Drives chevron visibility. */
  hasYearOverYearData: ComputedRef<boolean>
  /** True if any visualization is visible (used to render the "all fields hidden" empty state). */
  hasVisibleMetrics: ComputedRef<boolean>
}
```

**Implementation notes:**
- The composable reads `mockOwnerLedgerEntries` directly, filtering by `ownerId === currentOwnerId` first, then `(selectedPropertyId == null || entry.listingId === selectedPropertyId)`. `isPriorPeriodAdjustment === false` rows are aggregated; `true` rows are skipped at the top-level (they're surfaced separately on the statement detail).
- Currency comes from `currentOwner.statementCurrency`, not from the ledger entries (matches the existing `useOwnerPortal` pattern).
- Ownership share is applied: per `(ownerId, listingId)`, multiply magnitudes by `mapping.ownershipPercentage / 100`. Same pattern as `useOwnerPortal.propertyMetrics`.
- Aggregations per month: `grossRevenue.sum`, `expenses.sum`, `taxes.sum`, `platformFees.sum`, `nightlyRateSum.sum`, `reservationCount.sum`, `occupiedNights.sum`, `availableNights.sum`, `ratingsCount.sum`, `averageRating = sum(rating × ratingsCount) / sum(ratingsCount)` (count-weighted; null when no ratings in the month).
- When `statementId.value === null`, all outputs in `detail` are `null` and `isNotFound.value === false` (no statement is being requested — the page is in a loading state).
- "Hidden via `v-if` if `monthlyRevenueSeries.length === 0`" is the permission gate signal: the composable returns an empty array when the field is gated off, and the chart component renders nothing. Components never call `canViewDashboardField` directly.
- "YoY overlay" in `PortalRevenueChart` is rendered as a dashed line on the same primary axis (not a secondary axis), labeled "Prior year" in the legend, with a lower opacity to keep the current year visually dominant.

### 4.2 `useOwnerStatementDetail`

**Owns:** Single-statement enrichment for the current owner.

**File:** `app/composables/useOwnerStatementDetail.ts`

**Inputs:**
- `statementId: Ref<string | null>` (caller passes; if null, all outputs are null)
- `useOwnerPortal().currentOwnerId` (outer filter)
- `useOwnerPortal().visibleStatements` (existing owner-scoped list)
- `useOwnerPermissions().canViewStatementField`

**Computed outputs:**

```ts
export interface OwnerChannelBreakdownRow {
  source: OwnerLedgerSource
  revenue: number
  reservations: number
  share: number                                  // 0..1
}

export interface OwnerStatementPeriodComparison {
  grossRevenue: { absolute: number, percent: number | null }
  netRevenue: { absolute: number, percent: number | null }
  occupancy: { absolute: number, percent: number | null }
  adr: { absolute: number, percent: number | null }
}

export interface OwnerStatementAdjustment {
  id: string
  sourceLedgerEntryId: string
  label: string
  amount: number
  adjustsPeriod: string
  reason: string
}

export interface OwnerStatementDetail {
  statement: OwnerStatement | null
  listing: Listing | null
  reservations: OwnerReservationForStatement[]
  channelBreakdown: OwnerChannelBreakdownRow[]
  priorPeriod: OwnerStatement | null
  priorPeriodComparison: OwnerStatementPeriodComparison | null
  adjustments: OwnerStatementAdjustment[]
}
```

**Exposed API:**

```ts
export function useOwnerStatementDetail(statementId: Ref<string | null>): {
  detail: ComputedRef<OwnerStatementDetail>
  /** True if the underlying statement is not visible to the current owner (used for the "not found" empty state). */
  isNotFound: ComputedRef<boolean>
}
```

**Implementation notes:**
- `statement` is resolved from `useOwnerPortal().visibleStatements` (already owner-scoped). If the requested id is not in that list, all outputs are `null` and `isNotFound` is true.
- `listing` is resolved from `listings.value` (the shared `~/components/listings/data/listings` store) by `listingId`.
- `reservations` comes from `mockOwnerReservationsForPeriod` filtered by `statementId`.
- `channelBreakdown` is aggregated from `reservations` by `source` (revenue, count, share of total revenue).
- `priorPeriod` is the same `(ownerId, listingId)` with `period` equal to the month before. Resolved from `useOwnerPortal().visibleStatements`.
- `priorPeriodComparison` is computed using the same aggregations as `useOwnerDashboard.currentPeriod` against the prior period's statement (read from `publishedSnapshot` if available, otherwise from the live lines).
- `adjustments` is computed from `mockOwnerLedgerEntries` filtered by `ownerId === statement.ownerId`, `listingId === statement.listingId`, `adjustsPeriod === statement.period`, `isPriorPeriodAdjustment === true`.

### 4.3 Permission gating

| Composable | Field check | What happens when off |
|---|---|---|
| `useOwnerDashboard` | `canViewDashboardField('grossRevenue')` | `monthlyRevenueSeries` returns `[]`, `PortalRevenueChart` hides |
| `useOwnerDashboard` | `canViewDashboardField('occupancy')` and `canViewDashboardField('adr')` | `monthlyOccupancyAdrSeries` returns `[]`, `PortalOccupancyAdrChart` hides |
| `useOwnerDashboard` | `canViewDashboardField('bookingSources')` | `monthlySourcesSeries` returns `[]`, `PortalSourcesChart` hides |
| `useOwnerDashboard` | `canViewDashboardField('guestRatings')` | `monthlyRatingsSeries` returns `[]`, `PortalRatingsChart` hides |
| `useOwnerStatementDetail` | `canViewStatementField('revenueLines')` | `reservations` returns `[]`, `PortalStatementReservations` hides |
| `useOwnerStatementDetail` | `canViewStatementField('revenueLines')` | `channelBreakdown` returns `[]`, `PortalChannelBreakdown` hides |
| `useOwnerStatementDetail` | `canViewStatementField('adjustments')` | `adjustments` returns `[]`, `PortalStatementAdjustments` hides |
| `useOwnerStatementDetail` | `canViewStatementField('netPayout')` | `priorPeriodComparison.netRevenue` returns `null` |

**Empty-dashboard state:** If `hasVisibleMetrics` is false, the dashboard renders:

> "No metrics are visible. Contact your property manager to update your visibility settings."

(uses the existing `OwnerPermissionTemplateId` "custom" / "financial_summary" / "full_transparency" copy)

---

## 5. Component breakdown

### 5.1 Dashboard components

**`PortalDashboard.vue`** — Replaces the existing dashboard. Layout:
- Header row: title + subtitle + property picker (existing)
- KPI strip: 4 cards × 4 columns on `lg:`, 2 columns on `md:`, 1 column on mobile. Each card has a `<PortalYoYBadge>` if `hasYearOverYearData` is true
- Chart grid: 2×2 on `lg:`, 1 column on mobile
  - Revenue chart (top-left)
  - Occupancy + ADR combo (top-right)
  - Sources chart (bottom-left)
  - Ratings chart (bottom-right)
- Upcoming reservations (existing)
- Owner-use nights KPI (existing)

**`PortalRevenueChart.vue`** — Single area chart with two series:
- Series: `grossRevenue` and `netRevenue` (primary)
- YoY overlay: prior-year `grossRevenue` as a dashed line on the secondary axis (only if `hasYearOverYearData`)
- Wraps `<AreaChart>` from `app/components/ui/chart-area`
- Height: `h-64` on `lg:`, `h-48` on mobile
- Hidden via `v-if` if `monthlyRevenueSeries.length === 0`

**`PortalOccupancyAdrChart.vue`** — Combo chart:
- Top: occupancy line (0-100% via `yFormatter`)
- Bottom: ADR bars (currency-formatted)
- Wraps `<LineChart>` + `<BarChart>` in a flex container
- Hidden via `v-if` if `monthlyOccupancyAdrSeries.length === 0`

**`PortalSourcesChart.vue`** — Stacked bar:
- One bar per month; each bar split by source (Airbnb, Booking.com, Direct, etc.)
- Uses `<BarChart>` with stacked categories
- Source list dynamically built from the union of all sources present in the time series
- Hidden via `v-if` if `monthlySourcesSeries.length === 0`

**`PortalRatingsChart.vue`** — Line chart:
- Series: `averageRating` (line) + `ratingsCount` (secondary axis, optional)
- Uses `<LineChart>`
- Hidden via `v-if` if `monthlyRatingsSeries.length === 0` OR `currentPeriod.ratingsCount === 0`

**`PortalYoYBadge.vue`** — Small reusable badge:
- Props: `change: OwnerYoYChange | null`, `format: 'percent' | 'currency' | 'number'`
- Renders: green up-chevron + green text if positive, red down-chevron + red text if negative, "—" if null
- Slot for the badge icon (chevron variants from `lucide:trending-up` / `lucide:trending-down` / `lucide:minus`)

### 5.2 Statement detail components

**`PortalStatementDetail.vue`** — Replaces the existing detail. Layout:
- Header (back link, listing, period, published date, export buttons)
- `<PortalStatementSummary>`
- `<PortalChannelBreakdown>`
- `<PortalStatementReservations>` (collapsible, default closed)
- `<PortalStatementAdjustments>` (v-if)
- Existing per-line section
- Net payout section
- `<PortalRaiseIssueDialog>`

**`PortalStatementSummary.vue`** — 4 KPI tiles with prior-period deltas:
- Gross Revenue, Net Revenue, Occupancy, ADR
- Each tile uses `<PortalStatementPeriodDelta>` for the comparison
- Hidden: no deltas if `priorPeriodComparison === null`

**`PortalStatementPeriodDelta.vue`** — Reusable delta badge:
- Same visual as `PortalYoYBadge` but accepts `{ absolute: number, percent: number | null }` and a format hint
- Slots: leading-icon, trailing-text

**`PortalChannelBreakdown.vue`** — Channel breakdown:
- Top: horizontal stacked bar showing share of revenue per channel
- Below: table of channels with revenue, reservations, share %
- Hidden: `v-if="channelBreakdown.length === 0"`

**`PortalStatementReservations.vue`** — Per-reservation table:
- Default collapsed (just shows count: "8 reservations this period")
- Expanded: table of reservations (guest, dates, source, gross, channel fee, net)
- Hidden: `v-if="reservations.length === 0"`

**`PortalStatementAdjustments.vue`** — Adjustments section:
- One row per adjustment with reason, affected period, amount
- Hidden: `v-if="adjustments.length === 0"`

### 5.3 Existing components — change list

**`PortalExportButtons.vue`** — Modified:
- PDF button: replaces `mockExport` call with `window.print()`
- XLSX button: keeps `mockExport` (real XLSX out of scope for Phase 2)
- Spinner/loading state retained

**`PortalDashboard.vue`** — Replaced (see 5.1).

**`PortalStatementDetail.vue`** — Replaced.

**`PortalKpiCard.vue`**, `PortalPropertyPicker.vue`, `PortalSidebar.vue`, `PortalHeader.vue`, `PortalRaiseIssueDialog.vue`, `PortalMagicLinkForm.vue`, `PortalSyncStatus.vue` — unchanged.

### 5.4 Print stylesheet

A scoped `<style>` block inside `PortalStatementDetail.vue` (or a new `app/assets/css/print.css` imported in the layout) handles the print layout:

```css
@media print {
  /* Hide dashboard chrome */
  [data-portal-chrome] { display: none !important; }
  /* Force the statement to span the full page */
  [data-print-target] { max-width: 100% !important; padding: 0 !important; }
  /* Prevent page breaks inside cards */
  .print-no-break { break-inside: avoid; }
  /* Show extra print-only header */
  [data-print-only] { display: block !important; }
}
```

The statement detail page renders a `<div data-print-target>` wrapping everything visible. The header (back link, sidebar, export buttons) gets `data-portal-chrome` and is hidden in print. A print-only header (logo, page title, period) shows.

`@page` directives set margins: `@page { margin: 1.5cm; }`.

---

## 6. Permissions & isolation

### 6.1 Owner isolation invariant

The existing test in `useOwnerPortal.spec.ts` enforces that the owner filter is the outer filter. The new composables are held to the same standard:

```ts
// useOwnerDashboard.spec.ts
describe('useOwnerDashboard', () => {
  it('does not leak entries across owners', () => {
    // own-1 logged in → timeSeries only contains own-1's entries
  })
  it('applies the selected property filter inner', () => {
    // own-1 with selectedPropertyId = lst-1 → only lst-1 entries
  })
  it('skips prior-period adjustment rows from the top-level series', () => {
    // led-6 (prior period) is excluded from timeSeries but surfaced in adjustments
  })
})

// useOwnerStatementDetail.spec.ts
describe('useOwnerStatementDetail', () => {
  it('returns null for a statementId owned by another owner', () => {
    // own-1 logged in, request stmt-3 (own-3's) → all outputs null, isNotFound true
  })
  it('returns null for a draft statement', () => {
    // own-1 logged in, request stmt-1 (draft) → all outputs null
  })
})
```

### 6.2 Field-level permission gating

Both composables call `useOwnerPermissions` for every metric. The chart components never check permissions themselves; the composable decides what data is exposed. If a field is gated off, the chart receives an empty series and hides via `v-if`.

This means:
- Adding a new field to the `OwnerDashboardField` enum requires updates only in `useOwnerDashboard` (the gating) and `PortalDashboard.vue` (the chart card layout).
- Removing a field requires updates only in the composable + the enum.

### 6.3 Currency-isolation

`useOwnerDashboard` always emits metrics in `currentOwner.statementCurrency`. Cross-currency ledgers (e.g. own-2 has IDR for lst-3 and USD for lst-8) are summed as raw numbers per the existing `useOwnerPortal` comment. No FX conversion is added in Phase 2.

### 6.4 Statement lock to owner

`useOwnerStatementDetail` resolves the statement from `useOwnerPortal().visibleStatements` (already owner-scoped). A statement belonging to another owner is invisible. The "Statement not found" empty state renders identically for "not in this period", "doesn't exist", and "belongs to someone else" — preventing enumeration.

---

## 7. File list

```
NEW
  app/components/owner-portal/PortalRevenueChart.vue
  app/components/owner-portal/PortalOccupancyAdrChart.vue
  app/components/owner-portal/PortalSourcesChart.vue
  app/components/owner-portal/PortalRatingsChart.vue
  app/components/owner-portal/PortalYoYBadge.vue
  app/components/owner-portal/PortalStatementSummary.vue
  app/components/owner-portal/PortalStatementPeriodDelta.vue
  app/components/owner-portal/PortalChannelBreakdown.vue
  app/components/owner-portal/PortalStatementReservations.vue
  app/components/owner-portal/PortalStatementAdjustments.vue
  app/composables/useOwnerDashboard.ts
  app/composables/useOwnerStatementDetail.ts
  app/components/owners/data/owner-statement-reservations.ts
  app/composables/useOwnerDashboard.spec.ts
  app/composables/useOwnerStatementDetail.spec.ts

MODIFIED
  app/components/owner-portal/PortalDashboard.vue         (replace with rich layout)
  app/components/owner-portal/PortalStatementDetail.vue   (replace with rich layout)
  app/components/owner-portal/PortalExportButtons.vue     (PDF → window.print())
  app/components/owners/data/owner-ledger.ts              (extend in place to ~111 rows)
  app/components/owners/data/owner-statements.ts          (extend mockOwnerStatements)

UNCHANGED
  app/components/owner-portal/PortalKpiCard.vue
  app/components/owner-portal/PortalPropertyPicker.vue
  app/components/owner-portal/PortalSidebar.vue
  app/components/owner-portal/PortalHeader.vue
  app/components/owner-portal/PortalMagicLinkForm.vue
  app/components/owner-portal/PortalSyncStatus.vue
  app/components/owner-portal/PortalRaiseIssueDialog.vue
  app/components/owner-portal/PortalOwnerReservationPopover.vue
  app/components/owner-portal/PortalStayDialog.vue
  app/components/owner-portal/PortalStatementDetail.vue   (replaced — see modified)
  app/pages/owner-portal/index.vue                        (unchanged; renders <PortalDashboard>)
  app/pages/owner-portal/statements/index.vue
  app/pages/owner-portal/statements/[id].vue
  app/composables/useOwnerPortal.ts                       (no API change)
  app/composables/useOwnerAuth.ts
  app/composables/useOwnerPermissions.ts
  app/composables/useOwners.ts
  app/composables/useOwnerStatements.ts
  app/composables/useOwnerStays.ts
```

---

## 8. Edge cases & empty states

| State | Where | Behaviour |
|---|---|---|
| Owner not signed in | Both pages | Existing "Please sign in" empty state |
| Owner has no properties assigned | Dashboard | "No properties assigned yet" empty state |
| Owner has properties but no ledger entries | Dashboard | "No performance data yet for this property" empty state |
| All dashboard fields permission-gated off | Dashboard | "No metrics are visible. Contact your property manager." empty state |
| Selected property has <12 months of data | Dashboard | Charts render with whatever months exist; YoY disabled if no prior-year data |
| Statement not found / not visible | Statement detail | Existing "Statement not found" empty state |
| Statement has no reservations | Statement detail | "No reservation detail available" inside the reservations card |
| Statement has no adjustments | Statement detail | The adjustments card does not render (v-if) |
| Statement has no prior period | Statement detail | Delta chevrons show "—" |
| Owner has no published statements | Statements archive | Existing "No published statements yet" empty state |
| Print dialog cancellation | Statement detail | No side effect; user stays on the page |
| XLSX export click | Statement detail | Mock toast (unchanged) |

---

## 9. Out of scope (deferred)

- **Real XLSX export** — `mockExport` stays for XLSX (real XLSX is a Phase 3 concern)
- **Staff-side equivalents** — the data layer is reusable, but the staff dashboard UI is its own phase
- **Cross-property comparison** — single property at a time via the picker; multi-property overlay is a different feature
- **LLM-generated narrative summaries** — "Revenue was up 12% this month driven by X" type insights
- **Drill-down from chart bar to filtered statement list** — clicking a bar in the revenue chart does not currently navigate to that period's statement
- **Multi-language chart labels** — English only in v2
- **Per-property dashboard URL** — currently `/owner-portal` only; query param `?property=lst-1` is a future addition
- **Live data refresh** — refresh on page load only; no realtime push
- **Print preview button** — the existing PDF button triggers the print dialog directly; a separate "Preview" button is not added
