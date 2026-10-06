/**
 * The Tern cover products behind the damage waiver. Elev8 sets these with Tern
 * once for every tenant, the same way `elev8CoverPartner` is set: a tenant
 * picks a tier and never writes a coverage amount or an exclusion.
 *
 * ⚠️ Placeholder figures until Tern hands over its price list. Change them here
 * and nowhere else: every policy, the guest's option card, the frozen
 * protection on a booking and the Elev8 fee all read them from this file.
 *
 * ⚠️ Priced per currency, never converted. A tier with no price list in a
 * currency cannot back a waiver in that currency (`ternPriceFor` answers null
 * and a waiver in that currency covers nothing), rather than inventing an exchange rate.
 */
export type TernBaseTier = 'bronze' | 'silver' | 'gold'
/**
 * Each size has a "+" tier (owner's decision, 2026-10-06): the same property
 * size, a higher cover, a higher Elev8 fee.
 */
export type TernTier = TernBaseTier | 'bronze_plus' | 'silver_plus' | 'gold_plus'

/** Smallest to largest, each base tier followed by its "+". */
export const TERN_TIERS: TernTier[] = ['bronze', 'bronze_plus', 'silver', 'silver_plus', 'gold', 'gold_plus']

export interface TernPrice {
  /** The most Tern covers on one stay, whatever its length: the cap never multiplies. */
  coverageCap: number
  /** What Elev8 charges the tenant for one package, i.e. up to `COVER_PACKAGE_NIGHTS` of a covered stay. */
  perStayFee: number
}

/**
 * One cover package lasts this many nights (owner's decision, 2026-09-29). A
 * longer stay takes one package per started block: the Elev8 fee AND the guest
 * price multiply, the cover cap does not.
 */
export const COVER_PACKAGE_NIGHTS = 30

/** 1 to 30 nights is one package, 31 to 60 two, and so on. Never below one. */
export function coverPackagesFor(nights: number): number {
  return Math.max(1, Math.ceil(nights / COVER_PACKAGE_NIGHTS))
}

export interface TernProduct {
  tier: TernTier
  /** The size the tier is for: a "+" tier shares its base tier's size and only raises the cover. */
  baseTier: TernBaseTier
  name: string
  /** The property size the tier is sized for, in guests (`Listing.capacity`). */
  minGuests: number
  maxGuests: number | null
  prices: Partial<Record<string, TernPrice>>
  /** Tern's own exclusions. The guest reads them on the waiver card. */
  exclusions: string[]
}

const TERN_EXCLUSIONS = [
  'Intentional or malicious damage',
  'Damage caused by pets',
  'Smoking inside the property',
  'Missing or removed items',
  'Normal wear and tear, including mattresses, linens, paint and filters',
]

export const TERN_PRODUCTS: TernProduct[] = [
  {
    tier: 'bronze',
    baseTier: 'bronze',
    name: 'Bronze',
    minGuests: 1,
    maxGuests: 4,
    prices: { USD: { coverageCap: 2000, perStayFee: 9 } },
    exclusions: TERN_EXCLUSIONS,
  },
  {
    tier: 'bronze_plus',
    baseTier: 'bronze',
    name: 'Bronze+',
    minGuests: 1,
    maxGuests: 4,
    prices: { USD: { coverageCap: 4000, perStayFee: 14 } },
    exclusions: TERN_EXCLUSIONS,
  },
  {
    tier: 'silver',
    baseTier: 'silver',
    name: 'Silver',
    minGuests: 5,
    maxGuests: 8,
    prices: { USD: { coverageCap: 5000, perStayFee: 15 } },
    exclusions: TERN_EXCLUSIONS,
  },
  {
    tier: 'silver_plus',
    baseTier: 'silver',
    name: 'Silver+',
    minGuests: 5,
    maxGuests: 8,
    prices: { USD: { coverageCap: 10000, perStayFee: 24 } },
    exclusions: TERN_EXCLUSIONS,
  },
  {
    tier: 'gold',
    baseTier: 'gold',
    name: 'Gold',
    minGuests: 9,
    maxGuests: null,
    prices: { USD: { coverageCap: 10000, perStayFee: 25 } },
    exclusions: TERN_EXCLUSIONS,
  },
  {
    tier: 'gold_plus',
    baseTier: 'gold',
    name: 'Gold+',
    minGuests: 9,
    maxGuests: null,
    prices: { USD: { coverageCap: 20000, perStayFee: 39 } },
    exclusions: TERN_EXCLUSIONS,
  },
]

export function ternProduct(tier: TernTier): TernProduct {
  return TERN_PRODUCTS.find(p => p.tier === tier) ?? TERN_PRODUCTS[0]!
}

/** The tier's cover and fee in one currency, or null when Tern does not price it there. */
export function ternPriceFor(tier: TernTier, currency: string): TernPrice | null {
  return ternProduct(tier).prices[currency] ?? null
}

/** The tier sized for a property that sleeps `guests`. */
export function recommendedTier(guests: number): TernBaseTier {
  // Base tiers only: a "+" tier is never what a size calls for, only a choice for more cover.
  const fit = TERN_PRODUCTS.find(p => p.tier === p.baseTier
    && guests >= p.minGuests && (p.maxGuests === null || guests <= p.maxGuests))
  return fit?.baseTier ?? 'gold'
}

/** "Up to 4 guests" / "5 to 8 guests" / "9 guests and more" */
export function ternSizeLabel(product: TernProduct): string {
  if (product.maxGuests === null)
    return `${product.minGuests} guests and more`
  if (product.minGuests <= 1)
    return `Up to ${product.maxGuests} guests`
  return `${product.minGuests} to ${product.maxGuests} guests`
}

/**
 * Whether a tier is smaller than the one the property is sized for. A bigger
 * tier is never flagged: more cover than needed is the tenant's call, less
 * cover than the property calls for is the risk worth saying out loud.
 */
export function tierTooSmall(tier: TernTier, guests: number): boolean {
  // Compared by SIZE: Bronze+ is still sized for 4 guests, whatever its cover.
  const sizes: TernBaseTier[] = ['bronze', 'silver', 'gold']
  return sizes.indexOf(ternProduct(tier).baseTier) < sizes.indexOf(recommendedTier(guests))
}
