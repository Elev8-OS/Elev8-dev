import type { ActivityEvent, ActivityEventColor } from '~/components/inbox/data/conversations'
import type { BookingChannel } from '~/components/listings/data/listings'
import type {
  DamageProtection,
  DepositPricing,
  ProtectionClaim,
  ProtectionOption,
  ProtectionState,
  ReservationEntry,
  ReservationStatus,
  SavedCard,
  WaiverPricing,
} from '~/components/reservations/data/reservations'

export type ProtectionCurrency = 'USD' | 'IDR' | 'EUR' | 'CHF'

/**
 * Below a calendar month, so a "monthly" booking lands above it. A long stay is
 * a different product, not a longer short stay: the exclusions differ, the
 * terms differ and the offered options differ.
 */
export const LONG_STAY_THRESHOLD_NIGHTS = 28

/**
 * ⚠️ There is no `defaultOption`. When a policy offers the waiver, the waiver is
 * ALWAYS listed first and pre-selected (`buildOptions`): a deposit that costs
 * the guest nothing upfront would otherwise be the obvious pick and empty the
 * waiver pot, so the deposit is the option a guest has to go out of their way
 * for. A policy cannot configure that away.
 */
export interface DamageProtectionPolicy {
  id: string
  name: string
  currency: ProtectionCurrency
  offers: ProtectionOption[]
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
    /** The most the saved card may be charged, not a sum collected upfront. */
    rate: number
    /** Ceiling on a percent result. Without it a 90-night stay is unbounded. */
    maxAmount?: number
    /**
     * Days after check-out by which the deposit is charged or closed. The
     * guest's card stays on file until then, so it is also a promise to them.
     */
    settleWithinDays: number
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

/** When the deposit must be charged or closed: check-out plus the policy's window. */
export function settleDueAt(
  reservation: Pick<ReservationEntry, 'checkOut'>,
  policy: DamageProtectionPolicy,
): string {
  return addDays(isoDay(reservation.checkOut), policy.deposit.settleWithinDays).toISOString()
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
  /** Deposit only: how long after check-out the card stays on file. */
  settleWithinDays?: number
  isDefault: boolean
}

/**
 * Where the deposit can be offered at all. A deposit is a card saved with
 * Stripe, so only a listing that settles on Stripe ('card') can take one.
 * QRIS, virtual account and e-wallet cannot be saved and charged later, so a
 * guest on any other rail is offered the waiver only.
 */
export type ProtectionRail = 'card' | 'non_card'

/**
 * The single source the guest screen, the settings preview and the staff dialog
 * all render from, so the three can never disagree on a number.
 *
 * ⚠️ The waiver comes first and is the default whenever it is offered. The
 * deposit is only listed where a card can be saved (`rail === 'card'`).
 */
export function buildOptions(
  policy: DamageProtectionPolicy,
  reservation: PricedStay,
  rail: ProtectionRail,
): ProtectionOptionView[] {
  const available = (['waiver', 'deposit'] as const).filter(option =>
    policy.offers.includes(option) && (option === 'waiver' || rail === 'card'))
  return available.map((option, index) => {
    const isDefault = index === 0
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
      settleWithinDays: policy.deposit.settleWithinDays,
      isDefault,
    }
  })
}

/**
 * The exact consent a guest gives for a charge after they have left. Frozen onto
 * the protection at acceptance (`chargeMandate`), because it is what answers a
 * chargeback, and it states the limits the guest is relying on: a ceiling, only
 * for damage, and only after being told.
 */
export function chargeMandateText(amount: number, currency: string, settleWithinDays: number): string {
  return `I authorise the property to keep this card on file and to charge it after check-out, up to ${formatProtectionAmount(amount, currency)}, only for damage recorded during my stay, only after I have been told what was found and why, and no later than ${settleWithinDays} days after check-out.`
}

// ---------------------------------------------------------------------------
// Totals. Each figure comes off its own source, never derived from another.
// ---------------------------------------------------------------------------

/** What the saved card is to be charged: the covered part of every claim. Zero on the waiver path. */
export function chargeableTotal(protection: DamageProtection): number {
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
 * its own source and never inferred from the chargeable total.
 */
export function waiverPotTotal(protection: DamageProtection): number {
  if (protection.option !== 'waiver')
    return 0
  return roundProtectionAmount(
    (protection.claims ?? []).reduce((sum, c) => sum + c.coveredAmount, 0),
    protection.currency,
  )
}

/** How much more the saved card may still be charged. Never negative. */
export function remainingCover(protection: DamageProtection): number {
  if (protection.option !== 'deposit')
    return 0
  return roundProtectionAmount(
    Math.max(0, protection.amount - chargeableTotal(protection)),
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
    ? remainingCover(protection)
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
    /** Card saved, stay not over yet. Nothing to do. */
    | 'on_file'
    /** Checked out: charge the claims or close it without a charge. */
    | 'decision_due'
    /** Past `settleDueAt` and still open. The guest was promised a decision by now. */
    | 'decision_overdue'
    /** The charge to the saved card was declined. */
    | 'failed'
    /** A cancelled stay whose waiver fee has not been returned yet. */
    | 'refund_due'
    | 'settled'

const SETTLED_STATES: ProtectionState[] = [
  'waiver_active',
  'deposit_released',
  'deposit_charged',
  'cancelled',
]

export function resolveBucket(
  protection: DamageProtection | undefined,
  stay: Pick<ReservationEntry, 'status' | 'checkOut'>,
  now: Date = new Date(),
): ProtectionBucket {
  if (!protection)
    return 'not_offered'

  // A cancelled stay admits no claim. A waiver fee is owed back; a saved card
  // is released straight away rather than kept on file for a stay that is not
  // happening. Neither waits for the check-out date.
  if (stay.status === 'cancelled') {
    if (protection.state === 'waiver_active')
      return 'refund_due'
    if (protection.state === 'card_on_file')
      return 'decision_due'
    return 'settled'
  }

  if (protection.state === 'awaiting_choice')
    return 'awaiting_choice'
  if (protection.state === 'charge_failed')
    return 'failed'
  if (SETTLED_STATES.includes(protection.state))
    return 'settled'

  // card_on_file
  if (isoDay(stay.checkOut).getTime() > now.getTime())
    return 'on_file'
  if (protection.settleDueAt && new Date(protection.settleDueAt).getTime() <= now.getTime())
    return 'decision_overdue'
  return 'decision_due'
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ProtectionChoiceDraft {
  option: ProtectionOption
  termsAccepted: boolean
  /** Deposit: the card already saved with the gateway. */
  card?: SavedCard
  /** Deposit: the guest agreed to `chargeMandateText`. */
  chargeConsent?: boolean
}

export function isChoiceValid(
  draft: ProtectionChoiceDraft,
  policy: DamageProtectionPolicy,
  rail: ProtectionRail,
  stay: PricedStay,
): boolean {
  if (!buildOptions(policy, stay, rail).some(o => o.option === draft.option))
    return false
  if (!draft.termsAccepted)
    return false
  if (draft.option === 'waiver')
    return true
  return Boolean(draft.card?.paymentMethodId && draft.chargeConsent)
}

// ---------------------------------------------------------------------------
// The card form (mock). In production Stripe Elements owns these fields and
// hands back a PaymentMethod; the number never reaches this app or its server.
// ---------------------------------------------------------------------------

export interface CardInput {
  number: string
  /** "MM/YY" */
  expiry: string
  cvc: string
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, '')
}

/** The Luhn checksum every card number carries. A transposed digit fails it. */
export function passesLuhn(number: string): boolean {
  const digits = digitsOf(number)
  if (digits.length < 12)
    return false
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9)
        d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export function cardBrand(number: string): string {
  const digits = digitsOf(number)
  if (digits.startsWith('4'))
    return 'visa'
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits))
    return 'mastercard'
  if (/^3[47]/.test(digits))
    return 'amex'
  return 'card'
}

function parseExpiry(expiry: string): { month: number, year: number } | null {
  const match = expiry.trim().match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/)
  if (!match)
    return null
  const month = Number(match[1])
  const rawYear = Number(match[2])
  const year = rawYear < 100 ? 2000 + rawYear : rawYear
  if (month < 1 || month > 12)
    return null
  return { month, year }
}

/** Why the card cannot be saved as typed, or null. */
export function cardInputError(input: CardInput, now: Date = new Date()): string | null {
  const digits = digitsOf(input.number)
  if (digits.length < 12 || digits.length > 19 || !passesLuhn(digits))
    return 'Check the card number.'
  const expiry = parseExpiry(input.expiry)
  if (!expiry)
    return 'Enter the expiry as MM/YY.'
  // A card is valid through the last day of its expiry month.
  const lastValid = new Date(expiry.year, expiry.month, 0, 23, 59, 59)
  if (lastValid.getTime() < now.getTime())
    return 'This card has expired.'
  if (!/^\d{3,4}$/.test(input.cvc.trim()))
    return 'Enter the 3 or 4 digit security code.'
  return null
}

/**
 * What the gateway hands back for a saved card: a reference plus what may be
 * printed. ⚠️ Nothing of `input` survives except the last four digits.
 */
export function savedCardFrom(input: CardInput, paymentMethodId: string, savedAt: Date = new Date()): SavedCard {
  const digits = digitsOf(input.number)
  const expiry = parseExpiry(input.expiry)!
  return {
    provider: 'stripe',
    paymentMethodId,
    brand: cardBrand(digits),
    last4: digits.slice(-4),
    expMonth: expiry.month,
    expYear: expiry.year,
    savedAt: savedAt.toISOString(),
  }
}

/** "Visa •••• 4242, expires 12/28" */
export function formatSavedCard(card: SavedCard): string {
  const brand = card.brand === 'card' ? 'Card' : card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
  return `${brand} •••• ${card.last4}, expires ${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`
}

export type ClaimDraft = Pick<ProtectionClaim, 'label' | 'amount' | 'reason' | 'evidenceUrls' | 'cleaningReport'>

/**
 * Evidence is an upload OR a cleaning report finding, either one on its own.
 * A housekeeper's written report of damage found at turnover is evidence the
 * guest can be shown; demanding a photo on top of it would push staff to
 * re-photograph a lamp that has already been thrown away.
 */
export function hasClaimEvidence(draft: Pick<ClaimDraft, 'evidenceUrls' | 'cleaningReport'>): boolean {
  return draft.evidenceUrls.length > 0 || Boolean(draft.cleaningReport)
}

/**
 * Deliberately does NOT cap the amount at the remaining cover. A claim records
 * the real assessed damage and `claimCoverage` decides how much is absorbed;
 * capping at input time would shrink the operator's own record of what a stay
 * cost, which is the number the waiver is priced from.
 */
export function isClaimValid(draft: ClaimDraft): boolean {
  if (!draft.label.trim() || !draft.reason.trim())
    return false
  if (!hasClaimEvidence(draft))
    return false
  return draft.amount > 0
}

/**
 * One line naming what backs a claim, for the claim card and the guest notice.
 * Empty when there is nothing, which a valid claim never is.
 */
export function claimEvidenceSummary(claim: Pick<ProtectionClaim, 'evidenceUrls' | 'cleaningReport'>): string {
  const parts: string[] = []
  if (claim.cleaningReport) {
    const date = new Date(claim.cleaningReport.reportedAt)
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    const photos = claim.cleaningReport.photoUrls?.length ?? 0
    const withPhotos = photos > 0 ? ` with ${photos} ${photos === 1 ? 'photo' : 'photos'}` : ''
    parts.push(`${claim.cleaningReport.cleaningLabel.toLowerCase()} report of ${date}${withPhotos}`)
  }
  const files = claim.evidenceUrls.length
  if (files > 0)
    parts.push(`${files} ${files === 1 ? 'file' : 'files'}`)
  return parts.join(', ')
}

export type SettleRefusal = 'not_a_deposit' | 'nothing_on_file' | 'claim_not_notified'

/**
 * A charge the guest first learns about from their card statement is a
 * chargeback. Nothing is charged, and nothing closed, until the guest has been
 * told about every claim: closing would also stamp the record as final.
 */
export function canSettle(
  protection: DamageProtection,
): { ok: true } | { ok: false, reason: SettleRefusal } {
  if (protection.option !== 'deposit')
    return { ok: false, reason: 'not_a_deposit' }
  if (protection.state !== 'card_on_file' && protection.state !== 'charge_failed')
    return { ok: false, reason: 'nothing_on_file' }
  const unnotified = (protection.claims ?? []).some(c => !c.guestNotifiedAt)
  return unnotified ? { ok: false, reason: 'claim_not_notified' } : { ok: true }
}

/** Where settling lands, read off the arithmetic, never a flag. */
export function settleOutcome(protection: DamageProtection): 'deposit_released' | 'deposit_charged' {
  return chargeableTotal(protection) === 0 ? 'deposit_released' : 'deposit_charged'
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export type ProtectionEventKind
  = | 'chosen'
    | 'claimed'
    | 'notified'
    | 'charged'
    | 'charge_failed'
    | 'released'
    | 'cancelled'
    | 'undone'
    | 'partner_update'

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
      description: protection.option === 'waiver'
        ? `Waiver ${money}`
        : `Card saved for up to ${money}${protection.card ? `, ${formatSavedCard(protection.card)}` : ''}`,
      colorDot: 'blue',
    },
    claimed: { title: 'Damage claim recorded', description: detail ?? '', colorDot: 'gold' },
    notified: { title: 'Guest notified of claim', description: detail ?? '', colorDot: 'blue' },
    charged: { title: 'Saved card charged', description: detail ?? '', colorDot: 'green' },
    charge_failed: { title: 'Card charge declined', description: detail ?? 'Declined', colorDot: 'gold' },
    released: { title: 'Deposit closed without a charge', description: detail ?? '', colorDot: 'green' },
    cancelled: {
      title: 'Protection cancelled with the stay',
      description: detail ?? '',
      colorDot: 'green',
    },
    undone: { title: 'Closing undone', description: detail ?? '', colorDot: 'gray' },
    partner_update: { title: 'Insurance claim update', description: detail ?? '', colorDot: 'blue' },
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

// ---------------------------------------------------------------------------
// Settings: the two stay-length slots a listing is set up with
// ---------------------------------------------------------------------------

/**
 * The settings page offers every listing two slots, short stays (under
 * `LONG_STAY_THRESHOLD_NIGHTS`) and long stays (at or over it), instead of
 * free-form night ranges. The data model still stores bands; a listing whose
 * bands are anything other than those two ranges is `custom`, shown read-only
 * until it is reset to the standard slots.
 */
export type StaySlot = 'short' | 'long'

export const SLOT_RANGES: Record<StaySlot, { minNights: number, maxNights: number | null }> = {
  short: { minNights: 1, maxNights: LONG_STAY_THRESHOLD_NIGHTS - 1 },
  long: { minNights: LONG_STAY_THRESHOLD_NIGHTS, maxNights: null },
}

export interface ListingSlots {
  short: string | null
  long: string | null
  /** The listing's bands are not the two standard ranges. */
  custom: boolean
}

export function listingSlots(assignments: DamageProtectionAssignment[], listingId: string): ListingSlots {
  const bands = assignments.filter(a => a.listingId === listingId)
  const isRange = (a: DamageProtectionAssignment, slot: StaySlot) =>
    a.minNights === SLOT_RANGES[slot].minNights && a.maxNights === SLOT_RANGES[slot].maxNights
  const short = bands.find(a => isRange(a, 'short'))
  const long = bands.find(a => isRange(a, 'long'))
  return {
    short: short?.policyId ?? null,
    long: long?.policyId ?? null,
    custom: bands.some(a => !isRange(a, 'short') && !isRange(a, 'long')),
  }
}

/**
 * The next terms version when the wording changes, so a booking that accepted
 * the old words stays distinguishable from one that accepted the new ones
 * without anybody having to remember to bump it. `v1` becomes `v2`; a version
 * that does not end in a number gets `-2`.
 */
export function bumpTermsVersion(version: string): string {
  const digits = version.match(/\d+$/)?.[0]
  if (digits)
    return `${version.slice(0, -digits.length)}${Number(digits) + 1}`
  return `${version || 'v'}-2`
}

/** A blank policy for the "New policy" button: waiver only, Direct only, nothing assigned. */
export function newPolicyDraft(currency: ProtectionCurrency, now: Date = new Date()): DamageProtectionPolicy {
  const stamp = now.toISOString()
  return {
    id: `dp-${now.getTime()}`,
    name: 'New policy',
    currency,
    offers: ['waiver'],
    waiver: { pricing: 'flat', rate: 0, coverageCap: 0, exclusions: [] },
    deposit: { pricing: 'flat', rate: 0, settleWithinDays: 7 },
    channelPolicy: { Direct: 'offer' },
    termsVersion: 'v1',
    termsText: '',
    createdAt: stamp,
    updatedAt: stamp,
  }
}

/**
 * Why a policy cannot be saved as it stands, one plain sentence each. Empty
 * means it can. `longStay` is whether any listing uses it for long stays.
 */
export function policyErrors(policy: DamageProtectionPolicy, longStay: boolean): string[] {
  const errors: string[] = []
  if (!policy.name.trim())
    errors.push('Give the policy a name.')
  if (policy.offers.length === 0)
    errors.push('Offer at least one option: the waiver, the deposit, or both.')
  if (policy.offers.includes('waiver')) {
    if (!(policy.waiver.rate > 0))
      errors.push('Set the waiver fee.')
    if (!(policy.waiver.coverageCap > 0))
      errors.push('Set how much the waiver covers.')
    if (policy.waiver.pricing !== 'flat' && policy.waiver.maxAmount === undefined && longStay)
      errors.push('Set a maximum waiver fee: without one, a long stay computes an unbounded fee.')
    if (longStay && !policy.waiver.exclusions.some(e => /wear and tear/i.test(e)))
      errors.push('Name normal wear and tear in what is not covered: over a long stay it is the argument you will actually have.')
  }
  if (policy.offers.includes('deposit')) {
    if (!(policy.deposit.rate > 0))
      errors.push('Set the most the guest\'s card may be charged.')
    if (!(policy.deposit.settleWithinDays >= 1))
      errors.push('Set how many days after check-out you decide on the deposit.')
    if (policy.deposit.pricing !== 'flat' && policy.deposit.maxAmount === undefined && longStay)
      errors.push('Set a maximum deposit: without one, a long stay computes an unbounded amount.')
  }
  if (!Object.values(policy.channelPolicy).includes('offer'))
    errors.push('Turn on at least one booking channel, or no guest is ever asked.')
  if (!policy.termsText.trim())
    errors.push('Write the terms the guest accepts.')
  return errors
}
