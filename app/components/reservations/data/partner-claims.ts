import type {
  DamageProtection,
  PartnerClaim,
  PartnerClaimEvent,
  PartnerClaimStatus,
  ProtectionClaim,
} from '~/components/reservations/data/reservations'
import { roundProtectionAmount } from '~/components/reservations/data/damage-protection'

/**
 * Insurance claims under the property manager's MASTER POLICY with a partner.
 *
 * The guest bought a waiver: we gave up the right to charge them for accidental
 * damage. What the waiver pot pays out, the property manager claims back from
 * its insurance partner, for the part above the contract's deductible, and the
 * partner pays by bank transfer into the account the tenant registered when it
 * activated the damage waiver (`tern-activation.ts`). The guest is never a party
 * to this and never sees it: to them it is a waiver, not insurance, which is
 * also what keeps us out of selling insurance (OJK licensing).
 *
 * Framework-free; `usePartnerClaims` owns the state and calls in.
 */

/**
 * The insurance partner integration. ⚠️ Elev8 integrates with the partner ONCE,
 * for every tenant: there is no per-tenant partner, contract or API key. What a
 * tenant does give is at ACTIVATION (`useTernActivation`): a billing card for
 * Elev8's per-stay fees and a bank account Tern pays claims into by transfer.
 */
export interface CoverPartner {
  id: string
  name: string
  policyNumber: string
  currency: string
  /** Borne by the waiver pot on every claim before the partner pays anything. */
  deductiblePerClaim: number
  /** The most the partner pays on one claim. Unset means no per-claim ceiling. */
  maxPerClaim?: number
  /** How long after approval the partner's contract says the money should arrive. */
  paymentTermsDays: number
}

// ---------------------------------------------------------------------------
// What can be claimed
// ---------------------------------------------------------------------------

export type PartnerEligibility
  = | { eligible: true, claimable: number, deductible: number, capped: boolean }
    | { eligible: false, reason: 'not_a_waiver' | 'currency_mismatch' | 'below_deductible', deductible: number }

/**
 * How much of a waiver claim goes to the partner: what the waiver covered,
 * minus the deductible, capped at the per-claim maximum. The excess the guest
 * owes separately is not the partner's business: it is invoiced to the guest.
 *
 * ⚠️ A claim at or below the deductible is NOT sent. The pot carries it, and
 * submitting a zero-value claim only costs the relationship an argument.
 */
export function partnerEligibility(
  protection: Pick<DamageProtection, 'option' | 'currency'>,
  claim: Pick<ProtectionClaim, 'coveredAmount'>,
  partner: Pick<CoverPartner, 'currency' | 'deductiblePerClaim' | 'maxPerClaim'>,
): PartnerEligibility {
  const deductible = partner.deductiblePerClaim
  if (protection.option !== 'waiver')
    return { eligible: false, reason: 'not_a_waiver', deductible }
  // No conversion, ever: a claim in another currency is not this policy's.
  if (protection.currency !== partner.currency)
    return { eligible: false, reason: 'currency_mismatch', deductible }
  const aboveDeductible = roundProtectionAmount(claim.coveredAmount - deductible, partner.currency)
  if (aboveDeductible <= 0)
    return { eligible: false, reason: 'below_deductible', deductible }
  const capped = partner.maxPerClaim !== undefined && aboveDeductible > partner.maxPerClaim
  return {
    eligible: true,
    claimable: capped ? partner.maxPerClaim! : aboveDeductible,
    deductible,
    capped,
  }
}

// ---------------------------------------------------------------------------
// The status machine
// ---------------------------------------------------------------------------

/**
 * Which status may follow which. A webhook that does not fit is refused, not
 * applied: out-of-order or replayed partner events must never move a claim
 * backwards, or forwards past a step that did not happen.
 */
const NEXT: Record<PartnerClaimStatus, (PartnerClaimStatus | 'info_sent')[]> = {
  submitting: ['submitted', 'submission_failed'],
  submission_failed: ['submitting', 'withdrawn'],
  submitted: ['under_review', 'info_requested', 'approved', 'partially_approved', 'rejected', 'withdrawn'],
  under_review: ['info_requested', 'approved', 'partially_approved', 'rejected', 'withdrawn'],
  info_requested: ['info_sent', 'rejected', 'withdrawn'],
  approved: ['payout_scheduled', 'paid'],
  partially_approved: ['payout_scheduled', 'paid'],
  payout_scheduled: ['paid'],
  paid: ['received'],
  rejected: [],
  received: [],
  withdrawn: [],
}

/** Statuses nothing further happens after. */
export const PARTNER_TERMINAL: PartnerClaimStatus[] = ['rejected', 'received', 'withdrawn']

export function canTransition(from: PartnerClaimStatus, to: PartnerClaimStatus | 'info_sent'): boolean {
  return NEXT[from].includes(to)
}

export interface PartnerEventPayload {
  id: string
  status: PartnerClaimStatus | 'info_sent'
  source: PartnerClaimEvent['source']
  at?: string
  note?: string
  partnerClaimRef?: string
  submissionError?: string
  infoRequest?: string
  approvedAmount?: number
  rejectionReason?: string
  payoutScheduledFor?: string
  paidAmount?: number
  payoutReference?: string
  receivedAmount?: number
}

export type PartnerEventRefusal = 'duplicate_event' | 'illegal_transition' | 'invalid_amount' | 'missing_reason'

/**
 * Apply one event to a claim, returning the next claim or why it was refused.
 * The single place a partner claim changes, so a staff action and a partner
 * webhook obey the same rules.
 *
 * - An event id already seen is a duplicate delivery and changes nothing.
 * - `info_sent` is our answer to an information request; it returns the claim
 *   to `under_review`, since the partner now has to look again.
 * - An approval cannot exceed what was claimed, and a rejection must say why.
 */
export function applyPartnerEvent(
  claim: PartnerClaim,
  event: PartnerEventPayload,
): { ok: true, claim: PartnerClaim } | { ok: false, reason: PartnerEventRefusal } {
  if (claim.events.some(e => e.id === event.id))
    return { ok: false, reason: 'duplicate_event' }
  if (!canTransition(claim.status, event.status))
    return { ok: false, reason: 'illegal_transition' }

  const at = event.at ?? new Date().toISOString()
  const logged: PartnerClaimEvent = {
    id: event.id,
    at,
    status: event.status,
    source: event.source,
    ...(event.note ? { note: event.note } : {}),
  }
  let next: PartnerClaim = { ...claim, events: [...claim.events, logged] }

  switch (event.status) {
    case 'submitting':
      next = { ...next, status: 'submitting', submissionError: undefined }
      break
    case 'submitted':
      next = { ...next, status: 'submitted', submittedAt: at, partnerClaimRef: event.partnerClaimRef ?? claim.partnerClaimRef }
      break
    case 'submission_failed':
      next = { ...next, status: 'submission_failed', submissionError: event.submissionError ?? 'The partner did not accept the claim' }
      break
    case 'under_review':
      next = { ...next, status: 'under_review' }
      break
    case 'info_requested':
      if (!event.infoRequest?.trim())
        return { ok: false, reason: 'missing_reason' }
      next = { ...next, status: 'info_requested', infoRequest: event.infoRequest.trim() }
      break
    case 'info_sent':
      next = { ...next, status: 'under_review' }
      break
    case 'approved':
    case 'partially_approved': {
      const amount = event.approvedAmount ?? claim.claimedAmount
      if (!(amount > 0) || amount > claim.claimedAmount)
        return { ok: false, reason: 'invalid_amount' }
      // Partial or full is read off the figure, never trusted from the event.
      next = { ...next, status: amount < claim.claimedAmount ? 'partially_approved' : 'approved', approvedAmount: amount }
      break
    }
    case 'rejected':
      if (!event.rejectionReason?.trim())
        return { ok: false, reason: 'missing_reason' }
      next = { ...next, status: 'rejected', rejectionReason: event.rejectionReason.trim() }
      break
    case 'payout_scheduled':
      next = { ...next, status: 'payout_scheduled', payoutScheduledFor: event.payoutScheduledFor }
      break
    case 'paid': {
      const amount = event.paidAmount ?? claim.approvedAmount ?? 0
      if (!(amount > 0))
        return { ok: false, reason: 'invalid_amount' }
      next = { ...next, status: 'paid', paidAmount: amount, paidAt: at, payoutReference: event.payoutReference }
      break
    }
    case 'received': {
      const amount = event.receivedAmount ?? claim.paidAmount ?? 0
      if (!(amount > 0))
        return { ok: false, reason: 'invalid_amount' }
      next = { ...next, status: 'received', receivedAmount: amount, receivedAt: at }
      break
    }
    case 'withdrawn':
      next = { ...next, status: 'withdrawn' }
      break
  }
  return { ok: true, claim: next }
}

/** A new claim, frozen against the contract and the payout account as they stand at submission. */
export function newPartnerClaim(
  partner: CoverPartner,
  claimable: number,
  payoutAccount: { id: string, accountName: string },
): PartnerClaim {
  return {
    payoutAccountId: payoutAccount.id,
    payoutAccountName: payoutAccount.accountName,
    partnerId: partner.id,
    partnerName: partner.name,
    policyNumber: partner.policyNumber,
    currency: partner.currency,
    claimedAmount: claimable,
    deductible: partner.deductiblePerClaim,
    status: 'submitting',
    events: [],
  }
}

/**
 * How far what arrived falls short of what was approved. Zero when it all came
 * in; positive when the partner paid less, or the bank took a fee on the way.
 */
export function payoutShortfall(claim: Pick<PartnerClaim, 'approvedAmount' | 'paidAmount' | 'receivedAmount' | 'currency'>): number {
  const expected = claim.approvedAmount ?? 0
  const arrived = claim.receivedAmount ?? claim.paidAmount
  if (arrived === undefined)
    return 0
  return Math.max(0, roundProtectionAmount(expected - arrived, claim.currency))
}

/** When the money is due, by the contract's payment terms, counted from approval. */
export function payoutDueAt(claim: Pick<PartnerClaim, 'events'>, partner: Pick<CoverPartner, 'paymentTermsDays'>): string | null {
  const approval = [...claim.events].reverse().find(e => e.status === 'approved' || e.status === 'partially_approved')
  if (!approval)
    return null
  const due = new Date(approval.at)
  due.setDate(due.getDate() + partner.paymentTermsDays)
  return due.toISOString()
}

// ---------------------------------------------------------------------------
// The worklist
// ---------------------------------------------------------------------------

export type PartnerBucket
  = | 'to_submit'
    | 'action_needed'
    | 'with_partner'
    | 'awaiting_payout'
    | 'to_confirm'
    | 'closed'

/**
 * Where a claim sits for the people chasing the money:
 * - `to_submit`: eligible and never filed (or withdrawn and refilable later is
 *   deliberately not offered: a withdrawal is a decision);
 * - `action_needed`: the partner is waiting on us (information), or our
 *   submission failed;
 * - `with_partner`: the partner has it;
 * - `awaiting_payout`: approved, money not yet sent;
 * - `to_confirm`: the partner says it paid; staff confirm it arrived;
 * - `closed`: received, rejected or withdrawn.
 */
export function partnerBucket(claim: PartnerClaim | undefined): PartnerBucket {
  if (!claim)
    return 'to_submit'
  switch (claim.status) {
    case 'submission_failed':
    case 'info_requested':
      return 'action_needed'
    case 'submitting':
    case 'submitted':
    case 'under_review':
      return 'with_partner'
    case 'approved':
    case 'partially_approved':
    case 'payout_scheduled':
      return 'awaiting_payout'
    case 'paid':
      return 'to_confirm'
    default:
      return 'closed'
  }
}

export const PARTNER_STATUS_LABELS: Record<PartnerClaimStatus, string> = {
  submitting: 'Submitting',
  submission_failed: 'Submission failed',
  submitted: 'Submitted',
  under_review: 'Under review',
  info_requested: 'Information requested',
  approved: 'Approved',
  partially_approved: 'Partially approved',
  rejected: 'Rejected',
  payout_scheduled: 'Payout scheduled',
  paid: 'Paid by partner',
  received: 'Received in account',
  withdrawn: 'Withdrawn',
}

export const PARTNER_EVENT_LABELS: Record<PartnerClaimEvent['status'], string> = {
  ...PARTNER_STATUS_LABELS,
  info_sent: 'Information sent',
}
