import type { BookingChannel } from '~/components/listings/data/listings'
import type { DamageProtectionPolicy, ProtectionCurrency } from '~/components/reservations/data/damage-protection'
import type { TernTier } from '~/components/reservations/data/tern-products'
import type { UpsellService } from '~/components/upsells/data/upsell-services'
import { DEPOSIT_TERMS, WAIVER_TERMS } from '~/components/reservations/data/damage-protection'
import { isProtectionService } from '~/components/upsells/data/upsell-services'

/**
 * Damage protection is set PER LISTING (owner's decision, 2026-10-06). There
 * are no shared policies any more and no settings page:
 *
 * - A Damage Protection upsell sells ONE package: an Elev8 Cover tier and what
 *   the guest pays for it (its single item). Bronze and Silver are two upsells.
 * - The damage waiver is on for a listing assigned to an active protection
 *   upsell, and that upsell IS its package. A listing sits in one at most:
 *   choosing another package moves it (`moveListingUpdates`).
 * - A deposit on its own needs no upsell: switching it on protects the listing.
 * - The listing's Protection tab switches the waiver and the deposit on or off
 *   and sets the deposit's card limit. With both on, the guest chooses.
 *
 * The rest of the module still runs on `DamageProtectionPolicy`: `listingPolicy`
 * builds one per listing from its setup and package, so the guest options, the
 * frozen protection, host cover and billing are unchanged.
 */

export interface ListingProtectionSetup {
  listingId: string
  /** Offer the damage waiver (it runs only while a protection upsell assigns the listing). */
  waiver: boolean
  /** Offer the deposit (a card kept on file). Stripe listings only. */
  deposit: boolean
  /** The most the saved card may be charged. */
  depositLimit: number
  /** Days after check-out by which the deposit is charged or closed. */
  settleWithinDays: number
  /**
   * Where a deposit ON ITS OWN is asked. Absent means Direct only (every setup
   * written before this field). ⚠️ Ignored while the waiver is on: the waiver
   * covers every channel, and the deposit rides along beside it.
   */
  depositChannels?: BookingChannel[]
  /**
   * Guest-paid listings only: when the guest has not bought the waiver (nor
   * left a deposit card) by `hostFallbackDays` before check-in, the host covers
   * the stay and Elev8 charges the host the cover fee. Absent means off.
   */
  hostFallback?: boolean
  /** Days before check-in at which the host cover kicks in. Absent means 1. */
  hostFallbackDays?: number
  updatedAt: string
}

export const DEFAULT_HOST_FALLBACK_DAYS = 1
export const HOST_FALLBACK_DAY_OPTIONS = [1, 2, 3, 5, 7, 14]

/**
 * Whether a guest stay with no choice yet is due its automatic host cover on
 * `today`: the setting is on and the cut-off (N days before check-in) has come.
 * Day strings are local `YYYY-MM-DD`.
 */
export function hostFallbackDue(
  setup: Pick<ListingProtectionSetup, 'hostFallback' | 'hostFallbackDays'>,
  checkIn: string,
  today: Date,
): boolean {
  if (!setup.hostFallback)
    return false
  const cutoff = new Date(`${checkIn}T00:00:00`)
  cutoff.setDate(cutoff.getDate() - (setup.hostFallbackDays ?? DEFAULT_HOST_FALLBACK_DAYS))
  const day = new Date(today)
  day.setHours(0, 0, 0, 0)
  return day.getTime() >= cutoff.getTime()
}

export const DEFAULT_DEPOSIT_LIMIT = 500
export const DEFAULT_SETTLE_DAYS = 7
/** A deposit on its own asks direct guests first; an OTA guest is asked only where the host says so. */
export const DEFAULT_DEPOSIT_CHANNELS: BookingChannel[] = ['Direct']

/** The channels a deposit on its own is asked on. */
export function depositChannelsOf(setup: Pick<ListingProtectionSetup, 'depositChannels'>): BookingChannel[] {
  return setup.depositChannels ?? DEFAULT_DEPOSIT_CHANNELS
}
/** Fixed so a derived policy is stable across reads (it is provenance on a frozen protection). */
const DEFAULT_SETUP_STAMP = '2026-09-01T00:00:00.000Z'

/** What a listing starts with: the waiver (once an upsell assigns it), no deposit. */
export function defaultListingSetup(listingId: string): ListingProtectionSetup {
  return {
    listingId,
    waiver: true,
    deposit: false,
    depositLimit: DEFAULT_DEPOSIT_LIMIT,
    settleWithinDays: DEFAULT_SETTLE_DAYS,
    depositChannels: [...DEFAULT_DEPOSIT_CHANNELS],
    updatedAt: DEFAULT_SETUP_STAMP,
  }
}

export interface ProtectionPackage {
  serviceId: string
  serviceName: string
  itemId: string
  name: string
  tier: TernTier
  /** What the guest pays per package (30 nights). */
  guestPrice: number
  currency: string
}

/** The one package a protection upsell sells, or null when its item has no cover tier yet. */
export function packageOf(service: UpsellService): ProtectionPackage | null {
  const item = service.items.find(i => i.coverTier)
  if (!item)
    return null
  return {
    serviceId: service.id,
    serviceName: service.name,
    itemId: item.id,
    name: item.name,
    tier: item.coverTier!,
    guestPrice: item.price,
    currency: service.currency,
  }
}

/** Every package on offer: one per active protection upsell. What a listing picks from. */
export function protectionPackageOptions(services: UpsellService[]): ProtectionPackage[] {
  return services
    .filter(s => isProtectionService(s) && s.status === 'active')
    .map(packageOf)
    .filter((p): p is ProtectionPackage => p !== null)
}

/** Upsells store listings by name; an id is accepted too, so either spelling links. */
function assignsListing(service: Pick<UpsellService, 'assignedListings'>, listing: { id: string, name: string }): boolean {
  return service.assignedListings.includes(listing.name) || service.assignedListings.includes(listing.id)
}

/** The active protection upsells assigning this listing. One at most, unless set up by hand twice. */
export function protectionServicesFor(
  services: UpsellService[],
  listing: { id: string, name: string },
): UpsellService[] {
  return services.filter(s => isProtectionService(s) && s.status === 'active' && assignsListing(s, listing))
}

/** The listing's package: the one its protection upsell sells. The first wins if it is in two. */
export function listingPackage(
  services: UpsellService[],
  listing: { id: string, name: string },
): ProtectionPackage | null {
  for (const service of protectionServicesFor(services, listing)) {
    const pkg = packageOf(service)
    if (pkg)
      return pkg
  }
  return null
}

/**
 * The `assignedListings` writes that put a listing in ONE protection upsell
 * (`targetId`), taking it out of every other, or out of all of them when
 * `targetId` is null. Only services that change are returned. Inactive ones
 * are cleaned too, so switching one back on cannot put the listing in two.
 */
export function moveListingUpdates(
  services: UpsellService[],
  listing: { id: string, name: string },
  targetId: string | null,
): { id: string, assignedListings: string[], status?: 'active' }[] {
  return services.filter(isProtectionService).flatMap((service) => {
    const has = assignsListing(service, listing)
    if (service.id === targetId)
      return has ? [] : [{ id: service.id, assignedListings: [...service.assignedListings, listing.name], status: 'active' as const }]
    return has
      ? [{ id: service.id, assignedListings: service.assignedListings.filter(n => n !== listing.name && n !== listing.id) }]
      : []
  })
}

const PROTECTION_CURRENCIES: ProtectionCurrency[] = ['USD', 'IDR', 'EUR', 'CHF']

/** The terms the guest accepts, in the words of the options they are offered. */
export function setupTermsText(setup: Pick<ListingProtectionSetup, 'waiver' | 'deposit'>): string {
  return [setup.waiver ? WAIVER_TERMS : null, setup.deposit ? DEPOSIT_TERMS : null]
    .filter(Boolean)
    .join(' ')
}

export function listingPolicyId(listingId: string): string {
  return `lp-${listingId}`
}

export type ListingPolicyBlock
  = | 'no_service'
    | 'no_package'
    | 'nothing_offered'
    | 'no_deposit_channel'
    | 'no_payout_currency'
    | 'currency_mismatch'

/**
 * The listing's policy, or why there is none.
 *
 * - The WAIVER needs a Damage Protection upsell assigning the listing: its
 *   package is what the guest buys. Without one the waiver switch does nothing.
 * - The DEPOSIT needs no upsell (2026-10-06): a listing can take a deposit only,
 *   charged in its own payout currency. So a deposit switched on makes the
 *   listing protected even when no upsell assigns it.
 *
 * ⚠️ No currency conversion, ever: a waiver package priced in another currency
 * than the listing's payouts builds no policy (`currency_mismatch`).
 */
export function listingPolicy(
  setup: ListingProtectionSetup,
  services: UpsellService[],
  listing: { id: string, name: string },
  payoutCurrency: string | null,
): { policy: DamageProtectionPolicy, pkg: ProtectionPackage | null } | { policy: null, block: ListingPolicyBlock } {
  const hasService = protectionServicesFor(services, listing).length > 0
  const waiverOn = setup.waiver && hasService
  if (!waiverOn && !setup.deposit)
    return { policy: null, block: hasService ? 'nothing_offered' : 'no_service' }

  const pkg = hasService ? listingPackage(services, listing) : null
  if (waiverOn && !pkg)
    return { policy: null, block: 'no_package' }
  if (!waiverOn && depositChannelsOf(setup).length === 0)
    return { policy: null, block: 'no_deposit_channel' }

  // The waiver is priced in its package's currency; a deposit on its own is charged in the payouts'.
  const currency = waiverOn ? pkg!.currency : payoutCurrency
  if (!currency)
    return { policy: null, block: 'no_payout_currency' }
  if ((payoutCurrency && currency !== payoutCurrency) || !PROTECTION_CURRENCIES.includes(currency as ProtectionCurrency))
    return { policy: null, block: 'currency_mismatch' }

  const offered = { waiver: waiverOn, deposit: setup.deposit }
  const offers = [waiverOn ? 'waiver' : null, setup.deposit ? 'deposit' : null]
    .filter((o): o is 'waiver' | 'deposit' => o !== null)
  return {
    pkg: waiverOn ? pkg : null,
    policy: {
      id: listingPolicyId(listing.id),
      name: waiverOn ? pkg!.serviceName : 'Deposit',
      currency: currency as ProtectionCurrency,
      offers,
      // Unused without the waiver; kept whole so the policy shape never changes.
      waiver: { tier: pkg?.tier ?? 'bronze', guestPrice: waiverOn ? pkg!.guestPrice : 0 },
      deposit: { pricing: 'flat', rate: setup.depositLimit, settleWithinDays: setup.settleWithinDays },
      // A waiver covers every channel; a deposit on its own is asked on the channels the listing picked.
      channelPolicy: waiverOn ? {} : Object.fromEntries(depositChannelsOf(setup).map(c => [c, 'offer' as const])),
      termsVersion: 'v1',
      termsText: setupTermsText(offered),
      createdAt: setup.updatedAt,
      updatedAt: setup.updatedAt,
    },
  }
}
