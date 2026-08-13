import { ref } from 'vue'

export type PromoCodeDiscountType = '%' | 'fixed' | 'free_upsell'

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

// A single date range — both ends are nullable so users can specify
// only a start, only an end, both, or neither (always open).
export interface PromoCodeWindow {
  from: string | null
  until: string | null
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
// Empty list = not expired.
function areAllWindowsExpired(windows: PromoCodeWindow[] | undefined, now: Date): boolean {
  if (!windows || windows.length === 0)
    return false
  return windows.every((w) => {
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
  if (code.discountType === '%')
    return `${code.value}%`
  if (code.discountType === 'free_upsell')
    return 'Free Upsell'
  return `${code.value}`
}

export function getPromoCodeTypeLabel(code: PromoCode): string {
  if (code.discountType === '%')
    return 'Percentage'
  if (code.discountType === 'fixed')
    return 'Fixed amount'
  return 'Free Upsell'
}

function fmt(iso: string | null | undefined): string {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleDateString()
}

// Format a single window for display. Used by Detail + Table cells.
export function formatPromoWindow(window: PromoCodeWindow): string {
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
