import { describe, expect, it } from 'vitest'
import { channelListingUrl } from '~/components/channels/data/channels'
import { mockExternalId, roomTypeExternalId } from '~/composables/useChannels'

describe('channelListingUrl', () => {
  it('opens an Airbnb listing by its listing id', () => {
    expect(channelListingUrl('Airbnb', '12345678')).toBe('https://www.airbnb.com/rooms/12345678')
  })

  it('opens a Booking.com property by the account hotel id', () => {
    expect(channelListingUrl('Booking.com', '555', '9876543')).toBe('https://www.booking.com/searchresults.html?dest_type=hotel&dest_id=9876543')
  })

  it('returns null without the id the channel needs', () => {
    expect(channelListingUrl('Airbnb', ' ')).toBeNull()
    expect(channelListingUrl('Booking.com', '555', '')).toBeNull()
  })

  it('returns null for a channel with no public page', () => {
    expect(channelListingUrl('Google Vacation Rentals', '1', '2')).toBeNull()
  })
})

describe('roomTypeExternalId', () => {
  it('gives each room type its own stable OTA id', () => {
    const a = roomTypeExternalId('l1', 'type-a', 'Airbnb')
    expect(a).toBe(roomTypeExternalId('l1', 'type-a', 'Airbnb'))
    expect(a).not.toBe(roomTypeExternalId('l1', 'type-b', 'Airbnb'))
    expect(a).not.toBe(mockExternalId('l1', 'Airbnb'))
  })
})
