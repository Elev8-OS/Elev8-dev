import type { ListingPolicyBlock, ProtectionPackage } from '~/components/damage-protection/data/listing-protection-setup'
import type { DamageProtectionPolicy } from '~/components/reservations/data/damage-protection'
import type { ListingProtectionMode } from '~/composables/useDamageProtection'
import { formatProtectionAmount, waiverCover } from '~/components/reservations/data/damage-protection'
import { recommendedTier, ternPriceFor, ternProduct, tierTooSmall } from '~/components/reservations/data/tern-products'

/**
 * The plain sentences damage protection is described in. Read by Settings,
 * Damage protection, so a flag or a refusal is worded once.
 */

export const PROTECTION_MODE_LABELS: Record<ListingProtectionMode, string> = {
  off: 'No protection',
  guest_paid: 'Guest pays',
  host_paid: 'Host pays',
}

export function waiverSummary(policy: DamageProtectionPolicy): string {
  const cover = waiverCover(policy)
  const tier = ternProduct(policy.waiver.tier).name
  if (!cover)
    return `Elev8 Cover ${tier}, not available in ${policy.currency} yet`
  return `Elev8 Cover ${tier}, covers up to ${formatProtectionAmount(cover.coverageCap, policy.currency)}. `
    + `Guest pays ${formatProtectionAmount(policy.waiver.guestPrice, policy.currency)}, `
    + `Elev8 charges you ${formatProtectionAmount(cover.perStayFee, policy.currency)}, per 30 nights of a stay`
}

export function depositSummary(policy: DamageProtectionPolicy): string {
  const { pricing, rate, settleWithinDays } = policy.deposit
  const limit = pricing === 'percent_of_subtotal' ? `${rate}% of the stay` : formatProtectionAmount(rate, policy.currency)
  return `Card on file, charged up to ${limit} only for damage, decided within ${settleWithinDays} days`
}

/** One line per package in the picker: what the guest pays and what it covers. */
export function packageSummary(pkg: ProtectionPackage): string {
  const price = ternPriceFor(pkg.tier, pkg.currency)
  const cover = price ? `covers up to ${formatProtectionAmount(price.coverageCap, pkg.currency)}` : `not available in ${pkg.currency} yet`
  return `Elev8 Cover ${ternProduct(pkg.tier).name}, guest pays ${formatProtectionAmount(pkg.guestPrice, pkg.currency)}, ${cover}`
}

/** A sentence when the package's tier is smaller than the property calls for. A bigger one is never flagged. */
export function undersizedText(pkg: ProtectionPackage | null, capacity: number): string | null {
  if (!pkg || !tierTooSmall(pkg.tier, capacity))
    return null
  return `${ternProduct(pkg.tier).name} cover is sized for smaller properties. This one sleeps ${capacity}: `
    + `${ternProduct(recommendedTier(capacity)).name} is recommended.`
}

/** Why a listing protects nothing under the tenant's settings. */
export function blockText(block: ListingPolicyBlock, pkg: { currency: string } | null, payoutCurrency: string | null): string {
  switch (block) {
    case 'no_package':
      return 'No package is chosen for the damage waiver, or it was paused or deleted.'
    case 'nothing_offered':
      return 'Turn on the damage waiver, the deposit, or both: guests are offered nothing right now.'
    case 'no_payout_currency':
      return 'No payout account, so there is no currency to take a deposit in.'
    case 'no_deposit_channel':
      return 'Pick at least one booking channel for the deposit: no guest is asked right now.'
    case 'currency_mismatch':
      return `The package is priced in ${pkg?.currency ?? 'another currency'}, but this listing is paid out in ${payoutCurrency ?? 'another currency'}. Nothing is converted, so it is not covered.`
  }
}

const REFUSALS: Record<string, string> = {
  host_needs_waiver: 'Where you pay for the cover, the damage waiver must stay on. A deposit has nothing for you to pay for.',
  waiver_not_activated: 'Activate the damage waiver first: host-paid cover needs Elev8 Cover.',
  package_missing: 'Choose a package for the damage waiver first.',
  deposit_limit_missing: 'Set the most the guest\'s card may be charged.',
  settle_days_missing: 'Set how many days after check-out you decide on the deposit.',
}

export function protectionRefusalText(reason: string): string {
  return REFUSALS[reason] ?? `Could not change the protection (${reason.replace(/_/g, ' ')})`
}
