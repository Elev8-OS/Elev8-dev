import { describe, expect, it } from 'vitest'
import { getListingsForProperty, propertyListingMap } from '../../app/components/website-builder/data/property-listings'

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
})
