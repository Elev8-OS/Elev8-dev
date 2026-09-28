import type { Booking, ListingStats } from '~/components/listings/data/listings'
import { policyTemplate } from '~/components/reservations/data/damage-protection'
import { recommendedTier, ternPriceFor, ternProduct } from '~/components/reservations/data/tern-products'

/**
 * The numbers behind the VACATERN pitch for one listing: the tier sized for
 * it, what the waiver could earn per stay, and roughly how many stays a year
 * that applies to. Framework-free. Every figure comes from `tern-products.ts`
 * and the listing itself; the yearly figure is an estimate and the pitch says
 * what it assumed.
 */

/** A listing with no finished stays to average is assumed to take stays this long. */
export const DEFAULT_STAY_NIGHTS = 4

export interface TernPitch {
  tierName: string
  currency: string
  coverageCap: number
  perStayFee: number
  /** Where the guest price starts: the listing's own waiver price, else the standard template's. */
  suggestedGuestPrice: number
  occupancyPct: number
  avgNights: number
  staysPerYear: number
}

/** Mean nights of the listing's real stays: blocks, cancellations and inquiries do not count. */
export function averageStayNights(bookings: Pick<Booking, 'type' | 'status' | 'nights'>[]): number {
  const stays = bookings.filter(b => b.type !== 'block' && b.status !== 'cancelled' && b.status !== 'inquiry' && b.nights > 0)
  if (!stays.length)
    return DEFAULT_STAY_NIGHTS
  return stays.reduce((sum, b) => sum + b.nights, 0) / stays.length
}

/** Booked nights in a year divided by the average stay, whole stays only. */
export function estimatedStaysPerYear(occupancyPct: number, avgNights: number): number {
  if (occupancyPct <= 0 || avgNights <= 0)
    return 0
  return Math.round((365 * Math.min(occupancyPct, 100) / 100) / avgNights)
}

/** What is left of the guest's price once Elev8's fee is paid. Negative means the host pays the difference. */
export function marginPerStay(guestPrice: number, perStayFee: number): number {
  return Math.round((guestPrice - perStayFee) * 100) / 100
}

/**
 * The pitch for a listing, or null where Tern has no price in its currency:
 * nothing is converted, so there is nothing honest to quote.
 */
export function ternPitchFor(
  listing: { capacity: number, stats: Pick<ListingStats, 'occupancyRate'>, bookings: Pick<Booking, 'type' | 'status' | 'nights'>[] },
  currency: string,
  ownGuestPrice?: number | null,
): TernPitch | null {
  const tier = recommendedTier(listing.capacity)
  const price = ternPriceFor(tier, currency)
  if (!price)
    return null
  const templatePrice = policyTemplate('standard_short').guestPrice[currency as keyof ReturnType<typeof policyTemplate>['guestPrice']]
  const avgNights = averageStayNights(listing.bookings)
  return {
    tierName: ternProduct(tier).name,
    currency,
    coverageCap: price.coverageCap,
    perStayFee: price.perStayFee,
    suggestedGuestPrice: ownGuestPrice ?? templatePrice ?? price.perStayFee,
    occupancyPct: listing.stats.occupancyRate,
    avgNights,
    staysPerYear: estimatedStaysPerYear(listing.stats.occupancyRate, avgNights),
  }
}
