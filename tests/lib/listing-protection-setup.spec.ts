import type { UpsellService } from '~/components/upsells/data/upsell-services'
import { describe, expect, it } from 'vitest'
import { applySettingsPatch, defaultProtectionSettings, hostFallbackDue, listingPolicy, packageOf, protectionPackageOptions, selectedPackage, setupTermsText } from '~/components/damage-protection/data/listing-protection-setup'
import { DEPOSIT_TERMS, WAIVER_TERMS } from '~/components/reservations/data/damage-protection'
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'

const LISTING = { id: 'lst-x' }

function service(patch: Partial<UpsellService> = {}): UpsellService {
  const cover = mockUpsellServices.find(s => s.id === 'svc-dp-bronze')!
  return { ...cover, assignedListings: [], ...patch }
}

describe('packages', () => {
  it('sizes a "+" tier like its base tier and covers the same damage, with a higher liability', async () => {
    const { recommendedTier, tierTooSmall, ternPriceFor } = await import('~/components/reservations/data/tern-products')
    expect(recommendedTier(3)).toBe('bronze')
    expect(tierTooSmall('bronze_plus', 6)).toBe(true)
    expect(tierTooSmall('silver_plus', 6)).toBe(false)
    expect(tierTooSmall('gold_plus', 2)).toBe(false)
    // A "+" tier differs in liability only: same damage cover, higher liability, higher fee.
    const silver = ternPriceFor('silver', 'USD')!
    const silverPlus = ternPriceFor('silver_plus', 'USD')!
    expect(silverPlus.coverageCap).toBe(silver.coverageCap)
    expect(silverPlus.coverage.unit).toEqual(silver.coverage.unit)
    expect(silverPlus.coverage.personal).toEqual(silver.coverage.personal)
    expect(silverPlus.coverage.liability.limit).toBeGreaterThan(silver.coverage.liability.limit)
    expect(silverPlus.perStayFee).toBeGreaterThan(silver.perStayFee)
  })

  it('lists one package per active protection upsell, and skips one without a cover tier', () => {
    expect(protectionPackageOptions(mockUpsellServices).map(p => [p.serviceId, p.tier, p.guestPrice]))
      .toEqual([
        ['svc-dp-bronze', 'bronze', 39],
        ['svc-dp-silver', 'silver', 59],
        ['svc-dp-bronze-plus', 'bronze_plus', 59],
        ['svc-dp-silver-plus', 'silver_plus', 89],
        ['svc-dp-gold-plus', 'gold_plus', 129],
      ])
    expect(protectionPackageOptions([service({ status: 'inactive' })])).toEqual([])
    expect(protectionPackageOptions([service({ category: 'Spa' })])).toEqual([])
    expect(protectionPackageOptions([service({ items: [{ id: 'i', name: 'Plain', price: 10 }] })])).toEqual([])
  })

  it('picks the tenant\'s package only while its upsell is active and sells one', () => {
    const bronze = service({ id: 'b' })
    expect(selectedPackage([bronze], { packageServiceId: 'b' })).toMatchObject({ serviceId: 'b', tier: 'bronze', guestPrice: 39 })
    expect(selectedPackage([bronze], { packageServiceId: null })).toBeNull()
    expect(selectedPackage([service({ id: 'b', status: 'inactive' })], { packageServiceId: 'b' })).toBeNull()
    expect(selectedPackage([service({ id: 'b', category: 'Spa' })], { packageServiceId: 'b' })).toBeNull()
  })
})

describe('applySettingsPatch', () => {
  const now = '2026-10-08T00:00:00.000Z'
  it('brings the deposit with the waiver, and keeps it on beside it', () => {
    const off = defaultProtectionSettings()
    expect(off).toMatchObject({ waiver: false, deposit: false, payer: 'guest', packageServiceId: null })
    const on = applySettingsPatch(off, { waiver: true, packageServiceId: 'b' }, now)
    expect(on).toMatchObject({ waiver: true, deposit: true, updatedAt: now })
    expect(applySettingsPatch(on, { deposit: false }, now).deposit).toBe(true)
    // With the waiver off, the deposit is its own switch.
    expect(applySettingsPatch(on, { waiver: false, deposit: false }, now).deposit).toBe(false)
  })
})

describe('listingPolicy', () => {
  const BRONZE = packageOf(service())!
  const ON = { ...defaultProtectionSettings(), waiver: true, deposit: true }

  it('builds the listing\'s policy from the tenant settings and package', () => {
    const silver = packageOf(service({ id: 'svc-dp-silver', items: [{ id: 'i', name: 'Silver', price: 59, coverTier: 'silver' }] }))
    const built = listingPolicy(ON, silver, LISTING, 'USD')
    expect(built.policy).toMatchObject({
      id: 'lp-lst-x',
      currency: 'USD',
      offers: ['waiver', 'deposit'],
      waiver: { tier: 'silver', guestPrice: 59 },
      deposit: { pricing: 'flat', rate: 500, settleWithinDays: 7 },
      channelPolicy: {},
    })
  })

  it('says why there is no policy', () => {
    expect(listingPolicy(ON, null, LISTING, 'USD')).toEqual({ policy: null, block: 'no_package' })
    expect(listingPolicy({ ...ON, waiver: false, deposit: false }, BRONZE, LISTING, 'USD')).toEqual({ policy: null, block: 'nothing_offered' })
    expect(listingPolicy(ON, BRONZE, LISTING, 'IDR')).toEqual({ policy: null, block: 'currency_mismatch' })
    expect(listingPolicy(ON, BRONZE, LISTING, 'IDR', 'stripe')).toEqual({ policy: null, block: 'currency_mismatch' })
  })

  it('covers a non-Stripe listing in another currency: the policy stays in the package currency, the gateway converts', () => {
    for (const provider of ['doku', 'xendit']) {
      const built = listingPolicy(ON, BRONZE, LISTING, 'IDR', provider)
      expect(built.policy).toMatchObject({ currency: 'USD', offers: ['waiver', 'deposit'] })
      expect('convertTo' in built && built.convertTo).toBe('IDR')
    }
    // Same currency: nothing to convert.
    const same = listingPolicy(ON, BRONZE, LISTING, 'USD', 'doku')
    expect('convertTo' in same && same.convertTo).toBeNull()
  })

  it('takes a deposit only with the waiver off, in the payout currency', () => {
    const depositOnly = { ...ON, waiver: false }
    const built = listingPolicy(depositOnly, null, LISTING, 'IDR')
    expect(built.policy).toMatchObject({ offers: ['deposit'], currency: 'IDR', channelPolicy: { Direct: 'offer' }, termsText: DEPOSIT_TERMS })
    expect(listingPolicy(depositOnly, null, LISTING, null)).toEqual({ policy: null, block: 'no_payout_currency' })
  })

  it('asks a deposit on its own on the channels picked, Direct by default', () => {
    const depositOnly = { ...ON, waiver: false }
    expect(listingPolicy(depositOnly, BRONZE, LISTING, 'USD').policy?.channelPolicy).toEqual({ Direct: 'offer' })
    expect(listingPolicy({ ...depositOnly, depositChannels: undefined }, BRONZE, LISTING, 'USD').policy?.channelPolicy).toEqual({ Direct: 'offer' })
    expect(listingPolicy({ ...depositOnly, depositChannels: ['Airbnb', 'Direct'] }, BRONZE, LISTING, 'USD').policy?.channelPolicy)
      .toEqual({ Airbnb: 'offer', Direct: 'offer' })
    expect(listingPolicy({ ...depositOnly, depositChannels: [] }, BRONZE, LISTING, 'USD')).toEqual({ policy: null, block: 'no_deposit_channel' })
  })

  it('takes the listing\'s own deposit amount over the default', () => {
    const settings = { ...ON, depositOverrides: { 'lst-x': 1500 } }
    expect(listingPolicy(settings, BRONZE, LISTING, 'USD').policy?.deposit.rate).toBe(1500)
    expect(listingPolicy(settings, BRONZE, { id: 'lst-y' }, 'USD').policy?.deposit.rate).toBe(500)
  })

  it('ignores the deposit channels while the waiver is on: every channel is covered', () => {
    expect(listingPolicy({ ...ON, depositChannels: [] }, BRONZE, LISTING, 'USD').policy?.channelPolicy).toEqual({})
  })
})

describe('setupTermsText', () => {
  it('words the terms after the options offered', () => {
    expect(setupTermsText({ waiver: true, deposit: false })).toBe(WAIVER_TERMS)
    expect(setupTermsText({ waiver: false, deposit: true })).toBe(DEPOSIT_TERMS)
    expect(setupTermsText({ waiver: true, deposit: true })).toBe(`${WAIVER_TERMS} ${DEPOSIT_TERMS}`)
  })
})

describe('hostFallbackDue', () => {
  const today = new Date(2026, 9, 6, 15, 0)
  it('is due from N days before check-in, default one', () => {
    expect(hostFallbackDue({ hostFallback: true }, '2026-10-07', today)).toBe(true)
    expect(hostFallbackDue({ hostFallback: true }, '2026-10-08', today)).toBe(false)
    expect(hostFallbackDue({ hostFallback: true, hostFallbackDays: 3 }, '2026-10-09', today)).toBe(true)
    expect(hostFallbackDue({ hostFallback: true, hostFallbackDays: 3 }, '2026-10-10', today)).toBe(false)
  })

  it('is never due while the setting is off', () => {
    expect(hostFallbackDue({}, '2026-10-06', today)).toBe(false)
    expect(hostFallbackDue({ hostFallback: false, hostFallbackDays: 14 }, '2026-10-07', today)).toBe(false)
  })
})
