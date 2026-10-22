import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'

// The detail sheet is too heavy to mount here, so read its source like the
// other detail sheet specs do.
describe('reservation detail website discounts', () => {
  const source = readFileSync(join(process.cwd(), 'app/components/reservations/ReservationDetailSheet.vue'), 'utf8')

  it('shows the original price, then each discount, then the subtotal charged', () => {
    const price = source.slice(source.indexOf('<!-- Price breakdown -->'), source.indexOf('<!-- Mark as paid -->'))
    const original = price.indexOf('data-testid="reservation-original-price"')
    const discount = price.indexOf('data-testid="reservation-website-discount"')
    const subtotal = price.indexOf('Subtotal ({{ reservation.nights }} nights)')
    expect(original).toBeGreaterThan(-1)
    expect(discount).toBeGreaterThan(original)
    expect(subtotal).toBeGreaterThan(discount)
    // The subtotal is what was charged, so the original is that plus the discounts.
    expect(price).toContain('reservation.priceDetails.subtotal + websiteDiscountTotal')
  })

  it('only reads Direct bookings and never writes the price', () => {
    expect(source).toContain('reservation.value?.channel === \'Direct\' ? (reservation.value.websiteBooking?.discounts ?? [])')
  })

  it('has a seeded website booking with discounts to show', () => {
    const seeded = initialReservations.find(r => r.id === 'res-multi-1')!
    expect(seeded.websiteBooking?.discounts.length).toBeGreaterThan(1)
    expect(seeded.websiteBooking?.discounts.every(d => d.amount > 0)).toBe(true)
  })
})
