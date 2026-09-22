# Damage Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a guest choose, before arrival, between a non-refundable damage waiver and a refundable security deposit, then make sure the deposit is charged on time, deducted only with evidence, and refunded on a stated SLA, through a guest guide section, a reservation section, a status chip, five alerts and a worklist page.

**Architecture:** A framework-free rules module (`app/components/reservations/data/damage-protection.ts`) owns every calculation and every state decision. A composable (`app/composables/useDamageProtection.ts`) owns the policy library, the per-listing assignment, and is the **only** writer of `ReservationEntry.damageProtection`. State is **derived** on every read so a policy change re-evaluates existing bookings; only the acceptance and the settlement are stored, with the amount, cap and terms frozen at acceptance. Damage protection never touches `priceDetails`, `payout` or the folio: a deposit is guest money held, and the waiver fee reaches revenue only as a folio item posted through `useReservationFolio`.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, shadcn-vue, Tailwind v4, Vitest 4 + @vue/test-utils, vue-sonner for toasts.

**Spec:** `docs/superpowers/specs/2026-09-18-damage-protection-design.md`

**Test command:** this repo has **no `npm test` script**. Run Vitest directly:
```bash
npx vitest run tests/lib/damage-protection.spec.ts
```

---

## Read this before Task 1

Seven repo facts that will each cost you an hour if you learn them the hard way.

1. **`DEPOSIT_FAILED_AT_CHECKIN` already exists** in `app/components/notifications/data/alerts.ts`
   (type union line 10, label line 104, icon line 183, route line 262, description line 358)
   and is already in `FINANCE_TYPES`. Verified: **nothing emits it.** Do not add a second
   deposit-failed type. Reuse it and change only its `alertRouteMap` entry.
2. **An alert that is not in a notification category is invisible.** `isAlertVisibleToUser`
   drops any alert whose type is missing from `role.notifications.enabledAlertTypes`, and
   roles build that list from `notificationCategories`. Adding a type to `AlertType` alone
   shows nothing in the bell. All four new types go into `FINANCE_TYPES`.
3. **`useReservationFolio.commit()` REPLACES `priceDetails.extras`** rather than adding to
   it. Any other writer of that field is silently wiped by the next folio posting. This
   feature must never patch `priceDetails` at all.
4. **reka-ui `Switch` and `Checkbox` use `model-value` / `@update:model-value`.**
   `:checked` / `@update:checked` silently does nothing. Never wrap a `Checkbox` in a
   `<label>`, it double-toggles. For clickable rows use `div @click` plus a custom checkbox
   visual.
5. **`import.meta.client` is not substituted under Vitest** despite the `define` in
   `vitest.config.ts`. Guard anything client-only on `typeof localStorage`.
6. **Nuxt auto-imported child components must be registered in `global.components`** in a
   component spec, or they render as unresolved stubs and assertions pass vacuously. An
   unresolved `Input` renders `<input model-value="...">` and every value assertion passes
   for the wrong reason. A `Button` stub must **not** re-emit `click`: the parent handler
   already falls through onto the stub root and would fire twice.
7. **`BookingChannel`** is `'Airbnb' | 'Booking.com' | 'Direct'`, exported from
   `app/components/listings/data/listings.ts:56`. Import it, do not redeclare it.

Two design rules from the spec that the code must not quietly undo:

- **The deposit is a real charge that is really refunded.** No `capture: false`, no
  authorization hold, no stored card. Every gateway will accept a hold API call and the
  feature will stop working for most Indonesian guests.
- **`channelPolicy` falls back to `'skip'`**, the OPPOSITE of the city tax `'host'`
  fallback. Airbnb and Booking.com carry their own damage programmes. Do not unify them.
- **Permissions are module-level.** `ModulePermissions` is `dashboardView / dashboardEdit /
  mobileView / mobileEdit` per `PermissionModule`. There is no finer primitive, so a new
  `damage_protection` module is how moving money gets its own gate.
- **A long stay is a different product.** A listing carries one policy PER STAY-LENGTH
  BAND, so every policy lookup takes `nights`. Above `LONG_STAY_THRESHOLD_NIGHTS` (28) the
  seeded policy offers the **waiver only**, because whether a months-long held deposit is a
  tenancy deposit is an open legal question per market. Do not seed a long-stay deposit.

---

## File Structure

**Create**

| File | Responsibility |
|---|---|
| `app/components/reservations/data/damage-protection.ts` | Pure rules: offering, pricing, charge and refund dates, state resolution, totals, validation, activity event. No Vue, no stores. |
| `app/composables/useDamageProtection.ts` | Policy library, per-listing assignment, the only writer of `damageProtection`, worklist computeds, alert emission. |
| `app/components/reservations/ReservationDamageProtectionSection.vue` | Accordion section in the reservation detail sheet. |
| `app/components/reservations/ProtectionClaimDialog.vue` | Label, amount, reason, evidence upload; shows the covered / excess split live. |
| `app/components/reservations/ProtectionChoiceDialog.vue` | Staff recording a choice on the guest's behalf. |
| `app/components/damage-protection/DamageProtectionTable.vue` | Worklist table. |
| `app/components/damage-protection/DamageProtectionStatusChip.vue` | Shared chip, used by the worklist and `ReservationTable`. |
| `app/components/damage-protection/ProtectionOptionCards.vue` | The two priced option cards. Shared by the settings preview and the staff choice dialog. |
| `app/components/settings/DamageProtectionSettingsPanel.vue` | Policy library, assignment, live preview. |
| `app/pages/damage-protection/index.vue` | Worklist page: KPIs, tabs, filters, bulk release. |
| `app/pages/settings/damage-protection.vue` | Thin `SettingsLayout wide` wrapper. |
| `guide-app/app/components/sections/DamageProtectionSection.vue` | Public guide section shell. |
| `guide-app/app/components/forms/DamageProtectionForm.vue` | The guest choice form. |
| `server/api/guest-guides/by-token/[token]/protection-choice.post.ts` | Public write endpoint. |
| `tests/lib/damage-protection.spec.ts` | Rules module. |
| `tests/composables/useDamageProtection.spec.ts` | Composable. |
| `tests/components/reservations/ReservationDamageProtection.spec.ts` | Section render states. |
| `tests/components/guest-guides/DamageProtectionForm.spec.ts` | Guest choice form. |

**Modify**

| File | Change |
|---|---|
| `app/components/reservations/data/reservations.ts` | `ProtectionOption`, `ProtectionState`, `ProtectionClaim`, `ProtectionRefundDestination`, `DamageProtection`, `ReservationEntry.damageProtection?` |
| `app/components/users/data/permissions.ts` | `damage_protection` in `PermissionModule` + `DASHBOARD_PERMISSION_MODULES` |
| `app/components/notifications/data/alerts.ts` | 4 new types, labels, icons, routes, descriptions; retarget `DEPOSIT_FAILED_AT_CHECKIN` route |
| `app/components/notifications/data/notification-settings.ts` | 5 new types into `FINANCE_TYPES` |
| `app/composables/useNotifications.ts` | `createProtectionAlert` wrapper |
| `app/components/guest-guides/data/types.ts` | `'damage_protection'` in `GuideSectionType`; `GuideSubmission.protectionChoice?` |
| `guide-app/app/pages/[token].vue` | Register the new section in the component map |
| `app/components/reservations/ReservationDetailSheet.vue` | Mount the section after `ReservationCityTaxSection` (line 596) |
| `app/components/reservations/ReservationTable.vue` | Status chip in the status cell |
| `app/constants/menus.ts` | Sidebar entry under Guest Registration; settings route |
| `app/components/settings/SidebarNav.vue` | Settings nav entry next to Cancellation Policies |
| `CLAUDE.md` | Module documentation |

---

## Task 1: Types

**Files:**
- Modify: `app/components/reservations/data/reservations.ts`
- Modify: `app/components/guest-guides/data/types.ts`

### Steps

- [ ] Add the protection types to `reservations.ts`, directly after the `CityTaxSettlement`
      block so the two pass-through-money features sit together.

```ts
export type ProtectionOption = 'waiver' | 'deposit'
export type WaiverPricing = 'flat' | 'per_night' | 'percent_of_subtotal'
export type DepositPricing = 'flat' | 'percent_of_subtotal'

export type ProtectionState =
  | 'awaiting_choice'
  | 'waiver_active'
  | 'deposit_pending'
  | 'deposit_failed'
  | 'deposit_held'
  | 'deposit_released'
  | 'deposit_partial'
  | 'deposit_forfeited'
  | 'refund_failed'
  | 'cancelled_refunded'

export interface ProtectionRefundDestination {
  method: 'original_payment_method' | 'bank_transfer'
  accountName?: string
  accountNumber?: string
  bankName?: string
}

/**
 * One damage incident, recorded on BOTH paths. On a deposit it drives the
 * deduction; on a waiver it records what the pot paid out, which is the only
 * way to tell whether the fee is priced right.
 */
export interface ProtectionClaim {
  id: string
  label: string
  /** The full assessed damage. */
  amount: number
  /** What the protection absorbed. */
  coveredAmount: number
  /** amount - coveredAmount. Staff post this to the folio BY HAND, never automatically. */
  excessAmount: number
  reason: string
  /** Mock paths, same shape as GuestDocument.url. At least one is required. */
  evidenceUrls: string[]
  recordedBy: string
  recordedAt: string
  /** When the guest was told. A deposit cannot be released while this is unset. */
  guestNotifiedAt?: string
}

/**
 * What the guest chose and what happened to the money. Deliberately the ONLY
 * protection state stored on a reservation: the bucket ('charge due', 'refund
 * overdue') is derived on every read, so editing a policy re-evaluates every
 * existing booking instead of leaving a stale flag behind.
 *
 * `amount`, `coverageCap`, `termsVersion` and `termsText` are FROZEN at
 * acceptance. `policyId` is provenance, never a live join.
 */
export interface DamageProtection {
  policyId: string
  option: ProtectionOption
  state: ProtectionState

  amount: number
  currency: string
  coverageCap?: number
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
```

- [ ] Add the optional field to `ReservationEntry`, next to `cityTaxSettlement`:

```ts
  /** Undefined = never offered. See data/damage-protection.ts. */
  damageProtection?: DamageProtection
```

- [ ] In `app/components/guest-guides/data/types.ts`, add `'damage_protection'` to
      `GuideSectionType` (after `'pre_arrival'`), and extend `GuideSubmission`:

```ts
  protectionChoice?: {
    option: 'waiver' | 'deposit'
    acceptedAt: string
    termsVersion: string
  }
```

### Verification

- [ ] `npx vue-tsc --noEmit` (or the repo's typecheck script) passes. No runtime change yet.

---

## Task 2: Rules module, part 1 (policy shape, offering, pricing, dates)

**Files:**
- Create: `app/components/reservations/data/damage-protection.ts`
- Create: `tests/lib/damage-protection.spec.ts`

### Steps

- [ ] Create the module with the policy type and the pure helpers. Framework-free: no Vue
      import, no store import.

```ts
import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type { BookingChannel } from '~/components/listings/data/listings'
import type {
  DamageProtection,
  DepositPricing,
  ProtectionClaim,
  ProtectionOption,
  ProtectionState,
  ReservationEntry,
  WaiverPricing,
} from '~/components/reservations/data/reservations'

export type ProtectionCurrency = 'USD' | 'IDR' | 'EUR' | 'CHF'

export interface DamageProtectionPolicy {
  id: string
  name: string
  currency: ProtectionCurrency
  offers: ProtectionOption[]
  defaultOption: ProtectionOption
  waiver: {
    pricing: WaiverPricing
    rate: number
    /** Ceiling on a per_night or percent result. Required above 27 nights. */
    maxAmount?: number
    coverageCap: number
    exclusions: string[]
  }
  deposit: {
    pricing: DepositPricing
    rate: number
    /** Ceiling on a percent result. Without it a 90-night stay is unbounded. */
    maxAmount?: number
    chargeLeadDays: number
    refundSlaDays: number
  }
  /** Unset channels fall back to 'skip'. See the warning below. */
  channelPolicy: Partial<Record<BookingChannel, 'offer' | 'skip'>>
  termsVersion: string
  termsText: string
  createdAt: string
  updatedAt: string
}

/** Round to the currency's minor unit. IDR amounts are whole already. */
export function roundProtectionAmount(value: number, currency: string): number {
  if (currency === 'IDR')
    return Math.round(value)
  return Math.round(value * 100) / 100
}
```

- [ ] `protectionOffered`. The fallback is the one thing here that is easy to get wrong.

```ts
/**
 * Whether the guest is asked at all.
 *
 * An unset channel falls back to 'skip', the OPPOSITE of the city tax fallback.
 * Airbnb and Booking.com run their own guest damage programmes, so charging an
 * OTA guest a second time for the same cover is a chargeback and a one-star
 * review. An unconfigured channel must stay silent.
 */
export function protectionOffered(
  policy: DamageProtectionPolicy | null,
  channel: BookingChannel,
): boolean {
  if (!policy || policy.offers.length === 0)
    return false
  return (policy.channelPolicy[channel] ?? 'skip') === 'offer'
}
```

- [ ] Pricing. Percent modes read `priceDetails.subtotal`, never the grand total, so no
      deposit is charged on the cleaning fee.

```ts
type PricedStay = Pick<ReservationEntry, 'nights'> & {
  priceDetails?: { subtotal: number }
}

function subtotalOf(reservation: PricedStay): number {
  return reservation.priceDetails?.subtotal ?? 0
}

function capped(raw: number, maxAmount: number | undefined): number {
  const floored = Math.max(0, raw)
  return maxAmount === undefined ? floored : Math.min(floored, maxAmount)
}

export function waiverAmount(
  policy: DamageProtectionPolicy,
  reservation: PricedStay,
): number {
  const { pricing, rate, maxAmount } = policy.waiver
  const raw
    = pricing === 'flat'
      ? rate
      : pricing === 'per_night'
        ? rate * Math.max(0, reservation.nights)
        : subtotalOf(reservation) * (rate / 100)
  return roundProtectionAmount(capped(raw, maxAmount), policy.currency)
}

export function depositAmount(
  policy: DamageProtectionPolicy,
  reservation: PricedStay,
): number {
  const { pricing, rate, maxAmount } = policy.deposit
  const raw = pricing === 'flat' ? rate : subtotalOf(reservation) * (rate / 100)
  return roundProtectionAmount(capped(raw, maxAmount), policy.currency)
}
```

- [ ] Stay-length bands. A listing carries one policy per band, so every lookup needs the
      night count.

```ts
export const LONG_STAY_THRESHOLD_NIGHTS = 28

export interface DamageProtectionAssignment {
  listingId: string
  policyId: string
  minNights: number
  /** null = the open-ended top band. */
  maxNights: number | null
}

export function isLongStay(nights: number): boolean {
  return nights >= LONG_STAY_THRESHOLD_NIGHTS
}

export function assignmentForStay(
  assignments: DamageProtectionAssignment[],
  listingId: string,
  nights: number,
): DamageProtectionAssignment | null {
  return assignments.find(a =>
    a.listingId === listingId
    && nights >= a.minNights
    && (a.maxNights === null || nights <= a.maxNights),
  ) ?? null
}

/** Bands on one listing must not overlap. Used by the settings editor to refuse a save. */
export function overlappingBands(
  assignments: DamageProtectionAssignment[],
  listingId: string,
): boolean {
  const bands = assignments
    .filter(a => a.listingId === listingId)
    .map(a => [a.minNights, a.maxNights ?? Number.POSITIVE_INFINITY] as const)
    .sort((a, b) => a[0] - b[0])
  return bands.some((band, i) => i > 0 && band[0] <= bands[i - 1][1])
}
```

- [ ] `buildOptions`, the single source the guest screen, the settings preview and the staff
      dialog all render from, so the three can never disagree on a number.

```ts
export interface ProtectionOptionView {
  option: ProtectionOption
  amount: number
  currency: ProtectionCurrency
  /** Waiver only. */
  coverageCap?: number
  exclusions?: string[]
  /** Deposit only. */
  chargeDueAt?: string
  refundSlaDays?: number
  isDefault: boolean
}

export function buildOptions(
  policy: DamageProtectionPolicy,
  reservation: ReservationEntry,
  now: Date = new Date(),
): ProtectionOptionView[] {
  return policy.offers.map((option) => {
    const isDefault = option === policy.defaultOption
    if (option === 'waiver') {
      return {
        option,
        amount: waiverAmount(policy, reservation),
        currency: policy.currency,
        coverageCap: policy.waiver.coverageCap,
        exclusions: policy.waiver.exclusions,
        isDefault,
      }
    }
    return {
      option,
      amount: depositAmount(policy, reservation),
      currency: policy.currency,
      chargeDueAt: chargeDueAt(reservation, policy, now),
      refundSlaDays: policy.deposit.refundSlaDays,
      isDefault,
    }
  })
}
```

- [ ] The two dates. `chargeDueAt` clamps to now, because a booking made two days before
      arrival with a three-day lead must charge immediately, not in the past.

```ts
function isoDay(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function chargeDueAt(
  reservation: Pick<ReservationEntry, 'checkIn'>,
  policy: DamageProtectionPolicy,
  now: Date = new Date(),
): string {
  const due = addDays(isoDay(reservation.checkIn), -policy.deposit.chargeLeadDays)
  return (due.getTime() < now.getTime() ? now : due).toISOString()
}

export function refundDueAt(
  reservation: Pick<ReservationEntry, 'checkOut'>,
  policy: DamageProtectionPolicy,
): string {
  return addDays(isoDay(reservation.checkOut), policy.deposit.refundSlaDays).toISOString()
}
```

### Tests (`tests/lib/damage-protection.spec.ts`)

- [ ] `protectionOffered`: an unset channel returns false; `'skip'` returns false;
      `'offer'` returns true; a null policy returns false; an empty `offers` returns false.
- [ ] `waiverAmount`: each of the three pricing modes; `per_night` with `nights: 0`;
      `percent_of_subtotal` reads `subtotal` and is **not** affected by a large
      `cleaningFee` in the same `priceDetails`.
- [ ] `depositAmount`: both modes; a missing `priceDetails` yields 0 rather than `NaN`.
- [ ] `roundProtectionAmount`: IDR rounds to whole, USD to cents.
- [ ] `chargeDueAt`: three days before a future check-in; **clamped to now** when the lead
      window has already passed.
- [ ] `refundDueAt`: check-out plus the SLA.
- [ ] `buildOptions`: returns one view per entry in `offers`, in that order; marks exactly
      one `isDefault`; the waiver view carries cap and exclusions and no dates, the deposit
      view carries dates and no cap.
- [ ] `maxAmount` caps a `per_night` waiver on a 90-night stay and a `percent_of_subtotal`
      deposit on a large subtotal; an absent `maxAmount` leaves the raw figure alone.
- [ ] `assignmentForStay`: picks the short band at 7 nights and the long band at 30; the
      open-ended top band matches 365; a listing with no covering band returns null.
- [ ] `overlappingBands`: adjacent bands (1-27, 28-null) do not overlap; (1-30, 28-null) do;
      bands on different listings never collide.

> Fixtures use dates **relative to today**, never fixed dates. `chargeDueAt` and every
> state boundary are evaluated against the current day, so a fixed 2026 fixture rots.

---

## Task 3: Rules module, part 2 (state, totals, validation, activity event)

**Files:**
- Modify: `app/components/reservations/data/damage-protection.ts`
- Modify: `tests/lib/damage-protection.spec.ts`

### Steps

- [ ] Totals. Each figure is computed straight off its own source, independently of the
      others. This is the lesson from `buildFolioSummary`: never sign-branch one gross
      figure on another.

```ts
/** What came off a held deposit. Zero on the waiver path. */
export function deductionTotal(protection: DamageProtection): number {
  if (protection.option !== 'deposit')
    return 0
  return roundProtectionAmount(
    (protection.claims ?? []).reduce((sum, c) => sum + c.coveredAmount, 0),
    protection.currency,
  )
}

/**
 * What the waiver pot paid out on this stay. Zero on the deposit path. This is
 * the number that says whether the fee is priced right, so it is computed from
 * its own source and never inferred from the deduction total.
 */
export function waiverPotTotal(protection: DamageProtection): number {
  if (protection.option !== 'waiver')
    return 0
  return roundProtectionAmount(
    (protection.claims ?? []).reduce((sum, c) => sum + c.coveredAmount, 0),
    protection.currency,
  )
}

/**
 * Split an assessed damage figure into what the protection absorbs and what it
 * does not. The excess is REPORTED, never charged: posting it is a judgement
 * call staff make in the folio.
 */
export function claimCoverage(
  protection: DamageProtection,
  amount: number,
): { coveredAmount: number, excessAmount: number } {
  const headroom = protection.option === 'deposit'
    ? refundableAmount(protection)
    : Math.max(0, (protection.coverageCap ?? 0) - waiverPotTotal(protection))
  const covered = roundProtectionAmount(Math.min(Math.max(0, amount), headroom), protection.currency)
  return {
    coveredAmount: covered,
    excessAmount: roundProtectionAmount(Math.max(0, amount - covered), protection.currency),
  }
}

/** What the guest gets back if the deposit were released right now. Never negative. */
export function refundableAmount(protection: DamageProtection): number {
  if (protection.option !== 'deposit')
    return 0
  return roundProtectionAmount(
    Math.max(0, protection.amount - deductionTotal(protection)),
    protection.currency,
  )
}

/**
 * Damage above what the guest agreed to cover. The operator posts this as a
 * FOLIO ITEM by hand; nothing here charges it automatically, because deciding a
 * guest owes more than they agreed is a judgement call.
 */
export function uncoveredExcess(protection: DamageProtection, damageTotal: number): number {
  const ceiling = protection.option === 'waiver'
    ? (protection.coverageCap ?? 0)
    : protection.amount
  return roundProtectionAmount(Math.max(0, damageTotal - ceiling), protection.currency)
}
```

- [ ] State resolution. Only the stored facts decide it; the worklist bucket is derived.

```ts
export type ProtectionBucket =
  | 'not_offered'
  | 'awaiting_choice'
  | 'charge_due'
  | 'failed'
  | 'held'
  | 'refund_due'
  | 'refund_overdue'
  | 'settled'

const SETTLED: ProtectionState[] = [
  'deposit_released', 'deposit_partial', 'deposit_forfeited', 'cancelled_refunded',
]

/** A stay that is not a guest stay is never protected, whatever the channel says. */
export const GUEST_STAY_STATUSES: ReservationStatus[] = [
  'inquiry', 'unverified', 'verified', 'checked_in', 'checked_out',
]

export function isGuestStay(status: ReservationStatus): boolean {
  return GUEST_STAY_STATUSES.includes(status)
}

export function resolveBucket(
  protection: DamageProtection | undefined,
  status: ReservationStatus,
  now: Date = new Date(),
): ProtectionBucket {
  if (!protection)
    return 'not_offered'
  // A cancelled stay owes the money back NOW, regardless of the check-out date,
  // and must never sit in a chase bucket keyed to a stay that is not happening.
  if (status === 'cancelled') {
    const collected = protection.state === 'deposit_held'
      || protection.state === 'waiver_active'
      || protection.state === 'refund_failed'
    return collected ? 'refund_due' : 'settled'
  }
  if (protection.state === 'refund_failed')
    return 'failed'
  if (protection.state === 'cancelled_refunded')
    return 'settled'
  if (protection.state === 'awaiting_choice')
    return 'awaiting_choice'
  if (protection.state === 'waiver_active')
    return 'settled'
  if (protection.state === 'deposit_failed')
    return 'failed'
  if (SETTLED.includes(protection.state))
    return 'settled'
  if (protection.state === 'deposit_pending') {
    return protection.chargeDueAt && new Date(protection.chargeDueAt) <= now
      ? 'charge_due'
      : 'held' // chosen, not yet due; shown as upcoming, never as a task
  }
  // deposit_held
  if (!protection.refundDueAt)
    return 'held'
  const due = new Date(protection.refundDueAt)
  if (due <= now)
    return 'refund_overdue'
  const HOURS_48 = 48 * 60 * 60 * 1000
  return due.getTime() - now.getTime() <= HOURS_48 ? 'refund_due' : 'held'
}
```

- [ ] Validation.

```ts
export interface ProtectionChoiceDraft {
  option: ProtectionOption
  termsAccepted: boolean
  refundDestination?: ProtectionRefundDestination
}

/**
 * A deposit collected on a non-card rail needs bank details, because QRIS,
 * virtual account and e-wallet payments frequently cannot be reversed to
 * source. Collected on the choice screen, never at checkout.
 */
export function choiceRequiresBankDetails(
  draft: Pick<ProtectionChoiceDraft, 'option'>,
  rail: 'card' | 'non_card',
): boolean {
  return draft.option === 'deposit' && rail === 'non_card'
}

export function isChoiceValid(
  draft: ProtectionChoiceDraft,
  policy: DamageProtectionPolicy,
  rail: 'card' | 'non_card',
): boolean {
  if (!policy.offers.includes(draft.option))
    return false
  if (!draft.termsAccepted)
    return false
  if (!choiceRequiresBankDetails(draft, rail))
    return true
  const d = draft.refundDestination
  return Boolean(
    d?.method === 'bank_transfer'
    && d.accountName?.trim()
    && d.accountNumber?.trim()
    && d.bankName?.trim(),
  )
}

export type ClaimDraft = Pick<ProtectionClaim, 'label' | 'amount' | 'reason' | 'evidenceUrls'>

export function isClaimValid(draft: ClaimDraft, protection: DamageProtection): boolean {
  if (!draft.label.trim() || !draft.reason.trim())
    return false
  if (draft.evidenceUrls.length === 0)
    return false
  return draft.amount > 0
}

export type ReleaseRefusal = 'not_a_deposit' | 'nothing_held' | 'claim_not_notified'

/**
 * A deduction the guest first learns about from a smaller refund is a
 * chargeback. Money cannot be kept until the guest has been told it is being
 * kept, and why.
 */
export function canRelease(
  protection: DamageProtection,
): { ok: true } | { ok: false, reason: ReleaseRefusal } {
  if (protection.option !== 'deposit')
    return { ok: false, reason: 'not_a_deposit' }
  if (protection.state !== 'deposit_held' && protection.state !== 'refund_failed')
    return { ok: false, reason: 'nothing_held' }
  const unnotified = (protection.claims ?? []).some(c => !c.guestNotifiedAt)
  return unnotified ? { ok: false, reason: 'claim_not_notified' } : { ok: true }
}
```

> ⚠️ **`isClaimValid` no longer caps the amount at what is left.** A claim records the real
> assessed damage; `claimCoverage` decides how much of it the protection absorbs and reports
> the rest as excess. Capping at input time would quietly shrink the operator's own record of
> what a stay actually cost, which is the number the waiver is priced from.

- [ ] The activity event, mirroring `folioActivityEvent`.

```ts
export type ProtectionEventKind =
  | 'chosen' | 'charged' | 'charge_failed' | 'claimed' | 'notified' | 'released' | 'refund_failed' | 'cancelled' | 'undone'

export function protectionActivityEvent(
  kind: ProtectionEventKind,
  protection: DamageProtection,
  actor: string,
  detail?: string,
): ActivityEvent {
  const money = `${protection.currency} ${protection.amount.toLocaleString('de-CH')}`
  const map: Record<ProtectionEventKind, { title: string, description: string, colorDot: ActivityEvent['colorDot'] }> = {
    chosen: { title: 'Damage protection chosen', description: `${protection.option === 'waiver' ? 'Waiver' : 'Deposit'} ${money}`, colorDot: 'blue' },
    charged: { title: 'Deposit charged', description: money, colorDot: 'green' },
    charge_failed: { title: 'Deposit charge failed', description: detail ?? 'Declined', colorDot: 'gold' },
    claimed: { title: 'Damage claim recorded', description: detail ?? '', colorDot: 'gold' },
    notified: { title: 'Guest notified of claim', description: detail ?? '', colorDot: 'blue' },
    refund_failed: { title: 'Refund failed', description: detail ?? '', colorDot: 'gold' },
    cancelled: { title: 'Protection refunded on cancellation', description: money, colorDot: 'green' },
    released: { title: 'Deposit released', description: detail ?? '', colorDot: 'green' },
    undone: { title: 'Settlement undone', description: detail ?? '', colorDot: 'gray' },
  }
  const meta = map[kind]
  return {
    id: `protection-${kind}-${protection.policyId}-${Date.now()}`,
    type: 'reservation',
    title: meta.title,
    description: meta.description,
    actor,
    timestamp: new Date().toISOString(),
    colorDot: meta.colorDot,
  }
}
```

> ⚠️ The `id` is built from the **same** `kind` that chose the title and colour. The
> documented `folioActivityEvent` bug was an id that disagreed with the rendered text.
> `ActivityEventColor` is `'gold' | 'green' | 'blue' | 'gray'` (verified,
> `conversations.ts:7`). There is no red and no amber: attention states use `'gold'`.

### Tests

- [ ] `deductionTotal` with none, one and several; `refundableAmount` never negative when
      deductions exceed the deposit; a waiver returns 0 refundable and a non-zero
      `waiverPotTotal`, and a deposit the reverse.
- [ ] `claimCoverage`: damage inside the headroom is fully covered with zero excess; damage
      beyond it splits; a second claim sees the headroom the first one left; a waiver's
      headroom is the cap minus what the pot already paid.
- [ ] `canRelease`: refuses a waiver, refuses when nothing is held, refuses while any claim
      lacks `guestNotifiedAt`, and passes once every claim is notified.
- [ ] `uncoveredExcess`: damage under, at and over the cap for a waiver; the same for a
      deposit against `amount`; never negative.
- [ ] `resolveBucket`: every state; `deposit_pending` before and after `chargeDueAt`;
      `deposit_held` at 72h, 24h and past the refund due date; an undefined protection is
      `not_offered`; a waiver is `settled`.
- [ ] `resolveBucket` with `status: 'cancelled'`: a held deposit is `refund_due`
      **immediately** even with a check-out months away; an already-refunded one is
      `settled`; a `deposit_pending` one is `settled` and therefore never charges.
- [ ] `isGuestStay`: false for `cancelled`, `blocked` and `owner_request`, true for the
      other five.
- [ ] `isChoiceValid`: terms unaccepted rejected; an option not in `offers` rejected; a card
      deposit needs no bank fields; a non-card deposit rejected until all three bank fields
      are non-blank; a waiver on a non-card rail needs none.
- [ ] `isClaimValid`: blank label, blank reason, no evidence and a zero amount are each
      rejected; an amount larger than the remaining headroom is **accepted**, because the
      excess is reported rather than refused.
- [ ] `protectionActivityEvent`: the id contains the same kind as the title for all six
      kinds.

---

## Task 4: Alert types and notification wiring

**Files:**
- Modify: `app/components/notifications/data/alerts.ts`
- Modify: `app/components/notifications/data/notification-settings.ts`
- Modify: `app/composables/useNotifications.ts`

### Steps

- [ ] Add five types to the `AlertType` union, next to the existing
      `DEPOSIT_FAILED_AT_CHECKIN`:

```ts
    | 'PROTECTION_CHOICE_MISSING'
    | 'DEPOSIT_REFUND_DUE'
    | 'DEPOSIT_REFUND_OVERDUE'
    | 'DEPOSIT_REFUND_FAILED'
    | 'DAMAGE_CLAIM_RECORDED'
```

- [ ] `alertDisplayLabels`:

```ts
  PROTECTION_CHOICE_MISSING: 'Damage Protection - No Choice Made',
  DEPOSIT_REFUND_DUE: 'Security Deposit - Refund Due Soon',
  DEPOSIT_REFUND_OVERDUE: 'Security Deposit - Refund Overdue',
  DEPOSIT_REFUND_FAILED: 'Security Deposit - Refund Failed',
  DAMAGE_CLAIM_RECORDED: 'Damage Claim Recorded',
```

- [ ] `alertIcons`: `i-lucide-shield-question`, `i-lucide-undo-2`, `i-lucide-undo-2`,
      `i-lucide-undo-2`, `i-lucide-receipt-text`.
- [ ] `alertRouteMap`: all five to `/damage-protection`, and **change**
      `DEPOSIT_FAILED_AT_CHECKIN` from `/inbox` to `/damage-protection`.
- [ ] `getDescription()` cases:

```ts
    case 'PROTECTION_CHOICE_MISSING':
      return `${context.guest_name || 'Guest'}, checks in ${context.check_in || 'soon'}`
    case 'DEPOSIT_REFUND_DUE':
    case 'DEPOSIT_REFUND_OVERDUE':
      return `${context.guest_name || 'Guest'}, ${context.currency || 'USD'} ${context.refundable_amount || 0}`
    case 'DEPOSIT_REFUND_FAILED':
      return `${context.guest_name || 'Guest'}, ${context.reason || 'Refund rejected'}`
    case 'DAMAGE_CLAIM_RECORDED':
      return `${context.guest_name || 'Guest'}, ${context.currency || 'USD'} ${context.claim_amount || 0}`
```

- [ ] Add all five to `FINANCE_TYPES` in `notification-settings.ts`.
      `DEPOSIT_FAILED_AT_CHECKIN` is already there; do not duplicate it.
- [ ] Add the wrapper in `useNotifications.ts`, modelled on `createCityTaxAlert`:

```ts
  function createProtectionAlert(
    type: 'PROTECTION_CHOICE_MISSING' | 'DEPOSIT_FAILED_AT_CHECKIN' | 'DEPOSIT_REFUND_DUE' | 'DEPOSIT_REFUND_OVERDUE' | 'DEPOSIT_REFUND_FAILED' | 'DAMAGE_CLAIM_RECORDED',
    context: Record<string, any>,
  ) {
    let severity: AlertSeverity = 'INFO'
    if (type === 'DEPOSIT_FAILED_AT_CHECKIN' || type === 'DEPOSIT_REFUND_OVERDUE' || type === 'DEPOSIT_REFUND_FAILED')
      severity = 'CRITICAL'
    else if (type === 'PROTECTION_CHOICE_MISSING' || type === 'DEPOSIT_REFUND_DUE')
      severity = 'WARNING'
    createAlert(type, severity, context)
  }
```

- [ ] Export it from the composable's return object.

### Verification

- [ ] Open the bell. The five new types appear under the Finance category in
      `/settings/notifications` for a role that has Finance enabled.
- [ ] A role with Finance disabled sees none of them. That is `isAlertVisibleToUser` doing
      its job, not a bug.

---

## Task 5: `useDamageProtection`, the policy store and the reads

**Files:**
- Create: `app/composables/useDamageProtection.ts`
- Create: `tests/composables/useDamageProtection.spec.ts`

### Steps

- [ ] Create the composable. It owns the policy library and the per-listing assignment, and
      reads reservations through `useReservationsModule`. The `actor` pattern is copied from
      `useReservationFolio.ts:27-31`.

```ts
export function useDamageProtection() {
  const { reservations, updateReservation } = useReservationsModule()
  const { currentUser } = useCurrentDashboardUser()
  const { createProtectionAlert, alerts, markAsRead } = useNotifications()

  const actor = computed(() => currentUser.value?.name ?? 'Staff')

  const policies = useState<DamageProtectionPolicy[]>(
    'damage-protection-policies',
    () => seedPolicies.map(p => ({ ...p })),
  )
  /** listingId -> policyId. A listing with no entry is never offered protection. */
  const assignments = useState<DamageProtectionAssignment[]>(
    'damage-protection-assignments',
    () => seedAssignments.map(a => ({ ...a })),
  )
  // ... hydrate/persist, see below
```

- [ ] Persistence, guarded on storage availability rather than `import.meta.client`, which
      Vitest does not substitute:

```ts
  const STORAGE_KEY = 'elev8-damage-protection-v1'

  function persist() {
    if (typeof localStorage === 'undefined')
      return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        policies: policies.value,
        assignments: assignments.value,
      }))
    }
    catch { /* quota or private mode */ }
  }

  function hydrate() {
    if (typeof localStorage === 'undefined')
      return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw)
        return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.policies))
        policies.value = parsed.policies
      if (parsed.assignments && typeof parsed.assignments === 'object')
        assignments.value = parsed.assignments
    }
    catch { /* corrupt payload, keep the seed */ }
  }
```

- [ ] The reads:

```ts
  function reservationById(id: string): ReservationEntry | null {
    return reservations.value.find(r => r.id === id) ?? null
  }

  /**
   * Banded: a listing carries one policy per stay-length band, so the night
   * count is part of the lookup. A stay outside every band is never offered.
   */
  function policyFor(listingId: string, nights: number): DamageProtectionPolicy | null {
    const assignment = assignmentForStay(assignments.value, listingId, nights)
    if (!assignment)
      return null
    return policies.value.find(p => p.id === assignment.policyId) ?? null
  }

  function protectionFor(id: string): DamageProtection | null {
    return reservationById(id)?.damageProtection ?? null
  }

  function isOfferedFor(id: string): boolean {
    const reservation = reservationById(id)
    if (!reservation)
      return false
    // Status FIRST: an owner stay and a maintenance block are both channel
    // 'Direct', the one channel set to 'offer'. Without this an owner is asked
    // to buy a waiver to stay in their own villa.
    if (!isGuestStay(reservation.status))
      return false
    return protectionOffered(policyFor(reservation.listingId, reservation.nights), reservation.channel)
  }

  function optionsFor(id: string): ProtectionOptionView[] {
    const reservation = reservationById(id)
    if (!reservation)
      return []
    const policy = policyFor(reservation.listingId, reservation.nights)
    if (!policy || !protectionOffered(policy, reservation.channel))
      return []
    return buildOptions(policy, reservation)
  }

  function bucketFor(id: string): ProtectionBucket {
    return resolveBucket(protectionFor(id) ?? undefined)
  }
```

- [ ] Policy CRUD: `savePolicy(draft)`, `deletePolicy(id)` (refuse while any assignment
      points at it, return a reason string), `assignBand(listingId, policyId, minNights, maxNights)`
      (refuse when `overlappingBands` says the new band collides, **and refuse when the
      policy currency differs from the listing's payout account currency**, returning either
      as the reason), `removeBand(listingId, policyId)`. Every mutation calls `persist()`.

> ⚠️ The currency check belongs at assignment, not at charge time. "No conversion, ever"
> says what not to do; this is where it is prevented, before a guest is waiting on a charge
> that cannot be made.

- [ ] `listingsMissingGuideSection()`: every listing that has a policy band but whose
      covering `GuestGuide` has no enabled `damage_protection` section. The two assignments
      are independent lists and today the mismatch fails **silently**, with the guest simply
      never seeing a choice screen. The settings panel renders this as a warning naming the
      listings, with a link to the guide.

> ⚠️ **A policy edit must never rewrite an accepted protection.** `savePolicy` touches only
> `policies`, never a reservation. The frozen `amount` / `coverageCap` / `termsText` on
> `DamageProtection` is what a guest agreed to, and a test pins this.

### Tests

- [ ] `policyFor` returns null for an unassigned listing and the policy for an assigned one.
- [ ] `policyFor(listingId, 7)` and `policyFor(listingId, 60)` return **different** policies
      on a listing with two bands; a 400-night stay still resolves through the open top band.
- [ ] `assignBand` refuses a band that overlaps one already on that listing, and refuses a
      policy whose currency differs from the listing's payout account.
- [ ] `isOfferedFor` is false for `owner_request`, `blocked` and `cancelled` even on a
      Direct booking at a listing with a matching policy band.
- [ ] `listingsMissingGuideSection` names a listing with a policy but no guide section, and
      omits one where the section is enabled.
- [ ] `isOfferedFor` is false on an Airbnb booking when `channelPolicy` leaves Airbnb unset,
      and true on Direct when Direct is `'offer'`.
- [ ] `optionsFor` returns `[]` when not offered, and two priced views when it is.
- [ ] Editing a policy's `waiver.rate` after a guest accepted leaves the reservation's
      `damageProtection.amount` unchanged.
- [ ] `deletePolicy` refuses while assigned and succeeds once unassigned.

> `tests/setup.ts` clears the `useState` store before every test, so each case builds its
> own policy, assignment and reservation chain. Reset `localStorage` in `beforeEach` too.

---

## Task 6: `useDamageProtection`, the writers

**Files:**
- Modify: `app/composables/useDamageProtection.ts`
- Modify: `tests/composables/useDamageProtection.spec.ts`

### Steps

- [ ] One private `commit` helper so every action writes the protection object and its
      activity event in a **single** `updateReservation` call. A charge and its audit line
      must never land apart. Same rule as `useReservationFolio.commit`.

```ts
  function commit(
    reservation: ReservationEntry,
    protection: DamageProtection,
    event: ActivityEvent,
  ) {
    updateReservation(reservation.id, {
      damageProtection: protection,
      // Oldest-first, matching every seeded activity array and the timeline
      // that renders it. Prepending would land a new protection entry above a
      // months-old reservation-confirmed one.
      activity: [...reservation.activity, event],
    })
  }
```

> ⚠️ `ReservationEntry.activity` is `ActivityEvent[]` (`reservations.ts:153`) and is
> **append, not prepend**: `useReservationFolio.commit` spreads the existing array first
> and puts the new event last. Verified. Do not reverse it.
>
> ⚠️ Unlike `useReservationFolio.commit`, this helper writes **no** `priceDetails` patch.
> The folio's version moves `extras`, `guestPaid` and `payout` in lockstep; copying that
> block here would inflate every owner payout by money the operator is only holding.

- [ ] `recordChoice(reservationId, draft, via)`. This is where the freeze happens.

```ts
  function recordChoice(
    reservationId: string,
    draft: ProtectionChoiceDraft,
    via: 'guest_guide' | 'staff' = 'staff',
  ): { ok: true } | { ok: false, reason: string } {
    const reservation = reservationById(reservationId)
    if (!reservation)
      return { ok: false, reason: 'reservation_not_found' }
    const policy = policyFor(reservation.listingId, reservation.nights)
    if (!policy || !protectionOffered(policy, reservation.channel))
      return { ok: false, reason: 'not_offered' }
    const rail = railForListing(reservation.listingId)
    if (!isChoiceValid(draft, policy, rail))
      return { ok: false, reason: 'invalid_choice' }

    const isWaiver = draft.option === 'waiver'
    const protection: DamageProtection = {
      policyId: policy.id,
      option: draft.option,
      state: isWaiver ? 'waiver_active' : 'deposit_pending',
      // FROZEN at acceptance. A later policy edit cannot rewrite these.
      amount: isWaiver ? waiverAmount(policy, reservation) : depositAmount(policy, reservation),
      currency: policy.currency,
      coverageCap: isWaiver ? policy.waiver.coverageCap : undefined,
      termsVersion: policy.termsVersion,
      termsText: policy.termsText,
      acceptedAt: new Date().toISOString(),
      acceptedVia: via,
      chargeDueAt: isWaiver ? undefined : chargeDueAt(reservation, policy),
      refundDueAt: isWaiver ? undefined : refundDueAt(reservation, policy),
      refundDestination: isWaiver ? undefined : draft.refundDestination,
      claims: [],
    }
    commit(reservation, protection, protectionActivityEvent('chosen', protection, actor.value))
    return { ok: true }
  }
```

- [ ] `railForListing(listingId)`: reads the listing's payout account from `payouts.ts` and
      returns `'card'` when the provider is Stripe, `'non_card'` otherwise. A listing with no
      payout account returns `'non_card'`, the safe answer, because it forces bank details
      rather than assuming a reversible card.

- [ ] `chargeDeposit(reservationId)`. A 1.5s mock against the listing's payout account, the
      same boundary as `useOnboarding.submitPayment`.

```ts
  const charging = ref<Set<string>>(new Set())

  async function chargeDeposit(reservationId: string, forceFailure = false) {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection || protection.option !== 'deposit')
      return
    if (protection.state === 'deposit_held' || charging.value.has(reservationId))
      return // idempotency guard: the button and the worklist both call this

    charging.value = new Set(charging.value).add(reservationId)
    await new Promise(r => setTimeout(r, 1500))
    charging.value = new Set([...charging.value].filter(id => id !== reservationId))

    if (forceFailure) {
      const failed: DamageProtection = {
        ...protection,
        state: 'deposit_failed',
        failureReason: 'Card declined by issuer',
        failedAttempts: (protection.failedAttempts ?? 0) + 1,
      }
      commit(reservation, failed, protectionActivityEvent('charge_failed', failed, actor.value, failed.failureReason))
      createProtectionAlert('DEPOSIT_FAILED_AT_CHECKIN', {
        reservation_id: reservation.id,
        listing_id: reservation.listingId,
        guest_name: reservation.guestName,
        currency: failed.currency,
        deposit_amount: failed.amount,
      })
      return
    }

    const held: DamageProtection = {
      ...protection,
      state: 'deposit_held',
      chargedAt: new Date().toISOString(),
      payoutAccountId: payoutAccountIdFor(reservation.listingId),
      failureReason: undefined,
    }
    commit(reservation, held, protectionActivityEvent('charged', held, actor.value))
  }
```

> ⚠️ **No `capture: false`, no authorization hold, no stored card.** See the spec. This is a
> real charge whose refund is a real refund, and that is the only version that works on
> QRIS, virtual account and e-wallet.

> The `forceFailure` argument is the visible "simulate a decline" switch, the same device
> `ConnectPms` and `StepPayment` use in onboarding, because the failure path is specified
> and otherwise unreachable in a mock.

- [ ] `recordClaim(reservationId, draft)` / `removeClaim(reservationId, claimId)`.
      `recordClaim` validates with `isClaimValid`, computes the split with `claimCoverage`,
      appends, commits, and fires `DAMAGE_CLAIM_RECORDED`. It does **not** change `state`:
      the deposit is still held until it is released, and a waiver stays `waiver_active`.
      `removeClaim` refuses once `guestNotifiedAt` is set: the guest has been told, so the
      record stands and a correction is a new claim.

> ⚠️ **A claim is recorded on the waiver path too**, where no money moves and the only
> consequence is `waiverPotTotal`. That figure is how the operator learns whether USD 39 is
> the right price. Skipping the waiver-side record is what makes the whole commercial bet
> unmeasurable, so `recordClaim` must not early-return on `option === 'waiver'`.

- [ ] `notifyGuestOfClaim(reservationId, claimId)`: posts the line, the amount, the reason
      and the evidence into the reservation's conversation, then stamps `guestNotifiedAt`
      and commits a `notified` activity event.

```ts
  // useInbox imports useUpsellOrders, which calls into this module's siblings.
  // A static import closes a cycle. Same rule, same reason, as
  // useUpsellLockAccess.messageGuest. Do not "tidy" this into a top-level import.
  const { sendMessage } = await import('./useInbox').then(m => m.useInbox())
```

      A missing conversation is swallowed and `guestNotifiedAt` is **not** stamped, so the
      release gate stays closed rather than silently opening on a notice nobody received.

- [ ] `cancelProtection(reservationId)`: returns everything collected, on both paths, and
      lands `cancelled_refunded`. Refuses to run while any claim exists.

> ⚠️ **A cancellation refunds in full and no claim may be recorded against it.** No stay
> happened, so no damage did. This deliberately does not reuse the graduated ladder in
> `upsells/data/cancellation-policies.ts`: that prices a service the operator held capacity
> for, while a deposit is the guest's own money. A no-show on a non-refundable rate is a
> folio charge, never a deposit deduction.

- [ ] `releaseDeposit(reservationId, forceFailure = false)`. **Gates on `canRelease` first**
      and returns its refusal unchanged, so the UI can name the reason. Then computes the
      refund from the claims and picks the settled state from the arithmetic, never from a
      flag:

```ts
    const refundable = refundableAmount(protection)
    const deducted = deductionTotal(protection)
    const state: ProtectionState
      = deducted === 0 ? 'deposit_released'
        : refundable === 0 ? 'deposit_forfeited'
          : 'deposit_partial'
```

      Then commit with `refundedAt`, `refundedAmount: refundable`, and **resolve any live
      `DEPOSIT_REFUND_DUE` / `DEPOSIT_REFUND_OVERDUE` alert for this reservation directly**,
      not through `dismiss()`.

- [ ] The refund can itself be rejected: closed card, wrong bank details, provider error.
      `forceFailure` lands `refund_failed` with `refundFailureReason`, raises
      `DEPOSIT_REFUND_FAILED` (CRITICAL) and leaves the money with the operator.
      `retryRefund(reservationId)` re-runs the release, and the reservation section offers an
      edit of `refundDestination` alongside it.

> ⚠️ Without `refund_failed`, a rejected refund reads as a completed one. That is the worst
> available way to lose a guest's money: the worklist says settled, the guest says they never
> received it, and nothing in the record disagrees with either of them.

> ⚠️ Whether the current user can see an alert must not decide whether a settled obligation
> keeps nagging everybody else. Same rule as city tax settlement.

- [ ] `reassessOnExtension(reservationId, previousNights)`. A guest extending from 20
      nights to 40 crosses the band boundary, and the frozen protection was priced in the
      short band.

```ts
  /**
   * Extending across a band boundary RE-OPENS the choice for the added period.
   * It never silently re-prices the original one: the existing freeze stays valid
   * for the nights it was agreed for, exactly as a folio catalog pick survives a
   * later price change.
   */
  function reassessOnExtension(reservationId: string, previousNights: number) {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return
    const before = policyFor(reservation.listingId, previousNights)
    const after = policyFor(reservation.listingId, reservation.nights)
    if (!after || before?.id === after.id)
      return // same band, nothing to re-ask
    // Leave `protection` untouched and raise the choice again for the extension.
    createProtectionAlert('PROTECTION_CHOICE_MISSING', {
      reservation_id: reservation.id,
      listing_id: reservation.listingId,
      guest_name: reservation.guestName,
      check_in: reservation.checkIn,
      reason: 'stay_extended_across_band',
    })
  }
```

- [ ] `undoSettlement(reservationId)`: back to `deposit_held`, clearing `refundedAt` and
      `refundedAmount` but **keeping the deductions**. Mis-clicks happen at a busy desk;
      losing the evidence trail on an undo would be worse than the mis-click.

### Tests

- [ ] `recordChoice` freezes `amount`, `coverageCap`, `termsVersion` and `termsText`;
      editing the policy afterwards changes none of them.
- [ ] `recordChoice` refuses when not offered, when terms are unaccepted, and when a
      non-card deposit has no bank details.
- [ ] A waiver choice lands `waiver_active` with no `chargeDueAt` and no `refundDueAt`.
- [ ] `chargeDeposit` moves `deposit_pending` to `deposit_held` and stamps `chargedAt`.
- [ ] `chargeDeposit(id, true)` lands `deposit_failed`, increments `failedAttempts` and emits
      `DEPOSIT_FAILED_AT_CHECKIN`; a retry that succeeds clears `failureReason`.
- [ ] Calling `chargeDeposit` twice concurrently charges once (the `charging` guard).
- [ ] `recordClaim` on a **waiver** stores the claim, moves no money, leaves
      `waiver_active`, and grows `waiverPotTotal`.
- [ ] `recordClaim` beyond the headroom stores the full `amount` with a split
      `coveredAmount` / `excessAmount`; nothing is posted to the folio automatically.
- [ ] `removeClaim` succeeds before notification and refuses after it.
- [ ] `notifyGuestOfClaim` stamps `guestNotifiedAt`; with no conversation on the reservation
      it leaves the stamp unset, so `canRelease` still refuses.
- [ ] `releaseDeposit` refuses with `claim_not_notified` while a claim is unnotified, and
      succeeds once notified.
- [ ] `releaseDeposit(id, true)` lands `refund_failed`, sets `refundFailureReason`, emits
      `DEPOSIT_REFUND_FAILED`, and leaves `refundedAt` unset; `retryRefund` then settles it.
- [ ] `cancelProtection` refunds a held deposit in full, refunds a waiver fee in full, lands
      `cancelled_refunded`, and refuses while a claim exists.
- [ ] A cancelled reservation in `deposit_pending` is never charged by `chargeDeposit`.
- [ ] `releaseDeposit` picks `deposit_released` / `deposit_partial` / `deposit_forfeited`
      from the arithmetic; `refundedAmount` equals `refundableAmount`; the live refund alert
      is resolved.
- [ ] `undoSettlement` restores `deposit_held` and keeps the deductions.
- [ ] `reassessOnExtension` is a no-op when the stay grows inside one band, and raises
      `PROTECTION_CHOICE_MISSING` when it crosses into the long-stay band. In both cases the
      existing `amount`, `coverageCap` and `termsText` are **unchanged**.
- [ ] **Exactly one `updateReservation` call per action**, and it carries the activity event.
- [ ] Nothing writes `priceDetails` or `folioItems`. Assert both fields are untouched after
      a full choose, charge, deduct, release cycle.

> ⚠️ The mock delays make real timers cost seconds per assertion. Use a `settle(() => call())`
> helper that fakes timers **before** the call, the only ordering that works against the
> 1.5s mock. Copy it from `tests/composables/useUpsellLockAccess.spec.ts`.

---

## Task 7: Worklist computeds and alert emission

**Files:**
- Modify: `app/composables/useDamageProtection.ts`
- Modify: `tests/composables/useDamageProtection.spec.ts`

### Steps

- [ ] One `rows` computed that is the single source for the worklist, the KPIs and the
      alerts, so the three can never disagree about what is overdue.

```ts
  export interface ProtectionRow {
    reservation: ReservationEntry
    policy: DamageProtectionPolicy
    protection: DamageProtection | null
    bucket: ProtectionBucket
    refundable: number
    deducted: number
    /** What the waiver pot paid out on this stay. Feeds the pricing read-out. */
    waiverPaid: number
  }

  const rows = computed<ProtectionRow[]>(() =>
    reservations.value
      .map((reservation) => {
        // A cancelled stay still produces a row: it may be owed a refund.
        // `blocked` and `owner_request` never do.
        if (reservation.status === 'blocked' || reservation.status === 'owner_request')
          return null
        const policy = policyFor(reservation.listingId, reservation.nights)
        if (!policy || !protectionOffered(policy, reservation.channel))
          return null
        const protection = reservation.damageProtection ?? null
        return {
          reservation,
          policy,
          protection,
          bucket: resolveBucket(protection ?? undefined, reservation.status),
          refundable: protection ? refundableAmount(protection) : 0,
          deducted: protection ? deductionTotal(protection) : 0,
          waiverPaid: protection ? waiverPotTotal(protection) : 0,
        }
      })
      .filter((r): r is ProtectionRow => r !== null),
  )
```

- [ ] Bucket computeds: `awaitingChoice`, `chargeDue`, `failed`, `held`, `refundDue`,
      `refundOverdue`, `settled`, each a filter over `rows`.
- [ ] Per-currency totals, never blended:

```ts
  /** One entry per currency. There is deliberately no single `amount` field. */
  function totalsByCurrency(subset: ProtectionRow[], pick: (r: ProtectionRow) => number) {
    const map = new Map<string, number>()
    for (const row of subset) {
      const currency = row.protection?.currency ?? row.policy.currency
      map.set(currency, (map.get(currency) ?? 0) + pick(row))
    }
    return [...map.entries()].map(([currency, amount]) => ({ currency, amount }))
  }

  const heldTotals = computed(() => totalsByCurrency(held.value, r => r.refundable))
  const refundDueTotals = computed(() => totalsByCurrency(
    [...refundDue.value, ...refundOverdue.value], r => r.refundable,
  ))

  /**
   * Fees collected against claims paid, per currency. The only place the
   * operator can see whether the waiver is priced right. Without it the pot is
   * sold blind.
   */
  const waiverPotTotals = computed(() => {
    const waivers = rows.value.filter(r => r.protection?.option === 'waiver')
    return {
      collected: totalsByCurrency(waivers, r => r.protection?.amount ?? 0),
      paidOut: totalsByCurrency(waivers, r => r.waiverPaid),
    }
  })
```

> ⚠️ **No currency conversion, ever.** Same rule as the folio, city tax and owner
> statements. An invented exchange rate on a guest's refund is worse than two rows.

- [ ] `emitProtectionAlerts()`, modelled on `emitCityTaxAlerts`. For each row:
      `awaiting_choice` within 24h of check-in emits `PROTECTION_CHOICE_MISSING`;
      `refund_due` emits `DEPOSIT_REFUND_DUE`; `refund_overdue` emits
      `DEPOSIT_REFUND_OVERDUE`. Skip a type already live for that reservation so the button
      is safe to press twice.

### Tests

- [ ] Bucketing across a fixture set covering every state.
- [ ] A listing with no assigned policy produces no row at all.
- [ ] An Airbnb booking on a policy that does not offer Airbnb produces no row.
- [ ] Two reservations in different currencies produce two total entries, never a sum.
- [ ] `emitProtectionAlerts` emits one alert per qualifying row and is idempotent on a
      second call, and never emits a choice-missing alert for a cancelled stay.
- [ ] `waiverPotTotals` reports fees collected and claims paid separately, per currency,
      and never nets one against the other.

---

## Task 8: Settings, the policy library

**Files:**
- Create: `app/components/settings/DamageProtectionSettingsPanel.vue`
- Create: `app/components/damage-protection/ProtectionOptionCards.vue`
- Create: `app/pages/settings/damage-protection.vue`
- Modify: `app/components/settings/SidebarNav.vue`, `app/constants/menus.ts`

### Steps

- [ ] `app/pages/settings/damage-protection.vue` is a thin wrapper, exactly like
      `settings/cancellation-policies.vue`:

```vue
<template>
  <SettingsLayout wide>
    <SettingsDamageProtectionSettingsPanel />
  </SettingsLayout>
</template>
```

- [ ] `DamageProtectionSettingsPanel.vue`: a list of policy cards, each expanding to an
      editor with four groups.
  - **Basics**: name, currency `Select`, which options are offered (two `Checkbox`es, at
    least one required), default option `RadioGroup` restricted to what is offered.
  - **Waiver**: pricing `Select` (flat / per night / percent of subtotal), rate `Input`
    with a currency or `%` prefix, coverage cap, exclusions as a `TagsInput`.
  - **Deposit**: pricing `Select`, rate, charge lead days `NumberField`, refund SLA days
    `NumberField`.
  - **Channels**: three rows, one per `BookingChannel`, each a segmented control **Offer ·
    Skip**, with a helper line: "Channels you leave unset are skipped. Airbnb and
    Booking.com run their own guest damage programmes."
  - **Terms**: `termsVersion` `Input` and `termsText` `Textarea`, with a warning line:
    "Editing the terms does not change any booking that already accepted them. Bump the
    version so new acceptances are distinguishable."
- [ ] **Stay length band** on the policy editor: `minNights` / `maxNights` `NumberField`s
      with an "open ended" checkbox that sets `maxNights` to null, and a live summary line
      ("Applies to stays of 28 nights or more"). Saving a band that `overlappingBands`
      rejects shows an inline destructive error naming the band it collides with.
- [ ] **Long-stay validation** in the policy editor, gating save when `minNights >= 28`:
      - `waiver.maxAmount` is required for `per_night` and `percent_of_subtotal` pricing.
        Helper: "Without a ceiling, a 90-night stay computes an unbounded fee."
      - `deposit.maxAmount` is required for `percent_of_subtotal`.
      - `exclusions` must contain an entry naming normal wear and tear. Pre-fill it and warn
        if it is removed: over three months, deterioration is the argument the operator will
        actually have, and no waiver covers it.
- [ ] **Guide coverage warning** at the top of the panel, from `listingsMissingGuideSection()`:
      an amber block naming every listing with a policy but no enabled `damage_protection`
      section on its guide, with a link to that guide. Modelled on the stranded-selection
      panel in `PromoCodeFieldsScope.vue`: surfaced and named, never silently dropped.
- [ ] Listing assignment: reuse the inline picker pattern from `PromoCodeFieldsScope.vue`.
      **Inline list, no Popover**, search plus a visible-scoped bulk select, a count line,
      and no selected-item chips. A listing already assigned to another policy shows a lock
      badge and a disabled row, the same way `JurnalIntegration.vue` locks Bexio-mapped
      listings.
- [ ] `ProtectionOptionCards.vue`: props `{ options: ProtectionOptionView[], modelValue?: ProtectionOption, readonly?: boolean }`.
      Two cards side by side on desktop, stacked under `sm:`. Each states its own case:
      - Waiver: amount, "Covers accidental damage up to {cap}", "Non-refundable", "Pay with
        any method", then the exclusions list verbatim.
      - Deposit: amount, "Charged {chargeDueAt}", "Refunded within {n} days of check-out",
        "You remain responsible for damage above {amount}".
      The settings panel renders it `readonly` as a live preview, so the operator sees
      exactly what the guest will.

> ⚠️ **No deposit handling fee, and no artificial friction copy.** A real charge already
> makes the waiver the better deal. Anything added on top is a dark pattern and the spec
> rules it out.

### Verification

- [ ] Settings nav shows **Damage Protection** next to Cancellation Policies.
- [ ] Editing a policy and reloading the page keeps the change (LocalStorage).
- [ ] A listing cannot be assigned to two policies.

---

## Task 9: The guest choice screen

**Files:**
- Create: `guide-app/app/components/sections/DamageProtectionSection.vue`
- Create: `guide-app/app/components/forms/DamageProtectionForm.vue`
- Create: `server/api/guest-guides/by-token/[token]/protection-choice.post.ts`
- Modify: `guide-app/app/pages/[token].vue`
- Create: `tests/components/guest-guides/DamageProtectionForm.spec.ts`

### Steps

- [ ] Register the section. `guide-app/app/pages/[token].vue` holds a component map at
      lines 90-102; add `damage_protection: DamageProtectionSection` and the import.
      `PreArrivalSection` is handled specially at line 154 because it embeds a form; this
      section follows the **same** shape, so copy that branch rather than the plain map
      entry.
- [ ] `DamageProtectionForm.vue` renders:
      - The two option cards, the policy's `defaultOption` pre-selected.
      - The exclusions list verbatim under the waiver card.
      - The refund-destination fields, shown **only** when deposit is selected on a non-card
        rail: account name, account number, bank name.
      - On a long-stay band, one extra line under the deposit card: "Claims may be
        recorded during your stay at each scheduled cleaning, not only at check-out." A
        three-month guest must not first hear this at the end.
      - The terms text in a bordered scroll box, then an acceptance `Checkbox` with a
        sibling `<Label for>`. **Never wrap the checkbox in the label**, it double-toggles.
      - A submit button disabled until `isChoiceValid` passes, and an inline error line in
        destructive red naming the missing field.
- [ ] Once submitted the form renders a read-only confirmation: what was chosen, the amount,
      when the deposit charges, when the refund is due. It does not offer a change, because
      a second acceptance would need a second freeze and the guest can call the host.
- [ ] `protection-choice.post.ts`, modelled on `submit-id.post.ts`:

```ts
// The token identifies the reservation. The body NEVER names one.
const token = getRouterParam(event, 'token')
const body = await readBody(event)
// resolve link -> reservationId, then record the choice
```

> ⚠️ **The request body must not accept a `reservationId`.** Same access model as
> `saveForCurrentOwner` in `useOwnerPayoutDetails`: a public endpoint that cannot be talked
> into writing another booking's record, because it never accepts an id. A reviewer should
> be able to grep this file for `reservationId` and find it only on the resolved link.

- [ ] Persist to `GuideSubmission.protectionChoice` and call `recordChoice(..., 'guest_guide')`.

### Tests (`tests/components/guest-guides/DamageProtectionForm.spec.ts`)

- [ ] Both cards render priced from one `buildOptions` call, and the default is pre-selected.
- [ ] Submit is disabled until the terms checkbox is ticked.
- [ ] Bank fields are absent for a waiver, absent for a card deposit, present and required
      for a non-card deposit.
- [ ] Every exclusion string renders verbatim.
- [ ] After submit the form renders the confirmation and no longer renders the cards as
      selectable.

> Register the shadcn primitives in `global.components`, or an unresolved `Input` renders
> `<input model-value="...">` and every value assertion passes for the wrong reason.

---

## Task 10: The reservation section

**Files:**
- Create: `app/components/reservations/ReservationDamageProtectionSection.vue`
- Create: `app/components/reservations/ProtectionClaimDialog.vue`
- Create: `app/components/reservations/ProtectionChoiceDialog.vue`
- Modify: `app/components/reservations/ReservationDetailSheet.vue`
- Create: `tests/components/reservations/ReservationDamageProtection.spec.ts`

### Steps

- [ ] Mount it in `ReservationDetailSheet.vue` **directly after**
      `<ReservationCityTaxSection :reservation="reservation" />` (currently line 596), so the
      sheet reads price, rooms, folio, city tax, protection: one money story top to bottom.
      Import it explicitly at the top of the file, next to the city tax import (line 9).
- [ ] The section is an `AccordionItem value="damage-protection"`. It renders nothing at all
      when `bucketFor(id) === 'not_offered'`. A skipped channel must not leave an empty
      accordion row.
- [ ] Per bucket:
  - **`awaiting_choice`**: the two option cards `readonly`, a line saying when the guest was
    asked and how long until check-in, and **Record choice for guest** opening
    `ProtectionChoiceDialog` (writes `acceptedVia: 'staff'`). Staff answer this on the phone.
  - **`waiver_active`**: amount, coverage cap, exclusions, accepted date, terms version, and
    the claim list with **Record claim**. A waiver claim moves no money; it is recorded so
    the pot can be priced. There is no release action, because there is nothing held.
  - **`deposit_pending`**: amount, "Charges {date}", **Charge now**, plus a small
    **Simulate decline** switch next to it. The switch is the only way to reach the failure
    path in a mock, the same device onboarding uses.
  - **`deposit_failed`**: the decline reason and attempt count in destructive styling,
    **Retry charge** and **Switch to waiver**.
  - **`deposit_held`**: amount held, refund due date, the claim list with a notified /
    not-notified marker per claim, **Record claim**, **Notify guest** and **Release
    deposit**. Release is disabled while `canRelease` returns `claim_not_notified`, with the
    reason rendered next to it rather than as a silent disabled button.
  - **`refund_failed`**: `refundFailureReason` in destructive styling, **Retry refund** and
    **Edit refund destination**.
  - **`cancelled_refunded`**: what was returned and when. No actions.
  - **settled**: the arithmetic spelled out as its own lines, `Deposit 500.00`, one line per
    deduction, `Refunded 420.00`, plus **Undo**. Staff get challenged on this and need the
    working visible, the same reasoning as the city tax section.
- [ ] `ProtectionClaimDialog.vue`: label `Input`, amount `Input` with the currency prefix
      and a helper reading "At most {refundable} remains", reason `Textarea`, evidence upload
      (multiple, images and PDF). A live line shows the `claimCoverage` split: what the
      protection absorbs and what becomes excess for the folio. Save is disabled until
      `isClaimValid` passes, with an
      inline destructive error line naming the missing field. Modelled on
      `FolioVoidDialog.vue`.
- [ ] ⚠️ The section clears its `claimTargetId` whenever the dialog closes, confirmed or
      cancelled, so a stale target cannot outlive the dialog that set it. This is the exact
      bug already fixed in `ReservationFolioSection.vue`.

### Tests

- [ ] `not_offered` renders nothing.
- [ ] Each of the other buckets renders its own action set, asserted by accessible name.
- [ ] `deposit_failed` renders both Retry and Switch to waiver; `refund_failed` renders
      Retry refund and Edit refund destination.
- [ ] `waiver_active` renders Record claim and **no** Release action.
- [ ] The settled state renders one line per claim and a refunded total equal to
      `refundableAmount`.
- [ ] Record-claim is disabled with a blank reason and enabled once valid.
- [ ] **Release deposit** is disabled while a claim is unnotified, and the section renders
      **Notify guest** in its place with the refusal reason visible.

> A `Button` stub must not re-emit `click`: the parent handler already falls through onto
> the stub root and would fire twice. Register auto-imported children in `global.components`.

---

## Task 11: The status chip

**Files:**
- Create: `app/components/damage-protection/DamageProtectionStatusChip.vue`
- Modify: `app/components/reservations/ReservationTable.vue`

### Steps

- [ ] One chip component, props `{ bucket: ProtectionBucket, refundable?: number, currency?: string }`,
      used by both the reservations table and the worklist so the vocabulary cannot drift.

| Bucket | Label | Classes |
|---|---|---|
| `not_offered` | (renders nothing) | |
| `awaiting_choice` | Awaiting choice | `border-amber-500/30 bg-amber-500/10 text-amber-700` |
| `charge_due` | Charge due | `border-amber-500/30 bg-amber-500/10 text-amber-700` |
| `failed` | Charge failed | `border-destructive/30 bg-destructive/10 text-destructive` |
| `held` | Deposit held | `border-blue-500/30 bg-blue-500/10 text-blue-700` |
| `refund_due` | Refund due | `border-amber-500/30 bg-amber-500/10 text-amber-700` |
| `refund_overdue` | Refund overdue | `border-destructive/30 bg-destructive/10 text-destructive` |
| `settled` (waiver) | Waiver | `border-blue-500/30 bg-blue-500/10 text-blue-700` |
| `settled` (deposit) | Refunded | `border-green-500/30 bg-green-500/10 text-green-700` |

- [ ] Add it to `ReservationTable.vue` in the existing status cell, next to the city tax
      chip, following `CityTaxStatusChip` placement exactly.

---

## Task 12: The worklist page

**Files:**
- Create: `app/pages/damage-protection/index.vue`
- Create: `app/components/damage-protection/DamageProtectionTable.vue`
- Modify: `app/constants/menus.ts`

### Steps

- [ ] Gate the page and the sidebar entry on the new `damage_protection` module's
      `dashboardView`, and gate every money action (**Record claim**, **Release deposit**,
      **Bulk release**) on its `dashboardEdit`. Reading a stay must not imply the right to
      take money from it, and module-level view/edit is the only permission primitive this
      app has.
- [ ] Sidebar entry directly under **Guest Registration** (`constants/menus.ts:69-74`):

```ts
      {
        title: 'Damage Protection',
        icon: 'i-lucide-shield-check',
        link: '/damage-protection',
        new: true,
      },
```

- [ ] Header KPIs, each broken out **per currency**: Awaiting choice, Charge due, Failed,
      Refund due, Held now, and **Waiver pot** rendered as fees collected against claims paid,
      never netted into one figure. A KPI with two currencies renders two lines, never a sum.
- [ ] Tabs: Awaiting choice · Charge due · Failed · Held · Refund due · Settled. `Failed`
      carries both a failed charge and a failed refund; the row says which.
- [ ] Table columns: guest, property, channel, check-in, check-out, option, amount,
      deducted, refundable, status chip, actions. Row click opens the reservation detail
      sheet, so there is exactly one place the work gets done.
- [ ] Filters: property, channel, option, date range, search by guest.
- [ ] **Bulk release** on row selection, using the `clearKey` checkbox pattern the finance
      tables use:

```ts
const clearKey = ref(0)
function clearSelection() {
  selected.value = []
  clearKey.value++
}
```
```vue
<Checkbox :key="`${rowId}-${clearKey}`" :model-value="isSelected(id)" @click.stop="toggleRow(id)" />
```

      reka-ui `CheckboxRoot` ignores external state changes after first render; without the
      key the boxes stay ticked after a clear.
- [ ] A **Check for alerts** button calling `emitProtectionAlerts()`, matching how Smart Lock,
      Minut and city tax surface their mock events.
- [ ] Wrap the table in `<ClientOnly>` with a skeleton fallback, the same as
      `listings/index.vue` and `inbox.vue`: without it, adjacent icon-bearing columns reuse
      each other's DOM nodes across hydration.

---

## Task 13: Seed the demo so the feature is visible

**Files:**
- Modify: `app/composables/useDamageProtection.ts` (seed constants)
- Modify: `app/components/reservations/data/reservations.ts` (a few seeded stays)

### Steps

- [ ] Three seed policies:
  - `dp-bali-standard`: USD, offers both, defaults to waiver. Waiver flat 39 with a 2,000
    cap and four exclusions (intentional damage, pets, smoking, missing items). Deposit flat
    500, 3-day charge lead, 7-day refund SLA. `channelPolicy: { Direct: 'offer' }`.
  - `dp-bali-deposit-only`: USD, offers deposit only, for a villa where the operator does
    not want to carry waiver risk. Same channel policy.
  - `dp-bali-long-stay`: USD, **offers the waiver only**. Flat 249 with a 5,000 cap, and an
    exclusions list whose first entry names normal wear and tear. Banded `minNights: 28`,
    `maxNights: null`.

> ⚠️ **Do not seed a long-stay deposit.** Whether a months-long held deposit is a tenancy
> deposit rather than a hospitality one is an open legal question per market (Bali, Germany,
> Switzerland). Waiver-only is the safe default until counsel answers, and it happens to be
> the option the operator wants chosen anyway.
- [ ] Assign `dp-bali-standard` (band 1-27) and `dp-bali-long-stay` (band 28-null) to the
      same four or five Direct-heavy listings, so one listing demonstrably serves both
      bands. Assign `dp-bali-deposit-only` (band 1-27) to one listing, and leave the rest
      unassigned so the "no policy" state is visible too.
- [ ] Seed five reservations so every bucket is reachable on first load without clicking:
  - one `awaiting_choice` checking in in two days (so `PROTECTION_CHOICE_MISSING` fires)
  - one `waiver_active`
  - one `deposit_pending` with `chargeDueAt` already passed (so it shows as **Charge due**)
  - one `deposit_held` with `refundDueAt` in the past (so it shows **Refund overdue**) and
    one notified claim with evidence, to demonstrate the partial release arithmetic
  - one `deposit_released`
  - one **60-night stay** on a dual-band listing, resolving to `dp-bali-long-stay`, in
    `waiver_active` **with one recorded claim**, so both the band lookup and the waiver pot
    read-out are visible on first load
  - one **cancelled** stay still holding a deposit, so the immediate-refund rule shows up in
    the worklist rather than needing to be provoked
  - one `refund_failed` with a reason, so the retry path is reachable
  - one `deposit_held` carrying an **unnotified** claim, so Release is visibly blocked behind
    Notify guest
- [ ] One Airbnb reservation on a policy-assigned listing, left with no `damageProtection` at
      all, so the `'skip'` channel fallback is visible as "nothing renders".
- [ ] One **owner stay** (`status: 'owner_request'`) and one **block**
      (`status: 'blocked'`) on a policy-assigned Direct listing, both with no protection, so
      the status gate is visible as "nothing renders" rather than as an owner being asked to
      buy a waiver for their own villa.

> ⚠️ Seed dates must be **relative to today**, computed at module load, never fixed
> ISO dates. Every bucket boundary is evaluated against the current day, so a fixed fixture
> silently rots into a stay that already ended.

---

## Task 14: Documentation

**Files:**
- Modify: `CLAUDE.md`

### Steps

- [ ] Add a section after **City Tax Collection**, matching that section's voice: state the
      decisions and the traps, not the file listing. It must carry:
  - Why a deposit is a real charge and not an authorization hold, with the 7-day and
    QRIS/VA/e-wallet reasons in one line each.
  - That card-on-file is a risk control and never a guest-facing option.
  - That it is a waiver, never insurance, and why (OJK licensing).
  - That `channelPolicy` falls back to `'skip'`, the opposite of city tax, and why.
  - That `amount`, `coverageCap` and `termsText` are frozen at acceptance.
  - That nothing writes `priceDetails`, with both reasons (held money, and
    `folio.commit()` replacing `extras` outright).
  - That `refundDestination` is collected on the choice screen, not at checkout, because
    non-card rails often cannot reverse to source.
  - No currency conversion, ever.
  - That a claim is recorded on BOTH paths, and why: `waiverPotTotal` is the only signal
    that says whether the fee is priced right.
  - That a deposit cannot be released while a claim is unnotified, and why (a deduction the
    guest first meets as a smaller refund is a chargeback).
  - That protection is gated on reservation status as well as channel, so an owner stay and
    a maintenance block are never offered it.
  - That a cancellation refunds in full on both paths and admits no claim, and that this
    deliberately does not reuse the upsell cancellation ladder.
  - That `refund_failed` exists because a refund that silently reads as settled is the worst
    way to lose a guest's money.
  - That moving money sits behind `damage_protection.dashboardEdit`, not reservations edit.
  - That policy currency is checked against the payout account at assignment time.
  - That a policy with no matching guide section is a silent no-op, surfaced as a warning.
  - That a long stay is a different product: bands live on the assignment and not as price
    tiers, `policyFor` takes `nights`, long-stay bands ship waiver-only pending a per-market
    legal answer on tenancy deposits, wear and tear must be an explicit exclusion, and there
    is deliberately no recurring waiver billing.
  - The test file list and counts.
  - The "NOT implemented (intentionally out of scope)" list, copied from the spec.
- [ ] Add `useDamageProtection` to the Composables Reference table.
- [ ] Add the new files to the File Structure block.

---

## Done criteria

- [ ] `npx vitest run tests/lib/damage-protection.spec.ts tests/composables/useDamageProtection.spec.ts tests/components/reservations/ReservationDamageProtection.spec.ts tests/components/guest-guides/DamageProtectionForm.spec.ts` passes.
- [ ] The full suite still passes: `npx vitest run`.
- [ ] Typecheck passes.
- [ ] A guest opening a seeded guide link sees two priced options, picks the deposit, is
      asked for bank details, accepts the terms, and the reservation sheet shows
      `deposit_pending` with a charge date.
- [ ] Charging, deducting with evidence, and releasing produce three activity entries in the
      reservation timeline, in order, oldest first.
- [ ] `/damage-protection` shows every bucket populated from the seed, and **Check for
      alerts** puts `PROTECTION_CHOICE_MISSING` and `DEPOSIT_REFUND_OVERDUE` in the bell.
- [ ] Grep confirms the invariants:
  - `grep -rn "capture: false\|authorization hold\|setup_intent" app/` returns nothing.
  - `grep -rn "insurance" app/ guide-app/ server/` returns nothing.
  - `useDamageProtection.ts` contains no `priceDetails` and no `folioItems`.
  - `grep -n "import .*useInbox" app/composables/useDamageProtection.ts` finds it only inside
    an `await import(...)`, never at the top level.
- [ ] Editing a policy after a guest accepted leaves that reservation's amount, cap and terms
      unchanged (covered by a test, but worth seeing once in the UI).
- [ ] The seeded 60-night stay resolves to the long-stay policy, is offered the waiver only,
      and renders the wear-and-tear exclusion verbatim. A 7-night stay on the same listing is
      offered both options.
- [ ] The seeded owner stay and block render no protection section at all.
- [ ] The seeded cancelled stay appears under Refund due immediately, with its check-out date
      still in the future.
- [ ] Release is blocked on the stay with an unnotified claim, names the reason, and unblocks
      after Notify guest.
- [ ] The worklist's Waiver pot KPI shows fees collected and claims paid as two figures.
- [ ] A role without `damage_protection` edit can open the worklist but cannot record a claim
      or release a deposit.
