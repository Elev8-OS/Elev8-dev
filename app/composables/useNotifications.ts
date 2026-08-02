import type { Alert, AlertSeverity } from '~/components/notifications/data/alerts'
import { formatDistanceToNow } from 'date-fns'
import { computed } from 'vue'
import { alertRouteMap, getDescription as getAlertDescription, mockAlerts } from '~/components/notifications/data/alerts'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useRoles } from '~/composables/useRoles'
import { filterAlertsForUser } from '~/lib/notification-routing'

export type SeverityFilter = 'all' | 'critical' | 'warning' | 'info'
export type NotificationKindFilter = 'all' | 'system' | 'upsell' | 'cleaning' | 'calls' | 'reviews' | 'guest_activity'

function makeAlert(alert_id: string, type: Alert['type'], severity: AlertSeverity, context: Record<string, any>, listing_id: string | null = null): Alert {
  return { alert_id, type, severity, status: 'ACTIVE', listing_id, property_id: null, triggered_at: new Date().toISOString(), resolved_at: null, auto_resolve: true, resolve_condition: 'Handled from Notification Center', context }
}

function buildSeedUpsellAlerts(): Alert[] {
  return [
    makeAlert('alert-upsell-seed-001', 'UPSELL_ORDER_REQUESTED', 'WARNING', { orderId: 'ord-006', guestName: 'Cameron Skillcorn', serviceName: 'Airport Transfer (Ngurah Rai)', serviceDate: '2026-05-12', listing_id: null }),
    makeAlert('alert-upsell-seed-002', 'UPSELL_ORDER_REQUESTED', 'WARNING', { orderId: 'ord-007', guestName: 'Amanda Healey', serviceName: 'In-Villa Spa Treatment', serviceDate: '2026-05-12', listing_id: null }),
    makeAlert('alert-upsell-seed-003', 'UPSELL_ORDER_APPROVED', 'INFO', { orderId: 'ord-008', guestName: 'Khasan Alshalabi', serviceName: 'Surf Lesson at Canggu', serviceDate: '2026-05-12', listing_id: null }),
    makeAlert('alert-upsell-seed-004', 'UPSELL_ORDER_DECLINED', 'WARNING', { orderId: 'ord-010', guestName: 'Reto Wyss', serviceName: 'Late Check-out (until 2pm)', serviceDate: '2026-05-10', listing_id: null }),
    makeAlert('alert-upsell-seed-005', 'UPSELL_PAYMENT_RECEIVED', 'INFO', { orderId: 'ord-005', guestName: 'James Alizada', serviceName: 'Vehicle Rental', serviceDate: '2026-05-07', listing_id: null }),
  ]
}

function getSeededAlerts(existingAlerts: Alert[]) {
  const existingIds = new Set(existingAlerts.map(alert => alert.alert_id))
  return [...existingAlerts, ...buildSeedUpsellAlerts().filter(alert => !existingIds.has(alert.alert_id))]
}

export function getNotificationKind(type: Alert['type']): NotificationKindFilter {
  if (['CALL_INCOMING', 'CALL_MISSED', 'CALL_COMPLETED'].includes(type))
    return 'calls'
  if (['CLEANING_NOT_STARTED_IMMINENT', 'CLEANING_NOT_DONE_CHECKIN_PASSED', 'NO_HOUSEKEEPING_ASSIGNED'].includes(type))
    return 'cleaning'
  if (['AIRBNB_REVIEW_GENERATED', 'AIRBNB_REVIEW_POSTED', 'AIRBNB_REVIEW_FAILED', 'REVIEW_GUEST_LEFT', 'REVIEW_HOST_DUE'].includes(type))
    return 'reviews'
  if (type.startsWith('UPSELL_'))
    return 'upsell'
  if (['GUEST_CHECKED_IN', 'GUEST_CHECKED_OUT', 'GUEST_ARRIVAL_SOON'].includes(type))
    return 'guest_activity'
  return 'system'
}

export function useNotifications() {
  const alerts = useState<Alert[]>('notifications-alerts', () => JSON.parse(JSON.stringify(mockAlerts)))
  const seededAlerts = getSeededAlerts(alerts.value)
  if (seededAlerts.length !== alerts.value.length)
    alerts.value = seededAlerts
  const selectedSeverity = ref<SeverityFilter>('all')
  const selectedKind = ref<NotificationKindFilter>('all')
  const { currentUser } = useCurrentDashboardUser()
  const { getRole } = useRoles()
  const currentRole = computed(() => currentUser.value ? getRole(currentUser.value.roleId) : undefined)
  const visibleAlerts = computed(() => filterAlertsForUser(alerts.value, currentUser.value, currentRole.value))
  const activeAlerts = computed(() => visibleAlerts.value.filter(a => a.status === 'ACTIVE'))
  const unreadCount = computed(() => activeAlerts.value.length)
  const filteredAlerts = computed(() => activeAlerts.value.filter((a) => {
    const severityMatch = selectedSeverity.value === 'all' || a.severity.toLowerCase() === selectedSeverity.value
    const kindMatch = selectedKind.value === 'all' || getNotificationKind(a.type) === selectedKind.value
    return severityMatch && kindMatch
  }))
  function markAsRead(alertId: string) {
    if (!visibleAlerts.value.some(a => a.alert_id === alertId))
      return
    alerts.value = alerts.value.map(a => a.alert_id === alertId ? { ...a, status: 'RESOLVED' as const, resolved_at: new Date().toISOString() } : a)
  }
  function markAllAsRead() {
    const visibleIds = new Set(activeAlerts.value.map(a => a.alert_id))
    const now = new Date().toISOString()
    alerts.value = alerts.value.map(a => visibleIds.has(a.alert_id) ? { ...a, status: 'RESOLVED' as const, resolved_at: now } : a)
  }
  function dismiss(alertId: string) { markAsRead(alertId) }
  function navigateToAlert(alert: Alert) {
    if (!visibleAlerts.value.some(a => a.alert_id === alert.alert_id))
      return
    markAsRead(alert.alert_id)
    navigateTo(alertRouteMap[alert.type] || '/')
  }
  function getTimeAgo(isoString: string) { return formatDistanceToNow(new Date(isoString), { addSuffix: true }) }
  function getDescription(type: Alert['type'], context: Record<string, any>) { return getAlertDescription(type, context) }
  function createAlert(type: Alert['type'], severity: AlertSeverity, context: Record<string, any>) {
    const id = `alert-${type.toLowerCase()}-${String(alerts.value.length + 1).padStart(3, '0')}`
    alerts.value = [makeAlert(id, type, severity, context, context.listing_id ?? null), ...alerts.value]
  }
  function createUpsellAlert(type: 'UPSELL_ORDER_REQUESTED' | 'UPSELL_ORDER_APPROVED' | 'UPSELL_ORDER_DECLINED' | 'UPSELL_PAYMENT_RECEIVED' | 'UPSELL_FULFILLMENT_STARTED' | 'UPSELL_FULFILLMENT_COMPLETED', context: Record<string, any>) {
    createAlert(type, type === 'UPSELL_ORDER_REQUESTED' || type === 'UPSELL_ORDER_DECLINED' ? 'WARNING' : 'INFO', context)
  }
  function createGuestActivityAlert(type: 'GUEST_CHECKED_IN' | 'GUEST_CHECKED_OUT' | 'GUEST_ARRIVAL_SOON', context: Record<string, any>) { createAlert(type, 'INFO', context) }
  function createLexwareAlert(type: 'LEXWARE_DRAFT_INVOICE_READY' | 'LEXWARE_CONNECTION_NEEDS_ATTENTION' | 'LEXWARE_TAX_MAPPING_HOLD' | 'LEXWARE_CREDIT_NOTE_CREATED' | 'LEXWARE_NON_EUR_EXCLUDED', context: Record<string, any>) {
    let severity: AlertSeverity = 'INFO'
    if (type === 'LEXWARE_CONNECTION_NEEDS_ATTENTION')
      severity = 'CRITICAL'
    else if (type === 'LEXWARE_TAX_MAPPING_HOLD')
      severity = 'WARNING'
    createAlert(type, severity, context)
  }
  return { alerts, visibleAlerts, activeAlerts, unreadCount, selectedSeverity, selectedKind, filteredAlerts, markAsRead, markAllAsRead, dismiss, navigateToAlert, getTimeAgo, getDescription, createAlert, createUpsellAlert, createGuestActivityAlert, createLexwareAlert }
}

export { getNotificationKind as getAlertKind }
