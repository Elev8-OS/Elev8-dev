> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Reservation Folio Items (`app/components/reservations/data/folio.ts` + `app/composables/useReservationFolio.ts`)

Staff-posted charges on a stay: a minibar beer, a laundry bag, a spa slot booked
at the desk. `ReservationEntry.folioItems?: FolioItem[]`, optional so no seeded
reservation migrates.

- **`data/folio.ts`** is framework-free: line arithmetic, `buildFolioSummary`,
  the state rules, draft validation, the item factories, catalog rows and the
  activity-event builder. The composable owns the reactive state and calls in.
- **A catalog pick is a snapshot.** Label, price and both percentages are copied
  from the `UpsellService` / `UpsellItem` at posting time. `catalogServiceId` is
  provenance, never a live join, so a later price change cannot rewrite a
  guest's bill.
- **Tax and service each apply to the line net, in parallel, never compounded**,
  the same structure as `UpsellOrderCreator.vue:79`. The rounding deliberately
  differs, though: the folio rounds to the currency's minor unit (a CHF 6.00
  beer at 10 percent owes 0.60), while the upsell order rounds tax and service
  to whole units. A folio line is a desk charge, priced to the cent it can
  actually be paid in; an upsell order is priced in round numbers upfront.
- **`paidAt` survives a void on purpose.** A voided item drops out of
  `itemsTotal` but stays in `itemsPaid`, which is exactly what turns a voided
  paid line into `refundDue`. Do not filter `itemsPaid` on `status`.
- **`paymentMethod: 'room'` keeps the item `unpaid`.** Charge to room defers the
  charge, so it still counts in the balance. Treating it as paid would read the
  balance as zero for money nobody collected.
- **Paid and balance cover the extras only**, and the labels say so: nothing on
  `ReservationEntry` records whether the booking itself was settled.
- ⚠️ **`UpsellService.assignedListings` holds listing NAMES, not ids**
  (`upsell-services.ts:313`), so `folioCatalogRows` matches
  `reservation.listingName`.
- ⚠️ **No currency conversion, ever.** A catalog row priced in another currency
  keeps its own price, carries a `Priced in IDR` badge, and transfers its
  percentages but not its amount. A row from a service with `pricingEnabled:
  false` transfers **no** percentages either (`folio.ts:210-211`, settled by
  commit `c530f2b`): the two cases look similar but are distinct, so do not
  collapse them into one rule. An invented exchange rate on a guest's bill is
  worse than asking staff to type the number.
- ⚠️ **The folio owns `priceDetails.extras`.** `commit()` replaces the field
  outright rather than adding to it, so anything else that also writes
  `extras` gets silently overwritten. A reservation's `upsellIds` are a
  separate total and never merged in. `commit()` also moves `guestPaid` and
  `payout` by the same delta as `extras`, in lockstep, and leaves `commission`
  untouched, since a desk-posted extra carries no OTA commission.
- ⚠️ **`useReservationFolio` never writes to `useUpsellOrders`**, and each action
  patches the items array and its `ActivityEvent` in **one**
  `updateReservation` call so a posting and its audit line cannot land apart.
- `totalPrice` is deliberately never written. It is the booked room-and-fees
  price that much of the app reads; the grand total is derived.
  `priceDetails.extras`, `guestPaid` and `payout` are kept in step where a
  reservation has a `priceDetails` block (see the ⚠️ above); `commission` never
  moves.
- **The totals block shows two gross figures, never a sign-branch on the net.**
  `FolioSummary.unpaidTotal` (the live unpaid lines) and
  `FolioSummary.refundableTotal` (the voided lines that had been paid) are each
  computed straight off their own lines, independently of one another and of
  `itemsBalance`. `ReservationFolioSection.vue` renders "Extras still due" and
  "Refund due" each whenever its own figure is non-zero, both at once if both
  apply, plus a net line beneath restating `itemsBalance` / `refundDue` so the
  arithmetic still reconciles; the block reads "Extras settled" when both gross
  figures are zero. Do not go back to branching on `refundDue > 0` to decide
  whether "Extras still due" renders: that was the original bug, since
  `refundableTotal` (not `refundDue`) can be non-zero while the net is
  positive, and the old branch only ever showed the still-due row inside the
  refund branch. Post a 50.00 unpaid item and void a previously-paid 20.00
  item and the net (`itemsBalance`) is 30, `refundDue` is 0, but
  `refundableTotal` is still 20: the desk collects 50 and refunds 20, not
  "balance 30".
- ⚠️ **`folioActivityEvent`'s `id` uses the normalised `effectiveKind`, not the
  raw `kind` argument.** A caller passing `kind: 'paid'` on a charge-to-room
  item gets the `deferred` title, description and colour, so its id must say
  `deferred` too, or the two disagree on what happened.

**Components:** `ReservationFolioSection.vue` (accordion in
`ReservationDetailSheet.vue`, after Rooms), `FolioAddItemDialog.vue` (catalog
list plus custom form), `FolioVoidDialog.vue` (required reason). The section
clears its `voidTargetId` whenever the void dialog closes, confirmed or
cancelled, so a stale target cannot outlive the dialog that set it.

**NOT implemented (intentionally out of scope):** no Finance or accounting flow
(the revenue tables read `finance/data/revenue.ts`, a separate mock dataset with
no join to `ReservationEntry`); no invoice document or PDF; no per-room folio on
a multi-room booking; no editing a posted item (remove while unpaid, void once
paid).

**Tests:** `tests/lib/reservation-folio.spec.ts` (54),
`tests/composables/useReservationFolio.spec.ts` (17),
`tests/components/reservations/ReservationFolio.spec.ts` (28).
