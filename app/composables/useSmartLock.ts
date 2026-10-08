import { computed } from 'vue'
import { useNotifications } from '~/composables/useNotifications'

export type SmartLockProvider = 'igloohome' | 'august' | 'yale' | 'nuki' | 'schlage'

export type SmartLockConnectionStatus = 'connected' | 'disconnected' | 'pending' | 'error'

export interface SmartLockConnection {
  id: string
  apiKey: string
  workspaceName: string
  status: SmartLockConnectionStatus
  webhookToken: string
  webhookUrl: string
  deviceCount: number
  connectedAt: string
  lastSyncAt: string | null
}

export interface SmartLockDevice {
  deviceId: string
  name: string
  deviceType: string
  provider: SmartLockProvider
  model: string
  batteryLevel: number
  online: boolean
  paired: boolean
}

export interface SmartLock {
  id: string
  providerDeviceId: string
  name: string
  assignment: 'property' | 'room'
  listingId: string
  unitId?: string
  isMain: boolean
  batteryLevel: number
  online: boolean
  lastSeen?: string
  status: 'active' | 'inactive' | 'error'
  createdAt: string
}

export interface AccessCode {
  id: string
  lockId: string
  code: string
  startsAt: string
  endsAt: string
  guestName?: string
  reservationId?: string
  purpose?: string
  /**
   * How the active window was configured by the host:
   * - 'ongoing' — always active (endsAt is far in the future)
   * - 'range'   — explicit start/end timestamps supplied by the host
   * - undefined — auto-generated (24h default window), no explicit schedule yet
   */
  scheduleType?: 'ongoing' | 'range'
  status: 'active' | 'expired' | 'revoked'
  providerCodeId: string
}

const CONNECTION_KEY = 'elev8-smartlock-connection'
const LOCKS_KEY = 'elev8-smart-locks'
const CODES_KEY = 'elev8-smart-lock-codes'

const MOCK_DEVICES: SmartLockDevice[] = [
  { deviceId: 'dev-001', name: 'Front Door', deviceType: 'lock', provider: 'august', model: 'August Wi-Fi Smart Lock (4th Gen)', batteryLevel: 87, online: true, paired: false },
  { deviceId: 'dev-002', name: 'Back Gate', deviceType: 'lock', provider: 'igloohome', model: 'igloohome Smart Deadbolt 2S', batteryLevel: 62, online: true, paired: false },
  { deviceId: 'dev-003', name: 'Pool Gate', deviceType: 'lock', provider: 'yale', model: 'Yale Assure Lock 2', batteryLevel: 12, online: false, paired: false },
  { deviceId: 'dev-004', name: 'Side Door', deviceType: 'lock', provider: 'nuki', model: 'Nuki Smart Lock 4.0', batteryLevel: 95, online: true, paired: false },
  { deviceId: 'dev-005', name: 'Safe', deviceType: 'lock', provider: 'schlage', model: 'Schlage Encode Plus', batteryLevel: 78, online: true, paired: false },
  // Extra August devices — same brand, share codes with dev-001
  { deviceId: 'dev-006', name: 'Garage Door', deviceType: 'lock', provider: 'august', model: 'August Smart Lock Pro (3rd Gen)', batteryLevel: 74, online: true, paired: false },
  { deviceId: 'dev-007', name: 'Side Gate', deviceType: 'lock', provider: 'august', model: 'August Smart Lock (2nd Gen)', batteryLevel: 43, online: true, paired: false },
  // Extra Yale device
  { deviceId: 'dev-008', name: 'Office Door', deviceType: 'lock', provider: 'yale', model: 'Yale Assure Lock 2 Touch', batteryLevel: 81, online: true, paired: false },
  // Extra Schlage device
  { deviceId: 'dev-009', name: 'Wine Cellar', deviceType: 'lock', provider: 'schlage', model: 'Schlage Encode Deadbolt', batteryLevel: 56, online: true, paired: false },
  // Extra Nuki device (low battery for alert demo)
  { deviceId: 'dev-010', name: 'Boathouse', deviceType: 'lock', provider: 'nuki', model: 'Nuki Smart Lock Pro 4.0', batteryLevel: 8, online: false, paired: false },
]

function loadFromStorage<T>(key: string, fallback: T): T {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(key)
      if (raw)
        return JSON.parse(raw) as T
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

function randomCode(): string {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
}

function generateWebhookToken(): string {
  return `whsec_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
}

export function useSmartLock() {
  const connection = useState<SmartLockConnection | null>('smartlock-connection', () => loadFromStorage<SmartLockConnection | null>(CONNECTION_KEY, null))
  const locks = useState<SmartLock[]>('smart-locks', () => loadFromStorage<SmartLock[]>(LOCKS_KEY, []))
  const codes = useState<AccessCode[]>('smart-lock-codes', () => loadFromStorage<AccessCode[]>(CODES_KEY, []))

  watch(connection, (val) => {
    if (val)
      saveToStorage(CONNECTION_KEY, val)
    else if (import.meta.client)
      localStorage.removeItem(CONNECTION_KEY)
  }, { deep: true })

  watch(locks, (val) => { saveToStorage(LOCKS_KEY, val) }, { deep: true })
  watch(codes, (val) => { saveToStorage(CODES_KEY, val) }, { deep: true })

  const isConnected = computed(() => connection.value?.status === 'connected')

  const allDevices = computed<SmartLockDevice[]>(() => {
    if (!isConnected.value)
      return []
    return MOCK_DEVICES.map((d) => {
      const paired = locks.value.some(l => l.providerDeviceId === d.deviceId)
      return { ...d, paired }
    })
  })

  const availableDevices = computed(() => allDevices.value.filter(d => !d.paired))

  // --- Connection management ---

  async function validateAndConnect(apiKey: string, workspaceName: string): Promise<{ success: boolean, error?: string }> {
    await new Promise(r => setTimeout(r, 1500))
    if (!apiKey.trim())
      return { success: false, error: 'API key is required.' }
    if (!apiKey.startsWith('seam_') && !apiKey.startsWith('sk_')) {
      return { success: false, error: 'Invalid API key format. Keys start with "seam_" or "sk_".' }
    }
    const webhookToken = generateWebhookToken()
    connection.value = {
      id: `smartlock-${Date.now()}`,
      apiKey,
      workspaceName: workspaceName.trim() || 'My Workspace',
      status: 'connected',
      webhookToken,
      webhookUrl: `https://api.elev8.app/webhooks/smartlock/${webhookToken.slice(6)}`,
      deviceCount: MOCK_DEVICES.length,
      connectedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
    }
    return { success: true }
  }

  function disconnect() {
    connection.value = null
    locks.value = []
    codes.value = []
    if (import.meta.client) {
      localStorage.removeItem(CONNECTION_KEY)
      localStorage.removeItem(LOCKS_KEY)
      localStorage.removeItem(CODES_KEY)
    }
  }

  function syncDevices() {
    if (!connection.value)
      return
    connection.value = { ...connection.value, lastSyncAt: new Date().toISOString() }
    // Randomly nudge battery + online for realism
    locks.value = locks.value.map((l) => {
      const delta = Math.random() < 0.3 ? -1 : 0
      return {
        ...l,
        batteryLevel: Math.max(0, Math.min(100, l.batteryLevel + delta)),
        lastSeen: new Date().toISOString(),
      }
    })
  }

  // --- Lock CRUD ---

  function getLocksForListing(listingId: string): SmartLock[] {
    return locks.value.filter(l => l.listingId === listingId)
  }

  function getLocksForUnit(listingId: string, unitId: string): SmartLock[] {
    return locks.value.filter(l => l.listingId === listingId && l.unitId === unitId)
  }

  function getLockCount(listingId: string, unitId?: string): number {
    if (unitId)
      return getLocksForUnit(listingId, unitId).length
    return getLocksForListing(listingId).length
  }

  function getMainLock(listingId: string, unitId?: string): SmartLock | undefined {
    const candidates = unitId
      ? getLocksForUnit(listingId, unitId)
      : getLocksForListing(listingId).filter(l => l.assignment === 'property' || !l.unitId)
    return candidates.find(l => l.isMain) ?? candidates[0]
  }

  function pairLock(opts: {
    providerDeviceId: string
    name: string
    assignment: 'property' | 'room'
    listingId: string
    unitId?: string
    isMain?: boolean
  }): { success: boolean, error?: string, lock?: SmartLock } {
    const device = MOCK_DEVICES.find(d => d.deviceId === opts.providerDeviceId)
    if (!device)
      return { success: false, error: 'Device not found.' }
    if (locks.value.some(l => l.providerDeviceId === opts.providerDeviceId)) {
      return { success: false, error: 'This lock is already paired.' }
    }
    if (opts.isMain) {
      // Demote existing main in this scope
      locks.value = locks.value.map((l) => {
        if (l.listingId !== opts.listingId)
          return l
        if (opts.unitId ? l.unitId !== opts.unitId : l.assignment === 'property') {
          return { ...l, isMain: false }
        }
        return l
      })
    }
    const newLock: SmartLock = {
      id: `lock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      providerDeviceId: device.deviceId,
      name: opts.name || device.name,
      assignment: opts.assignment,
      listingId: opts.listingId,
      unitId: opts.assignment === 'room' ? opts.unitId : undefined,
      isMain: opts.isMain ?? false,
      batteryLevel: device.batteryLevel,
      online: device.online,
      lastSeen: new Date().toISOString(),
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    locks.value = [...locks.value, newLock]
    return { success: true, lock: newLock }
  }

  function unpairLock(lockId: string) {
    locks.value = locks.value.filter(l => l.id !== lockId)
    codes.value = codes.value.filter(c => c.lockId !== lockId)
  }

  function setMainLock(lockId: string) {
    const target = locks.value.find(l => l.id === lockId)
    if (!target)
      return
    locks.value = locks.value.map((l) => {
      const inScope = l.listingId === target.listingId
        && (target.unitId ? l.unitId === target.unitId : l.assignment === 'property' || !l.unitId)
      return inScope ? { ...l, isMain: l.id === lockId } : l
    })
  }

  function renameLock(lockId: string, name: string) {
    locks.value = locks.value.map(l => l.id === lockId ? { ...l, name } : l)
  }

  function swapDevice(lockId: string, newProviderDeviceId: string): { success: boolean, error?: string, lock?: SmartLock } {
    const target = locks.value.find(l => l.id === lockId)
    if (!target)
      return { success: false, error: 'Lock not found.' }
    if (target.providerDeviceId === newProviderDeviceId) {
      return { success: false, error: 'This device is already paired to this lock.' }
    }
    const device = MOCK_DEVICES.find(d => d.deviceId === newProviderDeviceId)
    if (!device)
      return { success: false, error: 'Device not found.' }
    if (locks.value.some(l => l.id !== lockId && l.providerDeviceId === newProviderDeviceId)) {
      return { success: false, error: 'This device is already paired to another lock in this workspace.' }
    }
    locks.value = locks.value.map((l) => {
      if (l.id !== lockId)
        return l
      return {
        ...l,
        providerDeviceId: device.deviceId,
        batteryLevel: device.batteryLevel,
        online: device.online,
        lastSeen: new Date().toISOString(),
      }
    })
    const updated = locks.value.find(l => l.id === lockId)
    return { success: true, lock: updated }
  }

  async function unlockLock(lockId: string): Promise<{ success: boolean, error?: string }> {
    const lock = locks.value.find(l => l.id === lockId)
    if (!lock)
      return { success: false, error: 'Lock not found.' }
    if (!lock.online)
      return { success: false, error: 'Lock is offline. Try again when it reconnects.' }
    // Mock network delay
    await new Promise(r => setTimeout(r, 600))
    return { success: true }
  }

  // --- Access codes ---

  function getCodesForLock(lockId: string): AccessCode[] {
    return codes.value.filter(c => c.lockId === lockId)
  }

  function getActiveCodeForLock(lockId: string): AccessCode | undefined {
    return codes.value.find(c => c.lockId === lockId && c.status === 'active')
  }

  async function generateAccessCode(opts: {
    lockId: string
    startsAt?: string
    endsAt?: string
    guestName?: string
    reservationId?: string
    code?: string
    purpose?: string
    scheduleType?: 'ongoing' | 'range'
  }): Promise<{ success: boolean, error?: string, code?: AccessCode }> {
    // Mock network delay so loading states are visible in the UI
    await new Promise(r => setTimeout(r, 700))
    const lock = locks.value.find(l => l.id === opts.lockId)
    if (!lock)
      return { success: false, error: 'Lock not found.' }
    const startsAt = opts.startsAt ?? new Date().toISOString()
    // Compute endsAt from the chosen schedule type:
    //  - 'ongoing' = far future (effectively always active)
    //  - 'range'   = the user-supplied endsAt (validation lives in the caller)
    //  - default   = 24h from now (auto-generated without explicit schedule)
    let endsAt: string
    if (opts.scheduleType === 'ongoing') {
      endsAt = new Date('2099-12-31T23:59:59Z').toISOString()
    }
    else if (opts.endsAt) {
      endsAt = opts.endsAt
    }
    else {
      endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }
    // Revoke any existing active code on this lock FOR THE SAME RESERVATION (so different guests
    // can each have their own code on the same lock, and housekeeping codes don't conflict with guest codes)
    codes.value = codes.value.map(c =>
      c.lockId === opts.lockId && c.reservationId === opts.reservationId && c.status === 'active'
        ? { ...c, status: 'revoked' }
        : c,
    )
    const newCode: AccessCode = {
      id: `code-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lockId: opts.lockId,
      code: opts.code ?? randomCode(),
      startsAt,
      endsAt,
      guestName: opts.guestName,
      reservationId: opts.reservationId,
      purpose: opts.purpose,
      scheduleType: opts.scheduleType,
      status: 'active',
      providerCodeId: `code-${Math.random().toString(36).slice(2, 10)}`,
    }
    codes.value = [newCode, ...codes.value]
    return { success: true, code: newCode }
  }

  /**
   * Find an existing active access code value for a given (reservationId, provider) combo.
   * Returns the code value string if found, undefined otherwise.
   * Used to share a single code value across multiple locks of the same brand for the same guest.
   */
  function findActiveBrandCode(reservationId: string, provider: SmartLockProvider): string | undefined {
    const matchedCode = codes.value.find((c) => {
      if (c.reservationId !== reservationId)
        return false
      if (c.status !== 'active')
        return false
      const matchedLock = locks.value.find(l => l.id === c.lockId)
      if (!matchedLock)
        return false
      const matchedDevice = MOCK_DEVICES.find(d => d.deviceId === matchedLock.providerDeviceId)
      if (!matchedDevice)
        return false
      return matchedDevice.provider === provider
    })
    return matchedCode?.code
  }

  /**
   * A reservation's active, dated codes that stop on its (old) check-out day,
   * read in Bali time (UTC+8). Ongoing codes and ones ending on another day
   * were scheduled on purpose and are left alone.
   */
  function codesEndingOn(reservationId: string, date: string): AccessCode[] {
    return codes.value.filter((c) => {
      if (c.reservationId !== reservationId || c.status !== 'active' || c.scheduleType === 'ongoing')
        return false
      const ms = new Date(c.endsAt).getTime()
      return !Number.isNaN(ms) && new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 10) === date
    })
  }

  /**
   * A stay was extended: its codes ending on the old check-out day now end the
   * same time on the new one. Mock provider, so this is a local update.
   * Returns how many codes moved.
   */
  function extendCodesForReservation(reservationId: string, fromDate: string, toDate: string): number {
    const moving = new Set(codesEndingOn(reservationId, fromDate).map(c => c.id))
    if (!moving.size)
      return 0
    const shiftMs = new Date(`${toDate}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()
    codes.value = codes.value.map(c => moving.has(c.id)
      ? { ...c, endsAt: new Date(new Date(c.endsAt).getTime() + shiftMs).toISOString(), scheduleType: 'range' as const }
      : c)
    return moving.size
  }

  function revokeAccessCode(codeId: string) {
    codes.value = codes.value.map(c => c.id === codeId ? { ...c, status: 'revoked' } : c)
  }

  // --- Mock alert generator (for the 5 SMART_LOCK_* alert types) ---

  function emitMockAlerts() {
    if (!isConnected.value)
      return
    const notif = useNotifications()
    locks.value.forEach((lock) => {
      if (lock.batteryLevel <= 5) {
        notif.createAlert('SMART_LOCK_BATTERY_CRITICAL', 'CRITICAL', {
          listing_id: lock.listingId,
          lock_name: lock.name,
          battery: lock.batteryLevel,
        })
      }
      else if (lock.batteryLevel <= 20) {
        notif.createAlert('SMART_LOCK_BATTERY_LOW', 'WARNING', {
          listing_id: lock.listingId,
          lock_name: lock.name,
          battery: lock.batteryLevel,
        })
      }
      if (!lock.online) {
        notif.createAlert('SMART_LOCK_OFFLINE', 'CRITICAL', {
          listing_id: lock.listingId,
          lock_name: lock.name,
        })
      }
    })
  }

  return {
    connection,
    isConnected,
    locks,
    codes,
    allDevices,
    availableDevices,
    validateAndConnect,
    disconnect,
    syncDevices,
    getLocksForListing,
    getLocksForUnit,
    getLockCount,
    getMainLock,
    pairLock,
    unpairLock,
    setMainLock,
    renameLock,
    swapDevice,
    unlockLock,
    getCodesForLock,
    getActiveCodeForLock,
    generateAccessCode,
    revokeAccessCode,
    codesEndingOn,
    extendCodesForReservation,
    findActiveBrandCode,
    emitMockAlerts,
  }
}
