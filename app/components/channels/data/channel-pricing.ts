/**
 * What a listing sends to the channels about price, edited in its Pricing tab:
 * which rate plans sell where, channel promotions, and a price adjustment per
 * channel. Shaped like NextPax: `rate-plans` (`supplierRateplanCode`,
 * `applicableChannels`), `promotions` (scoped to the listing as
 * `applicableProperties`) and the rate / fee multipliers. Pure.
 */
import type { Listing, RatePlan } from '~/components/listings/data/listings'

// ── Rate plans ─────────────────────────────────────────────────────────────

/** Every rate plan of every room type of the listing. */
export function listingRatePlans(listing: Listing): RatePlan[] {
  return (listing.unitTypes ?? []).flatMap(t => t.pricing.ratePlans)
}

/** An empty list means the plan sells on every channel. */
export const sellsOn = (plan: RatePlan, channel: string) => !plan.channels?.length || plan.channels.includes(channel)

/** The code NextPax knows the plan by. Older plans with none fall back to their id. */
export const ratePlanCode = (plan: RatePlan) => plan.code ?? plan.id

/** The listing's rate plans that sell on a channel, for pairing with the channel's own plans. */
export function channelRatePlans(listing: Listing, channel: string): { code: string, name: string }[] {
  return listingRatePlans(listing).filter(p => sellsOn(p, channel)).map(p => ({ code: ratePlanCode(p), name: p.title || p.name }))
}

/** The next free `RP0001`-style code across every listing, since NextPax codes are unique per account. */
export function nextRatePlanCode(all: Listing[]): string {
  const used = all.flatMap(listingRatePlans).map(p => p.code ?? '').filter(c => /^RP\d+$/.test(c)).map(c => Number(c.slice(2)))
  return `RP${String(Math.max(0, ...used) + 1).padStart(4, '0')}`
}

/** "All channels", or the channels by name. */
export const ratePlanChannelsLabel = (plan: RatePlan) => plan.channels?.length ? plan.channels.join(', ') : 'All channels'

// ── Promotions ─────────────────────────────────────────────────────────────

/** NextPax sends promotions to these channels only. */
export const PROMOTION_CHANNELS = ['Airbnb', 'Booking.com', 'Expedia', 'Vrbo']

export type PromotionType = 'early_bird' | 'last_minute' | 'basic'

export const PROMOTION_TYPES: { value: PromotionType, label: string, hint: string }[] = [
  { value: 'early_bird', label: 'Early bird', hint: 'For guests who book well ahead' },
  { value: 'last_minute', label: 'Last minute', hint: 'For stays starting soon' },
  { value: 'basic', label: 'Basic deal', hint: 'For any booking in the stay dates' },
]

export interface ChannelPromotion {
  id: string
  name: string
  type: PromotionType
  discountType: 'percent' | 'amount'
  /** Percent off, or an amount off in the listing's currency. */
  amount: number
  /** What the discount comes off: the nightly rent, or the whole stay with fees. */
  target: 'rent' | 'total'
  channels: string[]
  /** Early bird: booked at least this many days before arrival. Last minute: at most this many. */
  daysBeforeArrival: number | null
  /** Stay dates the promotion covers, `YYYY-MM-DD`. Null = open. */
  stayFrom: string | null
  stayUntil: string | null
  minNights: number | null
  maxNights: number | null
  active: boolean
}

export function newPromotion(): ChannelPromotion {
  return {
    id: `promo-${Date.now().toString(36)}`,
    name: '',
    type: 'early_bird',
    discountType: 'percent',
    amount: 10,
    target: 'rent',
    channels: [...PROMOTION_CHANNELS],
    daysBeforeArrival: 30,
    stayFrom: null,
    stayUntil: null,
    minNights: null,
    maxNights: null,
    active: true,
  }
}

export function listingChannelPromotions(listing: Listing): ChannelPromotion[] {
  return listing.channelPromotions ?? []
}

/** What stops the promotion from saving, in the host's words. Empty when it can be saved. */
export function promotionIssues(p: ChannelPromotion): string[] {
  const issues: string[] = []
  if (!p.name.trim())
    issues.push('Give it a name')
  if (p.channels.length === 0)
    issues.push('Pick at least one channel')
  if (!(p.amount > 0))
    issues.push('Set a discount above 0')
  else if (p.discountType === 'percent' && p.amount >= 100)
    issues.push('A percent discount must stay under 100%')
  if (p.type !== 'basic' && (p.daysBeforeArrival === null || p.daysBeforeArrival < (p.type === 'early_bird' ? 1 : 0)))
    issues.push(p.type === 'early_bird' ? 'Set how many days ahead guests book' : 'Set how many days before arrival')
  if (p.stayFrom && p.stayUntil && p.stayFrom > p.stayUntil)
    issues.push('The stay dates end before they start')
  if (p.minNights !== null && p.maxNights !== null && p.minNights > p.maxNights)
    issues.push('Minimum nights is above maximum nights')
  return issues
}

/** "15% off · booked 30+ days ahead · 3+ nights". The currency is the listing's, written as its code. */
export function promotionSummary(p: ChannelPromotion, currency: string): string {
  const off = p.discountType === 'percent' ? `${p.amount}% off` : `${currency} ${p.amount} off`
  const parts = [p.target === 'total' ? `${off} the total` : off]
  if (p.type === 'early_bird' && p.daysBeforeArrival !== null)
    parts.push(`booked ${p.daysBeforeArrival}+ days ahead`)
  if (p.type === 'last_minute' && p.daysBeforeArrival !== null)
    parts.push(`booked within ${p.daysBeforeArrival} days of arrival`)
  if (p.minNights !== null || p.maxNights !== null)
    parts.push(p.maxNights === null ? `${p.minNights}+ nights` : `${p.minNights ?? 1} to ${p.maxNights} nights`)
  if (p.stayFrom || p.stayUntil)
    parts.push(`stays ${p.stayFrom ?? 'now'} to ${p.stayUntil ?? 'open'}`)
  return parts.join(' · ')
}

/** Copies for another listing: fresh ids, so editing one never edits the other. */
export function copyPromotions(promotions: ChannelPromotion[], salt: string): ChannelPromotion[] {
  return promotions.map((p, i) => ({ ...p, channels: [...p.channels], id: `promo-${salt}-${i}-${Date.now().toString(36)}` }))
}

// ── Price adjustments ──────────────────────────────────────────────────────

/** Percent added to the price a channel receives: `rate` on the nightly rate, `fee` on fees. 15 = +15%, -5 = -5%. */
export interface ChannelAdjustment {
  rate: number
  fee: number
}

export function listingChannelAdjustments(listing: Listing): Record<string, ChannelAdjustment> {
  return listing.channelAdjustments ?? {}
}

export const adjustmentFor = (listing: Listing, channel: string): ChannelAdjustment => listingChannelAdjustments(listing)[channel] ?? { rate: 0, fee: 0 }

/** A channel cannot be sent a price at or below zero. */
export const isValidAdjustment = (pct: number) => Number.isFinite(pct) && pct > -100 && pct <= 500

/** The amount a channel receives, rounded to cents. */
export const adjustedAmount = (amount: number, pct: number) => Math.round(amount * (1 + pct / 100) * 100) / 100
