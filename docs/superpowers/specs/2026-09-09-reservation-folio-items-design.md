# Reservation Folio Items (Manual Charges)

**Date:** 2026-09-09
**Status:** Design approved, ready for implementation planning
**Module:** Reservations

## Problem

Front office and hotel staff need to add or remove chargeable items on a guest
reservation while the guest is still in house: a minibar beer, a laundry bag, a
late breakfast, a spa slot booked at the desk. Today the only way to change what
a reservation costs is the Edit Reservation dialog's `charges` array, which is a
full booking form, is auto-imported from the property's configured fees, and is
wiped whenever the listing changes (`ReservationRoomsSection.vue:417`). It is not
a place to post money staff collected two minutes ago.

## Goal

A folio on the reservation: the booked lines, the staff-posted items, a live
grand total, and a paid/unpaid state per item, all readable and editable from the
reservation detail sheet in a few clicks.

## Non-goals

- No invoice document or PDF. The folio block on the detail sheet is the
  statement staff read out. Invoice rendering stays out of scope, as CLAUDE.md
  already records.
- No Finance or accounting flow. See "Boundaries" below for why.
- No per-room folio splitting on a multi-room booking.
- No editing a posted item. One rule per state instead.
- No Upsell Order creation. The upsell catalog is read as a price list only.

## Data model

`ReservationEntry.folioItems?: FolioItem[]`, optional and additive, so no seeded
reservation migrates.

```ts
export type FolioItemStatus = 'unpaid' | 'paid' | 'voided'
export type FolioPaymentMethod = 'cash' | 'card' | 'room'
export type FolioItemSource = 'catalog' | 'custom'

export interface FolioItem {
  id: string
  label: string
  quantity: number
  unitPrice: number
  taxPercent: number
  servicePercent: number
  note?: string
  source: FolioItemSource
  /** Provenance only, never a live join. */
  catalogServiceId?: string
  catalogItemId?: string
  status: FolioItemStatus
  paymentMethod?: FolioPaymentMethod
  paidAt?: string
  voidReason?: string
  voidedAt?: string
  voidedBy?: string
  addedBy: string
  addedAt: string
}
```

### Rule 1: a catalog pick is a snapshot, not a reference

Label, price, `taxPercent` and `servicePercent` are copied from the
`UpsellService` / `UpsellItem` at the moment of posting. Raising the spa price
next week must not rewrite what a guest was charged last Tuesday.
`catalogServiceId` / `catalogItemId` are kept for reporting, and deleting the
service later leaves the posted line intact.

### Rule 2: line maths mirror the existing upsell path

Tax and service each apply to the line net, in parallel, never compounded, the
same way `UpsellOrderCreator.vue:79` computes an order:

```
net     = quantity * unitPrice
tax     = net * taxPercent / 100
service = net * servicePercent / 100
total   = net + tax + service
```

A folio line and an upsell order therefore price identically, which is the point
of reading the same catalog. Custom lines default both percentages to 0.

Tax and service round to the currency's minor unit (`Math.round(x * 100) / 100`),
not to the whole unit as `UpsellOrderCreator` does, because a CHF 6.00 beer at
10 percent owes 0.60 and not 1. IDR mock amounts are whole numbers already, so
nothing changes visibly there.

### Rule 3: voiding reverses the charge, and the refund falls out of the arithmetic

A voided item contributes 0 to the folio total regardless of its prior state.
The balance is one expression, `itemsBalance = itemsTotal - itemsPaid`. A paid
item that gets voided therefore drives the balance negative, which the summary
renders as `Refund due 18.00` instead of a balance. There is no separate credit-note
concept and no second code path.

### Payment methods, and what "charge to room" means

`cash` and `card` mean the guest settled at the desk: the item becomes `paid` and
leaves the balance. `room` means the opposite, that the charge is deferred to
checkout, so the item **stays `unpaid`** with `paymentMethod: 'room'` recorded
and still counts toward the balance. It renders as `Unpaid, on room account`.
Marking a deferred item paid later is the same Mark paid action with cash or
card. Treating charge-to-room as paid would read the balance as zero for money
nobody has collected yet.

### Removal rules

| Item state | Action offered | Prompt |
|---|---|---|
| `unpaid` | Remove | none, removed outright |
| `paid` | Void | short reason, required |
| `voided` | neither | stays visible, struck through |

Every add, mark-paid, remove and void writes one `ActivityEvent` onto the
reservation timeline naming the staff member.

## Architecture

### `app/components/reservations/data/folio.ts` (framework-free)

The single home for the rules above. No reactive state, no store imports, so the
money maths are testable without mounting anything. Same split as `datev.ts` and
`promo-code-form.ts`.

- `folioLineNet(item)` / `folioLineTax(item)` / `folioLineService(item)` / `folioLineTotal(item)`
- `buildFolioSummary(reservation)` returns
  `{ bookingTotal, itemsTotal, voidedTotal, grandTotal, itemsPaid, itemsBalance, refundDue }`.
  `bookingTotal` folds the room lines, `charges` and the payment fee exactly as
  `ReservationRoomsSection.vue:460` computes them, so the folio cannot disagree
  with the Rooms accordion directly above it. A reservation with no `rooms`
  contributes its `totalPrice`, which already includes its fees
- **Paid and balance cover the extras only, and the labels say so.** Nothing on
  `ReservationEntry` records whether the booking itself was settled, so the
  folio does not claim to know. It shows `Booking total`, `Extras`, a combined
  `Total`, then `Extras paid` and `Extras balance`. Rule 3's arithmetic applies
  to the extras: `itemsBalance = itemsTotal - itemsPaid`, and a negative result
  renders as `Refund due`.
- `canDeleteFolioItem(item)` / `canVoidFolioItem(item)`
- `validateFolioItemDraft(draft)` returns errors keyed by field: blank label,
  quantity below 1, price at or below 0, percentages outside 0 to 100
- `folioItemFromCatalog(service, item, actor)` / `folioItemFromDraft(draft, actor)`,
  where the snapshot rule lives
- `folioActivityEvent(kind, item, actor)` returns an `ActivityEvent`

### `app/composables/useReservationFolio.ts`

The only writer. `addItem`, `markPaid`, `deleteItem`, `voidItem`, each a spread
patch through the existing `updateReservation(id, patch)` from
`useReservationsModule`, each appending its activity event **in the same patch**
so a posting and its audit line can never land apart. The actor comes from
`useCurrentDashboardUser`. Each action confirms with a toast.

It reads `useUpsellServices` and never writes to it. It never touches
`useUpsellOrders`: keeping a folio line out of the order lifecycle (approve, pay,
cancel, refund policy, smart-lock issue) is what makes a catalog pick cheap, and
it keeps one number for one charge instead of the same money living in two
places.

It also keeps `priceDetails.extras` and `priceDetails.guestPaid` in step when a
reservation carries a `priceDetails` block, so the existing Price accordion does
not contradict the folio underneath it. `totalPrice` is deliberately left alone:
it is the booked room-and-fees price and much of the app reads it, so the grand
total is derived, never stored.

### UI

**`ReservationFolioSection.vue`** is a new accordion section in
`ReservationDetailSheet.vue`, placed directly after Rooms so the money reads top
to bottom: rooms, fees, staff items, total. Booked lines render read-only. Each
staff item carries a status dot (amber unpaid, green paid, muted and struck
through voided) and a `⋮` menu offering Mark paid with Cash or Card, a separate
Charge to room entry that defers the line, then Void or Remove according to
state. The totals block shows grand
total, paid, and either balance or refund due.

Adding is blocked on `cancelled` and `blocked` reservations, with the button
disabled and the reason in its tooltip rather than a silent no-op.

**`FolioAddItemDialog.vue`** holds the two paths:

1. **Catalog.** A searchable list of items belonging to active upsell services
   offered at this property. `UpsellService.assignedListings` holds listing
   **names**, not ids (`upsell-services.ts:313`), so the match is against
   `reservation.listingName`, the same name-matching rule the upsell lock-access
   module already follows. A service with no items is not pickable. Rows show
   service name, item name and price.
2. **Custom item.** Label, quantity, unit price, tax percent, service percent,
   note.

A property with no assigned services opens straight on the custom form rather
than on an empty list.

**Currency never gets converted.** The seeded upsell services are priced in IDR
while several reservations are USD or EUR, so a catalog price and a folio are
often in different currencies. Inventing an exchange rate to bridge them would
put a fabricated number on a guest's bill, and hiding the item would leave staff
without their catalog. So a row whose `service.currency` differs from
`reservation.currency` stays listed, shows its price in its own currency, and
carries a `Priced in IDR` badge; picking it copies the label and both
percentages but leaves the unit price empty and focused, with the helper
`Enter the amount in USD`.

A service with `pricingEnabled: false` also leaves the amount blank, but it
transfers **no** percentages either: it has none to lend. `UpsellOrderCreator.vue:79`
bills zero tax and zero service for such a service, and Rule 2 above binds the
folio to that same arithmetic, so prefilling rates here would price a folio line
differently from the identical upsell order. Only the label and the provenance
ids carry over.

**`FolioVoidDialog.vue`** is the small reason prompt for voiding a paid item.

## Boundaries worth naming

### Finance does not pick this up, and cannot without a join that does not exist

`Finance -> Revenue -> Reservations` reads `recentReservations` from
`app/components/finance/data/revenue.ts`, a mock dataset with its own ids
(`lex-res-001`, `de-res-101`) and no relationship to `ReservationEntry`. Nothing
joins the two today, so a folio item cannot reach the revenue tables, the
accounting tags, or the DATEV batch without first inventing that link. That is a
separate design question, namely which dataset is the source of truth for
revenue, and it is out of scope here.

### Items are reservation-level

A multi-room booking gets one folio. Per-room folio splitting is what a hotel PMS
eventually needs and is deliberately absent.

### A posted item is not editable

While unpaid it is removed and re-added. Once paid it is voided. One rule per
state, no partial-edit path to keep consistent.

## Seed data

Two or three seeded reservations get `folioItems` so every state is visible on
load: an unpaid line, one paid in cash, and a voided paid line producing a
`Refund due` summary.

## Testing

**`tests/lib/reservation-folio.spec.ts`**

- line net, tax, service and total, including the parallel (not compounded) percentages
- minor-unit rounding on a 2-decimal currency
- the snapshot rule: mutating the catalog service afterwards leaves the posted line untouched
- a voided item contributes 0 whether it was paid or unpaid
- a voided paid item produces a refund due rather than a negative balance label
- `canDeleteFolioItem` / `canVoidFolioItem` per state
- a charge-to-room item stays unpaid, still counts in the balance, and remains removable
- `buildFolioSummary` agreeing with the detail sheet's booking lines, including the payment fee
- draft validation per field

**`tests/components/reservations/ReservationFolio.spec.ts`**

- the section renders unpaid, paid and voided states distinctly
- the add dialog's catalog path filters to services assigned to the listing
- the add dialog opens on the custom form when the property has no assigned services
- voiding requires a reason before the confirm enables
- a paid item offers Void and not Remove
- add is disabled on a cancelled reservation
- one posting writes exactly one activity entry

Harness notes from CLAUDE.md apply: Nuxt auto-imported children and the shadcn
primitives must be registered in `global.components`, or an unresolved `Input`
falls back to a bare element and every value assertion passes vacuously.
