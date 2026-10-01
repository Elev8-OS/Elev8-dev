import type { ChannelAccount, ChannelMapping } from '~/components/channels/data/channels'
import type { RemoteListing } from '~/components/channels/data/remote-listings'
import type { Listing } from '~/components/listings/data/listings'
import { CHANNELS, getChannel } from '~/components/channels/data/channels'
import { listings } from '~/components/listings/data/listings'

/** Mocked round trip to the channel manager. */
export const CHANNEL_CONNECT_DELAY_MS = 1200
export const CHANNEL_SYNC_DELAY_MS = 1500
export const CHANNEL_FETCH_DELAY_MS = 1000

/** How many not-yet-linked listings a mocked OTA account returns. */
const UNLINKED_REMOTE_COUNT = 4

/** Seeded listings of this property sit on their own Airbnb / Booking.com accounts. */
const SECOND_ACCOUNT_PROPERTY = 'Elev8 Suite DACH'

function wait(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

/** Stable fake OTA id, so the seeded mappings look the same on every load. */
export function mockExternalId(listingId: string, channel: string): string {
  let hash = 0
  for (const char of `${listingId}:${channel}`)
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return String(10000000 + (hash % 89999999))
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function seedAccount(channel: string, accountName: string): ChannelAccount {
  return {
    id: `acc-${slug(channel)}-${slug(accountName)}`,
    channel,
    accountName,
    propertyId: getChannel(channel)?.method === 'property_id' ? mockExternalId(accountName, channel) : '',
    connectedAt: '2026-03-12T09:00:00',
  }
}

/** Which seeded account a listing already on `channel` belongs to. */
function seedAccountName(listingProperty: string, channel: string) {
  const split = channel === 'Airbnb' || channel === 'Booking.com'
  return split && listingProperty === SECOND_ACCOUNT_PROPERTY ? SECOND_ACCOUNT_PROPERTY : 'Elev8 Bali Villas'
}

/** OTA titles never match ours exactly; vary them so the matching has work to do. */
function remoteTitle(listing: Listing, variant: number) {
  const city = listing.location.split(',')[0]
  switch (variant % 3) {
    case 1: return `${listing.name} with private pool`
    case 2: return `${listing.name}, ${city}`
    default: return listing.name
  }
}

function seedAccounts(): ChannelAccount[] {
  const seen = new Map<string, ChannelAccount>()
  for (const l of listings.value) {
    for (const channel of l.otaConnected) {
      const account = seedAccount(channel, seedAccountName(l.property, channel))
      seen.set(account.id, account)
    }
  }
  // Catalog order, then account name, so cards render the same on every load.
  const order = CHANNELS.map(c => c.name)
  return [...seen.values()].sort((a, b) => order.indexOf(a.channel) - order.indexOf(b.channel) || a.accountName.localeCompare(b.accountName))
}

function seedMappings(): ChannelMapping[] {
  const mappings: ChannelMapping[] = listings.value.flatMap(l => l.otaConnected.map(channel => ({
    id: `map-${l.id}-${channel}`,
    listingId: l.id,
    channel,
    accountId: seedAccount(channel, seedAccountName(l.property, channel)).id,
    externalId: mockExternalId(l.id, channel),
    status: 'active' as const,
    lastSyncAt: '2026-09-30T23:40:00',
  })))
  // One broken mapping so the error state is visible in the demo.
  const broken = mappings.find(m => m.channel === 'Booking.com')
  if (broken) {
    broken.status = 'error'
    broken.error = 'Rate plan not mapped on Booking.com. Prices are not being pushed.'
  }
  return mappings
}

/**
 * Channel accounts and listing mappings. A channel can have many accounts; a
 * listing is on a channel through at most one of them.
 *
 * This composable is the only writer of `Listing.otaConnected`: every connect
 * or disconnect keeps it equal to the set of channels the listing has a mapping on.
 */
export function useChannels() {
  const accounts = useState<ChannelAccount[]>('channel-accounts', seedAccounts)
  const mappings = useState<ChannelMapping[]>('channel-mappings', seedMappings)

  function isConnected(channel: string) {
    return accounts.value.some(a => a.channel === channel)
  }

  function getAccount(accountId: string) {
    return accounts.value.find(a => a.id === accountId)
  }

  function accountsForChannel(channel: string) {
    return accounts.value.filter(a => a.channel === channel)
  }

  /** A property id can be linked to one account only, per channel. */
  function isPropertyIdTaken(channel: string, propertyId: string) {
    const id = propertyId.trim()
    return id !== '' && accounts.value.some(a => a.channel === channel && a.propertyId === id)
  }

  // The listings matrix asks for every listing × channel cell, so look up by key.
  const mappingIndex = computed(() => new Map(mappings.value.map(m => [`${m.listingId}|${m.channel}`, m])))

  function getMapping(listingId: string, channel: string) {
    return mappingIndex.value.get(`${listingId}|${channel}`)
  }

  function mappingsForChannel(channel: string) {
    return mappings.value.filter(m => m.channel === channel)
  }

  function mappingsForAccount(accountId: string) {
    return mappings.value.filter(m => m.accountId === accountId)
  }

  function syncListingOtas(listingIds: string[]) {
    const ids = new Set(listingIds)
    listings.value = listings.value.map((l) => {
      if (!ids.has(l.id))
        return l
      const mapped = mappings.value.filter(m => m.listingId === l.id).map(m => m.channel)
      // Keep the catalog order so badges render the same everywhere.
      const otaConnected = CHANNELS.map(c => c.name).filter(n => mapped.includes(n))
      return { ...l, otaConnected }
    })
  }

  const connectedChannels = computed(() => CHANNELS.filter(c => isConnected(c.name)))
  const mappedListingCount = computed(() => new Set(mappings.value.map(m => m.listingId)).size)
  const unmappedListingCount = computed(() => listings.value.length - mappedListingCount.value)
  const errorCount = computed(() => mappings.value.filter(m => m.status === 'error').length)

  /** Adds an account to a channel. Returns null when the property id is already linked. */
  async function connectAccount(channel: string, details: { accountName: string, propertyId: string }) {
    if (isPropertyIdTaken(channel, details.propertyId))
      return null
    await wait(CHANNEL_CONNECT_DELAY_MS)
    if (isPropertyIdTaken(channel, details.propertyId))
      return null
    const account: ChannelAccount = {
      id: `acc-${slug(channel)}-${Date.now().toString(36)}`,
      channel,
      accountName: details.accountName.trim() || channel,
      propertyId: details.propertyId.trim(),
      connectedAt: new Date().toISOString(),
    }
    accounts.value = [...accounts.value, account]
    return account
  }

  /** Disconnecting an account unpublishes every listing on it. Other accounts on the channel are untouched. */
  function disconnectAccount(accountId: string) {
    const affected = mappingsForAccount(accountId).map(m => m.listingId)
    accounts.value = accounts.value.filter(a => a.id !== accountId)
    mappings.value = mappings.value.filter(m => m.accountId !== accountId)
    syncListingOtas(affected)
    return affected.length
  }

  function finishSync(ids: string[]) {
    const set = new Set(ids)
    const now = new Date().toISOString()
    mappings.value = mappings.value.map(m => set.has(m.id) && m.status === 'syncing'
      ? { ...m, status: 'active', lastSyncAt: now, error: undefined }
      : m)
  }

  /**
   * Maps listings to a channel through one account. Returns the number of new
   * mappings. Listings already on the channel (through any account) are
   * skipped; an empty external id is auto-matched.
   */
  async function connectListings(accountId: string, items: { listingId: string, externalId?: string }[]) {
    const account = getAccount(accountId)
    if (!account)
      return 0
    const channel = account.channel
    const fresh = items.filter(i => !getMapping(i.listingId, channel))
    if (fresh.length === 0)
      return 0
    const created: ChannelMapping[] = fresh.map(i => ({
      id: `map-${i.listingId}-${channel}`,
      listingId: i.listingId,
      channel,
      accountId,
      externalId: i.externalId?.trim() || mockExternalId(i.listingId, channel),
      status: 'syncing',
      lastSyncAt: null,
    }))
    mappings.value = [...mappings.value, ...created]
    syncListingOtas(fresh.map(i => i.listingId))
    await wait(CHANNEL_SYNC_DELAY_MS)
    finishSync(created.map(m => m.id))
    return created.length
  }

  /** Moves a listing to another account on the same channel; it is pushed again. */
  async function moveToAccount(mappingId: string, accountId: string) {
    const mapping = mappings.value.find(m => m.id === mappingId)
    const account = getAccount(accountId)
    if (!mapping || !account || account.channel !== mapping.channel || mapping.accountId === accountId)
      return false
    mappings.value = mappings.value.map(m => m.id === mappingId ? { ...m, accountId, status: 'syncing' } : m)
    await wait(CHANNEL_SYNC_DELAY_MS)
    finishSync([mappingId])
    return true
  }

  function disconnectListing(listingId: string, channel: string) {
    mappings.value = mappings.value.filter(m => !(m.listingId === listingId && m.channel === channel))
    syncListingOtas([listingId])
  }

  function updateExternalId(mappingId: string, externalId: string) {
    mappings.value = mappings.value.map(m => m.id === mappingId ? { ...m, externalId: externalId.trim() } : m)
  }

  /**
   * Listings that exist on an OTA account: the ones already linked, some not
   * linked yet, and one with no Elev8 counterpart.
   */
  async function fetchRemoteListings(accountId: string): Promise<RemoteListing[]> {
    await wait(CHANNEL_FETCH_DELAY_MS)
    const account = getAccount(accountId)
    if (!account)
      return []
    const byId = new Map(listings.value.map(l => [l.id, l]))
    const linked = mappingsForAccount(accountId).flatMap((m, i) => {
      const l = byId.get(m.listingId)
      return l ? [{ externalId: m.externalId, title: remoteTitle(l, i), location: l.location }] : []
    })
    // The seeded second accounts only hold their own property's listings.
    const ownsListing = (l: Listing) => account.accountName === SECOND_ACCOUNT_PROPERTY
      ? l.property === SECOND_ACCOUNT_PROPERTY
      : account.accountName !== 'Elev8 Bali Villas' || l.property !== SECOND_ACCOUNT_PROPERTY
    const unlinked = listings.value
      .filter(l => ownsListing(l) && !getMapping(l.id, account.channel))
      .sort((a, b) => mockExternalId(a.id, accountId).localeCompare(mockExternalId(b.id, accountId)))
      .slice(0, UNLINKED_REMOTE_COUNT)
      .map((l, i) => ({ externalId: mockExternalId(l.id, account.channel), title: remoteTitle(l, i + 1), location: l.location }))
    const orphan = { externalId: mockExternalId('orphan', accountId), title: 'Kuta Beach Studio', location: 'Kuta, Bali' }
    return [...unlinked, orphan, ...linked]
  }

  /** Re-pushes a mapping. A resync clears an error. */
  async function resync(mappingId: string) {
    mappings.value = mappings.value.map(m => m.id === mappingId ? { ...m, status: 'syncing' } : m)
    await wait(CHANNEL_SYNC_DELAY_MS)
    finishSync([mappingId])
  }

  return {
    accounts,
    mappings,
    connectedChannels,
    mappedListingCount,
    unmappedListingCount,
    errorCount,
    isConnected,
    getAccount,
    accountsForChannel,
    isPropertyIdTaken,
    getMapping,
    mappingsForChannel,
    mappingsForAccount,
    connectAccount,
    disconnectAccount,
    connectListings,
    fetchRemoteListings,
    moveToAccount,
    disconnectListing,
    updateExternalId,
    resync,
  }
}
