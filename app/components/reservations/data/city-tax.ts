import type { ActivityEvent, ActivityEventColor } from '~/components/inbox/data/conversations'
import type {
  BookingChannel,
  CityTaxAgeBands,
  CityTaxChargeableGuests,
  CityTaxCollector,
  CityTaxConfig,
  CityTaxGuestRates,
  ListingFeeTaxItem,
  TaxLogic,
} from '~/components/listings/data/listings'
import type { CityTaxPaymentMethod, CityTaxSettlement, CityTaxTotal, ReservationEntry } from '~/components/reservations/data/reservations'

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

export type CityTaxGuestCategory = 'adults' | 'children' | 'infants'

export const CITY_TAX_GUEST_CATEGORIES: CityTaxGuestCategory[] = ['adults', 'children', 'infants']

export const CITY_TAX_GUEST_CATEGORY_LABELS: Record<CityTaxGuestCategory, string> = {
  adults: 'Adults',
  children: 'Children',
  infants: 'Infants',
}

const CITY_TAX_GUEST_CATEGORY_SINGULAR: Record<CityTaxGuestCategory, string> = {
  adults: 'adult',
  children: 'child',
  infants: 'infant',
}

/** "1 child", "2 children". A breakdown row is a head count and reads as one. */
export function cityTaxGuestCountLabel(category: CityTaxGuestCategory, guests: number): string {
  const word = guests === 1
    ? CITY_TAX_GUEST_CATEGORY_SINGULAR[category]
    : CITY_TAX_GUEST_CATEGORY_LABELS[category].toLowerCase()
  return `${guests} ${word}`
}

/**
 * Under 2 is an infant, under 12 a child. The most common European shape, and
 * what every item written before `ageBands` existed is treated as.
 */
export const DEFAULT_CITY_TAX_AGE_BANDS: CityTaxAgeBands = {
  infantUnder: 2,
  childUnder: 12,
}

export function resolveAgeBands(config?: CityTaxConfig): CityTaxAgeBands {
  return config?.ageBands ?? DEFAULT_CITY_TAX_AGE_BANDS
}

/**
 * Which category a guest of a known age falls into.
 *
 * ⚠️ Nothing in the pricing path calls this, and that is not an oversight: a
 * reservation carries head counts, never ages. It exists so the rule the tenant
 * typed is executable and testable rather than decorative, and so the desk can
 * settle "my daughter is 11" against the same numbers the settings screen
 * shows. A negative age is read as an infant rather than rejected, since the
 * only thing below the infant bound is an infant.
 */
export function classifyGuestAge(age: number, bands: CityTaxAgeBands = DEFAULT_CITY_TAX_AGE_BANDS): CityTaxGuestCategory {
  if (age < bands.infantUnder)
    return 'infants'
  if (age < bands.childUnder)
    return 'children'
  return 'adults'
}

/**
 * "under 2", "2-11", "12 and over" — the band in the words a guest would use.
 *
 * With no infant band (`infantUnder: 0`) the child row reads "under 12" rather
 * than "0-11", because a range starting at zero invites the question of where
 * the infants went.
 */
export function cityTaxAgeBandLabel(
  category: CityTaxGuestCategory,
  bands: CityTaxAgeBands = DEFAULT_CITY_TAX_AGE_BANDS,
): string {
  if (category === 'infants')
    return bands.infantUnder <= 0 ? 'Not recognised' : `under ${bands.infantUnder}`
  if (category === 'children') {
    return bands.infantUnder <= 0
      ? `under ${bands.childUnder}`
      : `${bands.infantUnder}-${bands.childUnder - 1}`
  }
  return `${bands.childUnder} and over`
}

/**
 * The reason these bands cannot be saved, or `null`.
 *
 * A child band that ends at or below where the infant band ends leaves the
 * child category unreachable: every guest would be an infant or an adult, and
 * the child rate beside it would price nobody. Whole years only, because that
 * is how every one of these rules is written.
 */
export function ageBandsError(bands: CityTaxAgeBands): string | null {
  const { infantUnder, childUnder } = bands
  if (!Number.isInteger(infantUnder) || !Number.isInteger(childUnder))
    return 'Ages must be whole years.'
  if (infantUnder < 0 || childUnder < 0)
    return 'Ages cannot be negative.'
  if (childUnder <= infantUnder)
    return 'The child age must be above the infant age, otherwise no guest is ever a child.'
  return null
}

/**
 * What one guest of this category pays per chargeable unit.
 *
 * Adults always pay the item's own rate. A child or infant rate that is not set
 * inherits it, so an item written before `guestRates` existed prices exactly as
 * it always did. An explicit `0` is honoured: `??` and not `||`, because a
 * municipality that exempts infants means zero, not "same as an adult".
 */
export function cityTaxRateForCategory(
  baseRate: number,
  category: CityTaxGuestCategory,
  rates?: CityTaxGuestRates,
): number {
  if (category === 'adults')
    return baseRate
  return rates?.[category] ?? baseRate
}

export interface CityTaxGuestRateLine {
  category: CityTaxGuestCategory
  guests: number
  rate: number
  /** `rate * guests`, for ONE night. The nights multiplier is applied to the line, not here. */
  amount: number
}

/**
 * Head counts per chargeable category, in a fixed order so a breakdown always
 * reads adults, children, infants.
 *
 * Categories the tenant does not charge are absent, not zeroed: a zero row for
 * a category nobody is charging reads as an exemption that was applied, when in
 * fact the category was never in scope.
 */
export function chargeableGuestBreakdown(
  guests: CityTaxGuestCounts,
  config?: CityTaxConfig,
): Array<{ category: CityTaxGuestCategory, guests: number }> {
  const rules = config?.chargeableGuests ?? DEFAULT_CHARGEABLE_GUESTS
  const hasBreakdown = guests.guestAdults !== undefined
    || guests.guestChildren !== undefined
    || guests.guestInfants !== undefined

  // Same reading as `chargeableGuestCount`: with no breakdown on the stay, the
  // headcount is all we know, and calling it adults invents no exemption.
  if (!hasBreakdown) {
    return rules.adults && guests.guestCount > 0
      ? [{ category: 'adults', guests: guests.guestCount }]
      : []
  }

  const counts: Record<CityTaxGuestCategory, number> = {
    adults: guests.guestAdults ?? 0,
    children: guests.guestChildren ?? 0,
    infants: guests.guestInfants ?? 0,
  }

  return CITY_TAX_GUEST_CATEGORIES
    .filter(category => rules[category] && counts[category] > 0)
    .map(category => ({ category, guests: counts[category] }))
}

/**
 * Whether this stay is priced at more than one rate, so the surfaces know when
 * a single "N guests x RATE" line would be a lie.
 *
 * A one-category breakdown still counts as mixed when that category is not
 * adults: a stay of two children billed at the child rate is not billed at the
 * item's headline rate, and saying so would misquote the working.
 */
export function hasMixedGuestRates(line: Pick<CityTaxBasisLine, 'guestBreakdown' | 'rate'>): boolean {
  return line.guestBreakdown.some(row => row.rate !== line.rate)
}

/**
 * "Children EUR 1.50 · Infants free", or an empty string when every chargeable
 * category pays the adult rate. Only the categories actually charged are
 * listed, so a rate left over from a category the tenant has since switched off
 * is not advertised.
 */
export function cityTaxGuestRateSummary(item: ListingFeeTaxItem): string {
  const config = item.cityTax
  if (!config)
    return ''
  if (item.logic !== 'per_person' && item.logic !== 'per_person_per_night')
    return ''

  const currency = item.currency ?? ''
  return CITY_TAX_GUEST_CATEGORIES
    .filter(category => category !== 'adults' && config.chargeableGuests[category])
    .flatMap((category) => {
      const rate = cityTaxRateForCategory(item.rate, category, config.guestRates)
      if (rate === item.rate)
        return []
      const label = CITY_TAX_GUEST_CATEGORY_LABELS[category]
      return [rate === 0 ? `${label} free` : `${label} ${currency} ${rate}`.trim()]
    })
    .join(' · ')
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
  /** The ADULT rate. Children and infants may pay another, see `guestBreakdown`. */
  rate: number
  chargeableGuests: number
  chargeableNights: number
  rooms: number
  /**
   * One row per chargeable guest category, priced at that category's own rate.
   * Empty on any logic that does not multiply by guests, so a reader never has
   * to ask whether a per-booking charge had a child rate applied to it.
   */
  guestBreakdown: CityTaxGuestRateLine[]
  /**
   * Resolved, never optional, so any surface can print "children: 2-11" without
   * re-reading the config. Copied off the item the same way `authorityName` and
   * `note` are.
   */
  ageBands: CityTaxAgeBands
  amount: number
  currency: string
}

/**
 * Round to the currency's minor unit.
 *
 * Deliberately a local copy of `roundFolioAmount` in `./folio.ts` rather than a
 * shared helper: rounding in this codebase is a per-module decision, not a
 * global one. The folio rounds to the minor unit while an upsell order rounds
 * to whole units, on purpose, so a single shared rounder would couple modules
 * that are meant to disagree.
 *
 * The 2-decimal precision assumes a currency with a 2-decimal minor unit. IDR
 * is zero-decimal, which is harmless here only because every IDR amount this
 * feature handles is already whole. Revisit if a rate is ever given in
 * fractional IDR.
 */
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

  // Priced per category, so a child rate and an infant rate each apply to their
  // own heads. With no override set, every row carries `item.rate` and the sum
  // is identical to the old single-rate multiplication.
  const isPerGuest = item.logic === 'per_person' || item.logic === 'per_person_per_night'
  const guestBreakdown: CityTaxGuestRateLine[] = isPerGuest
    ? chargeableGuestBreakdown(reservation, config).map((row) => {
        const rate = cityTaxRateForCategory(item.rate, row.category, config?.guestRates)
        return { ...row, rate, amount: roundCityTaxAmount(rate * row.guests) }
      })
    : []

  const perGuestNightly = guestBreakdown.reduce((sum, row) => sum + row.amount, 0)

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
      amount = perGuestNightly
      break
    case 'per_person_per_night':
      amount = perGuestNightly * nights
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
    guestBreakdown,
    ageBands: resolveAgeBands(config),
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

export type CityTaxAlertStage = 'upcoming' | 'due_today' | 'overdue'

/**
 * `due_today` covers the whole stay, not just the arrival date: an in-house
 * guest can still be asked at the desk. It turns `overdue` on the check-out
 * date itself, the first day the guest can walk out without paying.
 */
export function cityTaxAlertStage(
  assessment: CityTaxAssessment,
  stay: Pick<ReservationEntry, 'checkIn' | 'checkOut'>,
  todayIso: string,
): CityTaxAlertStage | null {
  if (assessment.status !== 'due')
    return null
  if (stay.checkOut <= todayIso)
    return 'overdue'
  if (stay.checkIn <= todayIso)
    return 'due_today'
  return 'upcoming'
}

export const CITY_TAX_METHOD_LABELS: Record<CityTaxPaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  other: 'Other',
}

export type CityTaxActivityKind = 'collected' | 'waived' | 'reopened'

const cityTaxActivityTitles: Record<CityTaxActivityKind, string> = {
  collected: 'City tax collected',
  waived: 'City tax waived',
  reopened: 'City tax reopened',
}

const cityTaxActivityColors: Record<CityTaxActivityKind, ActivityEventColor> = {
  collected: 'green',
  waived: 'gray',
  reopened: 'gold',
}

export function formatCityTaxTotal(total: CityTaxTotal): string {
  return `${total.currency} ${total.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatCityTaxTotals(totals: CityTaxTotal[]): string {
  return totals.length === 0 ? '0.00' : totals.map(formatCityTaxTotal).join(' + ')
}

/**
 * The id carries the timestamp rather than just the kind. Unlike a folio item,
 * a reservation has exactly one city tax settlement, so collect / undo /
 * collect again would otherwise produce three events sharing one id and the
 * timeline would render one.
 */
export function cityTaxActivityEvent(
  kind: CityTaxActivityKind,
  settlement: CityTaxSettlement | null,
  actor: string,
  now: string = new Date().toISOString(),
): ActivityEvent {
  const parts: string[] = []
  if (settlement) {
    parts.push(formatCityTaxTotals(settlement.totals))
    if (kind === 'collected' && settlement.method)
      parts.push(CITY_TAX_METHOD_LABELS[settlement.method])
    if (kind === 'waived' && settlement.reason)
      parts.push(`Reason: ${settlement.reason}`)
  }
  else {
    parts.push('Marked outstanding again')
  }

  return {
    id: `act-citytax-${kind}-${now}`,
    type: 'reservation',
    title: cityTaxActivityTitles[kind],
    description: parts.join(' · '),
    actor,
    timestamp: now,
    colorDot: cityTaxActivityColors[kind],
  }
}
