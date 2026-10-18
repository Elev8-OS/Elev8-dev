// Revenue category on payment links: stored, copied on duplicate, filterable.

import { describe, expect, it } from 'vitest'
import { usePaymentRequests } from '~/composables/usePaymentRequests'

function draft(category: 'accommodation' | 'city_tax') {
  return {
    guestName: 'Ann Lee',
    guestEmail: 'ann@example.com',
    listingId: 'lst-1',
    title: 'Payment',
    category,
    amount: 100,
    currency: 'USD' as const,
    feeMode: 'no_fee' as const,
    expiresInHours: 24,
  }
}

describe('payment request category', () => {
  it('keeps the category on create and duplicate', () => {
    const payments = usePaymentRequests()
    const created = payments.createRequest(draft('city_tax'))
    expect(created.category).toBe('city_tax')
    expect(payments.duplicateRequest(created.id)!.category).toBe('city_tax')
  })

  it('filters by selected categories', () => {
    const payments = usePaymentRequests()
    payments.createRequest(draft('city_tax'))
    payments.filters.value = { ...payments.filters.value, categories: ['city_tax'] }
    expect(payments.filteredRequests.value.length).toBeGreaterThan(0)
    expect(payments.filteredRequests.value.every(r => r.category === 'city_tax')).toBe(true)
  })
})
