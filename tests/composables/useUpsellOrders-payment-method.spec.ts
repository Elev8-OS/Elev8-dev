// Staff can record an upsell payment taken in cash, by card or by other means.

import { describe, expect, it } from 'vitest'
import { useUpsellOrders } from '~/composables/useUpsellOrders'

describe('upsell markPaid payment method', () => {
  it.each(['cash', 'card', 'manual'] as const)('records %s', (method) => {
    const { orders, markPaid } = useUpsellOrders()
    const target = orders.value.find(o => o.paymentStatus === 'unpaid' && o.approvalStatus === 'requested')!
    markPaid(target.id, method)
    const after = orders.value.find(o => o.id === target.id)!
    expect(after.paymentStatus).toBe('paid')
    expect(after.paymentMethod).toBe(method)
  })
})
