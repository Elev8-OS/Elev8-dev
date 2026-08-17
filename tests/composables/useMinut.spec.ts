import { describe, expect, it, vi } from 'vitest'
import { useMinut } from '~/composables/useMinut'

describe('useMinut — connection', () => {
  it('starts disconnected', () => {
    const { connection, isConnected } = useMinut()
    expect(connection.value).toBeNull()
    expect(isConnected.value).toBe(false)
  })

  it('completeOAuth connects and seeds a connection', async () => {
    const { completeOAuth, connection, isConnected } = useMinut()
    const result = await completeOAuth()
    expect(result.success).toBe(true)
    expect(connection.value).not.toBeNull()
    expect(connection.value!.status).toBe('connected')
    expect(connection.value!.workspaceName).toMatch(/^Minut workspace /)
    expect(connection.value!.webhookToken).toMatch(/^whsec_/)
    expect(isConnected.value).toBe(true)
  })

  it('disconnect wipes connection', async () => {
    const { completeOAuth, disconnect, connection, isConnected } = useMinut()
    await completeOAuth()
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
      listingId: null,
      batteryLevel: expect.any(Number),
      online: expect.any(Boolean),
      sensors: expect.any(Array),
    })
  })

  it('completeOAuth seeds devices and refreshes connection metadata', async () => {
    const { completeOAuth, disconnect, connection, devices } = useMinut()
    await completeOAuth()
    expect(devices.value).toHaveLength(6)

    disconnect()
    expect(connection.value).toBeNull()
    expect(devices.value).toHaveLength(6)

    await completeOAuth()
    expect(connection.value!.deviceCount).toBe(6)
    expect(connection.value!.lastSyncAt).not.toBeNull()
  })

  it('seeds the exact representative device fixtures', () => {
    const { seedDevices, devices } = useMinut()
    seedDevices()

    expect(devices.value.find(device => device.deviceId === 'dev-001')).toMatchObject({
      deviceId: 'dev-001',
      listingId: null,
      sensors: ['noise'],
      model: 'Minut Point',
    })
    expect(devices.value.find(device => device.deviceId === 'dev-003')).toMatchObject({
      deviceId: 'dev-003',
      listingId: null,
      sensors: ['noise', 'smoke'],
      model: 'Minut Point Pro',
    })
    expect(devices.value.find(device => device.deviceId === 'dev-005')).toMatchObject({
      deviceId: 'dev-005',
      listingId: null,
      sensors: ['noise', 'temperature', 'smoke'],
      model: 'Minut Point Pro',
    })
  })

  it('assignDeviceToListing maps a device to a user listing', () => {
    const { seedDevices, assignDeviceToListing, devices, userListings } = useMinut()
    seedDevices()
    const target = userListings.value[0]
    expect(target).toBeDefined()
    assignDeviceToListing('dev-001', target!.id)
    expect(devices.value.find(d => d.deviceId === 'dev-001')!.listingId).toBe(target!.id)
    expect(devices.value.find(d => d.deviceId === 'dev-002')!.listingId).toBeNull()
  })

  it('assignDeviceToListing unassigns with null', () => {
    const { seedDevices, assignDeviceToListing, devices, userListings } = useMinut()
    seedDevices()
    assignDeviceToListing('dev-001', userListings.value[0]!.id)
    assignDeviceToListing('dev-001', null)
    expect(devices.value.find(d => d.deviceId === 'dev-001')!.listingId).toBeNull()
  })

  it('bulkAssignDevices maps a batch of devices', () => {
    const { seedDevices, bulkAssignDevices, devices, userListings } = useMinut()
    seedDevices()
    const target = userListings.value[0]
    bulkAssignDevices(['dev-001', 'dev-002'], target!.id)
    expect(devices.value.find(d => d.deviceId === 'dev-001')!.listingId).toBe(target!.id)
    expect(devices.value.find(d => d.deviceId === 'dev-002')!.listingId).toBe(target!.id)
    expect(devices.value.find(d => d.deviceId === 'dev-003')!.listingId).toBeNull()
  })

  it('unassignedDevices and assignedDeviceCount track mapping state', () => {
    const { seedDevices, assignDeviceToListing, unassignedDevices, assignedDeviceCount, userListings } = useMinut()
    seedDevices()
    expect(unassignedDevices.value).toHaveLength(6)
    expect(assignedDeviceCount.value).toBe(0)
    assignDeviceToListing('dev-001', userListings.value[0]!.id)
    expect(unassignedDevices.value).toHaveLength(5)
    expect(assignedDeviceCount.value).toBe(1)
  })

  it('syncDevices updates lastSyncAt on connection', async () => {
    const { completeOAuth, syncDevices, connection } = useMinut()
    await completeOAuth()
    expect(connection.value!.lastSyncAt).not.toBeNull() // completeOAuth sets it
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
      expect(e.listingId).toBeNull()
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

  it('getEventsByListing returns emitted events for the mapped listing', () => {
    const { emitMockEvents, seedDevices, assignDeviceToListing, getEventsByListing, userListings } = useMinut()
    seedDevices()
    const target = userListings.value[0]
    for (const device of [...Array(6)].map((_, i) => `dev-00${i + 1}`)) {
      assignDeviceToListing(device, target!.id)
    }
    emitMockEvents()
    const listingEvents = getEventsByListing(target!.id)

    expect(listingEvents.length).toBeGreaterThan(0)
    expect(listingEvents.every(event => event.listingId === target!.id)).toBe(true)
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
