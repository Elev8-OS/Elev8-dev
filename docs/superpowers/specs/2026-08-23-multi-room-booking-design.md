# Multi-Room Booking Design (Hotel-Style Rooms in One Reservation)

Date: 2026-08-23
Status: Approved
Module: Reservations

## Goal

Allow a single reservation to book multiple rooms/units in one property, hotel-style. Two booking modes: **Entire property** (all units booked at once) and **Rooms** (pick units one by one as line items). Plus per-unit availability checks with a confirm-override flow, and a payment-charge selector that feeds the existing payment-request module.

## Data Model

Extend `ReservationEntry` and `ReservationDraft` in `app/components/reservations/data/reservations.ts` (all fields optional, so existing seed data stays valid):

```ts
export interface ReservationRoomLine {
  id: string
  unitTypeId: string
  unitId: string
  unitName: string          // e.g. "Master Suite (K1)"
  ratePlanId: string
  rateLabel: string         // e.g. "Kingbed — Standard Rate"
  pricePerNight: number
  lineTotal: number         // pricePerNight × nights
  guestNames?: string       // optional, comma-separated guests in this room
}

// on both ReservationEntry and ReservationDraft
rooms?: ReservationRoomLine[]
bookingMode?: 'entire_property' | 'rooms'
paymentFeeMode?: 'card' | 'manual' | 'no_fee'   // default 'card'
paymentCustomFeePct?: number                     // used when feeMode === 'manual'
```

- `totalPrice` = sum of `lineTotal` for all rooms (still manually editable after).
- `guestCount` = total guests across rooms.
- Reservations without `rooms` (all existing seed data) remain valid; the detail sheet shows a fallback "—" or hides the Rooms section.

## Booking Modes

Both modes live in the "Rooms & Price" accordion section and require property + dates first.

### 1. Entire property
- All units of the selected property are booked automatically.
- Each unit line uses its **base rate** (`ratePlans.find(rp => rp.isBase)`); fallback to first rate plan, then listing `nightlyRate` for listings without unit types.
- Total = Σ (base rate per unit × nights).
- One guest group for the whole property (existing Contact Details section).
- If any unit is already booked in the date range, an AlertDialog lists all conflicts at once: "N of M units are already booked: … Book remaining units anyway?" → Override continues with all units (deliberate double-booking), Cancel stays blocked.

### 2. Rooms (per room)
- "+ Add room" opens a unit picker (unit types grouped, same style as ListingHeroCompact unit switcher).
- Per room: unit, rate (Select of that unit type's rate plans — selecting a rate immediately sets price), optional guest names.
- Multiple rooms can be added; each renders as a small card: unit name, rate label, price/night, line total, remove button.
- Availability check marks units booked in the selected date range with a "Booked" badge + conflicting reservation info (guest name + dates).

## Availability & Conflict Override

- Conflict detection: overlap of `[checkIn, checkOut)` between the new reservation and existing reservations that reference the same `unitId` (compare via the same listing). Pattern follows `useOwnerStays.detectConflicts` (per-unit + date-overlap checks).
- Booked units cannot be added silently: clicking one opens an **AlertDialog**: "This unit is already booked for {dates} by {guest} ({reservationId}). Book anyway?" → Cancel stays blocked, **Override** adds the unit with a "Conflict" badge.
- Entire-property mode: one AlertDialog listing all conflicting units; Override confirms all.
- Overridden reservations persist normally and show up as conflicts in future availability checks.

## Payment Charge

New field in Rooms & Price: **Payment charge** Select:
- **Card (+3%)** — default. Guest pays amount + 3% via payment link.
- **Custom (%)** — shows a percentage input (e.g. 2.5).
- **No fee** — no extra charge.

Behavior:
- Maps to existing `feeMode` in `usePaymentRequests.createRequest({ feeMode, customFeePercentage })`.
- Only affects the payment link; the reservation total itself stays the room sum.
- Small preview: "Guest pays: {total + fee} via payment link" (when a payment-link checkbox is on).
- Always visible (not only when payment checkboxes are checked), but only applied when a link is created.

## Surfaces

1. **NewReservationDialog.vue** — Rooms & Price section rebuilt: mode toggle (Entire property / Rooms), room picker + room cards, availability badges, override AlertDialog, payment charge selector, running total in the accordion header.
2. **EditReservationDialog.vue** — same section; prefills `rooms`/`bookingMode`/`paymentFeeMode` from the reservation; can add/remove/switch units and change mode.
3. **ReservationDetailSheet.vue** — new "Rooms" accordion section: breakdown per room (unit, rate, guests, subtotal), booking-mode badge, payment charge summary. Hidden when `rooms` is empty.

## Validation & Save

- At least 1 room required in `rooms` mode; entire-property mode auto-fills all units.
- Save writes `rooms`, `bookingMode`, `paymentFeeMode`, `paymentCustomFeePct` into the entry/draft (spread-through already supported by `createReservation`/`updateReservation`).
- Payment-link creation passes `feeMode`/`customFeePercentage` to `createRequest`.

## Out of Scope

- Per-room dates (all rooms share the reservation's check-in/check-out).
- Group bookings across different properties.
- Splitting payments per room.

## Verification

1. Lint + typecheck on touched files.
2. Dev server: create a reservation in `rooms` mode with 2 rooms → total = sum; table + detail sheet show the new reservation; payment-requests page shows the pending request with the chosen fee mode.
3. Edit dialog prefills rooms and allows switching mode.
4. Booked unit shows "Booked" badge; clicking opens override AlertDialog; overriding adds with "Conflict" badge and persists.
5. Entire-property mode books all units and sums base rates.
