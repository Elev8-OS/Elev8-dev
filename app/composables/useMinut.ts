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

const CONNECTION_KEY = 'elev8-minut-connection'

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

  watch(connection, (val) => {
    if (val) saveToStorage(CONNECTION_KEY, val)
    else if (import.meta.client) localStorage.removeItem(CONNECTION_KEY)
  }, { deep: true })

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
    return { success: true }
  }

  function disconnect() {
    connection.value = null
    if (import.meta.client) localStorage.removeItem(CONNECTION_KEY)
  }

  return { connection, isConnected, validateAndConnect, disconnect }
}