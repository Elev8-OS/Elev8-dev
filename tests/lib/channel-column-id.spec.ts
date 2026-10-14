import { describe, expect, it } from 'vitest'
import { channelColumnId, channelForColumnId, CHANNELS } from '~/components/channels/data/channels'

describe('channelColumnId', () => {
  it('slugs the channel name under the ota_ prefix', () => {
    expect(channelColumnId('Airbnb')).toBe('ota_airbnb')
    expect(channelColumnId('Booking.com')).toBe('ota_booking-com')
    expect(channelColumnId('Google Vacation Rentals')).toBe('ota_google-vacation-rentals')
  })

  it('gives every channel its own id', () => {
    const ids = CHANNELS.map(c => channelColumnId(c.name))
    expect(new Set(ids).size).toBe(CHANNELS.length)
  })
})

describe('channelForColumnId', () => {
  it('finds the channel back from its column id', () => {
    for (const channel of CHANNELS)
      expect(channelForColumnId(channelColumnId(channel.name))?.name).toBe(channel.name)
  })

  it('ignores other columns', () => {
    expect(channelForColumnId('aiStatus')).toBeUndefined()
    expect(channelForColumnId('ota_unknown')).toBeUndefined()
  })
})
