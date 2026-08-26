import { computed } from 'vue'

export interface WhatsAppAccount {
  id: string
  businessName: string
  displayPhoneNumber: string
  phoneNumberId: string
  wabaId: string
  accessToken: string
  webhookToken: string
  status: 'connected' | 'disconnected' | 'pending'
  connectedAt: string
  listingIds: string[]
}

const STORAGE_KEY = 'elev8-whatsapp-accounts'

function loadFromStorage(): WhatsAppAccount[] {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as WhatsAppAccount[]
        return parsed.map(a => ({ ...a, listingIds: [...a.listingIds] }))
      }
    } catch { /* ignore */ }
  }
  return []
}

function saveToStorage(accounts: WhatsAppAccount[]) {
  if (import.meta.client) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
    } catch { /* ignore */ }
  }
}

export function useWhatsApp() {
  const whatsappAccounts = useState<WhatsAppAccount[]>('whatsapp-accounts', () => loadFromStorage())

  // Sync to localStorage on every change
  watch(whatsappAccounts, (val) => {
    saveToStorage(val)
  }, { deep: true })

  const isConnected = computed(() => whatsappAccounts.value.some(a => a.status === 'connected'))

  const mockBusinesses = [
    { businessName: 'Elev8 Bali Office', displayPhoneNumber: '+62 811 2345 6789' },
    { businessName: 'Elev8 Seminyak Hub', displayPhoneNumber: '+62 877 8901 2345' },
    { businessName: 'Elev8 Canggu Lodge', displayPhoneNumber: '+62 813 5678 9012' },
    { businessName: 'Zum Grauen Wolf', displayPhoneNumber: '+49 170 1234567' },
    { businessName: 'Villa Kastila', displayPhoneNumber: '+62 361 9876 543' },
  ]

  function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  async function validateAndConnect(
    _accessToken: string,
    _wabaId: string,
    _phoneNumberId: string,
    _accountName: string,
  ): Promise<{ success: true; businessName: string; displayPhoneNumber: string } | { success: false; error: string }> {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 800))

    const mock = pickRandom(mockBusinesses)
    const webhookToken = `whk_${crypto.randomUUID().replace(/-/g, '')}`

    const newAccount: WhatsAppAccount = {
      id: `wa-${Date.now()}`,
      businessName: _accountName,
      displayPhoneNumber: mock.displayPhoneNumber,
      phoneNumberId: _phoneNumberId,
      wabaId: _wabaId,
      accessToken: _accessToken,
      webhookToken,
      status: 'connected',
      connectedAt: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      listingIds: [],
    }

    addAccount(newAccount)
    return { success: true, businessName: _accountName, displayPhoneNumber: mock.displayPhoneNumber }
  }

  function addAccount(account: WhatsAppAccount) {
    whatsappAccounts.value = [...whatsappAccounts.value, account]
  }

  function removeAccount(id: string) {
    whatsappAccounts.value = whatsappAccounts.value.filter(a => a.id !== id)
  }

  function updateAccount(id: string, updates: Partial<WhatsAppAccount>) {
    whatsappAccounts.value = whatsappAccounts.value.map(a =>
      a.id === id ? { ...a, ...updates } : a,
    )
  }

  function assignListings(accountId: string, listingIds: string[]) {
    whatsappAccounts.value = whatsappAccounts.value.map((a) => {
      if (a.id === accountId) {
        return { ...a, listingIds: [...listingIds] }
      }
      return { ...a, listingIds: a.listingIds.filter(id => !listingIds.includes(id)) }
    })
  }

  function bulkAssign(accountId: string, listingIds: string[]) {
    whatsappAccounts.value = whatsappAccounts.value.map((a) => {
      if (a.id === accountId) {
        const merged = Array.from(new Set([...a.listingIds, ...listingIds]))
        return { ...a, listingIds: merged }
      }
      return { ...a, listingIds: a.listingIds.filter(id => !listingIds.includes(id)) }
    })
  }

  function getConnectedAccountForListing(listingId: string): WhatsAppAccount | undefined {
    return whatsappAccounts.value.find(a =>
      a.status === 'connected' && a.listingIds.includes(listingId),
    )
  }

  function hasConnectedAccountForListing(listingId: string): boolean {
    return getConnectedAccountForListing(listingId) !== undefined
  }

  function resolveWhatsAppCoverage(listingIds: string[]): { covered: string[], uncovered: string[] } {
    const covered: string[] = []
    const uncovered: string[] = []
    for (const id of listingIds) {
      if (hasConnectedAccountForListing(id))
        covered.push(id)
      else uncovered.push(id)
    }
    return { covered, uncovered }
  }

  function disconnect() {
    whatsappAccounts.value = []
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    whatsappAccounts,
    isConnected,
    validateAndConnect,
    addAccount,
    removeAccount,
    updateAccount,
    assignListings,
    bulkAssign,
    getConnectedAccountForListing,
    hasConnectedAccountForListing,
    resolveWhatsAppCoverage,
    disconnect,
  }
}
