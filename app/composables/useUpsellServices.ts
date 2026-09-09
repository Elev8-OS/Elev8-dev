import type { UpsellCategory, UpsellService } from '@/components/upsells/data/upsell-services'
import { computed } from 'vue'
import { serviceGrantsLockAccess } from '@/components/upsells/data/lock-access'
import { mockUpsellServices } from '@/components/upsells/data/upsell-services'

export function useUpsellServices() {
  const services = useState<UpsellService[]>('upsell-services', () =>
    mockUpsellServices.map(s => ({ ...s })))

  const filterCategory = ref<UpsellCategory | 'all'>('all')
  const filterStatus = ref<'all' | 'active' | 'inactive'>('all')
  const filterListing = ref<string>('all')
  /** 'lock' narrows to services that hand the guest a door code on payment. */
  const filterLockAccess = ref<'all' | 'lock' | 'no_lock'>('all')

  const filteredServices = computed(() => {
    return services.value.filter((s) => {
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

  function addService(data: Omit<UpsellService, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    const id = `svc-${String(services.value.length + 1).padStart(3, '0')}`
    services.value = [...services.value, {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    }]
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
  }

  return {
    services,
    filteredServices,
    activeServices,
    filterCategory,
    filterStatus,
    filterListing,
    filterLockAccess,
    addService,
    updateService,
    deleteService,
    toggleStatus,
    clearFilters,
  }
}
