import type { SyncLog } from '@/components/finance/data/jurnal'
import { computed, ref } from 'vue'
import { mockSyncLogs } from '@/components/finance/data/jurnal'
import { useCosts } from '@/composables/useCosts'
import { useReservations } from '@/composables/useReservations'

export function useJurnal() {
  const isConnected = useState<boolean>('jurnal-connected', () => true)
  const apiKey = useState<string>('jurnal-api-key', () => 'sk-jurnal-••••••••••••••••••••••••')
  const apiKeyInput = ref('')
  const companyName = useState<string>('jurnal-company', () => 'Elev8 Suite Bali')
  const lastConnected = useState<string>('jurnal-last-connected', () => '2026-05-01')

  // Mekari Jurnal uses IDR; exchange rate is mocked (CHF → IDR)
  const accountingCurrency = 'IDR'
  const exchangeRate = 18_524 // 1 CHF ≈ 18,524 IDR

  function convertToAccounting(chf: number): number {
    return Math.round(chf * exchangeRate)
  }

  function formatAccounting(amount: number): string {
    return `IDR ${amount.toLocaleString('id-ID')}`
  }
  const isTesting = ref(false)
  const isSaving = ref(false)
  const isPushingCosts = ref(false)
  const isPushingRevenue = ref(false)

  const syncLogs = useState<SyncLog[]>('jurnal-sync-logs', () => mockSyncLogs)

  const { costs, markSynced } = useCosts()
  const { reservations, markSynced: markReservationSynced } = useReservations()

  const unsyncedCosts = computed(() => costs.value.filter(c => !c.synced))
  const unsyncedReservations = computed(() => reservations.value.filter(r => !r.synced))

  const pendingCostEntries = computed(() => unsyncedCosts.value.length)
  const pendingRevenueEntries = computed(() => unsyncedReservations.value.length)

  const lastCostSync = computed(() => {
    const last = syncLogs.value.find(l => l.type === 'Cost' && l.status === 'Success')
    return last?.date ?? null
  })

  const lastRevenueSync = computed(() => {
    const last = syncLogs.value.find(l => l.type === 'Revenue' && l.status === 'Success')
    return last?.date ?? null
  })

  async function testConnection() {
    isTesting.value = true
    await new Promise(r => setTimeout(r, 1500))
    isTesting.value = false
    return true
  }

  async function saveApiKey() {
    if (!apiKeyInput.value.trim())
      return
    isSaving.value = true
    await new Promise(r => setTimeout(r, 1200))
    apiKey.value = apiKeyInput.value.replace(/.(?=.{4})/g, '•')
    apiKeyInput.value = ''
    isConnected.value = true
    lastConnected.value = new Date().toISOString().slice(0, 10)
    isSaving.value = false
  }

  function disconnect() {
    isConnected.value = false
    apiKey.value = ''
    // Let the sheet close animation finish, then navigate to Costs tab
    setTimeout(() => {
      useState<string>('finance-active-tab').value = 'costs'
    }, 350)
  }

  async function pushCosts() {
    if (unsyncedCosts.value.length === 0)
      return
    isPushingCosts.value = true
    const count = unsyncedCosts.value.length
    const ids = unsyncedCosts.value.map(c => c.id)
    await new Promise(r => setTimeout(r, 2000))
    ids.forEach(id => markSynced(id))
    const newLog: SyncLog = {
      id: `sync-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'Cost',
      entriesTotal: count,
      entriesSuccess: count,
      status: 'Success',
      jurnalReference: `JRN-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      pushedBy: 'Komang Juliantara',
    }
    syncLogs.value = [newLog, ...syncLogs.value]
    isPushingCosts.value = false
  }

  async function pushRevenue() {
    if (unsyncedReservations.value.length === 0)
      return
    isPushingRevenue.value = true
    const count = unsyncedReservations.value.length
    const toSync = unsyncedReservations.value.map(r => ({ id: r.id, checkIn: r.checkIn }))
    await new Promise(r => setTimeout(r, 2000))
    toSync.forEach(({ id, checkIn }) => markReservationSynced(id, checkIn))
    const newLog: SyncLog = {
      id: `sync-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'Revenue',
      entriesTotal: count,
      entriesSuccess: count,
      status: 'Success',
      jurnalReference: `JRN-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      pushedBy: 'Komang Juliantara',
    }
    syncLogs.value = [newLog, ...syncLogs.value]
    isPushingRevenue.value = false
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return {
    isConnected,
    apiKey,
    apiKeyInput,
    companyName,
    lastConnected,
    isTesting,
    isSaving,
    isPushingCosts,
    isPushingRevenue,
    syncLogs,
    pendingCostEntries,
    pendingRevenueEntries,
    lastCostSync,
    lastRevenueSync,
    accountingCurrency,
    exchangeRate,
    convertToAccounting,
    formatAccounting,
    testConnection,
    saveApiKey,
    disconnect,
    pushCosts,
    pushRevenue,
    formatDate,
  }
}
