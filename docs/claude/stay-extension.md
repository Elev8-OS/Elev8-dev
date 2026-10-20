> Read this file before working on this area; keep it updated when the code changes.

### Stay extension (`app/composables/useStayExtension.ts`)

Adds nights to a stay, after it (later check-out) or before it (early arrival,
`direction: 'before'`). Entry points: the detail sheet's **Modify → Extend reservation**
(also on the guest page), and **Extend stay** in the inbox reservation panel
(`inbox/ReservationPanel.vue`, matched to the Reservations module stay by id).

**Wizard** (`ReservationExtendDialog.vue`, a right-side Sheet laid out like New Reservation: header, steps bar, `ScrollArea` body, footer): Dates & price → Payment → Review. Nothing
is written until Confirm, which calls `useStayExtension().confirmExtension(plan)`.
The dates step has a **Stay longer / Arrive earlier** switch, shown only while early arrival
is possible: status not in `NON_EARLY_ARRIVAL_STATUSES` (checked in, checked out, cancelled)
and at least tonight still free before the check-in. The new check-in runs from today to the
night before the current one.

- ⚠️ **Every stay, Direct included, extends through a linked booking** (product decision: Direct
  used to be moved in place). The stay is never rewritten, so each added stretch has its own price,
  payment and status. `useStayExtension.preview` always returns `mode: 'linked_booking'`.
  `extendReservation` (in place) is still in `useReservationsModule` but nothing calls it; older
  records and the in-place table rows (`inPlaceRows`) are only kept for data written before this.
  The guest message and the dialog notice say "booking" instead of "Direct booking" for a Direct stay.
- **Linked direct booking.** The channel (or the original booking) keeps its dates and price.
  `extendViaLinkedBooking` creates
  a `Direct` reservation from `extensionStart(r)` to the new check-out, with
  `extensionOf: <ota id>`, per-night room lines only (a flat-rate line was paid on the OTA
  booking), and the parent's cleaning schedule. A second extension chains from the last
  linked booking; linked bookings never count as conflicts for their own stay.
  ⚠️ **Rooms carry over in full.** Per-night lines are copied; any room of the stay without a
  copied line (a flat-rate `per_stay` line, or a stay only assigned to a room) goes on the linked
  booking's `assignedUnitIds`, and `reservationUnitIds` returns lines and assignments together. Before
  this, an OTA stay in a flat-rate room got an extension with no room, which the Cockpit and the
  listing rooms timeline drew on "Not assigned to a room" instead of beside the stay.
- **Early arrival** works the same way: the linked `Direct`
  booking runs from the new check-in to `earlyArrivalEnd(r)` (the OTA check-in, or the earliest
  early-arrival booking). The two chains are independent: a stay can have both.
  `extensionRange(r, date, direction)` gives the added nights `[from, to)`; quote, conflicts
  and validation all take `direction`. A linked booking with `checkOut <= parent.checkIn` is an
  early arrival (labelled so in the table and the extensions section).
- **`StayExtension.direction`**: `after` (or missing, older records) uses `previousCheckOut` /
  `newCheckOut`; `before` uses `previousCheckIn` / `newCheckIn`. ⚠️ The check-out fields are
  optional now, so read them by direction.
- **`StayExtension` records live on the stay the guest booked** (`ReservationEntry.extensions`),
  even when the nights sit on a linked booking (`linkedReservationId`).

**Availability while picking:** the calendar greys out (`is-date-unavailable`) every date whose added nights collide with another stay (`getExtensionConflicts`), and the quick +N buttons disable the same way. The destructive alert still shows the blocking stay if a conflict appears anyway.

**Rooms & price** (dates step) is the New Reservation section (`ReservationRoomsSection.vue`), not custom UI: room lines with a rate plan select (`changeRoomRate`, also in New Reservation) and editable price, Taxes & fees (charges: cleaning, city tax, service, other; each marked **Included in price** or **Added on top**, `ReservationCharge.inclusive`: an inclusive one is listed but never added to any total, see `billableChargesTotal` and the folio), and the Payment charge (Card 3% / Custom % / No fee) right under Taxes & fees, with its own row and the total including the fee (`payment-charge` prop, on by default). It prices the **added nights** (`check-in`/`check-out` = the added range, `nights` = extra nights, `exclude-reservation-id` = the stay) and starts from the stay's own per-night room lines, or one "Entire property" line at the stay's average rate when the stay has no rooms. ⚠️ Two props exist for this use: `auto-import-fees="false"` (no listing fees are pre-filled: they were charged with the stay) and `fee-base="all"` (the payment charge is a percent of rooms plus charges, matching the payment request). The result is `plan.pricing` (`ExtensionPricing`: `rooms`, `asRooms`, `bookingMode`, `charges`); `quoteExtension` prices from its lines (per-night lines grow with the nights, flat ones are charged as typed), charges are added on top. On the linked booking they are stored as `rooms` + `charges` (folio total = rooms + charges) and mirrored in `priceDetails` (`cleaning` to `cleaningFee`, `service`/`other` to `serviceFee`, `city_tax` to `tax`). A stay with no rooms keeps a roomless linked booking. The payment charge is not stored on the booking: it is the payment link's `feeMode` (`manual` carries `customFeePercentage`). The **mid-stay cleaning** switch above it just adds or removes a `cleaning` charge (id `chg-midstay-cleaning`, "Mid-stay cleaning", default the stay's cleaning fee), so it also shows in Taxes & fees and can be removed there. With the switch on, a day picker (one of the added nights) appears and confirming also creates a `mid_stay` cleaning job at 11:00 (`plan.midstayCleaning`), linked to the linked booking (so cancelling that extension cancels it); `createJob` returns null, and no job is made, when the listing has no cleaning steps. A cleaning charge added by hand in Taxes & fees creates no job.

**Extra guests** (dates step): adults/children/infants steppers add people for the added nights only. The linked booking gets the stay's counts plus the extras (`extraGuests` on the plan and `ExtensionInput`); the stay itself is untouched and the price does not change per guest.

**Payment** (`ExtensionPaymentMethod`):
- `payment_link`: a payment request (`usePaymentRequests.createRequest`), valid 1/3/6/12/24/48/72h (`LINK_EXPIRY_OPTIONS`, default 24). **Availability**: Block (default) or Do not block; the latter creates the linked booking with `blocksAvailability: false`, which `holdsDates()` honours for inquiries and linked bookings (ignored by conflict checks until `markExtensionPaid` flips it back to true). Card fee comes from the Payment charge in Rooms & price.
  `[payment link]` in the guest message becomes the link. Pending.
- `saved_card`: only when `damageProtection.card` exists; mock charge (`SAVED_CARD_CHARGE_MS`). Paid.
- `at_property`: pending. `already_paid`: paid.
- ⚠️ **`guestPaid` follows the money.** It moves only when paid; a pending extension waits for
  `markExtensionPaid` (the "Mark paid" button in `ReservationExtensionsSection.vue`), which moves
  `guestPaid` on the billed stay (the linked booking for OTA) and marks the payment request paid.
- Payment runs first, so a failed charge leaves the stay untouched; a failed save cancels the link.

**What follows the new check-out:**
- Cleaning: `useCleaningJobs.moveCheckoutCleanings` moves open `source: 'checkout'` jobs on the old
  day (re-linked to the linked booking for OTA; dropped if that booking already has one). In place,
  a daily/custom schedule gets jobs for the added nights; existing jobs are kept, not regenerated.
- Door codes: `useSmartLock.extendCodesForReservation` shifts active, dated codes that end on the
  old check-out day (Bali time). Ongoing codes are left alone. Early arrival:
  `advanceCodesForReservation` moves codes that start on the old check-in day. ⚠️ **Only once the extension is paid**: at confirm for a saved-card or already-paid extension, otherwise in `useStayExtension.markExtensionPaid`. A pending extension leaves the codes alone (the review step and the guest message say so), and cancelling an unpaid one has nothing to restore.
- Early arrival cleaning: the check-out cleaning stays put. In place, a daily/custom schedule gets
  jobs for the earlier days. For OTA, `useCleaningJobs.dropArrivalOverlap` removes the linked
  booking's own check-out job on the OTA check-in day (the guest stays on) and any job of it the
  stay already has that day.
- City tax: not handled for the added nights yet (the review step shows nothing about it; `preview().cityTax` is computed but unused by the UI). See the PRD, R5.5.
- Damage protection: an extension is not covered; `reassessOnExtension` only runs for older in-place records.
- Guest message channels (review step): Email and/or WhatsApp, multi-select (no thread/Inbox chip; default Email, else WhatsApp; the composable still accepts `'thread'`); Email needs a guest email, WhatsApp a phone. All go into the stay's conversation tagged with that channel, and channels that resolve to the same one (thread of an email stay + Email) are sent once (`GuestMessageChannel`). Mock delivery only.
- Guest message: `ensureConversationForReservation` + `sendMessage` via ⚠️ dynamic `import()` of
  `useInbox` (cycle rule). Editable in the review step; blank sends nothing.

**Inbox** (`inbox/ReservationPanel.vue`, `Thread.vue`, `ListItem.vue`): the reservation panel shows `ReservationExtensionsSection` above its tabs (same component as the detail sheet: payment status, Mark paid, copy link, cancel) when the matched stay has extensions. The thread gets centered system lines for each step (`InboxThreadExtensionEvent`: created, paid, cancelled), **derived** from `stay.extensions` by `extensionEvents()` in `reservations/data/extension-events.ts` (never stored as messages, so they cannot go stale; the "paid at creation" case shows no separate paid line). The reservation panel's **Activity** tab (`InboxReservationActivity`) shows the same lines in its timeline (it reads the stay from the Reservations module, since the inbox keeps its own display copy of the reservation). A conversation list item shows an amber `calendar-plus` icon with a tooltip while an active extension is unpaid (`unpaidExtensions()`). Tests: `tests/lib/extension-events.spec.ts`.

**Reservation list** (`ReservationTable.vue`): an extended stay gets a `lucide:calendar-plus`
icon beside the guest's name (sky, amber while a payment is pending; details on hover). A linked booking is
drawn as a child row under its stay (dashed border, "Extension" + id); paging and sorting
count stays, so the pair is never split. ⚠️ A direct stay extended in place gets child rows too (the user asked for it): one dashed row per active extension without a `linkedReservationId` (`inPlaceRows`), built from the `StayExtension` record: "Extension" or "Early arrival", "Added to this booking", the added nights' dates and count, the stay's guests and channel, the extension `amount`, and in the Status column the stay's own status badge once paid (not "Paid": the user found that out of place), or an "Inquiry" badge plus an amber "Payment pending" badge while the extension is unpaid (the added nights are not confirmed, so the stay's Checked in does not apply) (no city tax, protection or menu). A linked booking row shows "Inquiry" too while its extension is unpaid (`rowStatus`), the stay's status once paid. Children, linked and in place, sort by date; a click opens the stay. When a filter hides the parent, the child stands
alone with an `Extension` badge that opens the parent.

**Extension filter** (Reservations page, `ReservationFilters.extension`): Any extension /
Extended / Unpaid extension. A linked booking matches through the extension on its parent that
created it, so the pair stays listed and nested together.

**Status is shared** (`statusGroupIds` in `useReservationsModule`): a stay and its linked
extension bookings are one guest stay. A linked booking is created with the stay's status, and
`updateReservationStatus` on either moves the whole group (the mirrored ones log "Set to X with
<id>"). Exceptions: cancelling an extension cancels only that extension, and a cancelled
extension is never revived. Guest registration is synced once, for the root stay.

**Cancelling** (`useStayExtension().cancelStay` / `cancelExtension`, confirmed in
`ReservationCancelExtensionDialog.vue`):
- **The stay** cancels everything: every linked booking, every extension record
  (`cancelledAt`), their open payment links, every open cleaning on the stay and its linked
  bookings, and the stay's active door codes (revoked). There is no "keep the extra nights" option
  (product decision). ⚠️ **Every** cancel from the detail sheet's status dropdown opens the dialog
  and runs through `cancelStay`, extensions or not; `previewCancelStay` feeds the dialog's counts.
- **One extension** ("Cancel extension" / "Cancel early arrival" in `ReservationExtensionsSection.vue`,
  or cancelling a linked booking): `canCancelExtension` allows only the outermost of its direction
  (latest check-out, earliest arrival, so a chain never has a gap) and only before its nights begin.
  In place, dates, nights, price, room lines and a shifted `cleaningSchedule.startDate` go back; for
  OTA the linked booking is cancelled. Door codes and the check-out cleaning return to the original
  day, cleanings for the removed nights are cancelled, a pending payment link is cancelled.
- No refunds: cancelling a paid extension tracks nothing (no `refundStatus`, no "Mark refunded", no refund line in the message). Money handed back is handled outside the dashboard.
- A cancelled extension counts nowhere: table icon, Extended / Unpaid filters, `markExtensionPaid`
  (refused). Use `isActiveExtension(e)` when reading `extensions`.
- `updateReservationStatus(..., 'cancelled')` also marks the matching records cancelled, so a cancel
  that skips `useStayExtension` never leaves an "active" record; it does not do the clean-up.
- **Guest message**: the dialog starts from `defaultCancelMessage(stayId, extensionId?)` (dates,
  "your Airbnb booking stays as it is", and "the payment link is no longer needed" when it was unpaid); editable,
  switch off to send nothing. Sent like the extend message (dynamic `useInbox` import).
- `cancelStay` / `cancelExtension` are async (the message).

**Analytics** reads generated bookings, not this store: extensions there are generated the same
two ways (see `docs/claude/analytics.md`, Stay extensions). Owner statements do read this store:
a linked booking is its own Direct line, and gross follows `guestPaid` (cash basis), so an unpaid
extension reaches the owner only once marked paid.

**Demo seed** (`reservations/data/stay-extension-demo.ts`, dates relative to today, guest profiles
included): a Direct stay with a paid linked booking across the month end (29th to the 3rd), a Direct
in-house stay with an unpaid linked booking (`res-ext-direct-pending`, Wayan Prasetyo), an Airbnb stay with a paid linked booking, a Booking.com
stay extended twice (chained, second unpaid), and an upcoming Airbnb stay with an unpaid early
arrival (`res-ext-early`, linked `res-ext-early-x1`, lst-11). Single-unit listings lst-8, lst-11, lst-13, clear of
other stays. ⚠️ Keep it shaped like what `extendViaLinkedBooking` writes:
`tests/components/reservations/stay-extension-demo.spec.ts` checks the links, money and filters.

**Not implemented:** no real OTA alteration request; no auto "paid" when a payment link is paid
(staff click Mark paid); off-platform links in Airbnb threads may be blocked by Airbnb (the
payment step says so).

**Tests:** `tests/composables/useStayExtension.spec.ts` (incl. early arrival, cancelling), `tests/composables/useReservationsModule-modify.spec.ts`,
`tests/components/reservations/ReservationModifyDialogs.spec.ts`.
