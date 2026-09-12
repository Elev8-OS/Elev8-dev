import type {
  BookingChannel,
  CityTaxChargeableGuests,
  CityTaxCollector,
  CityTaxConfig,
  ListingFeeTaxItem,
  TaxLogic,
} from '~/components/listings/data/listings'
import type { CityTaxSettlement, CityTaxTotal, ReservationEntry } from '~/components/reservations/data/reservations'

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

export type CityTaxStatus
  = 'not_required'
    | 'channel_collects'
    | 'due'
    | 'collected'
    | 'waived'

export interface CityTaxAssessment {
  status: CityTaxStatus
  collector: CityTaxCollector
  /**
   * One entry per currency present in `lines`. Almost always length 1. There is
   * deliberately no single `amount` field: two currencies must never be blended
   * into one number, and this app invents no exchange rates.
   */
  totals: CityTaxTotal[]
  lines: CityTaxBasisLine[]
  settlement: CityTaxSettlement | null
}

/**
 * Structural on purpose: a `CityTaxBasisLine` and a frozen `CityTaxTotal` both
 * satisfy it, so the live assessment and a settled stay sum through one
 * function instead of two that can drift apart.
 */
export function cityTaxTotals(amounts: Array<{ currency: string, amount: number }>): CityTaxTotal[] {
  const byCurrency = new Map<string, number>()
  for (const entry of amounts)
    byCurrency.set(entry.currency, roundCityTaxAmount((byCurrency.get(entry.currency) ?? 0) + entry.amount))
  return [...byCurrency.entries()].map(([currency, amount]) => ({ currency, amount }))
}

/**
 * The whole city tax picture for one stay, computed fresh every time.
 *
 * Nothing here reads a stored status, and that is the point: flipping a channel
 * policy must re-evaluate every existing booking on the spot. Only the
 * settlement is stored, and only once staff have acted.
 */
export function resolveCityTax(reservation: ReservationEntry, items: ListingFeeTaxItem[]): CityTaxAssessment {
  const settlement = reservation.cityTaxSettlement ?? null
  const cityTaxes = items.filter(item => item.type === 'city_tax')

  // A cancelled or blocked stay owes nothing, whatever the policy says.
  const dead = reservation.status === 'cancelled' || reservation.status === 'blocked'

  const lines = dead
    ? []
    : cityTaxes
        .filter(item => collectorFor(item.cityTax, reservation.channel) === 'host')
        .map(item => computeCityTaxLine(item, reservation))
        .filter((line): line is CityTaxBasisLine => line !== null && line.amount > 0)

  const totals = cityTaxTotals(lines)

  if (settlement)
    return { status: settlement.state, collector: 'host', totals, lines, settlement }

  if (lines.length > 0)
    return { status: 'due', collector: 'host', totals, lines, settlement: null }

  const channelCollects = !dead && cityTaxes.some(item =>
    collectorFor(item.cityTax, reservation.channel) === 'channel'
    && isWithinApplicableRange(item, reservation.checkIn))

  if (channelCollects)
    return { status: 'channel_collects', collector: 'channel', totals: [], lines: [], settlement: null }

  return { status: 'not_required', collector: 'not_applicable', totals: [], lines: [], settlement: null }
}
