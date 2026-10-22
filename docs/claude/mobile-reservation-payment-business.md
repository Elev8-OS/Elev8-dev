# Mobile: payment method, Business contact and Mark as paid

The mobile app is NOT in this repo. This doc records the Figma design for it, so the mobile build and the dashboard stay aligned. The web behaviour is in `docs/claude/reservation-payment-business.md`; the PRD is `docs/prd-reservation-payment-method-business-contact.md` (PP-888).

Figma: Elev8 Design System, page "Mobile Apps", section `Mobile Calendar / Create Reservation: Payment method & Business contact` (node `40025961-140975`). The original section `40016202-372960` is unchanged.

## What changed

### Create Reservation (and Edit Reservation)
| Area | Change |
|---|---|
| Status and Source | New **Payment method** select under Status (under Availability for an Inquiry). Confirmed offers Bank transfer or Cash, default Bank transfer. Inquiry offers Payment link, Bank transfer or Cash, default Payment link. |
| Hint under the field | Confirmed: "Recorded as paid in full with this method." Inquiry with Cash or Bank transfer: "No payment link is sent. Mark the reservation as paid once the cash is received." |
| Expiry (hours) | Shown only for an Inquiry paid by Payment link. Hidden for Cash and Bank transfer. |
| Availability | Shown only for an Inquiry. Hidden for Confirmed. |
| Contact Details | New **Personal / Business** tab, Personal by default, with a one line explanation under it. |
| Business tab | **Company Name** (required) and **VAT / Tax ID** (free text) above the contact. Labels become Contact First Name, Contact Last Name and **Billing Address**. |
| Checkbox labels | With Payment link: "Send payment link via WhatsApp / Email". Otherwise "Send booking confirmation via WhatsApp / Email". |
| Edit Reservation | Same Personal / Business tab. Payment method is not editable there; staff use Mark as paid. |

### Reservation Details (built on the existing Reservation Details frame)
| Area | Change |
|---|---|
| Company line | Under the guest name: building icon, company name, "· VAT / Tax ID". Business reservations only. |
| Price info (new) | The single "Total Amount" line is replaced by a collapsible reservation summary. Collapsed: reservation code on the left, **Guest Paid** with the amount on the right and a chevron (also on the calendar summary sheet). Expanded: a **Guest Paid / Payout** toggle. Guest Paid view: Subtotal (N nights), Cleaning fee, Tax, Guest paid. Payout view: Guest paid, commission and payout, as on the web (not shown in Figma yet). Guest paid starts at 0 for an Inquiry and grows with each payment (USD 0, 100, 750). |
| Mark as paid... | Yellow outlined button under the card while a balance is due. Opens the Mark as paid sheet. |
| Mark as paid sheet | Amount (default: balance due), Received on (date), Payment method (**Cash** or **Bank Transfer**), button **Mark as paid**. "Balance due USD 750" under the title. |
| Part payment | Amount below the balance records a part payment. Guest paid goes up, the reservation stays **Inquiry**, Mark as paid... stays. |
| Full payment | Balance paid in full: status becomes **Unverified**, a green strip "Paid via Cash on 22 Oct 2026" shows under Guest paid, Mark as paid... goes away. |
| Payment link sent | Inquiry paid by link: yellow banner "Payment link sent to the guest. It expires in 24 hours.", **Resend payment link** and Mark as paid.... |
| Paid by link | After the guest pays: "Paid via Payment link on 22 Oct 2026", status Unverified. |

### Toast feedback
Existing toast bar (dark, green check), bottom of the screen.
| After | Message |
|---|---|
| Create, Inquiry or Confirmed | Reservation has been created |
| Create, Inquiry with Payment link | Reservation created, payment link sent |
| Mark as paid, part payment | Partial payment recorded via Cash (or Bank Transfer) |
| Mark as paid, full amount | Marked as paid via Cash (or Bank Transfer) |

## Flows in the Figma section
- **Create**: Confirmed with Bank transfer, the Payment method picker, the Business tab, Inquiry with Cash, Inquiry with Payment link.
- **Flow A (cash or bank transfer)**: calendar summary, Reservation Details with Guest Paid USD 0, Mark as paid with USD 100, still Inquiry with USD 100, Mark as paid with the USD 650 balance, Paid via Cash and Unverified.
- **Flow B (payment link)**: Inquiry with the link sent, then Paid via Payment link.
- **Validation states** (A3a to A3c): amount above the balance, amount of 0, Received on in the future. Red field, red hint, disabled button.
- Connectors are attached to their frames. Demo data is the same in every screen: Rex Izuchukwu Nwokoro, Acme Company GmbH, CHE-3874873949898939, The R Apartment Pererenan, USD 750.

## Rules the mobile app must follow
- Same rules as the web doc: Confirmed is recorded as paid, a paid reservation is Unverified (never Verified), Payment link is never a manual method, amounts as `USD 750` with the ISO code and no conversion.
- Marking as paid in full cancels an open payment link and shows a warning first. A part payment keeps the link open.
- Tax ID is free text, no per-country validation.
- A company booking may keep a damage protection card under the contact person's name.

## Acceptance criteria
Create
1. Confirmed lists only Bank transfer and Cash, default Bank transfer, with the "Recorded as paid in full" hint. Availability and Expiry are not shown.
2. Inquiry lists Payment link, Bank transfer and Cash, default Payment link, and shows Expiry (hours) only for Payment link.
3. Inquiry with Cash or Bank transfer shows the "No payment link is sent" hint, no Expiry, and the checkboxes read "Send booking confirmation via ...".
4. Switching status resets the method to that status default. A Confirmed booking never keeps Payment link.
5. The Business tab shows Company Name (required) and VAT / Tax ID. Saving with an empty Company Name is blocked and the field is marked.
6. On Business, the labels read Contact First Name, Contact Last Name and Billing Address. On Personal they read First Name, Last Name and Address.
7. Saving as Personal clears company name and tax id.
8. Creating a Confirmed booking records it as paid in full with the chosen method. Creating an Inquiry records nothing as paid.
9. The correct toast shows after create (with and without Payment link).

Reservation Details
10. A Business reservation shows the company name and tax id under the guest name. A Personal one shows neither.
11. An unpaid reservation shows Guest paid USD 0 and the Mark as paid... button.
12. The Mark as paid sheet offers Cash and Bank Transfer only and defaults Amount to the balance and Received on to today.
13. Invalid input shows an inline error under the field (red border and red text) and disables the Mark as paid button: amount above the balance ("Amount cannot be more than the balance, USD 750."), amount of 0 ("Enter an amount above 0."), a Received on date in the future ("Received on cannot be in the future.").
14. A part payment raises Guest paid, keeps the status Inquiry, keeps Mark as paid... and shows the "Partial payment recorded" toast.
15. Paying the full balance sets the status to Unverified, shows "Paid via <method> on <date>", hides Mark as paid... and shows the "Marked as paid" toast.
16. With an open payment link: the banner and Resend payment link show. Marking as paid in full warns first and cancels the link. A part payment leaves the link open.
17. When the guest pays through the link, the reservation shows "Paid via Payment link on <date>" and is Unverified.
18. Edit Reservation shows the Personal / Business tab with the saved values and keeps them on save.
19. All amounts use the format `USD 750` (ISO code, no symbol), per currency.

Price info
20. Collapsed, the summary shows the reservation code and Guest Paid with the current amount, on Reservation Details and on the calendar summary sheet. It replaces the old "Total Amount" line.
21. Expanding it shows the Guest Paid / Payout toggle. The Guest Paid view lists Subtotal (N nights), Cleaning fee, Tax and Guest paid.
22. Guest Paid in the header and in the breakdown update after every payment, and part payments add up.
23. The Payout view shows guest paid, commission and payout as on the web, per currency, with no conversion.

## Decisions
- Stage chip: an Inquiry shows the label **Inquiry**. A paid reservation shows Unverified.
- Toast copy as designed is approved, including the Bank Transfer and payment link messages.
- The Payment Details tab stays as it is for now. The Guest Paid card is the only place payment shows.
- Still open: the Payout view of the price info is not designed in Figma. It follows the web (guest paid, commission, payout) until design confirms.
- The Mark as paid rules (no future date, amount above 0 and not above the balance) apply on mobile too, and the error states are designed in Figma (A3a to A3c).
