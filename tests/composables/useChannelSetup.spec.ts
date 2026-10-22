import type { Listing } from '~/components/listings/data/listings'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOKING_RATE_PLAN_WARNING } from '~/components/channels/data/nextpax-mock'
import { listings } from '~/components/listings/data/listings'
import { CHANNEL_CONNECT_DELAY_MS, CHANNEL_SYNC_DELAY_MS, useChannels } from '~/composables/useChannels'
import { CHANNEL_SSO_DELAY_MS, useChannelSetup } from '~/composables/useChannelSetup'

// `listings` is a module-level ref, so the store reset in setup.ts does not touch it.
let snapshot: Listing[]

beforeEach(() => {
  snapshot = listings.value
  vi.useFakeTimers()
})

afterEach(() => {
  listings.value = snapshot
  vi.useRealTimers()
})

async function settle<T>(promise: Promise<T>, ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  return promise
}

describe('useChannelSetup', () => {
  it('opens a channel the demo already sells on at the Listings step', () => {
    const booking = useChannelSetup('Booking.com')
    expect(booking.accountComplete.value).toBe(true)
    expect(booking.readinessComplete.value).toBe(true)
    expect(booking.firstOpenStep.value).toBe('listings')
  })

  it('opens a new channel at the Account step and moves on as steps get done', () => {
    const expedia = useChannelSetup('Expedia')
    expect(expedia.firstOpenStep.value).toBe('account')
    expedia.setSetting('pricing_model', 'Per night')
    expect(expedia.firstOpenStep.value).toBe('readiness')
    expedia.setPolicy('moderate')
    expect(expedia.firstOpenStep.value).toBe('listings')
  })

  it('only takes an https sign-in link', () => {
    const airbnb = useChannelSetup('Airbnb')
    airbnb.clearAuthorisation()
    expect(airbnb.saveAuthorisation('http://x')).toBe('The link must start with https://')
    expect(airbnb.isSignedIn.value).toBe(false)
    expect(airbnb.saveAuthorisation(' https://airbnb.com/a ')).toBeNull()
    expect(airbnb.state.value.authorisation?.url).toBe('https://airbnb.com/a')
  })

  it('walks Vrbo through link, sign-in and a fresh link resets the sign-in', async () => {
    const vrbo = useChannelSetup('Vrbo')
    vrbo.setSso({ advertiserId: '', signedIn: false, link: null })
    expect(await vrbo.requestSsoLink()).toBe(false)
    vrbo.setSso({ advertiserId: 'ADV-1' })
    expect(await settle(vrbo.requestSsoLink(), CHANNEL_SSO_DELAY_MS)).toBe(true)
    expect(vrbo.state.value.sso.link).toContain('ADV-1')
    vrbo.setSso({ signedIn: true })
    expect(vrbo.isSignedIn.value).toBe(true)
    await settle(vrbo.requestSsoLink(), CHANNEL_SSO_DELAY_MS)
    expect(vrbo.isSignedIn.value).toBe(false)
  })

  it('connects new and linked listings, skips the rest, and creates the account', async () => {
    const expedia = useChannelSetup('Expedia')
    const { getMapping, accountsForChannel } = useChannels()
    expedia.setSetting('pricing_model', 'Per night')
    expedia.setPolicy('strict')
    const [a, b, c] = expedia.pendingListings.value.map(l => l.id)
    expedia.setMode(expedia.pendingListings.value.map(l => l.id), 'skip')
    expedia.setChoice(a!, { mode: 'new' })
    expedia.setChoice(b!, { mode: 'link', propertyId: '4242' })
    expect(expedia.listingsComplete.value).toBe(false)
    expedia.setChoice(b!, { roomId: '7' })
    expect(expedia.listingsComplete.value).toBe(true)

    const pending = expedia.connect()
    const result = await settle(pending, CHANNEL_CONNECT_DELAY_MS + CHANNEL_SYNC_DELAY_MS)
    expect(result?.enabled).toBe(2)
    expect(accountsForChannel('Expedia')).toHaveLength(1)
    expect(getMapping(a!, 'Expedia')?.status).toBe('active')
    expect(getMapping(b!, 'Expedia')?.externalId).toBe('4242')
    expect(getMapping(c!, 'Expedia')).toBeUndefined()
    // What went out has no choice left; the skipped listing keeps its.
    expect(expedia.state.value.choices[a!]).toBeUndefined()
    expect(expedia.state.value.choices[c!]?.mode).toBe('skip')
  })

  it('scoped to one listing, connects only that one and leaves the others\' choices alone', async () => {
    const all = useChannelSetup('Expedia')
    all.setSetting('pricing_model', 'Per night')
    all.setPolicy('moderate')
    const [target, other] = all.pendingListings.value.map(l => l.id)
    all.setChoice(other!, { mode: 'skip' })

    const scoped = useChannelSetup('Expedia', [target!])
    expect(scoped.pendingListings.value.map(l => l.id)).toEqual([target])
    const result = await settle(scoped.connect(), CHANNEL_CONNECT_DELAY_MS + CHANNEL_SYNC_DELAY_MS)
    expect(result?.properties.map(p => p.property_id)).toEqual([target])
    expect(useChannels().mappingsForChannel('Expedia')).toHaveLength(1)
    expect(all.state.value.choices[other!]?.mode).toBe('skip')
  })

  it('refuses to connect before every step is done', async () => {
    expect(await useChannelSetup('Trip.com').connect()).toBeNull()
  })

  it('lands a Booking.com connect warning as needs attention', async () => {
    const booking = useChannelSetup('Booking.com')
    const { getMapping } = useChannels()
    const first = booking.pendingListings.value[0]!.id
    const result = await settle(booking.connect(), CHANNEL_SYNC_DELAY_MS)
    expect(result?.properties[0]?.warnings).toEqual([BOOKING_RATE_PLAN_WARNING])
    expect(getMapping(first, 'Booking.com')).toMatchObject({ status: 'attention', error: BOOKING_RATE_PLAN_WARNING })
  })

  it('spares a linked Booking.com listing whose rate plans are paired from the rate plan warning', async () => {
    const booking = useChannelSetup('Booking.com')
    const { getMapping } = useChannels()
    const [first, second] = booking.pendingListings.value.map(l => l.id)
    booking.setChoice(first!, { mode: 'link', propertyId: '100', roomId: '1', ratePlans: { RP0001: '52011' } })
    const result = await settle(booking.connect(), CHANNEL_SYNC_DELAY_MS)
    expect(result?.properties.find(p => p.property_id === first)?.warnings).toBeUndefined()
    expect(getMapping(first!, 'Booking.com')?.status).toBe('active')
    // The warning moves to the next listing created new, so the case stays visible.
    expect(getMapping(second!, 'Booking.com')?.status).toBe('attention')
  })

  it('turns a channel off for every listing on it', () => {
    const airbnb = useChannelSetup('Airbnb')
    const { mappingsForChannel } = useChannels()
    const count = mappingsForChannel('Airbnb').length
    expect(airbnb.turnOff()).toBe(count)
    expect(mappingsForChannel('Airbnb')).toHaveLength(0)
  })
})
