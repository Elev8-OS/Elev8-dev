import type { ViewOwner } from '~/lib/saved-view-ownership'
import { computed } from 'vue'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'

/** The logged-in dashboard user as the owner of the saved views they create. */
export function useSavedViewOwner() {
  const { currentUser, currentUserId } = useCurrentDashboardUser()
  const owner = computed<ViewOwner>(() => ({
    id: currentUserId.value,
    name: currentUser.value?.name ?? 'Komang Juliantara',
  }))
  return { owner, currentUserId }
}
