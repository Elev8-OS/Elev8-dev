import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type {
  ClaimDraft,
  DamageProtectionAssignment,
  DamageProtectionPolicy,
  ProtectionBucket,
  ProtectionChoiceDraft,
  ProtectionOptionView,
  ProtectionRail,
  ReleaseRefusal,
} from '~/components/reservations/data/damage-protection'
import type { DamageProtection, ProtectionClaim, ReservationEntry } from '~/components/reservations/data/reservations'
import { computed, ref } from 'vue'
import {
  assignmentForStay,
  buildOptions,
  canRelease,
  chargeDueAt,
  claimCoverage,
  deductionTotal,
  depositAmount,
  formatProtectionAmount,
  isChoiceValid,
  isClaimValid,
  isGuestStay,
  overlappingBands,
  protectionActivityEvent,
  protectionOffered,
  refundableAmount,
  refundDueAt,
  resolveBucket,
  settledStateFor,
  waiverAmount,
  waiverPotTotal,
} from '~/components/reservations/data/damage-protection'
import { seedProtectionAssignments, seedProtectionPolicies } from '~/components/reservations/data/damage-protection-seed'
import { payoutAccounts } from '~/components/settings/data/payouts'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useNotifications } from '~/composables/useNotifications'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useRoles } from '~/composables/useRoles'

const STORAGE_KEY = 'elev8-damage-protection-v1'

/** The mock gateway round trip. Long enough for the spinner to be visible. */
const GATEWAY_MOCK_MS = 1500

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

export interface CurrencyTotal {
  currency: string
  amount: number
}

export type ProtectionWriteResult
  = | { ok: true }
    | { ok: false, reason: string }

/**
 * A guest chooses a waiver or a deposit before arrival. The ONLY writer of
 * `ReservationEntry.damageProtection`.
 *
 * It never writes `priceDetails` or the folio. A deposit is guest money held,
 * so it must never reach `guestPaid`, `payout` or an owner statement; and
 * `useReservationFolio.commit()` REPLACES `priceDetails.extras` outright, so a
 * second writer of that field would be silently wiped by the next posting.
 */
export function useDamageProtection() {
  const { reservations, updateReservation } = useReservationsModule()
  const { currentUser } = useCurrentDashboardUser()
  const { alerts, createProtectionAlert, markAsRead } = useNotifications()

  const actor = computed(() => currentUser.value?.name ?? 'Staff')

  /**
   * Module-level view/edit is the only permission primitive this app has, so
   * moving money gets its own module rather than riding on reservations edit.
   * Reading a stay must not imply the right to take money from it.
   */
  const { getRole } = useRoles()
  const protectionPermissions = computed(() => {
    const role = currentUser.value ? getRole(currentUser.value.roleId) : undefined
    return role?.defaultPermissions?.damage_protection
  })
  const canViewProtection = computed(() => protectionPermissions.value?.dashboardView ?? false)
  const canEditProtection = computed(() => protectionPermissions.value?.dashboardEdit ?? false)

  const policies = useState<DamageProtectionPolicy[]>(
    'damage-protection-policies',
    () => seedProtectionPolicies.map(p => ({ ...p })),
  )
  const assignments = useState<DamageProtectionAssignment[]>(
    'damage-protection-assignments',
    () => seedProtectionAssignments.map(a => ({ ...a })),
  )

  // Guarded on storage availability rather than `import.meta.client`, which
  // Vitest does not substitute.
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
      if (Array.isArray(parsed.assignments))
        assignments.value = parsed.assignments
    }
    catch { /* corrupt payload, keep the seed */ }
  }

  // ---------------------------------------------------------------- reads

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

  function payoutAccountFor(listingId: string) {
    return payoutAccounts.value.find(a => a.listingIds.includes(listingId)) ?? null
  }

  /**
   * A card refund reverses to source. Everything else (QRIS, virtual account,
   * e-wallet) frequently cannot, so it needs bank details from the guest. A
   * listing with no payout account answers 'non_card', which is the safe side:
   * it asks for details rather than assuming a reversible card.
   */
  function railForListing(listingId: string): ProtectionRail {
    return payoutAccountFor(listingId)?.provider === 'stripe' ? 'card' : 'non_card'
  }

  function protectionFor(id: string): DamageProtection | null {
    return reservationById(id)?.damageProtection ?? null
  }

  function isOfferedFor(id: string): boolean {
    const reservation = reservationById(id)
    if (!reservation)
      return false
    // Status FIRST: an owner stay and a maintenance block are both channel
    // 'Direct', the one channel a policy is likely to set to 'offer'. Without
    // this an owner is asked to buy a waiver to stay in their own villa.
    if (!isGuestStay(reservation.status))
      return false
    return protectionOffered(policyFor(reservation.listingId, reservation.nights), reservation.channel)
  }

  function optionsFor(id: string): ProtectionOptionView[] {
    const reservation = reservationById(id)
    if (!reservation || !isOfferedFor(id))
      return []
    const policy = policyFor(reservation.listingId, reservation.nights)
    return policy ? buildOptions(policy, reservation) : []
  }

  function bucketFor(id: string): ProtectionBucket {
    const reservation = reservationById(id)
    if (!reservation)
      return 'not_offered'
    return resolveBucket(reservation.damageProtection, reservation.status)
  }

  function releaseRefusalFor(id: string): ReleaseRefusal | null {
    const protection = protectionFor(id)
    if (!protection)
      return null
    const verdict = canRelease(protection)
    return verdict.ok ? null : verdict.reason
  }

  // ------------------------------------------------------------ policy CRUD

  function savePolicy(policy: DamageProtectionPolicy) {
    // Touches `policies` only, never a reservation: the frozen amount, cap and
    // terms on an accepted protection is what a guest agreed to.
    const index = policies.value.findIndex(p => p.id === policy.id)
    const next = { ...policy, updatedAt: new Date().toISOString() }
    policies.value = index === -1
      ? [...policies.value, next]
      : policies.value.map(p => p.id === policy.id ? next : p)
    persist()
  }

  function deletePolicy(id: string): ProtectionWriteResult {
    if (assignments.value.some(a => a.policyId === id))
      return { ok: false, reason: 'policy_assigned' }
    policies.value = policies.value.filter(p => p.id !== id)
    persist()
    return { ok: true }
  }

  function assignBand(
    listingId: string,
    policyId: string,
    minNights: number,
    maxNights: number | null,
  ): ProtectionWriteResult {
    const policy = policies.value.find(p => p.id === policyId)
    if (!policy)
      return { ok: false, reason: 'policy_not_found' }

    // The currency check belongs here, not at charge time when a guest is
    // already waiting on a charge that cannot be made.
    const account = payoutAccountFor(listingId)
    if (account && account.currency !== policy.currency)
      return { ok: false, reason: 'currency_mismatch' }

    const candidate = [...assignments.value, { listingId, policyId, minNights, maxNights }]
    if (overlappingBands(candidate, listingId))
      return { ok: false, reason: 'overlapping_band' }

    assignments.value = candidate
    persist()
    return { ok: true }
  }

  function removeBand(listingId: string, policyId: string) {
    assignments.value = assignments.value.filter(
      a => !(a.listingId === listingId && a.policyId === policyId),
    )
    persist()
  }

  // ------------------------------------------------------------- the writers

  /**
   * Every action writes the protection object and its activity event in ONE
   * updateReservation call, so a charge and its audit line cannot land apart.
   */
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

  function recordChoice(
    reservationId: string,
    draft: ProtectionChoiceDraft,
    via: 'guest_guide' | 'staff' = 'staff',
  ): ProtectionWriteResult {
    const reservation = reservationById(reservationId)
    if (!reservation)
      return { ok: false, reason: 'reservation_not_found' }
    const policy = policyFor(reservation.listingId, reservation.nights)
    if (!policy || !isOfferedFor(reservationId))
      return { ok: false, reason: 'not_offered' }
    if (!isChoiceValid(draft, policy, railForListing(reservation.listingId)))
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

  const charging = ref<Set<string>>(new Set())

  function isCharging(reservationId: string): boolean {
    return charging.value.has(reservationId)
  }

  /**
   * A REAL charge, not an authorization hold. Seven days of hold does not span
   * a stay, and a manual-capture card session cannot offer QRIS, virtual
   * account or e-wallet, which is most of this market. Do not reintroduce
   * `capture: false` here.
   */
  async function chargeDeposit(reservationId: string, forceFailure = false) {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection || protection.option !== 'deposit')
      return
    if (protection.state === 'deposit_held' || charging.value.has(reservationId))
      return
    // A cancelled stay must never be charged on its lead date.
    if (reservation.status === 'cancelled')
      return

    charging.value = new Set(charging.value).add(reservationId)
    await new Promise(resolve => setTimeout(resolve, GATEWAY_MOCK_MS))
    const next = new Set(charging.value)
    next.delete(reservationId)
    charging.value = next

    const current = reservationById(reservationId)
    if (!current?.damageProtection)
      return

    if (forceFailure) {
      const failed: DamageProtection = {
        ...current.damageProtection,
        state: 'deposit_failed',
        failureReason: 'Card declined by issuer',
        failedAttempts: (current.damageProtection.failedAttempts ?? 0) + 1,
      }
      commit(current, failed, protectionActivityEvent('charge_failed', failed, actor.value, failed.failureReason))
      createProtectionAlert('DEPOSIT_FAILED_AT_CHECKIN', {
        reservation_id: current.id,
        listing_id: current.listingId,
        guest_name: current.guestName,
        currency: failed.currency,
        deposit_amount: failed.amount,
      })
      return
    }

    const held: DamageProtection = {
      ...current.damageProtection,
      state: 'deposit_held',
      chargedAt: new Date().toISOString(),
      payoutAccountId: payoutAccountFor(current.listingId)?.id,
      failureReason: undefined,
    }
    commit(current, held, protectionActivityEvent('charged', held, actor.value))
  }

  function retryCharge(reservationId: string) {
    return chargeDeposit(reservationId)
  }

  /**
   * Recorded on BOTH paths. On a waiver no money moves and the only consequence
   * is `waiverPotTotal`, which is how the operator learns whether the fee is
   * priced right. Do not early-return on a waiver.
   */
  function recordClaim(reservationId: string, draft: ClaimDraft): ProtectionWriteResult {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return { ok: false, reason: 'no_protection' }
    if (reservation.status === 'cancelled')
      return { ok: false, reason: 'stay_cancelled' }
    if (!isClaimValid(draft))
      return { ok: false, reason: 'invalid_claim' }

    const { coveredAmount, excessAmount } = claimCoverage(protection, draft.amount)
    const claim: ProtectionClaim = {
      id: `clm-${Date.now()}-${(protection.claims?.length ?? 0) + 1}`,
      label: draft.label.trim(),
      amount: draft.amount,
      coveredAmount,
      excessAmount,
      reason: draft.reason.trim(),
      evidenceUrls: [...draft.evidenceUrls],
      recordedBy: actor.value,
      recordedAt: new Date().toISOString(),
    }
    const next: DamageProtection = { ...protection, claims: [...(protection.claims ?? []), claim] }
    const detail = `${claim.label}, ${formatProtectionAmount(claim.coveredAmount, next.currency)} covered`
    commit(reservation, next, protectionActivityEvent('claimed', next, actor.value, detail))
    createProtectionAlert('DAMAGE_CLAIM_RECORDED', {
      reservation_id: reservation.id,
      listing_id: reservation.listingId,
      guest_name: reservation.guestName,
      currency: next.currency,
      claim_amount: claim.amount,
    })
    return { ok: true }
  }

  function removeClaim(reservationId: string, claimId: string): ProtectionWriteResult {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return { ok: false, reason: 'no_protection' }
    const claim = (protection.claims ?? []).find(c => c.id === claimId)
    if (!claim)
      return { ok: false, reason: 'claim_not_found' }
    // The guest has been told, so the record stands. A correction is a new claim.
    if (claim.guestNotifiedAt)
      return { ok: false, reason: 'already_notified' }

    const next: DamageProtection = {
      ...protection,
      claims: (protection.claims ?? []).filter(c => c.id !== claimId),
    }
    commit(reservation, next, protectionActivityEvent('undone', next, actor.value, `Claim removed: ${claim.label}`))
    return { ok: true }
  }

  /**
   * A deduction the guest first meets as a smaller refund is a chargeback.
   * `canRelease` refuses until this has run, so money cannot be kept quietly.
   */
  async function notifyGuestOfClaim(reservationId: string, claimId: string): Promise<ProtectionWriteResult> {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return { ok: false, reason: 'no_protection' }
    const claim = (protection.claims ?? []).find(c => c.id === claimId)
    if (!claim)
      return { ok: false, reason: 'claim_not_found' }

    const body = [
      `We recorded a damage claim on your stay: ${claim.label}.`,
      `Assessed at ${formatProtectionAmount(claim.amount, protection.currency)}.`,
      protection.option === 'deposit'
        ? `${formatProtectionAmount(claim.coveredAmount, protection.currency)} will be deducted from your deposit.`
        : `This is covered by your damage waiver at no cost to you.`,
      claim.excessAmount > 0
        ? `${formatProtectionAmount(claim.excessAmount, protection.currency)} is above your cover and will be invoiced separately.`
        : '',
      `Reason: ${claim.reason}`,
    ].filter(Boolean).join('\n')

    let delivered = false
    try {
      // useInbox imports useUpsellOrders, which calls into this module's
      // siblings. A static import closes a cycle. Same rule, same reason, as
      // useUpsellLockAccess.messageGuest. Do not tidy this into a top-level import.
      const { useInbox } = await import('~/composables/useInbox')
      const inbox = useInbox()
      const conversation = inbox.conversations.value.find(
        c => c.reservationId === reservation.id,
      )
      if (conversation) {
        inbox.sendMessage(conversation.id, body, conversation.otaSource)
        delivered = true
      }
    }
    catch { /* inbox unavailable during SSR or in a stubbed test */ }

    // Without delivery the stamp stays unset, so the release gate stays closed
    // rather than silently opening on a notice nobody received.
    if (!delivered)
      return { ok: false, reason: 'no_conversation' }

    const next: DamageProtection = {
      ...protection,
      claims: (protection.claims ?? []).map(c =>
        c.id === claimId ? { ...c, guestNotifiedAt: new Date().toISOString() } : c,
      ),
    }
    commit(reservation, next, protectionActivityEvent('notified', next, actor.value, claim.label))
    return { ok: true }
  }

  const ALERTS_TO_RESOLVE = ['DEPOSIT_REFUND_DUE', 'DEPOSIT_REFUND_OVERDUE'] as const

  /**
   * Resolved directly, never through `dismiss()`: whether the current user can
   * see an alert must not decide whether a settled obligation keeps nagging
   * everybody else.
   */
  function resolveRefundAlerts(reservationId: string) {
    for (const alert of alerts.value) {
      if (alert.status !== 'ACTIVE')
        continue
      if (!ALERTS_TO_RESOLVE.includes(alert.type as typeof ALERTS_TO_RESOLVE[number]))
        continue
      if (alert.context?.reservation_id !== reservationId)
        continue
      alerts.value = alerts.value.map(a => a.alert_id === alert.alert_id
        ? { ...a, status: 'RESOLVED' as const, resolved_at: new Date().toISOString() }
        : a)
    }
  }

  async function releaseDeposit(reservationId: string, forceFailure = false): Promise<ProtectionWriteResult> {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return { ok: false, reason: 'no_protection' }

    const verdict = canRelease(protection)
    if (!verdict.ok)
      return { ok: false, reason: verdict.reason }

    if (forceFailure) {
      const failed: DamageProtection = {
        ...protection,
        state: 'refund_failed',
        refundFailureReason: 'Refund rejected by the payment provider',
      }
      commit(reservation, failed, protectionActivityEvent('refund_failed', failed, actor.value, failed.refundFailureReason))
      createProtectionAlert('DEPOSIT_REFUND_FAILED', {
        reservation_id: reservation.id,
        listing_id: reservation.listingId,
        guest_name: reservation.guestName,
        reason: failed.refundFailureReason,
      })
      return { ok: false, reason: 'refund_failed' }
    }

    const refundable = refundableAmount(protection)
    const released: DamageProtection = {
      ...protection,
      state: settledStateFor(protection),
      refundedAt: new Date().toISOString(),
      refundedAmount: refundable,
      refundFailureReason: undefined,
    }
    const detail = `${formatProtectionAmount(refundable, released.currency)} returned`
    commit(reservation, released, protectionActivityEvent('released', released, actor.value, detail))
    resolveRefundAlerts(reservation.id)
    return { ok: true }
  }

  function retryRefund(reservationId: string) {
    return releaseDeposit(reservationId)
  }

  function updateRefundDestination(
    reservationId: string,
    destination: DamageProtection['refundDestination'],
  ): ProtectionWriteResult {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return { ok: false, reason: 'no_protection' }
    updateReservation(reservation.id, {
      damageProtection: { ...protection, refundDestination: destination },
    })
    return { ok: true }
  }

  /**
   * A cancellation refunds in full, on both paths, and admits no claim: no stay
   * happened, so no damage did. Deliberately NOT the graduated ladder in
   * upsells/data/cancellation-policies.ts, which prices a service the operator
   * held capacity for. A no-show on a non-refundable rate is a folio charge.
   */
  function cancelProtection(reservationId: string): ProtectionWriteResult {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return { ok: false, reason: 'no_protection' }
    if ((protection.claims ?? []).length > 0)
      return { ok: false, reason: 'claims_recorded' }

    const collected = protection.state === 'deposit_held'
      || protection.state === 'waiver_active'
      || protection.state === 'refund_failed'

    const next: DamageProtection = {
      ...protection,
      state: 'cancelled_refunded',
      refundedAt: new Date().toISOString(),
      refundedAmount: collected ? protection.amount : 0,
      refundFailureReason: undefined,
    }
    commit(reservation, next, protectionActivityEvent('cancelled', next, actor.value))
    resolveRefundAlerts(reservation.id)
    return { ok: true }
  }

  function undoSettlement(reservationId: string): ProtectionWriteResult {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return { ok: false, reason: 'no_protection' }
    const next: DamageProtection = {
      ...protection,
      state: 'deposit_held',
      refundedAt: undefined,
      refundedAmount: undefined,
      // Deductions are KEPT: losing the evidence trail on an undo would be
      // worse than the mis-click that prompted it.
    }
    commit(reservation, next, protectionActivityEvent('undone', next, actor.value))
    return { ok: true }
  }

  /**
   * Extending across a band boundary RE-OPENS the choice for the added period.
   * It never silently re-prices the original one: the existing freeze stays
   * valid for the nights it was agreed for.
   */
  function reassessOnExtension(reservationId: string, previousNights: number) {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return
    const before = policyFor(reservation.listingId, previousNights)
    const after = policyFor(reservation.listingId, reservation.nights)
    if (!after || before?.id === after.id)
      return
    createProtectionAlert('PROTECTION_CHOICE_MISSING', {
      reservation_id: reservation.id,
      listing_id: reservation.listingId,
      guest_name: reservation.guestName,
      check_in: reservation.checkIn,
      reason: 'stay_extended_across_band',
    })
  }

  // ------------------------------------------------------------- the worklist

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
      .filter((row): row is ProtectionRow => row !== null),
  )

  function inBucket(bucket: ProtectionBucket) {
    return computed(() => rows.value.filter(row => row.bucket === bucket))
  }

  const awaitingChoice = inBucket('awaiting_choice')
  const chargeDue = inBucket('charge_due')
  const failed = inBucket('failed')
  const held = inBucket('held')
  const refundDue = inBucket('refund_due')
  const refundOverdue = inBucket('refund_overdue')
  const settled = inBucket('settled')

  /** Per currency, never blended: this app invents no exchange rates. */
  function totalsByCurrency(subset: ProtectionRow[], pick: (row: ProtectionRow) => number): CurrencyTotal[] {
    const map = new Map<string, number>()
    for (const row of subset) {
      const currency = row.protection?.currency ?? row.policy.currency
      map.set(currency, (map.get(currency) ?? 0) + pick(row))
    }
    return [...map.entries()]
      .map(([currency, amount]) => ({ currency, amount }))
      .filter(total => total.amount !== 0)
  }

  const heldTotals = computed(() => totalsByCurrency(held.value, row => row.refundable))
  const refundDueTotals = computed(() => totalsByCurrency(
    [...refundDue.value, ...refundOverdue.value],
    row => row.refundable,
  ))

  /**
   * Fees collected against claims paid, per currency, as TWO figures. The only
   * place the operator can see whether the waiver is priced right. Netting them
   * into one number would hide exactly the signal this exists to give.
   */
  const waiverPotTotals = computed(() => {
    const waivers = rows.value.filter(row => row.protection?.option === 'waiver')
    return {
      collected: totalsByCurrency(waivers, row => row.protection?.amount ?? 0),
      paidOut: totalsByCurrency(waivers, row => row.waiverPaid),
    }
  })

  /**
   * A policy assigned to a listing does nothing unless that listing's guest
   * guide also has an enabled `damage_protection` section. The two assignments
   * are independent lists, so the mismatch would otherwise fail silently, with
   * the guest never seeing a choice screen.
   */
  function listingsMissingGuideSection(): string[] {
    const { guides } = useGuestGuides()
    const assigned = new Set(assignments.value.map(a => a.listingId))
    return [...assigned].filter((listingId) => {
      const guide = guides.value.find(
        g => g.status !== 'archived' && g.assignedListingIds.includes(listingId),
      )
      if (!guide)
        return true
      return !guide.sections.some(section => section.type === 'damage_protection' && section.enabled)
    })
  }

  const CHOICE_WARNING_MS = 24 * 60 * 60 * 1000

  function hasLiveAlert(reservationId: string, type: string): boolean {
    return alerts.value.some(a =>
      a.status === 'ACTIVE' && a.type === type && a.context?.reservation_id === reservationId,
    )
  }

  /** In-app, not a scheduler. Same boundary as Smart Lock, Minut and city tax. */
  function emitProtectionAlerts() {
    const now = Date.now()
    for (const row of rows.value) {
      const { reservation, protection } = row
      if (reservation.status === 'cancelled')
        continue

      if (row.bucket === 'awaiting_choice') {
        const checkIn = new Date(`${reservation.checkIn}T00:00:00`).getTime()
        if (checkIn - now <= CHOICE_WARNING_MS && !hasLiveAlert(reservation.id, 'PROTECTION_CHOICE_MISSING')) {
          createProtectionAlert('PROTECTION_CHOICE_MISSING', {
            reservation_id: reservation.id,
            listing_id: reservation.listingId,
            guest_name: reservation.guestName,
            check_in: reservation.checkIn,
          })
        }
        continue
      }

      if (!protection)
        continue

      if (row.bucket === 'refund_due' && !hasLiveAlert(reservation.id, 'DEPOSIT_REFUND_DUE')) {
        createProtectionAlert('DEPOSIT_REFUND_DUE', {
          reservation_id: reservation.id,
          listing_id: reservation.listingId,
          guest_name: reservation.guestName,
          currency: protection.currency,
          refundable_amount: row.refundable,
        })
      }
      if (row.bucket === 'refund_overdue' && !hasLiveAlert(reservation.id, 'DEPOSIT_REFUND_OVERDUE')) {
        createProtectionAlert('DEPOSIT_REFUND_OVERDUE', {
          reservation_id: reservation.id,
          listing_id: reservation.listingId,
          guest_name: reservation.guestName,
          currency: protection.currency,
          refundable_amount: row.refundable,
        })
      }
    }
  }

  return {
    actor,
    canViewProtection,
    canEditProtection,
    policies,
    assignments,
    hydrate,
    // reads
    policyFor,
    payoutAccountFor,
    railForListing,
    protectionFor,
    isOfferedFor,
    optionsFor,
    bucketFor,
    releaseRefusalFor,
    listingsMissingGuideSection,
    // policy CRUD
    savePolicy,
    deletePolicy,
    assignBand,
    removeBand,
    // writers
    recordChoice,
    chargeDeposit,
    retryCharge,
    isCharging,
    recordClaim,
    removeClaim,
    notifyGuestOfClaim,
    releaseDeposit,
    retryRefund,
    updateRefundDestination,
    cancelProtection,
    undoSettlement,
    reassessOnExtension,
    // worklist
    rows,
    awaitingChoice,
    chargeDue,
    failed,
    held,
    refundDue,
    refundOverdue,
    settled,
    heldTotals,
    refundDueTotals,
    waiverPotTotals,
    markAsRead,
    emitProtectionAlerts,
  }
}
