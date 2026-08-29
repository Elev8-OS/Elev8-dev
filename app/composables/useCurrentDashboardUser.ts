import { useUsers } from '~/composables/useUsers'

export const CURRENT_DASHBOARD_USER_ID = 'user-9'

export function useCurrentDashboardUser() {
  const { getUser } = useUsers()
  const currentUser = computed(() => getUser(CURRENT_DASHBOARD_USER_ID))
  return { currentUser }
}
