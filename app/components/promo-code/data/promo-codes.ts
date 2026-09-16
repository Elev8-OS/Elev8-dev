import { ref } from 'vue'

export type PromoCodeDiscountType = '%' | 'fixed' | 'tiered' | 'free_upsell'

export type PromoCodeStatus = 'active' | 'inactive' | 'expired'

// Channels where the promo code can be redeemed. Today the product
// surfaces two redemption surfaces: booking widgets (embedded JS) and
// standalone websites built with the Website Builder. A promo code is
// limited to ONE of these (or unrestricted).
export type PromoCodeChannel = 'widget' | 'website'

// Restrict where the promo code can be redeemed.
//
// Every promo code is pinned to ONE channel — there is no "apply to
// every surface" state. When `channel === 'website'`, `websiteIds`
// narrows the code to specific websites; empty `websiteIds` with
// channel === 'website' means the code applies to every website.
// `widget` doesn't carry per-widget IDs here — per-widget linking is
// already captured by `WidgetPromoCodeLink` (the per-widget multi-select
// in the widget config). The two mechanisms are complementary: this
// field restricts *which channel* the code is eligible to appear on,
// the widget link indicates *which widgets* currently include it.
export interface PromoCodeChannelRestriction {
  channel: PromoCodeChannel
  websiteIds: string[]
}

export type PromoCodeWindowType = 'fixed' | 'dynamic'

// A single validity window. Can be a fixed calendar date range ('fixed')
// or a rolling dynamic duration from today/now ('dynamic', e.g. next 7 days).
export interface PromoCodeWindow {
  type?: PromoCodeWindowType
  // For 'fixed' window:
  from: string | null
  until: string | null
  // For 'dynamic' window: rolling number of days from today (e.g. 7 for next 7 days)
  days?: number | null
}

export interface PromoCodeLengthOfStayTier {
  id: string
  minNights: number
  discountType: '%' | 'fixed'
  value: number
}

export interface PromoCode {
  id: string
  code: string
  description?: string
  discountType: PromoCodeDiscountType
  value: number
  currency?: string | null
  active: boolean
  // Booking windows — date ranges during which a guest may CREATE a
  // reservation that uses this code. Empty array = no booking-time
  // constraint. The code is bookable when NOW falls inside ANY window.
  bookingWindows?: PromoCodeWindow[]
  // Stay windows — check-in date ranges that this code applies to.
  // Empty array = no stay-date constraint. The code applies to stays
  // whose check-in date falls inside ANY window.
  stayWindows?: PromoCodeWindow[]
  // Length of stay constraints in nights.
  // null or undefined = no constraint.
  lengthOfStayMin?: number | null
  lengthOfStayMax?: number | null
  /** Tiered length of stay discounts (e.g. 10 nights -> 10%, 20 nights -> 20%) */
  lengthOfStayTiers?: PromoCodeLengthOfStayTier[]
  /** @deprecated Use lengthOfStayMin instead */
  minStay?: number | null
  usageLimit?: number | null
  redemptionCount: number
  createdAt: string
  updatedAt: string
  // Present when this promo code backs a Platform Console pricing override.
  // Joins the code to its PricingOverride record.
  internalOverrideId?: string
  // Free Upsell discount type — IDs of UpsellItem records (nested under an
  // UpsellService) that the guest gets at no charge when redeeming this
  // code. Items are the unit of redemption: a service may contain multiple
  // items (e.g. Spa has 60min / 90min / Body Scrub) and the operator picks
  // which items are free. `value` is unused in this mode.
  freeUpsellItemIds?: string[]
  // Listings the promo code applies to. Empty = applies to all listings.
  listingIds?: string[]
  // Channel restriction (widget / website). See `PromoCodeChannelRestriction`.
  channelRestriction?: PromoCodeChannelRestriction
}

// Analytics scaffold — per-usage-site counter.
// Tracks which widget or website (later) a promo code is attached to,
// plus per-source redemption counts for future analytics breakdown.
export interface WidgetPromoCodeLink {
  promoCodeId: string
  source: 'widget' | 'website'
  sourceId: string
  usageCount: number
  addedAt: string
}

export const promoCodes = ref<PromoCode[]>([
  {
    id: 'promo-welcome10',
    code: 'WELCOME10',
    description: 'Welcome discount for new guests',
    discountType: '%',
    value: 10,
    currency: null,
    active: true,
    bookingWindows: [],
    stayWindows: [],
    lengthOfStayMin: null,
    lengthOfStayMax: null,
    usageLimit: null,
    redemptionCount: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    // WELCOME10 was originally wired into a widget (see the seeded
    // WidgetPromoCodeLink), so it stays pinned to the widget channel.
    channelRestriction: { channel: 'widget', websiteIds: [] },
  },
  {
    id: 'promo-freespa',
    code: 'FREESPA',
    description: 'Free in-villa spa treatment for direct bookings',
    discountType: 'free_upsell',
    value: 0,
    currency: null,
    active: true,
    bookingWindows: [
      { from: '2026-02-10T00:00:00Z', until: '2026-12-31T00:00:00Z' },
    ],
    stayWindows: [
      { from: '2026-06-01T00:00:00Z', until: '2026-09-30T00:00:00Z' },
    ],
    lengthOfStayMin: 3,
    lengthOfStayMax: null,
    usageLimit: 50,
    redemptionCount: 0,
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
    freeUpsellItemIds: ['itm-003a', 'itm-003b'],
    listingIds: ['lst-1', 'lst-4'],
    // Restricted to the website channel only — FREESPA is a direct
    // booking perk, not a widget promotion.
    channelRestriction: { channel: 'website', websiteIds: [] },
  },
])

export const widgetPromoCodeLinks = ref<WidgetPromoCodeLink[]>([
  {
    promoCodeId: 'promo-welcome10',
    source: 'widget',
    sourceId: 'bk-widget-1',
    usageCount: 3,
    addedAt: '2026-01-01T00:00:00Z',
  },
])

export function generatePromoId(): string {
  return `promo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// True when `now` falls inside the window. A window with both ends null
// is treated as "always open" (matches an unbounded window).
function isWindowOpenAt(window: PromoCodeWindow, now: Date): boolean {
  if (window.type === 'dynamic') {
    return Boolean(window.days && window.days > 0)
  }
  if (window.from && new Date(window.from).getTime() > now.getTime())
    return false
  if (window.until && new Date(window.until).getTime() < now.getTime())
    return false
  return true
}

// True when ANY window in the list is currently open. Empty list = no
// constraint (treat as "any time is OK").
function isAnyWindowOpen(windows: PromoCodeWindow[] | undefined, now: Date): boolean {
  if (!windows || windows.length === 0)
    return true
  return windows.some(w => isWindowOpenAt(w, now))
}

// True when EVERY window has already ended (i.e. ALL untils are in the past).
// Dynamic windows roll from today and therefore never expire.
// Empty list = not expired.
function areAllWindowsExpired(windows: PromoCodeWindow[] | undefined, now: Date): boolean {
  if (!windows || windows.length === 0)
    return false
  return windows.every((w) => {
    if (w.type === 'dynamic')
      return false
    if (!w.until)
      return false
    return new Date(w.until).getTime() < now.getTime()
  })
}

// Back-compat aliases — kept so callers that import the old names still work.
export function isPromoCodeExpired(code: PromoCode, now: Date = new Date()): boolean {
  return areAllWindowsExpired(code.bookingWindows, now)
    && areAllWindowsExpired(code.stayWindows, now)
}

export function isPromoCodeStarted(code: PromoCode, now: Date = new Date()): boolean {
  // Started = at least one booking window is open AND at least one stay
  // window is open (either may be empty = no constraint).
  const bookingOpen = isAnyWindowOpen(code.bookingWindows, now)
  const stayOpen = isAnyWindowOpen(code.stayWindows, now)
  return bookingOpen && stayOpen
}

export function getPromoCodeStatus(code: PromoCode, now: Date = new Date()): PromoCodeStatus {
  if (!code.active)
    return 'inactive'
  if (isPromoCodeExpired(code, now))
    return 'expired'
  if (!isPromoCodeStarted(code, now))
    return 'inactive'
  return 'active'
}

export function formatPromoDiscount(code: PromoCode): string {
  if (code.discountType === 'tiered' || (code.lengthOfStayTiers && code.lengthOfStayTiers.length > 0)) {
    const sorted = [...(code.lengthOfStayTiers ?? [])].sort((a, b) => a.minNights - b.minNights)
    return sorted.map(t => `${t.minNights}d: ${t.value}${t.discountType === '%' ? '%' : ''}`).join(', ')
  }
  if (code.discountType === '%')
    return `${code.value}%`
  if (code.discountType === 'free_upsell')
    return 'Free Upsell'
  return `${code.value}`
}

export function getPromoCodeTypeLabel(code: PromoCode): string {
  if (code.discountType === 'tiered' || (code.lengthOfStayTiers && code.lengthOfStayTiers.length > 0))
    return 'Length of stay'
  if (code.discountType === '%')
    return 'Percentage'
  if (code.discountType === 'fixed')
    return 'Fixed amount'
  return 'Free Upsell'
}

// True when a stay of `nights` satisfies the promo code's length of stay requirement.
// Codes with no constraint (null / undefined / <= 0) are always satisfied.
export function meetsPromoCodeLengthOfStay(code: PromoCode, nights: number): boolean {
  if (code.lengthOfStayTiers && code.lengthOfStayTiers.length > 0) {
    const minTierNights = Math.min(...code.lengthOfStayTiers.map(t => t.minNights))
    if (nights < minTierNights)
      return false
    if (code.lengthOfStayMax !== null && code.lengthOfStayMax !== undefined && nights > code.lengthOfStayMax)
      return false
    return true
  }
  const min = code.lengthOfStayMin ?? code.minStay ?? null
  const max = code.lengthOfStayMax ?? null
  if (min !== null && min > 0 && nights < min)
    return false
  if (max !== null && max > 0 && nights > max)
    return false
  return true
}

/** Resolves the applicable discount for a given stay length based on promo code tiers or base rate */
export function getPromoCodeDiscountForStay(
  code: PromoCode,
  nights: number,
): { discountType: PromoCodeDiscountType, value: number } | null {
  if (!meetsPromoCodeLengthOfStay(code, nights))
    return null

  if (code.lengthOfStayTiers && code.lengthOfStayTiers.length > 0) {
    const sorted = [...code.lengthOfStayTiers].sort((a, b) => b.minNights - a.minNights)
    const matched = sorted.find(t => nights >= t.minNights)
    if (matched)
      return { discountType: matched.discountType, value: matched.value }
    return null
  }

  return { discountType: code.discountType, value: code.value }
}

/** @deprecated Use meetsPromoCodeLengthOfStay instead */
export function meetsPromoCodeMinStay(code: PromoCode, nights: number): boolean {
  return meetsPromoCodeLengthOfStay(code, nights)
}

export function formatPromoLengthOfStay(code: PromoCode): string {
  if (code.lengthOfStayTiers && code.lengthOfStayTiers.length > 0) {
    const sorted = [...code.lengthOfStayTiers].sort((a, b) => a.minNights - b.minNights)
    return sorted.map(t => `${t.minNights}+ nights (${t.value}${t.discountType === '%' ? '%' : ''})`).join(' · ')
  }
  const min = code.lengthOfStayMin ?? code.minStay ?? null
  const max = code.lengthOfStayMax ?? null
  if (min && max) {
    if (min === max)
      return `${min} night${min === 1 ? '' : 's'}`
    return `${min}–${max} nights`
  }
  if (min)
    return `Min ${min} night${min === 1 ? '' : 's'}`
  if (max)
    return `Max ${max} night${max === 1 ? '' : 's'}`
  return 'Any length'
}

/** @deprecated Use formatPromoLengthOfStay instead */
export function formatPromoMinStay(code: PromoCode): string {
  const min = code.lengthOfStayMin ?? code.minStay
  if (!min)
    return 'No minimum stay'
  return `${min} night${min === 1 ? '' : 's'}`
}

function fmt(iso: string | null | undefined): string {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleDateString()
}

// Checks if a target date (e.g. check-in date or booking date) falls within this window.
export function isDateInPromoWindow(window: PromoCodeWindow, targetDate: Date, now: Date = new Date()): boolean {
  if (window.type === 'dynamic') {
    if (!window.days || window.days <= 0)
      return true
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + window.days, 23, 59, 59, 999).getTime()
    const time = targetDate.getTime()
    return time >= start && time <= end
  }
  if (window.from && new Date(window.from).getTime() > targetDate.getTime())
    return false
  if (window.until && new Date(window.until).getTime() < targetDate.getTime())
    return false
  return true
}

// Format a single window for display. Used by Detail + Table cells.
export function formatPromoWindow(window: PromoCodeWindow): string {
  if (window.type === 'dynamic') {
    if (!window.days)
      return 'Rolling'
    return `Within ${window.days} day${window.days === 1 ? '' : 's'}`
  }
  const from = window.from
  const until = window.until
  if (from && until)
    return `${fmt(from)} → ${fmt(until)}`
  if (from)
    return `From ${fmt(from)}`
  if (until)
    return `Until ${fmt(until)}`
  return 'Always'
}

// Compact per-window prefix used inside the Table (e.g. "Book 6/1 → 8/31").
// Returns null if neither end is set (window is fully unbounded).
export function formatPromoWindowCompact(window: PromoCodeWindow): string | null {
  if (window.type === 'dynamic') {
    if (!window.days)
      return 'Rolling'
    return `Within ${window.days}d`
  }
  const f = window.from ? new Date(window.from).toLocaleDateString() : null
  const u = window.until ? new Date(window.until).toLocaleDateString() : null
  if (f && u)
    return `${f} → ${u}`
  if (f)
    return `from ${f}`
  if (u)
    return `until ${u}`
  return null
}

// Normalize a channel restriction read from the store. Every promo code
// must be pinned to a channel; if the stored value is missing (older
// data, manual draft), fall back to 'widget' which is the most common
// scroll of redemption. Callers should always go through this helper
// so they don't have to handle a missing field everywhere.
export const DEFAULT_PROMO_CODE_CHANNEL: PromoCodeChannel = 'widget'

export function getChannelRestriction(code: PromoCode): PromoCodeChannelRestriction {
  return code.channelRestriction ?? { channel: DEFAULT_PROMO_CODE_CHANNEL, websiteIds: [] }
}

// "Widget only" / "Website only" — short label used in the table.
// Every code is pinned to one channel, so there's no "All channels"
// label to render.
export function formatChannelRestrictionLabel(code: PromoCode): string {
  return getChannelRestriction(code).channel === 'widget' ? 'Widget only' : 'Website only'
}
