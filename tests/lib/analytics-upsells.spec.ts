import { describe, expect, it } from 'vitest'
import { buildAnalyticsBookings, resolvePeriod, toAnalyticsUnits } from '~/components/analytics/data/analytics'
import { buildUpsellOrders, upsellRevenueSeries, upsellSummary } from '~/components/analytics/data/upsell-insights'
import { listings } from '~/components/listings/data/listings'

const ANCHOR = '2026-10-18'
const units = toAnalyticsUnits(listings.value)
const bookings = buildAnalyticsBookings(units, ANCHOR)
const orders = buildUpsellOrders(bookings, ANCHOR)
const span = resolvePeriod('90d', ANCHOR, null)

describe('upsell insights', () => {
  it('is deterministic and places nothing after the anchor', () => {
    expect(buildUpsellOrders(bookings, ANCHOR)).toEqual(orders)
    expect(orders.length).toBeGreaterThan(0)
    expect(orders.every(o => o.orderedOn <= ANCHOR)).toBe(true)
  })

  it('never attaches orders to cancelled stays or linked extension bookings', () => {
    const blocked = new Set(bookings.filter(b => b.cancelledOn || b.extensionOf).map(b => b.id))
    expect(orders.some(o => blocked.has(o.bookingId))).toBe(false)
  })

  it('paid orders carry a method, the others never do', () => {
    expect(orders.filter(o => o.status === 'paid').every(o => o.method)).toBe(true)
    expect(orders.filter(o => o.status !== 'paid').every(o => !o.method)).toBe(true)
  })

  it('adds up: paid + outstanding = revenue, methods = paid, services = revenue', () => {
    const currency = orders[0]!.currency
    const s = upsellSummary(bookings, orders, span, currency)
    expect(s.orders).toBeGreaterThan(0)
    expect(s.paid + s.outstanding).toBeCloseTo(s.revenue)
    expect(s.byMethod.reduce((n, m) => n + m.amount, 0)).toBeCloseTo(s.paid)
    expect(s.byService.reduce((n, r) => n + r.revenue, 0)).toBeCloseTo(s.revenue)
    expect(s.attachRate).toBeGreaterThanOrEqual(0)
    expect(s.attachRate).toBeLessThanOrEqual(1)
  })

  it('never blends currencies', () => {
    const currency = orders[0]!.currency
    const mine = orders.filter(o => o.currency === currency && o.orderedOn >= span.start && o.orderedOn <= span.end)
    expect(upsellSummary(bookings, orders, span, currency).revenue).toBe(mine.reduce((n, o) => n + o.amount, 0))
  })

  it('the series covers the period and adds up to the summary', () => {
    const currency = orders[0]!.currency
    const series = upsellRevenueSeries(orders, span, currency)
    const total = series.reduce((n, p) => n + p.paid + p.outstanding, 0)
    expect(Math.abs(total - upsellSummary(bookings, orders, span, currency).revenue)).toBeLessThanOrEqual(series.length)
  })

  it('has no orders and zero rates for an empty period', () => {
    const empty = upsellSummary([], [], span, 'USD')
    expect(empty.orders).toBe(0)
    expect(empty.attachRate).toBeNull()
    expect(empty.collectionRate).toBeNull()
  })
})
