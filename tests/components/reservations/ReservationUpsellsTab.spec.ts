import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'
import { mockUpsellOrders } from '~/components/upsells/data/upsell-orders'

describe('reservation detail upsells tab', () => {
  const source = readFileSync(join(process.cwd(), 'app/components/reservations/ReservationDetailSheet.vue'), 'utf8')

  it('links orders by their own reservationId, keeping legacy upsellIds', () => {
    expect(source).toContain('o.reservationId === r.id || legacyIds.has(o.id)')
  })

  it('opens the upsell order sheet when a card is clicked', () => {
    expect(source).toContain('@click="openUpsellOrder(order)"')
    expect(source).toContain('<UpsellOrderDrawer')
    expect(source).toContain(':open="upsellOrderDrawerOpen"')
  })

  it('shows the same order info as the upsell orders page', () => {
    const card = source.slice(source.indexOf('data-testid="reservation-upsell-card"'), source.indexOf('<!-- 5. Housekeeping Tab View -->'))
    for (const field of ['order.serviceName', 'order.items.length', 'getOrderStatusMeta(order).label', 'order.serviceDate', 'order.serviceEndDate', 'order.orderDate', 'order.grandTotal'])
      expect(card).toContain(field)
  })

  it('seeds orders on real reservations, and legacy ids point at the right guest', () => {
    const ids = new Set(initialReservations.map(r => r.id))
    expect(mockUpsellOrders.some(o => ids.has(o.reservationId))).toBe(true)
    for (const r of initialReservations) {
      for (const orderId of r.upsellIds ?? []) {
        const order = mockUpsellOrders.find(o => o.id === orderId)
        expect(order?.reservationId).toBe(r.id)
      }
    }
  })
})
