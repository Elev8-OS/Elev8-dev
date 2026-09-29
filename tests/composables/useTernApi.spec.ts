import type { ReservationEntry, SavedCard } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useTernActivation } from '~/composables/useTernActivation'
import { resetTernMock, useTernApi } from '~/composables/useTernApi'

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function seed(patch: Partial<ReservationEntry> = {}) {
  const entry = {
    id: 'res-t-1',
    guestId: 'g-1',
    guestName: 'Anna Schmidt',
    guestEmail: 'anna@example.com',
    guestCountry: 'Germany',
    listingId: 'lst-1',
    listingName: 'Villa',
    channel: 'Direct',
    checkIn: isoDaysFromNow(5),
    checkOut: isoDaysFromNow(10),
    nights: 5,
    totalPrice: 1300,
    currency: 'USD',
    status: 'verified',
    activity: [],
    priceDetails: { subtotal: 1000, cleaningFee: 300, serviceFee: 0, tax: 0, extras: 0, guestPaid: 1300, commission: 0, payout: 1300 },
    ...patch,
  } as ReservationEntry
  useReservationsModule().reservations.value = [entry]
}

const WAIVER = { option: 'waiver' as const, termsAccepted: true }
const CARD: SavedCard = { provider: 'stripe', paymentMethodId: 'pm_mock_4242', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028, savedAt: '2026-09-01T00:00:00.000Z' }

/** The sync is fire-and-forget after each write; wait for Tern to have it. */
const bookings = () => useTernApi().controls.bookings()

beforeEach(() => {
  useReservationsModule().reservations.value = []
  localStorage.clear()
  resetTernMock()
})

describe('covered stays as Tern bookings', () => {
  it('registers the booking when the guest takes the waiver, with the frozen fee', async () => {
    seed()
    useDamageProtection().recordChoice('res-t-1', WAIVER, 'guest_guide')
    await vi.waitFor(() => expect(bookings()).toHaveLength(1))
    expect(bookings()[0]).toMatchObject({ bookingNumber: 'res-t-1', organizationId: 10421, insuranceCost: 9, insuranceCostCurrency: 'USD', productId: 101, active: true, endDate: isoDaysFromNow(10) })
  })

  it('updates the dates and the fee when the stay is extended past 30 nights', async () => {
    seed()
    const dp = useDamageProtection()
    dp.recordChoice('res-t-1', WAIVER)
    await vi.waitFor(() => expect(bookings()).toHaveLength(1))
    useReservationsModule().updateReservation('res-t-1', { nights: 35, checkOut: isoDaysFromNow(40) })
    dp.reassessOnExtension('res-t-1', 5)
    await vi.waitFor(() => expect(bookings()[0]).toMatchObject({ endDate: isoDaysFromNow(40), insuranceCost: 18 }))
    expect(bookings()).toHaveLength(1)
  })

  it('marks the booking inactive when the cover is cancelled, and never deletes it', async () => {
    seed()
    const dp = useDamageProtection()
    dp.recordChoice('res-t-1', WAIVER)
    await vi.waitFor(() => expect(bookings()).toHaveLength(1))
    dp.cancelProtection('res-t-1')
    await vi.waitFor(() => expect(bookings()[0]).toMatchObject({ active: false, cancelledDate: expect.any(String) }))
  })

  it('sends nothing for a deposit, which is not Tern\'s', async () => {
    seed()
    useDamageProtection().recordChoice('res-t-1', { option: 'deposit', termsAccepted: true, card: CARD, chargeConsent: true })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(bookings()).toHaveLength(0)
  })

  it('refuses to sync before the service is active: there is no organization to book under', async () => {
    seed({ damageProtection: { policyId: 'dp-standard', option: 'waiver', state: 'waiver_active', amount: 39, currency: 'USD', tier: 'bronze', elev8Fee: 9, termsVersion: 'v1', termsText: 'Terms', acceptedAt: new Date().toISOString(), acceptedVia: 'guest_guide', claims: [] } })
    useTernActivation().replayActivation()
    await expect(useTernApi().syncBooking('res-t-1')).resolves.toEqual({ ok: false, reason: 'waiver_not_activated' })
    expect(bookings()).toHaveLength(0)
  })
})
