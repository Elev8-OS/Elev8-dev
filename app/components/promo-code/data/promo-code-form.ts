import type {
  PromoCode,
  PromoCodeChannel,
  PromoCodeDiscountType,
  PromoCodeWindow,
} from './promo-codes'

/**
 * Shape of the create/edit form while the host is filling it in.
 *
 * Deliberately flatter than `PromoCode`: every field is required and
 * non-nullable where the inputs need a concrete value, so neither surface has
 * to guard on `?? ''` in a template. `channel` / `websiteIds` are hoisted out
 * of `channelRestriction` because the two are edited by separate controls.
 *
 * Framework-free on purpose — the dialogs own the reactive state and call in.
 */
export interface PromoCodeFormDraft {
  code: string
  description: string
  discountType: PromoCodeDiscountType
  value: number
  currency: string
  bookingWindows: PromoCodeWindow[]
  stayWindows: PromoCodeWindow[]
  usageLimit: number | null
  active: boolean
  freeUpsellItemIds: string[]
  listingIds: string[]
  channel: PromoCodeChannel
  websiteIds: string[]
}

export const PROMO_CODE_CURRENCIES = ['USD', 'EUR', 'GBP', 'IDR', 'CHF', 'AUD', 'JPY']

export type PromoCodeStepId = 'basics' | 'scope' | 'discount' | 'rules'

export interface PromoCodeStep {
  id: PromoCodeStepId
  title: string
  /** Shown under the step heading — says what the step decides, not what it is. */
  description: string
  icon: string
}

/**
 * One decision per step: what the code is called, where it works, what it
 * gives away, and how long it lasts. The last step carries the review block,
 * so nothing is created without a final look.
 *
 * ⚠️ **Scope before discount is load-bearing, not cosmetic.** An upsell
 * service is only offered at the properties it is assigned to, so the listings
 * decide which upsells a code can even offer — and likewise which websites
 * can carry it. Listings are the free variable everything else hangs off; ask
 * for them first and every later list can be filtered honestly.
 */
export const PROMO_CODE_STEPS: PromoCodeStep[] = [
  {
    id: 'basics',
    title: 'Code',
    description: 'The code guests type at checkout, and a note for your team.',
    icon: 'lucide:ticket',
  },
  {
    id: 'scope',
    title: 'Where it works',
    description: 'The listings this code covers, and the channel guests redeem it on.',
    icon: 'lucide:map-pin',
  },
  {
    id: 'discount',
    title: 'Discount',
    description: 'What the guest gets. Free upsells are limited to what those listings offer.',
    icon: 'lucide:percent',
  },
  {
    id: 'rules',
    title: 'Limits',
    description: 'How long the code runs and how often it can be used.',
    icon: 'lucide:calendar-clock',
  },
]

export function createDefaultPromoCodeFormDraft(): PromoCodeFormDraft {
  return {
    code: '',
    description: '',
    discountType: '%',
    value: 10,
    currency: 'USD',
    bookingWindows: [],
    stayWindows: [],
    usageLimit: null,
    active: true,
    freeUpsellItemIds: [],
    listingIds: [],
    channel: 'widget',
    websiteIds: [],
  }
}

/**
 * `<input type="date">` only accepts `YYYY-MM-DD`. Seeded codes store full
 * ISO timestamps, which the input silently renders as blank — so trim to the
 * date part on the way into the form.
 */
function toDateInputValue(value: string | null): string | null {
  if (!value)
    return null
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value)
  return match ? match[0] : null
}

function toDateInputWindows(windows: PromoCodeWindow[] | undefined): PromoCodeWindow[] {
  return (windows ?? []).map(w => ({
    from: toDateInputValue(w.from),
    until: toDateInputValue(w.until),
  }))
}

export function promoCodeToFormDraft(code: PromoCode): PromoCodeFormDraft {
  return {
    code: code.code,
    description: code.description ?? '',
    discountType: code.discountType,
    value: code.discountType === 'free_upsell' ? 0 : code.value,
    currency: code.currency ?? 'USD',
    bookingWindows: toDateInputWindows(code.bookingWindows),
    stayWindows: toDateInputWindows(code.stayWindows),
    usageLimit: code.usageLimit ?? null,
    active: code.active,
    freeUpsellItemIds: code.freeUpsellItemIds ? [...code.freeUpsellItemIds] : [],
    listingIds: code.listingIds ? [...code.listingIds] : [],
    channel: code.channelRestriction?.channel ?? 'widget',
    websiteIds: code.channelRestriction ? [...code.channelRestriction.websiteIds] : [],
  }
}

/**
 * Fold the flat form back into the payload `usePromoCodes` persists. The
 * composable already normalizes type-dependent fields (value, currency,
 * websiteIds), so this only has to drop empties and re-nest the channel.
 */
export function formDraftToPromoCodePayload(draft: PromoCodeFormDraft) {
  const isFreeUpsell = draft.discountType === 'free_upsell'
  return {
    code: draft.code.trim(),
    description: draft.description.trim() || undefined,
    discountType: draft.discountType,
    value: isFreeUpsell ? 0 : draft.value,
    currency: draft.discountType === 'fixed' ? draft.currency : null,
    active: draft.active,
    bookingWindows: draft.bookingWindows.map(w => ({ from: w.from || null, until: w.until || null })),
    stayWindows: draft.stayWindows.map(w => ({ from: w.from || null, until: w.until || null })),
    usageLimit: draft.usageLimit,
    freeUpsellItemIds: isFreeUpsell ? [...draft.freeUpsellItemIds] : [],
    listingIds: [...draft.listingIds],
    channelRestriction: {
      channel: draft.channel,
      websiteIds: draft.channel === 'website' ? [...draft.websiteIds] : [],
    },
  }
}

/**
 * Minimal shape of an upsell service this module needs — passed in rather than
 * imported so the module stays framework- and store-free.
 */
export interface UpsellScopeService {
  id: string
  items: { id: string }[]
  assignedListings: string[]
}

/**
 * How much of the code's listing scope a service actually reaches.
 *
 * A service is only offered at the properties it is assigned to, so a code
 * covering five listings but giving away a service offered at two of them is a
 * promise it cannot keep for the other three. `covered === 0` is unredeemable
 * outright; `0 < covered < total` is partial and worth warning about.
 *
 * `assignedListings` and `scopedListingNames` are both listing NAMES.
 */
export interface UpsellCoverage {
  covered: number
  total: number
}

export function upsellServiceCoverage(
  assignedListings: string[],
  scopedListingNames: string[],
): UpsellCoverage {
  const scoped = new Set(scopedListingNames)
  return {
    covered: assignedListings.filter(name => scoped.has(name)).length,
    total: scoped.size,
  }
}

/** Item ids whose parent service reaches none of the scoped listings. */
export function unreachableUpsellItemIds(
  services: UpsellScopeService[],
  itemIds: string[],
  scopedListingNames: string[],
): string[] {
  const out: string[] = []
  for (const service of services) {
    const { covered } = upsellServiceCoverage(service.assignedListings, scopedListingNames)
    if (covered > 0)
      continue
    for (const item of service.items) {
      if (itemIds.includes(item.id))
        out.push(item.id)
    }
  }
  return out
}

/**
 * Listing ids reachable through the selected websites.
 *
 * A website only covers the listings it markets, so limiting a code to
 * specific sites also limits which properties it can apply to. Returns `null`
 * for "no constraint": no sites picked, or a picked site has no coverage
 * recorded — an un-migrated site may cover anything, and guessing "nothing"
 * would wrongly empty the listing list.
 */
export function listingIdsForWebsiteSelection(
  coverage: { id: string, listingIds: string[] }[],
  selectedIds: string[],
): string[] | null {
  if (selectedIds.length === 0)
    return null

  const chosen = coverage.filter(c => selectedIds.includes(c.id))
  if (chosen.length === 0)
    return null
  if (chosen.some(c => c.listingIds.length === 0))
    return null

  return [...new Set(chosen.flatMap(c => c.listingIds))]
}

export interface PromoCodeValidationContext {
  /** Supplied by `usePromoCodes` so the pure validator stays store-free. */
  isCodeTaken?: (code: string) => boolean
  /**
   * Listing NAMES the code covers, and the services to resolve them against.
   * Both are injected for the same reason `isCodeTaken` is: the module stays
   * free of the listing and upsell stores. Omit either and the free-upsell
   * coverage check is skipped rather than guessed.
   */
  scopedListingNames?: string[]
  upsellServices?: UpsellScopeService[]
}

/**
 * Errors are keyed by field so a field group can highlight its own input.
 * Window errors are keyed positionally (`bookingWindows.0`) because a host can
 * add any number of them.
 */
export type PromoCodeFormErrors = Record<string, string>

function validateWindows(
  windows: PromoCodeWindow[],
  key: 'bookingWindows' | 'stayWindows',
  errors: PromoCodeFormErrors,
): void {
  windows.forEach((window, index) => {
    if (window.from && window.until && window.from > window.until)
      errors[`${key}.${index}`] = 'The end date must come after the start date'
  })
}

export function validatePromoCodeStep(
  draft: PromoCodeFormDraft,
  stepId: PromoCodeStepId,
  ctx: PromoCodeValidationContext = {},
): PromoCodeFormErrors {
  const errors: PromoCodeFormErrors = {}

  if (stepId === 'basics') {
    const trimmed = draft.code.trim()
    if (!trimmed)
      errors.code = 'Code is required'
    else if (ctx.isCodeTaken?.(trimmed))
      errors.code = 'A code with this value already exists'
  }

  if (stepId === 'discount') {
    if (draft.discountType === 'free_upsell') {
      if (draft.freeUpsellItemIds.length === 0) {
        errors.freeUpsellItemIds = 'Select at least one upsell item for a Free Upsell code'
      }
      else if (ctx.upsellServices && ctx.scopedListingNames) {
        // A service offered at none of the covered listings makes the code
        // unredeemable everywhere it applies — block rather than warn.
        const unreachable = unreachableUpsellItemIds(
          ctx.upsellServices,
          draft.freeUpsellItemIds,
          ctx.scopedListingNames,
        )
        if (unreachable.length > 0) {
          errors.freeUpsellItemIds = unreachable.length === draft.freeUpsellItemIds.length
            ? 'None of these items are offered at the listings this code covers'
            : `${unreachable.length} selected item${unreachable.length === 1 ? ' is' : 's are'} not offered at any listing this code covers`
        }
      }
    }
    else if (!draft.value || draft.value <= 0) {
      errors.value = 'Value must be greater than 0'
    }
    else if (draft.discountType === '%' && draft.value > 100) {
      errors.value = 'A percentage discount cannot exceed 100%'
    }
  }

  if (stepId === 'rules') {
    validateWindows(draft.bookingWindows, 'bookingWindows', errors)
    validateWindows(draft.stayWindows, 'stayWindows', errors)
    if (draft.usageLimit !== null && draft.usageLimit < 1)
      errors.usageLimit = 'Usage limit must be at least 1'
  }

  return errors
}

/** Every step at once — used by the edit form, which shows all fields together. */
export function validatePromoCodeForm(
  draft: PromoCodeFormDraft,
  ctx: PromoCodeValidationContext = {},
): PromoCodeFormErrors {
  return PROMO_CODE_STEPS.reduce<PromoCodeFormErrors>((acc, step) => ({
    ...acc,
    ...validatePromoCodeStep(draft, step.id, ctx),
  }), {})
}

/** The first step that still has an error, so a failed submit can jump to it. */
export function firstInvalidPromoCodeStep(
  draft: PromoCodeFormDraft,
  ctx: PromoCodeValidationContext = {},
): PromoCodeStepId | null {
  const step = PROMO_CODE_STEPS.find(
    s => Object.keys(validatePromoCodeStep(draft, s.id, ctx)).length > 0,
  )
  return step?.id ?? null
}

/** Human-readable discount line, reused by the review block. */
export function formatDraftDiscount(draft: PromoCodeFormDraft): string {
  if (draft.discountType === '%')
    return `${draft.value}% off`
  if (draft.discountType === 'fixed')
    return `${draft.currency} ${draft.value} off`
  const n = draft.freeUpsellItemIds.length
  return `Free upsell · ${n} item${n === 1 ? '' : 's'}`
}
