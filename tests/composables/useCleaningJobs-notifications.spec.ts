import { beforeEach, describe, expect, it } from 'vitest'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useNotifications } from '~/composables/useNotifications'

beforeEach(() => {
  window.localStorage.clear()
})

describe('checkout cleaning notifications', () => {
  it('creates a guest checkout alert alongside the cleaning job', () => {
    const { alerts } = useNotifications()
    const { createFromCheckout } = useCleaningJobs()

    const job = createFromCheckout({
      id: 'res-1',
      listingId: 'lst-1',
      listingName: 'Villa Bidadari',
      checkOut: '2026-07-26',
      guestName: 'Anna Schmidt',
    })

    expect(job.source).toBe('checkout')
    expect(alerts.value.some(alert =>
      alert.type === 'GUEST_CHECKED_OUT'
      && alert.listing_id === 'lst-1'
      && alert.context.guest_name === 'Anna Schmidt',
    )).toBe(true)
  })
})
