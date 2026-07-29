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