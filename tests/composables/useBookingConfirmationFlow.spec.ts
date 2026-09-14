import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateBookingConfirmationText, useBookingConfirmationFlow } from '~/composables/useBookingConfirmationFlow'
import { useInbox } from '~/composables/useInbox'
import { usePaymentRequests } from '~/composables/usePaymentRequests'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useJourneys } from '~/composables/useJourneys'

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))
vi.mock('vue-sonner', () => ({ toast: toastMock }))

describe('useBookingConfirmationFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateBookingConfirmationText', () => {
    it('formats booking confirmation text with standardized currency prefix and payment link', () => {
      const text = generateBookingConfirmationText({
        guestName: 'John Doe',
        listingName: 'Villa Canggu Breeze',
        reservationId: 'res-test-999',
        checkIn: '2026-10-01',
        checkOut: '2026-10-06',
        nights: 5,
        guestCount: 2,
        totalPrice: 750,
        currency: 'USD',
        paymentLink: 'https://pay.elev8.co/r/pr-test-999',
      })

      expect(text).toContain('🎉 Booking Confirmed!')
      expect(text).toContain('Dear John Doe,')
      expect(text).toContain('Villa Canggu Breeze')
      expect(text).toContain('#res-test-999')
      expect(text).toContain('Check-in: 2026-10-01')
      expect(text).toContain('Check-out: 2026-10-06 (5 nights)')
      expect(text).toContain('Total: USD 750.00')
      expect(text).toContain('https://pay.elev8.co/r/pr-test-999')
    })

    it('formats IDR without decimals', () => {
      const text = generateBookingConfirmationText({
        guestName: 'Budi Santoso',
        listingName: 'Villa Ubud',
        reservationId: 'res-idr-1',
        checkIn: '2026-11-01',
        checkOut: '2026-11-03',
        nights: 2,
        guestCount: 1,
        totalPrice: 2500000,
        currency: 'IDR',
        paymentLink: 'https://pay.elev8.co/r/pr-idr-1',
      })

      expect(text).toContain('Total: IDR 2,500,000')
      expect(text).toContain('https://pay.elev8.co/r/pr-idr-1')
    })
  })

  describe('sendBookingConfirmationWithPaymentLink', () => {
    it('creates a payment request, adds conversation to inbox, and posts confirmation message with payment card', () => {
      const { createReservation, reservations } = useReservationsModule()
      const { conversations, messages } = useInbox()
      const { requests } = usePaymentRequests()
      const journeys = useJourneys()
      const onNewBookingSpy = vi.spyOn(journeys, 'onNewBooking')

      const resResult = createReservation({
        guestName: 'Jane Smith',
        guestEmail: 'jane.smith@example.com',
        guestPhone: '+1 555-0199',
        listingId: 'lst-1',
        listingName: 'Villa Canggu Serene',
        channel: 'Direct',
        checkIn: '2026-12-01',
        checkOut: '2026-12-05',
        nights: 4,
        guestCount: 2,
        totalPrice: 1200,
        currency: 'USD',
        status: 'verified',
      })

      expect(resResult.success).toBe(true)
      const resId = resResult.id!

      const { sendBookingConfirmationWithPaymentLink } = useBookingConfirmationFlow()

      const result = sendBookingConfirmationWithPaymentLink({
        reservationId: resId,
        guestName: 'Jane Smith',
        guestEmail: 'jane.smith@example.com',
        guestPhone: '+1 555-0199',
        listingId: 'lst-1',
        listingName: 'Villa Canggu Serene',
        checkIn: '2026-12-01',
        checkOut: '2026-12-05',
        nights: 4,
        guestCount: 2,
        totalPrice: 1200,
        currency: 'USD',
        channel: 'Direct',
      })

      expect(result.success).toBe(true)
      expect(result.conversationId).toBeDefined()
      expect(result.paymentRequestId).toBeDefined()

      // 1. Check payment request was created
      const pr = requests.value.find(r => r.id === result.paymentRequestId)
      expect(pr).toBeDefined()
      expect(pr?.amount).toBe(1200)
      expect(pr?.currency).toBe('USD')
      expect(pr?.status).toBe('pending')

      // 2. Check reservation has paymentRequestId linked
      const updatedRes = reservations.value.find(r => r.id === resId)
      expect(updatedRes?.paymentRequestId).toBe(result.paymentRequestId)

      // 3. Check conversation was created in inbox
      const conv = conversations.value.find(c => c.id === result.conversationId)
      expect(conv).toBeDefined()
      expect(conv?.guestName).toBe('Jane Smith')
      expect(conv?.reservationId).toBe(resId)
      expect(conv?.stayStatus).toBe('future')

      // 4. Check message was appended with paymentRequest attached
      const convMsgs = messages.value[result.conversationId]
      expect(convMsgs).toBeDefined()
      expect(convMsgs.length).toBeGreaterThan(0)
      const lastMsg = convMsgs[convMsgs.length - 1]
      expect(lastMsg.sender).toBe('host')
      expect(lastMsg.aiWritten).toBe(true)
      expect(lastMsg.content).toContain('🎉 Booking Confirmed!')
      expect(lastMsg.content).toContain('Total: USD 1,200.00')
      expect(lastMsg.paymentRequest).toBeDefined()
      expect(lastMsg.paymentRequest?.id).toBe(result.paymentRequestId)
      expect(lastMsg.paymentRequest?.amount).toBe(1200)
      expect(lastMsg.paymentRequest?.status).toBe('pending')

      // 5. Check journeys event was invoked (toast triggered for active new_booking journey)
      expect(toastMock.info).toHaveBeenCalledWith(
        expect.stringContaining('triggered by new booking'),
        expect.anything(),
      )
    })
  })
})
