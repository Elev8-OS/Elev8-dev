import type { Listing } from '~/components/listings/data/listings'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { otaIcon } from '~/components/channels/data/channels'
import { listings } from '~/components/listings/data/listings'
import { CHANNEL_CONNECT_DELAY_MS, CHANNEL_SYNC_DELAY_MS, useChannels } from '~/composables/useChannels'

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

function otasOf(id: string) {
  return listings.value.find(l => l.id === id)!.otaConnected
}

describe('useChannels', () => {
  it('seeds accounts and mappings from the listings already on a channel', () => {
    const { accounts, mappings, isConnected } = useChannels()
    expect(isConnected('Airbnb')).toBe(true)
    expect(isConnected('Booking.com')).toBe(true)
    expect(isConnected('Expedia')).toBe(false)
    expect(accounts.value.length).toBeGreaterThan(0)
    const total = listings.value.reduce((n, l) => n + l.otaConnected.length, 0)
    expect(mappings.value).toHaveLength(total)
  })

  it('connects an account after the mocked round trip', async () => {
    const { connectAccount, isConnected } = useChannels()
    const pending = connectAccount('Expedia', { accountName: 'Test', propertyId: '123' })
    expect(isConnected('Expedia')).toBe(false)
    await vi.advanceTimersByTimeAsync(CHANNEL_CONNECT_DELAY_MS)
    expect((await pending)?.propertyId).toBe('123')
    expect(isConnected('Expedia')).toBe(true)
  })

  it('refuses to map a listing to an account that does not exist', async () => {
    const { connectListings } = useChannels()
    const id = listings.value[0]!.id
    expect(await connectListings('acc-missing', [{ listingId: id }])).toBe(0)
  })

  it('maps listings, writes otaConnected and goes live after syncing', async () => {
    const { connectAccount, connectListings, getMapping } = useChannels()
    const connecting = connectAccount('Expedia', { accountName: '', propertyId: '9' })
    await vi.advanceTimersByTimeAsync(CHANNEL_CONNECT_DELAY_MS)
    const account = (await connecting)!

    const id = listings.value[0]!.id
    const pending = connectListings(account.id, [{ listingId: id, externalId: ' 555 ' }])
    expect(getMapping(id, 'Expedia')?.accountId).toBe(account.id)
    expect(getMapping(id, 'Expedia')?.status).toBe('syncing')
    expect(getMapping(id, 'Expedia')?.externalId).toBe('555')
    expect(otasOf(id)).toContain('Expedia')

    await vi.advanceTimersByTimeAsync(CHANNEL_SYNC_DELAY_MS)
    expect(await pending).toBe(1)
    expect(getMapping(id, 'Expedia')?.status).toBe('active')
    expect(getMapping(id, 'Expedia')?.lastSyncAt).not.toBeNull()
  })

  it('skips listings already on the channel during a bulk connect', async () => {
    const { connectListings, accountsForChannel } = useChannels()
    const on = listings.value.find(l => l.otaConnected.includes('Airbnb'))!
    const off = listings.value.find(l => !l.otaConnected.includes('Airbnb'))!
    const pending = connectListings(accountsForChannel('Airbnb')[0]!.id, [{ listingId: on.id }, { listingId: off.id }])
    await vi.advanceTimersByTimeAsync(CHANNEL_SYNC_DELAY_MS)
    expect(await pending).toBe(1)
    expect(otasOf(off.id)).toContain('Airbnb')
  })

  it('disconnecting a listing removes it from otaConnected', () => {
    const { disconnectListing, getMapping } = useChannels()
    const l = listings.value.find(x => x.otaConnected.includes('Airbnb'))!
    disconnectListing(l.id, 'Airbnb')
    expect(getMapping(l.id, 'Airbnb')).toBeUndefined()
    expect(otasOf(l.id)).not.toContain('Airbnb')
  })

  it('seeds two Airbnb and two Booking.com accounts', () => {
    const { accountsForChannel, mappingsForAccount } = useChannels()
    for (const channel of ['Airbnb', 'Booking.com']) {
      const accs = accountsForChannel(channel)
      expect(accs).toHaveLength(2)
      for (const a of accs)
        expect(mappingsForAccount(a.id).length).toBeGreaterThan(0)
    }
    expect(accountsForChannel('Vrbo')).toHaveLength(1)
  })

  it('a listing is on a channel through one account only', async () => {
    const { accountsForChannel, connectListings, getMapping, mappingsForChannel } = useChannels()
    const on = listings.value.find(l => l.otaConnected.includes('Airbnb'))!
    const current = getMapping(on.id, 'Airbnb')!.accountId
    const other = accountsForChannel('Airbnb').find(a => a.id !== current)!
    const pending = connectListings(other.id, [{ listingId: on.id }])
    await vi.advanceTimersByTimeAsync(CHANNEL_SYNC_DELAY_MS)
    expect(await pending).toBe(0)
    expect(mappingsForChannel('Airbnb').filter(m => m.listingId === on.id)).toHaveLength(1)
  })

  it('refuses a property id already linked on the same channel', async () => {
    const { accountsForChannel, connectAccount, isPropertyIdTaken } = useChannels()
    const taken = accountsForChannel('Booking.com')[0]!.propertyId
    expect(isPropertyIdTaken('Booking.com', taken)).toBe(true)
    expect(isPropertyIdTaken('Expedia', taken)).toBe(false)
    expect(await connectAccount('Booking.com', { accountName: 'Dup', propertyId: taken })).toBeNull()
    expect(accountsForChannel('Booking.com')).toHaveLength(2)
  })

  it('moves a listing to another account on the same channel', async () => {
    const { accountsForChannel, mappingsForAccount, moveToAccount, getMapping } = useChannels()
    const [a, b] = accountsForChannel('Airbnb')
    const mapping = mappingsForAccount(a!.id)[0]!
    const pending = moveToAccount(mapping.id, b!.id)
    expect(getMapping(mapping.listingId, 'Airbnb')?.status).toBe('syncing')
    await vi.advanceTimersByTimeAsync(CHANNEL_SYNC_DELAY_MS)
    expect(await pending).toBe(true)
    expect(getMapping(mapping.listingId, 'Airbnb')?.accountId).toBe(b!.id)
    expect(getMapping(mapping.listingId, 'Airbnb')?.status).toBe('active')
  })

  it('disconnecting one account leaves the other accounts on the channel alone', () => {
    const { accountsForChannel, disconnectAccount, isConnected, mappingsForAccount } = useChannels()
    const [a, b] = accountsForChannel('Booking.com')
    const onA = mappingsForAccount(a!.id).map(m => m.listingId)
    const keptB = mappingsForAccount(b!.id).length
    expect(disconnectAccount(a!.id)).toBe(onA.length)
    expect(isConnected('Booking.com')).toBe(true)
    expect(mappingsForAccount(b!.id)).toHaveLength(keptB)
    for (const id of onA)
      expect(otasOf(id)).not.toContain('Booking.com')

    disconnectAccount(b!.id)
    expect(isConnected('Booking.com')).toBe(false)
    expect(listings.value.some(l => l.otaConnected.includes('Booking.com'))).toBe(false)
  })

  it('resync clears a seeded error', async () => {
    const { mappings, resync, errorCount } = useChannels()
    const broken = mappings.value.find(m => m.status === 'error')!
    expect(errorCount.value).toBe(1)
    const pending = resync(broken.id)
    await vi.advanceTimersByTimeAsync(CHANNEL_SYNC_DELAY_MS)
    await pending
    expect(errorCount.value).toBe(0)
    expect(mappings.value.find(m => m.id === broken.id)?.error).toBeUndefined()
  })

  it('gives every OTA name a logo', () => {
    expect(otaIcon('Airbnb')).toBe('logos:airbnb-icon')
    expect(otaIcon('Booking.com')).toBe('simple-icons:bookingdotcom')
    expect(otaIcon('Unknown')).toBe('lucide:globe')
  })
})
