# PRD: Stay Extension (Extend Reservation)

Status key used below: **Built** (already in the dashboard), **Gap** (agreed requirement, not built yet), **Mobile/Guide** (lives outside this repo, dashboard only defines the contract).

## 1. Overview

Staff can add nights to an existing stay, after the check-out (**Stay longer**) or before the check-in (**Arrive earlier**). The added nights never rewrite the original reservation. They become a **linked direct booking** with its own price, payment and status, so an Airbnb or Booking.com reservation stays exactly as the channel knows it, and a Direct stay keeps a clean audit trail.

Everything the extra nights touch (cleaning, door codes, guest message, inbox, activity log, calendar) follows automatically, so staff do not have to chase five screens after taking a request from a guest.

## 2. Goals and non-goals

### Goals
1. One guided flow (dates, price, payment, review) that takes an extension request from the guest to a paid, scheduled stay.
2. Staff always see that a stay is extended and what the extension is (list, detail, Cockpit, inbox).
3. A guest-facing message for every step (payment link, paid, cancelled), on the guest's own channel, with templates staff can trust.
4. Operations stay correct without manual work: housekeeping, smart lock, guest guide, inbox.
5. Money stays honest: no currency conversion, nothing marked paid until money arrives.

### Non-goals
- No refunds. Cancelling a paid extension does not create, track or message a refund: there is no refund status, no Mark refunded action and no refund line in any message. Money handed back is handled outside the dashboard.
- No city tax handling for the added nights in this phase (see R5.5).
- No real OTA alteration request (the channel booking is never modified).
- No price quote from the channel's rules (length-of-stay discounts, restrictions). The price comes from the listing's own rate plans or a typed price.
- No guest self-service extension in this phase (see Decisions).

## 3. Users and permissions

| Role | Can do |
|---|---|
| Guest Relations (primary, e.g. Komang Juliantara) | Extend, cancel an extension, mark paid, message the guest |
| Admin / owner | Everything above |
| Housekeeping, Maintenance | Read only: see the resulting cleaning jobs and door-code changes |
| Guest | Receives messages and pays the link. Sees the new dates in the Guest Guide |

Extension is available while the stay status is not checked out, cancelled, blocked or an owner request (`NON_EXTENDABLE_STATUSES`). Arrive earlier is additionally closed once the guest is checked in.

## 4. Definitions

- **Stay**: the reservation the guest originally booked (`ReservationEntry`).
- **Extension**: a `StayExtension` record, always stored on the stay the guest booked.
- **Linked booking**: the `Direct` reservation that holds the added nights (`extensionOf` = the stay id). It is the billed object.
- **Chain**: a second extension starts where the last linked booking ends. An early arrival chain is independent from the stay-longer chain.
- **Added range**: `[from, to)`, the nights being added.

## 5. Requirements

### 5.1 Reservation list and detail: show that a stay is extended

**R1.1 Icon on the guest row (Built).** An extended stay shows a `calendar-plus` icon beside the guest name in the Reservations table. Colour: sky when all extensions are paid, amber while any extension payment is pending. Hover shows a summary ("2 nights added from 15 Oct, payment pending").

**R1.2 Extension row under the stay (Built).** Directly beneath the stay row, one dashed child row per active extension:
- Label "Extension" or "Early arrival" plus the linked booking id.
- Added nights' dates and count, the stay's guests and channel, the extension amount.
- Status column: the stay's own status badge once paid. While unpaid, an "Inquiry" badge plus an amber "Payment pending" badge (the added nights are not confirmed yet).
- A click opens the stay. Children sort by date. Paging and sorting count stays, so a stay and its extensions are never split across pages.
- When a filter hides the parent, the child stands alone with an "Extension" badge that opens the parent.

**R1.3 Filter (Built).** Extension filter: Any extension, Extended, Unpaid extension. A linked booking matches through the extension on its parent.

**R1.4 Detail sheet (Built).** An Extensions section lists every extension: direction, dates, nights, rate, amount, payment method and status, linked booking id, who created it and when. Actions: **Mark paid** (pending), **Cancel extension** / **Cancel early arrival** (outermost only, before its nights begin). Detail sheet also shows the extension's charges (rooms, taxes and fees, marked Included in price or Added on top).

**R1.5 Status is shared (Built).** A stay and its linked bookings move status together (one guest stay, one status). Exception: cancelling an extension cancels only that extension, and a cancelled extension is never revived.

**Acceptance**
- A stay with one paid and one pending extension shows the amber icon and two child rows.
- Filtering "Unpaid extension" lists the stay with its pending child row, not a lone child.
- Cancelling the stay from the status dropdown cancels every linked booking and record.

### 5.2 Extend flow: Stay longer and Arrive earlier

Entry points: Reservation detail sheet (Modify, Extend reservation), guest page, inbox reservation panel (Extend stay). The flow is a right-side sheet with three steps and a footer (Back, Next, Extend stay / Move arrival). Nothing is written until the final confirm.

**R2.1 Direction (Built).** A switch "Stay longer / Arrive earlier". Arrive earlier is shown only when the status is not checked in, checked out or cancelled, and at least tonight is still free before check-in. New check-in runs from today to the night before the current check-in.

**R2.2 Date picker with availability (Built).** The calendar disables dates whose added nights clash with another stay or block (same listing, or the same unit for room bookings). Quick buttons +1, +2, +3, +7 nights disable the same way. A destructive alert still names the blocking stay if a clash appears anyway. The linked booking's own stay and chain never count as conflicts.

**R2.3 Guests for the extra nights (Built).** Adults, Children, Infants steppers. The linked booking carries the stay's guest counts plus the added ones. The stay itself is untouched. Price does not change per guest by itself.

**R2.4 Mid-stay cleaning (Built).** A switch adds a "Mid-stay cleaning" cleaning charge (default: the stay's cleaning fee, editable) and a **Cleaning day** picker over the added nights. On confirm a `mid_stay` cleaning job (11:00, 2 hours, unassigned) is created and linked to the linked booking. If the listing has no cleaning steps, no job is created and the charge is still billed. A cleaning charge added by hand in Taxes and fees never creates a job.

**R2.5 Rooms and price (Built).** The New Reservation pricing section is reused, scoped to the added nights:
- Room lines start from the stay's own per-night rooms (or one "Entire property" line at the stay's average rate when the stay has no rooms).
- Per room: a **rate plan** select (the plan booked is preselected, falling back to a name or price match, then the base plan) and an editable price, per night or per stay. Rooms can be added or removed, and unit clashes warn before overriding.
- **Taxes and fees**: charges of kind cleaning, city tax, service, other. Each is marked **Included in price** (listed, never added to a total) or **Added on top**. Listing fees are not pre-filled (they were charged with the original stay).
- **Payment charge** (card fee): Card (+3%), Custom (%), No fee. Applies to a payment link only. The percent is taken on rooms plus charges, matching the payment request.
- One summary: Rooms total, each charge, payment charge, "Guest pays via payment link".

**R2.6 Payment step (Built).** Four methods:
| Method | Result |
|---|---|
| Send payment link | Payment request created (card fee mode and percent from 5.2), link valid for **1, 3, 6, 12, 24, 48 or 72 hours** (default 24). Status pending |
| Charge saved card | Only when a card is saved on the stay. The card is charged, then the extension is paid |
| Collect at the property | Pending until Mark paid |
| Already paid | Paid at once (bank transfer or cash already received) |

For a payment link, **Availability**: **Block availability** (default, the nights are held while unpaid) or **Do not block availability** (the nights stay open to other bookings until the extension is marked paid, then it holds).

**R2.7 Review step (Built).** Summary (dates, linked booking, amount and method, guests) plus "What else changes": cleaning moved or added, door codes extended. Then the guest message (5.4).

**R2.8 Money rules (Built).**
- Payment runs first, so a failed charge leaves the stay untouched. A failed save cancels the payment link.
- `guestPaid` on the billed stay moves only when the money is paid, never at creation.
- The linked booking stores rooms and charges (folio total is rooms plus billable charges) and mirrors them in `priceDetails` (cleaning, service/other, tax). `priceDetails.extras` stays owned by the folio.
- Amounts are shown `${ISO code} ${amount}` and never converted. A fee or tax in another currency is not applied.

**R2.9 Expiry of an unpaid link (Gap).** Today a link that expires leaves the extension pending (and, with Block, the nights held). Required: when the link expires unpaid, the extension is cancelled automatically, the nights are released, the guest gets the "link expired" message (5.4), and the notification bell shows "Extension link expired for res-xxxx" with a one-click re-send.

**R2.10 Automatic paid (Gap).** When the gateway reports the payment, mark the extension paid automatically and send the "payment received" message. Staff Mark paid remains as the manual path (cash, bank transfer).

**Acceptance**
- Extend by 2 nights on an OTA stay: the OTA booking is unchanged, a Direct linked booking for those 2 nights exists, amount equals nights plus Added-on-top charges, `guestPaid` unchanged until Mark paid.
- Arrive earlier by 1 night when tonight is free: the linked booking ends on the old check-in, the check-out cleaning stays on the old day.
- An Included-in-price charge never changes the total or the payment link amount.
- Dates clashing with another stay cannot be picked.

### 5.3 Cockpit: link icon

**R3.1 Link icon between joined bars (Built).** An extension is its own reservation. Where it meets the part of the stay it touches (the original, or the previous extension, so chains link too), the Cockpit draws a round **link icon** in the slanted gap, on the stay's lane. Nights added after meet on that part's check-out, an early arrival on its check-in. Click opens the extension. Drawn only when both bars are visible on that row and the date is in view. A guest who merely arrives as another leaves never gets one.

**R3.2 Extended Direct stays (Built).** For older records that were extended in place, the stay is drawn split (stay and extension as separate bars, slant to slant, same lane) and the icon sits at the old check-out (or old check-in for early arrival), only while that date is inside the bar. Tooltip: "Guest: extended, 2 nights added from 15 Oct. Open the stay."

**R3.3 Pending extension look (Gap).** A pending (unpaid) extension bar should read as unconfirmed (dashed or lighter fill, with the amber payment-pending marker) so nobody mistakes it for confirmed revenue. A Do-not-block extension must not look like a hard block.

**R3.4 Drag and conflicts (Built).** Lanes, keyboard moves, today marks and counts treat the stay and its extensions as one stay. Creating a booking over a held extension warns like any double booking. A non-blocking extension never triggers the warning.

**Acceptance**
- A stay with one extension shows exactly one link icon at the join. A stay with two chained extensions shows two.
- Clicking the icon opens the extension's detail.

### 5.4 Guest message and templates

The review step proposes a message and lets staff edit it. Delivery channels, multi-select: **Email**, **WhatsApp** (Email needs a guest email, WhatsApp a phone number). If a channel resolves to the same conversation it is sent once. The `[payment link]` token becomes the real link at send time. Messages are written to the guest's conversation in the inbox, tagged with their channel. A blank message sends nothing.

Currency is shown `${ISO code} ${amount}`. Dates are written in full ("22 October 2026"). The sender signature is the tenant's display name.

**Variables available to every template**

| Variable | Example |
|---|---|
| `{{guest_first_name}}` | Juli |
| `{{listing_name}}` | Bali Timur - Stripe |
| `{{old_checkin}}`, `{{old_checkout}}` | 22 October 2026, 23 October 2026 |
| `{{new_checkin}}`, `{{new_checkout}}` | 22 October 2026, 25 October 2026 |
| `{{added_nights}}`, `{{total_nights}}` | 2, 3 |
| `{{amount}}` | CHF 200.00 |
| `{{amount_breakdown}}` | Nights CHF 150.00, Mid-stay cleaning CHF 50.00 |
| `{{payment_link}}` | the gateway URL |
| `{{link_valid_for}}` | 24 hours |
| `{{payment_deadline}}` | 21 October 2026, 16:28 |
| `{{door_code_note}}` | "Your door code stays the same and now works until your new check-out." |
| `{{tenant_name}}` | QA Playground Team |

**T1. Extension, payment link** (built from the existing booking payment-link template, Direct and OTA stays)

```
Complete Your Extension

Hi {{guest_first_name}},
We can extend your stay at {{listing_name}}.

New check-in : {{new_checkin}}
New check-out : {{new_checkout}}
Added nights : {{added_nights}}
Total : {{amount}}

To confirm the extra nights, please complete your payment below
{{payment_link}}

Please note: your extension will be released automatically if payment is not received within {{link_valid_for}}.

Your original booking stays exactly as it is. The extra nights are booked directly with us.
Your extension will be confirmed once payment is received.
{{door_code_note}}
The {{tenant_name}}
```

For **Arrive earlier**, replace the first block with "You can arrive earlier at {{listing_name}}. Your new check-in is {{new_checkin}} ({{added_nights}} more nights)." and close with "We look forward to welcoming you!"

**T2. Extension, payment received**
```
Hi {{guest_first_name}},
We have received your payment of {{amount}}, thank you. Your stay at {{listing_name}} now runs from {{new_checkin}} to {{new_checkout}}.
{{door_code_note}}
The {{tenant_name}}
```

**T3. Extension, charged to saved card**
```
Hi {{guest_first_name}},
Your stay at {{listing_name}} is extended to {{new_checkout}} ({{added_nights}} more nights). We charged {{amount}} to your saved card ending {{card_last4}}.
{{door_code_note}}
The {{tenant_name}}
```

**T4. Extension, pay at the property**
```
Hi {{guest_first_name}},
Your stay at {{listing_name}} is extended to {{new_checkout}}. The extra nights come to {{amount}}, payable at the property.
The {{tenant_name}}
```

**T5. Payment link expired (Gap, needs R2.9)**
```
Hi {{guest_first_name}},
The payment link for your extension at {{listing_name}} has expired and the extra nights were released. If you still want to extend, reply here and we will send a new link.
The {{tenant_name}}
```

**T6. Extension cancelled**
```
Hi {{guest_first_name}},
Your extra {{added_nights}} nights at {{listing_name}} are cancelled. Your check-out stays on {{old_checkout}}.
{{payment_line}}
Your {{channel}} booking stays exactly as it is.
If you have any questions, just reply to this message.
The {{tenant_name}}
```
`{{payment_line}}` is "The payment link we sent is no longer needed." when the extension is unpaid, and empty when it was paid (our team contacts the guest directly, no amount or refund is promised in the message).

**T7. Whole stay cancelled with extensions**: "Your booking from {{checkin}} to {{checkout}} has been cancelled, including the extra nights booked directly with us."

**WhatsApp specifics (Gap).** WhatsApp Business templates must be pre-approved outside the 24-hour window. Messages are sent from the Elev8 number, not from a tenant number. Register T1, T2, T5, T6 as utility templates (`stay_extension_payment_link`, `stay_extension_paid`, `stay_extension_expired`, `stay_extension_cancelled`) with the variables above as positional parameters. Inside the 24-hour window free text is allowed. The dialog must show when the window is closed and fall back to the template (or to Email). Emoji (for example the pointing-down arrow in the existing booking template) are allowed in WhatsApp text only if the tenant adds them to their own wording, the product default stays plain text.

**Language.** Templates exist per guest language (`guestLanguage`). Missing language falls back to English. Staff can edit before sending, and edits are not saved back to the template.

**Acceptance**
- Choosing Email and WhatsApp sends two messages with the real link, both visible in the guest's conversation with their channel label.
- A stay without an email disables Email, without a phone disables WhatsApp.

### 5.5 Dashboard updates after an extension

All of this happens on confirm (and is reversed on cancel), without staff action.

**R5.1 Housekeeping / cleaning (Built).**
- Stay longer: open check-out cleaning jobs on the old day move to the new check-out (re-linked to the linked booking for OTA stays, dropped if that booking already has one). Existing jobs are kept, not regenerated.
- Arrive earlier: the check-out cleaning stays; the linked booking's own check-out job on the old check-in day is removed (the guest stays on).
- Mid-stay cleaning: one `mid_stay` job on the chosen day (R2.4).
- Cancelling an extension moves the check-out cleaning back and cancels the jobs for the removed nights.
- Gap: show an "Extended stay" tag on the cleaning job card and in the housekeeper app so cleaners know the guest is staying longer. Notify the assigned cleaner when their job moves.

**R5.2 Smart lock (Built).**
- Stay longer: active, dated codes ending on the old check-out day move to the new check-out (Bali time). Ongoing codes are left alone.
- Arrive earlier: codes starting on the old check-in day start at the new check-in.
- Cancel restores the original dates; cancelling the whole stay revokes active codes.
- Gap, decided: a pending, unpaid extension must **not** move the code. The code shifts only when the extension becomes paid (Mark paid or the gateway event), and for an extension paid at creation (saved card, already paid) at confirm. Today the code moves at creation, this must change. If a code is shared (brand sharing), the same shift applies to every paired lock.

**R5.3 Guest Guide (Mobile/Guide, Gap on the dashboard side).** The Guest Guide (web, guide-app) reads the stay from the dashboard. Contract:
- The guide shows the effective stay: earliest check-in to latest check-out over the stay and its active linked bookings, nights counted accordingly.
- Door code validity text follows the shifted code window (R5.2).
- An unpaid extension appears as a card "Complete your payment to confirm your extra nights" with the payment link and the deadline, and disappears when paid or cancelled.
- Check-out time and check-out instructions use the new check-out day.
- The dashboard exposes the span and the open payment request on the stay payload. Cancelled extensions are never included.

**R5.4 Inbox (Built, with Gap).**
- The guest message is written to the reservation's conversation (`ensureConversationForReservation`: the stay's thread, or an Email conversation on the guest's address), tagged with the delivery channel.
- Inbox reservation panel has an **Extend stay** entry point (matched to the Reservations module stay by id).
- Built in the prototype: the reservation panel shows the stay's extensions (dates, amount, payment status, Mark paid, copy link, cancel) so the agent can finish the job without leaving the conversation.
- Built in the prototype: system lines in the thread for each step ("Stay extended by 2 nights, payment pending", "Extension paid", "Extension cancelled"), shown at the time they happened and read only.
- Built in the prototype: a conversation with an unpaid extension shows an amber calendar-plus marker in the inbox list, which clears when paid or cancelled.

**R5.5 City tax (Gap).** City tax for the added nights is not handled yet. Required: the linked booking owes its own city tax computed from its own nights and guests; an unsettled stay recalculates; a stay whose city tax is already settled shows a warning in the review step (the added nights are not included, undo the settlement in City tax to collect). City tax is never added to the extension payment link. Until this ships the review step shows nothing about city tax.

**R5.5b Damage protection (decided).** An extension is not covered by the stay's damage protection for now. The linked booking carries no protection and the stay's protection is not reassessed.

**R5.7 Activity log (Built, with Gap).** Every step is written to the reservation's activity log (the timeline in the detail sheet), on the stay and on the linked booking:
- Stay: "Stay extended" or "Early arrival" (nights, range, linked booking id, amount, payment pending when unpaid).
- Linked booking: "Created as an extension" or "Created as an early arrival" (nights, original reservation id).
- "Extension paid" when marked paid.
- "Extension cancelled" or "Early arrival cancelled" on cancel, and "Status updated, set to Cancelled, the extension of <id> was cancelled" on the linked booking.
- Status changes mirrored across the group ("Set to X with <id>").
- Gap: also log the guest message (channels used, who sent it), the mid-stay cleaning job created, door codes moved, and payment link created, expired and re-sent, each with actor and time.
- Staff Activities report: the mid-stay cleaning job, once finished by housekeeping, is offered under Finished but not logged with cleaning kind Mid-stay, like any cleaning job. No new log type.

**R5.6 Finance and owner statements (Built).** A linked booking is its own Direct line on the owner statement, gross follows `guestPaid` (cash basis), so an unpaid extension reaches the owner only once marked paid. Analytics generates extensions the same two ways (see analytics doc).

### 5.6 Cancelling

**R6.1** Cancel the stay: cancels every linked booking and extension record, open payment links, every open cleaning on the stay and its linked bookings, revokes active door codes. No "keep the extra nights" option (product decision).

**R6.2** Cancel one extension: only the outermost of its direction (latest check-out, earliest arrival) and only before its nights begin. Dates, cleanings and codes go back, a pending payment link is cancelled. A paid extension can be cancelled too: the extension and its nights are removed, no refund is tracked (see Non-goals).

**R6.3** A confirmation dialog shows counts (links, cleanings, codes) and an editable guest message (T6/T7), which can be switched off.

## 6. Data model (summary)

- `ReservationEntry.extensions?: StayExtension[]` on the stay the guest booked.
- `StayExtension`: `id`, `direction` (`after` | `before`), `previousCheckOut/newCheckOut` or `previousCheckIn/newCheckIn`, `extraNights`, `nightlyRate`, `amount`, `currency`, `paymentMethod`, `paymentStatus` (`pending` | `paid`), `paymentRequestId?`, `paidAt?`, `linkedReservationId?`, `createdAt/By`, `cancelledAt/By?`.
- Linked booking: `extensionOf`, `channel: 'Direct'`, `rooms` (per-night lines), `charges`, `blocksAvailability?: false` while a non-blocking extension is unpaid, same status as the stay.
- `ReservationCharge`: `kind`, `label`, `amount`, `inclusive?`.
- Payment request: `category: 'extension'`, `feeMode` (`card` | `manual` | `no_fee`), `customFeePercentage?`, `expiresInHours`.
- Rule: only the folio writes `priceDetails.extras`; city tax and damage protection never touch `priceDetails`.

## 7. Edge cases

1. Extension dates clash with a later booking: dates are disabled and the confirm is refused with the blocking guest's name.
2. Two extensions in a row: the second starts at the last linked booking's check-out, and cancel is allowed only on the outermost.
3. A stay in a flat-rate room: the flat line is not charged again, the room still rides on the linked booking so the Cockpit draws it on the room.
4. Different currency on a fee or tax: skipped, never converted.
5. Guest has no email and no phone: message switch can stay off, the extension still completes. Inbox thread, if any, is still written.
6. Failed card charge: nothing is written, the staff sees the error in the sheet.
7. Do not block availability and another booking lands on the nights: the extension cannot be marked paid without a conflict warning (Gap).
8. Stay checked in while an early arrival is pending: the early arrival is refused at confirm.
9. Cancelling an extension whose nights have begun is refused.
10. Daily cleaning rhythm: jobs exist for every day already, extending only adds jobs for the added days (in-place records), linked bookings carry the stay's rhythm over.

## 8. Notifications

- Bell: "Extension payment pending" (amber) for unpaid extensions older than 12 hours, "Extension paid", "Extension link expired" (Gap). New alert types must be added to their category in `notification-settings.ts` or they are invisible.
- Toast on confirm: "Stay extended by N nights" with details (booking created, link sent, guest notified, cleaning scheduled).

## 9. Success metrics

- Extension requests completed without leaving the sheet: target 95 percent.
- Time from request to payment link sent: under 2 minutes.
- Share of extensions paid within link validity: tracked, target 70 percent.
- Manual follow-ups on cleaning or door codes after an extension: target zero.
- Double bookings caused by non-blocking extensions: zero.

## 10. Decisions

1. Door codes move only after the extension is paid (R5.2).
2. An extension is not covered by the stay's damage protection for now (R5.5b).
3. Guest self-service extension from the Guest Guide is not in scope.
4. The payment charge (card fee) defaults to Card (+3%).
5. WhatsApp messages go out from the Elev8 number, not from a tenant number.
6. No channel-side notice on OTA stays (no message in the Airbnb or Booking.com thread).

## 11. Release plan

- **Phase 1 (Built):** 5.1, 5.2 (except R2.9, R2.10), 5.3 (except R3.3), T1 to T4, T6, T7 in the review step, R5.1, R5.2 (code move, to be gated on paid), R5.4 message, R5.6, the Built part of R5.7, section 5.6 (without refunds).
- **Phase 2 (Gap):** R2.9 auto-release, R2.10 auto-paid, R3.3 pending look, T5 and WhatsApp template registration, Guest Guide contract (R5.3), inbox panel and system events, cleaner tags and notifications, door codes only after paid, city tax (R5.5), full activity log (R5.7).

## 12. References

- Module doc: `docs/claude/stay-extension.md`
- Related: `docs/claude/cockpit.md`, `docs/claude/inbox.md`, `docs/claude/smart-lock.md`, `docs/claude/city-tax.md`, `docs/claude/reservation-folio.md`, `docs/claude/payment-requests.md`, `docs/claude/whatsapp.md`
- Code: `app/composables/useStayExtension.ts`, `app/composables/useReservationsModule.ts`, `app/components/reservations/ReservationExtendDialog.vue`, `app/components/reservations/ReservationRoomsSection.vue`, `app/components/reservations/ReservationExtensionsSection.vue`
