import type { WebsiteRuleSet, WebsiteWindowDiscount } from '~/components/channels/data/website-channel'
import type { PromoCode } from '~/components/promo-code/data/promo-codes'
import { websiteChannel } from '~/components/channels/data/website-channel'
import { promoCodes as globalPromoCodes } from '~/components/promo-code/data/promo-codes'

export type BookingWidgetMode = 'single' | 'multi'

export interface ToggleableAmount {
  mode: 'currency' | 'percent'
  value: number
}

export interface LengthOfStayDiscountTier {
  id: string
  minNights: number
  discountType: '%' | 'fixed'
  value: number
}

export interface SeasonalCondition {
  id: string
  startDate: string
  endDate: string
  arrivalDays: number[]
  departureDays: number[]
}

export type ContactFieldSetting = 'required' | 'optional' | 'hidden'

export interface ContactFields {
  firstName: ContactFieldSetting
  lastName: ContactFieldSetting
  email: ContactFieldSetting
  phone: ContactFieldSetting
  country: ContactFieldSetting
  address: ContactFieldSetting
  notes: ContactFieldSetting
  arrivalTime: ContactFieldSetting
}

export interface BookingWidgetConfig {
  id: string
  name: string
  mode: BookingWidgetMode
  listingIds: string[]
  primaryListingId?: string | null
  currency?: string | null
  paymentMethods?: string[]
  defaultPaymentOption?: string | null
  requestNumberOfPersons?: string | null
  contactFields?: ContactFields | null
  contactCopy?: string | null
  legalRequirementsCopy?: string | null
  detailsCopy?: string | null
  successfullyBookedCopy?: string | null
  customStyleCopy?: string | null
  accentColor: string
  cornerRadius: number
  depositPct: number
  minDaysBeforeArrival: number
  cleaningFee?: ToggleableAmount
  prepayment?: ToggleableAmount
  extraGuestPerNight?: ToggleableAmount
  extraGuestStartAt?: number
  maxGuests?: number
  extraChildPerNight?: ToggleableAmount
  arrivalDays?: number[]
  departureDays?: number[]
  seasonalConditions?: SeasonalCondition[]
  lengthOfStayDiscounts?: LengthOfStayDiscountTier[]
  /**
   * Website channel rule set whose booking rules replace the widget's own:
   * length of stay discounts, early bird / last minute, min / max stay,
   * booking notice, arrival / departure days and prepayment. null = the
   * widget's own. See `resolveWidgetBookingRules`.
   */
  websiteRuleSetId?: string | null
  allowedDomains: string[]
  promoCodeIds: string[]
  status?: 'active' | 'inactive'
  embedVersion: 'v1'
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
}

export const bookingWidgets = ref<BookingWidgetConfig[]>([
  {
    id: 'bk-widget-1',
    name: 'Canggu Portfolio Widget',
    mode: 'multi',
    listingIds: ['lst-1', 'lst-3', 'lst-4'],
    primaryListingId: null,
    accentColor: '#C8A84B',
    cornerRadius: 14,
    depositPct: 30,
    minDaysBeforeArrival: 2,
    cleaningFee: { mode: 'currency', value: 120 },
    prepayment: { mode: 'percent', value: 50 },
    extraGuestPerNight: { mode: 'currency', value: 25 },
    extraGuestStartAt: 3,
    maxGuests: 4,
    extraChildPerNight: { mode: 'currency', value: 0 },
    seasonalConditions: [
      { id: 'sc-1', startDate: '2026-06-01', endDate: '2026-09-30', arrivalDays: [1, 2, 3, 4, 5], departureDays: [5, 6, 0] },
    ],
    lengthOfStayDiscounts: [
      { id: 'lod-1', minNights: 7, discountType: '%', value: 10 },
      { id: 'lod-2', minNights: 14, discountType: '%', value: 15 },
    ],
    requestNumberOfPersons: 'Request separately adults and children',
    contactFields: {
      firstName: 'required',
      lastName: 'required',
      email: 'required',
      phone: 'optional',
      country: 'optional',
      address: 'optional',
      notes: 'optional',
      arrivalTime: 'optional',
    },
    allowedDomains: ['partner-bali.com', '*.agency.com'],
    promoCodeIds: ['promo-welcome10'],
    status: 'active',
    embedVersion: 'v1',
    utmSource: 'partner-bali',
    utmMedium: 'partner-site',
    utmCampaign: 'summer-2026',
  },
])

/** The rule set a widget follows: only while the channel is added and the set still exists. */
export function widgetRuleSet(widget: Pick<BookingWidgetConfig, 'websiteRuleSetId'>): WebsiteRuleSet | null {
  const state = websiteChannel.value
  if (!widget.websiteRuleSetId || !state.enabled)
    return null
  return state.ruleSets.find(r => r.id === widget.websiteRuleSetId) ?? null
}

export interface WidgetBookingRules {
  /** Name of the Website rule set the rules come from; null = the widget's own. */
  ruleSetName: string | null
  lengthOfStayDiscounts: LengthOfStayDiscountTier[]
  earlyBird: WebsiteWindowDiscount | null
  lastMinute: WebsiteWindowDiscount | null
  minNights: number | null
  maxNights: number | null
  minDaysBeforeArrival: number
  arrivalDays: number[] | null
  departureDays: number[] | null
  prepayment: ToggleableAmount | null
}

/**
 * The booking rules a widget applies. A picked Website rule set replaces the
 * widget's own wholesale (seasonal arrival rules stay the widget's); once the
 * set is deleted or the channel removed, the widget's own come back.
 */
export function resolveWidgetBookingRules(widget: Partial<Pick<BookingWidgetConfig, 'websiteRuleSetId' | 'lengthOfStayDiscounts' | 'minDaysBeforeArrival' | 'arrivalDays' | 'departureDays' | 'prepayment'>>): WidgetBookingRules {
  const set = widgetRuleSet(widget)
  if (set) {
    return {
      ruleSetName: set.name,
      lengthOfStayDiscounts: set.lengthOfStayDiscounts.map(t => ({ id: t.id, minNights: t.minNights, discountType: '%', value: t.pct })),
      earlyBird: set.earlyBird.enabled ? { ...set.earlyBird } : null,
      lastMinute: set.lastMinute.enabled ? { ...set.lastMinute } : null,
      minNights: set.minNights,
      maxNights: set.maxNights,
      minDaysBeforeArrival: set.minDaysBeforeArrival,
      arrivalDays: set.arrivalDays.length ? [...set.arrivalDays] : null,
      departureDays: set.departureDays.length ? [...set.departureDays] : null,
      prepayment: { mode: 'percent', value: set.prepaymentPct },
    }
  }
  return {
    ruleSetName: null,
    lengthOfStayDiscounts: widget.lengthOfStayDiscounts ?? [],
    earlyBird: null,
    lastMinute: null,
    minNights: null,
    maxNights: null,
    minDaysBeforeArrival: widget.minDaysBeforeArrival ?? 0,
    arrivalDays: widget.arrivalDays ?? null,
    departureDays: widget.departureDays ?? null,
    prepayment: widget.prepayment ?? null,
  }
}

/** The length of stay tiers a widget applies (see `resolveWidgetBookingRules`). */
export function resolveWidgetStayDiscounts(widget: Pick<BookingWidgetConfig, 'lengthOfStayDiscounts' | 'websiteRuleSetId'>): LengthOfStayDiscountTier[] {
  return resolveWidgetBookingRules(widget).lengthOfStayDiscounts
}

export function resolveWidgetPromoCodes(widget: BookingWidgetConfig): PromoCode[] {
  if (!widget.promoCodeIds?.length)
    return []
  return globalPromoCodes.value.filter(p => widget.promoCodeIds.includes(p.id))
}

// Shape consumed by <BookingWidgetPreview>. The embed preview builder
// returns this shape; raw BookingWidgetConfig is also accepted (with
// promoCodeIds resolved into promoCodes via resolveWidgetPromoCodes).
export interface BookingWidgetEmbedPreview {
  id: string
  name: string
  title: string
  mode: BookingWidgetMode
  listingIds: string[]
  primaryListingId: string | null
  listingLabel: string
  currency: string
  paymentMethods: string[]
  defaultPaymentOption: string | null
  requestNumberOfPersons: string | null
  contactFields: any
  contactCopy: string | null
  legalRequirementsCopy: string | null
  detailsCopy: string | null
  successfullyBookedCopy: string | null
  customStyleCopy: string | null
  accentColor: string
  cornerRadius: number
  depositPct: number
  minDaysBeforeArrival: number
  cleaningFee: any
  prepayment: any
  extraGuestPerNight: any
  extraGuestStartAt: number | null
  maxGuests: number | null
  extraChildPerNight: any
  arrivalDays: number[] | null
  departureDays: number[] | null
  seasonalConditions: any
  lengthOfStayDiscounts: any
  /** Website rule set the booking rules come from, null = the widget's own. */
  websiteRuleSetName: string | null
  minNights: number | null
  maxNights: number | null
  earlyBird: WebsiteWindowDiscount | null
  lastMinute: WebsiteWindowDiscount | null
  allowedDomains: string[]
  promoCodes: PromoCode[]
  status: string | null
  embedVersion: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

export function useBookingWidgets() {
  function getWidgetById(id: string) {
    return bookingWidgets.value.find(widget => widget.id === id) ?? null
  }

  function buildEmbedPreview(widget: BookingWidgetConfig): BookingWidgetEmbedPreview {
    const rules = resolveWidgetBookingRules(widget)
    const listingLabel = widget.mode === 'single'
      ? `Listing ${widget.primaryListingId ?? widget.listingIds[0] ?? 'none'}`
      : `${widget.listingIds.length} listings`

    return {
      id: widget.id,
      name: widget.name,
      title: widget.name,
      mode: widget.mode,
      listingIds: [...widget.listingIds],
      primaryListingId: widget.primaryListingId ?? null,
      listingLabel,
      currency: widget.currency ?? 'EUR',
      paymentMethods: widget.paymentMethods ?? [],
      defaultPaymentOption: widget.defaultPaymentOption ?? null,
      requestNumberOfPersons: widget.requestNumberOfPersons ?? null,
      contactFields: widget.contactFields ?? null,
      contactCopy: widget.contactCopy ?? null,
      legalRequirementsCopy: widget.legalRequirementsCopy ?? null,
      detailsCopy: widget.detailsCopy ?? null,
      successfullyBookedCopy: widget.successfullyBookedCopy ?? null,
      customStyleCopy: widget.customStyleCopy ?? null,
      accentColor: widget.accentColor,
      cornerRadius: widget.cornerRadius,
      depositPct: widget.depositPct,
      minDaysBeforeArrival: rules.minDaysBeforeArrival,
      cleaningFee: widget.cleaningFee ?? null,
      prepayment: rules.prepayment,
      extraGuestPerNight: widget.extraGuestPerNight ?? null,
      extraGuestStartAt: widget.extraGuestStartAt ?? null,
      maxGuests: widget.maxGuests ?? null,
      extraChildPerNight: widget.extraChildPerNight ?? null,
      arrivalDays: rules.arrivalDays,
      departureDays: rules.departureDays,
      seasonalConditions: widget.seasonalConditions ?? null,
      lengthOfStayDiscounts: rules.lengthOfStayDiscounts,
      websiteRuleSetName: rules.ruleSetName,
      minNights: rules.minNights,
      maxNights: rules.maxNights,
      earlyBird: rules.earlyBird,
      lastMinute: rules.lastMinute,
      allowedDomains: widget.allowedDomains,
      promoCodes: resolveWidgetPromoCodes(widget),
      status: widget.status ?? null,
      embedVersion: widget.embedVersion,
      utmSource: widget.utmSource ?? null,
      utmMedium: widget.utmMedium ?? null,
      utmCampaign: widget.utmCampaign ?? null,
    }
  }

  function copyEmbedSnippet(widget: BookingWidgetConfig) {
    const listingAttr = widget.mode === 'single'
      ? `data-listing="${widget.primaryListingId ?? widget.listingIds[0] ?? ''}"`
      : `data-listings="${widget.listingIds.join(',')}"`

    const utmAttrs = [widget.utmSource ? `data-utm-source="${widget.utmSource}"` : '', widget.utmMedium ? `data-utm-medium="${widget.utmMedium}"` : '', widget.utmCampaign ? `data-utm-campaign="${widget.utmCampaign}"` : '']
      .filter(Boolean)
      .join(' ')

    return [
      `<script async src="https://booking.elev8-suite.com/v1/elev8-booking.js"></script>`,
      `<div class="e8bk-root" ${listingAttr} data-widget-id="${widget.id}" ${utmAttrs}></div>`,
    ].join('\n')
  }

  function getSnippetForForm(widget: BookingWidgetConfig) {
    return copyEmbedSnippet({
      ...widget,
      allowedDomains: widget.allowedDomains ?? [],
      promoCodeIds: widget.promoCodeIds ?? [],
      paymentMethods: widget.paymentMethods ?? [],
    })
  }

  return { bookingWidgets, getWidgetById, buildEmbedPreview, copyEmbedSnippet, getSnippetForForm }
}

export function buildEmbedPreview(widget: BookingWidgetConfig) {
  return useBookingWidgets().buildEmbedPreview(widget)
}

export function getSnippetForForm(widget: BookingWidgetConfig) {
  return useBookingWidgets().getSnippetForForm(widget)
}
