import { describe, expect, it } from 'vitest'
import { PROVISIONAL_API, usePriceLabs } from '~/composables/usePriceLabs'

const VALID_KEY = 'pl_live_abc123'

async function connected() {
  const pl = usePriceLabs()
  const res = await pl.connect('Test portfolio', VALID_KEY)
  expect(res.success).toBe(true)
  return pl
}

/** Map a unit to a room and enable sync, which is what the UI does in two steps. */
function enable(pl: ReturnType<typeof usePriceLabs>, unitId: string, roomId: string) {
  pl.mapUnit(unitId, roomId)
  pl.setSyncEnabled(unitId, true)
}

describe('usePriceLabs — connect', () => {
  it('starts disconnected with nothing seeded', () => {
    const pl = usePriceLabs()
    expect(pl.connection.value).toBeNull()
    expect(pl.isConnected.value).toBe(false)
    expect(pl.units.value).toEqual([])
    expect(pl.feeds.value).toEqual([])
    expect(pl.calls.value).toEqual([])
  })

  it('rejects a bad key with a 401 and stays disconnected', async () => {
    const pl = usePriceLabs()
    const res = await pl.connect('Test portfolio', 'nope-not-a-key')
    expect(res.success).toBe(false)
    expect(pl.isConnected.value).toBe(false)
    expect(pl.units.value).toEqual([])
    // The rejection is still a real call and must appear in the log.
    expect(pl.calls.value).toHaveLength(1)
    expect(pl.calls.value[0]!.status).toBe(401)
    expect(pl.calls.value[0]!.path).toBe(PROVISIONAL_API.endpoints.listings)
  })

  it('validates by listing, and the response becomes the mapping pool', async () => {
    const pl = await connected()
    expect(pl.connection.value!.status).toBe('connected')
    expect(pl.units.value).toHaveLength(7)
    expect(pl.units.value[0]).toMatchObject({
      providerUnitId: expect.any(String),
      pms: 'elev8',
      roomId: null,
      syncEnabled: false,
    })
    const call = pl.calls.value[0]!
    expect(call.method).toBe('GET')
    expect(call.status).toBe(200)
    expect(call.client).toBe('customer')
  })

  it('discovers the four fields the listings response proves are writable', async () => {
    const pl = await connected()
    const byKey = Object.fromEntries(pl.capabilities.value.map(c => [c.key, c]))
    for (const key of ['base_price', 'min_price', 'max_price', 'min_stay']) {
      expect(byKey[key]!.access).toBe('read_write')
      expect(byKey[key]!.source).toBe('discovered')
    }
    // Everything else is an open question, not an assumption.
    expect(byKey.seasons!.access).toBe('unverified')
    expect(byKey.date_overrides!.access).toBe('unverified')
    expect(pl.unverifiedCapabilityCount.value).toBe(5)
  })

  it('seeds a webhook URL and signing secret', async () => {
    const pl = await connected()
    expect(pl.connection.value!.webhookToken).toMatch(/^whsec_/)
    expect(pl.connection.value!.hmacSecret).toMatch(/^hmac_/)
    expect(pl.connection.value!.webhookUrl).toContain('/webhooks/pricelabs/')
  })
})

describe('usePriceLabs — mapping', () => {
  it('will not enable sync on an unmapped unit', async () => {
    const pl = await connected()
    const id = pl.units.value[0]!.providerUnitId
    pl.setSyncEnabled(id, true)
    expect(pl.units.value[0]!.syncEnabled).toBe(false)
  })

  it('unmapping a unit also stops its sync', async () => {
    const pl = await connected()
    const id = pl.units.value[0]!.providerUnitId
    enable(pl, id, 'room-suryas-2')
    expect(pl.syncingUnits.value).toHaveLength(1)
    pl.mapUnit(id, null)
    expect(pl.units.value[0]!.syncEnabled).toBe(false)
    expect(pl.syncingUnits.value).toHaveLength(0)
  })

  it('reports rooms that have no provider unit', async () => {
    const pl = await connected()
    const before = pl.unmappedRooms.value.length
    pl.mapUnit(pl.units.value[0]!.providerUnitId, 'room-suryas-2')
    expect(pl.unmappedRooms.value).toHaveLength(before - 1)
    expect(pl.unmappedRooms.value.map(r => r.id)).not.toContain('room-suryas-2')
  })
})

describe('usePriceLabs — drift is derived, not stored', () => {
  it('reports no drift until a unit is actually syncing', async () => {
    const pl = await connected()
    // plu-88214 differs from the provider by seed, but nothing syncs it yet.
    expect(pl.drift.value).toHaveLength(0)
    enable(pl, 'plu-88214', 'room-suryas-2')
    expect(pl.drift.value).toHaveLength(1)
    expect(pl.drift.value[0]).toMatchObject({
      providerUnitId: 'plu-88214',
      field: 'base',
      elev8Value: 182,
      providerValue: 165,
    })
  })

  it('a provider-side edit produces drift with no record being written', async () => {
    const pl = await connected()
    enable(pl, 'plu-88215', 'room-uluwatu-1')
    expect(pl.drift.value).toHaveLength(0)
    pl.simulateProviderEdit()
    expect(pl.drift.value).toHaveLength(1)
    expect(pl.drift.value[0]!.field).toBe('base')
  })
})

describe('usePriceLabs — reconcile writes then verifies', () => {
  it('writes the Elev8 value, reads it back, and clears the drift', async () => {
    const pl = await connected()
    enable(pl, 'plu-88214', 'room-suryas-2')
    expect(pl.drift.value).toHaveLength(1)

    const res = await pl.reconcileUnit('plu-88214')
    expect(res).toEqual({ written: 1, verified: true })
    expect(pl.drift.value).toHaveLength(0)

    // Two calls, newest first: the read-back sits on top of the write it verifies.
    const paths = pl.calls.value.slice(0, 2).map(c => `${c.method} ${c.path}`)
    expect(paths).toEqual([
      `GET ${PROVISIONAL_API.endpoints.listings}`,
      `POST ${PROVISIONAL_API.endpoints.listings}`,
    ])
    const write = pl.calls.value[1]!
    expect(write.requestBody).toMatchObject({ listings: [{ id: 'plu-88214', pms: 'elev8', base: 182 }] })
  })

  it('sends only the fields that actually differ', async () => {
    const pl = await connected()
    enable(pl, 'plu-88216', 'room-padma-3')
    await pl.reconcileUnit('plu-88216')
    const write = pl.calls.value.find(c => c.method === 'POST')!
    const sent = (write.requestBody as { listings: Record<string, unknown>[] }).listings[0]!
    expect(sent).toHaveProperty('min_stay', 2)
    expect(sent).not.toHaveProperty('base')
    expect(sent).not.toHaveProperty('max')
  })

  it('is a no-op when there is nothing to write', async () => {
    const pl = await connected()
    enable(pl, 'plu-88215', 'room-uluwatu-1')
    const res = await pl.reconcileUnit('plu-88215')
    expect(res).toEqual({ written: 0, verified: true })
    expect(pl.calls.value.filter(c => c.method === 'POST')).toHaveLength(0)
  })

  it('reconcileAll clears every drifting unit', async () => {
    const pl = await connected()
    enable(pl, 'plu-88214', 'room-suryas-2')
    enable(pl, 'plu-88216', 'room-padma-3')
    enable(pl, 'plu-88218', 'room-bakti-2')
    expect(pl.drift.value).toHaveLength(3)
    const res = await pl.reconcileAll()
    expect(res).toEqual({ units: 3, fields: 3 })
    expect(pl.drift.value).toHaveLength(0)
  })
})

describe('usePriceLabs — sync cycle', () => {
  it('runs the five feed calls in order, on the right client', async () => {
    const pl = await connected()
    enable(pl, 'plu-88214', 'room-suryas-2')
    pl.clearCalls()

    await pl.runFullSync()

    const made = [...pl.calls.value].reverse().map(c => `${c.client} ${c.method} ${c.path}`)
    const e = PROVISIONAL_API.endpoints
    expect(made).toEqual([
      `sync POST ${e.syncListings}`,
      `sync POST ${e.syncAvailability}`,
      `sync POST ${e.syncReservations}`,
      `customer GET ${e.listingPrices}`,
      `customer GET ${e.neighborhoodData}`,
    ])
    expect(pl.connection.value!.lastSyncAt).not.toBeNull()
  })

  it('pushes a 730-day window for every syncing unit', async () => {
    const pl = await connected()
    enable(pl, 'plu-88214', 'room-suryas-2')
    enable(pl, 'plu-88216', 'room-padma-3')
    await pl.pushAvailability()
    const feed = pl.feeds.value.find(f => f.id === 'availability')!
    expect(feed.state).toBe('live')
    expect(feed.recordCount).toBe(2 * 730)
  })

  it('a feed with no syncing unit reads paused, not live', async () => {
    const pl = await connected()
    await pl.pushListings()
    const feed = pl.feeds.value.find(f => f.id === 'listings')!
    expect(feed.state).toBe('paused')
    expect(feed.recordCount).toBe(0)
    expect(feed.detail).toContain('No unit has sync enabled')
  })

  it('decrements the rate limit on every call', async () => {
    const pl = await connected()
    const after = pl.connection.value!.rateLimitRemaining
    expect(after).toBe(PROVISIONAL_API.rateLimitPerMinute - 1)
    await pl.pushListings()
    expect(pl.connection.value!.rateLimitRemaining).toBe(after - 1)
  })
})

describe('usePriceLabs — room sync state', () => {
  it('is paused while disconnected', () => {
    const pl = usePriceLabs()
    expect(pl.syncStateForRoom('room-suryas-2')).toBe('paused')
  })

  it('is paused for a mapped room whose sync is off', async () => {
    const pl = await connected()
    pl.mapUnit('plu-88215', 'room-uluwatu-1')
    expect(pl.syncStateForRoom('room-uluwatu-1')).toBe('paused')
  })

  it('is partial once syncing but before any price arrives', async () => {
    const pl = await connected()
    enable(pl, 'plu-88215', 'room-uluwatu-1')
    expect(pl.syncStateForRoom('room-uluwatu-1')).toBe('partial')
  })

  it('is live after prices come back', async () => {
    const pl = await connected()
    enable(pl, 'plu-88215', 'room-uluwatu-1')
    await pl.pullPrices()
    expect(pl.syncStateForRoom('room-uluwatu-1')).toBe('live')
  })

  it('is degraded while the room carries drift', async () => {
    const pl = await connected()
    enable(pl, 'plu-88214', 'room-suryas-2')
    await pl.pullPrices()
    expect(pl.syncStateForRoom('room-suryas-2')).toBe('degraded')
    await pl.reconcileUnit('plu-88214')
    expect(pl.syncStateForRoom('room-suryas-2')).toBe('live')
  })
})

describe('usePriceLabs — webhook and teardown', () => {
  it('an inbound webhook is verified and triggers a price pull', async () => {
    const pl = await connected()
    enable(pl, 'plu-88214', 'room-suryas-2')
    pl.clearCalls()
    await pl.simulateInboundWebhook()

    const hook = pl.calls.value.find(c => c.path.includes('/webhooks/pricelabs/'))!
    expect(hook.status).toBe(200)
    expect(hook.responseBody).toMatchObject({ received: true, verified: true })
    expect((hook.requestBody as { signature: string }).signature).toMatch(/^sha256=/)
    // The webhook is a notification, so we re-read rather than trust its payload.
    expect(pl.calls.value.some(c => c.path === PROVISIONAL_API.endpoints.listingPrices)).toBe(true)
  })

  it('disconnect drops the connection but keeps what we learned about the API', async () => {
    const pl = await connected()
    pl.setCapability('seasons', 'unsupported', 'Confirmed on the call.')
    pl.disconnect()
    expect(pl.connection.value).toBeNull()
    expect(pl.units.value).toEqual([])
    expect(pl.feeds.value).toEqual([])
    expect(pl.calls.value).toEqual([])
    const seasons = pl.capabilities.value.find(c => c.key === 'seasons')!
    expect(seasons.access).toBe('unsupported')
    expect(seasons.note).toBe('Confirmed on the call.')
  })
})
