import type { TernBooking, TernClaim, TernClaimNote, TernClaimStatus } from './types'
import type { PartnerEventPayload } from '~/components/reservations/data/partner-claims'
import type { DamageProtection, PartnerClaim, PartnerClaimStatus, ProtectionClaim, ReservationEntry } from '~/components/reservations/data/reservations'
import type { TernTier } from '~/components/reservations/data/tern-products'

/**
 * Elev8 ⇄ Tern, framework-free. The ONLY place our model meets Tern's: the rest
 * of the app speaks Elev8 (`PartnerClaim`, `DamageProtection`), the client
 * speaks Tern (`TernBooking`, `TernClaim`).
 */

/** How Tern knows a claim came from us. Sent on create, used to find it again when polling. */
export const TERN_EXTERNAL_SYSTEM = 'Elev8'

/**
 * Tern's product and policy ids for our three tiers. ⚠️ PLACEHOLDERS: the spec
 * has no catalogue endpoint, so the real ids must come from Tern.
 */
export const TERN_PRODUCT_IDS: Record<TernTier, number> = { bronze: 101, silver: 102, gold: 103 }
export const TERN_POLICY_ID = 1

const day = (iso: string) => iso.slice(0, 10)

function splitName(full: string): { first: string, last?: string } {
  const parts = full.trim().split(/\s+/)
  if (parts.length <= 1)
    return { first: parts[0] || full }
  return { first: parts.slice(0, -1).join(' '), last: parts.at(-1) }
}

// ---------------------------------------------------------------------------
// Bookings: every covered stay is a Tern booking
// ---------------------------------------------------------------------------

export interface TernBookingInput {
  organizationId: number
  reservation: Pick<ReservationEntry, 'id' | 'guestName' | 'guestEmail' | 'guestCountry' | 'checkIn' | 'checkOut' | 'totalPrice' | 'currency' | 'status'>
  protection: Pick<DamageProtection, 'state' | 'tier' | 'elev8Fee' | 'currency' | 'paidBy' | 'packages' | 'acceptedAt'>
  listing: { id: string, name: string, location?: string }
  manager: { name: string, email?: string, addressLines?: string[] }
  /** When the stay was cancelled, `YYYY-MM-DD`. The booking stays, marked inactive. */
  cancelledDate?: string
}

/**
 * The Tern booking for a covered stay. `insuranceCost` is the fee frozen on the
 * stay (already times its 30-night packages). ⚠️ How Tern prices a stay over 30
 * nights is still to be confirmed: one booking with the multiplied cost is our
 * assumption, recorded in `notes`.
 */
export function toTernBooking(input: TernBookingInput): TernBooking {
  const { reservation: r, protection: p, listing, manager } = input
  const client = splitName(r.guestName)
  const [locationCity, ...rest] = (listing.location ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const cancelled = r.status === 'cancelled' || p.state === 'cancelled'
  const packages = p.packages ?? 1
  return {
    active: !cancelled,
    bookingNumber: r.id,
    bookingDate: day(p.acceptedAt),
    bookingTotal: r.totalPrice,
    bookingCurrency: r.currency,
    ...(cancelled ? { cancelledDate: input.cancelledDate ?? day(new Date().toISOString()) } : {}),
    clientFirstName: client.first,
    ...(client.last ? { clientLastName: client.last } : {}),
    ...(r.guestEmail ? { clientEmail: r.guestEmail } : {}),
    ...(r.guestCountry ? { clientCountry: r.guestCountry } : {}),
    startDate: r.checkIn,
    endDate: r.checkOut,
    ...(typeof p.elev8Fee === 'number' ? { insuranceCost: p.elev8Fee, insuranceCostCurrency: p.currency } : {}),
    locationName: listing.name,
    ...(locationCity ? { locationCity } : {}),
    ...(rest.length ? { locationStateProvince: rest.join(', ') } : {}),
    managerName: manager.name,
    ...(manager.email ? { managerContact: manager.email } : {}),
    ...(manager.addressLines?.[0] ? { managerStreet: manager.addressLines[0] } : {}),
    organizationId: input.organizationId,
    ...(p.tier ? { productId: TERN_PRODUCT_IDS[p.tier] } : {}),
    policyId: TERN_POLICY_ID,
    notes: `${p.paidBy === 'host' ? 'Host-paid' : 'Guest-paid'} waiver, ${packages} x 30-night package${packages === 1 ? '' : 's'}. Elev8 listing ${listing.id}.`,
  }
}

/** Whether a stay's Tern booking needs a PUT: only the fields we own are compared. */
export function ternBookingChanged(before: TernBooking, after: TernBooking): boolean {
  const keys: (keyof TernBooking)[] = ['active', 'cancelledDate', 'startDate', 'endDate', 'bookingTotal', 'insuranceCost', 'productId', 'clientFirstName', 'clientLastName', 'clientEmail', 'notes']
  return keys.some(k => before[k] !== after[k])
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

export interface TernClaimInput {
  bookingId: number
  claim: Pick<ProtectionClaim, 'id' | 'label' | 'reason' | 'coveredAmount' | 'recordedAt'>
  currency: string
  /** The property manager files the claim under its master policy, so it is the claimant. */
  claimant: { name: string, email?: string, phone?: string }
}

/**
 * The claim to file. ⚠️ `claimAmount` is the GROSS covered amount: Tern applies
 * its own deductible (`deductibleApplied`) and pays the net. Our below-deductible
 * rule still decides whether to file at all.
 */
export function toTernClaim(input: TernClaimInput): TernClaim {
  return {
    active: true,
    bookingId: input.bookingId,
    claimAmount: input.claim.coveredAmount,
    claimCurrency: input.currency,
    claimDate: day(input.claim.recordedAt),
    claimantName: input.claimant.name,
    ...(input.claimant.email ? { claimantEmail: input.claimant.email } : {}),
    ...(input.claimant.phone ? { claimantPhone: input.claimant.phone } : {}),
    description: `${input.claim.label}. ${input.claim.reason}`.trim(),
    externalClaimSystem: TERN_EXTERNAL_SYSTEM,
    externalClaimId: input.claim.id,
    externalClaimDescription: input.claim.label,
    policyId: TERN_POLICY_ID,
    status: 'Submitted',
  }
}

/**
 * Tern's 14 statuses onto our partner claim statuses. Several of Tern's have no
 * twin of their own; each maps to what staff have to DO about it, and the raw
 * status is kept on the claim (`partnerStatus`) and shown beside ours.
 */
export const TERN_STATUS_MAP: Record<TernClaimStatus, PartnerClaimStatus | 'approved_or_rejected'> = {
  PendingVerification: 'submitted',
  Submitted: 'submitted',
  InReview: 'under_review',
  OnHold: 'under_review',
  FollowUpReceived: 'under_review',
  FollowUpRequested: 'info_requested',
  Incomplete: 'info_requested',
  Approved: 'approved',
  Denied: 'rejected',
  NotQualified: 'rejected',
  Expired: 'rejected',
  Withdrawn: 'withdrawn',
  FiledExternally: 'withdrawn',
  // Closed says only that Tern is done: the amounts decide which way it went.
  Closed: 'approved_or_rejected',
}

/** Our status as Tern would name it, for claims filed before the Tern client existed (demo seeds). */
export function ternStatusFor(status: PartnerClaimStatus): { status: TernClaimStatus, paymentStatus?: TernClaim['paymentStatus'] } | null {
  switch (status) {
    case 'submitted': return { status: 'Submitted' }
    case 'under_review': return { status: 'InReview' }
    case 'info_requested': return { status: 'FollowUpRequested' }
    case 'approved':
    case 'partially_approved': return { status: 'Approved' }
    case 'payout_scheduled': return { status: 'Approved', paymentStatus: 'PaymentPending' }
    case 'paid':
    case 'received': return { status: 'Approved', paymentStatus: 'PaymentSent' }
    case 'rejected': return { status: 'Denied' }
    case 'withdrawn': return { status: 'Withdrawn' }
    default: return null
  }
}

/** What Tern will pay: the net approved amount, after its deductible, with any goodwill payment. */
export function ternNetApproved(claim: TernClaim): number {
  if (typeof claim.totalNetApprovedAmount === 'number')
    return claim.totalNetApprovedAmount
  const gross = (claim.totalApprovedAmount ?? claim.ternApprovedAmount ?? 0)
  return Math.max(0, gross - (claim.deductibleApplied ?? 0))
}

/**
 * Tern's figures that correct ours before any event is applied: Tern's own
 * deductible is authoritative, so the net we asked for is recomputed from it.
 */
export function ternClaimCorrections(claim: TernClaim, current: PartnerClaim, maxPerClaim?: number): Partial<PartnerClaim> {
  const patch: Partial<PartnerClaim> = { partnerStatus: claim.status }
  if (typeof claim.claimId === 'number')
    patch.partnerClaimId = claim.claimId
  if (typeof claim.deductibleApplied === 'number' && typeof claim.claimAmount === 'number' && claim.deductibleApplied !== current.deductible) {
    const net = Math.max(0, claim.claimAmount - claim.deductibleApplied)
    patch.deductible = claim.deductibleApplied
    patch.claimedAmount = maxPerClaim !== undefined ? Math.min(net, maxPerClaim) : net
  }
  if (claim.exGratiaPayment)
    patch.exGratiaAmount = claim.exGratiaPayment
  return patch
}

/**
 * The events that move our claim to where Tern's snapshot says it is, in order.
 * Built from a POLL, not a webhook: the same snapshot read twice yields the same
 * event ids, which `applyPartnerEvent` refuses as duplicates, and a step our
 * claim is already past is refused as an illegal transition. Both are ignored.
 *
 * `publicNote` is Tern's latest Public claim note: the spec has no field for an
 * information request or a denial reason, so they arrive as notes.
 */
export function partnerEventsFromTern(claim: TernClaim, current: PartnerClaim, publicNote?: Pick<TernClaimNote, 'content'>): PartnerEventPayload[] {
  const key = `tern:${claim.claimId}:${claim.modStamp ?? ''}`
  const base = { source: 'poll' as const, at: claim.modStamp }
  const noteText = publicNote?.content?.trim()
  const events: PartnerEventPayload[] = []
  let target = TERN_STATUS_MAP[claim.status]
  if (target === 'approved_or_rejected')
    target = ternNetApproved(claim) > 0 ? 'approved' : 'rejected'

  switch (target) {
    case 'under_review':
      // Answered on Tern's side while we were waiting: close our request first.
      if (current.status === 'info_requested')
        events.push({ ...base, id: `${key}:info_sent`, status: 'info_sent', note: 'Answered on the partner side' })
      events.push({ ...base, id: `${key}:review`, status: 'under_review', ...(claim.status === 'OnHold' ? { note: 'On hold at the partner' } : {}) })
      break
    case 'info_requested':
      events.push({ ...base, id: `${key}:info`, status: 'info_requested', infoRequest: noteText || (claim.status === 'Incomplete' ? 'The partner marked the claim incomplete' : 'The partner asked for more information') })
      break
    case 'approved':
      events.push({ ...base, id: `${key}:approved`, status: 'approved', approvedAmount: ternNetApproved(claim) })
      if (claim.paymentStatus === 'PaymentPending')
        events.push({ ...base, id: `${key}:scheduled`, status: 'payout_scheduled', ...(claim.followUpDate ? { payoutScheduledFor: claim.followUpDate } : {}) })
      if (claim.paymentStatus === 'PaymentSent') {
        events.push({
          ...base,
          id: `${key}:paid`,
          status: 'paid',
          paidAmount: ternNetApproved(claim),
          ...(claim.paymentReference ? { payoutReference: claim.paymentReference } : {}),
        })
      }
      break
    case 'rejected':
      events.push({ ...base, id: `${key}:rejected`, status: 'rejected', rejectionReason: noteText || `The partner closed the claim as ${claim.status}` })
      break
    case 'withdrawn':
      events.push({ ...base, id: `${key}:withdrawn`, status: 'withdrawn', note: claim.status === 'FiledExternally' ? 'Filed outside Elev8 at the partner' : 'Withdrawn at the partner' })
      break
    case 'submitted':
      break
  }
  return events
}
