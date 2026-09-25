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
 * and `policyErrors` refuses the save), rather than inventing an exchange rate.
 */
export type TernTier = 'bronze' | 'silver' | 'gold'

export const TERN_TIERS: TernTier[] = ['bronze', 'silver', 'gold']

export interface TernPrice {
  /** The most Tern covers on one stay. */
  coverageCap: number
  /** What Elev8 charges the tenant for one covered stay. Fixed, whatever the stay length. */
  perStayFee: number
}

export interface TernProduct {
  tier: TernTier
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
    name: 'Bronze',
    minGuests: 1,
    maxGuests: 4,
    prices: { USD: { coverageCap: 2000, perStayFee: 9 } },
    exclusions: TERN_EXCLUSIONS,
  },
  {
    tier: 'silver',
    name: 'Silver',
    minGuests: 5,
    maxGuests: 8,
    prices: { USD: { coverageCap: 5000, perStayFee: 15 } },
    exclusions: TERN_EXCLUSIONS,
  },
  {
    tier: 'gold',
    name: 'Gold',
    minGuests: 9,
    maxGuests: null,
    prices: { USD: { coverageCap: 10000, perStayFee: 25 } },
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
export function recommendedTier(guests: number): TernTier {
  const fit = TERN_PRODUCTS.find(p =>
    guests >= p.minGuests && (p.maxGuests === null || guests <= p.maxGuests))
  return fit?.tier ?? 'gold'
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
  return TERN_TIERS.indexOf(tier) < TERN_TIERS.indexOf(recommendedTier(guests))
}
