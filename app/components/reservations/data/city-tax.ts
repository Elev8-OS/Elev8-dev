import type {
  BookingChannel,
  CityTaxChargeableGuests,
  CityTaxCollector,
  CityTaxConfig,
  ListingFeeTaxItem,
  TaxLogic,
} from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'

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

export interface CityTaxBasisLine {
  taxItemId: string
  taxTitle: string
  authorityName?: string
  /** The tenant's own note, carried through so the desk can read it on the stay. */
  note?: string
  logic: TaxLogic
  rate: number
  chargeableGuests: number
  chargeableNights: number
  rooms: number
  amount: number
  currency: string
}

export function roundCityTaxAmount(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * One priced line, or null when the item is not a city tax or the stay falls
 * outside its season.
 *
 * `skipNights` and `maxNights` describe nights, so they only bite on a logic
 * that multiplies by nights. A flat `per_booking` charge is unaffected by them.
 */
export function computeCityTaxLine(item: ListingFeeTaxItem, reservation: ReservationEntry): CityTaxBasisLine | null {
  if (item.type !== 'city_tax')
    return null
  if (!isWithinApplicableRange(item, reservation.checkIn))
    return null

  const config = item.cityTax
  const guests = chargeableGuestCount(reservation, config)
  const nights = chargeableNights(item, reservation.nights)
  const rooms = reservation.rooms?.length ?? 1

  let amount = 0
  switch (item.logic) {
    case 'percent':
      // The accommodation subtotal only. A tourist levy is not charged on the
      // cleaning fee, the service fee or a desk-posted extra.
      amount = (reservation.priceDetails?.subtotal ?? 0) * (item.rate / 100)
      break
    case 'per_booking':
      amount = item.rate
      break
    case 'per_night':
      amount = item.rate * nights
      break
    case 'per_room':
      amount = item.rate * rooms
      break
    case 'per_room_per_night':
      amount = item.rate * rooms * nights
      break
    case 'per_person':
      amount = item.rate * guests
      break
    case 'per_person_per_night':
      amount = item.rate * guests * nights
      break
  }

  return {
    taxItemId: item.id,
    taxTitle: item.title,
    authorityName: config?.authorityName,
    note: config?.note,
    logic: item.logic,
    rate: item.rate,
    chargeableGuests: guests,
    chargeableNights: nights,
    rooms,
    // A percentage is a slice of a price already in the reservation's currency.
    // A fixed amount is denominated by the tax item itself.
    currency: item.logic === 'percent' ? reservation.currency : (item.currency ?? reservation.currency),
    amount: roundCityTaxAmount(Math.max(0, amount)),
  }
}
