import type { Website } from '../../app/components/website-builder/data/websites'
import { describe, expect, it } from 'vitest'
import { getListingsForProperties, getListingsForProperty, propertyListingMap, propertyNames } from '../../app/components/website-builder/data/property-listings'

describe('propertyListingMap', () => {
  it('maps every property id to at least one listing id', () => {
    expect(Object.keys(propertyListingMap).length).toBeGreaterThan(0)
    for (const listings of Object.values(propertyListingMap)) {
      expect(listings.length).toBeGreaterThan(0)
    }
  })

  it('returns the mapped listings for a known property', () => {
    expect(getListingsForProperty('prop-1')).toEqual(['lst-1', 'lst-5'])
  })

  it('returns an empty array for an unknown property', () => {
    expect(getListingsForProperty('unknown')).toEqual([])
  })

  it('returns the union of listings for multiple properties', () => {
    expect(getListingsForProperties(['prop-1', 'prop-2'])).toEqual(['lst-1', 'lst-5', 'lst-12'])
  })

  it('deduplicates listings shared across properties', () => {
    expect(getListingsForProperties(['prop-1', 'prop-3'])).toEqual(['lst-1', 'lst-5', 'lst-12'])
  })

  it('returns an empty array for no properties', () => {
    expect(getListingsForProperties([])).toEqual([])
  })

  it('maps every property id to a display name', () => {
    for (const id of Object.keys(propertyListingMap)) {
      expect(propertyNames[id]).toBeTruthy()
    }
  })
})

describe('website type', () => {
  it('accepts reviewIds and manualReviews', () => {
    const site: Website = {
      id: 'x',
      name: 'X',
      url: 'x.com',
      status: 'published',
      template: 'Luxury Villa',
      visits: 0,
      lastUpdated: '2026-01-01T00:00:00Z',
      thumbnail: null,
      reviewIds: ['rr-001'],
      manualReviews: [{ id: 'm1', guestName: 'G', rating: 9, text: 'Great', source: 'manual' }],
    }
    expect(site.reviewIds).toHaveLength(1)
    expect(site.manualReviews[0].guestName).toBe('G')
  })
})
