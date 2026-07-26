import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { getDefaultRoleNotifications } from '~/components/notifications/data/notification-settings'
import NotificationSettings from '~/components/users/NotificationSettings.vue'

describe('notificationSettings', () => {
  it('renders one toggle per category and excludes owner activity', () => {
    const wrapper = mount(NotificationSettings, {
      props: {
        modelValue: getDefaultRoleNotifications('role-housekeeping'),
      },
    })

    // Housekeeping defaults include guest_activity, so the toggle is on.
    expect(wrapper.get('[data-testid="notification-category-toggle-guest_activity"]').exists()).toBe(true)
    // Owner Activity is intentionally absent from the role categories.
    expect(wrapper.find('[data-testid="notification-category-toggle-owner_activity"]').exists()).toBe(false)
  })

  it('toggles an entire category on and emits an updated enabledAlertTypes list', async () => {
    const value = getDefaultRoleNotifications('role-housekeeping')
    // Start with guest_activity disabled so the click turns it on.
    value.enabledAlertTypes = value.enabledAlertTypes.filter(t => t !== 'GUEST_CHECKED_OUT')

    const wrapper = mount(NotificationSettings, { props: { modelValue: value } })
    const toggle = wrapper.get('[data-testid="notification-category-toggle-guest_activity"]')

    await toggle.trigger('click')
    await flushPromises()

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toHaveLength(1)
    // The patch should add every alert in the guest_activity category, not just one.
    const next = emitted![0][0] as { enabledAlertTypes: string[] }
    expect(next.enabledAlertTypes).toContain('GUEST_CHECKED_OUT')
    expect(next.enabledAlertTypes).toContain('GUEST_CHECKED_IN')
    expect(next.enabledAlertTypes).toContain('GUEST_ARRIVAL_SOON')
  })

  it('toggles a category off and removes every alert in that category from the emitted list', async () => {
    const value = getDefaultRoleNotifications('role-housekeeping')
    expect(value.enabledAlertTypes).toContain('GUEST_CHECKED_OUT')

    const wrapper = mount(NotificationSettings, { props: { modelValue: value } })
    const toggle = wrapper.get('[data-testid="notification-category-toggle-guest_activity"]')

    await toggle.trigger('click')
    await flushPromises()

    const emitted = wrapper.emitted('update:modelValue')![0][0] as { enabledAlertTypes: string[] }
    expect(emitted.enabledAlertTypes).not.toContain('GUEST_CHECKED_OUT')
    expect(emitted.enabledAlertTypes).not.toContain('GUEST_CHECKED_IN')
    expect(emitted.enabledAlertTypes).not.toContain('GUEST_ARRIVAL_SOON')
    // Prop is not mutated.
    expect(value.enabledAlertTypes).toContain('GUEST_CHECKED_OUT')
  })
})
