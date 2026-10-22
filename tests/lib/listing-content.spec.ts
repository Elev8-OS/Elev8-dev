import type { Listing } from '~/components/listings/data/listings'
import { describe, expect, it } from 'vitest'
import { formatDistance, listingPhotoDetails, prunePhotoDetails, sortNearby, toMeters } from '~/components/listings/data/listing-content'
import { listings } from '~/components/listings/data/listings'

describe('listing content helpers', () => {
  it('stores distances in whole metres from m or km, refusing nonsense', () => {
    expect(toMeters('350', 'm')).toBe(350)
    expect(toMeters('1,25', 'km')).toBe(1250)
    expect(toMeters(0, 'm')).toBeNull()
    expect(toMeters('far', 'km')).toBeNull()
  })

  it('formats a distance the way channels show it', () => {
    expect(formatDistance(650)).toBe('650 m')
    expect(formatDistance(1250)).toBe('1.3 km')
    expect(formatDistance(18000)).toBe('18 km')
  })

  it('lists nearby places closest first', () => {
    const places = [{ id: 'a', type: 'Airport', name: '', meters: 18000 }, { id: 'b', type: 'Beach', name: '', meters: 300 }]
    expect(sortNearby(places).map(p => p.id)).toEqual(['b', 'a'])
  })

  it('keeps only the details of photos still on the listing, and drops empty ones', () => {
    const details = { 'a.jpg': { caption: 'Pool' }, 'gone.jpg': { type: 'View' }, 'b.jpg': { caption: ' ' } }
    expect(prunePhotoDetails(details, ['a.jpg', 'b.jpg'])).toEqual({ 'a.jpg': { caption: 'Pool' } })
    const listing: Listing = { ...listings.value[0]!, photos: ['a.jpg'], photoDetails: details }
    expect(Object.keys(listingPhotoDetails(listing))).toEqual(['a.jpg'])
  })
})
