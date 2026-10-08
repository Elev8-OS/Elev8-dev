import type { UpsellCategory, UpsellService } from '@/components/upsells/data/upsell-services'
import { computed } from 'vue'
import { serviceGrantsLockAccess } from '@/components/upsells/data/lock-access'
import { mockUpsellServices, sellableServices } from '@/components/upsells/data/upsell-services'
import { richTextToPlainText } from '~/lib/rich-text'

export function useUpsellServices() {
  const services = useState<UpsellService[]>('upsell-services', () =>
    mockUpsellServices.map(s => ({ ...s })))

  // Shared state: the filter bar and the table each call this composable, and a
  // plain ref would give each its own copy (the table never saw the filter).
  const filterCategory = useState<UpsellCategory | 'all'>('upsell-filter-category', () => 'all')
  const filterStatus = useState<'all' | 'active' | 'inactive'>('upsell-filter-status', () => 'all')
  const filterListing = useState<string>('upsell-filter-listing', () => 'all')
  /** 'lock' narrows to services that hand the guest a door code on payment. */
  const filterLockAccess = useState<'all' | 'lock' | 'no_lock'>('upsell-filter-lock', () => 'all')
  /** Matches name, category, description text and item names. */
  const searchQuery = useState<string>('upsell-filter-search', () => '')

  function matchesSearch(s: UpsellService, query: string): boolean {
    const haystack = [s.name, s.category, richTextToPlainText(s.description), ...s.items.map(i => i.name)]
    return haystack.some(text => text.toLowerCase().includes(query))
  }

  /**
   * The Upsells page's catalog. ⚠️ Damage Protection services are left out: the
   * waiver's one package is managed in Settings, Damage protection, never here.
   */
  const filteredServices = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    return sellableServices(services.value).filter((s) => {
      if (query && !matchesSearch(s, query))
        return false
      if (filterCategory.value !== 'all' && s.category !== filterCategory.value)
        return false
      if (filterStatus.value !== 'all' && s.status !== filterStatus.value)
        return false
      if (filterListing.value !== 'all' && !s.assignedListings.includes(filterListing.value))
        return false
      if (filterLockAccess.value !== 'all' && serviceGrantsLockAccess(s) !== (filterLockAccess.value === 'lock'))
        return false
      return true
    })
  })

  const activeServices = computed(() =>
    services.value.filter(s => s.status === 'active'),
  )

  /** Returns the new service, so a caller can link to it (the damage waiver package does). */
  function addService(data: Omit<UpsellService, 'id' | 'createdAt' | 'updatedAt'>): UpsellService {
    const now = new Date().toISOString()
    // The next free number: counting the list could repeat an id the seed already uses.
    let n = services.value.length + 1
    while (services.value.some(s => s.id === `svc-${String(n).padStart(3, '0')}`))
      n++
    const created: UpsellService = { ...data, id: `svc-${String(n).padStart(3, '0')}`, createdAt: now, updatedAt: now }
    services.value = [...services.value, created]
    return created
  }

  function updateService(id: string, updates: Partial<UpsellService>) {
    services.value = services.value.map(s =>
      s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s,
    )
  }

  function deleteService(id: string) {
    services.value = services.value.filter(s => s.id !== id)
  }

  function toggleStatus(id: string) {
    services.value = services.value.map(s =>
      s.id === id
        ? { ...s, status: s.status === 'active' ? 'inactive' : 'active', updatedAt: new Date().toISOString() }
        : s,
    )
  }

  function clearFilters() {
    filterCategory.value = 'all'
    filterStatus.value = 'all'
    filterListing.value = 'all'
    filterLockAccess.value = 'all'
    searchQuery.value = ''
  }

  return {
    services,
    filteredServices,
    activeServices,
    filterCategory,
    filterStatus,
    filterListing,
    filterLockAccess,
    searchQuery,
    addService,
    updateService,
    deleteService,
    toggleStatus,
    clearFilters,
  }
}
