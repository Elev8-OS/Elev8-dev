import type {
  BookingChannel,
  CityTaxChargeableGuests,
  CityTaxCollector,
  CityTaxConfig,
  ListingFeeTaxItem,
} from '~/components/listings/data/listings'

/** Adults pay, nobody else does, until a tenant says otherwise. */
export const DEFAULT_CHARGEABLE_GUESTS: CityTaxChargeableGuests = {
  adults: true,
  children: false,
  infants: false,
}

/**
 * An unset channel falls back to 'host'. The whole feature exists so a
 * collection is never missed, so an unconfigured channel must raise an alert
 * rather than go quiet.
 */
export function collectorFor(config: CityTaxConfig | undefined, channel: BookingChannel): CityTaxCollector {
  return config?.channelPolicy?.[channel] ?? 'host'
}

/** Structural, so a draft or a fixture prices without a whole ReservationEntry. */
export interface CityTaxGuestCounts {
  guestCount: number
  guestAdults?: number
  guestChildren?: number
  guestInfants?: number
}

export function chargeableGuestCount(guests: CityTaxGuestCounts, config?: CityTaxConfig): number {
  const rules = config?.chargeableGuests ?? DEFAULT_CHARGEABLE_GUESTS
  const hasBreakdown = guests.guestAdults !== undefined
    || guests.guestChildren !== undefined
    || guests.guestInfants !== undefined

  // Without a breakdown the headcount is all we know. Treating it as adults is
  // the only reading that does not invent an exemption.
  if (!hasBreakdown)
    return rules.adults ? guests.guestCount : 0

  let total = 0
  if (rules.adults)
    total += guests.guestAdults ?? 0
  if (rules.children)
    total += guests.guestChildren ?? 0
  if (rules.infants)
    total += guests.guestInfants ?? 0
  return total
}

export type CityTaxNightRules = Pick<ListingFeeTaxItem, 'skipNights' | 'maxNights'>

/** Skip first, then cap, then clamp. A 2-night stay with skipNights 7 owes zero, never minus five. */
export function chargeableNights(item: CityTaxNightRules, nights: number): number {
  const afterSkip = nights - (item.skipNights ?? 0)
  const capped = item.maxNights == null ? afterSkip : Math.min(afterSkip, item.maxNights)
  return Math.max(0, capped)
}

export type CityTaxDateRules = Pick<ListingFeeTaxItem, 'applicableDateRanges'>

/**
 * Evaluated against check-in, and inclusive at both ends: a season that runs
 * "01 June to 30 September" includes a guest arriving on 30 September.
 */
export function isWithinApplicableRange(item: CityTaxDateRules, checkIn: string): boolean {
  const ranges = item.applicableDateRanges ?? []
  if (ranges.length === 0)
    return true
  return ranges.some(range => checkIn >= range.after && checkIn <= range.before)
}
