import { describe, expect, it } from 'vitest'
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
