import type { Listing } from '~/components/listings/data/listings'
import type { DamageProtectionPolicy, ListingSlots } from '~/components/reservations/data/damage-protection'
import type { ListingProtectionMode, useDamageProtection } from '~/composables/useDamageProtection'
import { formatProtectionAmount, listingSlots, LONG_STAY_THRESHOLD_NIGHTS, waiverCover } from '~/components/reservations/data/damage-protection'
import { recommendedTier, ternProduct, tierTooSmall } from '~/components/reservations/data/tern-products'

/**
 * What one listing's damage protection looks like, and the plain sentences
 * that describe it. Shared by the settings page's Listings tab and the
 * listing detail page's Protection tab, so the two can never disagree on a flag
 * or a refusal.
 */

type DamageProtectionApi = ReturnType<typeof useDamageProtection>

export const PROTECTION_MODES: ListingProtectionMode[] = ['off', 'guest_paid', 'host_paid']

export const PROTECTION_MODE_LABELS: Record<ListingProtectionMode, string> = {
  off: 'No protection',
  guest_paid: 'Guest pays',
  host_paid: 'Host pays',
}

export interface ListingProtectionView {
  slots: ListingSlots
  mode: ListingProtectionMode
  /** The listing's payout currency, or null without a payout account. */
  currency: string | null
  /** The policies assigned to it, short stays first, each once. */
  policies: DamageProtectionPolicy[]
  /** A deposit policy on a non-Stripe listing: guests here get the waiver only. */
  waiverOnly: boolean
  /** Its policies carry the waiver, and the waiver is not activated yet. */
  paused: boolean
  /** Guest-paid with a policy, but no Damage protection section in its guest guide. */
  noChoiceScreen: boolean
  /** A sentence when a waiver tier is smaller than the property calls for. */
  undersized: string | null
}

export function listingProtectionView(
  dp: DamageProtectionApi,
  listing: Pick<Listing, 'id' | 'capacity'>,
  missingGuide: Set<string>,
): ListingProtectionView {
  const slots = listingSlots(dp.assignments.value, listing.id)
  const mode = dp.listingMode(listing.id)
  // A custom setup has no short/long slots, so read its bands directly.
  const policyIds = [...new Set(dp.assignments.value
    .filter(a => a.listingId === listing.id)
    .sort((a, b) => a.minNights - b.minNights)
    .map(a => a.policyId))]
  const policies = policyIds
    .map(id => dp.policies.value.find(p => p.id === id))
    .filter((p): p is DamageProtectionPolicy => Boolean(p))
  const offersDeposit = policies.some(p => p.offers.includes('deposit'))
  // Sized to the property: a tier smaller than its guest count calls for is flagged.
  const undersized = policies
    .filter(p => p.offers.includes('waiver'))
    .filter(p => tierTooSmall(p.waiver.tier, listing.capacity))
  return {
    slots,
    mode,
    currency: dp.payoutAccountFor(listing.id)?.currency ?? null,
    policies,
    // The host pays for the waiver, so there is no deposit to lose here.
    waiverOnly: mode === 'guest_paid' && offersDeposit && dp.railForListing(listing.id) !== 'card',
    paused: policies.some(p => dp.pausedUntilActivation(p)),
    noChoiceScreen: mode === 'guest_paid' && policies.length > 0 && missingGuide.has(listing.id),
    undersized: undersized.length
      ? `${ternProduct(undersized[0]!.waiver.tier).name} cover is sized for smaller properties. This one sleeps ${listing.capacity}: ${ternProduct(recommendedTier(listing.capacity)).name} is recommended.`
      : null,
  }
}

export interface PolicyUsage {
  short: number
  long: number
  /** Listings using it, however many bands each. */
  total: number
  /** Used, and only on host-paid listings: the guest price is never charged. */
  hostOnly: boolean
}

export function policyUsage(dp: DamageProtectionApi, policyId: string): PolicyUsage {
  const bands = dp.assignments.value.filter(a => a.policyId === policyId)
  const listingIds = new Set(bands.map(a => a.listingId))
  return {
    short: bands.filter(a => a.minNights < LONG_STAY_THRESHOLD_NIGHTS).length,
    long: bands.filter(a => a.minNights >= LONG_STAY_THRESHOLD_NIGHTS).length,
    total: listingIds.size,
    hostOnly: listingIds.size > 0 && [...listingIds].every(id => dp.payerFor(id) === 'host'),
  }
}

export function waiverSummary(policy: DamageProtectionPolicy): string {
  const cover = waiverCover(policy)
  const tier = ternProduct(policy.waiver.tier).name
  if (!cover)
    return `Tern ${tier}, not available in ${policy.currency} yet`
  return `Tern ${tier}, covers up to ${formatProtectionAmount(cover.coverageCap, policy.currency)}. `
    + `Guest pays ${formatProtectionAmount(policy.waiver.guestPrice, policy.currency)}, `
    + `Elev8 charges you ${formatProtectionAmount(cover.perStayFee, policy.currency)} per stay`
}

export function depositSummary(policy: DamageProtectionPolicy): string {
  const { pricing, rate, settleWithinDays } = policy.deposit
  const limit = pricing === 'percent_of_subtotal' ? `${rate}% of the stay` : formatProtectionAmount(rate, policy.currency)
  return `Card on file, charged up to ${limit} only for damage, decided within ${settleWithinDays} days`
}

/** A policy in another currency cannot be used where the listing is paid out: no conversion, ever. */
export function currencyBlocked(policy: DamageProtectionPolicy, currency: string | null): boolean {
  return currency !== null && policy.currency !== currency
}

/** Where the host pays, a deposit-only policy has nothing for them to pay for. */
export function hostBlocked(policy: DamageProtectionPolicy, mode: ListingProtectionMode): boolean {
  return mode === 'host_paid' && !policy.offers.includes('waiver')
}

/**
 * Where the refusal is read changes where it points: the settings page has the
 * Policies tab and the activation card on it, a listing's page does not.
 */
export type RefusalContext = 'settings' | 'listing'

const REFUSALS: Record<string, Record<RefusalContext, string>> = {
  currency_mismatch: {
    settings: 'That policy is in another currency than this listing\'s payouts.',
    listing: 'That policy is in another currency than this listing\'s payouts.',
  },
  host_needs_waiver: {
    settings: 'Where you pay for the cover, the policy needs the waiver. A deposit-only policy has nothing for you to pay for.',
    listing: 'Where you pay for the cover, the policy needs the waiver. A deposit-only policy has nothing for you to pay for.',
  },
  no_policy_in_currency: {
    settings: 'There is no policy in this listing\'s payout currency yet. Create one from a template in the Policies tab.',
    listing: 'There is no policy in this listing\'s payout currency yet. Create one from a template in Settings, Damage protection.',
  },
  waiver_not_activated: {
    settings: 'Activate the damage waiver first, at the top of this page: host-paid cover is Tern\'s.',
    listing: 'Activate the damage waiver first, in Settings, Damage protection: host-paid cover is Tern\'s.',
  },
}

export function protectionRefusalText(reason: string, context: RefusalContext): string {
  return REFUSALS[reason]?.[context] ?? `Could not set the policy (${reason.replace(/_/g, ' ')})`
}
