import type { CoverPartner, PartnerBucket, PartnerEligibility, PartnerEventPayload } from '~/components/reservations/data/partner-claims'
import type { DamageProtection, PartnerClaim, PartnerClaimStatus, ProtectionClaim, ReservationEntry } from '~/components/reservations/data/reservations'
import { computed, ref } from 'vue'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { elev8CoverPartner } from '~/components/reservations/data/damage-protection-seed'
import {
  applyPartnerEvent,
  newPartnerClaim,
  PARTNER_EVENT_LABELS,
  partnerBucket,
  partnerEligibility,
  payoutDueAt,
} from '~/components/reservations/data/partner-claims'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useNotifications } from '~/composables/useNotifications'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useTernActivation } from '~/composables/useTernActivation'

/** The mock partner API round trip. Long enough for the spinner to be seen. */
const PARTNER_API_MOCK_MS = 1500

export interface PartnerClaimRow {
  reservation: ReservationEntry
  protection: DamageProtection
  claim: ProtectionClaim
  partnerClaim: PartnerClaim | undefined
  eligibility: PartnerEligibility
  bucket: PartnerBucket
}

export interface PartnerCurrencyTotal {
  currency: string
  amount: number
}

export type PartnerWriteResult = { ok: true } | { ok: false, reason: string }

/** What the "simulate partner response" controls can make the mock partner say. */
export type PartnerSimulation
  = | { kind: 'under_review' }
    | { kind: 'info_requested', infoRequest: string }
    | { kind: 'approved', approvedAmount?: number }
    | { kind: 'rejected', rejectionReason: string }
    | { kind: 'payout_scheduled', payoutScheduledFor: string }
    | { kind: 'paid', paidAmount?: number }

let eventCounter = 0
function eventId(prefix: string): string {
  eventCounter += 1
  return `${prefix}-${Date.now()}-${eventCounter}`
}

/**
 * Insurance claims under the property manager's master policy: filing the
 * part of a waiver claim above the deductible with the partner, following it
 * through the partner's review, and confirming the payout landed in the bank
 * account the tenant registered when it activated the damage waiver.
 *
 * ⚠️ Elev8 integrates with the partner once, for every tenant, so there is
 * nothing here for a tenant to configure: no partner state, no API key.
 * `partner` is the platform's contract, read-only. The tenant's side, its card
 * and its bank account, lives in `useTernActivation`.
 *
 * The partner API is MOCKED: `submitToPartner` is a timer, and the partner's
 * replies arrive through `receivePartnerEvent`, the path a real webhook would
 * take. `simulatePartner` plays the partner's side for the demo.
 *
 * Writes go through `useDamageProtection().patchClaim`, which stays the only
 * writer of a reservation's protection.
 */
export function usePartnerClaims() {
  const dp = useDamageProtection()
  const { reservations } = useReservationsModule()
  const { alerts, createProtectionAlert } = useNotifications()

  /** The platform's contract with the partner. The same for every tenant, never edited here. */
  const partner = computed<CoverPartner>(() => elev8CoverPartner)

  const tern = useTernActivation()

  /**
   * The bank account Tern pays a claim into, by transfer. One per tenant for
   * now, so the listing does not change it; the argument stays so a per-listing
   * account (still to be confirmed with Tern) needs no change at the call sites.
   */
  function payoutAccountFor(_listingId: string) {
    return tern.payoutTarget.value
  }

  // ---------------------------------------------------------------- reads

  function locate(reservationId: string, claimId: string) {
    const reservation = reservations.value.find(r => r.id === reservationId)
    const protection = reservation?.damageProtection
    const claim = protection?.claims?.find(c => c.id === claimId)
    return reservation && protection && claim ? { reservation, protection, claim } : null
  }

  function eligibilityFor(reservationId: string, claimId: string): PartnerEligibility | null {
    const found = locate(reservationId, claimId)
    return found ? partnerEligibility(found.protection, found.claim, partner.value) : null
  }

  // ------------------------------------------------------------- the writers

  /** Apply one event and write it. Every change to a partner claim passes here. */
  function apply(
    reservationId: string,
    claimId: string,
    base: PartnerClaim,
    event: PartnerEventPayload,
  ): { ok: true, claim: PartnerClaim } | { ok: false, reason: string } {
    const result = applyPartnerEvent(base, event)
    if (!result.ok)
      return result
    const detail = `${PARTNER_EVENT_LABELS[event.status]}${event.note ? `: ${event.note}` : ''}`
    const written = dp.patchClaim(reservationId, claimId, { partnerClaim: result.claim }, detail)
    if (!written.ok)
      return written
    return result
  }

  function alertContext(found: NonNullable<ReturnType<typeof locate>>) {
    return {
      reservation_id: found.reservation.id,
      claim_id: found.claim.id,
      listing_id: found.reservation.listingId,
      guest_name: found.reservation.guestName,
      currency: found.protection.currency,
    }
  }

  const submitting = ref<Set<string>>(new Set())

  function isSubmitting(claimId: string): boolean {
    return submitting.value.has(claimId)
  }

  /**
   * File a waiver claim with the partner (mock API). The amount is frozen now:
   * covered minus the deductible, capped per claim. A failed submission can be
   * retried from the same record; a claim below the deductible is refused.
   */
  async function submitToPartner(reservationId: string, claimId: string, forceFailure = false): Promise<PartnerWriteResult> {
    const found = locate(reservationId, claimId)
    if (!found)
      return { ok: false, reason: 'claim_not_found' }
    const existing = found.claim.partnerClaim
    if (existing && existing.status !== 'submission_failed')
      return { ok: false, reason: 'already_submitted' }
    const eligibility = partnerEligibility(found.protection, found.claim, partner.value)
    if (!eligibility.eligible)
      return { ok: false, reason: eligibility.reason }
    if (submitting.value.has(claimId))
      return { ok: false, reason: 'already_submitting' }
    const account = existing
      ? { id: existing.payoutAccountId, accountName: existing.payoutAccountName }
      : payoutAccountFor(found.reservation.listingId)
    // Without an active service there is no bank account for the partner to pay into.
    if (!account)
      return { ok: false, reason: 'waiver_not_activated' }

    // A retry keeps the original filing, and the amounts and account it froze.
    const base = existing ?? newPartnerClaim(partner.value, eligibility.claimable, account)
    const started = existing
      ? apply(reservationId, claimId, base, { id: eventId('evt-submit'), status: 'submitting', source: 'staff', note: 'Retried' })
      : (() => {
          const claim: PartnerClaim = {
            ...base,
            events: [{ id: eventId('evt-submit'), at: new Date().toISOString(), status: 'submitting', source: 'staff' }],
          }
          const written = dp.patchClaim(reservationId, claimId, { partnerClaim: claim }, `Submitting to ${partner.value.name}`)
          return written.ok ? { ok: true as const, claim } : written
        })()
    if (!started.ok)
      return started

    submitting.value = new Set(submitting.value).add(claimId)
    await new Promise(resolve => setTimeout(resolve, PARTNER_API_MOCK_MS))
    const next = new Set(submitting.value)
    next.delete(claimId)
    submitting.value = next

    const live = locate(reservationId, claimId)
    const current = live?.claim.partnerClaim
    if (!live || !current)
      return { ok: false, reason: 'claim_not_found' }

    if (forceFailure) {
      const reason = 'The partner API rejected the request: evidence pack missing a photo of the damage'
      apply(reservationId, claimId, current, { id: eventId('evt-api'), status: 'submission_failed', source: 'api', submissionError: reason })
      createProtectionAlert('PARTNER_CLAIM_SUBMISSION_FAILED', { ...alertContext(live), reason })
      return { ok: false, reason: 'submission_failed' }
    }
    const ref = `PC-${String(Date.now()).slice(-6)}`
    const done = apply(reservationId, claimId, current, { id: eventId('evt-api'), status: 'submitted', source: 'api', partnerClaimRef: ref })
    return done.ok ? { ok: true } : done
  }

  /**
   * An event from the partner, as its webhook would deliver it. Duplicates and
   * out-of-order events are refused by `applyPartnerEvent`, never applied.
   */
  function receivePartnerEvent(reservationId: string, claimId: string, event: PartnerEventPayload): PartnerWriteResult {
    const found = locate(reservationId, claimId)
    const current = found?.claim.partnerClaim
    if (!found || !current)
      return { ok: false, reason: 'not_filed' }
    const result = apply(reservationId, claimId, current, event)
    if (!result.ok)
      return result
    if (result.claim.status === 'info_requested')
      createProtectionAlert('PARTNER_CLAIM_INFO_REQUESTED', { ...alertContext(found), info_request: result.claim.infoRequest })
    if (result.claim.status === 'rejected')
      createProtectionAlert('PARTNER_CLAIM_REJECTED', { ...alertContext(found), reason: result.claim.rejectionReason })
    if (result.claim.status === 'paid')
      resolvePartnerAlerts(claimId, ['PARTNER_CLAIM_PAYOUT_OVERDUE'])
    return { ok: true }
  }

  /** The mock partner. Builds the event a real partner would send and delivers it. */
  function simulatePartner(reservationId: string, claimId: string, simulation: PartnerSimulation): PartnerWriteResult {
    const base = { id: eventId('evt-webhook'), source: 'webhook' as const }
    switch (simulation.kind) {
      case 'under_review':
        return receivePartnerEvent(reservationId, claimId, { ...base, status: 'under_review' })
      case 'info_requested':
        return receivePartnerEvent(reservationId, claimId, { ...base, status: 'info_requested', infoRequest: simulation.infoRequest })
      case 'approved':
        return receivePartnerEvent(reservationId, claimId, { ...base, status: 'approved', approvedAmount: simulation.approvedAmount })
      case 'rejected':
        return receivePartnerEvent(reservationId, claimId, { ...base, status: 'rejected', rejectionReason: simulation.rejectionReason })
      case 'payout_scheduled':
        return receivePartnerEvent(reservationId, claimId, { ...base, status: 'payout_scheduled', payoutScheduledFor: simulation.payoutScheduledFor })
      case 'paid':
        return receivePartnerEvent(reservationId, claimId, {
          ...base,
          status: 'paid',
          paidAmount: simulation.paidAmount,
          payoutReference: `TRF-${String(Date.now()).slice(-8)}`,
        })
    }
  }

  /** Our answer to the partner's information request. Sends the claim back to review. */
  function respondToInfoRequest(reservationId: string, claimId: string, note: string): PartnerWriteResult {
    if (!note.trim())
      return { ok: false, reason: 'empty_response' }
    const found = locate(reservationId, claimId)
    const current = found?.claim.partnerClaim
    if (!found || !current)
      return { ok: false, reason: 'not_filed' }
    const result = apply(reservationId, claimId, current, { id: eventId('evt-info'), status: 'info_sent', source: 'staff', note: note.trim() })
    if (!result.ok)
      return result
    resolvePartnerAlerts(claimId, ['PARTNER_CLAIM_INFO_REQUESTED'])
    return { ok: true }
  }

  function withdraw(reservationId: string, claimId: string, reason: string): PartnerWriteResult {
    if (!reason.trim())
      return { ok: false, reason: 'missing_reason' }
    const current = locate(reservationId, claimId)?.claim.partnerClaim
    if (!current)
      return { ok: false, reason: 'not_filed' }
    const result = apply(reservationId, claimId, current, { id: eventId('evt-withdraw'), status: 'withdrawn', source: 'staff', note: reason.trim() })
    if (!result.ok)
      return result
    resolvePartnerAlerts(claimId, ['PARTNER_CLAIM_SUBMISSION_FAILED', 'PARTNER_CLAIM_INFO_REQUESTED'])
    return { ok: true }
  }

  /**
   * Staff saw the money land in the account. The amount is what actually
   * arrived, which can be less than the partner paid (a bank fee) or approved.
   */
  function confirmReceived(reservationId: string, claimId: string, amount?: number): PartnerWriteResult {
    const current = locate(reservationId, claimId)?.claim.partnerClaim
    if (!current)
      return { ok: false, reason: 'not_filed' }
    const received = amount ?? current.paidAmount
    const result = apply(reservationId, claimId, current, {
      id: eventId('evt-received'),
      status: 'received',
      source: 'staff',
      receivedAmount: received,
      note: received !== undefined ? formatProtectionAmount(received, current.currency) : undefined,
    })
    return result.ok ? { ok: true } : result
  }

  /** Resolved directly, never through `dismiss()`, like the deposit alerts. */
  function resolvePartnerAlerts(claimId: string, types: string[]) {
    alerts.value = alerts.value.map(a =>
      a.status === 'ACTIVE' && types.includes(a.type) && a.context?.claim_id === claimId
        ? { ...a, status: 'RESOLVED' as const, resolved_at: new Date().toISOString() }
        : a)
  }

  // ------------------------------------------------------------- the worklist

  /**
   * Every waiver claim that is, or could be, with the partner. A claim below
   * the deductible never appears: it was never the partner's.
   */
  const rows = computed<PartnerClaimRow[]>(() => reservations.value.flatMap((reservation) => {
    const protection = reservation.damageProtection
    if (!protection || protection.option !== 'waiver')
      return []
    return (protection.claims ?? []).flatMap((claim) => {
      const eligibility = partnerEligibility(protection, claim, partner.value)
      if (!eligibility.eligible && !claim.partnerClaim)
        return []
      return [{ reservation, protection, claim, partnerClaim: claim.partnerClaim, eligibility, bucket: partnerBucket(claim.partnerClaim) }]
    })
  }))

  function inBucket(bucket: PartnerBucket) {
    return computed(() => rows.value.filter(r => r.bucket === bucket))
  }

  function totals(subset: PartnerClaimRow[], pick: (row: PartnerClaimRow) => number): PartnerCurrencyTotal[] {
    const map = new Map<string, number>()
    for (const row of subset)
      map.set(row.protection.currency, (map.get(row.protection.currency) ?? 0) + pick(row))
    return [...map.entries()].map(([currency, amount]) => ({ currency, amount })).filter(t => t.amount !== 0)
  }

  const toSubmit = inBucket('to_submit')
  const actionNeeded = inBucket('action_needed')
  const withPartner = inBucket('with_partner')
  const awaitingPayout = inBucket('awaiting_payout')
  const toConfirm = inBucket('to_confirm')
  const closed = inBucket('closed')

  /** Four figures, per currency, never netted into one. */
  const moneyTotals = computed(() => ({
    claimable: totals(toSubmit.value, r => (r.eligibility.eligible ? r.eligibility.claimable : 0)),
    withPartner: totals([...withPartner.value, ...actionNeeded.value], r => r.partnerClaim?.claimedAmount ?? 0),
    approvedNotReceived: totals([...awaitingPayout.value, ...toConfirm.value], r => r.partnerClaim?.approvedAmount ?? 0),
    received: totals(closed.value, r => r.partnerClaim?.receivedAmount ?? 0),
  }))

  function statusCount(status: PartnerClaimStatus): number {
    return rows.value.filter(r => r.partnerClaim?.status === status).length
  }

  /** In-app, not a scheduler: an approved claim past its payment terms. */
  function emitPartnerAlerts(now: Date = new Date()) {
    for (const row of awaitingPayout.value) {
      const due = payoutDueAt(row.partnerClaim!, partner.value)
      if (!due || new Date(due) > now)
        continue
      const live = alerts.value.some(a => a.status === 'ACTIVE' && a.type === 'PARTNER_CLAIM_PAYOUT_OVERDUE' && a.context?.claim_id === row.claim.id)
      if (!live) {
        createProtectionAlert('PARTNER_CLAIM_PAYOUT_OVERDUE', {
          reservation_id: row.reservation.id,
          claim_id: row.claim.id,
          listing_id: row.reservation.listingId,
          guest_name: row.reservation.guestName,
          currency: row.protection.currency,
          approved_amount: row.partnerClaim!.approvedAmount,
        })
      }
    }
  }

  return {
    partner,
    payoutAccountFor,
    eligibilityFor,
    submitToPartner,
    isSubmitting,
    receivePartnerEvent,
    simulatePartner,
    respondToInfoRequest,
    withdraw,
    confirmReceived,
    rows,
    toSubmit,
    actionNeeded,
    withPartner,
    awaitingPayout,
    toConfirm,
    closed,
    moneyTotals,
    statusCount,
    emitPartnerAlerts,
  }
}
