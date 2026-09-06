# Design: Subscription Payment Failure Alert in the Dashboard Header

**Date:** 2026-09-05
**Module:** Layout (`app/components/layout/Header.vue`), Billing (`app/components/billing/`, `app/composables/useSubscriptionBilling.ts`)
**Status:** Implemented as mock, ready for review
**Related Jira:** PP-502 (dunning e-mails), PP-507 (send triggers, open decision on the day 4 to 6 gap), PP-504 (USD currency), PP-505 (`{{final_attempt_date}}`)

## TL;DR

When a tenant's subscription charge fails, billing retries the card once a day for seven days
and suspends the account on the seventh failure. Today the tenant learns this only by e-mail,
at two points in that window: day 3 and day 7. Between them are four silent days, and a tenant
who misses or filters the day 3 e-mail loses access with no warning at all.

This feature puts a persistent red bar in the dashboard header for the whole seven day window.
It names the amount, the attempt number, the reason, and the exact suspension date, and it
carries an **Update payment** button that opens a card form and settles the outstanding invoice
in place. It is not dismissible.

## Problem

PP-507 states the gap plainly: the tenant "gets a deliberately soft email on day 3 that never
mentions suspension, then four silent days, then loses access on day 7. There is no warning
anywhere in between."

PP-502 acceptance criterion 6 requires that "a tenant is warned about suspension at least once
before it happens." E-mail alone cannot guarantee that: it can be filtered, sent to a shared
inbox nobody reads, or land on a colleague who does not own the card.

The dashboard is the one surface the tenant demonstrably reaches, because they are logged into
it. A header bar that is present on every page for all seven days satisfies criterion 6 by
construction, for any tenant who logs in at least once during the window.

## Scope

### In Scope

- A red alert bar in the dashboard header, shown while subscription status is `payment_failed`
  or `suspended`, on every page of the tenant dashboard
- Copy naming: amount in USD, billing period, attempt number out of seven, short decline reason,
  and the suspension date
- Non-dismissible. An unpaid subscription is not something the tenant should be able to silence
- **Update payment** button opening a dialog with a card form (name, number, expiry, CVC)
- **Retry** action in the dialog for the card already on file, for a transient decline
- Success clears the failure, the bar disappears, and a toast confirms
- Mock state model persisted to LocalStorage, seeded on day 3 of the window so the bar is
  visible out of the box
- Mobile: the bar collapses to the headline plus the button

### Out of Scope

- Real payment provider integration. `updatePaymentMethod` and `retryPayment` are 1.2s mocks and
  no card data leaves the browser
- The dunning e-mails themselves. Those are PP-502 and PP-507
- A billing settings page (`/settings/billing`) with invoice history and card management. The
  dialog covers the one action the bar promises, nothing more
- Feature gating or read-only mode once suspended. The bar explains the suspension, it does not
  enforce it
- Per-role visibility. Anyone who can see the dashboard sees the bar
- The platform-console side. `TenantBillingTab.vue` still renders its own hardcoded invoice list

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Placement | Inside the header's sticky container, below the header row | It stays on screen while scrolling. Placing it in the page body would let the tenant scroll past the one message that matters |
| Dismissible | No | The consequence is losing access. A dismissed bar is an unwarned tenant, which is what criterion 6 exists to prevent |
| Show attempt number | Yes, "attempt 3 of 7" | Tells the tenant this is a repeated, escalating failure and not a one-off blip, without them having to read the e-mail |
| Show a date or a countdown | The date, "before 9 September" | A date is unambiguous and matches `{{final_attempt_date}}` in the e-mails. "4 days" drifts against the reader's timezone and their idea of when the day ends |
| Amount format | `USD 899` | PP-504 fixed 42 CHF occurrences across the e-mail templates. The in-app copy has to agree, and a bare `$` is the same ambiguity in a different font |
| Currency in the model | `amountUsd`, no currency field | Billing is always USD. A currency field would invite a second currency back in |
| Where the CTA leads | A dialog, in place | The bar's promise is "update your payment method". A route change to a settings page adds a step and a page to build for the same outcome |
| Suspended state | Same bar, different copy | A second component for the same fact in a different tense is two places to keep in sync |
| Reason wording | Long form in the dialog, short form in the bar | The bar has one line. "card expired" carries the same instruction as "The card on file has expired" |

## Relationship to the e-mail flow

The bar does not replace either e-mail, and it does not resolve the PP-507 decision on whether
e-mail 5b gets a day 5 or 6 slot. It changes what that decision costs.

| Day | Billing | E-mail (PP-502) | Header bar |
| --- | --- | --- | --- |
| 1 | First failure | none | shown, attempt 1 of 7 |
| 2 | Retry fails | none | shown, attempt 2 of 7 |
| 3 | Retry fails | e-mail 5, soft, no suspension wording | shown, attempt 3 of 7, names the suspension date |
| 4 to 6 | Retries fail | none, pending PP-507 | shown, attempt 4 to 6 of 7, names the suspension date |
| 7 | Final failure, suspended | e-mail 5c | shown, suspended copy |

The bar names the suspension date from day 1, which is the consequence line e-mail 5
deliberately omits. For a tenant who logs in, the four silent days are no longer silent. For a
tenant who never logs in, the PP-507 decision is still the only thing standing between them and
an unannounced suspension, so that decision should still be made on its own merits.

## Data model

`app/components/billing/data/subscription-billing.ts`, framework free, matching the
`data/*.ts` convention used elsewhere in the codebase.

```ts
export type SubscriptionBillingStatus = 'active' | 'payment_failed' | 'suspended'

/** Billing retries a failed charge once a day for seven days, then suspends (PP-502). */
export const DUNNING_WINDOW_DAYS = 7

export interface FailedInvoice {
  id: string
  number: string
  amountUsd: number
  periodLabel: string
  dueDate: string
  firstFailedAt: string   // day 1 of the window
  attempts: number        // failed daily attempts so far, 1 to 7
  declineReason: PaymentDeclineReason
}

export interface SubscriptionBilling {
  tenantId: string
  status: SubscriptionBillingStatus
  paymentMethod: BillingPaymentMethod | null
  failedInvoice: FailedInvoice | null
  nextRetryAt: string | null
  finalAttemptDate: string | null   // day 7 attempt, which is also the suspension date
  updatedAt: string
}
```

`finalAttemptDate` is deliberately named after the `{{final_attempt_date}}` merge field from
PP-505 rather than something like `gracePeriodEndsAt`. The date the bar prints and the date the
e-mail prints have to be the same date, and matching the name is the cheapest way to keep anyone
from introducing a second one.

`PaymentDeclineReason` is one of `card_expired`, `insufficient_funds`, `card_declined`,
`authentication_required`, with two label maps: `declineReasonLabels` for the dialog and
`declineReasonShort` for the bar's single line.

### Seed

The mock seeds the current tenant (`t-1`, Bali Villas Co., USD 899/month) at **day 3 of 7**:
three failed attempts, the day 3 e-mail just sent, next retry tomorrow, suspension in four days.
That is the most informative point in the window to demo, because both the attempt count and the
deadline are non-trivial.

## Composable

`app/composables/useSubscriptionBilling.ts`, `useState` plus LocalStorage, the same shape as
`useSmartLock` and `useTenantBranding`.

| Export | Purpose |
| --- | --- |
| `billing` | the `SubscriptionBilling` state |
| `isPaymentFailed`, `isSuspended` | status predicates |
| `needsPaymentUpdate` | either of the above, what the bar renders on |
| `daysLeft` | whole days to `finalAttemptDate`, 0 once the window has passed |
| `isProcessing` | drives the spinners on both dialog actions |
| `updatePaymentMethod(input)` | 1.2s mock, saves the card and settles the invoice |
| `retryPayment()` | 1.2s mock, re-charges the card on file |
| `simulatePaymentFailure()` | demo helper, returns the tenant to day 3 of the window |

A card ending `0002` always declines, so the error path inside the dialog stays demoable without
editing state by hand.

The storage key is versioned (`elev8-subscription-billing-v2`). The shape changed once during
implementation, and an unversioned key would have rehydrated the old shape into a bar with no
deadline.

## Components

### `LayoutBillingAlertBar` (`app/components/layout/BillingAlertBar.vue`)

The bar. Renders nothing unless `needsPaymentUpdate`. One `role="alert"` row: an
`lucide:octagon-alert` icon, the headline plus detail, and the **Update payment** button. Uses
the `destructive` token family, never a hardcoded red, so it holds up in dark mode.

The detail sentence is hidden below the `sm` breakpoint. On a phone the bar reads
"Payment failed:" plus the button, which is the whole instruction.

### `BillingUpdatePaymentDialog` (`app/components/billing/UpdatePaymentDialog.vue`)

A `Dialog` with the outstanding invoice summarised at the top (period, amount, invoice number,
decline reason, card), then the card form. Card number is formatted in groups of four as typed
and the brand is detected from the prefix. Expiry is masked to `MM/YY`. The footer carries
**Retry {card on file}** on the left and **Save and pay** on the right, the primary action
disabled until the form is valid.

### `LayoutHeader` (changed)

The header row and the bar now share one sticky, rounded container, so the alert is pinned with
the header rather than scrolling away with the page.

## Copy

Day 3 of 7, the seeded state:

> **Payment failed:** USD 899 for September 2026 could not be collected (attempt 3 of 7, card
> expired). Update your payment method before 9 September to avoid suspension.

Final day:

> **Payment failed:** USD 899 for September 2026 could not be collected (attempt 7 of 7, card
> expired). Today is the final attempt. Your account is suspended if it fails.

Suspended:

> **Account suspended, payment overdue:** USD 899 for September 2026 is still unpaid (card
> expired). Update your payment method to restore access.

No em dashes, per the house style already applied to the payment e-mail templates in PP-502.

## Edge cases

| Case | Behavior |
| --- | --- |
| Status is `active` | The bar does not render and the header keeps its current height |
| No payment method on file | The bar still shows. The dialog drops the Retry button and offers only the card form |
| `finalAttemptDate` is null | The deadline clause is omitted. The bar still names the amount and the attempt count |
| Deadline has passed but status is still `payment_failed` | `daysLeft` is 0 and the copy switches to the final-attempt wording |
| Retry succeeds | Status goes `active`, the bar disappears, a toast confirms |
| New card declines | The card is saved, status stays `payment_failed`, an inline destructive error shows in the dialog and the bar stays up |
| Tenant already had v1 state in LocalStorage | The key bump to v2 discards it and reseeds |
| Narrow viewport | Detail sentence hides below `sm`, headline and button remain |

## Testing

Not yet written. Proposed `tests/composables/useSubscriptionBilling.spec.ts`:

- `daysUntilSuspension` returns whole days, 0 once `finalAttemptDate` has passed, null when unset
- `updatePaymentMethod` with a normal card clears the failure and sets status `active`
- `updatePaymentMethod` with a card ending `0002` keeps status `payment_failed` and returns an error
- `retryPayment` with no card on file returns an error rather than throwing
- `formatUsd` prefixes `USD` and never emits `$` or `CHF`
- `simulatePaymentFailure` restores a day 3 state

Proposed `tests/components/layout/BillingAlertBar.spec.ts`:

- Renders nothing when status is `active`
- Renders the attempt count and the deadline date when `payment_failed`
- Switches to the suspended copy when `suspended`
- Has no dismiss control

Nuxt auto-imported children must be registered in `global.components` to render under Vitest,
per the existing test setup.

## Open questions

1. **Should the bar also appear in the Owner Portal?** Owners are not the paying party, so the
   current answer is no, but a suspended tenant means a dead portal for the owner too.
2. **Should a suspended tenant be locked out of anything?** Today the bar is informational. If
   suspension is meant to actually gate the product, that is a separate story.
3. **Per-role visibility.** A Guest Relations user seeing a billing failure they cannot act on
   is arguably noise. Scoping it to Admin would mean a tenant whose only admin is on leave gets
   no in-app warning at all, which is the failure mode this feature exists to remove.
4. **Does the bar count as the "warned at least once" evidence for PP-502 criterion 6?** Only
   for tenants who log in during the window. It should not be treated as a reason to close the
   PP-507 decision without a mid-window e-mail.
