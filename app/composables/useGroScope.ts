import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useTenants } from '~/composables/useTenants'

export function useGroScope() {
  const { currentUser } = useCurrentDashboardUser()
  const { byId } = useTenants()

  const isGro = computed(() => currentUser.value?.roleId === 'role-guest-experience-manager')
  const activeTenantId = useState<string>('gro-active-tenant', () => 'all')
  const groSearch = useState<string>('gro-search', () => '')

  const assignedTenants = computed(() => {
    const ids = currentUser.value?.assignedTenantIds ?? []
    return ids.map(id => byId(id)).filter(t => t !== undefined)
  })

  function setActiveTenant(id: string) {
    activeTenantId.value = id
  }

  function tenantName(id: string): string {
    if (id === 'all')
      return 'All tenants'
    return byId(id)?.name ?? id
  }

  return {
    isGro,
    activeTenantId,
    groSearch,
    assignedTenants,
    setActiveTenant,
    tenantName,
  }
}
