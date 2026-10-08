import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { nightsIn } from '~/components/analytics/data/analytics'
import { addIsoDays } from '~/components/gm/data/gm-dashboard'

/**
 * Which date of a reservation a date range applies to.
 * - stay:      at least one night inside the range (a stay crossing the month
 *              shows in both months). Arrival night counts, departure night does not.
 * - check_in:  arrives inside the range.
 * - check_out: departs inside the range.
 */
export type ReservationDateBasis = 'stay' | 'check_in' | 'check_out'

export const RESERVATION_DATE_BASIS_OPTIONS: { value: ReservationDateBasis, label: string }[] = [
  { value: 'stay', label: 'Staying' },
  { value: 'check_in', label: 'Check-in' },
  { value: 'check_out', label: 'Check-out' },
]

/** Inclusive `YYYY-MM-DD` bounds; an empty string leaves that side open. */
export interface ReservationPeriod {
  from: string
  to: string
}

export function hasPeriod(period: ReservationPeriod): boolean {
  return Boolean(period.from || period.to)
}

function within(date: string, { from, to }: ReservationPeriod): boolean {
  return (!from || date >= from) && (!to || date <= to)
}

export function matchesReservationPeriod(
  r: Pick<ReservationEntry, 'checkIn' | 'checkOut'>,
  period: ReservationPeriod,
  basis: ReservationDateBasis,
): boolean {
  if (!hasPeriod(period))
    return true
  if (basis === 'check_in')
    return within(r.checkIn, period)
  if (basis === 'check_out')
    return within(r.checkOut, period)
  return (!period.to || r.checkIn <= period.to) && (!period.from || r.checkOut > period.from)
}

/** Same rule as Analytics (`nightsIn`), so an export total matches the Revenue card. */
export function nightsInPeriod(r: Pick<ReservationEntry, 'checkIn' | 'checkOut'>, period: ReservationPeriod): number {
  return nightsIn(r, {
    start: period.from || r.checkIn,
    end: period.to || addIsoDays(r.checkOut, -1),
  })
}

/** Decimals the currency is shown with (IDR 500,000; CHF 1,200.00). */
export function currencyDecimals(currency: string): number {
  return ['IDR', 'JPY', 'KRW', 'VND'].includes(currency.toUpperCase()) ? 0 : 2
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

/** Room price before fees and tax; the booking total when no breakdown exists. */
export function roomRevenue(r: Pick<ReservationEntry, 'priceDetails' | 'totalPrice'>): number {
  return r.priceDetails?.subtotal ?? r.totalPrice
}

/**
 * Room revenue earned on the nights inside the period, in the stay's own
 * currency. Rounded cumulatively (nights before the period vs. up to its end),
 * so the months of one stay always add up to exactly its room revenue.
 */
export function roomRevenueInPeriod(
  r: Pick<ReservationEntry, 'checkIn' | 'checkOut' | 'nights' | 'priceDetails' | 'totalPrice' | 'currency'>,
  period: ReservationPeriod,
): number {
  const inPeriod = nightsInPeriod(r, period)
  if (inPeriod === 0 || r.nights <= 0)
    return 0
  const total = roomRevenue(r)
  const before = period.from ? nightsIn(r, { start: r.checkIn, end: addIsoDays(period.from, -1) }) : 0
  const decimals = currencyDecimals(r.currency)
  const upTo = (nights: number) => round(total * nights / r.nights, decimals)
  return round(upTo(before + inPeriod) - upTo(before), decimals)
}

/** One-off fee: counted in full in the period holding the arrival night. */
export function cleaningFeeInPeriod(
  r: Pick<ReservationEntry, 'checkIn' | 'priceDetails'>,
  period: ReservationPeriod,
): number {
  return within(r.checkIn, period) ? (r.priceDetails?.cleaningFee ?? 0) : 0
}
