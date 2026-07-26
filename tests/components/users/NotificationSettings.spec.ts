import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { getDefaultRoleNotifications } from '~/components/notifications/data/notification-settings'
import NotificationSettings from '~/components/users/NotificationSettings.vue'

describe('notificationSettings', () => {
  it('renders channels and excludes owner activity', () => {
    const wrapper = mount(NotificationSettings, {
      props: {
        modelValue: getDefaultRoleNotifications('role-housekeeping'),
      },
    })

    expect(wrapper.get('[data-testid="notification-channel-in_app"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="notification-alert-GUEST_CHECKED_OUT"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="notification-alert-OWNER_STAY_CONFIRMED"]').exists()).toBe(false)
  })

  it('emits an updated policy when an alert is toggled', async () => {
    const value = getDefaultRoleNotifications('role-housekeeping')
    const wrapper = mount(NotificationSettings, { props: { modelValue: value } })
    const checkout = wrapper.get('[data-testid="notification-alert-GUEST_CHECKED_OUT"]')

    await checkout.trigger('click')
    await flushPromises()

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toHaveLength(1)
    expect(emitted![0][0]).toEqual(expect.objectContaining({
      enabledAlertTypes: expect.not.arrayContaining(['GUEST_CHECKED_OUT']),
    }))
    expect(value.enabledAlertTypes).toContain('GUEST_CHECKED_OUT')
  })

  it('emits channel changes and does not mutate the prop object', async () => {
    const value = getDefaultRoleNotifications('role-housekeeping')
    const wrapper = mount(NotificationSettings, { props: { modelValue: value } })

    await wrapper.get('[data-testid="notification-channel-email"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')![0][0]).toEqual(expect.objectContaining({
      channels: expect.arrayContaining(['email']),
    }))
    expect(value.channels).not.toContain('email')
  })
})
