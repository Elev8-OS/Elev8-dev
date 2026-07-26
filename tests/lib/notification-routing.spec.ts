import { describe, expect, it } from 'vitest'
import type { Alert } from '~/components/notifications/data/alerts'
import type { Role } from '~/components/users/data/roles'
import type { User } from '~/components/users/data/users'
import { isAlertVisibleToUser } from '~/lib/notification-routing'

const user: User = {
  id: 'user-housekeeping', name: 'Ketut', phone: '', preferredLanguage: 'id',
  email: '', employeeNumber: '', monthlySalaryAmount: 0, workingDaysPerMonth: 26,
  hoursPerDay: 8, roleId: 'role-housekeeping', listingIds: ['lst-1'], status: 'active',
  initials: 'K', createdAt: '', updatedAt: '',
}

const role = {
  id: 'role-housekeeping',
  notifications: { enabledAlertTypes: ['GUEST_CHECKED_OUT'], channels: ['in_app'] },
} as Role

const checkoutAlert = {
  alert_id: 'guest-checkout-1', type: 'GUEST_CHECKED_OUT', severity: 'INFO', status: 'ACTIVE',
  listing_id: 'lst-1', property_id: null, triggered_at: '', resolved_at: null,
  auto_resolve: true, resolve_condition: '', context: {},
} as Alert

describe('isAlertVisibleToUser', () => {
  it('shows enabled in-app alerts for assigned listings', () => {
    expect(isAlertVisibleToUser(checkoutAlert, user, role)).toBe(true)
  })

  it('hides alerts for an unassigned listing', () => {
    expect(isAlertVisibleToUser({ ...checkoutAlert, listing_id: 'lst-2' }, user, role)).toBe(false)
  })

  it('hides alert types disabled by the role', () => {
    expect(isAlertVisibleToUser({ ...checkoutAlert, type: 'GUEST_CHECKED_IN' }, user, role)).toBe(false)
  })

  it('hides alerts when the role has no in-app channel', () => {
    expect(isAlertVisibleToUser(checkoutAlert, user, {
      ...role, notifications: { ...role.notifications, channels: ['email'] },
    })).toBe(false)
  })

  it('treats an empty listing assignment as all-listings scope', () => {
    expect(isAlertVisibleToUser(checkoutAlert, { ...user, listingIds: [] }, role)).toBe(true)
  })
})
