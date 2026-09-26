> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### GM Dashboard Module (`app/components/gm/` + `app/composables/useGmDashboard.ts`)

The General Manager's dashboard, rendered on `/` in place of the demo dashboard when
`currentUser.roleId === 'role-general-manager'`. Same role-gating pattern as `GroDashboard`
(`app/pages/index.vue` runs `v-if` GRO → `v-else-if` GM → `v-else` the stock dashboard).

Modelled on the shadcnblocks Vue `dashboard14` block ("Hotel Dashboard with Bookings Panel"),
which is paywalled — only its description was available, so the four panels it names are
rebuilt from this repo's own shadcn-vue + `@unovis/vue` components rather than copied. The
block's glow effect on the revenue bars was dropped at the user's request: plain bars.

#### Why the data is generated (`app/components/gm/data/gm-dashboard.ts`)
Framework-free, the same split as `datev.ts` and `promo-code-form.ts`: the composable owns the
reactive state and calls in.

⚠️ **The stays are generated, not read from `reservations/data/reservations.ts`.** Those seeded
reservations are dated Jul–Sep 2026 across a handful of listings, so a dashboard about *tonight*
draws an empty chart on any other date. `buildGmStays(units, anchorIso)` instead generates a
deterministic portfolio (`mulberry32`, fixed seed) from the **real** listings — real ids, names,
locations, capacities and `pricing.nightlyRate` — anchored to the day the page is opened. Same
anchor in, same portfolio out, so a reload never reshuffles the numbers, and `listingId` still
deep-links to `/listings/:id`.

- `GmUnit` — one sellable unit per active listing (`toGmUnits`). Properties, not rooms: that is
  the denominator a GM quotes occupancy against.
- `GmStay` — `{ checkIn, checkOut, nights, guests, nightlyRate, total, status, eta, balanceDue, channel, region }`.
- ⚠️ **`GmStayStatus` is `Extract<ReservationStatus, …>`, not a parallel union** — the app's own
  status vocabulary, so anything rendering it can hand a stay straight to
  `ReservationStatusBadge` rather than growing a second colour/label map. Nothing on the dashboard
  paints a status badge today (the table that did was removed on request); the field still drives
  the header's unverified-arrivals count.
- `status` is derived from the anchor: `checked_out` once `checkOut <= today`, `checked_in` only
  while `checkIn < today < checkOut`, otherwise `verified` (or `unverified` for a roll within three
  days of arrival). ⚠️ **A guest arriving *today* is `verified`/`unverified`, never `checked_in`** —
  they are still due at their ETA. Marking them checked in also made `unassignedArrivals`
  permanently 0, so the header's unverified-arrivals badge could never fire.
- `occupiesNight(stay, iso)` is `checkIn <= iso < checkOut` — the arrival night counts, the
  departure night does not, so a same-day turnover is one arrival **and** one departure while the
  unit only sells once.
- `periodMetrics` returns revenue, ADR (per night **sold**) and RevPAR (per night **available**)
  and reports zeros rather than `NaN` for an empty period. `relativeDelta` reads a rise from an
  empty base as `+100%`, never `Infinity`.
- ⚠️ **`KPI_LOOKBACK_DAYS = 60`** — `buildKpis` compares the last 30 days against the 30 before
  them, so `buildGmStays` defaults to `pastDays = 70`. Generating only 45 left the prior period
  half empty and every trend badge inflated (RevPAR read "+118.7%"). A test pins this.
- Occupancy trends move in **percentage points** (`formatSignedPoints`), not percent of a
  percent; money and rate trends use `formatSignedPercent`.
- The sentiment helpers (`buildRegionByListingName`, `scopeToRegion`, `sortByAttention`,
  `summariseSentiment`) take a structural `AttentionConversation`, not the full `Conversation`,
  so the rules stay testable without the inbox store.

#### Composable (`useGmDashboard.ts`)
`anchorDate` is resolved once through `useState`, so the server and client agree on "today" even
when their clocks or timezones do not. Stays are generated for the whole portfolio and *then*
filtered by region, so a stay keeps its id (and the panel keeps its selection) across a region
change. Exports `isGeneralManager`, `region`/`regionOptions` (All / Bali / Germany, derived from
the listing location), `revenueRange` (`14d` | `30d`), `kpis`, `dayFlow`, `revenueSeries`,
`revenueRangeMetrics`, `todayBookings`, `selectedBookings`, `stripDays`, `stripOccupancy`,
`setSelectedDate`, `shiftStrip`, `goToToday`.

#### Components
- **`GmDashboard.vue`** — shell: header (persona line, unverified-arrivals badge, region `Select`,
  link to the operations calendar), the KPI row, then a 3-column grid — both charts in a 2-column
  span, and a right-hand "who needs me" column holding the sentiment panel above the bookings
  panel. Both right-column cards are lists of people; the charts keep the wide half.
- **`GmKpiCard.vue`** — one tile. `trend` states whether the change is *good news*, not merely its
  sign, so the colour is the caller's call.
- **`GmOccupancyChart.vue`** — the bidirectional one: `BarChart type="stacked"` with check-ins
  positive and **check-outs stored negative**, so a heavy turnover day reads as one tall column
  split by the zero line. The y-axis and tooltip strip the sign (`Math.abs`) — both series are
  counts.
- **`GmRevenueChart.vue`** — daily revenue bars over the chosen range, with the range total,
  occupancy and ADR in the card description. Plain bars, **no glow** — the reference block's glow
  was explicitly not wanted, so this card carries no `<style scoped>` at all.
- **`GmSentimentPanel.vue`** — the one panel not driven by the generated portfolio: it reads
  **real** negative-sentiment conversations from `useInbox`. Sits at the top of the **right**
  column. Each row carries the sentiment note (the reason the GM is being shown it, never
  truncated), the `Action needed` badge with its category chip and a `HIGH` priority chip, then
  two **icon-only** actions in the row header: open the conversation (`lucide:message-square` —
  selects it and navigates to `/inbox`, same as `GroDashboard`) and mark handled (`lucide:check`
  → `inbox.markAsHandled`, toast-confirmed). Mark handled and the header count appear only where
  something is actually flagged. Shows four rows, then defers to `N more in the inbox`.
- ⚠️ **The icon buttons carry `aria-label` and a `Tooltip`, and the tests select on that label.**
  An icon-only button has no accessible name otherwise. One `TooltipProvider` wraps the whole
  list rather than one per row — the provider is not global in this app.
- ⚠️ **No red card backgrounds, and rows stack rather than sit side by side.** A flagged row is
  marked by its **border** and its badges — `bg-red-*` was explicitly not wanted, and a test
  asserts the panel's markup contains none. The row is a vertical stack because the panel lives
  in the narrow third of the grid, where avatar + text + two buttons on one line would crush the
  note — three lines: header (avatar, guest, property, the two icon buttons), badge row, note. Red
  survives only as border and badge text, the same way `GmKpiCard` uses it.
- ⚠️ **Region scoping is best-effort here, and says so.** Conversations key their property by
  listing **name**, not id, and only 7 of the 15 mock names resolve to a listing in `listings`.
  `scopeToRegion` therefore returns `{ rows, excluded }` and the panel renders the `excluded`
  count ("3 more outside Bali, or on a property that is no longer listed"). Dropping them
  silently would make a filtered inbox look like it had gone quiet.
- `sortByAttention` orders rows `action_needed` first, then priority (high → medium → default),
  then newest message, so an old grumble nobody flagged cannot outrank a live one. It copies
  before sorting.
- **`GmBookingsPanel.vue`** — the date-strip navigator: seven day buttons (`data-testid="gm-strip-day"`),
  each carrying its own occupancy bar, so picking a date is also reading how full it is; prev/next
  page a week, `Today` returns. Below it, the selected date's `Collapsible` sections render
  **`GmBookingRow.vue`**. The `ScrollArea` needs `min-h-0 flex-1` — without it the panel grows
  instead of scrolling.

#### Tests
`tests/lib/gm-dashboard.spec.ts` (31 — date maths in UTC while "today" is read in local time,
the arrival/departure night rule, same-day turnover, ADR vs RevPAR, empty-period zeros, delta
signing, determinism, no overlapping stays in a unit, the 60-day lookback, and that
today's arrivals stay verifiable, plus region scoping, the attention sort and its
non-mutation) and `tests/components/gm/GmDashboard.spec.ts` (21 — KPI tiles and their trend colours, the strip's
selected/today marking and `aria-label` load readout, emitted date and week shifts, empty
states, region scoping, the chart point counts, and the sentiment panel's rows, flags,
conditionally-shown mark-handled action, emitted actions, the accessible names on its
icon-only buttons, empty state, exclusion disclosure and its border-not-background flagging).
⚠️ Harness notes that cost real time: the GM components reach each other through Nuxt
auto-imports, so they must be registered in `global.components` alongside the shadcn primitives;
a `Button` stub must **not** re-emit
`click` — the parent's own handler already falls through onto the stub's root, so re-emitting
fires it twice.

#### NOT implemented (intentionally out of scope)
- **Reading the seeded reservations** — see the warning above; nothing here writes to
  `useReservationsModule`, and a row links out to the listing rather than a reservation detail.
- **Currency handling** — every figure is formatted USD via `Intl`; there is no per-listing
  currency or FX step.
- **A today's-movements table** — there was one (arrivals / departures / in-house tabs); it was
  removed on request because the bookings panel already lists the same movements for any date,
  today included. `GmArrivalsTable.vue` and `GmStayTable.vue` are deleted, not orphaned.
- **Cleaning/housekeeping load** — `useCleaningJobs` is not wired in.
- **Sentiment beyond negative** — the panel is deliberately only the negative bucket; there is no
  positive/neutral breakdown, trend over time, or per-property sentiment score.
- **Date-range picker / export** — the region select and the 14d/30d toggle are the only filters,
  and there is no download.
