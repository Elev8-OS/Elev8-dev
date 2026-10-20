# PRD 1: Arrive Earlier (Early Arrival Extension)

Part of a series. **This PRD (PRD 1)** adds **Arrive earlier** to the extension feature that exists today. **PRD 2** (`prd-stay-extension-linked-reservation.md`) later changes the extension model so that every extension is its own linked Direct reservation. PRD 1 is written against the model in production now, and avoids choices that PRD 2 would have to undo.

Status key: **Today** (what the backend `elevate-villas/elevate` `development` branch and the v2 dashboard do now), **Change** (what this PRD adds).

## 1. Summary

Today staff can only add nights **after** the check-out (**Stay longer**). A guest who needs the room earlier (a flight that lands a day early, a host who has the room free) cannot be accommodated without editing the dates by hand, which skips the price, the payment link, the cleaning, the door code and the guest message.

**Arrive earlier** adds nights **before** the check-in, through the same guided flow, payment link and side effects as Stay longer.

Goal: staff can move a guest's arrival earlier in one dialog, the guest pays for the extra nights through the usual link, and everything the new arrival date touches follows without manual work.

## 2. Scope

### In scope
- Create, confirm, decline, cancel and edit an early arrival extension.
- Backend: data, validation, availability, payment, cleaning, door codes, notifications, guards for OTA stays.
- v2 dashboard: the extend dialog, the Extensions panel, the reservation sheet, the Cockpit.
- Guest messages for an early arrival.

### Out of scope
- An early **check-in time** (arriving at 10:00 instead of 15:00 on the same date). This PRD is about extra nights.
- Moving the model to linked reservations (PRD 2).
- Refunds, city tax, guest self-service, notices on the OTA side.
- Early arrival for a stay that is already checked in or checked out.

## 3. User stories

1. As Guest Relations, I extend a verified Airbnb stay one night earlier, send the guest a payment link, and see the stay start a day earlier once it is paid.
2. As Guest Relations, I extend a Direct stay two nights earlier and mark it confirmed at once because the guest paid in cash.
3. As Guest Relations, I cannot pick a date that is already taken by the previous guest.
4. As housekeeping, I see no surprise: the previous guest's check-out cleaning is not moved, and I am told when it falls on the new arrival day.
5. As the guest, my door code works from the new arrival date and I get a message with the new dates.

## 4. Eligibility and rules

| Rule | Value |
|---|---|
| Reservation status | Unverified (1) or Verified (2). Not Check in (3), Check out (4), Canceled (5), Black (6), Inquiry (7) |
| New check-in | Strictly before the current earliest check-in, and not before today |
| Chain | An early arrival starts at the earliest check-in of the stay, whether the previous early arrival is pending or applied |
| Independent chains | A stay can have early arrivals and later extensions (once applied). Cancelling an early arrival only cascades to later early arrivals, never to the Stay longer chain, and the reverse |
| Pending limit | **Unchanged from today:** one pending extension per reservation, in either direction. While one is pending, Extend Stay stays disabled (a pending Stay longer blocks an Arrive earlier, and the reverse) |
| Room | Free across the added range `[new_check_in, previous_check_in)`: no other active reservation overlaps it |
| Currency | Billed in the tenant currency (existing conversion) |

Today the backend lets staff extend a reservation in any status from 1 to 4. Early arrival is stricter on purpose: it is refused for Check in and Check out.

## 5. Requirements

### 5.1 Data model (Change)

`reservation_extensions` gains:

| Column | Type | Notes |
|---|---|---|
| `direction` | tinyint | 1 = after (default, all existing rows), 2 = before |
| `previous_check_in_date` | date, null | Set for direction 2 |
| `new_check_in_date` | date, null | Set for direction 2 |

For direction 2 the existing check-out columns stay null. `nights_added`, `amount`, `currency`, `has_cleaning_fee`, `is_block_availability`, `expiry_hours`, `status`, `notes`, `is_send_email`, `is_send_whatsapp` keep their meaning.

`reservations` gains `ota_checkin_date` (date, null), stamped once, the first time an OTA-synced stay gets an early arrival, with the OTA's last known check-in (the counterpart of `ota_checkout_date`).

The reservation API and the Cockpit payload expose `direction` and the two check-in dates on each extension.

### 5.2 Create (Change)

`POST /reservation/:id/extend` accepts `direction` (`after` default, `before`) and, for `before`, `new_check_in_date` instead of `new_check_out_date`. Everything else is as today: `as_inquiry`, `currency`, `amount`, `invoices[]`, guest counts, `is_block_availability`, `expiry_hours`, `is_send_email`, `is_send_whatsapp`, `notes`.

Validation (each failure returns a specific message, not a generic one):
- Status not 1 or 2: "The guest has already checked in or the stay is closed, so the arrival can no longer move earlier."
- `new_check_in_date` not before the chain start, or before today.
- Another active reservation overlaps `[new_check_in, previous_check_in)`: "room is not available for the requested dates". The overlap query is the existing `GetOverlappingActiveReservations`, excluding the reservation itself.
- Amount must be above 0 (as today).

Price: loaded from the Channex inventory for the chosen rate plan and the earlier dates, exactly as Stay longer loads it (`fetchRoomPriceFromInventory`), and editable. Number of nights: `previous_check_in - new_check_in`. `has_cleaning_fee` is not offered for an early arrival (there is no mid-stay).

### 5.3 Two ways to create it (same as today)

| Choice | Result |
|---|---|
| **Inquiry** | A pending extension (status 7) and its invoice lines. The reservation does not change. A payment transaction and link are created and sent through the same notification as today, with the early-arrival wording. If **Block availability** is on, the added nights are held on Channex: `[new_check_in, previous_check_in)` |
| **Confirmed** | Applied at once: the reservation moves immediately. No payment request is created |

### 5.4 Applying an early arrival (Change)

When applied (Confirmed at creation, staff Confirm, or the payment link paid), in one transaction:
- `reservations.check_in_date` = `new_check_in_date`; `nights` += `nights_added`; `total_amount` += `amount`. On an OTA-synced reservation, the first time, `ota_checkin_date` = the old check-in.
- Guest counts are applied only for a directly confirmed extension, as for Stay longer.

After commit (the same set as Stay longer, run from one shared function so the paid path and the staff path cannot drift apart):
- **Door codes:** the code window start moves to the new check-in (`UpdateReservationCode`, which already clamps a start in the past to now, updates an online Seam code, reissues an offline Igloohome code, updates Loxone, leaves manual codes alone). Only when the extension is applied or paid, never for a pending one.
- **Availability:** recompute Channex availability over `[new_check_in, current_check_out)`.
- **HostBuddy:** refresh the guest and stay context.
- **StayEasy invoices:** flag already issued invoices for review ("Buchung verlängert").
- **Booking quota:** one quota unit, same thresholds and top-up as Stay longer. Cancelling credits it back.
- **Damage protection:** if the reservation has damage protection, send the new dates, nights and total to the protection partner through the existing booking update helper in `app/global` (the helper already used when a reservation is moved on the calendar and by the Channex modification webhook; the partner's update replaces the whole booking, so the full booking is sent). If the protection fee or the covered amount depends on the stay length or value, recompute it with the same rules as a date change from the calendar. A partner failure is logged and does not fail the extension, and the reservation is flagged for staff (`action_needed`) so the cover is not left on the old dates unnoticed. Cancelling the early arrival sends the old dates again.
- **Guest message:** the confirmation, with the new check-in.

**Cleaning.** The check-out cleaning of this stay does not move. The previous guest's check-out cleaning on the new arrival day (or before) must be finished before the guest arrives: when the new check-in is the same day as another reservation's check-out cleaning, the extend dialog shows a warning "A check-out cleaning is scheduled on {date}. Make sure it is done before the guest arrives." For a stay on a daily cleaning rhythm (type 1) the added days get their own cleaning rows.

### 5.5 Payment, expiry, decline, cancel, edit (Change)

All existing flows apply to an early arrival, with the dates mirrored:
- **Paid link** (Stripe, Xendit, Doku): runs the same application as 5.4. The paid handlers must call the same shared function as the staff Confirm path.
- **Expired link:** a pending early arrival is removed (soft delete, invoice lines removed, link voided, held nights released over `[new_check_in, previous_check_in)`).
- **Decline:** pending only (there is at most one pending extension at a time).
- **Cancel:** an applied or pending early arrival. Reverses 5.4: `check_in_date` back to `previous_check_in_date`, `nights` and `total_amount` reduced, codes re-windowed, availability freed over `[new_check_in, previous_check_in)`, quota credited, damage protection booking updated back. A cancel cascades to **later early arrivals** (those with a smaller `new_check_in_date`, which chain off this one), never to the Stay longer chain.
- **Edit:** newest pending of the direction; only availability and expiry (as today).

### 5.6 OTA stays and the guard (Change)

An early arrival on an OTA reservation moves the reservation's check-in away from the OTA's. To keep the OTA's later webhooks from overwriting it:
- Stamp `ota_checkin_date` the first time (5.4).
- `GuardLinkedReservationModification` also treats `ota_checkin_date` as "the host has diverged" and flags the reservation (`action_needed`, Slack message) instead of applying the OTA modification.
- The guard must run on **every** modification path of the Channex webhook (single room, multi-room reconciler, sold-as-whole). Today it runs on the single-room path only, so an early arrival would be silently overwritten on the other two. This is a required fix, not an option.
- Known limit, solved in PRD 2: the OTA reservation row still carries nights sold directly. Reports see them as the OTA channel until PRD 2 separates them.

### 5.7 v2 dashboard (Change)

**Extend dialog (`ExtendStayDialog.vue`)**
- A switch **Stay longer / Arrive earlier** at the top. Arrive earlier shows only when the stay status allows it (Unverified or Verified) and at least tonight is free before the check-in.
- For Arrive earlier: the "current check-out" becomes "Current check-in", the picker is **New check-in** with selectable dates from today to the day before the current check-in, quick buttons "1, 2, 3, 7 nights earlier" (disabled when before today).
- The availability check (existing debounced check) runs for `[new_check_in, current_check_in)`. Dates that clash are shown as unavailable, not just reported after selection.
- Price, taxes and fees, guests, notes, status (Inquiry or Confirmed), block availability, expiry and the send email and WhatsApp choices behave as for Stay longer. The mid-stay cleaning fee line is hidden.
- The review text names the change: "Arrival moves from {old} to {new}, {n} nights earlier."

**Extensions panel (`ExtensionsList.vue`) and reservation sheet**
- Each row shows the direction ("Early arrival" tag), the range `{new_check_in} to {previous_check_in}`, nights, amount, status, and the same actions as today.
- Today's rules are kept: Extend Stay is disabled while any extension is pending, Confirm runs oldest first, Decline newest first. Cancel cascades only inside the direction of the extension that is cancelled (an early arrival to later early arrivals, a Stay longer to later Stay longer extensions).
- The sheet's header shows the effective stay: earliest applied check-in to latest applied check-out.
- Charges tab lines carry "Extension #n" as today.

**Cockpit (`pages/cockpit.vue`)**
- An early arrival is drawn as its own labelled bar **before** the reservation bar ("Early arrival" label, same `more_time` icon family, coloured by the extension's own status). The bar is positioned over `[new_check_in, previous_check_in)`; a click opens the Extensions panel.
- The calendar payload (`CalendarReservationExtension`) carries `direction`, `previous_check_in_date`, `new_check_in_date`.
- A blocking pending early arrival shows the block-availability marker, as a pending Stay longer does.

**Translations:** add keys for the new labels (Arrive earlier, New check-in, Current check-in, nights earlier, Early arrival, the review text and the cleaning warning) in every supported language.

### 5.8 Guest messages (Change)

The same notifications as Stay longer, with early-arrival wording.

Payment link (inquiry), based on the existing booking payment-link message:
```
Complete Your Early Arrival

Hi {{guest_first_name}},
You can arrive earlier at {{listing_name}}.

New check-in : {{new_check_in}}
Added nights : {{added_nights}}
Total : {{currency}} {{amount}}

To confirm the extra nights, please complete your payment below
{{payment_link}}

Please note: this change will be released automatically if payment is not received within {{link_valid_for}}.
Your original booking stays as it is. The extra nights are booked directly with us.
The {{tenant_name}}
```
Applied (paid or confirmed): "Your stay at {{listing_name}} now starts on {{new_check_in}} ({{added_nights}} more nights, {{total_nights}} in total). {{door_code_note}}" with the door code note "Your door code stays the same and now works from your new check-in."

Messages are written in the guest's language (fallback English), money as `${ISO currency} ${amount}`, full dates. WhatsApp messages go out from the Elev8 number; utility templates must be registered for the payment link and applied messages. No message is sent to the guest when an early arrival is cancelled or when its payment link expires.

### 5.9 Activity and notifications (Change)

Add reservation activity entries (they do not exist for extensions today): early arrival created (nights, range, amount, pending or confirmed), confirmed, declined, expired, cancelled, edited, guest message sent (channels), door codes moved. The existing "Payment Received, Stay extension" entry for the paid webhook stays. The `extension-paid` realtime event carries `direction`.

### 5.10 Guest Guide (Change)

The guide reads the reservation's check-in date, so after an early arrival it shows the new arrival date and the code window starting then. A pending early arrival appears as "Complete your payment to confirm your earlier arrival" with the link and deadline, and disappears when paid, declined or expired. Guide steps for a reservation that is already checked in are not affected.

## 6. Edge cases

1. The previous guest's check-out is on the new arrival day: allowed (a check-out day is not a night), with the cleaning warning in 5.4.
2. The guest checks in while an early arrival is pending: the pending extension is refused at confirm and at payment (status 3), the payment is flagged for manual handling.
3. A webhook is delivered twice: a paid extension is skipped when its status is no longer pending; the cleaning, quota and message steps are idempotent.
4. Two early arrivals in a row: the second starts at the first's new check-in, even while the first is pending; cancel cascades to the later one.
5. A Stay longer is pending and staff want an Arrive earlier: not allowed until the pending one is confirmed, declined or expired (today's one-pending rule). The dialog explains why.
6. An OTA modification arrives after an early arrival: blocked by the guard on every path and flagged `action_needed`.
7. Check-in date change of the stay after an early arrival (Modify stay time): uses the new effective check-in.
8. The extension is paid after the new check-in date has passed (a late payment of an early arrival whose nights are already over): refuse and flag, do not apply.

9. The reservation has damage protection and the partner update fails: the extension still completes, the failure is logged and the reservation is flagged so staff can retry.

## 7. Acceptance criteria

1. **Given** a Verified Airbnb stay 10 to 14 Oct and a free night on the 9th, **when** staff create an early arrival to the 9th as Inquiry with a payment link, **then** the reservation still starts on the 10th, a pending extension exists, the guest gets the early-arrival payment link with the new check-in, and (if Block availability is on) the night of the 9th is held on Channex.
2. **Given** the above, **when** the guest pays the link, **then** the reservation starts on the 9th with 5 nights, the total grows by the extension amount, the door code starts on the 9th, availability is recomputed, the guest receives the applied message, the extension is applied, and `ota_checkin_date` is 10 Oct.
3. **Given** another reservation ends on the 9th (check-out the 9th), **when** staff pick the 9th, **then** it is allowed and the cleaning warning appears.
4. **Given** another reservation occupies the night of the 8th, **when** staff try to go back to the 8th, **then** the date is unavailable in the dialog and the server refuses it.
5. **Given** a stay with status Check in, **when** staff open Extend Stay, **then** Arrive earlier is not offered and the API refuses a `direction = before` request.
6. **Given** an applied early arrival, **when** staff cancel it, **then** the reservation starts on the 10th again with 4 nights, the total is reduced, the door code starts on the 10th, the nights are freed, quota is credited, and no message is sent to the guest.
7. **Given** an applied early arrival on an OTA stay, **when** the OTA sends a modification on any path, **then** the dates are not overwritten and the reservation is flagged.
8. **Given** a pending early arrival, **when** its link expires unpaid, **then** the extension disappears, held nights are released, and no message is sent to the guest.
9. **Given** a pending Stay longer, **when** staff open Extend Stay to arrive earlier, **then** the action is disabled with the existing hint "Confirm or decline the pending extension before extending again", and the API refuses it.
10. **Given** a reservation with damage protection, **when** an early arrival is applied or cancelled, **then** the partner booking is updated with the new dates, and a partner failure flags the reservation without undoing the extension.
11. **Given** an early arrival, **when** the Cockpit loads, **then** a labelled bar is drawn before the reservation bar over the added nights, and a click opens the Extensions panel.

## 8. Test plan

- **Backend unit:** validation (status, dates, chain, overlap), `nights_added`, apply and cancel arithmetic for `check_in_date`, `nights`, `total_amount`, cascade among early arrivals only, per-direction pending rule, quota debit and credit, idempotent paid handler, expiry sweep for direction 2.
- **Backend integration:** Stripe, Xendit and Doku paid handlers for a before extension, the damage protection partner update on apply, cancel and failure, access-code window start for an online, an offline and a Loxone lock, Channex availability ranges, the guard on all three webhook paths.
- **Frontend:** the dialog (switch, dates, quick buttons, availability), the Extensions panel labels and the chain buttons, the Cockpit bar and click, translations present in every language.
- **Manual end-to-end** on development: one OTA stay and one Direct stay, each with Inquiry then pay, Confirmed, decline, cancel, expire.

## 9. Success metrics

- Early arrivals created through the dialog instead of editing dates by hand: tracked, target 90 percent.
- Time from request to payment link sent: under 2 minutes.
- Manual fixes to door codes or cleaning after an early arrival: zero.
- Double bookings caused by an early arrival: zero.

## 10. Rollout

- Behind a tenant setting or flag until the three webhook guards and the paid-path application are verified on development.
- Ship order: backend model and validation, guards and shared application function, then the v2 dialog, panel and Cockpit, then messages and templates.
- Existing extensions are unaffected (`direction` defaults to after).

## 11. Decisions

1. **Pending limit:** keep today's rule, one pending extension per reservation in either direction. Nothing changes in the backend or the dialog for it.
2. **Price source:** the Channex inventory, loaded for the earlier dates and editable, as for Stay longer.
3. **Damage protection:** updated through the partner API on apply and cancel (5.4), including a failure path.
4. **No admin approval** for long early arrivals.

## 12. References

- Backend: `app/service/extend_reservation.go`, `app/model/reservation_extensions.go`, `app/global/reservation_link.go` (`GuardLinkedReservationModification`), `app/global/update_reservation_code.go`, `app/webhook/channex/bookings.go`, `app/webhook/{stripe,xendit,doku}`, `app/service/scheduler.go`.
- v2 dashboard: `components/Reservation/ExtendStayDialog.vue`, `ExtensionsList.vue`, `components/ReservationSheet/ExtensionsPanel.vue`, `pages/cockpit.vue`, `stores/reservation.js`.
- Prototype for the interaction: `docs/claude/stay-extension.md` (Arrive earlier switch, quick buttons "earlier", early arrival rows), `ReservationExtendDialog.vue`.
- Next: `docs/prd-stay-extension-linked-reservation.md` (PRD 2).
