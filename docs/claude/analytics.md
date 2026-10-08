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

#### Tabs: Overview / Revenue / Reservations
- `Tabs` under the header; the open tab is in the URL (`?tab=revenue`, Overview has none), so a
  refresh or a shared link opens it. Every tab reads the same scoped bookings, period, comparison,
  currency and revenue basis, so a Revenue-tab total always matches the Overview Revenue card.
  The tab figures are lazy computeds in `useAnalytics`: only an open tab is worked out.
- **Revenue** (`revenue-insights.ts`): revenue by channel (stacked per bucket, on the basis);
  "Where gross revenue goes" (stacked owner net / management commission / payment fees / OTA
  commission, each bar adds up to gross, ignores the basis switch); ADR by day of week (by each
  **night's** weekday, not the arrival's); the period's Gross to owner net table with shares of
  gross; revenue by listing as horizontal bars, top or bottom 10, ranked **only within the chosen
  currency** (others counted and named, never compared across currencies).
- **Reservations** (`reservation-insights.ts`): average reservation value and average length of
  stay as metric cards with the comparison line (ARV in the chosen currency on the basis; ALOS over
  every stay, neutral badge); bookings made vs cancellations **by the day they were made /
  cancelled**; arrivals vs departures of confirmed stays; confirmed reservations by nights
  booked (the only length-of-stay distribution: the Overview's duplicate "Length of stay" chart
  was removed on request, leaving Booking window full width there); guests and party size. ⚠️ Generated stays carry only a head count, so `partyMix` derives
  adults / children from a hash of the booking id (no extra random draws, which would reshuffle
  every stay), never fewer than two adults.
- `AnalyticsSeriesBarChart` is the shared grouped / stacked bar card. It draws its **own wrapping
  legend**: the stock one is a single right-aligned row that spilled into the neighbouring card.

#### Stay extensions (generated, `stayExtensionFor` + `extension-insights.ts`)
- The generator extends about `EXTENSION_SHARE` (14%) of stays that have a free night after them,
  usually 1 to 3 nights, now and then a week, **only into the gap it was leaving empty anyway**
  (no double-booked night). ⚠️ Decided from a hash of the booking id, never `rand`, so adding
  extensions reshuffled no stay. An extension agreed after the anchor does not exist yet.
- Same two shapes as the real flow (`docs/claude/stay-extension.md`): a Direct stay grows in place
  (`extendedNights`, `extendedOn`, already inside `nights` / `checkOut`); an OTA stay keeps its
  dates and the added nights become a linked Direct booking (`extensionOf`, id `<parent>-ext`,
  `bookedOn` = the day it was agreed). ⚠️ That linked booking is a reservation like any other in
  every existing figure (stays, arrivals, channel mix, lead time), as it is on the owner statement.
- Reservations tab, after Guests and party size: four `GmKpiCard`s (Extension rate with a points
  badge, Avg. extra nights with no badge, Extension revenue on the basis, Fees saved) and a stacked
  "Extension revenue" bar card (Direct stays extended / OTA stays rebooked direct).
- Attribution: rate and extra nights by the stay's **arrival** (linked bookings are not stays of
  their own here); revenue by the **added nights inside the period**, on the revenue basis, chosen
  currency only. Fees saved = gross of the linked nights x (OTA fees of the parent's channel minus
  Direct card fees), always gross.
- No payment status: the generated data has none (the real flow's pending / paid lives on
  `ReservationEntry.extensions`).

#### Revenue basis: gross / net / owner net (`revenue-basis.ts`)
- A sidebar switch, **not a filter**: the same bookings, valued differently. Stored in
  `filters.revenueBasis` (default `gross`), so saved views keep it. Changes revenue, ADR, RevPAR,
  channel-mix revenue and the table's money columns; occupancy and counts never change. Money
  card titles carry the basis ("Revenue (owner net)"); an info button beside the Revenue figure
  opens a popover listing Gross, OTA commission, payment fees, management commission and the
  result (`revenueBreakdown`). ⚠️ Keep it in the popover: inline in the header it made the
  Revenue card taller than its neighbour and broke the shared card rhythm (asked to fix).
- Gross = room price the guest paid, **taxes excluded on every basis** (collected for the
  authorities). Net = gross minus `CHANNEL_FEES` (demo: Airbnb host-only 15%, Booking.com 15%,
  Direct 2.9% card fees). Owner net = net minus the management commission.
- ⚠️ Owner net reuses `calculateCommission` / `findEffectiveCommissionRule` from
  `owners/data/commission-rules.ts` with the **live** `useOwners()` mappings and rules, so a rate
  means the same as on the owner statement. Rules are monthly, so `buildCommissionRates`
  computes the commission per listing-month (each co-owner's rule on their ownership share, an
  unheld share pays nothing, net-basis rules deduct exactly the platform fees) and stores it as a
  share of that month's gross; each night then carries its share, so channel / market filters
  stay coherent. Rates come from **all** bookings, never the filtered ones. A listing without a
  contract has no rate: its owner net equals net (the panel says how many have a contract). A
  month with no revenue carries no commission, so a hybrid's fixed fee is not charged on it.
- Operating expenses are deducted on no basis: they are not tied to nights. Profit after
  expenses stays on the owner statement.
- Valuers thread through `periodPerformance`, `trendSeries`, `channelMix` and
  `listingPerformance` as an optional last argument defaulting to `grossValue`.

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
  by the period are flagged `partial` and the Revenue card footnotes them, because a 7-day
  October otherwise reads as a collapse.
- **Metric cards** (`AnalyticsMetricCard`, built to a reference screenshot): Revenue, Occupancy,
  Average Daily Rate and RevPAR each get their own card, all visible at once (no metric switch),
  two per row: title, the period figure (`formatOwnerMoney`, 2 decimals), the date range, and a
  straight-segment line with a hollow dot per bucket. The y axis starts at 0 and steps in round
  values (1 / 2 / 2.5 / 5 x 10^n, occupancy fixed 0-100%); at most ~7 x labels so none wraps in
  a half-width card. With a comparison on, a muted dashed second line shows the comparison
  bucket in the same position (legend names the mode, tooltip shows both); the change badge
  sits in the card header. With "No comparison" the card is a single line with no legend.
  Built on `VisXYContainer` directly (the stock `LineChart` has no y domain or dots).
  The KPI row keeps only the figures without a trend: stays, booking window, length of stay,
  cancellation rate.
- **Listing table** is full width and paginated (10 / 20 / 50, first / previous / next / last,
  same controls as the upsell orders table); sorting or a page size change returns to page 1,
  a shrinking row count clamps the page.
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
    so amounts do not wrap at four columns beside the panel; metric cards span 2 of the 4 columns.
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
`tests/lib/analytics-tabs.spec.ts`: channel and breakdown series add up to the Overview figures,
per-currency ranking, weekday attribution per night and clipping, pickup / movement dates, the
party split, stay averages and their comparison pairing.
`tests/lib/analytics-extensions.spec.ts`: generated share and shapes, linked booking starts at the
parent's check-out, nothing agreed after the anchor, arrival vs night attribution, no currency
blending, revenue basis, series adding up.
`tests/lib/analytics-revenue-basis.spec.ts`: channel fees, basis on revenue / ADR / RevPAR with
occupancy unchanged, flat and net-basis rules, co-owner shares, uncontracted listings, the rule
per month a stay crosses, cancelled stays, and that the breakdown adds up.

#### Not implemented
- Forward-looking periods (use Booking pace), export / download, filters in the URL, views shared
  between users (views live in this browser only).
- Reading real reservations, owner stays or blocks; pickup / forecast; revenue by room type.
- Component tests for the page (data layer only).
