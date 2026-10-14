import { describe, expect, it } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'
import { buildWebsiteBookingSource } from '~/components/reservations/data/website-booking'
import { getListingIdsForWebsite } from '~/components/website-builder/data/property-listings'
import { websites } from '~/components/website-builder/data/websites'

const site = { id: '1', name: 'Villa Sunset Bali', url: 'villa-sunset-bali.com' }

describe('buildWebsiteBookingSource', () => {
  it('copies the site, the rule set and the quote discounts', () => {
    const source = buildWebsiteBookingSource({
      website: site,
      ruleSet: { id: 'wrs-1', name: 'Bali villas' },
      quote: { currency: 'USD', discounts: [{ label: '7+ nights 10%', amount: 70 }, { label: 'Early bird 5%', amount: 35 }] },
      currency: 'USD',
    })
    expect(source).toEqual({
      websiteId: '1',
      websiteName: 'Villa Sunset Bali',
      websiteUrl: 'villa-sunset-bali.com',
      ruleSetId: 'wrs-1',
      ruleSetName: 'Bali villas',
      discounts: [{ label: '7+ nights 10%', amount: 70 }, { label: 'Early bird 5%', amount: 35 }],
    })
  })

  it('records no rule set when the site is in none', () => {
    const source = buildWebsiteBookingSource({ website: site, ruleSet: undefined, quote: null, currency: 'IDR' })
    expect(source.ruleSetId).toBeNull()
    expect(source.ruleSetName).toBeNull()
    expect(source.discounts).toEqual([])
  })

  it('drops discounts quoted in another currency instead of converting', () => {
    const source = buildWebsiteBookingSource({
      website: site,
      ruleSet: null,
      quote: { currency: 'USD', discounts: [{ label: 'Weekly 10%', amount: 70 }] },
      currency: 'IDR',
    })
    expect(source.discounts).toEqual([])
  })

  it('freezes a copy: later edits to the inputs do not reach the snapshot', () => {
    const website = { ...site }
    const ruleSet = { id: 'wrs-1', name: 'Bali villas' }
    const quote = { currency: 'USD', discounts: [{ label: 'Early bird 5%', amount: 35, source: 'website' }] }
    const source = buildWebsiteBookingSource({ website, ruleSet, quote, currency: 'USD' })
    website.name = 'Renamed'
    ruleSet.name = 'Renamed set'
    quote.discounts[0]!.amount = 999
    expect(source.websiteName).toBe('Villa Sunset Bali')
    expect(source.ruleSetName).toBe('Bali villas')
    expect(source.discounts).toEqual([{ label: 'Early bird 5%', amount: 35 }])
  })
})

describe('seeded website bookings', () => {
  const seeded = initialReservations.filter(r => r.websiteBooking)

  it('has at least one website booking', () => {
    expect(seeded.length).toBeGreaterThan(0)
  })

  it('only on Direct stays whose listing the website sells', () => {
    for (const r of seeded) {
      expect(r.channel).toBe('Direct')
      const website = websites.value.find(w => w.id === r.websiteBooking!.websiteId)
      expect(website).toBeDefined()
      expect(getListingIdsForWebsite(website!)).toContain(r.listingId)
    }
  })

  it('includes a booking with no rule set', () => {
    expect(seeded.some(r => r.websiteBooking!.ruleSetName === null)).toBe(true)
  })
})
