# PRD 2: Stay Extension as a Linked Reservation

Part of a series. **PRD 1** (`prd-stay-extension-early-arrival.md`) adds **Arrive earlier** to the extension model that exists today. **This PRD (PRD 2)** changes the model so that every extension is its own linked Direct reservation and an OTA stay is never modified. PRD 1 ships first; this one builds on it, and Arrive earlier is carried over into the linked model as described in R2.1.

Target model: the one in the `elev8-dashboard` prototype. Each extension becomes its own **linked Direct reservation**, so a stay booked on Airbnb or Booking.com is never modified.

Status key: **Prototype** (built and reviewable in `elev8-dashboard`), **Today** (what the backend `elevate-villas/elevate` `development` and the v2 dashboard do now), **Change** (what must change or be added).

## 1. Why this change

Today an extension is a record on the same reservation (`reservation_extensions`), and applying it moves that reservation's `check_out_date`, `nights` and `total_amount`. For a stay booked on an OTA this mixes two sources in one row:
- The row keeps channel Airbnb, but its dates and total now include nights sold directly and paid through our own payment link.
- `total_amount` of an OTA booking is the OTA value (host payout after commission). The direct amount is added to it, while `total_guest_paid`, commission and payout stay OTA only. One column holds two meanings.
- Revenue by channel, owner statements and the calendar read the row as an Airbnb stay, so staff and reports take the extra nights for an extension made by the OTA.
- A later OTA modification can overwrite the dates and total (the guard exists only on the single-room path), and the extension rows then disagree with the reservation.

With a linked Direct reservation the OTA stay stays exactly as the channel knows it, and the extra nights have their own price, payment, status, channel and history.

## 2. Overview

Staff can add nights to a stay: **Stay longer** (after the check-out) or **Arrive earlier** (before the check-in). Confirming creates a **linked reservation** (`relation_type = extension`, `related_reservation_id` = the stay) on channel `DIRECT`, covering only the added nights. The original reservation is not changed. Everything the extra nights touch (cleaning, door codes, availability, guest message, inbox, activity log, calendar) follows automatically.

## 3. Goals and non-goals

### Goals
1. One guided flow from the guest's request to a paid, scheduled stay.
2. The original stay is never rewritten: OTA data stays OTA data.
3. Staff always see that a stay is extended and what each extension is (reservation list, Cockpit, inbox).
4. A guest message for every step, on the guest's own channel.
5. Operations stay correct without manual work.
6. Money is clean: each extension is billed on its own reservation, in the tenant currency, and reports attribute it to Direct.

### Non-goals
- No refunds. Cancelling a paid extension does not create, track or message a refund. Money handed back is handled outside the dashboard.
- No city tax handling for the added nights in this phase (R5.5).
- No guest self-service extension.
- No notice on the OTA side and no change to the OTA booking.

## 4. Roles

| Role | Can do |
|---|---|
| Guest Relations / Admin | Extend, confirm, decline, cancel, mark paid, message the guest |
| Housekeeping, Maintenance | Read only: see the resulting cleaning schedule and door-code window |
| Guest | Receives the payment link and messages, pays, sees the new dates in the Guest Guide |

A stay can be extended while its status is not checked out, cancelled, blocked or an owner request. Arrive earlier is also closed once the guest is checked in.

## 5. Definitions

- **Stay:** the reservation the guest booked (any channel). Never changed by an extension.
- **Extension:** one extension of a stay. It is recorded twice: a row in `reservation_extensions` on the stay (the history and index), and the **linked reservation** that holds the nights and the money (`linked_reservation_id`).
- **Linked reservation:** channel `DIRECT`, `relation_type = extension` (constant `ReservationRelationTypeExtension` already exists), `related_reservation_id` = the stay, dates = the added range only, its own guests, rooms, invoice lines, payment transactions, price and status.
- **Chain:** the second extension starts where the previous linked reservation ends. An early arrival chain is independent from the stay-longer chain.
- **Added range:** `[from, to)`, the nights being added.
- **Group:** a stay and its linked reservations. They are one guest stay and share one status.

## 6. Requirements

### 6.1 Reservation list and detail

**R1.1 Icon beside the guest name (Prototype, Change).** A `calendar-plus` icon beside the guest name when the stay has an active extension. Sky when all extensions are paid, amber while one is unpaid. Tooltip: nights added and payment state.

**R1.2 Extension rows under the stay (Prototype, Change).** One dashed row per active linked reservation directly under the stay: "Extension" or "Early arrival" plus the linked reservation id, added dates and nights, the stay's guests, channel Direct, the amount. Status column: the stay's own status once paid; while unpaid an "Inquiry" badge plus an amber "Payment pending" badge. A click opens the stay. Paging and sorting count stays, so a stay and its extensions are never split. When a filter hides the stay, the extension stands alone with an "Extension" badge that opens the stay.

**R1.3 Filter (Prototype, Change).** Extension filter: Any extension, Extended, Unpaid extension. A linked reservation matches through its stay.

**R1.4 Detail sheet (Prototype, Change).** An Extensions section on the stay lists every extension: direction, dates, nights, amount, payment method and status, linked reservation id, who created it and when. Actions: **Mark paid**, **Cancel extension** (outermost only, before its nights begin). On the linked reservation a banner "Extension of {channel} reservation {id}" with an Open link to the stay.

**R1.5 Shared status (Prototype, Change).** A stay and its linked reservations move status together (verified, checked in, checked out). A linked reservation is created with the stay's status. Exception: cancelling an extension cancels only that extension, and a cancelled extension is never revived. Guest registration and verification are done once, for the stay.

**R1.6 Money display on the stay (Change).** The stay shows the channel's own figures unchanged (OTA total, commission, payout). Next to them a read-only line "Extended directly: {nights} nights, {currency} {amount}, paid or pending", taken from the linked reservations. Nothing is added into the stay's `total_amount`.

**Acceptance**
- An Airbnb stay extended twice shows two child rows, its own total, commission and payout unchanged, and a separate "Extended directly" amount.
- Cancelling the stay cancels every linked reservation.

### 6.2 Extend flow: Stay longer and Arrive earlier

Entry points: reservation sheet, guest page, Extensions section, Cockpit, inbox reservation panel. A right-side sheet with three steps (Dates and price, Payment, Review) and a footer. Nothing is written until the final confirm.

**R2.1 Direction (Prototype, Change).** Behaviour is defined in PRD 1; under the linked model an early arrival creates a linked reservation that ends where the stay begins. Switch "Stay longer / Arrive earlier". Arrive earlier is offered only while the stay is not checked in and at least tonight is free before the check-in. New check-in runs from today to the night before the current check-in. The linked reservation ends where the stay (or the earliest early arrival) begins.

**R2.2 Date picker with availability (Prototype, Change).** The calendar greys out dates whose added nights clash with another reservation or block (same listing; same unit for room bookings). Quick buttons +1, +2, +3, +7 nights disable the same way. A destructive alert names the blocking stay if a clash appears anyway. The server repeats the check. The stay's own linked reservations never count as conflicts.

**R2.3 Guests for the extra nights (Prototype, Change).** Adults, Children, Infants steppers, prefilled from the stay. The linked reservation carries its own guest count (stay's plus added). The stay is untouched.

**R2.4 Rooms and price (Prototype, Change).** Priced for the added nights only:
- Room lines start from the stay's per-night lines; per room a rate plan select (the booked plan preselected) and an editable price, per night or per stay. Rooms can be added or removed.
- Taxes and fees: each marked **Included in price** (listed, never added to a total) or **Added on top**. Listing fees are not pre-filled (they were charged with the stay).
- Mid-stay cleaning: a switch adds a "Mid-stay cleaning" charge (default the stay's cleaning fee, editable) and a **Cleaning day** picker over the added nights.
- Payment charge (card fee): Card (+3 percent, default), Custom percent, No fee. Applies to a payment link only, as a percent of rooms plus charges.
- One summary: rooms total, each charge, payment charge, "Guest pays".
- Currency: the stay's own currency converted to the **tenant currency** at creation (`ConvertToTenantCurrency`); invoice lines keep their source currency. No conversion between currencies afterwards.

**R2.5 Payment (Prototype, Change).** Four methods:

| Method | Result |
|---|---|
| Send payment link | Payment transaction on the **linked reservation** and a link valid for 1, 3, 6, 12, 24, 48 or 72 hours (default 24). Pending |
| Charge saved card | Only when a card is saved on the stay. Charged, then paid |
| Collect at the property | Pending until marked paid |
| Already paid | Paid at once |

For a payment link, **Availability**: **Block availability** (default; the nights are held while unpaid) or **Do not block** (the nights stay open until marked paid, then the reservation holds).
- Payment runs first, so a failed charge leaves everything untouched; a failed save cancels the link.
- The stay's `guestPaid` and the money of the stay never move. Paid state lives on the linked reservation and its extension row.

**R2.6 Review (Prototype, Change).** Summary (dates, linked reservation, amount and method, guests) plus what else changes (cleaning moved or added, door codes), then the guest message (6.5).

**R2.7 Guest notification (Prototype, Change).** Email and or WhatsApp, multi-select, preselected from the guest's contact data; Email needs an email, WhatsApp a phone. Editable text, can be switched off.

**R2.8 Expiry of an unpaid link (Today, Change).** Today the scheduler and the provider "expired" webhook remove a pending extension and release held nights. Keep that, applied to the linked reservation (cancelled, not deleted, so history stays), and add a bell notification to staff with a re-send action. No message is sent to the guest.

**R2.9 Paid (Today, Change).** A paid link (Stripe, Xendit, Doku) marks the payment paid and the extension paid, then runs **the same completion as a confirmed extension** (one shared function): door code window, availability, cleaning, quota, HostBuddy, confirmation message, realtime event `extension-paid`. The guest-paid path must not be a lighter copy of the staff path.

**Acceptance**
- Extend an Airbnb stay by 2 nights with a payment link: the stay is unchanged, a Direct linked reservation for the 2 nights exists with its own pending payment, and the stay's total, channel and commission are untouched.
- Pay the link: the linked reservation becomes paid, the door code window moves, cleaning moves.
- Dates that clash with another stay cannot be picked.

### 6.3 Chain rules

**R3.1 Chain.** A new extension starts where the last linked reservation of its direction ends, pending or paid. The two directions are independent.
**R3.2 Order.** Only the **outermost** extension of a direction can be cancelled (latest check-out, earliest arrival), so a chain never has a gap, and only before its nights begin. A pending extension can be declined by the same rule.
**R3.3 One pending at a time is not required.** Several extensions may be pending in a chain; they confirm and pay independently. (Today's backend forbids a second pending extension and forces confirm order. This is dropped because each extension is its own reservation with its own payment.)

### 6.4 Cockpit

**R4.1 Real bars (Prototype, Change).** The linked reservation is drawn as its own bar on the stay's lane (a reservation like any other, channel Direct, status colour), directly after the stay or before it for an early arrival. Today the Cockpit draws a synthetic "Extended" segment from the extension row; replace it with the linked reservation's own bar.

**R4.2 Link icon (Prototype, Change).** Where a linked reservation meets the part of the stay it touches (the stay or the previous extension, so chains link too), a round link icon in the slanted gap on the stay's lane. Click opens the extension. Only when both bars are drawn on that row and the date is in view; a guest who merely arrives as another leaves never gets one.

**R4.3 Pending look (Change).** An unpaid extension reads as unconfirmed (Inquiry colour plus the amber payment-pending marker). A non-blocking one never reads as a hard block.

**R4.4 Conflicts (Change).** Creating a booking over nights held by a blocking pending extension warns like any double booking; a non-blocking one does not.

### 6.5 Guest messages and templates

Sent from the Elev8 number for WhatsApp, and by email for Email. Per guest language (fallback English), editable by the tenant, money as `${ISO currency} ${amount}`, full dates.

**Today.** The inquiry message is the booking payment-link message (`NotificationInquiry`) with the extension's amount, expiry and dates; the confirmation is the booking confirmation. The booking wording ("booking request", "automatically cancelled") reads wrong for an extension.

**Required templates (Change)**

| Id | When | Content |
|---|---|---|
| T1 | Extension, payment link | "Complete Your Extension": new check-out (or new check-in), added nights, total, link, validity, "Your original booking stays as it is. The extra nights are booked directly with us." |
| T2 | Extension paid or confirmed | "Your stay now runs from {{new_checkin}} to {{new_checkout}}", amount received, door code note |

Reference text for T1, built from the existing payment-link message:
```
Complete Your Extension

Hi {{guest_first_name}},
We can extend your stay at {{listing_name}}.

New check-out : {{new_checkout}}
Added nights : {{added_nights}}
Total : {{currency}} {{amount}}

To confirm the extra nights, please complete your payment below
{{payment_link}}

Please note: your extension will be released automatically if payment is not received within {{link_valid_for}}.
Your original booking stays exactly as it is. The extra nights are booked directly with us.
Your extension will be confirmed once payment is received.
The {{tenant_name}}
```
For Arrive earlier: "You can arrive earlier at {{listing_name}}. Your new check-in is {{new_checkin}} ({{added_nights}} more nights)."

Variables: `{{guest_first_name}}`, `{{listing_name}}`, `{{old_checkin}}`, `{{old_checkout}}`, `{{new_checkin}}`, `{{new_checkout}}`, `{{added_nights}}`, `{{total_nights}}`, `{{amount}}`, `{{payment_link}}`, `{{link_valid_for}}`, `{{door_code_note}}`, `{{tenant_name}}`.

No message is sent to the guest when an extension is cancelled, when the stay is cancelled, or when a payment link expires. WhatsApp: register T1 and T2 as utility templates with positional parameters; free text only inside the 24-hour window, otherwise template or email fallback.

### 6.6 Operations after an extension

**R5.1 Cleaning.**
- Stay longer: the open check-out cleaning on the old day moves to the new check-out (re-linked to the linked reservation for an OTA stay; dropped if that reservation already has one). Existing jobs are kept, not regenerated.
- Arrive earlier: the check-out cleaning stays; the linked reservation's own check-out job on the stay's check-in day is removed (the guest stays on).
- Mid-stay cleaning: one `mid_stay` cleaning on the chosen day, linked to the linked reservation (so cancelling the extension cancels it).
- Staff assigned to a cleaning (keyed by listing and date) are copied or moved with it, as today (`applyCleaningBranch` logic, applied to the linked reservation).
- Each extension with a cleaning fee creates its own mid-stay row.

**R5.2 Door codes.** The stay's codes are re-windowed to the end of the latest paid linked reservation (or start for early arrival), using the existing `UpdateReservationCode` and `ApplyExtensionAccessCodes`. Decision: **only once the extension is paid**, never for a pending one. Cancelling an extension re-windows back. Cancelling the stay revokes the codes.

**R5.3 Availability.** Channex availability is recomputed from the linked reservation's own dates (held while a blocking extension is unpaid, released when it is declined, expired or cancelled).

**R5.4 Quota, HostBuddy, invoicing.** A paid linked reservation consumes one booking-quota unit (decided), like any booking; cancelling it credits the unit back. HostBuddy context is refreshed, StayEasy invoices of the stay are flagged for review.

**R5.5 City tax (Change).** Not handled yet. Required: the linked reservation owes its own city tax computed from its nights and guests; a settled city tax on the stay shows a warning in the extend flow; city tax is never added to the extension payment link.

**R5.6 Damage protection.** An extension is not covered by the stay's protection for now.

**R5.7 Guest Guide (Change).** The guide shows the effective stay (earliest check-in to latest paid check-out of the group), the shifted door-code window, and for an unpaid extension a card "Complete your payment to confirm your extra nights" with the link and deadline, which disappears when paid, cancelled or expired. Guide steps for a reservation of relation type extension are skipped (`RelationType` extension), as today.

**R5.8 Inbox (Prototype, Change).**
- The guest message is written to the stay's conversation, tagged with its channel.
- The reservation panel shows the stay's extensions (dates, amount, payment state, Mark paid, copy link, cancel) and an **Extend stay** button.
- The thread shows a system line per step ("Stay extended by 2 nights, payment pending", "Extension paid", "Extension cancelled"), read only, at the time it happened.
- A conversation with an unpaid extension shows an amber marker in the list.
- The panel's Activity tab shows the same lines.

**R5.9 Activity log (Change).** On both the stay and the linked reservation: extension created, paid, cancelled, expired, edited; guest message sent (channels); mid-stay cleaning created; door codes moved; each with actor and time. The linked reservation also logs "Created as an extension of {stay}".

**R5.10 Finance, owner statements, analytics.** A stay and its linked reservations are counted per row or per guest depending on the report. Rule:

| Report or figure | Counted | Rule |
|---|---|---|
| Revenue by channel, listing and tenant | Per row | The linked reservation is channel Direct, counted on the date it was paid. A pending or cancelled one is never counted |
| Owner statements, commission, payout | Per row | A linked reservation is its own Direct line. The OTA stay keeps its OTA commission and payout unchanged |
| Occupancy and nights sold | Per row | Measured by the check-in to check-out span of each row; the nights do not overlap, so the total is the same |
| ADR and average rate per night | Per row | Each row keeps its own total and nights |
| Number of bookings and booking quota | Per row | Every paid linked reservation counts as one booking and one quota unit (R5.4) |
| Average length of stay | Per guest stay | A stay and its linked reservations are one stay: nights are summed |
| Guest count, repeat guests, ratings | Per guest stay | One visit is one visit, not two |
| Extension count | Per row | Shown as its own figure ("extensions"), never added to bookings a second time |

Rule of thumb: money, nights, bookings and quota follow the row; anything that describes a guest's visit groups a stay with its linked reservations through `related_reservation_id`.

### 6.7 OTA stays

**R7.1** An OTA webhook (booking modification or cancellation) updates **only the OTA reservation**, from the OTA payload. Linked reservations are never overwritten, which removes the multi-room and sold-as-whole gaps of the current guard.
**R7.2** If the OTA's new dates would overlap a linked reservation (for example the guest extended on the OTA while we hold nights directly), the OTA change is applied to the stay, the overlap is flagged `action_needed` on both reservations, and the Extensions section shows what clashed so staff decide (move or cancel the extension).
**R7.3** If the OTA cancels the stay, its linked reservations are cancelled with it (decided), the same as cancelling the stay from the dashboard (R6.1), and no message is sent to the guest.
**R7.4** `ota_checkout_date` and `isOTASynced` are no longer needed for extensions. The OTA reservation keeps its own check-out; the effective stay is derived from the group.

### 6.8 Cancel, decline, edit

**R6.1 Cancel the stay.** Cancels every linked reservation and extension row, their open payment links, every open cleaning of the group, and revokes active door codes. There is no "keep the extra nights" option.
**R6.2 Cancel one extension.** Outermost of its direction only, before its nights begin. The linked reservation is cancelled; its payment link is cancelled; cleanings for the removed nights are cancelled and the check-out cleaning returns to the previous day; door codes go back; availability is released; quota is credited. A paid extension can be cancelled; no refund is tracked.
**R6.3 Decline.** A pending extension is declined by the same rule as cancel (outermost), and is removed from history only if it was never paid.
**R6.4 Edit a pending extension.** Newest only; availability and expiry. A changed expiry re-sends the link.
**R6.5 Confirmation dialog.** Counts (links, cleanings, door codes) and no guest message.

## 7. Data model

- Stay (`reservations`): unchanged by an extension. `ota_checkout_date` is no longer written.
- Linked reservation (`reservations`): `channel = DIRECT`, `relation_type = 1` (extension), `related_reservation_id` = stay, dates = added range, own guests, rooms, `charges`, `total_amount`, `status` = the stay's status at creation (then shared), own `payment_transactions` and `reservation_invoices` (the existing `extension_id` columns point to the extension row).
- `reservation_extensions` (on the stay): keep `id`, `reservation_id`, `sequence`, `amount`, `currency`, `status`, `notes`, timestamps; **add** `linked_reservation_id`, `direction` (`after` | `before`), `previous_check_in_date`, `new_check_in_date`, `payment_method`, `payment_status`, `paid_at`, `source` (`dashboard`); keep the existing date columns for the later direction. Cancelled extensions keep their row.
- Existing rows (applied in place) stay as they are and show as "in place" in the list, as in the prototype; new extensions use linked reservations. No backfill is required.

## 8. API

| Method | Path | Purpose |
|---|---|---|
| POST | `/reservation/:id/extend` | Create the extension and its linked reservation |
| POST | `/reservation/:id/extend/:extensionId/pay` | Mark paid (non-link methods) |
| POST | `/reservation/:id/extend/:extensionId/cancel` | Cancel (outermost only) |
| PUT | `/reservation/:id/extend/:extensionId` | Edit availability and expiry of a pending extension |

Create body adds `direction`, `new_check_in_date` (early arrival), `payment.method` (`payment_link`, `saved_card`, `at_property`, `already_paid`), `payment.expires_in_hours`, `payment.is_block_availability`, `payment.fee_mode`, `rooms[]`, `charges[]`, `guests`, `mid_stay_cleaning_date`, `message` and `channels[]`. `confirm` and `decline` of today's API disappear (an unpaid extension is already a reservation; "confirm" is "mark paid").
Realtime: `extension-paid` with `tenant_id`, `reservation_id`, `extension_id`, `linked_reservation_id`.

## 9. Edge cases

1. Dates clash with another booking: refused by the server and not offered by the picker.
2. Webhook delivered twice: a paid extension is skipped; cleaning and message steps are idempotent.
3. Guest has no email and no phone: the extension completes, no message is sent.
4. Stay checked in while an early arrival is pending: refused at payment.
5. Currency differs from the tenant's: converted at creation.
6. A stay in a flat-rate room: the flat line is not charged again, the room still rides on the linked reservation so the Cockpit draws it on the room.
7. Daily cleaning rhythm: jobs for the added days are created for the linked reservation.
8. OTA cancels while an extension is paid: the extension is cancelled with the stay (R7.3).

## 10. Decisions and open points

Decided: door codes move only after payment; no damage protection for extensions; no self-service; card fee defaults to Card (+3 percent); WhatsApp from the Elev8 number; no OTA-side notice; no refunds; **linked reservation model**.
Also decided: a paid linked reservation consumes one booking-quota unit; when the OTA cancels the stay, its extensions are cancelled with it.
Counting rule per report for a stay and its extensions: decided (R5.10).

## 11. Migration from today's backend

| Today | Change |
|---|---|
| Extension row moves the stay's `check_out_date`, `nights`, `total_amount` | Extension row points to a linked Direct reservation; the stay is not changed |
| `ota_checkout_date` stamped, guard on the single-room OTA webhook only | Not needed; OTA webhooks touch only the OTA reservation; overlap with a linked reservation raises `action_needed` |
| One pending extension at a time, confirm oldest first, cancel cascades | Outermost-only cancel; no pending limit |
| Inquiry or Confirmed status choice | Payment method choice (link, saved card, at property, already paid) |
| Cockpit draws a synthetic "Extended" segment | Cockpit draws the linked reservation as a bar with a link icon |
| Paid webhooks do a reduced set of steps | Paid completes the same as a confirmed extension (R2.9) |
| `confirm` and `decline` endpoints | Replaced by pay and cancel |
| Invoice and payment tagged with `extension_id` on the stay | Tagged on the linked reservation (and keep `extension_id`) |
| Dashboard (`dashboard.go`) and tenant report (`report.go`) add the extension count on top of the reservation count (`totalBookings += totalExtensions`) | Stop adding it for new extensions: a linked reservation is already a reservation row. Keep adding it only for old in-place extensions, so nothing is counted twice or lost |
| Analytics booking count (`COUNT(*)` of reservations) ignores extensions, dashboard counts them | Both count a linked reservation as a booking; the two figures agree |
| Revenue (`SUM(total_amount)`) credits an extension to the OTA stay's channel | Credits it to Direct through the linked reservation, no query change needed |
| Occupancy uses `DATEDIFF(check_out, check_in)` | Unchanged; each row contributes its own span |
| Average length of stay, guest count and repeat guests read one row per visit | Group a stay with its linked reservations (`related_reservation_id`, relation type extension) before counting |
| Lexware split marks invoice lines with `extension_id` as extension | Lines now belong to the linked reservation; keep the flag so the split still works |

## 12. Release plan

- **Phase 1:** linked reservation model, create and cancel, payment methods, shared status, list icon and rows, detail sections, data model and API, paid completion, guard changes.
- **Phase 2:** Cockpit bar and link icon, calendar greying, inbox views, activity log, templates T1 and T2 and WhatsApp registration, finance and reports.
- **Phase 3:** Arrive earlier, Guest Guide contract, city tax, per-room rates, open points in section 10.

## 13. References

- Prototype (`elev8-dashboard`): `docs/claude/stay-extension.md`, `useStayExtension.ts`, `useReservationsModule.ts` (`extendViaLinkedBooking`), `ReservationExtendDialog.vue`, `ReservationRoomsSection.vue`, `ReservationExtensionsSection.vue`, `ReservationTable.vue`, Cockpit `extensionJoins`, inbox `ReservationPanel.vue`, `Thread.vue`, `ListItem.vue`, `ReservationActivity.vue`.
- Backend: `app/service/extend_reservation.go`, `app/model/reservation_extensions.go`, `app/model/reservations.go` (`related_reservation_id`, `relation_type`), `app/constants/constants.go` (`ReservationRelationTypeExtension`), `app/global/reservation_link.go`, `app/webhook/{stripe,xendit,doku,channex}`, `app/global/update_reservation_code.go`.
- v2 dashboard: `components/Reservation/ExtendStayDialog.vue`, `ExtensionsList.vue`, `components/ReservationSheet/ExtensionsPanel.vue`, `pages/cockpit.vue`, `stores/reservation.js`.
