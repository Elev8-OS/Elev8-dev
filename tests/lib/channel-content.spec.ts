import type { Listing } from '~/components/listings/data/listings'
import { describe, expect, it } from 'vitest'
import { channelContentChecks, CONTENT_CHECKS, contentSummary, DESCRIPTION_MIN } from '~/components/channels/data/channel-content'
import { listings } from '~/components/listings/data/listings'

function ready(): Listing {
  const base = listings.value[0]!
  return {
    ...base,
    name: 'Villa Sari',
    photos: Array.from({ length: 6 }, (_, i) => `p${i}.jpg`),
    amenities: ['Pool'],
    address: { street: 'Jl. Raya 1', unitNumber: '', city: 'Ubud', state: 'Bali', postalCode: '80571', country: 'ID' },
    details: { ...base.details, bedrooms: 'Two bedrooms, king beds' },
    resources: { ...base.resources, basics: { ...base.resources.basics, description: 'x'.repeat(DESCRIPTION_MIN) } },
  }
}

const byKey = (listing: Listing, channel: string) => Object.fromEntries(channelContentChecks(listing, channel).map(c => [c.key, c]))

describe('channelContentChecks', () => {
  it('passes a complete listing on every channel, in CONTENT_CHECKS order', () => {
    const checks = channelContentChecks(ready(), 'Vrbo')
    expect(checks.map(c => c.key)).toEqual(CONTENT_CHECKS.map(c => c.key))
    expect(checks.every(c => c.ok)).toBe(true)
  })

  it('measures photos against the channel\'s own minimum, as a warning', () => {
    const listing = { ...ready(), photos: ['a', 'b', 'c', 'd'] }
    expect(byKey(listing, 'Booking.com').photos!.ok).toBe(true)
    expect(byKey(listing, 'Airbnb').photos).toMatchObject({ ok: false, blocking: false, detail: '4 of 5 photos' })
  })

  it('blocks a name longer than the channel shows', () => {
    const listing = { ...ready(), name: 'A'.repeat(60) }
    expect(byKey(listing, 'Airbnb').name).toMatchObject({ ok: false, blocking: true, detail: '60 characters, Airbnb shows 50' })
    expect(byKey(listing, 'Booking.com').name!.ok).toBe(true)
  })

  it('blocks a short description and a missing street, naming what is missing', () => {
    const base = ready()
    const listing = {
      ...base,
      address: { ...base.address!, street: '' },
      resources: { ...base.resources, basics: { ...base.resources.basics, description: 'Lovely' } },
    }
    const checks = byKey(listing, 'Expedia')
    expect(checks.description).toMatchObject({ ok: false, blocking: true, detail: `6 of ${DESCRIPTION_MIN} characters` })
    expect(checks.address).toMatchObject({ ok: false, detail: 'No street' })
    expect(contentSummary(channelContentChecks(listing, 'Expedia'))).toEqual({ blocking: 2, warnings: 0 })
  })
})
