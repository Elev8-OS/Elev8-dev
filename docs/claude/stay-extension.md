> Read this file before working on this area; keep it updated when the code changes.

### Stay extension (`app/composables/useStayExtension.ts`)

Adds nights to a stay. Entry points: the detail sheet's **Modify → Extend reservation**
(also on the guest page), and **Extend stay** in the inbox reservation panel
(`inbox/ReservationPanel.vue`, matched to the Reservations module stay by id).

**Wizard** (`ReservationExtendDialog.vue`): Dates & price → Payment → Review. Nothing
is written until Confirm, which calls `useStayExtension().confirmExtension(plan)`.

- **Direct stay: in place.** `useReservationsModule().extendReservation` moves
  `checkOut`, `nights`, `totalPrice`, per-night room lines, `subtotal` and `payout`.
- **OTA stay (Airbnb, Booking.com): linked direct booking.** The channel owns the
  booking's dates and price, so it is never rewritten. `extendViaLinkedBooking` creates
  a `Direct` reservation from `extensionStart(r)` to the new check-out, with
  `extensionOf: <ota id>`, per-night room lines only (a flat-rate line was paid on the OTA
  booking), and the parent's cleaning schedule. A second extension chains from the last
  linked booking; linked bookings never count as conflicts for their own stay.
- **`StayExtension` records live on the stay the guest booked** (`ReservationEntry.extensions`),
  even when the nights sit on a linked booking (`linkedReservationId`).

**Payment** (`ExtensionPaymentMethod`):
- `payment_link`: a payment request (`usePaymentRequests.createRequest`, 24h, card fee or none).
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
  old check-out day (Bali time). Ongoing codes are left alone.
- City tax: derived, so an unsettled stay recalculates itself. The review step warns when it was
  already settled (the added nights are not included). A linked booking owes its own city tax.
- Damage protection: `reassessOnExtension` (in place only).
- Guest message: `ensureConversationForReservation` + `sendMessage` via ⚠️ dynamic `import()` of
  `useInbox` (cycle rule). Editable in the review step; blank sends nothing.

**Reservation list** (`ReservationTable.vue`): an extended stay gets a `lucide:calendar-plus`
icon beside the guest's name (sky, amber while a payment is pending; details on hover). A linked booking is
drawn as a child row under its stay (dashed border, "Extension" + id); paging and sorting
count stays, so the pair is never split. When a filter hides the parent, the child stands
alone with an `Extension` badge that opens the parent.

**Extension filter** (Reservations page, `ReservationFilters.extension`): Any extension /
Extended / Unpaid extension. A linked booking matches through the extension on its parent that
created it, so the pair stays listed and nested together.

**Status is shared** (`statusGroupIds` in `useReservationsModule`): a stay and its linked
extension bookings are one guest stay. A linked booking is created with the stay's status, and
`updateReservationStatus` on either moves the whole group (the mirrored ones log "Set to X with
<id>"). Exceptions: cancelling an extension cancels only that extension, and a cancelled
extension is never revived. Guest registration is synced once, for the root stay.

**Analytics** reads generated bookings, not this store: extensions there are generated the same
two ways (see `docs/claude/analytics.md`, Stay extensions). Owner statements do read this store:
a linked booking is its own Direct line, and gross follows `guestPaid` (cash basis), so an unpaid
extension reaches the owner only once marked paid.

**Demo seed** (`reservations/data/stay-extension-demo.ts`, dates relative to today, guest profiles
included): a Direct stay extended in place across the month end (29th to the 3rd, paid), a Direct
in-house stay with an unpaid extension, an Airbnb stay with a paid linked booking, and a Booking.com
stay extended twice (chained, second unpaid). Single-unit listings lst-8, lst-11, lst-13, clear of
other stays. ⚠️ Keep it shaped like what `extendReservation` / `extendViaLinkedBooking` write:
`tests/components/reservations/stay-extension-demo.spec.ts` checks the links, money and filters.

**Not implemented:** no real OTA alteration request; no auto "paid" when a payment link is paid
(staff click Mark paid); off-platform links in Airbnb threads may be blocked by Airbnb (the
payment step says so).

**Tests:** `tests/composables/useStayExtension.spec.ts`, `tests/composables/useReservationsModule-modify.spec.ts`,
`tests/components/reservations/ReservationModifyDialogs.spec.ts`.
