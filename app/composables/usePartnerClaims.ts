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
import { useTernApi } from '~/composables/useTernApi'
import { partnerEventsFromTern, TERN_EXTERNAL_SYSTEM, ternClaimCorrections, ternStatusFor, toTernClaim } from '~/lib/tern/mappers'

/** The mock partner API round trip on filing. Long enough for the spinner to be seen. */
const PARTNER_API_MOCK_MS = 1500

/** Claims read per page when polling Tern. */
const POLL_PAGE_SIZE = 100

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
 * The partner is Tern, reached through `useTernApi().client`, whose shapes are
 * Tern's own API (`~/lib/tern`). The flow follows Tern's model: the stay is a
 * Tern booking (`ensureBooking`), the claim is filed against it with the
 * evidence uploaded as documents, and Tern's changes are read by POLLING
 * (`pollPartnerUpdates`, its spec has no webhook) and translated into our events
 * (`partnerEventsFromTern`). In the demo the client is an in-memory mock and
 * `simulatePartner` plays Tern's staff before polling.
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
  const ternApi = useTernApi()

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
    extra: Partial<PartnerClaim> = {},
  ): { ok: true, claim: PartnerClaim } | { ok: false, reason: string } {
    const result = applyPartnerEvent(base, event)
    if (!result.ok)
      return result
    const claim = { ...result.claim, ...extra }
    const detail = `${PARTNER_EVENT_LABELS[event.status]}${event.note ? `: ${event.note}` : ''}`
    const written = dp.patchClaim(reservationId, claimId, { partnerClaim: claim }, detail)
    if (!written.ok)
      return written
    return { ok: true, claim }
  }

  /** The files a claim carries, as Tern will receive them: uploads first, then the housekeeper's photos. */
  function evidenceFiles(claim: ProtectionClaim): { fileName: string, url: string }[] {
    const urls = [...claim.evidenceUrls, ...(claim.cleaningReport?.photoUrls ?? [])]
    return urls.map((url, i) => ({ url, fileName: url.split('?')[0]!.split('/').pop() || `evidence-${i + 1}.jpg` }))
  }

  /**
   * Upload the claim's evidence to Tern. ⚠️ The real integration must send the
   * ORIGINAL bytes (fetched server-side from our storage): Tern reads EXIF and
   * GPS and flags edited or generated photos (`getDocumentMetadata`), so a
   * re-compressed copy weakens the claim. The mock sends an empty placeholder.
   */
  async function uploadEvidence(ternClaimId: number, claim: ProtectionClaim) {
    for (const file of evidenceFiles(claim))
      await ternApi.client.uploadDocument({ entityType: 'Claim', entityId: ternClaimId, visibility: 'Public', notes: file.url }, new Blob([]), file.fileName)
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
    let filed: Awaited<ReturnType<typeof ternApi.client.createClaim>> | null = null
    let failure: string | null = null
    try {
      // The demo's "simulate a rejected submission": Tern answers the next create with a 400.
      if (forceFailure)
        ternApi.controls.failNextCreateClaim('The partner API rejected the request: evidence pack missing a photo of the damage')
      // A Tern claim hangs off a Tern booking: send the stay first if it never was.
      const bookingId = await ternApi.ensureBooking(reservationId)
      if (bookingId === null)
        throw new Error('The stay could not be registered with the partner')
      await new Promise(resolve => setTimeout(resolve, PARTNER_API_MOCK_MS))
      const claimant = ternApi.manager()
      filed = await ternApi.client.createClaim(toTernClaim({ bookingId, claim: found.claim, currency: found.protection.currency, claimant }))
      await uploadEvidence(filed.claimId!, found.claim)
    }
    catch (error) {
      failure = error instanceof Error ? error.message : 'The partner did not accept the claim'
    }
    const next = new Set(submitting.value)
    next.delete(claimId)
    submitting.value = next

    const live = locate(reservationId, claimId)
    const current = live?.claim.partnerClaim
    if (!live || !current)
      return { ok: false, reason: 'claim_not_found' }

    if (failure || !filed) {
      const reason = failure ?? 'The partner did not accept the claim'
      apply(reservationId, claimId, current, { id: eventId('evt-api'), status: 'submission_failed', source: 'api', submissionError: reason })
      createProtectionAlert('PARTNER_CLAIM_SUBMISSION_FAILED', { ...alertContext(live), reason })
      return { ok: false, reason: 'submission_failed' }
    }
    const done = apply(
      reservationId,
      claimId,
      current,
      { id: eventId('evt-api'), status: 'submitted', source: 'api', partnerClaimRef: filed.claimDisplayId },
      ternClaimCorrections(filed, current, partner.value.maxPerClaim),
    )
    return done.ok ? { ok: true } : done
  }

  /** Alerts that follow a partner-side change, however it arrived. */
  function alertOnPartnerChange(found: NonNullable<ReturnType<typeof locate>>, before: PartnerClaimStatus, claim: PartnerClaim) {
    if (claim.status === before)
      return
    if (claim.status === 'info_requested')
      createProtectionAlert('PARTNER_CLAIM_INFO_REQUESTED', { ...alertContext(found), info_request: claim.infoRequest })
    if (claim.status === 'rejected')
      createProtectionAlert('PARTNER_CLAIM_REJECTED', { ...alertContext(found), reason: claim.rejectionReason })
    if (claim.status === 'paid')
      resolvePartnerAlerts(found.claim.id, ['PARTNER_CLAIM_PAYOUT_OVERDUE'])
  }

  /**
   * One partner event, applied through `applyPartnerEvent`. Duplicates and
   * out-of-order events are refused, never applied. Polling uses the same rules.
   */
  function receivePartnerEvent(reservationId: string, claimId: string, event: PartnerEventPayload): PartnerWriteResult {
    const found = locate(reservationId, claimId)
    const current = found?.claim.partnerClaim
    if (!found || !current)
      return { ok: false, reason: 'not_filed' }
    const result = apply(reservationId, claimId, current, event)
    if (!result.ok)
      return result
    alertOnPartnerChange(found, current.status, result.claim)
    return { ok: true }
  }

  /** Tern claim id → the `modStamp` last applied, so an unchanged claim is skipped. */
  const seenStamps = useState<Record<number, string>>('tern-claim-seen-stamps', () => ({}))

  function locateByClaimId(claimId: string) {
    for (const reservation of reservations.value) {
      const claim = reservation.damageProtection?.claims?.find(c => c.id === claimId)
      if (claim)
        return locate(reservation.id, claimId)
    }
    return null
  }

  /**
   * Read what changed at Tern and bring our claims in line. Tern's spec has no
   * webhook, so this is the way in: in production a scheduled job calls it every
   * few minutes; here the worklist calls it on mount and the demo calls it after
   * playing Tern's staff. Safe to call again: a snapshot read twice produces
   * events already applied, which are refused.
   *
   * ⚠️ Tern's claim list has NO `modStampFrom` filter (its booking and note lists
   * do) and cannot sort by it, so every Elev8 claim is read, page by page, and
   * one whose `modStamp` matches the last applied is skipped. Worth asking Tern
   * for the filter, or a webhook, before the volume grows.
   */
  async function pollPartnerUpdates(): Promise<{ checked: number, changed: number }> {
    const items: Awaited<ReturnType<typeof ternApi.client.listClaim>>['items'] = []
    for (let offset = 0; ; offset += POLL_PAGE_SIZE) {
      const page = await ternApi.client.listClaim({ externalClaimSystemContains: TERN_EXTERNAL_SYSTEM, limit: POLL_PAGE_SIZE, offset })
      items.push(...page.items)
      if (page.items.length < POLL_PAGE_SIZE)
        break
    }
    let changed = 0
    for (const ternClaim of items) {
      if (ternClaim.claimId === undefined || (ternClaim.modStamp && seenStamps.value[ternClaim.claimId] === ternClaim.modStamp))
        continue
      if (ternClaim.modStamp)
        seenStamps.value = { ...seenStamps.value, [ternClaim.claimId]: ternClaim.modStamp }
      const found = ternClaim.externalClaimId ? locateByClaimId(ternClaim.externalClaimId) : null
      const before = found?.claim.partnerClaim
      if (!found || !before)
        continue
      const notes = await ternApi.client.listClaimNote({ parentEntityId: ternClaim.claimId!, visibilities: ['Public'], sort: 'ModStamp', sortDir: 'Desc', limit: 1 })
      let current: PartnerClaim = { ...before, ...ternClaimCorrections(ternClaim, before, partner.value.maxPerClaim) }
      const applied: string[] = []
      for (const event of partnerEventsFromTern(ternClaim, current, notes.items[0])) {
        // Refused events are steps already taken (duplicate) or already passed: skip them.
        const result = applyPartnerEvent(current, event)
        if (result.ok) {
          current = result.claim
          applied.push(PARTNER_EVENT_LABELS[event.status])
        }
      }
      if (JSON.stringify(current) === JSON.stringify(before))
        continue
      const written = dp.patchClaim(found.reservation.id, found.claim.id, { partnerClaim: current }, applied.length ? applied.join(', ') : 'Partner figures updated')
      if (written.ok) {
        changed += 1
        alertOnPartnerChange(found, before.status, current)
      }
    }
    return { checked: items.length, changed }
  }

  /**
   * The Tern claim id for one of our claims. A claim filed before the Tern client
   * existed (the demo seeds) is put into the mock as it stands, so the demo can
   * carry on with it. The real API never needs this.
   */
  function ternClaimIdFor(reservationId: string, claimId: string): number | null {
    const found = locate(reservationId, claimId)
    const current = found?.claim.partnerClaim
    if (!found || !current)
      return null
    const known = current.partnerClaimId
    if (known !== undefined && ternApi.controls.claims().some(c => c.claimId === known))
      return known
    const mapped = ternStatusFor(current.status)
    if (!mapped)
      return null
    const adopted = ternApi.controls.adoptClaim({
      ...toTernClaim({ bookingId: 0, claim: found.claim, currency: current.currency, claimant: ternApi.manager() }),
      bookingId: undefined,
      claimId: known,
      claimDisplayId: current.partnerClaimRef,
      claimAmount: current.claimedAmount + current.deductible,
      deductibleApplied: current.deductible,
      status: mapped.status,
      ...(mapped.paymentStatus ? { paymentStatus: mapped.paymentStatus } : {}),
      ...(current.approvedAmount !== undefined ? { totalNetApprovedAmount: current.approvedAmount, ternApprovedAmount: current.approvedAmount + current.deductible } : {}),
    })
    // The adoption itself is not a change at Tern.
    if (adopted.modStamp)
      seenStamps.value = { ...seenStamps.value, [adopted.claimId!]: adopted.modStamp }
    dp.patchClaim(reservationId, claimId, { partnerClaim: { ...current, partnerClaimId: adopted.claimId, partnerStatus: adopted.status } }, 'Linked to the partner record')
    return adopted.claimId!
  }

  /** Demo only: play Tern's staff on the mock, then read the change back the way production would, by polling. */
  async function simulatePartner(reservationId: string, claimId: string, simulation: PartnerSimulation): Promise<PartnerWriteResult> {
    const ternId = ternClaimIdFor(reservationId, claimId)
    if (ternId === null)
      return { ok: false, reason: 'not_filed' }
    const deductible = locate(reservationId, claimId)?.claim.partnerClaim?.deductible ?? 0
    const c = ternApi.controls
    switch (simulation.kind) {
      case 'under_review': c.review(ternId); break
      case 'info_requested': c.requestFollowUp(ternId, simulation.infoRequest); break
      // Our figures are net of the deductible, Tern approves gross.
      case 'approved': c.approve(ternId, simulation.approvedAmount !== undefined ? simulation.approvedAmount + deductible : undefined); break
      case 'rejected': c.deny(ternId, simulation.rejectionReason); break
      case 'payout_scheduled': c.schedulePayment(ternId, simulation.payoutScheduledFor); break
      case 'paid': c.sendPayment(ternId); break
    }
    const before = locate(reservationId, claimId)?.claim.partnerClaim?.status
    await pollPartnerUpdates()
    const after = locate(reservationId, claimId)?.claim.partnerClaim?.status
    return before !== after ? { ok: true } : { ok: false, reason: 'illegal_transition' }
  }

  /**
   * Our answer to the partner's information request: a Public claim note, and
   * the claim marked `FollowUpReceived` at Tern. Sends ours back to review.
   */
  async function respondToInfoRequest(reservationId: string, claimId: string, note: string): Promise<PartnerWriteResult> {
    if (!note.trim())
      return { ok: false, reason: 'empty_response' }
    const found = locate(reservationId, claimId)
    const current = found?.claim.partnerClaim
    if (!found || !current)
      return { ok: false, reason: 'not_filed' }
    if (current.status !== 'info_requested')
      return { ok: false, reason: 'illegal_transition' }
    const ternId = ternClaimIdFor(reservationId, claimId)
    if (ternId !== null) {
      const live = await ternApi.client.getClaim(ternId)
      await ternApi.client.updateClaim(ternId, { claim: { ...live, status: 'FollowUpReceived' }, publicNote: note.trim() })
    }
    const fresh = locate(reservationId, claimId)!.claim.partnerClaim!
    const result = apply(reservationId, claimId, fresh, { id: eventId('evt-info'), status: 'info_sent', source: 'staff', note: note.trim() })
    if (!result.ok)
      return result
    resolvePartnerAlerts(claimId, ['PARTNER_CLAIM_INFO_REQUESTED'])
    return { ok: true }
  }

  /** Withdraw at Tern (status `Withdrawn`, the reason as a Public note), then on ours. */
  async function withdraw(reservationId: string, claimId: string, reason: string): Promise<PartnerWriteResult> {
    if (!reason.trim())
      return { ok: false, reason: 'missing_reason' }
    const current = locate(reservationId, claimId)?.claim.partnerClaim
    if (!current)
      return { ok: false, reason: 'not_filed' }
    if (!['submission_failed', 'submitted', 'under_review', 'info_requested'].includes(current.status))
      return { ok: false, reason: 'illegal_transition' }
    // A failed submission never reached Tern: there is nothing to withdraw there.
    const ternId = current.status === 'submission_failed' ? null : ternClaimIdFor(reservationId, claimId)
    if (ternId !== null) {
      const live = await ternApi.client.getClaim(ternId)
      await ternApi.client.updateClaim(ternId, { claim: { ...live, status: 'Withdrawn' }, publicNote: reason.trim() })
    }
    const fresh = locate(reservationId, claimId)!.claim.partnerClaim!
    const result = apply(reservationId, claimId, fresh, { id: eventId('evt-withdraw'), status: 'withdrawn', source: 'staff', note: reason.trim() })
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
    pollPartnerUpdates,
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
