import { describe, expect, it } from 'vitest'
import { useNotifications } from '~/composables/useNotifications'

describe('useNotifications role filtering', () => {
  it('counts only visible active alerts as unread', () => {
    const { alerts, activeAlerts, unreadCount } = useNotifications()
    alerts.value = [
      {
        alert_id: 'visible', type: 'GUEST_CHECKED_OUT', severity: 'INFO', status: 'ACTIVE',
        listing_id: 'lst-1', property_id: null, triggered_at: '', resolved_at: null,
        auto_resolve: true, resolve_condition: '', context: { guest_name: 'Anna', listing_name: 'Villa Bidadari' },
      },
      {
        alert_id: 'hidden', type: 'OWNER_STAY_CONFIRMED', severity: 'INFO', status: 'ACTIVE',
        listing_id: null, property_id: null, triggered_at: '', resolved_at: null,
        auto_resolve: true, resolve_condition: '', context: {},
      },
    ]

    expect(activeAlerts.value.map(alert => alert.alert_id)).toEqual(['visible'])
    expect(unreadCount.value).toBe(1)
  })

  it('creates a guest checkout alert with listing context', () => {
    const { alerts, createGuestActivityAlert } = useNotifications()
    createGuestActivityAlert('GUEST_CHECKED_OUT', {
      listing_id: 'lst-1', listing_name: 'Villa Bidadari', guest_name: 'Anna Schmidt',
    })

    expect(alerts.value[0].type).toBe('GUEST_CHECKED_OUT')
    expect(alerts.value[0].listing_id).toBe('lst-1')
  })
})
