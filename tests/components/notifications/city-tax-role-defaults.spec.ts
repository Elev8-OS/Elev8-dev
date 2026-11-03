import type { RoleId } from '~/components/users/data/roles'
import { describe, expect, it } from 'vitest'
import { getDefaultRoleNotifications } from '~/components/notifications/data/notification-settings'

const CITY_TAX = ['CITY_TAX_COLLECTION_UPCOMING', 'CITY_TAX_COLLECTION_DUE', 'CITY_TAX_COLLECTION_MISSED']

function enabled(roleId: RoleId): string[] {
  return getDefaultRoleNotifications(roleId).enabledAlertTypes
}

describe('city tax alerts by default role', () => {
  it('reach the Guest Experience Manager, who works the Reservations list', () => {
    expect(enabled('role-guest-experience-manager')).toEqual(expect.arrayContaining(CITY_TAX))
  })

  it('do not open the rest of the finance alerts to the Guest Experience Manager', () => {
    const types = enabled('role-guest-experience-manager')
    expect(types).not.toContain('STRIPE_DISCONNECTED')
    expect(types).not.toContain('LEXWARE_CONNECTION_NEEDS_ATTENTION')
  })

  it('still reach the finance roles', () => {
    for (const roleId of ['role-admin', 'role-general-manager', 'role-listing-manager', 'role-back-office', 'role-finance-hr'] as RoleId[])
      expect(enabled(roleId)).toEqual(expect.arrayContaining(CITY_TAX))
  })

  it('stay away from operational staff', () => {
    expect(enabled('role-housekeeping')).not.toEqual(expect.arrayContaining(CITY_TAX))
  })
})
