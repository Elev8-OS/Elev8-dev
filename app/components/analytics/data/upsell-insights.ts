/**
 * Upsell orders and how they were paid, on the Upsells & payments tab. The
 * generated portfolio has no orders of its own, so each confirmed stay may
 * carry a few, decided from a hash of the booking id (never `rand`, so adding
 * them reshuffles no stay). Money counts orders by the day they were
 * **placed**; the attach rate counts stays by **arrival**, as stays do.
 * Upsell money is the price the guest paid for the service, never run
 * through the revenue basis (that values room nights).
 */

import type { AnalyticsBooking, DateSpan } from '~/components/analytics/data/analytics'
import { idHash, isCancelled, trendBuckets, trendGrain } from '~/components/analytics/data/analytics'
import { addIsoDays } from '~/components/gm/data/gm-dashboard'

export type UpsellPayStatus = 'paid' | 'awaiting' | 'unpaid'
export type UpsellPayMethod = 'link' | 'cash' | 'card' | 'manual'

export const UPSELL_PAY_METHODS: { value: UpsellPayMethod, label: string, weight: number }[] = [
  { value: 'link', label: 'Payment link', weight: 55 },
  { value: 'cash', label: 'Cash', weight: 20 },
  { value: 'card', label: 'Card', weight: 15 },
  { value: 'manual', label: 'Other', weight: 10 },
]

interface ServiceProfile {
  key: string
  label: string
  weight: number
  /** Unit price per currency: services are priced in each currency, never converted. */
  price: Record<string, number>
}

export const UPSELL_SERVICES: ServiceProfile[] = [
  { key: 'transfer', label: 'Airport transfer', weight: 34, price: { IDR: 450_000, USD: 30, EUR: 28, CHF: 30 } },
  { key: 'spa', label: 'In-villa spa', weight: 18, price: { IDR: 850_000, USD: 55, EUR: 50, CHF: 55 } },
  { key: 'chef', label: 'Private chef', weight: 12, price: { IDR: 1_800_000, USD: 120, EUR: 110, CHF: 120 } },
  { key: 'vehicle', label: 'Vehicle rental', weight: 16, price: { IDR: 300_000, USD: 20, EUR: 18, CHF: 20 } },
  { key: 'tour', label: 'Tours and activities', weight: 12, price: { IDR: 900_000, USD: 60, EUR: 55, CHF: 60 } },
  { key: 'early', label: 'Early check-in or late check-out', weight: 8, price: { IDR: 400_000, USD: 25, EUR: 23, CHF: 25 } },
]

export interface UpsellOrderRow {
  id: string
  bookingId: string
  listingId: string
  service: string
  currency: string
  amount: number
  /** ISO date the order was placed. */
  orderedOn: string
  status: UpsellPayStatus
  method?: UpsellPayMethod
}

/** Share of confirmed stays that buy at least one upsell. */
const ATTACH_SHARE = 38
/** Share of placed orders the guest has paid (the rest wait or were never collected). */
const PAID_SHARE = 88

function pickWeighted<T extends { weight: number }>(items: T[], h: number): T {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let roll = h % total
  for (const item of items) {
    if (roll < item.weight)
      return item
    roll -= item.weight
  }
  return items[items.length - 1]!
}

/** Orders of one stay: nothing for a cancelled stay or a linked extension booking. */
export function upsellOrdersFor(b: AnalyticsBooking, anchorIso: string): UpsellOrderRow[] {
  if (isCancelled(b) || b.extensionOf)
    return []
  if (idHash(`${b.id}#upsell`) % 100 >= ATTACH_SHARE)
    return []
  const count = 1 + (idHash(`${b.id}#upsell-2`) % 100 < 25 ? 1 : 0) + (idHash(`${b.id}#upsell-3`) % 100 < 8 ? 1 : 0)
  const orders: UpsellOrderRow[] = []
  for (let i = 0; i < count; i++) {
    const seed = `${b.id}#order-${i}`
    const orderedOn = addIsoDays(b.bookedOn, idHash(`${seed}#when`) % (b.leadDays + b.nights))
    if (orderedOn > anchorIso)
      continue
    const service = pickWeighted(UPSELL_SERVICES, idHash(`${seed}#service`))
    const quantity = 1 + (idHash(`${seed}#qty`) % 3 === 0 ? 1 : 0)
    const unit = service.price[b.currency] ?? service.price.USD!
    const paysOn = addIsoDays(orderedOn, idHash(`${seed}#pay`) % 3)
    const paid = idHash(`${seed}#paid`) % 100 < PAID_SHARE && paysOn <= anchorIso
    // Unpaid and still to come it is waiting for the guest; unpaid and past, it was never collected.
    const status: UpsellPayStatus = paid ? 'paid' : b.checkIn >= anchorIso ? 'awaiting' : 'unpaid'
    orders.push({
      id: `${b.id}-up${i + 1}`,
      bookingId: b.id,
      listingId: b.listingId,
      service: service.key,
      currency: b.currency,
      amount: unit * quantity,
      orderedOn,
      status,
      method: paid ? pickWeighted(UPSELL_PAY_METHODS, idHash(`${seed}#method`)).value : undefined,
    })
  }
  return orders
}

export function buildUpsellOrders(bookings: AnalyticsBooking[], anchorIso: string): UpsellOrderRow[] {
  return bookings.flatMap(b => upsellOrdersFor(b, anchorIso))
}

const inSpan = (iso: string, span: DateSpan) => iso >= span.start && iso <= span.end

export interface UpsellMethodRow {
  method: UpsellPayMethod
  label: string
  orders: number
  amount: number
}

export interface UpsellServiceRow {
  service: string
  label: string
  orders: number
  revenue: number
}

export interface UpsellSummary {
  /** Confirmed stays arriving in the period. */
  stays: number
  /** Of those, how many bought at least one upsell. */
  attachedStays: number
  attachRate: number | null
  orders: number
  /** Everything ordered in the period, in `currency`. */
  revenue: number
  avgOrderValue: number | null
  paid: number
  /** Awaiting the guest or never collected. */
  outstanding: number
  /** `paid / revenue`, null without orders. */
  collectionRate: number | null
  byMethod: UpsellMethodRow[]
  byService: UpsellServiceRow[]
}

export function upsellSummary(bookings: AnalyticsBooking[], orders: UpsellOrderRow[], span: DateSpan, currency: string): UpsellSummary {
  const arriving = bookings.filter(b => !isCancelled(b) && !b.extensionOf && inSpan(b.checkIn, span))
  const withOrders = new Set(orders.map(o => o.bookingId))
  const attachedStays = arriving.filter(b => withOrders.has(b.id)).length

  const mine = orders.filter(o => o.currency === currency && inSpan(o.orderedOn, span))
  const revenue = mine.reduce((s, o) => s + o.amount, 0)
  const paid = mine.filter(o => o.status === 'paid').reduce((s, o) => s + o.amount, 0)

  const byMethod = UPSELL_PAY_METHODS.map((m) => {
    const rows = mine.filter(o => o.status === 'paid' && o.method === m.value)
    return { method: m.value, label: m.label, orders: rows.length, amount: rows.reduce((s, o) => s + o.amount, 0) }
  })
  const byService = UPSELL_SERVICES
    .map((s) => {
      const rows = mine.filter(o => o.service === s.key)
      return { service: s.key, label: s.label, orders: rows.length, revenue: rows.reduce((sum, o) => sum + o.amount, 0) }
    })
    .filter(r => r.orders > 0)
    .sort((a, b) => b.revenue - a.revenue)

  return {
    stays: arriving.length,
    attachedStays,
    attachRate: arriving.length ? attachedStays / arriving.length : null,
    orders: mine.length,
    revenue,
    avgOrderValue: mine.length ? revenue / mine.length : null,
    paid,
    outstanding: revenue - paid,
    collectionRate: revenue ? paid / revenue : null,
    byMethod,
    byService,
  }
}

export interface UpsellRevenuePoint {
  label: string
  paid: number
  outstanding: number
}

/** Upsell money per trend bucket, split into paid and still outstanding. */
export function upsellRevenueSeries(orders: UpsellOrderRow[], span: DateSpan, currency: string): UpsellRevenuePoint[] {
  const mine = orders.filter(o => o.currency === currency)
  return trendBuckets(span, trendGrain(span)).map((bucket) => {
    const rows = mine.filter(o => inSpan(o.orderedOn, bucket.span))
    const paid = rows.filter(o => o.status === 'paid').reduce((s, o) => s + o.amount, 0)
    const total = rows.reduce((s, o) => s + o.amount, 0)
    return { label: bucket.label, paid: Math.round(paid), outstanding: Math.round(total - paid) }
  })
}
