import type { ActivityEvent, ActivityEventColor } from '~/components/inbox/data/conversations'
import type { BookingChannel } from '~/components/listings/data/listings'
import type {
  DamageProtection,
  DepositPricing,
  ProtectionClaim,
  ProtectionOption,
  ProtectionRefundDestination,
  ProtectionState,
  ReservationEntry,
  ReservationStatus,
  WaiverPricing,
} from '~/components/reservations/data/reservations'

export type ProtectionCurrency = 'USD' | 'IDR' | 'EUR' | 'CHF'

/**
 * Below a calendar month, so a "monthly" booking lands above it. A long stay is
 * a different product, not a longer short stay: the exclusions differ, the
 * terms differ and the offered options differ.
 */
export const LONG_STAY_THRESHOLD_NIGHTS = 28

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
  /** Unset channels fall back to 'skip'. See `protectionOffered`. */
  channelPolicy: Partial<Record<BookingChannel, 'offer' | 'skip'>>
  termsVersion: string
  termsText: string
  createdAt: string
  updatedAt: string
}

/**
 * A listing carries one policy PER STAY-LENGTH BAND, not one policy. Bands on
 * one listing must not overlap; `maxNights: null` is the open-ended top band.
 */
export interface DamageProtectionAssignment {
  listingId: string
  policyId: string
  minNights: number
  maxNights: number | null
}

/** Round to the currency's minor unit. IDR amounts are whole already. */
export function roundProtectionAmount(value: number, currency: string): number {
  if (currency === 'IDR')
    return Math.round(value)
  return Math.round(value * 100) / 100
}

// ---------------------------------------------------------------------------
// Who is offered protection at all
// ---------------------------------------------------------------------------

/**
 * A stay that is not a guest stay is never protected, whatever the channel says.
 * `blocked` and `owner_request` are both channel 'Direct', the one channel a
 * policy is likely to set to 'offer'.
 */
export const GUEST_STAY_STATUSES: ReservationStatus[] = [
  'inquiry',
  'unverified',
  'verified',
  'checked_in',
  'checked_out',
]

export function isGuestStay(status: ReservationStatus): boolean {
  return GUEST_STAY_STATUSES.includes(status)
}

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
    .map(a => ({ from: a.minNights, to: a.maxNights ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.from - b.from)
  let previousTo = Number.NEGATIVE_INFINITY
  for (const band of bands) {
    if (band.from <= previousTo)
      return true
    previousTo = band.to
  }
  return false
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/** Structural, so a fixture prices without a whole ReservationEntry. */
export interface PricedStay {
  nights: number
  priceDetails?: { subtotal: number }
}

function subtotalOf(reservation: PricedStay): number {
  return reservation.priceDetails?.subtotal ?? 0
}

function capped(raw: number, maxAmount: number | undefined): number {
  const floored = Math.max(0, raw)
  return maxAmount === undefined ? floored : Math.min(floored, maxAmount)
}

export function waiverAmount(policy: DamageProtectionPolicy, reservation: PricedStay): number {
  const { pricing, rate, maxAmount } = policy.waiver
  const raw
    = pricing === 'flat'
      ? rate
      : pricing === 'per_night'
        ? rate * Math.max(0, reservation.nights)
        : subtotalOf(reservation) * (rate / 100)
  return roundProtectionAmount(capped(raw, maxAmount), policy.currency)
}

export function depositAmount(policy: DamageProtectionPolicy, reservation: PricedStay): number {
  const { pricing, rate, maxAmount } = policy.deposit
  const raw = pricing === 'flat' ? rate : subtotalOf(reservation) * (rate / 100)
  return roundProtectionAmount(capped(raw, maxAmount), policy.currency)
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** checkIn / checkOut are local calendar days, so they are parsed as local. */
function isoDay(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Clamped to now: a booking made two days before arrival with a three-day lead
 * must charge immediately, not in the past.
 */
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

// ---------------------------------------------------------------------------
// The two options, built once and rendered everywhere
// ---------------------------------------------------------------------------

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

/**
 * The single source the guest screen, the settings preview and the staff dialog
 * all render from, so the three can never disagree on a number.
 */
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

// ---------------------------------------------------------------------------
// Totals. Each figure comes off its own source, never derived from another.
// ---------------------------------------------------------------------------

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
  const covered = roundProtectionAmount(
    Math.min(Math.max(0, amount), headroom),
    protection.currency,
  )
  return {
    coveredAmount: covered,
    excessAmount: roundProtectionAmount(Math.max(0, amount - covered), protection.currency),
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type ProtectionBucket
  = | 'not_offered'
    | 'awaiting_choice'
    | 'charge_due'
    | 'failed'
    | 'held'
    | 'refund_due'
    | 'refund_overdue'
    | 'settled'

const SETTLED_STATES: ProtectionState[] = [
  'deposit_released',
  'deposit_partial',
  'deposit_forfeited',
  'cancelled_refunded',
]

const REFUND_WARNING_MS = 48 * 60 * 60 * 1000

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

  if (protection.state === 'awaiting_choice')
    return 'awaiting_choice'
  if (protection.state === 'waiver_active')
    return 'settled'
  if (protection.state === 'deposit_failed' || protection.state === 'refund_failed')
    return 'failed'
  if (SETTLED_STATES.includes(protection.state))
    return 'settled'

  if (protection.state === 'deposit_pending') {
    // Chosen but not yet due reads as upcoming, never as a task.
    return protection.chargeDueAt && new Date(protection.chargeDueAt) <= now
      ? 'charge_due'
      : 'held'
  }

  // deposit_held
  if (!protection.refundDueAt)
    return 'held'
  const due = new Date(protection.refundDueAt)
  if (due <= now)
    return 'refund_overdue'
  return due.getTime() - now.getTime() <= REFUND_WARNING_MS ? 'refund_due' : 'held'
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ProtectionRail = 'card' | 'non_card'

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
  rail: ProtectionRail,
): boolean {
  return draft.option === 'deposit' && rail === 'non_card'
}

export function isChoiceValid(
  draft: ProtectionChoiceDraft,
  policy: DamageProtectionPolicy,
  rail: ProtectionRail,
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

/**
 * Deliberately does NOT cap the amount at the remaining cover. A claim records
 * the real assessed damage and `claimCoverage` decides how much is absorbed;
 * capping at input time would shrink the operator's own record of what a stay
 * cost, which is the number the waiver is priced from.
 */
export function isClaimValid(draft: ClaimDraft): boolean {
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

/** Which settled state a release lands in, read off the arithmetic, never a flag. */
export function settledStateFor(protection: DamageProtection): ProtectionState {
  const deducted = deductionTotal(protection)
  if (deducted === 0)
    return 'deposit_released'
  return refundableAmount(protection) === 0 ? 'deposit_forfeited' : 'deposit_partial'
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export type ProtectionEventKind
  = | 'chosen'
    | 'charged'
    | 'charge_failed'
    | 'claimed'
    | 'notified'
    | 'released'
    | 'refund_failed'
    | 'cancelled'
    | 'undone'

export function formatProtectionAmount(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('de-CH', {
    minimumFractionDigits: currency === 'IDR' ? 0 : 2,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  })}`
}

export function protectionActivityEvent(
  kind: ProtectionEventKind,
  protection: DamageProtection,
  actor: string,
  detail?: string,
): ActivityEvent {
  const money = formatProtectionAmount(protection.amount, protection.currency)
  const map: Record<ProtectionEventKind, { title: string, description: string, colorDot: ActivityEventColor }> = {
    chosen: {
      title: 'Damage protection chosen',
      description: `${protection.option === 'waiver' ? 'Waiver' : 'Deposit'} ${money}`,
      colorDot: 'blue',
    },
    charged: { title: 'Deposit charged', description: money, colorDot: 'green' },
    charge_failed: { title: 'Deposit charge failed', description: detail ?? 'Declined', colorDot: 'gold' },
    claimed: { title: 'Damage claim recorded', description: detail ?? '', colorDot: 'gold' },
    notified: { title: 'Guest notified of claim', description: detail ?? '', colorDot: 'blue' },
    released: { title: 'Deposit released', description: detail ?? '', colorDot: 'green' },
    refund_failed: { title: 'Refund failed', description: detail ?? 'Rejected', colorDot: 'gold' },
    cancelled: { title: 'Protection refunded on cancellation', description: money, colorDot: 'green' },
    undone: { title: 'Settlement undone', description: detail ?? '', colorDot: 'gray' },
  }
  const meta = map[kind]
  return {
    // Built from the SAME kind that chose the title and colour: an id that
    // disagrees with the rendered text is the documented folio bug.
    id: `protection-${kind}-${protection.policyId}-${Date.now()}`,
    type: 'reservation',
    title: meta.title,
    description: meta.description,
    actor,
    timestamp: new Date().toISOString(),
    colorDot: meta.colorDot,
  }
}
