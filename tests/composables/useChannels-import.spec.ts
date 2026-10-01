import type { Listing } from '~/components/listings/data/listings'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { matchScore, suggestMatch, suggestMatches } from '~/components/channels/data/remote-listings'
import { listings } from '~/components/listings/data/listings'
import { CHANNEL_FETCH_DELAY_MS, mockExternalId, useChannels } from '~/composables/useChannels'

let snapshot: Listing[]

beforeEach(() => {
  snapshot = listings.value
  vi.useFakeTimers()
})

afterEach(() => {
  listings.value = snapshot
  vi.useRealTimers()
})

async function fetchFor(accountId: string) {
  const { fetchRemoteListings } = useChannels()
  const pending = fetchRemoteListings(accountId)
  await vi.advanceTimersByTimeAsync(CHANNEL_FETCH_DELAY_MS)
  return pending
}

describe('remote listing matching', () => {
  it('scores the same property higher than a different one', () => {
    const remote = { externalId: 'x', title: 'Nomad Mansion Pool with private pool', location: 'Ubud, Bali' }
    const same = { id: 'a', name: 'Nomad Mansion Pool', location: 'Ubud, Bali' }
    const other = { id: 'b', name: 'Surf Shack Canggu', location: 'Canggu, Bali' }
    expect(matchScore(remote, same)).toBeGreaterThan(matchScore(remote, other))
    expect(suggestMatch(remote, [same, other])).toBe('a')
  })

  it('tells numbered rooms apart', () => {
    const remote = { externalId: 'x', title: 'Apartments Pool - Room 3', location: 'Seminyak, Bali' }
    const candidates = [
      { id: 'r2', name: 'Apartments Pool - Room 2', location: 'Seminyak, Bali' },
      { id: 'r3', name: 'Apartments Pool - Room 3', location: 'Seminyak, Bali' },
    ]
    expect(suggestMatch(remote, candidates)).toBe('r3')
  })

  it('suggests nothing on a tie or a weak match', () => {
    const remote = { externalId: 'x', title: 'Kuta Beach Studio', location: 'Kuta, Bali' }
    expect(suggestMatch(remote, [{ id: 'a', name: 'Surf Shack Canggu', location: 'Canggu, Bali' }])).toBeNull()
    const twin = { externalId: 'y', title: 'Garden Villa', location: 'Ubud, Bali' }
    expect(suggestMatch(twin, [
      { id: 'a', name: 'Garden Villa', location: 'Ubud, Bali' },
      { id: 'b', name: 'Garden Villa', location: 'Ubud, Bali' },
    ])).toBeNull()
  })

  it('never suggests the same Elev8 listing twice', () => {
    const remotes = [
      { externalId: '1', title: 'Nomad Mansion Pool', location: 'Ubud, Bali' },
      { externalId: '2', title: 'Nomad Mansion Pool, Ubud', location: 'Ubud, Bali' },
    ]
    const result = suggestMatches(remotes, [{ id: 'a', name: 'Nomad Mansion Pool', location: 'Ubud, Bali' }])
    expect(Object.values(result).filter(v => v === 'a')).toHaveLength(1)
  })
})

describe('fetchRemoteListings', () => {
  it('returns linked, unlinked and one orphan listing', async () => {
    const { accountsForChannel, mappingsForAccount } = useChannels()
    const account = accountsForChannel('Airbnb').find(a => a.accountName === 'Elev8 Bali Villas')!
    const remotes = await fetchFor(account.id)
    const linkedIds = new Set(mappingsForAccount(account.id).map(m => m.externalId))
    expect(remotes.filter(r => linkedIds.has(r.externalId))).toHaveLength(linkedIds.size)
    expect(remotes.some(r => r.title === 'Kuta Beach Studio')).toBe(true)
    expect(remotes.length - linkedIds.size - 1).toBeGreaterThan(0)
  })

  it('suggests the right Elev8 listing for every unlinked remote listing', async () => {
    const { accounts, getMapping, mappingsForAccount } = useChannels()
    for (const account of accounts.value) {
      const remotes = await fetchFor(account.id)
      const linked = new Set(mappingsForAccount(account.id).map(m => m.externalId))
      const open = remotes.filter(r => !linked.has(r.externalId))
      const candidates = listings.value
        .filter(l => !getMapping(l.id, account.channel))
        .map(l => ({ id: l.id, name: l.name, location: l.location }))
      const picks = suggestMatches(open, candidates)
      for (const r of open) {
        const truth = listings.value.find(l => mockExternalId(l.id, account.channel) === r.externalId)
        expect(picks[r.externalId], `${account.id}: ${r.title}`).toBe(truth?.id ?? null)
      }
    }
  })
})
