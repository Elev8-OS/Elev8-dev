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
- **Extending a stay** (`useReservationsModule().extendReservation`, from the
  detail sheet's Modify menu) is the one other writer of `priceDetails`: it
  moves `subtotal` and `payout` by the added nights' amount and raises
  `totalPrice`, but never touches `extras`. `guestPaid` moves only once the
  nights are paid (now, or later via `markExtensionPaid`). Room-line stays grow
  only their per-night lines, so the Edit dialog's rebuilt total agrees. An OTA
  stay is never moved: its nights become a linked direct booking. Full flow:
  `docs/claude/stay-extension.md`.
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

### Invoice PDF for a multi-room booking (`app/lib/folio-invoice-pdf.ts`)

`buildInvoiceRoomRows(reservation)` (pure) returns the rows that replace the single "Accommodation" row when the stay has `rooms[]`: one per room line (unit, nights, rate plan, guest names), then each non-inclusive charge, then the payment fee (`folioPaymentFee`). They add up to `buildFolioSummary().bookingTotal`. One invoice for the whole group, one total paid, never one per room (recommendation in PRD PP-594). Without room lines it returns `[]` and the single row stays.
- The Tax / Svc column shows `—` on these rows; tax and service still print as the "Includes" totals. No per-room tax split, so no rounding drift.
- ⚠️ Reads one `ReservationEntry`. If the backend later delivers N linked rows for a website group, the builder must be fed the merged group, not a single row, or each invoice shows only its share.
- Not done: reissue after a partial cancellation (earlier invoice kept as a corrected document), one invoice number for a group.
- Tests: `tests/lib/folio-invoice-pdf.spec.ts` (multi-room block).

### Website booking source (`app/components/reservations/data/website-booking.ts`)

`ReservationEntry.websiteBooking?` (also on `ReservationDraft`) records which website a Direct booking came from and which Website channel rule set priced it: `{ websiteId, websiteName, websiteUrl, ruleSetId, ruleSetName, discounts: { label, amount }[] }`.
- **Snapshot, not a live join.** Written once on create; renaming the site or editing or deleting the rule set never changes it. Ids are provenance only. `ruleSetName: null` shows "No rule set".
- **Display only.** It never writes `priceDetails`, the folio or the total. Discount amounts are in the reservation currency; `buildWebsiteBookingSource()` (pure) drops a quote in another currency rather than converting.
- `NewReservationDialog` (always Direct) has an optional "Booked on website" select (None + sites selling the picked listing; a site with no coverage recorded is listed). On create: the rule set is `ruleSetForWebsite(websiteChannel.value, id)` only while the channel is added, and the discounts come from `useWebsiteQuote().quoteStay(...)` for that rule set (booked today).
- Shown in `ReservationDetailSheet` under the channel (site name and url, rule set or "No rule set", frozen discounts) and as subtext under "Direct" in the `ReservationTable` channel cell.
- Seeds: `SEEDED_WEBSITE_BOOKINGS` in `data/reservations.ts` (res-multi-1, res-dp-awaiting, res-dp-charge-failed), literal values on Direct stays whose listing the site sells.

**Tests:** `tests/lib/website-booking-source.spec.ts`, `tests/components/reservations/ReservationTableWebsiteBooking.spec.ts`.

## Payment method, Mark as paid, New Reservation form

**Payment method** (`ReservationPaymentMethod`: `payment_link`, `bank_transfer`, `cash`; stored on `ReservationEntry.paymentMethod`):
- `NewReservationDialog` Status and Source: an **inquiry** picks link (default), bank or cash. A **Confirmed** booking (stored `unverified`, paid in full at creation, `paidAt` set) records bank or cash only. The select follows the status (`paymentMethodOptions`), and switching status resets the default.
- Only a payment link sends a link. Bank/cash send nothing. A Confirmed booking sends a **booking confirmation** (WhatsApp/Email, no Guest Inbox box) with `confirmationOnly`: no payment request, no card, text "fully confirmed and paid". Labels follow (`sendActionLabel`).
- ⚠️ The dialog always passes `purpose: 'booking'` (Edit does for an inquiry). Left unset, `useBookingConfirmationFlow` guesses city tax from the assessment and sends a city tax link (10% of the total) with a "Booking Confirmed!" text.
- Expiry (hours) shows only for inquiry + link and must be at least 1 hour. A link inquiry also needs a price above 0 (`price` error, opens Rooms & Price).
- Validation and the focus order live in `data/new-reservation-validation.ts` (`validateNewReservation`, `NEW_RESERVATION_FIELD_ORDER`, spec `tests/lib/new-reservation-validation.spec.ts`). `focusFirstError` opens the section and focuses the `data-field` wrapper.
- Closing the dialog (Cancel, X, after a save) calls `reset()`; the prefill from the Cockpit is applied on the next open.

**`markReservationPaid(id, method, { amount?, paidOn?, linkCancelled? })`** (`useReservationsModule`, the only writer of `paidAt`):
- Default amount is the balance (`folioBookingTotal` minus `guestPaid`). A smaller one is a **part payment**: `guestPaid` moves, activity "Partial payment", status and `paidAt` untouched. Paying the balance sets `paidAt` (the `paidOn` day, else now), moves an `inquiry` to `unverified` (paid, identity not verified; never `verified`) via `updateReservationStatus`, and fills `commission`/`payout` if missing.
- False for an already paid stay, an amount of 0 or over the balance, or a future `paidOn`.

**Detail sheet** (price accordion): Balance due, Amount (currency prefix), Received on (`base/DatePicker`, max today), method, button "Mark as paid" or "Record part payment". Methods are `manualPaymentMethods` only (bank, cash): staff cannot claim a payment link, whose invoice only a guest payment produces. State resets per stay. Not shown for blocked, owner request, cancelled, paid stays.
- A `pending` link on the stay (`paymentRequestId`) is cancelled when the **balance is paid in full** (`cancelRequest`, in the sheet to avoid a composable cycle); a part payment leaves it open. Warning and activity note say so.
- A link the guest **already paid** settles the stay on open (`markReservationPaid(id, 'payment_link')`, not for blocked/owner request/cancelled).

**Guest pays the link** (mock): `usePaymentRequests().markRequestPaid(id)` marks the request paid and settles the stay it belongs to; the request dialog's "Simulate guest payment" (payment requests page and guest page) calls it.

Tests: `tests/composables/useReservationsModule-mark-paid.spec.ts`, `tests/composables/usePaymentRequests-mark-paid.spec.ts`, `tests/composables/useBookingConfirmationFlow.spec.ts`, `tests/lib/new-reservation-validation.spec.ts`, `tests/components/reservations/NewReservationPaymentFlow.spec.ts` (source-reading, the dialog and sheet are too heavy to mount).
