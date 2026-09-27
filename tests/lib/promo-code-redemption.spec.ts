// A free-upsell code resolves per listing: two regional copies of one service
// (Floating Breakfast West / Central) sit on one code, and each guest gets the one
// offered at their villa. A listing that offers none of them rejects the code.

import type { RedemptionUpsellService } from '~/components/promo-code/data/promo-code-redemption'
import type { PromoCode } from '~/components/promo-code/data/promo-codes'
import { describe, expect, it } from 'vitest'
import { listings as allListings } from '~/components/listings/data/listings'
import {
  evaluatePromoCode,
  freeUpsellGrantsForListing,
  listingsWithoutFreeUpsell,
  nightsBetween,
  PROMO_REJECTION_MESSAGES,
  resolveFreeUpsellPicks,
} from '~/components/promo-code/data/promo-code-redemption'
import { promoCodes } from '~/components/promo-code/data/promo-codes'
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'

function service(overrides: Partial<RedemptionUpsellService> & { id: string }): RedemptionUpsellService {
  return {
    name: overrides.id,
    category: 'Miscellaneous',
    currency: 'IDR',
    status: 'active',
    availability: 'always',
    assignedListings: [],
    items: [],
    ...overrides,
  }
}

const west = service({
  id: 'svc-west',
  name: 'Floating Breakfast (West)',
  assignedListings: ['Villa Canggu', 'Villa Both'],
  items: [{ id: 'itm-west', name: 'Breakfast for 2', price: 450000 }],
})
const central = service({
  id: 'svc-central',
  name: 'Floating Breakfast (Central)',
  assignedListings: ['Villa Ubud', 'Villa Both'],
  items: [{ id: 'itm-central', name: 'Breakfast for 2', price: 400000 }],
})
const spa = service({
  id: 'svc-spa',
  name: 'Spa',
  assignedListings: ['Villa Canggu', 'Villa Ubud'],
  items: [
    { id: 'itm-spa60', name: 'Spa 60 min', price: 600000 },
    { id: 'itm-spa90', name: 'Spa 90 min', price: 850000 },
  ],
})
const services = [west, central, spa]
const breakfastIds = ['itm-west', 'itm-central']

function code(overrides: Partial<PromoCode> = {}): PromoCode {
  return {
    id: 'promo-xmas',
    code: 'MERRYCHRISTMAS',
    discountType: 'free_upsell',
    value: 0,
    currency: null,
    active: true,
    bookingWindows: [],
    stayWindows: [],
    usageLimit: null,
    redemptionCount: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    freeUpsellItemIds: breakfastIds,
    listingIds: [],
    channelRestriction: { channel: 'widget', websiteIds: [] },
    ...overrides,
  }
}

const request = {
  listingId: 'lst-canggu',
  listingName: 'Villa Canggu',
  channel: 'widget' as const,
  checkIn: '2026-12-22',
  checkOut: '2026-12-26',
}

describe('freeUpsellGrantsForListing', () => {
  it('gives a guest only the regional service offered at their listing', () => {
    expect(freeUpsellGrantsForListing(breakfastIds, services, 'Villa Canggu').map(g => g.serviceId)).toEqual(['svc-west'])
    expect(freeUpsellGrantsForListing(breakfastIds, services, 'Villa Ubud').map(g => g.serviceId)).toEqual(['svc-central'])
  })

  it('gives both when a listing is offered both', () => {
    expect(freeUpsellGrantsForListing(breakfastIds, services, 'Villa Both').map(g => g.serviceId)).toEqual(['svc-west', 'svc-central'])
  })

  it('gives nothing at a listing none of the services reach', () => {
    expect(freeUpsellGrantsForListing(breakfastIds, services, 'Villa Kintamani')).toEqual([])
  })

  it('skips a service switched off in the catalog', () => {
    const off = [{ ...west, status: 'inactive' as const }, central]
    expect(freeUpsellGrantsForListing(breakfastIds, off, 'Villa Canggu')).toEqual([])
  })

  it('only counts items the code picked, keeping their catalog price', () => {
    const [grant] = freeUpsellGrantsForListing(['itm-spa90'], services, 'Villa Ubud')
    expect(grant!.choices).toEqual([{ id: 'itm-spa90', name: 'Spa 90 min', price: 850000 }])
  })
})

describe('listingsWithoutFreeUpsell', () => {
  it('judges every picked service together', () => {
    // Neither breakfast reaches all three alone; together they do.
    expect(listingsWithoutFreeUpsell(breakfastIds, services, ['Villa Canggu', 'Villa Ubud', 'Villa Both'])).toEqual([])
  })

  it('names the listings nothing reaches', () => {
    expect(listingsWithoutFreeUpsell(breakfastIds, services, ['Villa Canggu', 'Villa Kintamani'])).toEqual(['Villa Kintamani'])
  })
})

describe('evaluatePromoCode', () => {
  const now = new Date(2026, 9, 1)

  it('accepts the code and returns what the guest gets', () => {
    const result = evaluatePromoCode(code(), request, services, now)
    expect(result.ok).toBe(true)
    expect(result.ok && result.grants.map(g => g.serviceId)).toEqual(['svc-west'])
  })

  it('rejects a listing with no matching upsell, with the property message', () => {
    const result = evaluatePromoCode(code(), { ...request, listingName: 'Villa Kintamani' }, services, now)
    expect(result).toEqual({ ok: false, reason: 'no_free_upsell', message: PROMO_REJECTION_MESSAGES.no_free_upsell })
    expect(PROMO_REJECTION_MESSAGES.no_free_upsell).toBe(PROMO_REJECTION_MESSAGES.listing)
  })

  it('rejects a listing outside the code scope', () => {
    const result = evaluatePromoCode(code({ listingIds: ['lst-other'] }), request, services, now)
    expect(result.ok === false && result.reason).toBe('listing')
  })

  it('rejects an inactive code', () => {
    const result = evaluatePromoCode(code({ active: false }), request, services, now)
    expect(result.ok === false && result.reason).toBe('inactive')
  })

  it('rejects a code at its usage limit', () => {
    const result = evaluatePromoCode(code({ usageLimit: 5, redemptionCount: 5 }), request, services, now)
    expect(result.ok === false && result.reason).toBe('usage_limit')
  })

  it('rejects the wrong channel and an unlisted website', () => {
    expect(evaluatePromoCode(code(), { ...request, channel: 'website' }, services, now)).toMatchObject({ reason: 'channel' })
    const siteCode = code({ channelRestriction: { channel: 'website', websiteIds: ['site-a'] } })
    expect(evaluatePromoCode(siteCode, { ...request, channel: 'website', websiteId: 'site-b' }, services, now)).toMatchObject({ reason: 'channel' })
    expect(evaluatePromoCode(siteCode, { ...request, channel: 'website', websiteId: 'site-a' }, services, now).ok).toBe(true)
  })

  it('rejects a check-in outside the stay window', () => {
    const windowed = code({ stayWindows: [{ from: '2026-12-20T00:00:00Z', until: '2027-01-05T00:00:00Z' }] })
    expect(evaluatePromoCode(windowed, request, services, now).ok).toBe(true)
    expect(evaluatePromoCode(windowed, { ...request, checkIn: '2026-11-01', checkOut: '2026-11-05' }, services, now)).toMatchObject({ reason: 'stay_window' })
  })

  it('rejects a booking made outside the booking window', () => {
    const closed = code({ bookingWindows: [{ from: '2026-11-01T00:00:00Z', until: '2026-12-24T00:00:00Z' }] })
    expect(evaluatePromoCode(closed, request, services, now)).toMatchObject({ reason: 'booking_window' })
  })

  it('rejects a stay that is too short', () => {
    const result = evaluatePromoCode(code({ lengthOfStayMin: 5 }), request, services, now)
    expect(result.ok === false && result.reason).toBe('length_of_stay')
  })
})

describe('resolveFreeUpsellPicks', () => {
  it('needs no answer for a service with one item', () => {
    const grants = freeUpsellGrantsForListing(breakfastIds, services, 'Villa Both')
    const result = resolveFreeUpsellPicks(grants)
    expect(result.ok && result.picks.map(p => p.item.id)).toEqual(['itm-west', 'itm-central'])
  })

  it('asks the guest to pick one item when a service has several', () => {
    const grants = freeUpsellGrantsForListing(['itm-spa60', 'itm-spa90'], services, 'Villa Ubud')
    expect(resolveFreeUpsellPicks(grants)).toEqual({ ok: false, missingServiceIds: ['svc-spa'] })
    const picked = resolveFreeUpsellPicks(grants, { 'svc-spa': 'itm-spa90' })
    expect(picked.ok && picked.picks.map(p => p.item.id)).toEqual(['itm-spa90'])
  })
})

describe('nightsBetween', () => {
  it('counts nights between local dates', () => {
    expect(nightsBetween('2026-12-22', '2026-12-26')).toBe(4)
  })
})

describe('the MERRYCHRISTMAS seed', () => {
  it('gives exactly one breakfast at every listing it covers', () => {
    const seed = promoCodes.value.find(c => c.code === 'MERRYCHRISTMAS')!
    const scoped = allListings.value.filter(l => seed.listingIds!.includes(l.id))
    expect(scoped).toHaveLength(seed.listingIds!.length)
    for (const listing of scoped) {
      const grants = freeUpsellGrantsForListing(seed.freeUpsellItemIds!, mockUpsellServices, listing.name)
      expect(grants, listing.name).toHaveLength(1)
    }
  })
})
