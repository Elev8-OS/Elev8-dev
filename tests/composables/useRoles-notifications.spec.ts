import { describe, expect, it } from 'vitest'
import type { AlertType } from '~/components/notifications/data/alerts'
import { alertDisplayLabels } from '~/components/notifications/data/alerts'
import {
  notificationCategories,
  getDefaultRoleNotifications,
  normalizeRoleNotifications,
} from '~/components/notifications/data/notification-settings'

describe('notification settings metadata', () => {
  it('defines guest checkout as a role-configurable alert', () => {
    const guestCategory = notificationCategories.find(category => category.id === 'guest_activity')
    expect(guestCategory?.alertTypes).toContain('GUEST_CHECKED_OUT')
    expect(alertDisplayLabels.GUEST_CHECKED_OUT).toBe('Guest Checked Out')
  })

  it('does not expose owner activity in role categories', () => {
    const configuredTypes = notificationCategories.flatMap(category => category.alertTypes)
    expect(configuredTypes).not.toContain('OWNER_STATEMENT_DRAFT_READY')
    expect(configuredTypes).not.toContain('OWNER_STAY_CONFIRMED')
  })

  it('enables checkout alerts for housekeeping roles', () => {
    expect(getDefaultRoleNotifications('role-housekeeping').enabledAlertTypes)
      .toContain('GUEST_CHECKED_OUT')
    expect(getDefaultRoleNotifications('role-housekeeping-manager').enabledAlertTypes)
      .toContain('GUEST_CHECKED_OUT')
  })

  it('normalizes malformed policies to safe defaults', () => {
    const normalized = normalizeRoleNotifications({
      enabledAlertTypes: ['NOT_A_REAL_ALERT' as AlertType],
      channels: ['pager' as never],
    }, 'role-housekeeping')

    expect(normalized.enabledAlertTypes).toEqual(
      getDefaultRoleNotifications('role-housekeeping').enabledAlertTypes,
    )
    expect(normalized.channels).toEqual(['in_app', 'mobile'])
  })
})