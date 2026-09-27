// Redeeming MERRYCHRISTMAS on a confirmed booking: one free order per granted service,
// priced at 0 with the catalog price frozen, counted against the usage limit, and given
// back when the booking is cancelled.

import type { PromoRedemptionRequest } from '~/components/promo-code/data/promo-code-redemption'
import { beforeEach, describe, expect, it } from 'vitest'
import { getOrderStatus } from '~/components/upsells/data/upsell-orders'
import { useNotifications } from '~/composables/useNotifications'
import { usePromoCodes } from '~/composables/usePromoCodes'
import { usePromoRedemption } from '~/composables/usePromoRedemption'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useUpsellOrders } from '~/composables/useUpsellOrders'
import { useUpsellServices } from '~/composables/useUpsellServices'

// Inside MERRYCHRISTMAS's booking window (1 Sep → 24 Dec 2026).
const now = new Date(2026, 9, 1)

// lst-1 is on the West Coast kitchen, lst-5 on the Central one, lst-20 is in Germany.
const canggu: PromoRedemptionRequest = {
  listingId: 'lst-1',
  listingName: '5BR Pool the R Villa Luwa – Serene near Canggu',
  channel: 'widget',
  checkIn: '2026-12-22',
  checkOut: '2026-12-26',
}
const ubud: PromoRedemptionRequest = { ...canggu, listingId: 'lst-5', listingName: 'Nomad Mansion Garden' }

const guest = { reservationId: 'R-XMAS-1', guestName: 'Maya Putri', guestEmail: 'maya@example.com' }

function merry() {
  return usePromoCodes().codes.value.find(c => c.code === 'MERRYCHRISTMAS')!
}

describe('usePromoRedemption', () => {
  beforeEach(() => {
    useReservationsModule().reset()
  })

  it('gives a Canggu guest the West Coast breakfast only', () => {
    const result = usePromoRedemption().redeem('merrychristmas', canggu, guest, {}, now)

    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.orders).toHaveLength(1)
    const [order] = result.orders
    expect(order!.serviceId).toBe('svc-013')
    expect(order!.items).toEqual([{ id: 'itm-013a', name: 'Floating Breakfast for 2', price: 0, quantity: 1 }])
    expect(order!.grandTotal).toBe(0)
    expect(order!.promoRedemption).toMatchObject({ code: 'MERRYCHRISTMAS', originalPrice: 450000 })
    expect(order!.serviceDate).toBe('2026-12-22')
  })

  it('gives an Ubud guest the Central breakfast only', () => {
    const result = usePromoRedemption().redeem('MERRYCHRISTMAS', ubud, { ...guest, reservationId: 'R-XMAS-2' }, {}, now)

    expect(result.ok && result.orders.map(o => o.serviceId)).toEqual(['svc-014'])
  })

  it('puts a by-request breakfast in front of the team as requested, and raises the bell', () => {
    const before = useNotifications().alerts.value.length
    const result = usePromoRedemption().redeem('MERRYCHRISTMAS', canggu, guest, {}, now)

    expect(result.ok && getOrderStatus(result.orders[0]!)).toBe('requested')
    expect(result.ok && result.orders[0]!.notes).toContain('Confirm the date with the guest')
    const alerts = useNotifications().alerts.value
    expect(alerts.length).toBe(before + 1)
    expect(alerts.some(a => a.type === 'UPSELL_ORDER_REQUESTED')).toBe(true)
  })

  it('approving a free order settles it without a payment link', () => {
    const result = usePromoRedemption().redeem('MERRYCHRISTMAS', canggu, guest, {}, now)
    const id = result.ok ? result.orders[0]!.id : ''
    const orders = useUpsellOrders()

    orders.approveOrder(id)

    const order = orders.orders.value.find(o => o.id === id)!
    expect(order.paymentStatus).toBe('paid')
    expect(order.paymentLinkSentAt).toBeDefined()
    expect(order.approvalStatus).toBe('approved')
  })

  it('settles an always-available free service straight away', () => {
    const { services } = useUpsellServices()
    services.value = services.value.map(s => s.id === 'svc-013' ? { ...s, availability: 'always' } : s)

    const result = usePromoRedemption().redeem('MERRYCHRISTMAS', canggu, guest, {}, now)
    const stored = useUpsellOrders().orders.value.find(o => result.ok && o.id === result.orders[0]!.id)!

    expect(stored.approvalStatus).toBe('approved')
    expect(stored.paymentStatus).toBe('paid')
  })

  it('counts the redemption against the code', () => {
    const before = merry().redemptionCount
    usePromoRedemption().redeem('MERRYCHRISTMAS', canggu, guest, {}, now)

    expect(merry().redemptionCount).toBe(before + 1)
  })

  it('rejects a listing where neither breakfast is offered, creating nothing', () => {
    const ordersBefore = useUpsellOrders().orders.value.length
    const { codes } = usePromoCodes()
    // Widen the scope to the German villas, which no breakfast kitchen reaches.
    codes.value = codes.value.map(c => c.code === 'MERRYCHRISTMAS' ? { ...c, listingIds: [] } : c)

    const result = usePromoRedemption().redeem('MERRYCHRISTMAS', {
      ...canggu,
      listingId: 'lst-20',
      listingName: 'Villa Luwa – Hügellage Brandenburg',
    }, guest, {}, now)

    expect(result).toMatchObject({ ok: false, reason: 'no_free_upsell', message: 'This promo code is not valid for this property.' })
    expect(useUpsellOrders().orders.value.length).toBe(ordersBefore)
    expect(merry().redemptionCount).toBe(0)
  })

  it('rejects an unknown code', () => {
    expect(usePromoRedemption().checkCode('NOPE', canggu, now)).toMatchObject({ ok: false, reason: 'unknown' })
  })

  it('refuses to redeem the same code twice on one booking', () => {
    const redemption = usePromoRedemption()
    redemption.redeem('MERRYCHRISTMAS', canggu, guest, {}, now)

    expect(redemption.redeem('MERRYCHRISTMAS', canggu, guest, {}, now)).toMatchObject({ ok: false, reason: 'already_redeemed' })
  })

  it('asks the guest to choose when a service has several free items', () => {
    const { services } = useUpsellServices()
    services.value = services.value.map(s => s.id === 'svc-013'
      ? { ...s, items: [...s.items, { id: 'itm-013b', name: 'Floating Breakfast for 4', price: 800000 }] }
      : s)
    const { codes } = usePromoCodes()
    codes.value = codes.value.map(c => c.code === 'MERRYCHRISTMAS'
      ? { ...c, freeUpsellItemIds: [...c.freeUpsellItemIds!, 'itm-013b'] }
      : c)
    const redemption = usePromoRedemption()

    expect(redemption.redeem('MERRYCHRISTMAS', canggu, guest, {}, now)).toMatchObject({ ok: false, reason: 'choice_required' })

    const result = redemption.redeem('MERRYCHRISTMAS', canggu, guest, { 'svc-013': 'itm-013b' }, now)
    expect(result.ok && result.orders.map(o => o.items[0]!.id)).toEqual(['itm-013b'])
    expect(result.ok && result.orders[0]!.promoRedemption!.originalPrice).toBe(800000)
  })

  it('cancelling the booking cancels the free orders and gives the redemption back', () => {
    const redemption = usePromoRedemption()
    const result = redemption.redeem('MERRYCHRISTMAS', canggu, guest, {}, now)
    const id = result.ok ? result.orders[0]!.id : ''

    expect(redemption.releaseForReservation(guest.reservationId)).toBe(1)

    const order = useUpsellOrders().orders.value.find(o => o.id === id)!
    expect(order.approvalStatus).toBe('declined')
    expect(order.cancellationReason).toBe('Booking cancelled')
    expect(merry().redemptionCount).toBe(0)
    // Idempotent: a second cancel changes nothing.
    expect(redemption.releaseForReservation(guest.reservationId)).toBe(0)
    expect(merry().redemptionCount).toBe(0)
  })

  it('leaves an already fulfilled order alone on cancellation', () => {
    const redemption = usePromoRedemption()
    const result = redemption.redeem('MERRYCHRISTMAS', canggu, guest, {}, now)
    const id = result.ok ? result.orders[0]!.id : ''
    useUpsellOrders().completeFulfillment(id)

    redemption.releaseForReservation(guest.reservationId)

    expect(useUpsellOrders().orders.value.find(o => o.id === id)!.approvalStatus).not.toBe('declined')
  })

  it('releases the redemption when the reservation is cancelled', () => {
    const reservations = useReservationsModule()
    const reservationId = reservations.reservations.value[0]!.id
    const redemption = usePromoRedemption()
    redemption.redeem('MERRYCHRISTMAS', canggu, { ...guest, reservationId }, {}, now)

    reservations.updateReservationStatus(reservationId, 'cancelled')

    expect(redemption.redemptionsForReservation(reservationId)[0]!.releasedAt).toBeDefined()
    expect(merry().redemptionCount).toBe(0)
  })

  it('names the listings a code is rejected at, from the live catalog', () => {
    const redemption = usePromoRedemption()
    expect(redemption.listingsRejectingCode(merry())).toEqual([])

    const { services } = useUpsellServices()
    services.value = services.value.map(s => s.id === 'svc-014' ? { ...s, status: 'inactive' } : s)

    expect(redemption.listingsRejectingCode(merry())).toContain('Nomad Mansion Garden')
    expect(redemption.listingsRejectingCode(merry())).not.toContain(canggu.listingName)
  })
})
