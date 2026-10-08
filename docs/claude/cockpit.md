> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Cockpit (`/cockpit`, `app/components/cockpit/`)

Every listing on one tape chart, styled after a hotel booking chart the user picked: slanted bars, a header row per listing with free units and a price pill, a date header with arrivals and occupancy. The old owner calendar card (`PortalReservationCalendar`) was removed from this page; that component still lives in the owner portal (`owner-portal/stays.vue`).

#### Data: Reservations module only
- ⚠️ Stays come from **`useReservationsModule` only** (what the Reservations page lists), never `listing.bookings`, so every bar is a reservation and opens `ReservationDetailSheet` (looked up live by id). They are drawn through `reservationToBooking`, which keeps the reservation id (owner requests and maintenance blocks become blocks).
- `data/cockpit.ts` is framework-free; specs in `tests/lib/cockpit.spec.ts`.
  - `buildCockpitGroups(listings, reservations)`: one group per active listing, by name. A single-unit listing has one `unit` row (id = listing id); a multi-unit listing has one `room` row per active room (`<listingId>:<unitId>`, stays by `stayUnitIds`) plus `Not assigned to a room` when a stay has no room.
  - Nights: `occupiesNight` counts the arrival night, not the departure. Cancelled stays and inquiries hold nothing (`isLiveStay`). A listing `blockedDates` entry closes every unit. `freeUnits` counts an unassigned stay against the free rooms.
  - `nightlyRateOn` (seasonal rate covering the night, else `pricing.nightlyRate`), `listingCurrency`, `formatMoney` (`ISO amount`).
  - `availableRowIds` (Find availability), `filterGroups` (name search + tags, AND).
  - `conflictIds`: two live stays (not cancelled, not inquiry) sharing a night in one unit or room row. The unassigned row is never a conflict.
  - `todaySummary(groups, todayKey, actionNeeded)`: booking ids for arrivals, departures, in house, unassigned (not left yet), action needed (not left yet), double booked (not over yet). Blocks are not guests.
  - `stayVisible` / `CockpitStayFilters` (statuses, channels, `showCancelled`, `actionOnly`): filters hide BARS only; availability always counts every stay. `groupsWithAction`, `hasStaysIn`, `activeFilterCount`.
  - `portfolioOccupancy`, `arrivalsOn` (each reservation once, though a multi-room stay sits on several rows), `nowFraction`, `selectionStay`.
  - Ranges: `COCKPIT_RANGES` (1 / 2 / 4 weeks, 1 Month, Custom), `rangeLength`, `addIsoMonths` (clamps to month end), `MAX_CUSTOM_DAYS` = 92.
- `data/cockpit-prefs.ts`: period, custom length, tags, filters and folded listings, per browser in `localStorage` (`elev8.cockpit.prefs`), guarded on `typeof localStorage` and try/catch; missing fields fall back. Loaded after mount (SSR-safe), saved on change. The start date is not kept: the board opens on today. Specs in `tests/lib/cockpit-prefs.spec.ts`.

#### Page (`app/pages/cockpit.vue`)
- Toolbar: the period as the title ("October to November 2026", `h1` with a screen-reader "Cockpit, " prefix) over the exact dates, then « (one month back) ‹ (one period back) Today › ». Right: period select, Custom date picker (bound to the period on screen), Find availability. 1 Month steps by calendar month.
- `CockpitTodayStrip`: counts from `todaySummary`; a count focuses its stays (others fade, `focusIds`), again clears; focusing brings today on screen. Owner requests open the approvals sheet (`OwnerStayApprovalsPanel`).
- Empty-period note when no reservation touches the period, linking to Reservations.
- Action needed: the page builds the reservation id set from `useInbox` conversations with `status: 'action_needed'` and passes it down, so the bar never imports the Inbox store. The marker opens the conversation via `inbox.openForReservation` then `/inbox`, like the sheet's Inbox button.
- Click or drag on a unit row (`selectionStay`): the date dragged FROM is the check-in and the date dragged TO is the check-out, as the bar is drawn midday to midday, so dragging the 8th to the 9th is one night, 8 to 9. A click on one date is one night from it. ⚠️ An earlier rule read every touched date as a night (8 and 9 became 8 to 10); the user read that as wrong. While dragging, a slanted preview bar shows where the stay will sit and its night count (red when a night is taken). Then `CockpitCreateDialog` offers New reservation (opens `NewReservationDialog` with `prefill` listing and dates; on `created`, a room row's room is assigned with `assignRoom`) or Block nights (`createReservation` with `status: 'blocked'`, the reason in `guestNotes`, then `assignRoom`). A range with a taken night is refused with a toast.
- Drag a bar onto a room of its listing (or back onto Not assigned): `assignRoom` / `unassignRoom`, placement only. Only stays without priced room lines can move (`canAssignRoom`).

#### Board (`CockpitTimeline.vue`)
- ⚠️ **Rates are per room type.** A multi-unit listing's header row shows only its total free rooms; under it, each room type (`CockpitGroup.types`, `CockpitRoomType`) has its own header row with that type's free rooms (`typeFreeUnits`; a stay with no room counts against no type) and its own rate pill (`roomTypeRate`: the type's base rate plan, else its first, else the listing's `pricing.nightlyRate`; in the type's currency), then its rooms. Room types fold on their own (`<listingId>:type:<typeId>` in the folded list). "Not assigned to a room" comes last. A single-unit listing has no room types (the seed data gives none), so its header shows the listing rate (`nightlyRateOn`, with seasonal rates). Seasonal rates live on the listing only, so a room type's pill does not change by season.
- One CSS grid per row: `var(--cockpit-left)` (`9rem` phone, `17rem` from `md`) then two half-day columns per day. Every listing has a header row (name, rooms and location, fold chevron; per day the free units, red at 0, and for a single-unit listing a `USD 185` rate pill, whole amounts, full rate in the tooltip) over its unit rows, which hold only bars. A single-unit listing's unit row is named by `listing.room`, else "Whole property".
- Date header: arrivals badge (hidden at 0), weekday, large date, occupancy %. Month name on the first day and every 1st, with a stronger line. Today's column is tinted `primary/10` across the board, today's date is a gold pill, and a gold line with a time pill marks now (`nowFraction`, ticks each minute).
- Bars stack in lanes (`assignStayLanes`). Cancelled stays get their own lanes below the live ones: each is a `1.5rem` grid row whose bar aligns to the bottom and overflows up, so it tucks under the bar above; earlier lanes paint over later ones.
- Gold dots mark a bar's end that arrives or leaves today.
- Corner tools (`CockpitBoardTools.vue`, above the board on a phone): Filters popover (Action needed only, Show cancelled, Status, Channel, Tags; `ScrollArea` needs a fixed height), colour legend, fold all, New reservation, search.
- Keyboard: arrow keys move between bars (left/right in the row, up/down to the nearest bar by date); Enter opens.
- ⚠️ History of what users rejected, do not bring back: rates printed only where they change (read as missing info); values only in the afternoon half (empty mornings); a tinted occupancy band without numbers.

#### Bar (`CockpitStayBar.vue`)
- One line (`h-8`), slanted ends via `clip-path` where the stay really starts or ends, square where it runs off the view. ⚠️ **Status colours are `stayBarClasses`, unchanged** (the user asked to keep them). Stays already checked out are lighter; cancelled are grey and hatched. Name only on the bar; times, guests and channel are in `ListingStayHoverCard`.
- Because of `clip-path`, outer rings are clipped: the conflict mark and the focus ring are `ring-inset`; a conflict also shows an alert icon.
- **Extensions** (`extensionJoins`): an extension is its own reservation with `extensionOf` = the original's id. Where it meets the part of the same stay it touches (the original, or an earlier extension, so chains link too; nights added after meet on that part's check-out, an early arrival on its check-in), the board draws a round link icon in the slanted gap, on the stay's lane. Clicking it opens the extension. Only when both bars are drawn on that row and the date is in view; a guest who merely arrives as another leaves never gets one.
- The Action needed marker is a red dot at the bar's start, a sibling button (not inside the bar button).
- `ListingStayHoverCard` takes an optional `v-model:open`; the bar closes it on click so it never covers the sheet.
- Cockpit-only: the listing calendar keeps the one-line `ListingStayBar`.

#### Related fixes outside the module
- `NewReservationDialog` turned picked dates into strings with `toDate().toISOString()`, which in Bali (UTC+8) saved every new reservation one day early; it now reads the date itself. It also never emitted its declared `created` event; it does now.
