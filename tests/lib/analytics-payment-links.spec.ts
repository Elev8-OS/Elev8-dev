import type { PaymentRequest } from '~/components/payment-request/data/payment-requests'
import { describe, expect, it } from 'vitest'
import { paymentLinkSummary } from '~/components/analytics/data/payment-link-insights'

function link(over: Partial<PaymentRequest>): PaymentRequest {
  return {
    id: 'pr-x',
    guestName: 'A',
    guestEmail: 'a@example.com',
    listingId: 'lst-1',
    title: 'T',
    category: 'accommodation',
    amount: 100,
    currency: 'USD',
    feeMode: 'card',
    feeAmount: 3,
    totalAmount: 103,
    status: 'paid',
    payoutAccountId: 'pay-1',
    paymentLink: 'x',
    expiresAt: '2026-06-20T00:00:00Z',
    paidAt: '2026-06-10T12:00:00',
    createdAt: '2026-06-09T12:00:00',
    createdBy: 'staff-2',
    ...over,
  }
}
const span = { start: '2026-06-01', end: '2026-06-30' }
const scope = new Set(['lst-1'])

describe('paymentLinkSummary', () => {
  it('groups paid links by category on the amount before fees, biggest first', () => {
    const s = paymentLinkSummary([
      link({ id: '1', amount: 100 }),
      link({ id: '2', category: 'city_tax', amount: 300 }),
      link({ id: '3', category: 'city_tax', amount: 50 }),
    ], scope, span, 'USD')
    expect(s.paid).toBe(450)
    expect(s.paidLinks).toBe(3)
    expect(s.byCategory.map(c => [c.category, c.amount])).toEqual([['city_tax', 350], ['accommodation', 100]])
  })

  it('counts a paid link on the day it was paid, pending ones apart', () => {
    const s = paymentLinkSummary([
      link({ id: '1', paidAt: '2026-07-02T10:00:00' }),
      link({ id: '2', status: 'pending', paidAt: undefined, amount: 40 }),
      link({ id: '3', status: 'cancelled' }),
    ], scope, span, 'USD')
    expect(s.paid).toBe(0)
    expect(s.pending).toBe(40)
    expect(s.pendingLinks).toBe(1)
  })

  it('respects the listing scope and never blends currencies', () => {
    const s = paymentLinkSummary([
      link({ id: '1', listingId: 'lst-9' }),
      link({ id: '2', currency: 'IDR', amount: 500000 }),
      link({ id: '3', amount: 70 }),
    ], scope, span, 'USD')
    expect(s.paid).toBe(70)
  })
})
