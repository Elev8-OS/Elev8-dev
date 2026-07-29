import { computed } from 'vue'

export interface MinutConnection {
  id: string
  apiKey: string
  workspaceName: string
  status: 'connected' | 'disconnected'
  webhookToken: string
  webhookUrl: string
  deviceCount: number
  connectedAt: string
  lastSyncAt: string | null
}

export type MinutSensor = 'noise' | 'smoke' | 'temperature' | 'motion'

export interface MinutDevice {
  deviceId: string
  name: string
  model: string
  listingId: string
  listingName: string
  batteryLevel: number
  online: boolean
  sensors: MinutSensor[]
  lastEventAt: string | null
}

const CONNECTION_KEY = 'elev8-minut-connection'
const DEVICES_KEY = 'elev8-minut-devices'

const MOCK_DEVICES: MinutDevice[] = [
  { deviceId: 'dev-001', name: 'Living Room Sensor', model: 'Minut Point', listingId: 'lst-1', listingName: 'Villa Kastila', batteryLevel: 87, online: true, sensors: ['noise'], lastEventAt: null },
  { deviceId: 'dev-002', name: 'Bedroom Sensor', model: 'Minut Point', listingId: 'lst-2', listingName: 'Villa Canggu', batteryLevel: 62, online: true, sensors: ['noise'], lastEventAt: null },
  { deviceId: 'dev-003', name: 'Kitchen Sensor', model: 'Minut Point Pro', listingId: 'lst-3', listingName: 'Ubud Treehouse', batteryLevel: 12, online: false, sensors: ['noise', 'smoke'], lastEventAt: null },
  { deviceId: 'dev-004', name: 'Pool Deck Sensor', model: 'Minut Point', listingId: 'lst-4', listingName: 'Seminyak Loft', batteryLevel: 78, online: true, sensors: ['noise', 'smoke'], lastEventAt: null },
  { deviceId: 'dev-005', name: 'Master Suite', model: 'Minut Point Pro', listingId: 'lst-2', listingName: 'Villa Canggu', batteryLevel: 95, online: true, sensors: ['noise', 'temperature', 'smoke'], lastEventAt: null },
  { deviceId: 'dev-006', name: 'Garden Sensor', model: 'Minut Point', listingId: 'lst-1', listingName: 'Villa Kastila', batteryLevel: 43, online: true, sensors: ['noise'], lastEventAt: null },
]

function loadFromStorage<T>(key: string, fallback: T): T {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw) as T
    }
    catch { /* ignore */ }
  }
  return fallback
}

function saveToStorage<T>(key: string, value: T) {
  if (import.meta.client) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    }
    catch { /* ignore */ }
  }
}

function generateWebhookToken(): string {
  return `whsec_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
}

export function useMinut() {
  const connection = useState<MinutConnection | null>('minut-connection', () => loadFromStorage<MinutConnection | null>(CONNECTION_KEY, null))
  const devices = useState<MinutDevice[]>('minut-devices', () => loadFromStorage<MinutDevice[]>(DEVICES_KEY, []))

  watch(connection, (val) => {
    if (val) saveToStorage(CONNECTION_KEY, val)
    else if (import.meta.client) localStorage.removeItem(CONNECTION_KEY)
  }, { deep: true })

  watch(devices, (val) => { saveToStorage(DEVICES_KEY, val) }, { deep: true })

  const isConnected = computed(() => connection.value?.status === 'connected')

  async function validateAndConnect(apiKey: string, workspaceName: string): Promise<{ success: boolean, error?: string }> {
    await new Promise(r => setTimeout(r, 1500))
    if (!apiKey.trim()) return { success: false, error: 'API key is required.' }
    if (!apiKey.startsWith('mn_') && !apiKey.startsWith('minut_')) {
      return { success: false, error: 'Invalid API key format. Keys start with "mn_" or "minut_".' }
    }
    const webhookToken = generateWebhookToken()
    connection.value = {
      id: `minut-${Date.now()}`,
      apiKey,
      workspaceName: workspaceName.trim() || 'My Workspace',
      status: 'connected',
      webhookToken,
      webhookUrl: `https://api.elev8.app/webhooks/minut/${webhookToken.slice(6)}`,
      deviceCount: 0, // seeded in Task 2
      connectedAt: new Date().toISOString(),
      lastSyncAt: null,
    }
    seedDevices()
    return { success: true }
  }

  function disconnect() {
    connection.value = null
    if (import.meta.client) localStorage.removeItem(CONNECTION_KEY)
  }

  function seedDevices() {
    if (devices.value.length === 0) {
      devices.value = MOCK_DEVICES.map(d => ({ ...d, lastEventAt: d.lastEventAt ?? null }))
      if (connection.value) {
        connection.value = { ...connection.value, deviceCount: devices.value.length, lastSyncAt: new Date().toISOString() }
      }
    }
  }

  function syncDevices() {
    if (!connection.value) return
    connection.value = { ...connection.value, lastSyncAt: new Date().toISOString() }
  }

  return { connection, devices, isConnected, validateAndConnect, disconnect, seedDevices, syncDevices }
}