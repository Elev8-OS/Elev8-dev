import type { UpsellService } from '~/components/upsells/data/upsell-services'
import { describe, expect, it } from 'vitest'
import { defaultListingSetup, hostFallbackDue, listingPolicy, moveListingUpdates, protectionPackageOptions, setupTermsText } from '~/components/damage-protection/data/listing-protection-setup'
import { DEPOSIT_TERMS, WAIVER_TERMS } from '~/components/reservations/data/damage-protection'
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'

const LISTING = { id: 'lst-x', name: 'Villa X' }

function service(patch: Partial<UpsellService> = {}): UpsellService {
  const cover = mockUpsellServices.find(s => s.id === 'svc-dp-bronze')!
  return { ...cover, assignedListings: ['Villa X'], ...patch }
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

  it('moves a listing into one protection upsell and out of every other', () => {
    const bronze = service({ id: 'b', assignedListings: ['Villa X', 'Other'] })
    const silver = service({ id: 's', assignedListings: [] })
    expect(moveListingUpdates([bronze, silver], LISTING, 's')).toEqual([
      { id: 'b', assignedListings: ['Other'] },
      { id: 's', assignedListings: ['Villa X'], status: 'active' },
    ])
    expect(moveListingUpdates([bronze, silver], LISTING, null)).toEqual([{ id: 'b', assignedListings: ['Other'] }])
    expect(moveListingUpdates([bronze, silver], LISTING, 'b')).toEqual([])
  })
})

describe('listingPolicy', () => {
  it('builds the listing\'s policy from its setup and package', () => {
    const setup = { ...defaultListingSetup('lst-x'), deposit: true }
    const built = listingPolicy(setup, [service({ id: 'svc-dp-silver', items: [{ id: 'i', name: 'Silver', price: 59, coverTier: 'silver' }] })], LISTING, 'USD')
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
    const setup = defaultListingSetup('lst-x')
    expect(listingPolicy(setup, [], LISTING, 'USD')).toEqual({ policy: null, block: 'no_service' })
    expect(listingPolicy(setup, [service({ items: [] })], LISTING, 'USD')).toEqual({ policy: null, block: 'no_package' })
    expect(listingPolicy({ ...setup, waiver: false }, [service()], LISTING, 'USD')).toEqual({ policy: null, block: 'nothing_offered' })
    expect(listingPolicy(setup, [service()], LISTING, 'IDR')).toEqual({ policy: null, block: 'currency_mismatch' })
  })

  it('takes a deposit only without any upsell, in the payout currency', () => {
    const depositOnly = { ...defaultListingSetup('lst-x'), deposit: true }
    // The waiver switch is on by default, but there is no package to sell.
    const built = listingPolicy(depositOnly, [], LISTING, 'IDR')
    expect(built.policy).toMatchObject({ offers: ['deposit'], currency: 'IDR', channelPolicy: { Direct: 'offer' }, termsText: DEPOSIT_TERMS })
    expect(listingPolicy(depositOnly, [], LISTING, null)).toEqual({ policy: null, block: 'no_payout_currency' })
  })

  it('asks a deposit on its own on the channels the listing picked, Direct by default', () => {
    const depositOnly = { ...defaultListingSetup('lst-x'), waiver: false, deposit: true }
    expect(listingPolicy(depositOnly, [service()], LISTING, 'USD').policy?.channelPolicy).toEqual({ Direct: 'offer' })
    // A setup stored before the field existed reads as Direct only.
    expect(listingPolicy({ ...depositOnly, depositChannels: undefined }, [service()], LISTING, 'USD').policy?.channelPolicy).toEqual({ Direct: 'offer' })
    expect(listingPolicy({ ...depositOnly, depositChannels: ['Airbnb', 'Direct'] }, [service()], LISTING, 'USD').policy?.channelPolicy)
      .toEqual({ Airbnb: 'offer', Direct: 'offer' })
    expect(listingPolicy({ ...depositOnly, depositChannels: [] }, [service()], LISTING, 'USD')).toEqual({ policy: null, block: 'no_deposit_channel' })
  })

  it('ignores the deposit channels while the waiver is on: every channel is covered', () => {
    const both = { ...defaultListingSetup('lst-x'), deposit: true, depositChannels: [] }
    expect(listingPolicy(both, [service()], LISTING, 'USD').policy?.channelPolicy).toEqual({})
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
