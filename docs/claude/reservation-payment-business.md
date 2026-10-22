# Reservation payment method and Business contact

PRD: `docs/prd-reservation-payment-method-business-contact.md`. Screenshots: `docs/prd-assets/`.

## Files

| File | Role |
|---|---|
| `app/components/reservations/NewReservationDialog.vue` | Payment method select (Status and Source), Personal/Business tabs (Contact Details), builds the `ReservationEntry` on save |
| `app/components/reservations/EditReservationDialog.vue` | Same Business tab and company fields, no payment method |
| `app/components/reservations/data/new-reservation-validation.ts` | `isBusiness` + `companyName` rule, `firstInvalidField` order, section to open |
| `app/components/reservations/data/reservations.ts` | `ContactType`, `ReservationPaymentMethod`, `reservationPaymentMethodLabels`, `manualPaymentMethods`, `ReservationEntry` fields |
| `app/components/reservations/ReservationDetailSheet.vue` | Company line in the header, "Paid via" strip, Mark as paid box |
| `app/composables/useReservationsModule.ts` | `markReservationPaid(id, method, opts)` |
| `tests/components/reservations/NewReservationPaymentFlow.spec.ts` | Source-reading spec for the wiring |

## Data

`ReservationEntry`: `paymentMethod?: 'payment_link' | 'bank_transfer' | 'cash'` (unset = payment link), `paidAt?: string`, `contactType?: 'personal' | 'business'`, `companyName?`, `companyVatId?`.

## Rules

- `manualPaymentMethods = ['bank_transfer', 'cash']`. Confirmed uses only these; Inquiry adds `payment_link`. A `watch(status)` resets the method: inquiry to `payment_link`, otherwise `payment_link` falls back to `bank_transfer`.
- `sendsPaymentLink = status !== 'inquiry' || method === 'payment_link'`. Only then is `inquiryExpiryHours` saved and the expiry field shown. `showInboxOption` is Inquiry + link only.
- A confirmed save sets `paidAt = now` and `priceDetails.guestPaid = totalPrice`. An inquiry sets `paidAt` undefined and `guestPaid = 0`.
- Business save writes `companyName` (trimmed) and `companyVatId` (only when non-empty). Personal writes `undefined` for both, so a switch back clears them.
- Business labels: "Contact First/Last Name", "Billing Address". The `companyName` field is `data-field="companyName"` so the scroll-to-error works.
- ⚠️ `markReservationPaid` returns false when `paidAt` is already set, the balance is 0, the amount exceeds the balance, or `paidOn` is in the future. It cancels the open payment request (`linkCancelled`) and logs `reservation-paid` or `reservation-part-paid`. Mark as paid never offers `payment_link`.
- ⚠️ `paidAt` is only set once settled in full. A part payment raises `guestPaid` and leaves `paidAt` unset, so the "Paid via" strip appears only when fully paid.
- A part payment still records `paymentMethod`. A full payment on an Inquiry moves it to `unverified`.
- Paid means **Unverified** status, never Verified.
- Only the folio writes `priceDetails.extras`; this feature touches `guestPaid` and `paymentMethod`/`paidAt` only.

## Detail sheet

- Header company line shows when `contactType === 'business' && companyName`, with `· companyVatId` when present.
- "Paid via X on <date>" (`data-testid="paid-via"`) shows when `paidAt && paymentMethod`. The Mark as paid box (`data-testid="mark-paid"`) shows while there is a balance.

## Testing

- Dialog and sheet are too heavy to mount; `NewReservationPaymentFlow.spec.ts` reads their source and asserts the wiring. Keep the `data-testid` and `data-field` names stable.
