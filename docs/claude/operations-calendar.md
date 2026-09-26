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
  - `OperationsCalendarCreateDialog.vue` — New cleaning job / task creation
- **Key fix**: Reka UI `CheckboxRoot` ignores external `:checked` prop changes after initial render. Filter checkboxes use native `<button @click>` for toggle logic + plain `<span>` with reactive Tailwind classes for visual — no Reka UI checkbox component to avoid desync.
