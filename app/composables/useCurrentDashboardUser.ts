import { useUsers } from '~/composables/useUsers'

export const DEFAULT_DASHBOARD_USER_ID = 'user-1'

export function useCurrentDashboardUser() {
  const { getUser, users } = useUsers()
  const currentUserId = useState<string>('current-dashboard-user-id', () => DEFAULT_DASHBOARD_USER_ID)
  const currentUser = computed(() => getUser(currentUserId.value))

  function setCurrentUserId(id: string) {
    currentUserId.value = id
  }

  return { currentUser, currentUserId, setCurrentUserId, users }
}
