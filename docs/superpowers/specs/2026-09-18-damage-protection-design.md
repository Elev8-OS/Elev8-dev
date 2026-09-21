# Damage Protection Design (Waiver or Deposit)

> Date: 2026-09-18
> Status: Draft, pending approval
> Module: Guest Guide (guest choice), Reservations (new `damage-protection` surface),
> Settings (new policy library), Notification Center

## Problem

Something breaks. Who pays, and out of what?

Today the dashboard has no answer. `BookingWidgetConfig.depositPct` exists but means a
partial payment of the booking price, which is a different thing entirely. There is a
`DEPOSIT_FAILED_AT_CHECKIN` alert type in `alerts.ts` that nothing ever emits, because
there is no deposit to fail.

The operator wants to offer the guest a choice: a small non-refundable **damage waiver**,
or a refundable **security deposit**. The commercial hope is that most guests take the
waiver, which converts better and is more profitable. The risk is that a badly designed
deposit option is *cheaper than the waiver from the guest's point of view*, at which
point nobody buys the waiver and the operator carries every loss.

## Goal

**The guest makes one informed choice before arrival, and the operator is never left
holding an uncovered loss or an unreturned deposit.**

Two halves, and both must work:

1. The choice is real. Both options are honestly priced and honestly described, and the
   waiver wins on its merits rather than through hidden friction.
2. Money that belongs to the guest goes back to the guest, on a stated SLA, chased by a
   worklist when it does not.

## The decision this spec makes, and why

The obvious implementation is a card pre-authorization hold for the deposit. **It does
not work, and this spec deliberately does not build it.** Research on the three gateways
already modelled in `payouts.ts`:

| | Pre-auth hold | Max hold | Card-on-file / charge later |
|---|---|---|---|
| Stripe | Yes | 7 days; up to 31 with extended authorization (Visa/MC/Amex/Discover, IC+ pricing, on request) | Yes, SetupIntent + off-session MIT |
| Xendit | Yes (`capture: false`) | ~7 days, single capture only, no multiple partial captures | Yes, MULTIPLE_USE token + `card_on_file_type: RECURRING` |
| Doku | Yes ("Authorize & Capture") | Acquirer-dependent, unconfirmed | Unconfirmed on our MID |

Three findings drive the design:

1. **A hold cannot span a stay.** Seven days does not cover a two-week booking plus a
   post-checkout damage window, and the 31-day Stripe extension exists on neither of the
   other two gateways.
2. **A hold silently excludes most of the Indonesian market.** A manual-capture card
   session cannot offer QRIS, virtual account or e-wallet. A deposit-by-hold is therefore
   credit-card-only, in a market that mostly does not pay by credit card. That is not a
   choice, it is a broken option presented as a choice.
3. **A card kept on file is the operator's most expensive path, not the cheapest.**
   Charging a stored card for damage after checkout is the most disputed transaction type
   in hospitality. Every dispute costs a fee, staff time and review risk.

> ⚠️ **The deposit is a real charge that is really refunded.** Not a hold, not a stored
> card. It works on every payment method, it carries no post-stay dispute exposure
> because the money is already collected, and it is the only version of the deposit that
> makes the waiver attractive without inventing artificial friction. Do not "optimise"
> this back into an authorization hold: every gateway above will accept the API call, and
> the feature will quietly stop working for most guests.

> ⚠️ **Card-on-file is a risk control, never a guest-facing option.** It may be captured
> as a fraud backstop on flagged bookings regardless of which option the guest chose. The
> moment it appears on the choice screen it becomes the free option and the waiver dies,
> which is the exact failure this spec exists to prevent.

> ⚠️ **It is a waiver, not insurance.** Underwriting or distributing insurance in
> Indonesia requires OJK licensing. What is sold here is a contractual waiver: the host
> waives the guest's liability for accidental damage up to a cap, funded by a
> non-refundable fee. Every type, label, field and string says `waiver`. Do not introduce
> the word `insurance` anywhere in the code or the UI.

## What already exists

- `ReservationEntry` (`app/components/reservations/data/reservations.ts`) already carries
  `channel: BookingChannel`, `priceDetails: PriceDetails`, `folioItems?: FolioItem[]`,
  `cityTaxSettlement?: CityTaxSettlement` and an activity event list.
- `CityTaxSettlement` is the precedent this feature copies most closely: **status derived
  on every read, only the settlement stored, totals frozen at settlement time.**
- `useReservationFolio` and `data/folio.ts` establish the house split: a pure,
  framework-free rules module plus a composable owning reactive state and calling in.
- `usePaymentRequests` + `payment-request/data/payment-requests.ts` already model a
  guest-facing charge against a `payoutAccountId`, with `feeMode`, `currency` and a
  `pending -> paid | expired | cancelled` lifecycle.
- `payouts.ts` models `PayoutProvider = 'stripe' | 'doku' | 'xendit'` with per-listing
  `listingIds` assignment. That is how a deposit knows which rail to charge on.
- `/settings/cancellation-policies` is the closest sibling surface: a library of
  per-listing commercial policies. The new settings page is modelled on it.
- Guest Guide: `GuideSectionType`, `GuideSection`, `GuestGuideLink` (token-addressed),
  `GuideSubmission`, the public `server/api/guest-guides/by-token/[token]` endpoints, and
  `guide-app/app/components/forms/` where `PreArrivalForm.vue` and `IdVerificationForm.vue`
  already live.
- **`DEPOSIT_FAILED_AT_CHECKIN` already exists** in `alerts.ts` (label "Security Deposit -
  Payment Failed", icon `i-lucide-credit-card`, description built from `guest_name`,
  `currency` and `deposit_amount`) and is already listed in `FINANCE_TYPES`. It is
  currently emitted by nothing. This feature is its first emitter. Only its
  `alertRouteMap` entry changes, from `/inbox` to the new worklist.

The gap is the policy, the choice, and the money going back.

## Data model

### 1. The policy is a library, assigned to listings

Its own store, not fields on `Listing`, for the same reason `useOwnerPayoutDetails` is its
own store: one commercial policy is written once and applied to many properties, and "this
listing has no policy" is a real state the guest guide has to be able to report.

```ts
export type ProtectionOption = 'waiver' | 'deposit'
export type WaiverPricing = 'flat' | 'per_night' | 'percent_of_subtotal'
export type DepositPricing = 'flat' | 'percent_of_subtotal'

export interface DamageProtectionPolicy {
  id: string
  name: string
  currency: 'USD' | 'IDR' | 'EUR' | 'CHF'

  /** Which options this policy offers. At least one. Order is display order. */
  offers: ProtectionOption[]
  /** Pre-selected on the guest screen. Must be in `offers`. */
  defaultOption: ProtectionOption

  waiver: {
    pricing: WaiverPricing
    /** Amount or percent, read according to `pricing`. */
    rate: number
    /** Ceiling on a per_night or percent result. Required for any band above 27 nights. */
    maxAmount?: number
    /** Maximum accidental damage covered per stay. The number the guest is buying. */
    coverageCap: number
    /** Damage types the waiver does not cover, shown verbatim to the guest. */
    exclusions: string[]
  }

  deposit: {
    pricing: DepositPricing
    rate: number
    /** Ceiling on a percent result. Without it a 90-night stay computes an unbounded deposit. */
    maxAmount?: number
    /** Days before check-in the charge is attempted. */
    chargeLeadDays: number
    /** Days after check-out by which the refund must be issued. Stated to the guest. */
    refundSlaDays: number
  }

  /** Per channel: offer the choice, or skip it entirely. Unset falls back to 'skip'. */
  channelPolicy: Partial<Record<BookingChannel, 'offer' | 'skip'>>

  /** Frozen onto the reservation when a guest accepts. Bump on any wording change. */
  termsVersion: string
  termsText: string

  createdAt: string
  updatedAt: string
}

/**
 * A listing carries one policy PER STAY-LENGTH BAND, not one policy. Bands must
 * not overlap; `maxNights: null` is the open-ended top band.
 */
export interface DamageProtectionAssignment {
  listingId: string
  policyId: string
  minNights: number
  maxNights: number | null
}

// useDamageProtection: policies: DamageProtectionPolicy[]
//                     assignments: DamageProtectionAssignment[]
```

> ⚠️ **`channelPolicy` falls back to `'skip'`, the opposite of the city tax default.**
> City tax over-alerts because a missed collection is a loss. Here the opposite is true:
> Airbnb and Booking.com carry their own guest damage programmes, so charging an OTA guest
> a second time for the same cover is a chargeback and a one-star review. An unconfigured
> channel must stay silent. Do not unify these two fallbacks because they look alike.

> ⚠️ **`termsVersion` and `termsText` exist to be frozen, not to be read live.** What
> defends a deduction is the exact wording the guest agreed to, on the day they agreed.

### 2. What the reservation stores

One optional field, so nothing seeded migrates.

```ts
export type ProtectionState =
  | 'awaiting_choice'      // offered, guest has not answered
  | 'waiver_active'        // waiver fee collected
  | 'deposit_pending'      // chosen, charge not yet attempted
  | 'deposit_failed'       // charge attempted and declined
  | 'deposit_held'         // money collected, stay in progress
  | 'deposit_released'     // refunded in full
  | 'deposit_partial'      // refunded minus an itemised deduction
  | 'deposit_forfeited'    // deduction consumed the whole deposit
  | 'refund_failed'        // the refund itself was rejected
  | 'cancelled_refunded'   // stay cancelled, everything collected was returned

export interface ProtectionRefundDestination {
  /** Required when the deposit was collected on a non-card rail. */
  method: 'original_payment_method' | 'bank_transfer'
  accountName?: string
  accountNumber?: string
  bankName?: string
}

/**
 * One damage incident. Recorded on BOTH paths, which is the point: on a deposit
 * it drives the deduction, on a waiver it records what the pot paid out. Without
 * the waiver-side record there is no way to tell whether the fee is priced right,
 * and the fee is the whole commercial bet.
 */
export interface ProtectionClaim {
  id: string
  label: string
  /** The full assessed damage. */
  amount: number
  /** What the protection absorbed: off the held deposit, or out of the waiver pot. */
  coveredAmount: number
  /** amount - coveredAmount. Staff post this to the folio BY HAND, never automatically. */
  excessAmount: number
  reason: string
  /** Photo or document evidence. Mock paths, same shape as GuestDocument.url. */
  evidenceUrls: string[]
  recordedBy: string
  recordedAt: string
  /** When the guest was told. A deposit cannot be released while this is unset. */
  guestNotifiedAt?: string
}

export interface DamageProtection {
  policyId: string
  option: ProtectionOption
  state: ProtectionState

  /** Frozen at acceptance. A later policy edit can never rewrite what was agreed. */
  amount: number
  currency: string
  coverageCap?: number          // waiver only
  termsVersion: string
  termsText: string
  acceptedAt: string
  acceptedVia: 'guest_guide' | 'staff'

  chargeDueAt?: string
  chargedAt?: string
  payoutAccountId?: string
  failureReason?: string
  failedAttempts?: number

  refundDueAt?: string
  refundedAt?: string
  refundedAmount?: number
  refundDestination?: ProtectionRefundDestination

  claims?: ProtectionClaim[]

  refundFailureReason?: string
}

// ReservationEntry.damageProtection?: DamageProtection
```

> ⚠️ **The amount is frozen at acceptance, like a folio catalog pick and like a city tax
> settlement.** `amount`, `coverageCap`, `termsVersion` and `termsText` are copied from the
> policy at the moment the guest agrees. `policyId` is provenance, never a live join.

> ⚠️ **`refundDestination` is not optional in practice on Indonesian rails.** A QRIS,
> virtual account or e-wallet payment frequently cannot be reversed to source, so the
> refund needs bank details from the guest. Collect them **on the choice screen, at the
> moment the guest picks deposit**, not at checkout when they have stopped reading
> messages. On a card payment the default is `original_payment_method` and no fields are
> shown.

> ⚠️ **Nothing here writes `priceDetails`.** Two separate reasons, both real:
> - The deposit is guest money held, not revenue. It must never reach `guestPaid`,
>   `payout` or an owner statement, exactly like city tax.
> - The waiver fee *is* revenue, but `useReservationFolio.commit()` **replaces**
>   `priceDetails.extras` outright rather than adding to it. A second writer would be
>   silently wiped by the next folio posting. If the waiver fee must appear in revenue,
>   it goes in as a folio item through `useReservationFolio`, never by patching `extras`
>   directly.

> ⚠️ **No currency conversion, ever.** The policy currency is the deposit currency and the
> refund currency. A listing whose payout account settles in another currency keeps its own
> number and says so, the same rule as the folio, city tax and owner statements.

### 3. Damage above the cap is a folio item, not a new mechanism

The folio already is the "charge this guest extra" surface, with pricing, payment state,
void-with-reason and an audit line. So:

Every incident is recorded as a `ProtectionClaim` on **both** paths. What differs is the
consequence:

- **Waiver path**: the covered part costs the guest nothing and the operator absorbs it. The
  claim is still written, because `waiverPotTotal` is the only signal that says whether the
  fee is priced right.
- **Deposit path**: the covered part comes off the held money as a deduction.
- **Both paths**: the excess above the cover is *reported* by `claimCoverage`, and staff post
  it to the folio by hand. Deciding a guest owes more than they agreed to cover is a
  judgement call, never an automatic consequence.

That keeps one money story per stay and avoids a second half-built charging flow.

## Lifecycle edges, and who may act

Six rules that the first version of this spec left open. Each of them is reachable on the
seeded demo data, so none is theoretical.

### A stay is not always a guest stay

`ReservationStatus` includes `blocked` and `owner_request`, and both are `channel: 'Direct'`,
the one channel set to `'offer'`.

> ⚠️ **Protection is gated on status as well as channel.** Without it, an owner is asked to
> buy a waiver to stay in their own villa and a maintenance block is asked to pay a deposit.
> `GUEST_STAY_STATUSES` is `inquiry | unverified | verified | checked_in | checked_out`;
> everything else is `not_offered`, whatever the channel policy says.

### Cancellation returns everything

`resolveBucket` reads `reservation.status`. A cancelled stay with money collected becomes
`refund_due` **immediately**, regardless of the check-out date, and
`cancelProtection(reservationId)` returns the full amount and lands `cancelled_refunded`.

> ⚠️ **A cancellation refunds in full, on both paths, and no claim may be recorded against
> it.** No stay happened, so no damage did. This deliberately does not reuse the graduated
> refund ladder in `upsells/data/cancellation-policies.ts`: that ladder prices a service the
> operator held capacity for, while a deposit is the guest's own money and a waiver bought
> cover for a stay that never began. A no-show against a non-refundable rate is a folio
> charge, never a deposit deduction.

Two second-order effects: a cancelled stay in `deposit_pending` must not charge on its lead
date, and a cancelled stay must drop out of the worklist's chase buckets rather than sitting
in "Refund overdue" forever.

### The guest is told before the money is kept

A deduction the guest first learns about from a smaller refund is a chargeback.

> ⚠️ **`releaseDeposit` refuses while any claim has no `guestNotifiedAt`.** `canRelease`
> returns `{ ok: false, reason: 'claim_not_notified' }` and the section renders **Notify
> guest** before it renders **Release deposit**. The notice carries the line, the amount, the
> reason and the evidence, into `order.conversationId`-style inbox threading. The operator
> can still release after notifying immediately; what they cannot do is keep money the guest
> was never told about.

> ⚠️ `notifyGuestOfClaim` reaches the inbox through a **dynamic** `import('./useInbox')`.
> `useInbox` imports `useUpsellOrders`, which imports this module's sibling; a static import
> closes a cycle. Same rule, and same reason, as `useUpsellLockAccess.messageGuest`.

### A refund can fail

Closed card, wrong bank details, provider rejection. `refund_failed` carries
`refundFailureReason`, raises `DEPOSIT_REFUND_FAILED` (CRITICAL) and offers a retry plus an
edit of `refundDestination`. Without it a failed refund reads as a completed one, which is
the worst possible way to lose a guest's money.

### Moving money is its own permission

`ModulePermissions` is `dashboardView / dashboardEdit / mobileView / mobileEdit` per module,
so without a change, recording a USD 500 deduction sits behind the same flag as editing a
guest's phone number.

> ⚠️ Add `damage_protection` to `PermissionModule`. `dashboardView` gates the worklist and
> the reservation section; **`dashboardEdit` gates recording a claim and releasing a
> deposit**. Reading a stay must not imply the right to take money from it.

### Nobody chose

The 24h alert fires and then the guest arrives anyway. There is no automatic fallback,
because a fee cannot be charged against terms nobody accepted.

> The resolution is the desk: `awaiting_choice` stays in the worklist through check-in, and
> the reservation section leads with **Record choice for guest** so whoever is standing there
> can settle it in one dialog. State this rather than leaving the state a dead end.

### Two assignments that must agree

A policy assigned to `lst-5` does nothing unless the guest guide covering `lst-5` also has a
`damage_protection` section enabled. `GuestGuide.assignedListingIds` and the policy
assignment are independent lists, and today the mismatch fails **silently**: the guest simply
never sees a choice screen.

> The settings panel renders a warning naming every listing that has a policy but no guide
> section, with a link to the guide. A silent no-op on a money feature is not acceptable.

### Currency is checked where it is assigned

The policy declares USD; the listing's Doku account settles IDR.

> ⚠️ `assignBand` **refuses** when the policy currency differs from the listing's payout
> account currency, returning that as the reason. "No conversion, ever" says what not to do;
> this says where it is prevented. The check belongs at assignment, not at charge time, when
> a guest is already waiting.

## Long stays

The product sells them: `ListingPricing.monthlyDiscount` runs 15 to 20 percent and
`LengthOfStayDiscount` exists on every rate plan. A one-week booking and a three-month
booking are not the same risk, and treating them as one policy breaks in four places at
once. **A long stay is a different product, not a longer short stay.**

### The threshold and the bands

`LONG_STAY_THRESHOLD_NIGHTS = 28`, below a calendar month so a "monthly" booking lands
above it. A listing carries one policy per band, so a short-stay policy and a long-stay
policy sit side by side and `policyFor(listingId, nights)` picks between them.

> ⚠️ **Bands live on the assignment, not as price tiers inside one policy.** What differs
> across the threshold is not only the price: the exclusions differ, the terms text
> differs, the refund SLA differs, and the offered options may differ. Tiering the price
> inside one policy means every other field eventually needs tiers too.

### What each of the four broken assumptions needs

**1. Pricing.** A flat USD 39 under-prices ninety nights; `per_night` at the same rate
computes USD 3,510. Long-stay bands use a **banded flat price** (for example 28+ nights at
USD 249 with a USD 5,000 cap), and any `per_night` or `percent_of_subtotal` rate in a band
above 27 nights must carry `maxAmount`.

> ⚠️ **Do not build a recurring monthly waiver charge.** It is a subscription subsystem, and
> it introduces a state nothing else in this design has: a renewal that fails in month four,
> with a guest in the property who believes they are covered. A banded flat price collects
> once and cannot fail halfway.

**2. Coverage cap.** A fixed USD 2,000 is thin over three months. The cap is per band, and
a long-stay band sets its own.

**3. Wear and tear, which is the real risk.** Over three months a mattress, linens, paint
and AC filters deteriorate normally. That is not accidental damage, no waiver covers it,
and on a short stay it never comes up. On a long stay it is the argument the operator will
actually have. Two mitigations, both required on a long-stay policy:

- `exclusions` must name normal wear and tear explicitly, rendered verbatim to the guest.
- The recurring cleaning schedule that already exists (`ReservationCleaningSchedule`,
  `custom` frequency by day or week) is the **inspection point**. Deterioration gets
  documented as it happens rather than discovered at check-out against a guest who has
  already left.

**4. Holding the money for months.** `recordClaim` is already allowed throughout
`deposit_held`, so a long stay can take deductions at each inspection with no model change.
The guest-facing copy on a long-stay band must say so: deductions may be taken during the
stay, not only at the end.

### Extending a stay across the band boundary

A guest extends from 20 nights to 40. The frozen protection was priced in the short band.

> ⚠️ **Extension across a boundary re-opens the choice for the added period. It never
> silently re-prices the original one.** The existing freeze stays valid for the nights it
> was agreed for, exactly as a folio catalog pick survives a later price change. A new
> acceptance covers the extension, and both are visible on the reservation.

### The legal flag, which gates the deposit

Holding a deposit across a month-plus stay starts to resemble a **tenancy deposit** rather
than a hospitality one. Elev8 operates in Bali, Germany and Switzerland, and the German and
Swiss regimes treat rental deposits very differently from hospitality ones: segregated
accounts, interest, and caps expressed in months of rent. Where exactly the line falls in
each market is a question for counsel and this spec does not guess at it.

> ⚠️ **Until that answer exists, a band above the threshold should offer the waiver only.**
> `offers: ['waiver']` on the long-stay policy is a one-field change, it is the option the
> operator wants chosen anyway, and it means no long-stay deposit is held before anybody
> has checked whether it may be.

## Pure module: `app/components/reservations/data/damage-protection.ts`

Framework-free, like `folio.ts` and `city-tax.ts`.

- `protectionOffered(policy, channel): boolean` and the `'skip'` fallback.
- `waiverAmount(policy, reservation)` / `depositAmount(policy, reservation)`. Percent
  pricing reads `priceDetails.subtotal`, never the grand total, so the guest is not charged
  a deposit on the cleaning fee.
- `buildOptions(policy, reservation)` returns the two priced options plus their copy, so the
  guest screen and the staff sheet render the same numbers from one function.
- `chargeDueAt(reservation, policy)`: check-in minus `chargeLeadDays`, clamped to now when
  a booking is made inside that window.
- `refundDueAt(reservation, policy)`: check-out plus `refundSlaDays`.
- `resolveProtectionState(protection, now)`: the derived worklist bucket.
- `deductionTotal(deductions)`, `refundableAmount(protection)` computed independently of one
  another, the lesson from `buildFolioSummary`: never sign-branch one gross figure on
  another.
- `isChoiceValid(draft, policy)`: terms accepted, and bank fields present when the rail
  requires them.
- `isClaimValid(draft)`: label, positive amount, reason, at least one evidence file. It
  deliberately does **not** cap the amount at the remaining cover: a claim records the real
  assessed damage and `claimCoverage` decides how much of it is absorbed.
- `canRelease(protection)`: refuses while any claim lacks `guestNotifiedAt`.
- `protectionActivityEvent(kind, protection)`, mirroring `folioActivityEvent`.

> ⚠️ `protectionActivityEvent` derives its `id` from the **normalised** state, not the raw
> argument, the same bug already documented for `folioActivityEvent`.

## Composable: `app/composables/useDamageProtection.ts`

Owns `policies`, `assignments` (both `useState` + LocalStorage, guarded on
`typeof localStorage`, never `import.meta.client`) and reads reservations through
`useReservationsModule`.

Reads: `policyFor(listingId)`, `optionsFor(reservationId)`, `protectionFor(reservationId)`,
`stateFor(reservationId)`, worklist buckets `awaitingChoice`, `chargeDue`, `failed`,
`refundDue`, `refundOverdue`, `settled`, and per-currency `heldTotal` / `refundedThisMonth`.

Writes: `recordChoice(reservationId, draft)`, `chargeDeposit(reservationId)` (1.5s mock
against the listing's payout account), `retryCharge`, `recordClaim`, `removeClaim`,
`notifyGuestOfClaim`, `cancelProtection`, `retryRefund`,
`releaseDeposit(reservationId)`, `undoSettlement(reservationId)`,
`emitProtectionAlerts()`.

> ⚠️ **Every action patches the protection object and its `ActivityEvent` in one
> `updateReservation` call**, so a charge and its audit line can never land apart. Same rule
> as the folio.

> ⚠️ **`useDamageProtection` never writes to `useReservationFolio`.** Excess damage is
> posted by staff through the folio UI, deliberately, because deciding that a guest owes
> more than they agreed to cover is a judgement call and not an automatic consequence.

## Guest surface: the choice screen

New `GuideSectionType: 'damage_protection'`, rendered by
`guide-app/app/components/sections/DamageProtectionSection.vue` wrapping
`guide-app/app/components/forms/DamageProtectionForm.vue`.

Two cards, the policy's `defaultOption` pre-selected, each stating what it actually means:

- **Damage waiver, USD 39.** Covers accidental damage up to USD 2,000. Non-refundable.
  Pay with any method. Confirmed immediately.
- **Security deposit, USD 500.** Charged 3 days before arrival. Refunded within 7 days of
  check-out. You remain responsible for damage above USD 500.

Then the exclusions list verbatim, the terms text with an explicit acceptance checkbox, and
the refund-destination fields when deposit is selected on a non-card rail.

> ⚠️ **The comparison is stated in exposure, not in outlay.** The deposit costs more
> because the money genuinely leaves the guest's account for a fortnight, and because the
> liability above the deposit stays with them. That is the whole argument for the waiver and
> it needs no nudging, no dark pattern and no artificial fee. Do not add a "deposit handling
> fee" to tilt the choice: a real charge already tilts it.

Server: `POST /api/guest-guides/by-token/[token]/protection-choice.post.ts`, mirroring
`submit-id.post.ts`. `GuideSubmission` gains
`protectionChoice?: { option, acceptedAt, termsVersion }`.

> ⚠️ **The token identifies the reservation. The request body never names one.** Same
> access model as `saveForCurrentOwner` in `useOwnerPayoutDetails`: a public endpoint that
> cannot be talked into writing another booking's record, because it never accepts an id.

## Staff surfaces

**`ReservationDamageProtectionSection.vue`**, an accordion item in
`ReservationDetailSheet.vue` placed **directly after the city tax section**, so the sheet
reads price, folio, city tax, protection, top to bottom. Per state:

- `awaiting_choice`: which options were offered, how long until check-in, **Record choice
  for guest** (staff can answer on the phone, writing `acceptedVia: 'staff'`).
- `waiver_active`: fee, cap, exclusions, accepted date, terms version.
- `deposit_pending` / `deposit_held`: amount, when it charges or when it was charged, the
  refund due date, **Add deduction** and **Release deposit**.
- `deposit_failed`: the decline reason, attempt count, **Retry charge**, **Switch to
  waiver**.
- settled states: the arithmetic spelled out, deposit minus each itemised deduction equals
  refunded, plus **Undo**. Mis-clicks happen.

**`DamageProtectionStatusChip.vue`** in `ReservationTable.vue`: grey "No cover", amber
"Awaiting choice", blue "Waiver", blue "Deposit held", red "Charge failed", red "Refund
overdue", green tick when released, nothing when the channel is skipped.

**`/damage-protection` worklist.** Sidebar entry under Guest Registration
(`i-lucide-shield-check`, `new: true`). KPIs per currency: Awaiting choice, Charge due,
Failed, Refund due, Held now. Tabs match the buckets. Row click opens the reservation sheet,
so there is exactly one place the work gets done. Bulk **Release deposits** on row selection
using the `clearKey` checkbox pattern, because reka-ui `CheckboxRoot` ignores external
`:checked` changes after first render.

**`/settings/damage-protection`**, modelled on `/settings/cancellation-policies`: the policy
library, per-listing assignment, and a live preview of the guest choice screen so the
operator sees the two cards exactly as the guest will.

## Alerts

Reusing the one that already exists, plus four new types. **All five must be listed in
`FINANCE_TYPES` in `notification-settings.ts`**: roles build `enabledAlertTypes` from those
categories and `isAlertVisibleToUser` drops anything missing, so an uncategorised type is
invisible in the bell.

| Type | Severity | When |
|---|---|---|
| `PROTECTION_CHOICE_MISSING` | WARNING | 24h before check-in with no choice recorded |
| `DEPOSIT_FAILED_AT_CHECKIN` (exists) | CRITICAL | A deposit charge is declined |
| `DEPOSIT_REFUND_DUE` | WARNING | Refund SLA expires within 48h |
| `DEPOSIT_REFUND_OVERDUE` | CRITICAL | Refund SLA has passed |
| `DEPOSIT_REFUND_FAILED` | CRITICAL | The refund itself was rejected |
| `DAMAGE_CLAIM_RECORDED` | INFO | A claim is recorded, on either path |

> `DAMAGE_CLAIM_RECORDED` is named for the claim, not the deduction, because it fires on the
> waiver path too, where no money moves and the only consequence is the pot record.

Releasing a deposit resolves any live refund alert **directly rather than through
`dismiss()`**, because whether the current user can see an alert must not decide whether a
settled obligation keeps nagging everybody else. Same rule as city tax.

## Testing

- **`tests/lib/damage-protection.spec.ts`**: every pricing mode; percent read from
  `subtotal` and not the grand total; the `'skip'` channel fallback; `chargeDueAt` clamped
  for a booking made inside the lead window; `refundDueAt`; refundable and deducted totals
  computed independently; a deduction larger than the deposit rejected; choice validation
  requiring bank details only on non-card rails; terms acceptance required.
- **`tests/composables/useDamageProtection.spec.ts`**: acceptance freezes amount, cap and
  terms against a later policy edit; exactly one `updateReservation` call per action and it
  carries the activity event; a failed charge increments attempts and emits the alert; retry
  succeeds; release resolves the alert; undo restores `deposit_held`; worklist bucketing;
  per-currency totals never blended; nothing writes `priceDetails` or the folio.
- **`tests/components/reservations/ReservationDamageProtection.spec.ts`**: each render
  state; the release arithmetic line; a skipped channel renders nothing; the failed state
  renders both Retry and Switch to waiver.
- **`tests/components/guest-guides/DamageProtectionForm.spec.ts`**: both cards priced from
  one `buildOptions` call; default pre-selection; submit blocked until terms are accepted;
  bank fields appear only for a non-card deposit; the exclusions list renders verbatim.

Harness notes that have already cost time in this repo and apply here:

- Fixtures use dates **relative to today**, never fixed dates, because charge and refund
  stages are evaluated against the current day.
- Nuxt auto-imported children and the shadcn primitives must be registered in
  `global.components`, or assertions pass vacuously against unresolved stubs. An
  unresolved `Input` renders a bare `<input model-value="...">` and every value assertion
  passes for the wrong reason.
- A `Button` stub must **not** re-emit `click`: the parent handler already falls through
  onto the stub root and would fire twice.
- `import.meta.client` is not substituted under Vitest. Guard persistence on
  `typeof localStorage`.
- `tests/setup.ts` clears the `useState` store before every test, so each case builds its
  own policy, assignment and reservation chain.

## Not in scope, deliberately

- **Real gateway calls.** Charge, retry and refund are mocked timers writing
  `pm_mock_*`-style ids, the same boundary as `useOnboarding.submitPayment`. No Stripe
  SetupIntent, no Xendit token, no Doku authorize-capture is actually issued.
- **Pre-authorization holds.** Ruled out above on rail grounds, not deferred.
- **Card-on-file as a guest option.** It may later exist as a fraud backstop applied by
  staff; it must never reach the choice screen.
- **Recurring or instalment waiver billing.** Long-stay bands use a banded flat price
  collected once. See the warning under Long stays.
- **A third-party underwriter.** The waiver pot is self-funded. Waivo, Truvi and Safely
  integrations would each add a claims API and are their own spec. The model is built so an
  `underwriter?` field can be added without migration.
- **A claims workflow beyond a deduction.** There is no claim status, adjuster, appeal or
  guest-facing dispute. Staff record a deduction with evidence and the guest is told.
- **Accounting push.** Nothing writes to Jurnal, Bexio, Lexware or DATEV. Held deposits are
  a liability and their posting rules are a finance decision, not a reservations one.
- **Owner payout impact.** Neither the deposit nor the waiver fee touches `priceDetails`,
  `guestPaid`, `payout`, `commission`, or any owner statement.
- **Booking-widget collection.** The choice is made in the Guest Guide before arrival, not
  at the point of booking.
- **Per-room protection on a multi-room booking.** One booking carries one protection across
  every `ReservationRoomLine`, and a claim names the room in its label. Same boundary the
  folio already sets for per-room billing.
- **Early check-out.** `refundDueAt` keys off the booked check-out date, not the actual one.
  Leaving early shortens the stay, not the inspection window.
- **Held deposits as a reported liability.** `heldTotals` exists per currency for the
  worklist, but nothing pushes it to finance as a balance-sheet figure. `BookingWidgetConfig.depositPct` keeps its current, unrelated
  meaning and is untouched.
- **Background jobs.** Charges are attempted and alerts raised by an in-app
  `emitProtectionAlerts()` call, not by a scheduler.

## Open questions before implementation

1. **Doku**: what hold and refund windows do the acquirers grant, and are refunds to
   non-card rails supported on our MID? This decides how often `refundDestination` needs
   bank details rather than reversing to source.
2. **Stripe account pricing**: extended authorization needs IC+ and is unavailable on
   blended. Not needed by this design, but worth knowing before anyone proposes holds again.
3. **Long-stay deposits, per market**: at what stay length does a held deposit become a
   tenancy deposit in Indonesia, Germany and Switzerland, and what does each regime then
   require? Until counsel answers, long-stay bands ship waiver-only. This is the one open
   question that blocks a feature rather than informing it.
4. **Self-funded or underwritten**: if the waiver pot is self-funded, the operator carries
   claims above the fee income. Published figures put typical accidental damage cost per
   stay under USD 10 against waiver pricing of USD 40 to 90, which is why self-funding is
   the default assumption here. Confirm the appetite before launch.
