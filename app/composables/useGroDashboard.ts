import { resolveConversationTenantId } from '~/components/inbox/data/conversations'
import { useGroScope } from './useGroScope'
import { useInbox } from './useInbox'
import { useCallsFilters } from './useCallsFilters'
import { useNotifications } from './useNotifications'

export function useGroDashboard() {
  const gro = useGroScope()
  const inbox = useInbox()
  const calls = useCallsFilters()
  const notifications = useNotifications()

  const scopeTenantIds = computed<string[]>(() => {
    if (!gro.isGro.value)
      return []
    if (gro.activeTenantId.value === 'all')
      return gro.assignedTenants.value.map(t => t.id)
    return [gro.activeTenantId.value]
  })

  const scopedConversations = computed(() => {
    const ids = scopeTenantIds.value
    if (!ids.length)
      return []
    return inbox.conversations.value.filter(c => ids.includes(resolveConversationTenantId(c)))
  })

  const kpis = computed(() => ({
    tenants: scopeTenantIds.value.length,
    conversations: scopedConversations.value.length,
    actionNeeded: scopedConversations.value.filter(c => c.status === 'action_needed').length,
    unread: scopedConversations.value.filter(c => c.unreadCount > 0).length,
    currentStays: scopedConversations.value.filter(c => c.stayStatus === 'current').length,
    upcoming: scopedConversations.value.filter(c => c.stayStatus === 'future').length,
    missedCalls: calls.statusSummary.value.missed,
    activeAlerts: notifications.activeAlerts.value.length,
  }))

  const tenantRows = computed(() => {
    return gro.assignedTenants.value.map((t) => {
      const convs = inbox.conversations.value.filter(c => resolveConversationTenantId(c) === t.id)
      return {
        id: t.id,
        name: t.name,
        logoText: t.logoText,
        conversations: convs.length,
        actionNeeded: convs.filter(c => c.status === 'action_needed').length,
        unread: convs.filter(c => c.unreadCount > 0).length,
        current: convs.filter(c => c.stayStatus === 'current').length,
        future: convs.filter(c => c.stayStatus === 'future').length,
        missedCalls: calls.filteredMatched.value.filter((c) => {
          const conv = inbox.conversations.value.find(cv => cv.id === c.conversationId)
          return conv && resolveConversationTenantId(conv) === t.id && c.status === 'missed'
        }).length,
      }
    }).sort((a, b) => b.actionNeeded - a.actionNeeded || b.unread - a.unread)
  })

  const queue = computed(() =>
    scopedConversations.value
      .filter(c => c.status === 'action_needed' || c.unreadCount > 0)
      .sort((a, b) =>
        (Number(b.status === 'action_needed') - Number(a.status === 'action_needed'))
        || (b.unreadCount - a.unreadCount)
        || (new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()),
      )
      .slice(0, 20),
  )

  function tenantName(id: string): string {
    return gro.tenantName(id)
  }

  return {
    isGro: gro.isGro,
    activeTenantId: gro.activeTenantId,
    tenantRows,
    kpis,
    queue,
    tenantName,
  }
}
