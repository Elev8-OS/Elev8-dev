> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Operations Calendar Module (`app/components/operations-calendar/`)

Time-based view of guest stays, cleaning jobs, and tasks. Week/day views with hierarchical tree.

- **Data + types**: `app/components/operations-calendar/data/operations-calendar.ts`
  - `OperationsFilters` type with `listingSearch`, `listingTags` (AND logic), `eventTypes` (OR logic)
  - `CalendarEvent` type with `type: 'guest_stay' | 'cleaning' | 'task'`, `listingId`, scheduled times
  - Build helpers: `buildAllEvents()`, `eventsForDay()`, `getWeekDays()`, `groupEventsByListingAndDay()`
  - Events built from cleaning jobs + tasks (not inbox conversations)
  - ⚠️ **Stays come from TWO disjoint datasets, merged by `calendar-stays.ts`.** The Reservations
    module (`useReservationsModule`, 23 stays: the Reservations page, damage protection, city
    tax, the folio) and `listing.bookings` (71 stays, the listing mock data the calendar was built
    on) never sync and share no stay, by id or by listing and dates. The calendar used to read
    only `listing.bookings`, so **no stay made on the Reservations page ever appeared on it**.
    `getCalendarListings(reservations)` / `buildAllEvents(jobs, reservations)` now merge both via
    `mergedBookingsFor`; without the argument they return `listing.bookings` alone, as before.
    Owner stays and maintenance blocks from the Reservations module become `type: 'block'`
    (`reservationToBooking`), the convention `listing.bookings` already uses.
  - **Stay bars are drawn in half days** (`stayBarSpan`, `HALF_DAYS_PER_DAY`): the room row's
    grid is 14 columns a week, a day cell spans two. A guest checks in after 12:00 and out before
    it, so a bar starts in the SECOND half of its check-in day and ends in the FIRST half of its
    check-out day; on a turnover day the departing bar stops at midday and the arriving bar starts
    there. A bar is inset (`ml-1` / `mr-1`) and rounded only at an end that is a real check-in or
    check-out, which leaves a visible gap between consecutive guests while a stay running off the
    week keeps a flat edge. Cancelled stays and inquiries draw no bar. The title attribute names
    the guest, the dates and the status, since a half-day bar truncates the name.
  - ⚠️ **Rows: listing first, then its rooms.** There are no property or "room text" group levels any more (the old `listing.property` / `listing.room` headers like "Canggu Properties" / "2-Bedroom Suite" were removed; listings sort by name). A multi-unit listing's row is the **whole property** ("Whole property · N rooms") and, unless folded with its chevron (`rooms-<listingId>`), one row per room follows (`CalendarListing.rooms`, from `unitTypes[].units`). A room row shows the stays in that room (`stayUnitIds`: priced room lines, else `assignedUnitIds`, the same rule as the listing Calendar tab) and events whose `unitId` is that room; the listing row shows what has NO room (unassigned stays, common-area cleanings, tasks, upsells). `CalendarEvent.unitId` comes from `CleaningJob.unitId`; a check-out cleaning built from a stay (`buildCheckoutCleanings`, given the reservations) gets one per room the stay occupied, or one on the listing row. Rows are keyed by tree node id (`<listingId>` or `<listingId>:<unitId>`) for stay layouts. Clicking a day on a room row creates for that room (`create` carries `unitId` → the page → `OperationsCalendarCreateDialog` `unitId` → `CleaningJobForm` `defaultUnitId`), and dropping a cleaning on a row moves it there (`moveEvent` carries `unitId`; `moveCleaning` sets `unitId`/`unitName`, or clears them on the listing row); the reschedule confirmation names the room. Tasks can have a room too: `Task.unitId` / `unitName` (optional), picked in the task form through the same `ListingPicker pick-rooms` and prefilled from a room row; a task with a room sits on that room's row (`buildTaskEvents` sets `unitId` only if the listing still has the room), one without on the listing row. The cleaning sheet (`CalendarEventDetailDialog`) shows the room under the listing name ("Whole property" for a multi-unit listing's cleaning or task without one, nothing for a single-unit listing), and both task sheets (`TaskEventDetailSheet`, the one the calendar opens, and `TaskDetailSheet`) show a Room line (or "Whole property") when the task's listing has rooms. Demo: lst-1 has three cleanings (Garden Unit, Master Suite, common areas) and two tasks (Master Suite, Pool Unit) dated from today (`demoAt` / `demoDay`), so rooms show on the current or next week.
  - **`ListingPicker.vue`** is a flat list of listings, sorted by name (no property / room-text groups). With `pick-rooms` (the cleaning form) a multi-unit listing's rooms sit under it, and `v-model:unit-id` gives the room (null = the whole property / common areas); the trigger reads "Listing · Room". Every other user (settings integrations, channels, cancellation policies) picks a listing only.
  - **Overlapping stays stack in lanes** (`assignStayLanes`): a multi-unit listing is one calendar
    row and its rooms are booked at the same time as a matter of course, so drawn in one lane a
    long stay hid every shorter stay beside it. Greedy by start, longest first; bars that only
    meet at midday share a lane. The room grid's rows are `repeat(laneCount, auto) 1fr`, and the
    day cells sit in the row after the last lane.
  - **A bar is coloured by its reservation status**, from `reservationStatusClasses` in
    `reservations/data/reservations.ts`, the same map `ReservationStatusBadge` reads (moved out of
    the badge so there is one). A calendar block has no status, so `bookingReservationStatus`
    reads an owner stay back out of `OWNER_STAY_BLOCK_REASON` and treats any other block as
    `blocked`. The old per-listing `listingColors` is gone.
  - The same union feeds `GuestInfoCard` (the guest card in the cleaning form), the Board's stay
    bars, and the cleaning auto-link (`allStays`), so the calendar, the form and a cleaning's
    `reservationId` can never disagree about who is staying.
  - **Tech debt:** the real fix is ONE source, moving `listing.bookings` into the Reservations
    module. It touches the listing Overview and Calendar tabs, the GM dashboard, housekeeping and
    more, so it is deliberately its own piece of work. Until then, read stays through
    `calendar-stays.ts`, never from one source alone. `ReservationHousekeepingSection.vue` still
    reads `listing.bookings` directly (line ~151) and has not been moved over.
- **State**: `app/composables/useOperationsCalendar.ts`
  - `filters` — `ref<OperationsFilters>` with spread assignment to trigger reactivity
  - Computed: `filteredListings` (search + tag AND filter), `filteredListingIds` (Set), `hasListingFilter`, `filteredEvents` (listing + event type), `eventsByDay`, `eventsByDayAndListing`, `eventsByListingAndDay`
  - Navigation: `previousWeek()`, `nextWeek()`, `goToToday()`
  - Actions: `moveCleaning()`, `clearFilters()`, `toggleEventType()`
- **Page**: `app/pages/operations-calendar.vue`
  - Week/Day toggle (Tabs), prev/next/Today navigation buttons
  - Filters bar + board grid, wrapped in `<ClientOnly>`
  - Lazy-loaded board, create dialog
- **Components**:
  - `OperationsCalendarFilters.vue` — Search input, Tags Popover (multi-select with search, AND logic), Event Types Popover (OR logic), Clear button
  - `OperationsCalendarBoard.vue` — Week/day grid rendering events by listing rows
  - `OperationsCalendarEventChip.vue` — Individual event chip in grid cells
  - `OperationsCalendarCreateDialog.vue` — New cleaning job / task creation. `only: 'cleaning' | 'task'` hides the tabs and shows one form ("New cleaning" / "New task"), used by the listing Maintenance tab; every open starts on that form, else Cleaning.
  - `CalendarEventDetailDialog.vue`: the event sheet. For a cleaning, the header shows the date and
    `scheduledAt` + `durationMinutes` range, then a guest card for the stay it belongs to (read
    through `mergedBookingsFor`, so both stay sources count). A check-out cleaning belongs to the
    departing guest on a turnover day; any other cleaning to the guest in the house, then the
    arriving one. The card shows the booking status, dates and nights, guests, the listing's
    check-out time and pets. Only a Reservations-module stay links (chevron) to
    `/reservations?reservation=<id>`, which opens that booking's detail sheet. The sheet has no
    Source section and no Mark as done button.
  - **Cleaning status shown to staff** is one of Not started, Ongoing, Completed, Missed
    (`cleaningDisplayStatus` in `cleaning/data/cleaning-jobs.ts`; a cancelled job keeps
    "Cancelled"). Draft, scheduled and confirmed read as Not started until the date passes, then
    Missed. The sheet and the chip use it; the cleaning form and filters keep the stored statuses.
    A Not started chip shows no badge.
  - **Reschedule** edits date, start and end. A job stores no end: the end is `scheduledAt` +
    `durationMinutes`, and saving writes the new duration. Moving the start keeps the length; an
    end at or before the start cannot be saved.
  - ⚠️ A cleaning event's `end` keeps the start's UTC offset (`addMinutesKeepingOffset`). The chip
    slices the time off the string, so a `toISOString()` end showed a Bali 13:00 as "05:00". Generated check-out cleanings use it too (they showed "11:00 – 05:00").
- **Key fix**: Reka UI `CheckboxRoot` ignores external `:checked` prop changes after initial render. Filter checkboxes use native `<button @click>` for toggle logic + plain `<span>` with reactive Tailwind classes for visual — no Reka UI checkbox component to avoid desync.
- ⚠️ **Cleaning steps gate**: `createJob` returns `null` (creates nothing) for a listing with no cleaning steps, and `applyReservationSchedule` drops such jobs. The create dialog's `CleaningJobForm` blocks Save first. Rule and data: `docs/claude/listings.md` (Cleaning steps gate), `cleaning/data/cleaning-steps.ts`.

