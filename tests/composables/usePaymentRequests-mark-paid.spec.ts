// A guest paying the link settles the stay it belongs to.

import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'
import { usePaymentRequests } from '~/composables/usePaymentRequests'
import { useReservationsModule } from '~/composables/useReservationsModule'

function inquiry(over: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    ...initialReservations[0]!,
    id: 'res-link-1',
    status: 'inquiry',
    totalPrice: 600,
    currency: 'USD',
    rooms: undefined,
    paidAt: undefined,
    paymentMethod: undefined,
    paymentRequestId: undefined,
    priceDetails: { subtotal: 600, cleaningFee: 0, serviceFee: 0, tax: 0, extras: 0, guestPaid: 0, commission: 0, payout: 600 },
    activity: [],
    ...over,
  }
}

describe('markRequestPaid', () => {
  // The test setup clears useState per test, so take the stores fresh each time.
  let payments: ReturnType<typeof usePaymentRequests>
  let mod: ReturnType<typeof useReservationsModule>

  beforeEach(() => {
    payments = usePaymentRequests()
    mod = useReservationsModule()
    mod.reservations.value = [inquiry()]
  })

  function makeRequest() {
    const request = payments.createRequest({
      guestName: 'Jane',
      guestEmail: 'jane@example.com',
      listingId: 'lst-1',
      title: 'Reservation res-link-1',
      amount: 600,
      currency: 'USD',
      feeMode: 'no_fee',
      expiresInHours: 24,
    })
    mod.reservations.value = [inquiry({ paymentRequestId: request.id })]
    return request
  }

  it('marks the request paid and settles the stay as a payment link payment', () => {
    const request = makeRequest()
    expect(payments.markRequestPaid(request.id)).toBe(true)
    expect(payments.requests.value.find(r => r.id === request.id)!.status).toBe('paid')
    const stay = mod.reservations.value[0]!
    expect(stay.paymentMethod).toBe('payment_link')
    expect(stay.priceDetails!.guestPaid).toBe(600)
    expect(stay.status).toBe('unverified')
  })

  it('only a pending request can be paid', () => {
    const request = makeRequest()
    payments.cancelRequest(request.id, 'no longer needed')
    expect(payments.markRequestPaid(request.id)).toBe(false)
    expect(mod.reservations.value[0]!.priceDetails!.guestPaid).toBe(0)
    expect(payments.markRequestPaid('no-such-request')).toBe(false)
  })

  it('a request with no stay still gets paid', () => {
    const request = payments.createRequest({
      guestName: 'Loose',
      guestEmail: 'loose@example.com',
      listingId: 'lst-1',
      title: 'Standalone',
      amount: 50,
      currency: 'USD',
      feeMode: 'no_fee',
      expiresInHours: 24,
    })
    expect(payments.markRequestPaid(request.id)).toBe(true)
  })
})
