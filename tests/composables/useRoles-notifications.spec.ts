import type { AlertType } from '~/components/notifications/data/alerts'
import { beforeEach, describe, expect, it } from 'vitest'
import { alertDisplayLabels } from '~/components/notifications/data/alerts'
import {
  getDefaultRoleNotifications,
  normalizeRoleNotifications,
  notificationCategories,
} from '~/components/notifications/data/notification-settings'
import { defaultRoles } from '~/components/users/data/roles'
import { useRoles } from '~/composables/useRoles'

beforeEach(() => {
  window.localStorage.clear()
})

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

describe('role notification persistence', () => {
  it('gives every default role notification channels', () => {
    expect(defaultRoles).toHaveLength(16)
    expect(defaultRoles.every(role => role.notifications.channels.length > 0)).toBe(true)
  })

  it('preserves the owner role intentionally empty alert-type defaults', () => {
    const owner = defaultRoles.find(role => role.id === 'role-owner')!

    expect(owner.notifications.enabledAlertTypes).toEqual([])
    expect(owner.notifications.channels).toEqual(['in_app'])
  })

  it('migrates a stored role that predates notification settings', () => {
    const defaultAdmin = defaultRoles.find(role => role.id === 'role-admin')!
    const legacyRole = JSON.parse(JSON.stringify(defaultAdmin))
    delete legacyRole.notifications
    const expectedWorkingHours = structuredClone(legacyRole.workingHours)
    const expectedPermissions = structuredClone(legacyRole.defaultPermissions)
    window.localStorage.setItem('elev8-tenant-roles', JSON.stringify([legacyRole]))

    const { getRole } = useRoles()
    const migrated = getRole(legacyRole.id)

    expect(migrated?.notifications.channels).toContain('in_app')
    expect(migrated?.workingHours).toEqual(expectedWorkingHours)
    expect(migrated?.defaultPermissions).toEqual(expectedPermissions)
  })

  it('normalizes malformed stored notification settings', () => {
    const defaultHousekeeping = defaultRoles.find(role => role.id === 'role-housekeeping')!
    const malformedRole = JSON.parse(JSON.stringify(defaultHousekeeping))
    malformedRole.notifications = {
      enabledAlertTypes: ['NOT_A_REAL_ALERT'],
      channels: ['pager'],
    }
    window.localStorage.setItem('elev8-tenant-roles', JSON.stringify([malformedRole]))

    const { getRole } = useRoles()

    expect(getRole(malformedRole.id)?.notifications).toEqual(
      getDefaultRoleNotifications('role-housekeeping'),
    )
  })

  it('normalizes malformed notification settings before saving a role', () => {
    const { getRole, updateRole } = useRoles()
    const role = getRole('role-housekeeping')!

    updateRole(role.id, {
      notifications: {
        enabledAlertTypes: ['NOT_A_REAL_ALERT' as AlertType],
        channels: ['pager' as never],
      },
    })

    expect(getRole(role.id)?.notifications).toEqual(
      getDefaultRoleNotifications('role-housekeeping'),
    )
    const persistedRoles = JSON.parse(window.localStorage.getItem('elev8-tenant-roles')!) as Array<{ id: string, notifications: unknown }>
    expect(persistedRoles.find(persistedRole => persistedRole.id === role.id)?.notifications).toEqual(
      getDefaultRoleNotifications('role-housekeeping'),
    )
  })

  it('saves and resets notification settings with the role', () => {
    const { getRole, updateRole, resetRoleToDefaults } = useRoles()
    const role = getRole('role-housekeeping')!

    updateRole(role.id, {
      notifications: { enabledAlertTypes: [], channels: ['email'] },
    })
    expect(getRole(role.id)?.notifications.channels).toEqual(['email'])

    resetRoleToDefaults(role.id)
    expect(getRole(role.id)?.notifications.channels).toEqual(['in_app', 'mobile'])
    expect(getRole(role.id)?.notifications.enabledAlertTypes)
      .toContain('GUEST_CHECKED_OUT')
  })
})
