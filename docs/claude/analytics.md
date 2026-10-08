> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Analytics (`/analytics`)

Portfolio performance page, top-level in the sidebar (General group, above Listing Health).
Page `app/pages/analytics.vue`, composable `app/composables/useAnalytics.ts`, framework-free
data in `app/components/analytics/data/analytics.ts`, components in `app/components/analytics/`.

#### Why the data is generated
⚠️ Same reason as the GM dashboard (`docs/claude/gm-dashboard.md`): the seeded reservations are
Jul-Sep 2026 on a few listings, which cannot fill a 12-month trend, a year-on-year comparison or
a booking pace chart. `buildAnalyticsBookings(units, anchorIso)` generates a deterministic
portfolio (`mulberry32` from `gm-dashboard.ts`, fixed seed) from the **real** listings: ids,
names, tags, nightly rates, capacity. It reaches `HISTORY_DAYS` (2 years + a week) back so a
12-month period has a full year to compare against, and `FUTURE_DAYS` ahead for the pace chart.
Seasonality per region, lead time and cancellation rate per channel, guest country per region.
⚠️ A booking whose `bookedOn` is after the anchor is dropped, which is what makes future months
read as "on the books so far". A cancelled booking holds no nights but still counts in the
cancellation rate.

#### Inactive and deleted listings
- `AnalyticsUnit.lifecycle` is `active | inactive | deleted`, with `endedOn` = first day it no
  longer sells. `toAnalyticsUnits` now keeps `status: 'inactive'` listings (flagged, no date: they
  sell nothing after today). ⚠️ No seed listing is inactive and deleted listings are not in
  `listings` at all, so `retired-listings.ts` adds three **analytics-only demo** units
  (`demoOnly`, ids `retired-*`, end dates relative to the anchor). Nothing else reads them.
- The generator books no night on or after `endedOn`; ⚠️ availability (`unitAvailableNights`)
  stops there too, so a listing deleted in May does not count as empty for June, in occupancy,
  RevPAR, pace and the table alike. Each unit's stays are seeded from a hash of its **listing
  id**, not its position, so adding retired units never reshuffles the active ones (a test pins it).
- Scope: `includeRetired: ('inactive' | 'deleted')[]`, empty by default, two switches under
  "Listing status" in the panel (disabled with a count of 0). `setIncludeRetired(kind, false)`
  also drops listings of that kind from `listingIds`, which would otherwise scope to nothing. The
  Listings filter only offers what the switches let in, hinting "Inactive · location".
- Table rows carry `lifecycle` (badge) and `linkable` (false for deleted and demo-only units,
  which have no `/listings/:id` page).
- Saved views lay snapshots over `defaultAnalyticsFilters()`, so views saved before a filter
  existed still load and are not reported dirty.

#### Rules
- **Currency**: each unit earns in one currency (`unitCurrency`: rate plan's, else EUR for
  Germany, USD otherwise; `listingCurrency` would read the German listings as USD). Every money
  figure is for **one** chosen currency (header select, shown only when more than one is in
  scope) and RevPAR divides by the units earning in it. Occupancy, counts and durations span
  every unit. Never convert. The listing table shows each row in its own currency and sorts
  money columns by currency first.
- **Attribution** (`periodPerformance`): revenue and occupancy count nights inside the period
  (`nightsIn`: arrival night counts, departure night does not); stays, avg booking window and
  avg length of stay count **arrivals** in the period; cancellation rate counts bookings **made**
  in the period. Empty periods give zeros / nulls, never `NaN`.
- **Comparison** (`comparisonPeriod`): 30d / 90d compare with the stretch right before; 12m and
  YTD with the same dates last year (29 Feb clamps to 28). KPI badges use GM's `GmKpiCard`:
  points for rates (`formatSignedPoints`), percent for money and counts. Booking window and
  length of stay carry no badge (longer is not good or bad news). Cancellation colours inverted.
- **Trend** (`trendSeries`): day grain up to 31 days, week up to 120, month beyond. Current and
  comparison buckets are paired by position; a missing counterpart is `null`, not 0. Buckets cut
  by the period are flagged `partial` and the chart footnotes them for revenue, because a
  7-day October otherwise reads as a collapse.
- **Pace** (`bookingPace`): per coming month (the current one from today), occupancy booked and
  not cancelled as of today vs the same month last year as of this day last year.
- **Filters** live in `useState('analytics-filters')` (`AnalyticsFilters` = `AnalyticsScope` +
  period, custom range, compare mode, currency) and are edited in **`AnalyticsFilterPanel`**, a
  right-hand sidebar: pinned and sticky beside the charts from `xl` (collapsible, open state in
  `useState('analytics-filter-panel-open')`), a right `Sheet` below `xl`. The header Filters
  button decides at click time (`useMediaQuery`), so SSR markup never depends on it. Panel
  sections: Period (+ custom range picker), Compare with (radio), Revenue currency (toggle,
  only with more than one), then collapsible Region, Channels, Listings, Tags, Guest market
  lists (`AnalyticsFilterCheckList`, custom checkbox rows, search from 7 options), each with a
  count and Clear; "Reset all" in the panel header. No chips on the page (removed on request);
  the counts live on the Filters button and the section headers.
  - ⚠️ The page body uses **container queries** (`@container/analytics`, `@2xl`/`@5xl`), not
    viewport breakpoints, because the open sidebar takes width. KPI tiles are `GmKpiCard compact`
    so amounts do not wrap at four columns beside the panel.
  - Periods: last 7 / 30 / 90 days, last 12 months, this month, last month, year to date, last
    calendar year, custom. ⚠️ A custom range is clamped to `earliestRangeStart` (so a full year of
    data stays behind it for the last-year comparison) and to **today**: forward months belong to
    the Booking pace chart, which compares booked-so-far with booked-so-far. The picker gets the
    same bounds through the new optional `minValue` / `maxValue` props on `BaseDateRangePicker`.
  - Compare: previous period / same period last year / none. Picking a preset resets it to
    `defaultCompareMode` (calendar and year-long periods: last year; rolling windows: previous);
    a custom range keeps the current mode. With `none`, `previous` is null: KPI tiles drop their
    badges and show a plain hint, the trend draws one line with no legend, the table no delta.
  - ⚠️ `scopeUnits`: region and listings are any-of, tags all-of. `scopeBookings`: channel and
    market narrow the **bookings, not the units**, so occupancy filtered to Airbnb reads as the
    share of available nights sold through Airbnb. A scope that leaves no unit shows `Empty`.
- No dual-axis charts (the listing Overview chart has one; this page deliberately does not).
  Series colours are `--viz-1/2/3`; the comparison series is `--muted-foreground`.

- **Saved views** (`useAnalyticsSavedViews.ts`): the shared `SavedViewsDropdown` from Listings in
  the header. A view is a deep-copied snapshot of `AnalyticsFilters`; presets stay presets (a
  "Last 30 days" view keeps rolling), only a custom range is stored as dates. Custom views in
  `localStorage` (`elev8-analytics-saved-views`, active id in `elev8-analytics-active-view`),
  read once after mount (`restore()`), which re-applies the last active view. Default View is
  never stored and never dirty. `isDirty` uses `sameFilters` (pick order ignored). Loading another
  view with unsaved edits sets `pendingViewId`; the dropdown's prompt confirms or emits
  `cancelLoad`. Names are unique case-insensitively, "Default View" included. Deleting the active
  view falls back to Default and keeps the filters on screen.
  - The dropdown was changed for this: props are structural (`{ id, name, isDefault? }`, which
    also cleared two Review Hub type errors), a new `cancelLoad` event (the prompt used to assign
    to a computed and could not close), and the name / rename inputs now focus through `$el`
    (`.focus()` on the `Input` component threw, so typing a name went to the page).

#### Tests
`tests/lib/analytics.spec.ts`: night clipping, denominators, no currency blending, cancellation
attribution, empty-period zeros, presets and comparison periods, bucket coverage and pairing,
partial buckets, distributions, pace cut-offs, per-listing currency, and generator invariants
(deterministic, EUR for Germany, no double-booked night, nothing booked after the anchor,
believable occupancy and cancellation range).
`tests/composables/useAnalyticsSavedViews.spec.ts`: snapshot isolation, dirty check, duplicate
names, the unsaved-changes prompt (cancel and confirm), update / rename / delete, persistence and
restore, reset.

#### Not implemented
- Forward-looking periods (use Booking pace), export / download, filters in the URL, views shared
  between users (views live in this browser only).
- Reading real reservations, owner stays or blocks; pickup / forecast; revenue by room type.
- Component tests for the page (data layer only).
