import { describe, expect, it, vi } from 'vitest'
import { useMinut } from '~/composables/useMinut'

describe('useMinut — connection', () => {
  it('starts disconnected', () => {
    const { connection, isConnected } = useMinut()
    expect(connection.value).toBeNull()
    expect(isConnected.value).toBe(false)
  })

  it('validateAndConnect rejects empty API key', async () => {
    const { validateAndConnect } = useMinut()
    const result = await validateAndConnect('', 'My Workspace')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/required/i)
  })

  it('validateAndConnect rejects wrong-prefix API key', async () => {
    const { validateAndConnect } = useMinut()
    const result = await validateAndConnect('bad-key', 'My Workspace')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/mn_|minut_/)
  })

  it('validateAndConnect succeeds with valid mn_ prefix and seeds connection', async () => {
    const { validateAndConnect, connection, isConnected } = useMinut()
    const result = await validateAndConnect('mn_test_key', 'My Workspace')
    expect(result.success).toBe(true)
    expect(connection.value).not.toBeNull()
    expect(connection.value!.status).toBe('connected')
    expect(connection.value!.workspaceName).toBe('My Workspace')
    expect(connection.value!.webhookToken).toMatch(/^whsec_/)
    expect(isConnected.value).toBe(true)
  })

  it('disconnect wipes connection', async () => {
    const { validateAndConnect, disconnect, connection, isConnected } = useMinut()
    await validateAndConnect('mn_seed', 'Seed')
    expect(isConnected.value).toBe(true)
    disconnect()
    expect(connection.value).toBeNull()
    expect(isConnected.value).toBe(false)
  })
})

describe('useMinut — devices', () => {
  it('seedDevices populates 6 devices when none exist and connection is present', () => {
    const { seedDevices, devices } = useMinut()
    seedDevices()
    expect(devices.value).toHaveLength(6)
    expect(devices.value[0]).toMatchObject({
      deviceId: expect.any(String),
      name: expect.any(String),
      model: expect.any(String),
      listingId: expect.any(String),
      batteryLevel: expect.any(Number),
      online: expect.any(Boolean),
      sensors: expect.any(Array),
    })
  })

  it('refreshes connection metadata when reconnecting with persisted devices', async () => {
    const { validateAndConnect, disconnect, connection, devices } = useMinut()
    await validateAndConnect('mn_initial_connect', 'Initial')
    expect(devices.value).toHaveLength(6)

    disconnect()
    expect(connection.value).toBeNull()
    expect(devices.value).toHaveLength(6)

    const result = await validateAndConnect('mn_reconnect', 'Reconnected')
    expect(result.success).toBe(true)
    expect(connection.value!.deviceCount).toBe(6)
    expect(connection.value!.lastSyncAt).not.toBeNull()
  })

  it('seeds the exact representative device fixtures', () => {
    const { seedDevices, devices } = useMinut()
    seedDevices()

    expect(devices.value.find(device => device.deviceId === 'dev-001')).toMatchObject({
      deviceId: 'dev-001',
      listingId: 'lst-1',
      sensors: ['noise'],
      model: 'Minut Point',
    })
    expect(devices.value.find(device => device.deviceId === 'dev-003')).toMatchObject({
      deviceId: 'dev-003',
      listingId: 'lst-3',
      sensors: ['noise', 'smoke'],
      model: 'Minut Point Pro',
    })
    expect(devices.value.find(device => device.deviceId === 'dev-005')).toMatchObject({
      deviceId: 'dev-005',
      listingId: 'lst-2',
      sensors: ['noise', 'temperature', 'smoke'],
      model: 'Minut Point Pro',
    })
  })

  it('syncDevices updates lastSyncAt on connection', async () => {
    const { validateAndConnect, syncDevices, connection } = useMinut()
    await validateAndConnect('mn_seed_sync', 'Sync')
    expect(connection.value!.lastSyncAt).not.toBeNull() // validateAndConnect sets it
    const before = connection.value!.lastSyncAt
    await new Promise(r => setTimeout(r, 5))
    syncDevices()
    expect(connection.value!.lastSyncAt).not.toBe(before)
  })

  it('syncDevices is a no-op when disconnected', () => {
    const { syncDevices, connection } = useMinut()
    expect(connection.value).toBeNull()
    syncDevices() // should not throw
    expect(connection.value).toBeNull()
  })
})

describe('useMinut — events', () => {
  it('emitMockEvents returns empty array when no devices', () => {
    const { emitMockEvents } = useMinut()
    const events = emitMockEvents()
    expect(events).toEqual([])
  })

  it('emitMockEvents generates 3-6 events with valid shape', () => {
    const { emitMockEvents, seedDevices } = useMinut()
    seedDevices()
    const events = emitMockEvents()
    expect(events.length).toBeGreaterThanOrEqual(3)
    expect(events.length).toBeLessThanOrEqual(6)
    for (const e of events) {
      expect(e.id).toMatch(/^evt-/)
      expect(['noise', 'smoke', 'temperature', 'motion', 'battery', 'tamper', 'connectivity']).toContain(e.type)
      expect(e.deviceId).toMatch(/^dev-/)
      expect(e.listingId).toMatch(/^lst-/)
      expect(e.timestamp).toMatch(/^\d{4}-/)
    }
  })

  it('emitMockEvents can generate tamper events', () => {
    const { emitMockEvents, seedDevices } = useMinut()
    seedDevices()
    vi.spyOn(Math, 'random').mockReturnValue(0.8)

    try {
      const emitted = emitMockEvents()
      expect(emitted).toHaveLength(6)
      expect(emitted.every(event => event.type === 'tamper')).toBe(true)
    }
    finally {
      vi.restoreAllMocks()
    }
  })

  it('emitMockEvents only emits sensor types the device supports', () => {
    const { emitMockEvents, seedDevices, devices } = useMinut()
    seedDevices()
    const emitted = Array.from({ length: 50 }, () => emitMockEvents()).flat()
    const systemTypes = new Set(['battery', 'tamper', 'connectivity'])

    expect(emitted.length).toBeGreaterThanOrEqual(150)
    for (const event of emitted) {
      if (systemTypes.has(event.type)) continue
      const device = devices.value.find(candidate => candidate.deviceId === event.deviceId)
      expect(device).toBeDefined()
      expect(device!.sensors).toContain(event.type)
    }
  })

  it('generated payload values stay within their documented bounds', () => {
    const { emitMockEvents, seedDevices } = useMinut()
    seedDevices()
    const emitted = Array.from({ length: 20 }, () => emitMockEvents()).flat()

    for (const event of emitted) {
      if (event.type === 'noise') {
        expect(event.dbLevel).toBeGreaterThanOrEqual(65)
        expect(event.dbLevel).toBeLessThanOrEqual(105)
      }
      else if (event.type === 'temperature') {
        expect(event.temperatureC).toBeGreaterThanOrEqual(5)
        expect(event.temperatureC).toBeLessThanOrEqual(40)
      }
      else if (event.type === 'battery') {
        expect(event.batteryLevel).toBeGreaterThanOrEqual(0)
        expect(event.batteryLevel).toBeLessThanOrEqual(20)
      }
    }
  })

  it('caps stored events at 50', () => {
    const { emitMockEvents, seedDevices, events } = useMinut()
    seedDevices()
    for (let i = 0; i < 12; i++) emitMockEvents()
    expect(events.value.length).toBeLessThanOrEqual(50)
  })

  it('updates lastEventAt for devices that receive events', () => {
    const { emitMockEvents, seedDevices, devices } = useMinut()
    seedDevices()
    const emitted = Array.from({ length: 20 }, () => emitMockEvents()).flat()
    const deviceIds = new Set(emitted.map(event => event.deviceId))

    expect(deviceIds.size).toBeGreaterThan(0)
    for (const device of devices.value.filter(candidate => deviceIds.has(candidate.deviceId))) {
      expect(device.lastEventAt).not.toBeNull()
    }
  })

  it('getEventsByListing returns emitted events for the listing', () => {
    const { emitMockEvents, seedDevices, getEventsByListing } = useMinut()
    seedDevices()
    const emitted = emitMockEvents()
    const listingId = emitted[0]!.listingId
    const listingEvents = getEventsByListing(listingId)

    expect(listingEvents.length).toBeGreaterThan(0)
    expect(listingEvents.some(event => emitted.some(candidate => candidate.id === event.id))).toBe(true)
    expect(listingEvents.every(event => event.listingId === listingId)).toBe(true)
  })

  it('getEventsByType returns emitted events of the requested type', () => {
    const { emitMockEvents, seedDevices, getEventsByType } = useMinut()
    seedDevices()
    const emitted = emitMockEvents()
    const type = emitted[0]!.type
    const typeEvents = getEventsByType(type)

    expect(typeEvents.length).toBeGreaterThan(0)
    expect(typeEvents.some(event => emitted.some(candidate => candidate.id === event.id))).toBe(true)
    expect(typeEvents.every(event => event.type === type)).toBe(true)
  })
})
