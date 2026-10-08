import type { BookingChannel } from '~/components/listings/data/listings'
import type { DamageProtectionPolicy, ProtectionCurrency } from '~/components/reservations/data/damage-protection'
import type { ProtectionPayer } from '~/components/reservations/data/reservations'
import type { TernTier } from '~/components/reservations/data/tern-products'
import type { UpsellService } from '~/components/upsells/data/upsell-services'
import { DEPOSIT_TERMS, WAIVER_TERMS } from '~/components/reservations/data/damage-protection'
import { isProtectionService } from '~/components/upsells/data/upsell-services'

/**
 * Damage protection is set ONCE FOR THE TENANT, in Settings (owner's decision,
 * 2026-10-08). There is no per-listing setup and no Protection tab any more:
 *
 * - A Damage Protection upsell sells ONE package: an Elev8 Cover tier and what
 *   the guest pays for it (its single item). Bronze and Silver are two upsells.
 * - The damage waiver is switched on for EVERY listing at once, with the one
 *   package the tenant picked (`packageServiceId`). There is no listing picker:
 *   an upsell's `assignedListings` means nothing for protection.
 * - ⚠️ The waiver brings the deposit with it: switching the waiver on switches
 *   the deposit on, and it stays on while the waiver is (`applySettingsPatch`).
 *   A deposit on its own (waiver off) needs no package.
 * - Who pays and the host-cover fallback are tenant-wide too.
 *
 * The rest of the module still runs on `DamageProtectionPolicy`: `listingPolicy`
 * builds one per listing from these settings and the package, so the guest
 * options, the frozen protection, host cover and billing are unchanged.
 */

export interface ProtectionSettings {
  /** Offer the damage waiver on every listing (it runs only once a package is picked). */
  waiver: boolean
  /** The Damage Protection upsell whose package every listing offers. */
  packageServiceId: string | null
  /** Offer the deposit (a card kept on file). Stripe listings only. Always on while the waiver is. */
  deposit: boolean
  /** The default most the saved card may be charged, in each listing's own currency. */
  depositLimit: number
  /**
   * A listing's own card limit, in ITS payout currency, where the default does
   * not fit (a bigger villa, a listing paid out in IDR). Absent = the default.
   * Only the amount is per listing; the decision days stay tenant-wide.
   */
  depositOverrides?: Record<string, number>
  /** Days after check-out by which the deposit is charged or closed. */
  settleWithinDays: number
  /**
   * Where a deposit ON ITS OWN is asked. Absent means Direct only. ⚠️ Ignored
   * while the waiver is on: the waiver covers every channel, and the deposit
   * rides along beside it.
   */
  depositChannels?: BookingChannel[]
  /** Who pays for the waiver on every listing. Host-paid needs the waiver on and activated. */
  payer: ProtectionPayer
  /**
   * Guest-paid only: when the guest has not bought the waiver (nor left a
   * deposit card) by `hostFallbackDays` before check-in, the host covers the
   * stay and Elev8 charges the host the cover fee. Absent means off.
   */
  hostFallback?: boolean
  /** Days before check-in at which the host cover kicks in. Absent means 1. */
  hostFallbackDays?: number
  updatedAt: string
}

export type ProtectionSettingsPatch = Partial<Omit<ProtectionSettings, 'updatedAt'>>

export const DEFAULT_HOST_FALLBACK_DAYS = 1
export const HOST_FALLBACK_DAY_OPTIONS = [1, 2, 3, 5, 7, 14]

/**
 * Whether a guest stay with no choice yet is due its automatic host cover on
 * `today`: the setting is on and the cut-off (N days before check-in) has come.
 * Day strings are local `YYYY-MM-DD`.
 */
export function hostFallbackDue(
  setup: Pick<ProtectionSettings, 'hostFallback' | 'hostFallbackDays'>,
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

/** The card limit for one listing: its own amount when it has one, else the tenant default. */
export function depositLimitFor(settings: Pick<ProtectionSettings, 'depositLimit' | 'depositOverrides'>, listingId: string): number {
  return settings.depositOverrides?.[listingId] ?? settings.depositLimit
}

export const DEFAULT_DEPOSIT_LIMIT = 500
export const DEFAULT_SETTLE_DAYS = 7
/** A deposit on its own asks direct guests first; an OTA guest is asked only where the host says so. */
export const DEFAULT_DEPOSIT_CHANNELS: BookingChannel[] = ['Direct']

/** The channels a deposit on its own is asked on. */
export function depositChannelsOf(setup: Pick<ProtectionSettings, 'depositChannels'>): BookingChannel[] {
  return setup.depositChannels ?? DEFAULT_DEPOSIT_CHANNELS
}
/** Fixed so a derived policy is stable across reads (it is provenance on a frozen protection). */
const DEFAULT_SETUP_STAMP = '2026-09-01T00:00:00.000Z'

/** What a tenant starts with: nothing offered until the waiver is activated with a package. */
export function defaultProtectionSettings(): ProtectionSettings {
  return {
    waiver: false,
    packageServiceId: null,
    deposit: false,
    depositLimit: DEFAULT_DEPOSIT_LIMIT,
    settleWithinDays: DEFAULT_SETTLE_DAYS,
    depositChannels: [...DEFAULT_DEPOSIT_CHANNELS],
    payer: 'guest',
    updatedAt: DEFAULT_SETUP_STAMP,
  }
}

/**
 * The settings after a patch, with the one coupling rule applied: the waiver
 * brings the deposit, and the deposit cannot be switched off beside it.
 */
export function applySettingsPatch(current: ProtectionSettings, patch: ProtectionSettingsPatch, now: string): ProtectionSettings {
  const next: ProtectionSettings = { ...current, ...patch, updatedAt: now }
  if (next.waiver)
    next.deposit = true
  return next
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

/** The package every listing offers: the picked upsell's, while it is active and sells one. */
export function selectedPackage(
  services: UpsellService[],
  settings: Pick<ProtectionSettings, 'packageServiceId'>,
): ProtectionPackage | null {
  const service = services.find(s => s.id === settings.packageServiceId)
  if (!service || !isProtectionService(service) || service.status !== 'active')
    return null
  return packageOf(service)
}

const PROTECTION_CURRENCIES: ProtectionCurrency[] = ['USD', 'IDR', 'EUR', 'CHF']

/** The terms the guest accepts, in the words of the options they are offered. */
export function setupTermsText(setup: { waiver: boolean, deposit: boolean }): string {
  return [setup.waiver ? WAIVER_TERMS : null, setup.deposit ? DEPOSIT_TERMS : null]
    .filter(Boolean)
    .join(' ')
}

export function listingPolicyId(listingId: string): string {
  return `lp-${listingId}`
}

export type ListingPolicyBlock
  = | 'no_package'
    | 'nothing_offered'
    | 'no_deposit_channel'
    | 'no_payout_currency'
    | 'currency_mismatch'

/**
 * The listing's policy under the tenant's settings, or why there is none.
 *
 * - The WAIVER needs the tenant's package (`pkg`, from `selectedPackage`):
 *   without one, a waiver switched on builds nothing (`no_package`).
 * - The DEPOSIT needs no package: on its own it is charged in the listing's
 *   payout currency.
 *
 * ⚠️ No currency conversion, ever: a listing paid out in another currency than
 * the package builds no policy (`currency_mismatch`).
 */
export function listingPolicy(
  settings: Pick<ProtectionSettings, 'waiver' | 'deposit' | 'depositLimit' | 'depositOverrides' | 'settleWithinDays' | 'depositChannels' | 'updatedAt'>,
  pkg: ProtectionPackage | null,
  listing: { id: string },
  payoutCurrency: string | null,
): { policy: DamageProtectionPolicy, pkg: ProtectionPackage | null } | { policy: null, block: ListingPolicyBlock } {
  if (settings.waiver && !pkg)
    return { policy: null, block: 'no_package' }
  const waiverOn = settings.waiver && pkg !== null
  if (!waiverOn && !settings.deposit)
    return { policy: null, block: 'nothing_offered' }
  if (!waiverOn && depositChannelsOf(settings).length === 0)
    return { policy: null, block: 'no_deposit_channel' }

  // The waiver is priced in its package's currency; a deposit on its own is charged in the payouts'.
  const currency = waiverOn ? pkg!.currency : payoutCurrency
  if (!currency)
    return { policy: null, block: 'no_payout_currency' }
  if ((payoutCurrency && currency !== payoutCurrency) || !PROTECTION_CURRENCIES.includes(currency as ProtectionCurrency))
    return { policy: null, block: 'currency_mismatch' }

  const offered = { waiver: waiverOn, deposit: settings.deposit }
  const offers = [waiverOn ? 'waiver' : null, settings.deposit ? 'deposit' : null]
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
      deposit: { pricing: 'flat', rate: depositLimitFor(settings, listing.id), settleWithinDays: settings.settleWithinDays },
      // A waiver covers every channel; a deposit on its own is asked on the channels picked.
      channelPolicy: waiverOn ? {} : Object.fromEntries(depositChannelsOf(settings).map(c => [c, 'offer' as const])),
      termsVersion: 'v1',
      termsText: setupTermsText(offered),
      createdAt: settings.updatedAt,
      updatedAt: settings.updatedAt,
    },
  }
}
