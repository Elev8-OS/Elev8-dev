import type { PromoCode, PromoCodeChannel } from './promo-codes'
import {
  getChannelRestriction,
  isDateInPromoWindow,
  isPromoCodeExpired,
  meetsPromoCodeLengthOfStay,
} from './promo-codes'

/**
 * What a promo code gives a guest at one listing, and whether it is accepted at all.
 *
 * Framework- and store-free: the upsell catalog is injected, so the same rules run in
 * the detail dialog's preview, in `usePromoRedemption` and in the specs.
 *
 * ⚠️ **A free-upsell code resolves per listing, not per code.** The code stores a flat
 * list of item ids, which may span several services that are the same thing offered in
 * different regions (Floating Breakfast North / South). A guest only gets the items whose
 * service is offered at THEIR listing. A listing where none of them is offered rejects
 * the code, the same way a listing outside the code's scope does.
 */

/** Minimal upsell service shape this module needs. */
export interface RedemptionUpsellService {
  id: string
  name: string
  category: string
  currency: string
  status: 'active' | 'inactive'
  availability: 'always' | 'by_request'
  /** Listing NAMES, the way the upsell catalog stores them. */
  assignedListings: string[]
  items: { id: string, name: string, price: number }[]
}

export interface FreeUpsellChoice {
  id: string
  name: string
  /** Catalog price, kept so the order can record what was given away. */
  price: number
}

/**
 * One service a guest gets for free at a listing. With more than one choice the guest
 * picks one: a code gives one item per service, never every item in it.
 */
export interface FreeUpsellGrant {
  serviceId: string
  serviceName: string
  serviceCategory: string
  currency: string
  availability: 'always' | 'by_request'
  choices: FreeUpsellChoice[]
}

/**
 * The free upsells a code's items give at one listing: every picked item whose service is
 * active and offered there, grouped by service. Inactive services give nothing, even if
 * their items are still on the code.
 */
export function freeUpsellGrantsForListing(
  itemIds: string[],
  services: RedemptionUpsellService[],
  listingName: string,
): FreeUpsellGrant[] {
  const picked = new Set(itemIds)
  const grants: FreeUpsellGrant[] = []
  for (const service of services) {
    if (service.status !== 'active' || !service.assignedListings.includes(listingName))
      continue
    const choices = service.items
      .filter(item => picked.has(item.id))
      .map(item => ({ id: item.id, name: item.name, price: item.price }))
    if (choices.length === 0)
      continue
    grants.push({
      serviceId: service.id,
      serviceName: service.name,
      serviceCategory: service.category,
      currency: service.currency,
      availability: service.availability,
      choices,
    })
  }
  return grants
}

/**
 * Scoped listings where the code's items give nothing, so the code is rejected there.
 * Judged on every picked service together: North + South breakfasts covering the whole
 * portfolio between them leaves nothing out, even though neither does alone.
 */
export function listingsWithoutFreeUpsell(
  itemIds: string[],
  services: RedemptionUpsellService[],
  scopedListingNames: string[],
): string[] {
  return scopedListingNames.filter(name => freeUpsellGrantsForListing(itemIds, services, name).length === 0)
}

export interface PromoRedemptionRequest {
  listingId: string
  listingName: string
  /** Where the guest typed the code. */
  channel: PromoCodeChannel
  websiteId?: string | null
  /** Local `YYYY-MM-DD`. */
  checkIn: string
  checkOut: string
}

export type PromoRejectionReason
  = | 'unknown'
    | 'inactive'
    | 'expired'
    | 'usage_limit'
    | 'channel'
    | 'listing'
    | 'booking_window'
    | 'stay_window'
    | 'length_of_stay'
    | 'no_free_upsell'
    | 'already_redeemed'
    | 'choice_required'

export interface PromoRejection {
  ok: false
  reason: PromoRejectionReason
  message: string
}

export type PromoEvaluation
  = | { ok: true, grants: FreeUpsellGrant[] }
    | PromoRejection

/** What the guest is told. Listing and upsell mismatches read the same on purpose. */
export const PROMO_REJECTION_MESSAGES: Record<PromoRejectionReason, string> = {
  unknown: 'This promo code does not exist.',
  inactive: 'This promo code is not active.',
  expired: 'This promo code has expired.',
  usage_limit: 'This promo code has reached its usage limit.',
  channel: 'This promo code cannot be used here.',
  listing: 'This promo code is not valid for this property.',
  booking_window: 'This promo code cannot be used for bookings made today.',
  stay_window: 'This promo code is not valid for these dates.',
  length_of_stay: 'This promo code is not valid for this length of stay.',
  no_free_upsell: 'This promo code is not valid for this property.',
  already_redeemed: 'This promo code has already been used on this booking.',
  choice_required: 'Choose which free item you would like.',
}

export function rejectPromo(reason: PromoRejectionReason): PromoRejection {
  return { ok: false, reason, message: PROMO_REJECTION_MESSAGES[reason] }
}

/** Local midnight for a `YYYY-MM-DD` string (never `new Date(str)`, which is UTC). */
export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = parseLocalDate(checkOut).getTime() - parseLocalDate(checkIn).getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}

/**
 * Why the code is rejected for every guest right now, whatever the stay, or `null`.
 * Same rules as `getPromoCodeStatus`, plus the usage limit, but with a reason per case so
 * the guest hears which one. The stay window is checked later, against the check-in date.
 */
export function codeWideRejection(code: PromoCode, now: Date = new Date()): PromoRejection | null {
  if (!code.active)
    return rejectPromo('inactive')
  if (isPromoCodeExpired(code, now))
    return rejectPromo('expired')
  if (code.usageLimit && code.redemptionCount >= code.usageLimit)
    return rejectPromo('usage_limit')
  const bookingWindows = code.bookingWindows ?? []
  if (bookingWindows.length > 0 && !bookingWindows.some(w => isDateInPromoWindow(w, now, now)))
    return rejectPromo('booking_window')
  return null
}

/**
 * Whether a guest may use this code on this stay, and for a free-upsell code, what they get.
 * Checks run cheapest and most general first, so the guest hears the real reason.
 */
export function evaluatePromoCode(
  code: PromoCode,
  request: PromoRedemptionRequest,
  services: RedemptionUpsellService[],
  now: Date = new Date(),
): PromoEvaluation {
  const codeWide = codeWideRejection(code, now)
  if (codeWide)
    return codeWide

  const restriction = getChannelRestriction(code)
  if (restriction.channel !== request.channel)
    return rejectPromo('channel')
  if (restriction.channel === 'website' && restriction.websiteIds.length > 0
    && (!request.websiteId || !restriction.websiteIds.includes(request.websiteId))) {
    return rejectPromo('channel')
  }

  if (code.listingIds && code.listingIds.length > 0 && !code.listingIds.includes(request.listingId))
    return rejectPromo('listing')

  const stayWindows = code.stayWindows ?? []
  const checkIn = parseLocalDate(request.checkIn)
  if (stayWindows.length > 0 && !stayWindows.some(w => isDateInPromoWindow(w, checkIn, now)))
    return rejectPromo('stay_window')

  if (!meetsPromoCodeLengthOfStay(code, nightsBetween(request.checkIn, request.checkOut)))
    return rejectPromo('length_of_stay')

  if (code.discountType !== 'free_upsell')
    return { ok: true, grants: [] }

  const grants = freeUpsellGrantsForListing(code.freeUpsellItemIds ?? [], services, request.listingName)
  if (grants.length === 0)
    return rejectPromo('no_free_upsell')
  return { ok: true, grants }
}

export interface FreeUpsellPick {
  grant: FreeUpsellGrant
  item: FreeUpsellChoice
}

/**
 * One item per granted service. A service with a single choice needs no answer; one with
 * several needs the guest's pick in `choices` (service id → item id).
 */
export function resolveFreeUpsellPicks(
  grants: FreeUpsellGrant[],
  choices: Record<string, string> = {},
): { ok: true, picks: FreeUpsellPick[] } | { ok: false, missingServiceIds: string[] } {
  const picks: FreeUpsellPick[] = []
  const missing: string[] = []
  for (const grant of grants) {
    const item = grant.choices.length === 1
      ? grant.choices[0]
      : grant.choices.find(c => c.id === choices[grant.serviceId])
    if (item)
      picks.push({ grant, item })
    else
      missing.push(grant.serviceId)
  }
  return missing.length > 0 ? { ok: false, missingServiceIds: missing } : { ok: true, picks }
}
