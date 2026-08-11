# Reservations & Guest Profiles — Design

**Date:** 2026-08-07
**Status:** Approved
**Module:** `app/components/reservations/` + `app/composables/useReservations.ts`

## Overview

A new **Reservations** feature with two pages: a filterable reservations list (`/reservations`) and a per-guest profile page (`/reservations/guests/[id]`). The feature unifies reservation data into a single standalone module (Approach 1), following the existing app patterns (key-management, payment-requests). Guest profiles aggregate every stay for a guest plus related data (activity, payment requests, upsells) with cross-links into the Inbox and other modules.

## Goals

- See all reservations in one filterable table with guest contact info
- Open any guest and see everything related to them: all stays (past + future), booking history, activity, payment requests, upsells, notes
- Cross-link to existing modules: Inbox conversation, Listing detail, Guest guides, Smart locks, Tasks
- Standalone, self-contained module; no coupling to inbox/finance internals

## Non-Goals

- No calendar/board view of reservations
- No real API integration (all mock client-side state)
- No editing of reservations beyond creating a new one (no edit/delete)
- No auth/permissions gating

## Architecture

Follows the app's standard module structure:

```
app/composables/useReservations.ts          # state + filters + derived data
app/components/reservations/data/reservations.ts   # types + mock data
app/components/reservations/ReservationTable.vue
app/components/reservations/ReservationGuestCell.vue
app/components/reservations/ReservationDetailSheet.vue
app/components/reservations/NewReservationDialog.vue
app/components/reservations/GuestProfileHeader.vue
app/components/reservations/GuestReservationsTable.vue
app/components/reservations/GuestBookingHistory.vue
app/components/reservations/GuestActivityTimeline.vue
app/components/reservations/GuestPaymentRequests.vue
app/components/reservations/GuestUpsells.vue
app/components/reservations/GuestNotes.vue
app/pages/reservations/index.vue
app/pages/reservations/guests/[id].vue
```

Sidebar: new "Reservations" item in the **General** group (`app/constants/menus.ts`), icon `i-lucide-calendar-check`.

## Data Model

### `app/components/reservations/data/reservations.ts`

```ts
export type ReservationStatus = 'inquiry' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'

export interface ReservationEntry {
  id: string
  guestId: string
  guestName: string
  guestEmail: string
  guestPhone: string
  guestLanguage: string
  guestNotes: string
  listingId: string
  listingName: string
  channel: 'Airbnb' | 'Booking.com' | 'Direct'
  checkIn: string   // ISO date
  checkOut: string  // ISO date
  nights: number
  guestCount: number
  totalPrice: number
  currency: string
  status: ReservationStatus
  // relation keys (optional)
  conversationId?: string
  paymentRequestId?: string
  guestGuideId?: string
  upsellIds?: string[]
  activity: ActivityEvent[]   // reuse inbox shape
}

export interface GuestProfile {
  id: string
  name: string
  email: string
  phone: string
  language: string
  notes: string
  previousStays: number
  tags: string[]
  createdAt: string
}
```

- **Mock data**: ~40 reservations. Source: the 6 rich inbox reservations (enriched with guest details/activity) + the finance `ReservationEntry` rows (blended). Several repeat guests (same `guestId`) so profiles have history.
- **Guest profiles are derived from the reservation dataset** (single source of truth). `GuestProfile` records exist for the primary repeat guests; every reservation's `guestId` resolves to a profile, with fallback derivation from the reservation's guest fields.

### Composable `app/composables/useReservations.ts`

Follows the `useState` pattern (key-management/payment-requests); no localStorage persistence.

- State: `reservations`, `guests` (both `useState`, seeded from mock data)
- Filters: `search` (guest name/email/listing/booking id), `status` (single), `listings` (multi `string[]`), `dateRange` (`{ from, to }`)
- Computed: `filteredReservations`, `stats` (`upcoming`, `current`, `past`, `cancelled` counts), `listingOptions`
- Actions: `createReservation(draft)` (validates required fields; toasts on success/failure), `getGuestById(id)`, `getReservationsForGuest(guestId)` (all stays, sorted check-in desc), `clearFilters()`
- Past/current/upcoming computed against today's date
- Mutations use spread syntax (repo convention)

## Pages

### `/reservations` — Reservations List

- **Header**: title + total count; "New Reservation" button (opens create dialog)
- **Stats row**: 4 cards — Upcoming, Current, Past, Cancelled (clickable to filter)
- **Filter bar**: search input, status dropdown, listing multi-select (Popover + tags, like Payment Requests), date range (RangeCalendar)
- **Active filter chips**: removable, below filter bar
- **Table** (shadcn Table):
  - Guest (avatar initials + name + email; name → `/reservations/guests/[id]`)
  - Listing (→ `/listings/[id]`)
  - Check-in, Check-out, Nights, Guests, Channel, Total, Status (badge), Actions (dropdown: View Reservation, Open Guest, Copy booking id)
  - Status badge colors: `inquiry` warning, `confirmed` default, `checked_in` blue, `checked_out` muted, `cancelled` destructive
- **Row click** → opens right-side `ReservationDetailSheet` (matches Inbox panel pattern; keeps list context)

### `/reservations/guests/[id]` — Guest Profile

- **Header card**: avatar initials, name, email/phone (click-to-call), language, tags, previous-stays count, created date; actions: Send WhatsApp, Open conversation, New reservation
- **Stats strip**: Total stays, Upcoming, Current, Total spent (sum of non-cancelled)
- **Sections** (stacked):
  1. Reservations — all stays for the guest (past + future), each links to listing, shows status; current/future show "Open conversation"
  2. Booking history — previous-stays data (host/guest review ratings if present)
  3. Activity timeline — reservation activity events (messages, reservation, guide_sent, cleaning, task, system)
  4. Payment requests — linked via `paymentRequestId` (or email/phone match)
  5. Upsells — linked upsell orders for their stays
  6. Notes — editable inline (saves to state, toast confirm)
- **Related links row**: quick-link cards (Conversation, Guest guide, Smart locks, Tasks) shown only when relation keys present
- **Guest not found**: friendly empty state with back link

## Cross-links

- Reservation table guest name → guest profile
- Guest profile "Open conversation" → inbox conversation (via `conversationId`)
- Listing names → `/listings/[id]`
- Inbox `ReservationGuest` / reservation panel can later link to the guest profile (future; not in this scope)

## Edge Cases

- Guest with no stays → per-section empty states
- Guest with only cancelled stays → Total spent 0, Upcoming/Current 0
- Missing relation keys → related-link cards hidden
- Same guest across channels → aggregated via `guestId`
- Unknown guest id → "Guest not found" state
- Date-range/no-result filters → table empty state + clear-filters button
- Click-to-call → phone sanitized to digits

## Error Handling

All client-side mock state; no network errors. Missing-data cases handled with empty states. `createReservation` validates required fields (guest name, listing, check-in/out) and toasts on success/failure.

## Testing

- New vitest unit tests: `useReservations` filters (search, status, listing, date range), `getReservationsForGuest` sorting/aggregation, `getGuestById` missing case, stats computation
- Run `pnpm test` and `pnpm lint` before done

## Conventions

- shadcn-vue components from `app/components/ui/`
- Semantic theme tokens, no hardcoded colors (ElevAI gold only for AI branding)
- `lucide:` icons
- Spread syntax for state mutations
- Toast feedback via `vue-sonner` for user actions (create, save notes)
