import type { Alert } from '~/components/notifications/data/alerts'
import type { Role } from '~/components/users/data/roles'
import type { User } from '~/components/users/data/users'

export function isAlertVisibleToUser(
  alert: Alert,
  user: User | undefined,
  role: Role | undefined,
): boolean {
  if (!user || !role)
    return false
  if (!role.notifications.channels.includes('in_app'))
    return false
  if (!role.notifications.enabledAlertTypes.includes(alert.type))
    return false
  if (alert.listing_id && user.listingIds.length > 0 && !user.listingIds.includes(alert.listing_id))
    return false
  return true
}

export function filterAlertsForUser(alerts: Alert[], user: User | undefined, role: Role | undefined): Alert[] {
  return alerts.filter(alert => isAlertVisibleToUser(alert, user, role))
}
