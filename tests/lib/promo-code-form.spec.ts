import type { PromoCode } from '~/components/promo-code/data/promo-codes'
import { describe, expect, it } from 'vitest'
import {
  createDefaultPromoCodeFormDraft,
  firstInvalidPromoCodeStep,
  formatDraftDiscount,
  formDraftToPromoCodePayload,
  listingIdsForWebsiteSelection,
  PROMO_CODE_STEPS,
  promoCodeToFormDraft,
  unreachableUpsellItemIds,
  upsellServiceCoverage,
  validatePromoCodeForm,
  validatePromoCodeStep,
} from '~/components/promo-code/data/promo-code-form'
import {
  formatPromoDiscount,
  formatPromoLengthOfStay,
  formatPromoMinStay,
  formatPromoWindow,
  formatPromoWindowCompact,
  getPromoCodeDiscountForStay,
  isDateInPromoWindow,
  meetsPromoCodeLengthOfStay,
  meetsPromoCodeMinStay,
} from '~/components/promo-code/data/promo-codes'

function draft(overrides: Partial<ReturnType<typeof createDefaultPromoCodeFormDraft>> = {}) {
  return { ...createDefaultPromoCodeFormDraft(), ...overrides }
}

describe('promo code wizard steps', () => {
  it('asks the four decisions in order', () => {
    expect(PROMO_CODE_STEPS.map(s => s.id)).toEqual(['basics', 'scope', 'discount', 'rules'])
  })

  it('puts scope before discount, because listings decide the available upsells', () => {
    const ids = PROMO_CODE_STEPS.map(s => s.id)
    expect(ids.indexOf('scope')).toBeLessThan(ids.indexOf('discount'))
  })
})

describe('validatePromoCodeStep — basics', () => {
  it('requires a code', () => {
    expect(validatePromoCodeStep(draft({ code: '   ' }), 'basics')).toEqual({
      code: 'Code is required',
    })
  })

  it('rejects a code the store already holds', () => {
    const errors = validatePromoCodeStep(draft({ code: 'WELCOME10' }), 'basics', {
      isCodeTaken: c => c === 'WELCOME10',
    })
    expect(errors.code).toBe('A code with this value already exists')
  })

  it('passes a fresh code', () => {
    expect(validatePromoCodeStep(draft({ code: 'SUMMER25' }), 'basics', {
      isCodeTaken: () => false,
    })).toEqual({})
  })

  it('does not police the discount from the basics step', () => {
    expect(validatePromoCodeStep(draft({ code: 'OK', value: 0 }), 'basics')).toEqual({})
  })
})

describe('validatePromoCodeStep — discount', () => {
  it('rejects a non-positive value', () => {
    expect(validatePromoCodeStep(draft({ value: 0 }), 'discount').value)
      .toBe('Value must be greater than 0')
  })

  it('caps a percentage at 100', () => {
    expect(validatePromoCodeStep(draft({ discountType: '%', value: 120 }), 'discount').value)
      .toBe('A percentage discount cannot exceed 100%')
  })

  it('allows a fixed amount above 100', () => {
    expect(validatePromoCodeStep(draft({ discountType: 'fixed', value: 250 }), 'discount')).toEqual({})
  })

  it('requires at least one item on a free-upsell code', () => {
    expect(validatePromoCodeStep(draft({ discountType: 'free_upsell' }), 'discount').freeUpsellItemIds)
      .toBe('Select at least one upsell item for a Free Upsell code')
  })

  it('ignores the numeric value on a free-upsell code', () => {
    expect(validatePromoCodeStep(
      draft({ discountType: 'free_upsell', value: 0, freeUpsellItemIds: ['itm-003a'] }),
      'discount',
    )).toEqual({})
  })

  it('requires at least one tier for a tiered code', () => {
    expect(validatePromoCodeStep(draft({ discountType: 'tiered', lengthOfStayTiers: [] }), 'discount').lengthOfStayTiers)
      .toBe('Add at least one stay tier for a length of stay discount')
  })

  it('rejects lengthOfStayTiers with non-integer or minNights below 1', () => {
    const errorZero = validatePromoCodeStep(
      draft({
        discountType: 'tiered',
        lengthOfStayTiers: [
          { id: 't1', minNights: 0, discountType: '%', value: 10 },
        ],
      }),
      'discount',
    )
    expect(errorZero['lengthOfStayTiers.0.minNights']).toBe('Nights must be at least 1')

    const errorFloat = validatePromoCodeStep(
      draft({
        discountType: 'tiered',
        lengthOfStayTiers: [
          { id: 't1', minNights: 3.5, discountType: '%', value: 10 },
        ],
      }),
      'discount',
    )
    expect(errorFloat['lengthOfStayTiers.0.minNights']).toBe('Nights must be at least 1')
  })

  it('rejects lengthOfStayTiers with duplicate minNights', () => {
    const errors = validatePromoCodeStep(
      draft({
        discountType: 'tiered',
        lengthOfStayTiers: [
          { id: 't1', minNights: 10, discountType: '%', value: 10 },
          { id: 't2', minNights: 10, discountType: '%', value: 15 },
        ],
      }),
      'discount',
    )
    expect(errors['lengthOfStayTiers.1.minNights']).toBe('Duplicate tier for 10 nights')
  })

  it('rejects lengthOfStayTiers with invalid value or percentage > 100', () => {
    const errorZero = validatePromoCodeStep(
      draft({
        discountType: 'tiered',
        lengthOfStayTiers: [
          { id: 't1', minNights: 10, discountType: '%', value: 0 },
        ],
      }),
      'discount',
    )
    expect(errorZero['lengthOfStayTiers.0.value']).toBe('Discount value must be greater than 0')

    const errorOver100 = validatePromoCodeStep(
      draft({
        discountType: 'tiered',
        lengthOfStayTiers: [
          { id: 't1', minNights: 10, discountType: '%', value: 110 },
        ],
      }),
      'discount',
    )
    expect(errorOver100['lengthOfStayTiers.0.value']).toBe('Percentage cannot exceed 100%')
  })

  it('accepts valid lengthOfStayTiers', () => {
    expect(validatePromoCodeStep(
      draft({
        discountType: 'tiered',
        lengthOfStayTiers: [
          { id: 't1', minNights: 10, discountType: '%', value: 10 },
          { id: 't2', minNights: 20, discountType: '%', value: 20 },
        ],
      }),
      'discount',
    )).toEqual({})
  })
})

describe('validatePromoCodeStep — rules', () => {
  it('rejects a window that ends before it starts', () => {
    const errors = validatePromoCodeStep(
      draft({ bookingWindows: [{ from: '2026-09-10', until: '2026-09-01' }] }),
      'rules',
    )
    expect(errors['bookingWindows.0']).toBe('The end date must come after the start date')
  })

  it('keys window errors positionally', () => {
    const errors = validatePromoCodeStep(
      draft({
        stayWindows: [
          { from: '2026-01-01', until: '2026-02-01' },
          { from: '2026-09-10', until: '2026-09-01' },
        ],
      }),
      'rules',
    )
    expect(Object.keys(errors)).toEqual(['stayWindows.1'])
  })

  it('accepts a half-open window', () => {
    expect(validatePromoCodeStep(
      draft({ bookingWindows: [{ from: '2026-09-10', until: null }] }),
      'rules',
    )).toEqual({})
  })

  it('rejects a usage limit below 1', () => {
    expect(validatePromoCodeStep(draft({ usageLimit: 0 }), 'rules').usageLimit)
      .toBe('Usage limit must be at least 1')
  })

  it('treats a null usage limit as unlimited', () => {
    expect(validatePromoCodeStep(draft({ usageLimit: null }), 'rules')).toEqual({})
  })

  it('rejects a minimum stay below 1', () => {
    expect(validatePromoCodeStep(draft({ lengthOfStayMin: 0 }), 'rules').lengthOfStayMin)
      .toBe('Minimum stay must be at least 1 night')
    expect(validatePromoCodeStep(draft({ lengthOfStayMin: -1 }), 'rules').lengthOfStayMin)
      .toBe('Minimum stay must be at least 1 night')
  })

  it('rejects a maximum stay below 1', () => {
    expect(validatePromoCodeStep(draft({ lengthOfStayMax: 0 }), 'rules').lengthOfStayMax)
      .toBe('Maximum stay must be at least 1 night')
    expect(validatePromoCodeStep(draft({ lengthOfStayMax: -1 }), 'rules').lengthOfStayMax)
      .toBe('Maximum stay must be at least 1 night')
  })

  it('rejects maximum stay less than minimum stay', () => {
    expect(validatePromoCodeStep(draft({ lengthOfStayMin: 7, lengthOfStayMax: 3 }), 'rules').lengthOfStayMax)
      .toBe('Maximum stay cannot be less than minimum stay')
  })

  it('rejects a non-integer length of stay', () => {
    expect(validatePromoCodeStep(draft({ lengthOfStayMin: 2.5 }), 'rules').lengthOfStayMin)
      .toBe('Minimum stay must be at least 1 night')
    expect(validatePromoCodeStep(draft({ lengthOfStayMax: 4.2 }), 'rules').lengthOfStayMax)
      .toBe('Maximum stay must be at least 1 night')
  })

  it('accepts valid length of stay', () => {
    expect(validatePromoCodeStep(draft({ lengthOfStayMin: 3 }), 'rules')).toEqual({})
    expect(validatePromoCodeStep(draft({ lengthOfStayMin: 3, lengthOfStayMax: 7 }), 'rules')).toEqual({})
    expect(validatePromoCodeStep(draft({ lengthOfStayMin: 3, lengthOfStayMax: 3 }), 'rules')).toEqual({})
  })

  it('treats a null length of stay as no constraint', () => {
    expect(validatePromoCodeStep(draft({ lengthOfStayMin: null, lengthOfStayMax: null }), 'rules')).toEqual({})
  })

  it('rejects a dynamic window with days below 1 or non-integer', () => {
    const errorZero = validatePromoCodeStep(
      draft({ bookingWindows: [{ type: 'dynamic', days: 0, from: null, until: null }] }),
      'rules',
    )
    expect(errorZero['bookingWindows.0']).toBe('Dynamic validity must be at least 1 day')

    const errorFloat = validatePromoCodeStep(
      draft({ stayWindows: [{ type: 'dynamic', days: 3.5, from: null, until: null }] }),
      'rules',
    )
    expect(errorFloat['stayWindows.0']).toBe('Dynamic validity must be at least 1 day')
  })

  it('accepts a dynamic window with valid days', () => {
    expect(validatePromoCodeStep(
      draft({ bookingWindows: [{ type: 'dynamic', days: 7, from: null, until: null }] }),
      'rules',
    )).toEqual({})
  })
})

describe('firstInvalidPromoCodeStep', () => {
  it('returns the earliest failing step so submit can jump back to it', () => {
    expect(firstInvalidPromoCodeStep(draft({ code: '', value: 0 }))).toBe('basics')
    expect(firstInvalidPromoCodeStep(draft({ code: 'OK', value: 0 }))).toBe('discount')
    expect(firstInvalidPromoCodeStep(draft({ code: 'OK', usageLimit: 0 }))).toBe('rules')
    expect(firstInvalidPromoCodeStep(draft({ code: 'OK', lengthOfStayMin: 0 }))).toBe('rules')
  })

  it('returns null for a complete draft', () => {
    expect(firstInvalidPromoCodeStep(draft({ code: 'SUMMER25' }))).toBeNull()
  })
})

describe('validatePromoCodeForm', () => {
  it('collects every step at once for the flat edit form', () => {
    const errors = validatePromoCodeForm(draft({ code: '', value: 0, usageLimit: 0 }))
    expect(Object.keys(errors).sort()).toEqual(['code', 'usageLimit', 'value'])
  })
})

describe('promoCodeToFormDraft', () => {
  const stored: PromoCode = {
    id: 'promo-freespa',
    code: 'FREESPA',
    description: 'Free in-villa spa treatment',
    discountType: 'free_upsell',
    value: 0,
    currency: null,
    active: true,
    bookingWindows: [{ from: '2026-02-10T00:00:00Z', until: '2026-12-31T00:00:00Z' }],
    stayWindows: [{ from: '2026-06-01T00:00:00Z', until: null }],
    usageLimit: 50,
    redemptionCount: 0,
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
    freeUpsellItemIds: ['itm-003a'],
    listingIds: ['lst-1'],
    channelRestriction: { channel: 'website', websiteIds: ['web-1'] },
  }

  it('trims ISO timestamps down to what <input type="date"> accepts', () => {
    const form = promoCodeToFormDraft(stored)
    expect(form.bookingWindows).toEqual([{ from: '2026-02-10', until: '2026-12-31' }])
    expect(form.stayWindows).toEqual([{ from: '2026-06-01', until: null }])
  })

  it('hoists the channel restriction into flat fields', () => {
    const form = promoCodeToFormDraft(stored)
    expect(form.channel).toBe('website')
    expect(form.websiteIds).toEqual(['web-1'])
  })

  it('falls back to the widget channel when none is stored', () => {
    const form = promoCodeToFormDraft({ ...stored, channelRestriction: undefined })
    expect(form.channel).toBe('widget')
    expect(form.websiteIds).toEqual([])
  })

  it('copies arrays rather than aliasing the stored code', () => {
    const form = promoCodeToFormDraft(stored)
    form.listingIds.push('lst-9')
    expect(stored.listingIds).toEqual(['lst-1'])
  })

  it('hydrates length of stay from the stored code', () => {
    expect(promoCodeToFormDraft({ ...stored, lengthOfStayMin: 4, lengthOfStayMax: 10 }).lengthOfStayMin).toBe(4)
    expect(promoCodeToFormDraft({ ...stored, lengthOfStayMin: 4, lengthOfStayMax: 10 }).lengthOfStayMax).toBe(10)
    expect(promoCodeToFormDraft({ ...stored, lengthOfStayMin: undefined }).lengthOfStayMin).toBeNull()
    expect(promoCodeToFormDraft({ ...stored, minStay: 4 }).minStay).toBe(4)
  })
})

describe('formDraftToPromoCodePayload', () => {
  it('re-nests the channel restriction', () => {
    const payload = formDraftToPromoCodePayload(draft({
      code: 'SUMMER25',
      channel: 'website',
      websiteIds: ['web-1'],
    }))
    expect(payload.channelRestriction).toEqual({ channel: 'website', websiteIds: ['web-1'] })
  })

  it('drops website IDs left over from the website channel', () => {
    const payload = formDraftToPromoCodePayload(draft({
      code: 'SUMMER25',
      channel: 'widget',
      websiteIds: ['web-1'],
    }))
    expect(payload.channelRestriction).toEqual({ channel: 'widget', websiteIds: [] })
  })

  it('zeroes the value and clears the currency on a free-upsell code', () => {
    const payload = formDraftToPromoCodePayload(draft({
      code: 'FREESPA',
      discountType: 'free_upsell',
      value: 25,
      freeUpsellItemIds: ['itm-003a'],
    }))
    expect(payload.value).toBe(0)
    expect(payload.currency).toBeNull()
    expect(payload.freeUpsellItemIds).toEqual(['itm-003a'])
  })

  it('drops upsell items when the type is not free upsell', () => {
    const payload = formDraftToPromoCodePayload(draft({
      code: 'SUMMER25',
      discountType: '%',
      freeUpsellItemIds: ['itm-003a'],
    }))
    expect(payload.freeUpsellItemIds).toEqual([])
  })

  it('keeps the currency only for a fixed amount', () => {
    expect(formDraftToPromoCodePayload(draft({ code: 'A', discountType: 'fixed', currency: 'EUR' })).currency).toBe('EUR')
    expect(formDraftToPromoCodePayload(draft({ code: 'A', discountType: '%', currency: 'EUR' })).currency).toBeNull()
  })

  it('sends an empty description as undefined rather than an empty string', () => {
    expect(formDraftToPromoCodePayload(draft({ code: 'A', description: '   ' })).description).toBeUndefined()
  })

  it('persists length of stay and tiers from the draft', () => {
    const payload = formDraftToPromoCodePayload(draft({
      code: 'STAY3',
      lengthOfStayMin: 3,
      lengthOfStayMax: 7,
      lengthOfStayTiers: [
        { id: 't1', minNights: 10, discountType: '%', value: 10 },
        { id: 't2', minNights: 20, discountType: '%', value: 20 },
      ],
    }))
    expect(payload.lengthOfStayMin).toBe(3)
    expect(payload.lengthOfStayMax).toBe(7)
    expect(payload.minStay).toBe(3)
    expect(payload.lengthOfStayTiers).toEqual([
      { id: 't1', minNights: 10, discountType: '%', value: 10 },
      { id: 't2', minNights: 20, discountType: '%', value: 20 },
    ])
    expect(formDraftToPromoCodePayload(draft({ code: 'STAY3', lengthOfStayMin: null, lengthOfStayMax: null, lengthOfStayTiers: [] })).lengthOfStayMin).toBeNull()
  })

  it('round-trips through the form without losing a stored code', () => {
    const stored: PromoCode = {
      id: 'promo-welcome10',
      code: 'WELCOME10',
      description: 'Welcome discount',
      discountType: '%',
      value: 10,
      currency: null,
      active: true,
      bookingWindows: [],
      stayWindows: [],
      lengthOfStayTiers: [
        { id: 't1', minNights: 10, discountType: '%', value: 10 },
      ],
      usageLimit: null,
      redemptionCount: 3,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      listingIds: ['lst-1'],
      channelRestriction: { channel: 'widget', websiteIds: [] },
    }
    const payload = formDraftToPromoCodePayload(promoCodeToFormDraft(stored))
    expect(payload).toMatchObject({
      code: 'WELCOME10',
      description: 'Welcome discount',
      discountType: '%',
      value: 10,
      currency: null,
      active: true,
      listingIds: ['lst-1'],
      lengthOfStayTiers: [
        { id: 't1', minNights: 10, discountType: '%', value: 10 },
      ],
      channelRestriction: { channel: 'widget', websiteIds: [] },
    })
  })
})

describe('formatDraftDiscount', () => {
  it('reads back each discount type for the review block', () => {
    expect(formatDraftDiscount(draft({ discountType: '%', value: 15 }))).toBe('15% off')
    expect(formatDraftDiscount(draft({ discountType: 'fixed', value: 50, currency: 'EUR' }))).toBe('EUR 50 off')
    expect(formatDraftDiscount(draft({ discountType: 'free_upsell', freeUpsellItemIds: ['a'] }))).toBe('Free upsell · 1 item')
    expect(formatDraftDiscount(draft({ discountType: 'free_upsell', freeUpsellItemIds: ['a', 'b'] }))).toBe('Free upsell · 2 items')
  })

  it('reads back tiered discounts for the review block', () => {
    expect(formatDraftDiscount(draft({
      lengthOfStayTiers: [
        { id: 't2', minNights: 20, discountType: '%', value: 20 },
        { id: 't1', minNights: 10, discountType: '%', value: 10 },
      ],
    }))).toBe('Tiered: 10+ nts (10%), 20+ nts (20%)')
  })
})

// The chain runs one way: channel -> websites -> listings -> upsells. These
// two helpers are the joints, so each is pinned independently of the UI.
describe('listingIdsForWebsiteSelection', () => {
  const coverage = [
    { id: 'w1', listingIds: ['lst-1', 'lst-5'] },
    { id: 'w2', listingIds: ['lst-12'] },
    { id: 'w3', listingIds: [] },
  ]

  it('imposes no constraint when no website is picked', () => {
    expect(listingIdsForWebsiteSelection(coverage, [])).toBeNull()
  })

  it('returns what a single website covers', () => {
    expect(listingIdsForWebsiteSelection(coverage, ['w2'])).toEqual(['lst-12'])
  })

  it('unions across websites rather than intersecting them', () => {
    // A code on two sites can apply to anything either one covers.
    expect(listingIdsForWebsiteSelection(coverage, ['w1', 'w2'])).toEqual(['lst-1', 'lst-5', 'lst-12'])
  })

  it('de-duplicates listings covered by more than one site', () => {
    const overlapping = [
      { id: 'a', listingIds: ['lst-1', 'lst-5'] },
      { id: 'b', listingIds: ['lst-5', 'lst-12'] },
    ]
    expect(listingIdsForWebsiteSelection(overlapping, ['a', 'b'])).toEqual(['lst-1', 'lst-5', 'lst-12'])
  })

  it('imposes no constraint when a picked site has no coverage recorded', () => {
    // An un-migrated site may cover anything; guessing "nothing" would wrongly
    // empty the listing list.
    expect(listingIdsForWebsiteSelection(coverage, ['w1', 'w3'])).toBeNull()
  })

  it('imposes no constraint when the picked ids match nothing', () => {
    expect(listingIdsForWebsiteSelection(coverage, ['gone'])).toBeNull()
  })
})

describe('upsellServiceCoverage', () => {
  it('counts how much of the scope a service reaches', () => {
    expect(upsellServiceCoverage(['A', 'B'], ['A', 'B', 'C'])).toEqual({ covered: 2, total: 3 })
  })

  it('reports full coverage when every scoped listing offers it', () => {
    expect(upsellServiceCoverage(['A', 'B'], ['A', 'B'])).toEqual({ covered: 2, total: 2 })
  })

  it('reports nothing covered when none of them do', () => {
    expect(upsellServiceCoverage(['Z'], ['A', 'B'])).toEqual({ covered: 0, total: 2 })
  })

  it('ignores assigned listings outside the scope', () => {
    expect(upsellServiceCoverage(['A', 'Z'], ['A'])).toEqual({ covered: 1, total: 1 })
  })
})

describe('unreachableUpsellItemIds', () => {
  const services = [
    { id: 'spa', items: [{ id: 'a' }, { id: 'b' }], assignedListings: ['Villa One'] },
    { id: 'chef', items: [{ id: 'c' }], assignedListings: ['Villa Three'] },
  ]

  it('flags items whose service reaches none of the scoped listings', () => {
    expect(unreachableUpsellItemIds(services, ['a', 'c'], ['Villa One'])).toEqual(['c'])
  })

  it('flags nothing when every service reaches the scope', () => {
    expect(unreachableUpsellItemIds(services, ['a', 'c'], ['Villa One', 'Villa Three'])).toEqual([])
  })

  it('flags every selected item when the scope reaches no service', () => {
    expect(unreachableUpsellItemIds(services, ['a', 'c'], ['Villa Nine']).sort()).toEqual(['a', 'c'])
  })

  it('only reports items that were actually selected', () => {
    // 'b' shares the unreachable service but was never picked.
    expect(unreachableUpsellItemIds(services, ['a'], ['Villa Nine'])).toEqual(['a'])
  })
})

describe('validatePromoCodeStep — free upsell reach', () => {
  const services = [
    { id: 'spa', items: [{ id: 'a' }], assignedListings: ['Villa One'] },
    { id: 'chef', items: [{ id: 'c' }], assignedListings: ['Villa Three'] },
  ]

  it('blocks a code whose upsells no covered listing sells', () => {
    const errors = validatePromoCodeStep(
      draft({ discountType: 'free_upsell', freeUpsellItemIds: ['a'] }),
      'discount',
      { upsellServices: services, scopedListingNames: ['Villa Nine'] },
    )
    expect(errors.freeUpsellItemIds).toBe('None of these items are offered at the listings this code covers')
  })

  it('names the partial case differently from the total one', () => {
    const errors = validatePromoCodeStep(
      draft({ discountType: 'free_upsell', freeUpsellItemIds: ['a', 'c'] }),
      'discount',
      { upsellServices: services, scopedListingNames: ['Villa One'] },
    )
    expect(errors.freeUpsellItemIds).toBe('1 selected item is not offered at any listing this code covers')
  })

  it('passes when every item is reachable', () => {
    expect(validatePromoCodeStep(
      draft({ discountType: 'free_upsell', freeUpsellItemIds: ['a'] }),
      'discount',
      { upsellServices: services, scopedListingNames: ['Villa One'] },
    )).toEqual({})
  })

  it('skips the check rather than guessing when the context is not supplied', () => {
    expect(validatePromoCodeStep(
      draft({ discountType: 'free_upsell', freeUpsellItemIds: ['a'] }),
      'discount',
    )).toEqual({})
  })
})

describe('meetsPromoCodeLengthOfStay', () => {
  it('returns true when code has no length of stay constraint', () => {
    expect(meetsPromoCodeLengthOfStay({ lengthOfStayMin: null, lengthOfStayMax: null } as any, 1)).toBe(true)
    expect(meetsPromoCodeLengthOfStay({ lengthOfStayMin: undefined } as any, 1)).toBe(true)
  })

  it('checks minimum stay constraint', () => {
    expect(meetsPromoCodeLengthOfStay({ lengthOfStayMin: 3 } as any, 3)).toBe(true)
    expect(meetsPromoCodeLengthOfStay({ lengthOfStayMin: 3 } as any, 5)).toBe(true)
    expect(meetsPromoCodeLengthOfStay({ lengthOfStayMin: 3 } as any, 2)).toBe(false)
  })

  it('checks maximum stay constraint', () => {
    expect(meetsPromoCodeLengthOfStay({ lengthOfStayMax: 7 } as any, 5)).toBe(true)
    expect(meetsPromoCodeLengthOfStay({ lengthOfStayMax: 7 } as any, 7)).toBe(true)
    expect(meetsPromoCodeLengthOfStay({ lengthOfStayMax: 7 } as any, 8)).toBe(false)
  })

  it('checks length of stay range constraint', () => {
    const code = { lengthOfStayMin: 3, lengthOfStayMax: 7 } as any
    expect(meetsPromoCodeLengthOfStay(code, 2)).toBe(false)
    expect(meetsPromoCodeLengthOfStay(code, 3)).toBe(true)
    expect(meetsPromoCodeLengthOfStay(code, 5)).toBe(true)
    expect(meetsPromoCodeLengthOfStay(code, 7)).toBe(true)
    expect(meetsPromoCodeLengthOfStay(code, 8)).toBe(false)
  })

  it('checks tiered length of stay constraints', () => {
    const tieredCode = {
      lengthOfStayTiers: [
        { id: 't1', minNights: 10, discountType: '%', value: 10 },
        { id: 't2', minNights: 20, discountType: '%', value: 20 },
      ],
      lengthOfStayMax: 30,
    } as any

    expect(meetsPromoCodeLengthOfStay(tieredCode, 5)).toBe(false)
    expect(meetsPromoCodeLengthOfStay(tieredCode, 10)).toBe(true)
    expect(meetsPromoCodeLengthOfStay(tieredCode, 15)).toBe(true)
    expect(meetsPromoCodeLengthOfStay(tieredCode, 20)).toBe(true)
    expect(meetsPromoCodeLengthOfStay(tieredCode, 30)).toBe(true)
    expect(meetsPromoCodeLengthOfStay(tieredCode, 35)).toBe(false)
  })
})

describe('getPromoCodeDiscountForStay', () => {
  const tieredCode = {
    discountType: '%',
    value: 5,
    lengthOfStayTiers: [
      { id: 't1', minNights: 10, discountType: '%', value: 10 },
      { id: 't2', minNights: 20, discountType: '%', value: 20 },
    ],
  } as any

  it('returns null if stay does not qualify for promo code', () => {
    expect(getPromoCodeDiscountForStay(tieredCode, 5)).toBeNull()
  })

  it('resolves correct tier based on stay length', () => {
    expect(getPromoCodeDiscountForStay(tieredCode, 10)).toEqual({ discountType: '%', value: 10 })
    expect(getPromoCodeDiscountForStay(tieredCode, 15)).toEqual({ discountType: '%', value: 10 })
    expect(getPromoCodeDiscountForStay(tieredCode, 20)).toEqual({ discountType: '%', value: 20 })
    expect(getPromoCodeDiscountForStay(tieredCode, 25)).toEqual({ discountType: '%', value: 20 })
  })

  it('falls back to base promo code discount when code has no tiers', () => {
    const regularCode = {
      discountType: '%',
      value: 15,
      lengthOfStayMin: 3,
    } as any

    expect(getPromoCodeDiscountForStay(regularCode, 2)).toBeNull()
    expect(getPromoCodeDiscountForStay(regularCode, 4)).toEqual({ discountType: '%', value: 15 })
  })
})

describe('formatPromoLengthOfStay', () => {
  it('formats range when both min and max are set', () => {
    expect(formatPromoLengthOfStay({ lengthOfStayMin: 3, lengthOfStayMax: 7 } as any)).toBe('3–7 nights')
    expect(formatPromoLengthOfStay({ lengthOfStayMin: 1, lengthOfStayMax: 1 } as any)).toBe('1 night')
  })

  it('formats min only', () => {
    expect(formatPromoLengthOfStay({ lengthOfStayMin: 1 } as any)).toBe('Min 1 night')
    expect(formatPromoLengthOfStay({ lengthOfStayMin: 3 } as any)).toBe('Min 3 nights')
  })

  it('formats max only', () => {
    expect(formatPromoLengthOfStay({ lengthOfStayMax: 7 } as any)).toBe('Max 7 nights')
  })

  it('formats tiers when present', () => {
    expect(formatPromoLengthOfStay({
      lengthOfStayTiers: [
        { id: 't2', minNights: 20, discountType: '%', value: 20 },
        { id: 't1', minNights: 10, discountType: '%', value: 10 },
      ],
    } as any)).toBe('10+ nights (10%) · 20+ nights (20%)')
  })

  it('returns Any length when neither is set', () => {
    expect(formatPromoLengthOfStay({ lengthOfStayMin: null, lengthOfStayMax: null } as any)).toBe('Any length')
  })
})

describe('formatPromoDiscount', () => {
  it('formats standard discount types', () => {
    expect(formatPromoDiscount({ discountType: '%', value: 10 } as any)).toBe('10%')
    expect(formatPromoDiscount({ discountType: 'fixed', value: 50 } as any)).toBe('50')
    expect(formatPromoDiscount({ discountType: 'free_upsell' } as any)).toBe('Free Upsell')
  })

  it('formats tiered stay discounts', () => {
    expect(formatPromoDiscount({
      lengthOfStayTiers: [
        { id: 't2', minNights: 20, discountType: '%', value: 20 },
        { id: 't1', minNights: 10, discountType: '%', value: 10 },
      ],
    } as any)).toBe('10d: 10%, 20d: 20%')
  })
})

describe('meetsPromoCodeMinStay', () => {
  it('returns true when code has no minimum stay', () => {
    expect(meetsPromoCodeMinStay({ minStay: null } as any, 1)).toBe(true)
    expect(meetsPromoCodeMinStay({ minStay: undefined } as any, 1)).toBe(true)
  })

  it('returns true when stay meets or exceeds minimum stay', () => {
    expect(meetsPromoCodeMinStay({ minStay: 3 } as any, 3)).toBe(true)
    expect(meetsPromoCodeMinStay({ minStay: 3 } as any, 5)).toBe(true)
  })

  it('returns false when stay is shorter than minimum stay', () => {
    expect(meetsPromoCodeMinStay({ minStay: 3 } as any, 2)).toBe(false)
    expect(meetsPromoCodeMinStay({ minStay: 3 } as any, 1)).toBe(false)
  })
})

describe('formatPromoMinStay', () => {
  it('formats singular and plural nights', () => {
    expect(formatPromoMinStay({ minStay: 1 } as any)).toBe('1 night')
    expect(formatPromoMinStay({ minStay: 3 } as any)).toBe('3 nights')
  })

  it('returns No minimum stay when null or 0', () => {
    expect(formatPromoMinStay({ minStay: null } as any)).toBe('No minimum stay')
    expect(formatPromoMinStay({ minStay: 0 } as any)).toBe('No minimum stay')
  })
})

describe('formatPromoWindow with dynamic windows', () => {
  it('formats dynamic windows into human readable rolling days', () => {
    expect(formatPromoWindow({ type: 'dynamic', days: 7, from: null, until: null })).toBe('Within 7 days')
    expect(formatPromoWindow({ type: 'dynamic', days: 1, from: null, until: null })).toBe('Within 1 day')
  })

  it('formats compact dynamic windows', () => {
    expect(formatPromoWindowCompact({ type: 'dynamic', days: 7, from: null, until: null })).toBe('Within 7d')
  })
})

describe('isDateInPromoWindow', () => {
  it('checks date in dynamic rolling window', () => {
    const now = new Date('2026-09-14T10:00:00Z')
    const window = { type: 'dynamic' as const, days: 7, from: null, until: null }
    // Today
    expect(isDateInPromoWindow(window, new Date('2026-09-14T12:00:00Z'), now)).toBe(true)
    // 5 days later
    expect(isDateInPromoWindow(window, new Date('2026-09-19T12:00:00Z'), now)).toBe(true)
    // 7 days later
    expect(isDateInPromoWindow(window, new Date('2026-09-21T12:00:00Z'), now)).toBe(true)
    // 10 days later (outside 7 days)
    expect(isDateInPromoWindow(window, new Date('2026-09-24T12:00:00Z'), now)).toBe(false)
  })
})
