import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type {
  CardInput,
  ClaimDraft,
  DamageProtectionAssignment,
  DamageProtectionPolicy,
  ProtectionBucket,
  ProtectionChoiceDraft,
  ProtectionOptionView,
  ProtectionRail,
  SettleRefusal,
  StaySlot,
} from '~/components/reservations/data/damage-protection'
import type { DamageProtection, ProtectionClaim, ProtectionPayer, ReservationEntry, SavedCard } from '~/components/reservations/data/reservations'
import { computed, ref } from 'vue'
import {
  assignmentForStay,
  buildOptions,
  canSettle,
  cardInputError,
  chargeableTotal,
  chargeMandateText,
  claimCoverage,
  claimEvidenceSummary,
  depositAmount,
  formatProtectionAmount,
  formatSavedCard,
  hostCoverProtection,
  isChoiceValid,
  isClaimValid,
  isGuestStay,
  listingSlots,
  overlappingBands,
  protectionActivityEvent,
  protectionOffered,
  remainingCover,
  resolveBucket,
  savedCardFrom,
  settleDueAt,
  settleOutcome,
  SLOT_RANGES,
  waiverAmount,
  waiverCover,
  waiverPotTotal,
} from '~/components/reservations/data/damage-protection'
import { seedProtectionAssignments, seedProtectionPayers, seedProtectionPolicies } from '~/components/reservations/data/damage-protection-seed'
import { payoutAccounts } from '~/components/settings/data/payouts'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useGuestGuides } from '~/composables/useGuestGuides'
import { useNotifications } from '~/composables/useNotifications'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useRoles } from '~/composables/useRoles'
import { useTernActivation } from '~/composables/useTernActivation'

// v3: the waiver's cover comes from a Tern tier and the tenant only sets the
// guest price, so a v2 policy carries pricing, cap and exclusion fields that no
// longer exist. v2 itself replaced the charge-upfront deposit.
const STORAGE_KEY = 'elev8-damage-protection-v3'

/** The mock gateway round trip. Long enough for the spinner to be visible. */
const GATEWAY_MOCK_MS = 1500

export interface ProtectionRow {
  reservation: ReservationEntry
  policy: DamageProtectionPolicy
  protection: DamageProtection | null
  bucket: ProtectionBucket
  /** What the saved card is to be charged for the claims so far. */
  chargeable: number
  /** How much more the saved card may still be charged. */
  remaining: number
  /** What the waiver pot paid out on this stay. Feeds the pricing read-out. */
  waiverPaid: number
}

/**
 * The three things a property can do (owner's decision, 2026-09-25): no
 * protection, the guest buys the waiver in the guest guide, or the host pays
 * for it and the guest is never asked.
 */
export type ListingProtectionMode = 'off' | 'guest_paid' | 'host_paid'

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
 * The deposit is a card saved with Stripe, charged only for damage and only
 * after the guest has been told. Nothing is collected upfront, so there is no
 * refund leg at all.
 *
 * It never writes `priceDetails` or the folio. A damage charge is not revenue,
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
   * ⚠️ The waiver is Tern's cover, so it only runs once the tenant has
   * activated the service. Until then a policy offering the waiver is paused
   * whole (its deposit too, rather than quietly becoming deposit-only on
   * channels nobody picked), a listing cannot be host-paid, and no host cover
   * is written. Deposit-only policies are not Tern's and keep working.
   */
  const tern = useTernActivation()
  const waiverServiceActive = computed(() => tern.isActive.value)
  function pausedUntilActivation(policy: DamageProtectionPolicy | null): boolean {
    return Boolean(policy?.offers.includes('waiver')) && !waiverServiceActive.value
  }

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
  /** Per listing. Absent means the guest pays. Only read where the listing has a policy. */
  const payers = useState<Record<string, ProtectionPayer>>(
    'damage-protection-payers',
    () => ({ ...seedProtectionPayers }),
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
        payers: payers.value,
      }))
    }
    catch { /* quota or private mode */ }
  }

  function hydrate() {
    if (typeof localStorage === 'undefined')
      return
    // First: whether the waiver may run at all decides what the sync below writes.
    tern.hydrate()
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed.policies))
          policies.value = parsed.policies
        if (Array.isArray(parsed.assignments))
          assignments.value = parsed.assignments
        if (parsed.payers && typeof parsed.payers === 'object')
          payers.value = parsed.payers
      }
    }
    catch { /* corrupt payload, keep the seed */ }
    // No booking-created hook and no scheduler in this app: catching up on
    // hydrate is what covers a host-paid listing's new stays.
    syncHostCover()
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
   * Only a listing that settles on Stripe can save a card for a later charge.
   * Everything else (QRIS, virtual account, e-wallet, and any listing without a
   * payout account) answers 'non_card' and is offered the waiver only.
   */
  function railForListing(listingId: string): ProtectionRail {
    return payoutAccountFor(listingId)?.provider === 'stripe' ? 'card' : 'non_card'
  }

  function protectionFor(id: string): DamageProtection | null {
    return reservationById(id)?.damageProtection ?? null
  }

  function payerFor(listingId: string): ProtectionPayer {
    return payers.value[listingId] ?? 'guest'
  }

  /** Off when the listing has no policy at all; otherwise who pays. */
  function listingMode(listingId: string): ListingProtectionMode {
    if (!assignments.value.some(a => a.listingId === listingId))
      return 'off'
    return payerFor(listingId) === 'host' ? 'host_paid' : 'guest_paid'
  }

  /**
   * Whether a booking falls under protection at all, whoever pays. Host-paid
   * needs a waiver to pay for: a deposit-only policy has nothing the host can
   * buy on the guest's behalf.
   */
  function inScope(reservation: ReservationEntry, policy: DamageProtectionPolicy | null): policy is DamageProtectionPolicy {
    if (!policy)
      return false
    if (payerFor(reservation.listingId) === 'host')
      return policy.offers.includes('waiver')
    return protectionOffered(policy, reservation.channel)
  }

  /** The guest is ASKED to choose. Never on a host-paid listing. */
  function isOfferedFor(id: string): boolean {
    const reservation = reservationById(id)
    if (!reservation)
      return false
    // Status FIRST: an owner stay and a maintenance block are both channel
    // 'Direct'. Owners make their own reservations and pay nothing, so an owner
    // stay is never protected, whatever the policy covers.
    if (!isGuestStay(reservation.status))
      return false
    if (payerFor(reservation.listingId) === 'host')
      return false
    const policy = policyFor(reservation.listingId, reservation.nights)
    if (!policy || !protectionOffered(policy, reservation.channel) || pausedUntilActivation(policy))
      return false
    // A deposit-only policy on a listing that cannot save a card has nothing
    // left to offer, so the guest is not asked at all.
    return buildOptions(policy, reservation, railForListing(reservation.listingId)).length > 0
  }

  function optionsFor(id: string): ProtectionOptionView[] {
    const reservation = reservationById(id)
    if (!reservation || !isOfferedFor(id))
      return []
    const policy = policyFor(reservation.listingId, reservation.nights)
    return policy ? buildOptions(policy, reservation, railForListing(reservation.listingId)) : []
  }

  function bucketFor(id: string): ProtectionBucket {
    const reservation = reservationById(id)
    if (!reservation)
      return 'not_offered'
    return resolveBucket(reservation.damageProtection, reservation)
  }

  function settleRefusalFor(id: string): SettleRefusal | null {
    const protection = protectionFor(id)
    if (!protection)
      return null
    const verdict = canSettle(protection)
    return verdict.ok ? null : verdict.reason
  }

  // ------------------------------------------------------------ policy CRUD

  /**
   * Whether this save would switch the waiver ON: a new policy offering it, or
   * an existing one that did not. A policy already offering it may still be
   * edited while the service is not active; it simply stays paused.
   */
  function turnsWaiverOn(policy: DamageProtectionPolicy): boolean {
    if (!policy.offers.includes('waiver'))
      return false
    const existing = policies.value.find(p => p.id === policy.id)
    return !existing?.offers.includes('waiver')
  }

  /**
   * ⚠️ Refuses to turn the waiver on before the service is activated
   * (`waiver_not_activated`): a waiver policy made then could only ever sit
   * paused, and the activation is where the tenant accepts Tern's terms.
   */
  function savePolicy(policy: DamageProtectionPolicy): ProtectionWriteResult {
    if (turnsWaiverOn(policy) && !waiverServiceActive.value)
      return { ok: false, reason: 'waiver_not_activated' }
    // Touches `policies` only, never a reservation: the frozen amount, cap and
    // terms on an accepted protection is what a guest agreed to.
    const index = policies.value.findIndex(p => p.id === policy.id)
    const next = { ...policy, updatedAt: new Date().toISOString() }
    policies.value = index === -1
      ? [...policies.value, next]
      : policies.value.map(p => p.id === policy.id ? next : p)
    persist()
    return { ok: true }
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

  /**
   * The settings page's way in: set, change or clear the policy a listing uses
   * for short or long stays. Replaces exactly that slot's band and nothing
   * else, and goes through `assignBand`, so the currency and overlap checks
   * still apply.
   */
  function setListingSlot(listingId: string, slot: StaySlot, policyId: string | null): ProtectionWriteResult {
    const range = SLOT_RANGES[slot]
    const isSlot = (a: DamageProtectionAssignment) =>
      a.listingId === listingId && a.minNights === range.minNights && a.maxNights === range.maxNights
    if (policyId && payerFor(listingId) === 'host'
      && !policies.value.find(p => p.id === policyId)?.offers.includes('waiver')) {
      return { ok: false, reason: 'host_needs_waiver' }
    }
    const previous = assignments.value
    assignments.value = previous.filter(a => !isSlot(a))
    if (!policyId) {
      persist()
      syncHostCover()
      return { ok: true }
    }
    const result = assignBand(listingId, policyId, range.minNights, range.maxNights)
    if (!result.ok)
      assignments.value = previous
    else
      syncHostCover()
    return result
  }

  /**
   * The per-listing choice: no protection, guest pays, or host pays.
   *
   * - 'off' clears the listing's policies.
   * - Turning a listing on with no policy yet assigns the standard templates in
   *   its currency (or failing those, a usable policy in that currency), so a
   *   tenant only has to pick who pays.
   * - 'host_paid' refuses a listing whose only policy is deposit-only: the host
   *   has no waiver to pay for there.
   */
  function setListingMode(listingId: string, mode: ListingProtectionMode): ProtectionWriteResult {
    if (mode === 'off') {
      assignments.value = assignments.value.filter(a => a.listingId !== listingId)
      payers.value = Object.fromEntries(Object.entries(payers.value).filter(([id]) => id !== listingId))
      persist()
      syncHostCover()
      return { ok: true }
    }
    const payer: ProtectionPayer = mode === 'host_paid' ? 'host' : 'guest'
    if (payer === 'host' && !waiverServiceActive.value)
      return { ok: false, reason: 'waiver_not_activated' }
    const current = assignments.value.filter(a => a.listingId === listingId)
    if (payer === 'host' && current.length > 0 && current.every(a =>
      !policies.value.find(p => p.id === a.policyId)?.offers.includes('waiver'))) {
      return { ok: false, reason: 'host_needs_waiver' }
    }
    const previousPayers = payers.value
    payers.value = { ...payers.value, [listingId]: payer }
    if (current.length === 0) {
      const currency = payoutAccountFor(listingId)?.currency ?? 'USD'
      const usable = (p: DamageProtectionPolicy) =>
        p.currency === currency && (payer === 'guest' || p.offers.includes('waiver'))
      const fromTemplate = (templateId: string) =>
        policies.value.find(p => p.templateId === templateId && usable(p))
      // The standard templates first; failing those, any policy the listing
      // can use in its own currency, for short stays. Never another currency.
      const short = fromTemplate('standard_short') ?? policies.value.find(p => usable(p) && p.templateId !== 'standard_long')
      const long = fromTemplate('standard_long')
      if (!short && !long) {
        payers.value = previousPayers
        return { ok: false, reason: 'no_policy_in_currency' }
      }
      if (short)
        assignBand(listingId, short.id, SLOT_RANGES.short.minNights, SLOT_RANGES.short.maxNights)
      if (long)
        assignBand(listingId, long.id, SLOT_RANGES.long.minNights, SLOT_RANGES.long.maxNights)
    }
    else if (payer === 'host') {
      // A deposit-only slot has nothing the host can pay for: dropped, the
      // waiver slot beside it stays.
      assignments.value = assignments.value.filter(a => a.listingId !== listingId
        || policies.value.find(p => p.id === a.policyId)?.offers.includes('waiver'))
    }
    persist()
    syncHostCover()
    return { ok: true }
  }

  /**
   * Host-paid listings cover their guest stays without asking anyone. Written
   * as a real protection (`hostCoverProtection`) so a claim, the insurance
   * partner claim and the Elev8 fee all have a frozen record to hang off.
   *
   * - Covers a guest stay that has not checked out and carries no protection
   *   yet, or only an unanswered `awaiting_choice`. It never covers a stay that
   *   is over: cover bought after the fact is not cover.
   * - A guest's own accepted choice (a paid waiver, a saved card) is left
   *   alone: it is what they agreed to.
   * - A host cover on a stay that was cancelled is closed, with nothing to
   *   refund since the guest paid nothing.
   * - A host cover whose listing is no longer host-paid is removed while the
   *   stay has not started and no claim hangs off it, so the guest is asked.
   *
   * Idempotent: running it twice writes nothing the second time.
   */
  function syncHostCover(now: Date = new Date()) {
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const dayOf = (iso: string) => new Date(`${iso}T00:00:00`).getTime()
    for (const reservation of reservations.value) {
      const existing = reservation.damageProtection
      const isHostCover = existing?.paidBy === 'host'
      const policy = policyFor(reservation.listingId, reservation.nights)
      const hostPaid = payerFor(reservation.listingId) === 'host' && Boolean(policy?.offers.includes('waiver'))

      if (isHostCover && existing) {
        const noClaims = (existing.claims ?? []).length === 0
        if (reservation.status === 'cancelled' && existing.state === 'waiver_active' && noClaims) {
          const closed: DamageProtection = { ...existing, state: 'cancelled' }
          commit(reservation, closed, protectionActivityEvent('cancelled', closed, actor.value, 'Stay cancelled, nothing to refund: the host paid for the cover'))
          continue
        }
        if (!hostPaid && noClaims && dayOf(reservation.checkIn) > today.getTime() && existing.state === 'waiver_active') {
          updateReservation(reservation.id, {
            damageProtection: undefined,
            activity: [...reservation.activity, protectionActivityEvent('host_cover_removed', existing, actor.value)],
          })
        }
        continue
      }

      if (!hostPaid || !policy || !isGuestStay(reservation.status) || !waiverServiceActive.value)
        continue
      if (existing && existing.state !== 'awaiting_choice')
        continue
      if (dayOf(reservation.checkOut) <= today.getTime())
        continue
      const cover = hostCoverProtection(policy, now)
      if (cover)
        commit(reservation, cover, protectionActivityEvent('host_covered', cover, actor.value))
    }
  }

  /**
   * Set the short and/or long stay policy on many listings at once. `undefined`
   * leaves that slot as it is, `null` clears it. Each listing goes through
   * `setListingSlot`, so the same currency and overlap checks apply one by one;
   * a listing that is refused, or uses custom night ranges, is SKIPPED and
   * reported, never half-applied and never silently dropped.
   */
  function setSlotsForListings(
    listingIds: string[],
    change: { short?: string | null, long?: string | null },
  ): { applied: string[], skipped: { listingId: string, reason: string }[] } {
    const applied: string[] = []
    const skipped: { listingId: string, reason: string }[] = []
    for (const listingId of listingIds) {
      if (listingSlots(assignments.value, listingId).custom) {
        skipped.push({ listingId, reason: 'custom_ranges' })
        continue
      }
      const before = assignments.value
      let refusal: string | null = null
      for (const slot of ['short', 'long'] as const) {
        const value = change[slot]
        if (value === undefined)
          continue
        const result = setListingSlot(listingId, slot, value)
        if (!result.ok) {
          refusal = result.reason
          break
        }
      }
      if (refusal) {
        // Both slots or neither: a listing is never left half-changed.
        assignments.value = before
        persist()
        skipped.push({ listingId, reason: refusal })
      }
      else {
        applied.push(listingId)
      }
    }
    return { applied, skipped }
  }

  /** Clears a listing's custom night ranges so it can use the two standard slots. */
  function resetListingBands(listingId: string) {
    assignments.value = assignments.value.filter(a => a.listingId !== listingId)
    persist()
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

  const savingCard = ref(false)

  /**
   * Mock of a Stripe SetupIntent: the card is checked, "saved", and what comes
   * back is a reference plus the last four digits. ⚠️ `input` is dropped here;
   * the card number is never stored, and in production never even reaches this
   * app (Stripe Elements owns the fields). Nothing is charged.
   */
  async function saveCard(
    input: CardInput,
    forceDecline = false,
  ): Promise<{ ok: true, card: SavedCard } | { ok: false, reason: string }> {
    const invalid = cardInputError(input)
    if (invalid)
      return { ok: false, reason: invalid }
    savingCard.value = true
    await new Promise(resolve => setTimeout(resolve, GATEWAY_MOCK_MS))
    savingCard.value = false
    if (forceDecline)
      return { ok: false, reason: 'The card was declined when we tried to save it.' }
    const last4 = input.number.replace(/\D/g, '').slice(-4)
    return { ok: true, card: savedCardFrom(input, `pm_mock_${last4}_${Date.now()}`) }
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
    if (!isChoiceValid(draft, policy, railForListing(reservation.listingId), reservation))
      return { ok: false, reason: 'invalid_choice' }

    const isWaiver = draft.option === 'waiver'
    const amount = isWaiver ? waiverAmount(policy) : depositAmount(policy, reservation)
    const cover = isWaiver ? waiverCover(policy) : null
    const protection: DamageProtection = {
      policyId: policy.id,
      option: draft.option,
      state: isWaiver ? 'waiver_active' : 'card_on_file',
      // FROZEN at acceptance. A later policy edit, or a Tern price change,
      // cannot rewrite these.
      amount,
      currency: policy.currency,
      coverageCap: cover?.coverageCap,
      ...(isWaiver ? { paidBy: 'guest' as const, tier: policy.waiver.tier, elev8Fee: cover?.perStayFee } : {}),
      termsVersion: policy.termsVersion,
      termsText: policy.termsText,
      acceptedAt: new Date().toISOString(),
      acceptedVia: via,
      ...(isWaiver
        ? {}
        : {
            card: { ...draft.card! },
            chargeMandate: chargeMandateText(amount, policy.currency, policy.deposit.settleWithinDays),
            payoutAccountId: payoutAccountFor(reservation.listingId)?.id,
            settleDueAt: settleDueAt(reservation, policy),
          }),
      claims: [],
    }
    commit(reservation, protection, protectionActivityEvent('chosen', protection, actor.value))
    return { ok: true }
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
    // One cleaning finding, one claim. Two claims on the same cracked screen
    // would charge the guest twice for it.
    const findingId = draft.cleaningReport?.findingId
    if (findingId && (protection.claims ?? []).some(c => c.cleaningReport?.findingId === findingId))
      return { ok: false, reason: 'finding_already_claimed' }

    const { coveredAmount, excessAmount } = claimCoverage(protection, draft.amount)
    const claim: ProtectionClaim = {
      id: `clm-${Date.now()}-${(protection.claims?.length ?? 0) + 1}`,
      label: draft.label.trim(),
      amount: draft.amount,
      coveredAmount,
      excessAmount,
      reason: draft.reason.trim(),
      evidenceUrls: [...draft.evidenceUrls],
      // Copied, never the caller's object: the claim is a snapshot.
      ...(draft.cleaningReport ? { cleaningReport: { ...draft.cleaningReport } } : {}),
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

  /**
   * The one door for another module to change a recorded claim (today: the
   * insurance partner claim, `usePartnerClaims`). The claim and its audit line
   * land in the same write, like every other action here, and nothing else on
   * the protection can be touched through it.
   */
  function patchClaim(
    reservationId: string,
    claimId: string,
    patch: Partial<Pick<ProtectionClaim, 'partnerClaim'>>,
    detail: string,
  ): ProtectionWriteResult {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return { ok: false, reason: 'no_protection' }
    if (!(protection.claims ?? []).some(c => c.id === claimId))
      return { ok: false, reason: 'claim_not_found' }
    const next: DamageProtection = {
      ...protection,
      claims: (protection.claims ?? []).map(c => c.id === claimId ? { ...c, ...patch } : c),
    }
    commit(reservation, next, protectionActivityEvent('partner_update', next, actor.value, detail))
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
    // Filed with the insurance partner: removing it here would orphan theirs.
    if (claim.partnerClaim && claim.partnerClaim.status !== 'withdrawn')
      return { ok: false, reason: 'filed_with_partner' }

    const next: DamageProtection = {
      ...protection,
      claims: (protection.claims ?? []).filter(c => c.id !== claimId),
    }
    commit(reservation, next, protectionActivityEvent('undone', next, actor.value, `Claim removed: ${claim.label}`))
    return { ok: true }
  }

  /**
   * A charge the guest first meets on their card statement is a chargeback.
   * `canSettle` refuses until this has run, so the card cannot be charged quietly.
   */
  async function notifyGuestOfClaim(reservationId: string, claimId: string): Promise<ProtectionWriteResult> {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return { ok: false, reason: 'no_protection' }
    const claim = (protection.claims ?? []).find(c => c.id === claimId)
    if (!claim)
      return { ok: false, reason: 'claim_not_found' }

    const cardLine = protection.card ? ` (${formatSavedCard(protection.card)})` : ''
    const body = [
      `We recorded a damage claim on your stay: ${claim.label}.`,
      `Assessed at ${formatProtectionAmount(claim.amount, protection.currency)}.`,
      protection.option === 'deposit'
        ? `${formatProtectionAmount(claim.coveredAmount, protection.currency)} will be charged to the card you saved${cardLine}.`
        : protection.paidBy === 'host'
          ? `This is covered by the damage protection included with your stay, at no cost to you.`
          : `This is covered by your damage waiver at no cost to you.`,
      claim.excessAmount > 0
        ? `${formatProtectionAmount(claim.excessAmount, protection.currency)} is above your cover and will be invoiced separately.`
        : '',
      `Reason: ${claim.reason}`,
      claimEvidenceSummary(claim) ? `Evidence: ${claimEvidenceSummary(claim)}.` : '',
    ].filter(Boolean).join('\n')

    let delivered = false
    try {
      // useInbox imports useUpsellOrders, which calls into this module's
      // siblings. A static import closes a cycle. Same rule, same reason, as
      // useUpsellLockAccess.messageGuest. Do not tidy this into a top-level import.
      const { useInbox } = await import('~/composables/useInbox')
      const inbox = useInbox()
      // The reservation's thread, or a new email one on the guest's address:
      // a direct booking often has no thread, and the guest must still be told.
      const conversationId = inbox.ensureConversationForReservation(reservation)
      const conversation = inbox.conversations.value.find(c => c.id === conversationId)
      if (conversation) {
        inbox.sendMessage(conversation.id, body, conversation.otaSource)
        delivered = true
      }
    }
    catch { /* inbox unavailable during SSR or in a stubbed test */ }

    // Without delivery the stamp stays unset, so the settle gate stays closed
    // rather than silently opening on a notice nobody received. Only a guest
    // with no thread and no email address lands here.
    if (!delivered)
      return { ok: false, reason: 'no_contact' }

    const next: DamageProtection = {
      ...protection,
      claims: (protection.claims ?? []).map(c =>
        c.id === claimId ? { ...c, guestNotifiedAt: new Date().toISOString() } : c,
      ),
    }
    commit(reservation, next, protectionActivityEvent('notified', next, actor.value, claim.label))
    return { ok: true }
  }

  const OPEN_DEPOSIT_ALERTS = ['DEPOSIT_DECISION_DUE', 'DEPOSIT_DECISION_OVERDUE', 'DEPOSIT_CHARGE_FAILED'] as const

  /**
   * Resolved directly, never through `dismiss()`: whether the current user can
   * see an alert must not decide whether a settled obligation keeps nagging
   * everybody else.
   */
  function resolveDepositAlerts(reservationId: string) {
    for (const alert of alerts.value) {
      if (alert.status !== 'ACTIVE')
        continue
      if (!OPEN_DEPOSIT_ALERTS.includes(alert.type as typeof OPEN_DEPOSIT_ALERTS[number]))
        continue
      if (alert.context?.reservation_id !== reservationId)
        continue
      alerts.value = alerts.value.map(a => a.alert_id === alert.alert_id
        ? { ...a, status: 'RESOLVED' as const, resolved_at: new Date().toISOString() }
        : a)
    }
  }

  const charging = ref<Set<string>>(new Set())

  function isCharging(reservationId: string): boolean {
    return charging.value.has(reservationId)
  }

  /**
   * Charge the covered claims to the saved card, or close the deposit without a
   * charge when there is nothing to charge. One off-session charge for the
   * total, never one per claim: a guest billed four times for one stay reads it
   * as four disputes.
   */
  async function settleDeposit(reservationId: string, forceDecline = false): Promise<ProtectionWriteResult> {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return { ok: false, reason: 'no_protection' }
    const verdict = canSettle(protection)
    if (!verdict.ok)
      return { ok: false, reason: verdict.reason }
    if (charging.value.has(reservationId))
      return { ok: false, reason: 'already_charging' }

    const total = chargeableTotal(protection)
    if (settleOutcome(protection) === 'deposit_released') {
      const released: DamageProtection = { ...protection, state: 'deposit_released', releasedAt: new Date().toISOString() }
      commit(reservation, released, protectionActivityEvent('released', released, actor.value, 'The saved card is no longer on file'))
      resolveDepositAlerts(reservation.id)
      return { ok: true }
    }

    charging.value = new Set(charging.value).add(reservationId)
    await new Promise(resolve => setTimeout(resolve, GATEWAY_MOCK_MS))
    const next = new Set(charging.value)
    next.delete(reservationId)
    charging.value = next

    const current = reservationById(reservationId)
    const live = current?.damageProtection
    if (!current || !live)
      return { ok: false, reason: 'no_protection' }

    if (forceDecline) {
      const failed: DamageProtection = {
        ...live,
        state: 'charge_failed',
        chargeFailureReason: 'Card declined by issuer',
        chargeAttempts: (live.chargeAttempts ?? 0) + 1,
      }
      commit(current, failed, protectionActivityEvent('charge_failed', failed, actor.value, failed.chargeFailureReason))
      createProtectionAlert('DEPOSIT_CHARGE_FAILED', {
        reservation_id: current.id,
        listing_id: current.listingId,
        guest_name: current.guestName,
        currency: failed.currency,
        charge_amount: total,
        reason: failed.chargeFailureReason,
      })
      return { ok: false, reason: 'charge_declined' }
    }

    const charged: DamageProtection = {
      ...live,
      state: 'deposit_charged',
      chargedAt: new Date().toISOString(),
      chargedAmount: total,
      chargeAttempts: (live.chargeAttempts ?? 0) + 1,
      chargeFailureReason: undefined,
    }
    const detail = `${formatProtectionAmount(total, charged.currency)}${charged.card ? ` to ${formatSavedCard(charged.card)}` : ''}`
    commit(current, charged, protectionActivityEvent('charged', charged, actor.value, detail))
    resolveDepositAlerts(current.id)
    return { ok: true }
  }

  function retryCharge(reservationId: string, forceDecline = false) {
    return settleDeposit(reservationId, forceDecline)
  }

  /**
   * A cancellation admits no claim: no stay happened, so no damage did. A
   * waiver fee is returned in full; a saved card is released, since nothing was
   * ever charged to it. Deliberately NOT the graduated ladder in
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

    const now = new Date().toISOString()
    // A host-paid waiver took nothing from the guest: closed, nothing refunded.
    const isWaiver = protection.state === 'waiver_active' && protection.paidBy !== 'host'
    const next: DamageProtection = {
      ...protection,
      state: 'cancelled',
      ...(isWaiver ? { refundedAt: now, refundedAmount: protection.amount } : {}),
      ...(protection.state === 'card_on_file' ? { releasedAt: now } : {}),
    }
    const detail = isWaiver
      ? `${formatProtectionAmount(protection.amount, protection.currency)} waiver fee refunded`
      : protection.state === 'card_on_file'
        ? 'Saved card released, nothing charged'
        : protection.paidBy === 'host' ? 'Nothing to refund: the host paid for the cover' : ''
    commit(reservation, next, protectionActivityEvent('cancelled', next, actor.value, detail))
    resolveDepositAlerts(reservation.id)
    return { ok: true }
  }

  /**
   * Reopens a deposit that was closed without a charge, for the mis-click. A
   * CHARGED deposit cannot be undone here: money moved, and taking it back is a
   * refund through the gateway, which this mock does not model.
   */
  function undoSettlement(reservationId: string): ProtectionWriteResult {
    const reservation = reservationById(reservationId)
    const protection = reservation?.damageProtection
    if (!reservation || !protection)
      return { ok: false, reason: 'no_protection' }
    if (protection.state !== 'deposit_released')
      return { ok: false, reason: protection.state === 'deposit_charged' ? 'charge_cannot_be_undone' : 'nothing_to_undo' }
    const next: DamageProtection = { ...protection, state: 'card_on_file', releasedAt: undefined }
    commit(reservation, next, protectionActivityEvent('undone', next, actor.value, 'Deposit reopened'))
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
    // Nobody is asked on a host-paid listing: the cover already follows the stay.
    if (protection.paidBy === 'host')
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
        // A cancelled stay still produces a row: it may be owed its waiver fee,
        // or have a card to release. `blocked` and `owner_request` never do.
        if (reservation.status === 'blocked' || reservation.status === 'owner_request')
          return null
        const policy = policyFor(reservation.listingId, reservation.nights)
        const protection = reservation.damageProtection ?? null
        // A recorded protection keeps its row even if the listing's setup has
        // changed since: it still has claims, a card or a fee behind it.
        if (!inScope(reservation, policy) && !(protection && policy))
          return null
        if (!policy)
          return null
        return {
          reservation,
          policy,
          protection,
          bucket: resolveBucket(protection ?? undefined, reservation),
          chargeable: protection ? chargeableTotal(protection) : 0,
          remaining: protection ? remainingCover(protection) : 0,
          waiverPaid: protection ? waiverPotTotal(protection) : 0,
        }
      })
      .filter((row): row is ProtectionRow => row !== null),
  )

  function inBucket(bucket: ProtectionBucket) {
    return computed(() => rows.value.filter(row => row.bucket === bucket))
  }

  const awaitingChoice = inBucket('awaiting_choice')
  const onFile = inBucket('on_file')
  const decisionDue = inBucket('decision_due')
  const decisionOverdue = inBucket('decision_overdue')
  const failed = inBucket('failed')
  const refundDue = inBucket('refund_due')
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

  /** The most the cards on file could still be charged. Not money held: nothing is. */
  const coverOnFileTotals = computed(() => totalsByCurrency(
    rows.value.filter(row => row.protection?.state === 'card_on_file'),
    row => row.remaining,
  ))
  /** What the open decisions would charge if every claim were charged now. */
  const chargeableTotals = computed(() => totalsByCurrency(
    [...decisionDue.value, ...decisionOverdue.value, ...failed.value],
    row => row.chargeable,
  ))

  /**
   * Fees collected against claims paid, per currency, as TWO figures. The only
   * place the operator can see whether the waiver is priced right. Netting them
   * into one number would hide exactly the signal this exists to give.
   */
  const waiverPotTotals = computed(() => {
    const waivers = rows.value.filter(row => row.protection?.option === 'waiver')
    return {
      // Only guests pay into it; a host-paid cover's amount is 0.
      collected: totalsByCurrency(waivers, row => row.protection?.amount ?? 0),
      paidOut: totalsByCurrency(waivers, row => row.waiverPaid),
    }
  })

  /**
   * What Elev8 charges the tenant for covered stays, per currency: the frozen
   * Tern per-stay fee on every live or used waiver, guest-paid and host-paid
   * alike. A cancelled cover is not billed. Its own figure, never netted
   * against what guests paid.
   */
  const elev8FeeTotals = computed(() => {
    const billed = rows.value.filter(row =>
      row.protection?.option === 'waiver' && row.protection.state === 'waiver_active')
    return {
      guestPaid: totalsByCurrency(billed.filter(row => row.protection?.paidBy !== 'host'), row => row.protection?.elev8Fee ?? 0),
      hostPaid: totalsByCurrency(billed.filter(row => row.protection?.paidBy === 'host'), row => row.protection?.elev8Fee ?? 0),
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
    // A host-paid listing asks the guest nothing, so it needs no choice screen.
    const assigned = new Set(assignments.value
      .map(a => a.listingId)
      .filter(listingId => payerFor(listingId) !== 'host'))
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

      const context = {
        reservation_id: reservation.id,
        listing_id: reservation.listingId,
        guest_name: reservation.guestName,
        currency: protection.currency,
        charge_amount: row.chargeable,
      }
      if (row.bucket === 'decision_due' && !hasLiveAlert(reservation.id, 'DEPOSIT_DECISION_DUE'))
        createProtectionAlert('DEPOSIT_DECISION_DUE', context)
      if (row.bucket === 'decision_overdue' && !hasLiveAlert(reservation.id, 'DEPOSIT_DECISION_OVERDUE'))
        createProtectionAlert('DEPOSIT_DECISION_OVERDUE', context)
    }
  }

  return {
    actor,
    canViewProtection,
    canEditProtection,
    policies,
    assignments,
    payers,
    waiverServiceActive,
    pausedUntilActivation,
    hydrate,
    // reads
    policyFor,
    payerFor,
    listingMode,
    payoutAccountFor,
    railForListing,
    protectionFor,
    isOfferedFor,
    optionsFor,
    bucketFor,
    settleRefusalFor,
    listingsMissingGuideSection,
    // policy CRUD
    savePolicy,
    turnsWaiverOn,
    deletePolicy,
    assignBand,
    removeBand,
    setListingSlot,
    setListingMode,
    syncHostCover,
    setSlotsForListings,
    resetListingBands,
    // writers
    saveCard,
    savingCard,
    recordChoice,
    recordClaim,
    removeClaim,
    patchClaim,
    notifyGuestOfClaim,
    settleDeposit,
    retryCharge,
    isCharging,
    cancelProtection,
    undoSettlement,
    reassessOnExtension,
    // worklist
    rows,
    awaitingChoice,
    onFile,
    decisionDue,
    decisionOverdue,
    failed,
    refundDue,
    settled,
    coverOnFileTotals,
    chargeableTotals,
    waiverPotTotals,
    elev8FeeTotals,
    markAsRead,
    emitProtectionAlerts,
  }
}
