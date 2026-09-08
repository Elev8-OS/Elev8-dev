import { describe, expect, it } from 'vitest'
import {
  buildOrderSummary,
  canAdvance,
  checklistProgress,
  createChecklist,
  createDefaultProfile,
  discountFor,
  integrationPathFor,
  isModuleAvailable,
  ONBOARDING_PROMO_CODES,
  perBookingAmount,
  perBookingPlanByCode,
  perBookingRate,
  perUnitAmount,
  perUnitPlanForUnits,
  searchProviders,
  stepForStatus,
  subtotalFor,
  validateProfile,
  validatePromoCode,
} from '~/components/onboarding/data/onboarding'

const NOW = new Date('2026-09-07T00:00:00.000Z')

function profile(overrides: Partial<ReturnType<typeof createDefaultProfile>> = {}) {
  return {
    ...createDefaultProfile(),
    companyName: 'PT Elev8',
    brandName: 'Elev8 Bali',
    phoneNumber: '+6281234567890',
    operatingCurrency: 'IDR',
    country: 'ID',
    timezone: 'Asia/Makassar',
    addressLine: 'Jl. Raya Canggu 12',
    city: 'Badung',
    zipCode: '80361',
    ...overrides,
  }
}

describe('profile validation', () => {
  it('accepts a complete profile', () => {
    expect(validateProfile(profile())).toEqual({})
  })

  it('requires every field except website', () => {
    const errors = validateProfile(createDefaultProfile())
    expect(Object.keys(errors).sort()).toEqual([
      'addressLine',
      'brandName',
      'city',
      'companyName',
      'country',
      'operatingCurrency',
      'phoneNumber',
      'timezone',
      'zipCode',
    ])
    expect(errors.website).toBeUndefined()
  })

  it('accepts a valid website but rejects a malformed one', () => {
    expect(validateProfile(profile({ website: 'https://elev8.com' })).website).toBeUndefined()
    expect(validateProfile(profile({ website: 'nonsense' })).website).toBeDefined()
  })

  it('requires the phone number in E.164 form', () => {
    expect(validateProfile(profile({ phoneNumber: '081234567890' })).phoneNumber).toBeDefined()
    expect(validateProfile(profile({ phoneNumber: '+41 79 123 45 67' })).phoneNumber).toBeUndefined()
  })
})

describe('per unit pricing', () => {
  it('picks the tier from the unit count', () => {
    expect(perUnitPlanForUnits(1).name).toBe('Starter')
    expect(perUnitPlanForUnits(4).name).toBe('Starter')
    expect(perUnitPlanForUnits(5).name).toBe('Growth')
    expect(perUnitPlanForUnits(19).name).toBe('Growth')
    expect(perUnitPlanForUnits(20).name).toBe('Pro')
    expect(perUnitPlanForUnits(49).name).toBe('Pro')
    expect(perUnitPlanForUnits(50).name).toBe('Enterprise')
    expect(perUnitPlanForUnits(400).name).toBe('Enterprise')
  })

  it('charges the package floor when the tenant runs fewer units', () => {
    const growth = perUnitPlanForUnits(5)
    // 5 unit floor even though the maths below asks for fewer.
    expect(perUnitAmount(2, growth, 'monthly')).toBe(5 * 59)
  })

  it('bills twelve months at the yearly rate', () => {
    const starter = perUnitPlanForUnits(3)
    expect(perUnitAmount(3, starter, 'monthly')).toBe(3 * 69)
    expect(perUnitAmount(3, starter, 'yearly')).toBe(Math.round(3 * 63.25 * 12 * 100) / 100)
  })

  it('prices the yearly rate as eleven months spread over twelve', () => {
    for (const plan of [perUnitPlanForUnits(1), perUnitPlanForUnits(5), perUnitPlanForUnits(20), perUnitPlanForUnits(50)])
      expect(plan.yearly).toBeCloseTo((plan.monthly * 11) / 12, 1)
  })
})

describe('per booking pricing', () => {
  it('uses the Channel Manager column for PMS_CM and MIGRATION', () => {
    const growth = perBookingPlanByCode('PER_BOOKING_GROWTH')!
    expect(perBookingRate(growth, 'PMS_CM')).toBe(11.90)
    expect(perBookingRate(growth, 'MIGRATION')).toBe(11.90)
    expect(perBookingAmount(growth, 'PMS_CM')).toBe(2975)
  })

  it('uses the cheaper column for PMS_ONLY, which has no Channel Manager', () => {
    const growth = perBookingPlanByCode('PER_BOOKING_GROWTH')!
    expect(perBookingRate(growth, 'PMS_ONLY')).toBe(8.91)
    expect(perBookingAmount(growth, 'PMS_ONLY')).toBe(2227.50)
  })
})

describe('order summary', () => {
  const perUnitSelection = {
    pmsModel: 'PMS_CM' as const,
    pricingModel: 'per_unit' as const,
    planCode: 'PER_UNIT_GROWTH',
    billingCycle: 'monthly' as const,
    unitCount: 8,
  }

  it('separates subtotal, discount and total', () => {
    const promo = ONBOARDING_PROMO_CODES.find(p => p.code === 'LAUNCH50')!
    const summary = buildOrderSummary(perUnitSelection, promo)
    expect(summary.subtotal).toBe(8 * 59)
    expect(summary.discount).toBe((8 * 59) / 2)
    expect(summary.total).toBe((8 * 59) / 2)
  })

  it('quotes the next period at the normal price for a first invoice discount', () => {
    const promo = ONBOARDING_PROMO_CODES.find(p => p.code === 'LAUNCH50')!
    const summary = buildOrderSummary(perUnitSelection, promo)
    expect(summary.discountIsFirstInvoiceOnly).toBe(true)
    expect(summary.nextPeriodAmount).toBe(8 * 59)
  })

  it('keeps the discount on the next period when the promo runs forever', () => {
    const forever = { ...ONBOARDING_PROMO_CODES.find(p => p.code === 'LAUNCH50')!, duration: 'forever' as const }
    const summary = buildOrderSummary(perUnitSelection, forever)
    expect(summary.discountIsFirstInvoiceOnly).toBe(false)
    expect(summary.nextPeriodAmount).toBe((8 * 59) / 2)
  })

  it('states the one year contract on per unit and never on per booking', () => {
    expect(buildOrderSummary(perUnitSelection, null).contractMonths).toBe(12)
    const perBooking = buildOrderSummary({
      pmsModel: 'PMS_CM',
      pricingModel: 'per_booking',
      planCode: 'PER_BOOKING_STARTER',
      billingCycle: null,
      unitCount: 1,
    }, null)
    expect(perBooking.contractMonths).toBeNull()
    // Prepaid quota, so there is no recurring figure to quote.
    expect(perBooking.nextPeriodAmount).toBeNull()
  })

  it('names the package floor in the plan detail', () => {
    const summary = buildOrderSummary({ ...perUnitSelection, unitCount: 2 }, null)
    expect(summary.planDetail).toContain('5 units')
    expect(summary.planDetail).toContain('minimum of 5')
  })

  it('a hundred percent discount lands on exactly zero, never below', () => {
    const promo = ONBOARDING_PROMO_CODES.find(p => p.code === 'PARTNER100')!
    const summary = buildOrderSummary(perUnitSelection, promo)
    expect(summary.total).toBe(0)
  })

  it('caps a fixed discount at the subtotal', () => {
    const huge = { ...ONBOARDING_PROMO_CODES[0]!, discountType: 'fixed' as const, discountValue: 99999 }
    expect(discountFor(subtotalFor(perUnitSelection), huge)).toBe(subtotalFor(perUnitSelection))
  })
})

describe('promo validation', () => {
  const cm = { pmsModel: 'PMS_CM' as const, pricingModel: 'per_unit' as const }

  it('accepts a live code', () => {
    const result = validatePromoCode('launch50', cm, ONBOARDING_PROMO_CODES, NOW)
    expect(result.valid).toBe(true)
    expect(result.promo?.code).toBe('LAUNCH50')
  })

  it('is case insensitive and trims whitespace', () => {
    expect(validatePromoCode('  LaUnCh50 ', cm, ONBOARDING_PROMO_CODES, NOW).valid).toBe(true)
  })

  it('rejects an unknown code', () => {
    const result = validatePromoCode('NOPE', cm, ONBOARDING_PROMO_CODES, NOW)
    expect(result.reason).toBe('not_found')
  })

  it('names expiry as the reason and the date', () => {
    const result = validatePromoCode('SUMMER24', cm, ONBOARDING_PROMO_CODES, NOW)
    expect(result.reason).toBe('expired')
    expect(result.message).toContain('expired')
  })

  it('names an exhausted code rather than calling it invalid', () => {
    const exhausted = [{ ...ONBOARDING_PROMO_CODES[0]!, code: 'FULL', maxRedemptions: 5, redemptionCount: 5 }]
    const result = validatePromoCode('FULL', cm, exhausted, NOW)
    expect(result.reason).toBe('exhausted')
    expect(result.message).toContain('fully redeemed')
  })

  it('rejects a code scoped to another model, and says which one', () => {
    const result = validatePromoCode('MIGRATE250', cm, ONBOARDING_PROMO_CODES, NOW)
    expect(result.reason).toBe('wrong_pms_model')
    expect(result.message).toContain('Migration')
  })

  it('accepts that same code on the model it is scoped to', () => {
    const result = validatePromoCode('MIGRATE250', { ...cm, pmsModel: 'MIGRATION' }, ONBOARDING_PROMO_CODES, NOW)
    expect(result.valid).toBe(true)
  })

  it('rejects a code scoped to another pricing model', () => {
    const result = validatePromoCode('UNITS20', { ...cm, pricingModel: 'per_booking' }, ONBOARDING_PROMO_CODES, NOW)
    expect(result.reason).toBe('wrong_pricing_model')
    expect(result.message).toContain('per unit')
  })

  it('rejects a code that has been switched off', () => {
    const off = [{ ...ONBOARDING_PROMO_CODES[0]!, isActive: false }]
    expect(validatePromoCode(off[0]!.code, cm, off, NOW).reason).toBe('inactive')
  })

  it('rejects a code that has not started yet', () => {
    const future = [{ ...ONBOARDING_PROMO_CODES[0]!, validFrom: '2099-01-01T00:00:00.000Z' }]
    expect(validatePromoCode(future[0]!.code, cm, future, NOW).reason).toBe('not_started')
  })
})

describe('state machine', () => {
  it('only moves forward', () => {
    expect(canAdvance('registered', 'email_verified')).toBe(true)
    expect(canAdvance('plan_selected', 'profile_completed')).toBe(false)
    expect(canAdvance('completed', 'importing')).toBe(false)
  })

  it('lets a failed payment go back to pending, and only that', () => {
    expect(canAdvance('payment_failed', 'payment_pending')).toBe(true)
    expect(canAdvance('payment_pending', 'payment_failed')).toBe(true)
    expect(canAdvance('payment_failed', 'plan_selected')).toBe(false)
  })

  it('allows a zero total to skip payment_pending entirely', () => {
    expect(canAdvance('plan_selected', 'integration_pending')).toBe(true)
  })

  it('resumes a returning tenant at the step they had not finished', () => {
    expect(stepForStatus('registered')).toBe('profile')
    expect(stepForStatus('profile_completed')).toBe('branding')
    expect(stepForStatus('branding_completed')).toBe('select_model')
    expect(stepForStatus('plan_selected')).toBe('payment')
    expect(stepForStatus('payment_failed')).toBe('payment')
    expect(stepForStatus('integration_pending')).toBe('integration')
    expect(stepForStatus('importing')).toBe('import')
    expect(stepForStatus('completed')).toBe('done')
  })
})

describe('routing and module availability', () => {
  it('sends PMS_CM to channels and the others to a PMS sign in', () => {
    expect(integrationPathFor('PMS_CM')).toBe('channels')
    expect(integrationPathFor('PMS_ONLY')).toBe('pms')
    expect(integrationPathFor('MIGRATION')).toBe('pms')
  })

  it('hides four modules from PMS_ONLY and nothing from the others', () => {
    for (const name of ['Cockpit', 'Website Builder', 'Review Hub', 'Integrations']) {
      expect(isModuleAvailable('PMS_ONLY', name)).toBe(false)
      expect(isModuleAvailable('PMS_CM', name)).toBe(true)
      expect(isModuleAvailable('MIGRATION', name)).toBe(true)
    }
    expect(isModuleAvailable('PMS_ONLY', 'Listings')).toBe(true)
  })
})

describe('checklist', () => {
  it('marks items that need a hidden module as not applicable for PMS_ONLY', () => {
    const items = createChecklist('PMS_ONLY')
    expect(items.find(i => i.code === 'setup_stripe')!.status).toBe('not_applicable')
    expect(items.find(i => i.code === 'first_listing')!.status).toBe('todo')
  })

  it('gives every item to a PMS_CM tenant', () => {
    expect(createChecklist('PMS_CM').every(i => i.status === 'todo')).toBe(true)
  })

  it('counts only the items that apply', () => {
    const items = createChecklist('PMS_ONLY')
    const progress = checklistProgress(items)
    expect(progress.total).toBe(items.length - 1)
    expect(progress.done).toBe(0)
    expect(progress.finished).toBe(false)
  })

  it('counts a skipped item as finished so the card can disappear', () => {
    const items = createChecklist('PMS_CM').map(i => ({ ...i, status: 'skipped' as const }))
    expect(checklistProgress(items).finished).toBe(true)
  })
})

describe('provider catalog', () => {
  it('pins the common systems above an alphabetical list', () => {
    const { popular, all } = searchProviders('')
    expect(popular.length).toBeGreaterThan(0)
    expect(all.map(p => p.name)).toEqual([...all.map(p => p.name)].sort((a, b) => a.localeCompare(b)))
  })

  it('drops the pinned section while searching, so results are not duplicated', () => {
    const { popular, all } = searchProviders('gue')
    expect(popular).toEqual([])
    expect(all.map(p => p.id)).toContain('guesty')
  })

  it('returns nothing for a system it does not know', () => {
    expect(searchProviders('zzzz').all).toEqual([])
  })
})
