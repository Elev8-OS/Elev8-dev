// Mark as paid: staff confirm a bank transfer or cash payment on a booking.

import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'
import { useReservationsModule } from '~/composables/useReservationsModule'

function inquiry(over: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    ...initialReservations[0]!,
    id: 'res-paid-1',
    status: 'inquiry',
    totalPrice: 600,
    currency: 'USD',
    rooms: undefined,
    paidAt: undefined,
    paymentMethod: undefined,
    priceDetails: { subtotal: 600, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 0, commission: 0, payout: 600 },
    activity: [],
    ...over,
  }
}

describe('markReservationPaid', () => {
  const mod = useReservationsModule()
  beforeEach(() => {
    mod.reservations.value = [inquiry()]
  })

  it('moves guestPaid to the total and records the method', () => {
    expect(mod.markReservationPaid('res-paid-1', 'cash')).toBe(true)
    const r = mod.reservations.value[0]!
    expect(r.priceDetails!.guestPaid).toBe(600)
    expect(r.paymentMethod).toBe('cash')
    expect(r.paidAt).toBeTruthy()
    expect(r.activity.at(-1)!.title).toBe('Marked as paid')
    expect(r.status).toBe('unverified')
  })

  it('does nothing twice', () => {
    mod.markReservationPaid('res-paid-1', 'bank_transfer')
    expect(mod.markReservationPaid('res-paid-1', 'cash')).toBe(false)
    expect(mod.reservations.value[0]!.paymentMethod).toBe('bank_transfer')
  })
})

describe('markReservationPaid with an open link', () => {
  it('notes the cancelled link in the activity', () => {
    const mod = useReservationsModule()
    mod.reservations.value = [inquiry()]
    mod.markReservationPaid('res-paid-1', 'bank_transfer', { linkCancelled: true })
    expect(mod.reservations.value[0]!.activity.at(-1)!.description).toContain('payment link cancelled')
  })
})

describe('markReservationPaid keeps other statuses', () => {
  it('does not touch a stay that is already past inquiry', () => {
    const mod = useReservationsModule()
    mod.reservations.value = [inquiry({ status: 'checked_in' })]
    mod.markReservationPaid('res-paid-1', 'cash')
    expect(mod.reservations.value[0]!.status).toBe('checked_in')
  })
})

describe('markReservationPaid, amount and date', () => {
  const mod = useReservationsModule()
  beforeEach(() => {
    mod.reservations.value = [inquiry()]
  })
  const today = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  it('a part payment moves guestPaid but leaves the stay an unpaid inquiry', () => {
    expect(mod.markReservationPaid('res-paid-1', 'cash', { amount: 200 })).toBe(true)
    const r = mod.reservations.value[0]!
    expect(r.priceDetails!.guestPaid).toBe(200)
    expect(r.status).toBe('inquiry')
    expect(r.paidAt).toBeUndefined()
    expect(r.activity.at(-1)!.title).toBe('Partial payment')
    expect(r.activity.at(-1)!.description).toContain('USD 200.00 of USD 600.00')
  })

  it('the rest of the balance settles the stay and verifies nothing', () => {
    mod.markReservationPaid('res-paid-1', 'cash', { amount: 200 })
    expect(mod.markReservationPaid('res-paid-1', 'bank_transfer')).toBe(true)
    const r = mod.reservations.value[0]!
    expect(r.priceDetails!.guestPaid).toBe(600)
    expect(r.status).toBe('unverified')
    expect(r.paymentMethod).toBe('bank_transfer')
    expect(r.paidAt).toBeTruthy()
  })

  it('rejects an amount of 0, a negative one, and one over the balance', () => {
    for (const amount of [0, -5, 600.01]) {
      expect(mod.markReservationPaid('res-paid-1', 'cash', { amount })).toBe(false)
    }
    expect(mod.reservations.value[0]!.priceDetails!.guestPaid).toBe(0)
  })

  it('stamps the day the money arrived, and refuses a future day', () => {
    expect(mod.markReservationPaid('res-paid-1', 'cash', { paidOn: '2999-01-01' })).toBe(false)
    expect(mod.markReservationPaid('res-paid-1', 'cash', { paidOn: '2026-01-05' })).toBe(true)
    const r = mod.reservations.value[0]!
    expect(r.paidAt!.startsWith('2026-01-05')).toBe(true)
    expect(r.activity.at(-1)!.description).toContain('on 2026-01-05')
  })

  it('accepts today as the payment date', () => {
    expect(mod.markReservationPaid('res-paid-1', 'cash', { paidOn: today() })).toBe(true)
  })

  it('a stay with nothing to pay cannot be marked', () => {
    mod.reservations.value = [inquiry({ totalPrice: 0, priceDetails: { subtotal: 0, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 0, commission: 0, payout: 0 } })]
    expect(mod.markReservationPaid('res-paid-1', 'cash')).toBe(false)
  })
})
