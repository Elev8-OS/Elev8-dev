import type {
  FreeUpsellPick,
  PromoEvaluation,
  PromoRedemptionRequest,
  PromoRejection,
  RedemptionUpsellService,
} from '~/components/promo-code/data/promo-code-redemption'
import type { PromoCode } from '~/components/promo-code/data/promo-codes'
import type { UpsellOrder } from '~/components/upsells/data/upsell-orders'
import { listings as allListings } from '~/components/listings/data/listings'
import {
  evaluatePromoCode,
  freeUpsellGrantsForListing,
  listingsWithoutFreeUpsell,
  rejectPromo,
  resolveFreeUpsellPicks,
} from '~/components/promo-code/data/promo-code-redemption'
import { useNotifications } from './useNotifications'
import { usePromoCodes } from './usePromoCodes'
import { useUpsellOrders } from './useUpsellOrders'
import { useUpsellServices } from './useUpsellServices'

/**
 * One use of a promo code on one booking. The row is what makes a cancellation reversible:
 * it knows which orders the code created and whether the redemption was already counted back.
 */
export interface PromoCodeRedemption {
  id: string
  promoCodeId: string
  code: string
  reservationId: string
  listingId: string
  listingName: string
  orderIds: string[]
  redeemedAt: string
  releasedAt?: string
}

export interface PromoRedemptionGuest {
  reservationId: string
  guestName: string
  guestEmail?: string
}

export type PromoRedeemResult
  = | { ok: true, redemption: PromoCodeRedemption, orders: UpsellOrder[] }
    | PromoRejection

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Guest-side redemption of promo codes. For a free-upsell code, a confirmed booking gets one
 * free upsell order per granted service (one item, one unit per stay), which reaches the
 * team through the normal Upsell orders list and bell. Cancelling the booking cancels those
 * orders and gives the redemption back to the code's usage limit.
 */
export function usePromoRedemption() {
  const redemptions = useState<PromoCodeRedemption[]>('promo-code-redemptions', () => [])
  const { codes } = usePromoCodes()
  const { services } = useUpsellServices()
  const upsellOrders = useUpsellOrders()

  function findCode(text: string): PromoCode | null {
    const target = text.trim().toUpperCase()
    return codes.value.find(c => c.code === target) ?? null
  }

  function activeRedemption(reservationId: string, promoCodeId: string) {
    return redemptions.value.find(r => r.reservationId === reservationId && r.promoCodeId === promoCodeId && !r.releasedAt)
  }

  /** What the guest would get, without redeeming. Safe to call on every keystroke. */
  function checkCode(text: string, request: PromoRedemptionRequest, now: Date = new Date()): PromoEvaluation {
    const code = findCode(text)
    if (!code)
      return rejectPromo('unknown')
    return evaluatePromoCode(code, request, services.value as RedemptionUpsellService[], now)
  }

  function createFreeOrder(
    code: PromoCode,
    redemptionId: string,
    pick: FreeUpsellPick,
    request: PromoRedemptionRequest,
    guest: PromoRedemptionGuest,
  ): UpsellOrder {
    const byRequest = pick.grant.availability === 'by_request'
    const order = upsellOrders.addOrder({
      reservationId: guest.reservationId,
      guestName: guest.guestName,
      guestEmail: guest.guestEmail,
      serviceId: pick.grant.serviceId,
      serviceName: pick.grant.serviceName,
      serviceCategory: pick.grant.serviceCategory,
      items: [{ id: pick.item.id, name: pick.item.name, price: 0, quantity: 1 }],
      subtotal: 0,
      taxAmount: 0,
      serviceAmount: 0,
      grandTotal: 0,
      currency: pick.grant.currency,
      approvalStatus: byRequest ? 'requested' : 'approved',
      paymentStatus: 'unpaid',
      fulfillmentStatus: 'not_started',
      orderDate: todayLocal(),
      // One unit per stay. A by-request service still needs its date agreed with the guest.
      serviceDate: request.checkIn,
      checkInDate: request.checkIn,
      checkOutDate: request.checkOut,
      listing: request.listingName,
      channel: 'Direct',
      notes: byRequest
        ? `Free with promo code ${code.code}. Confirm the date with the guest.`
        : `Free with promo code ${code.code}.`,
      source: 'web',
      createdByStaffId: 'system',
      approvalRequestedAt: byRequest ? new Date().toISOString() : undefined,
      promoRedemption: {
        redemptionId,
        promoCodeId: code.id,
        code: code.code,
        originalPrice: pick.item.price,
      },
    })
    // Nothing to pay, so an always-available service is settled straight away. `markPaid`
    // also issues a smart-lock code when the service grants one.
    if (!byRequest)
      upsellOrders.markPaid(order.id)

    useNotifications().createUpsellAlert(byRequest ? 'UPSELL_ORDER_REQUESTED' : 'UPSELL_ORDER_APPROVED', {
      orderId: order.id,
      guestName: order.guestName,
      serviceName: order.serviceName,
      serviceDate: order.serviceDate,
      listing_id: request.listingId,
      listing_name: request.listingName,
    })
    return upsellOrders.orders.value.find(o => o.id === order.id) ?? order
  }

  /**
   * Redeem a code on a confirmed booking. `choices` maps service id → item id for a service
   * where the guest was offered more than one free item.
   */
  function redeem(
    text: string,
    request: PromoRedemptionRequest,
    guest: PromoRedemptionGuest,
    choices: Record<string, string> = {},
    now: Date = new Date(),
  ): PromoRedeemResult {
    const code = findCode(text)
    if (!code)
      return rejectPromo('unknown')
    if (activeRedemption(guest.reservationId, code.id))
      return rejectPromo('already_redeemed')

    const evaluation = evaluatePromoCode(code, request, services.value as RedemptionUpsellService[], now)
    if (!evaluation.ok)
      return evaluation

    const resolved = resolveFreeUpsellPicks(evaluation.grants, choices)
    if (!resolved.ok)
      return rejectPromo('choice_required')

    const redemptionId = `redeem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const orders = resolved.picks.map(pick => createFreeOrder(code, redemptionId, pick, request, guest))
    const redemption: PromoCodeRedemption = {
      id: redemptionId,
      promoCodeId: code.id,
      code: code.code,
      reservationId: guest.reservationId,
      listingId: request.listingId,
      listingName: request.listingName,
      orderIds: orders.map(o => o.id),
      redeemedAt: now.toISOString(),
    }
    redemptions.value = [...redemptions.value, redemption]
    codes.value = codes.value.map(c => c.id === code.id ? { ...c, redemptionCount: c.redemptionCount + 1 } : c)
    return { ok: true, redemption, orders }
  }

  /**
   * The booking was cancelled: cancel the free orders its codes created and give each
   * redemption back to its code. Orders already fulfilled are left alone. Idempotent.
   * Returns how many redemptions were released.
   */
  function releaseForReservation(reservationId: string, reason = 'Booking cancelled'): number {
    const open = redemptions.value.filter(r => r.reservationId === reservationId && !r.releasedAt)
    if (open.length === 0)
      return 0

    for (const redemption of open) {
      for (const orderId of redemption.orderIds) {
        const order = upsellOrders.orders.value.find(o => o.id === orderId)
        if (order && order.approvalStatus !== 'declined' && order.fulfillmentStatus !== 'completed')
          upsellOrders.declineOrder(orderId, reason, 'guest')
      }
    }

    const releasedAt = new Date().toISOString()
    const releasedIds = new Set(open.map(r => r.id))
    const perCode = new Map<string, number>()
    for (const r of open)
      perCode.set(r.promoCodeId, (perCode.get(r.promoCodeId) ?? 0) + 1)

    redemptions.value = redemptions.value.map(r => releasedIds.has(r.id) ? { ...r, releasedAt } : r)
    codes.value = codes.value.map(c => perCode.has(c.id)
      ? { ...c, redemptionCount: Math.max(0, c.redemptionCount - perCode.get(c.id)!) }
      : c)
    return open.length
  }

  /** Listings a code covers, as `{ id, name }`. An empty `listingIds` covers every listing. */
  function scopedListings(code: PromoCode): { id: string, name: string }[] {
    const ids = code.listingIds ?? []
    const all = allListings.value.map(l => ({ id: l.id, name: l.name }))
    return ids.length === 0 ? all : all.filter(l => ids.includes(l.id))
  }

  /**
   * Listings in a free-upsell code's scope where it is rejected, because none of its
   * services is offered there (or all of them were switched off). Read against the live
   * catalog, so a service changed after the code was made shows up here.
   */
  function listingsRejectingCode(code: PromoCode): string[] {
    if (code.discountType !== 'free_upsell')
      return []
    return listingsWithoutFreeUpsell(
      code.freeUpsellItemIds ?? [],
      services.value as RedemptionUpsellService[],
      scopedListings(code).map(l => l.name),
    )
  }

  /** The free upsells a code gives at one listing, ignoring dates and limits. */
  function grantsAtListing(code: PromoCode, listingName: string) {
    return freeUpsellGrantsForListing(code.freeUpsellItemIds ?? [], services.value as RedemptionUpsellService[], listingName)
  }

  function redemptionsForReservation(reservationId: string): PromoCodeRedemption[] {
    return redemptions.value.filter(r => r.reservationId === reservationId)
  }

  return {
    redemptions,
    checkCode,
    redeem,
    releaseForReservation,
    redemptionsForReservation,
    scopedListings,
    listingsRejectingCode,
    grantsAtListing,
  }
}
