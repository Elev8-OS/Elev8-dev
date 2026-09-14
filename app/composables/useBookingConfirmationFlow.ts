import type { FeeMode } from '~/components/payment-request/data/payment-requests'
import type { Conversation, Message, MessagePaymentRequest } from '~/components/inbox/data/conversations'
import { generatePaymentLink } from '~/components/payment-request/data/payment-requests'
import { usePaymentRequests } from './usePaymentRequests'
import { useInbox } from './useInbox'
import { useReservationsModule } from './useReservationsModule'
import { useJourneys } from './useJourneys'

export interface BookingConfirmationOptions {
  reservationId: string
  guestName: string
  guestEmail: string
  guestPhone?: string
  listingId: string
  listingName: string
  checkIn: string
  checkOut: string
  nights: number
  guestCount: number
  totalPrice: number
  currency: string
  channel?: string
  paymentRequestId?: string
  feeMode?: FeeMode
  customFeePercentage?: number
  expiresInHours?: number
  senderName?: string
  senderRole?: string
}

export function generateBookingConfirmationText(opts: {
  guestName: string
  listingName: string
  reservationId: string
  checkIn: string
  checkOut: string
  nights: number
  guestCount: number
  totalPrice: number
  currency: string
  paymentLink: string
}): string {
  const digits = opts.currency === 'IDR' ? 0 : 2
  const formattedAmount = `${opts.currency} ${opts.totalPrice.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`

  return [
    `🎉 Booking Confirmed!`,
    ``,
    `Dear ${opts.guestName},`,
    ``,
    `Thank you for your reservation! We are delighted to confirm your upcoming stay at ${opts.listingName}.`,
    ``,
    `📋 Reservation Summary:`,
    `• Reservation ID: #${opts.reservationId}`,
    `• Check-in: ${opts.checkIn}`,
    `• Check-out: ${opts.checkOut} (${opts.nights} night${opts.nights > 1 ? 's' : ''})`,
    `• Guests: ${opts.guestCount} guest${opts.guestCount > 1 ? 's' : ''}`,
    `• Total: ${formattedAmount}`,
    ``,
    `💳 Secure Payment Link:`,
    `Please complete your payment using the secure link below:`,
    `${opts.paymentLink}`,
    ``,
    `If you have any questions or special requests before your arrival, feel free to reply directly here. We look forward to welcoming you!`,
  ].join('\n')
}

export function useBookingConfirmationFlow() {
  const { createRequest, requests } = usePaymentRequests()
  const { conversations, messages } = useInbox()
  const { updateReservation, reservations } = useReservationsModule()
  const journeys = useJourneys()

  function sendBookingConfirmationWithPaymentLink(opts: BookingConfirmationOptions): {
    success: boolean
    conversationId: string
    paymentRequestId: string
    messageId: string
  } {
    // 1. Resolve or create the Payment Request
    let req = opts.paymentRequestId ? requests.value.find(r => r.id === opts.paymentRequestId) : undefined
    if (!req) {
      req = createRequest({
        guestName: opts.guestName,
        guestEmail: opts.guestEmail,
        guestPhone: opts.guestPhone,
        listingId: opts.listingId,
        title: `Reservation ${opts.reservationId}`,
        amount: opts.totalPrice,
        currency: (opts.currency === 'IDR' ? 'IDR' : 'USD'),
        feeMode: opts.feeMode ?? 'card',
        customFeePercentage: opts.customFeePercentage,
        expiresInHours: opts.expiresInHours ?? 24,
      })
      // Link payment request id to reservation
      updateReservation(opts.reservationId, { paymentRequestId: req.id })
    }

    const paymentLink = req.paymentLink || generatePaymentLink(req.id)

    // 2. Resolve or create Conversation in Inbox
    let conv = conversations.value.find(c => c.reservationId === opts.reservationId)
    if (!conv && opts.guestEmail) {
      conv = conversations.value.find(c => c.guestEmail?.toLowerCase() === opts.guestEmail.toLowerCase())
    }

    let conversationId: string
    if (!conv) {
      conversationId = `conv-res-${opts.reservationId}`
      const guestInitials = opts.guestName
        .split(' ')
        .map(n => n[0])
        .filter(Boolean)
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'GS'

      const newConv: Conversation = {
        id: conversationId,
        guestName: opts.guestName,
        guestInitials,
        listingName: opts.listingName,
        propertyName: opts.listingName.split('–')[0]?.trim() || opts.listingName,
        otaSource: opts.channel || 'Direct',
        reservationId: opts.reservationId,
        guestEmail: opts.guestEmail,
        status: null,
        lastMessage: '🎉 Booking Confirmed! Payment link sent.',
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
        isAssignedToMe: false,
        assignedTo: 'staff-2',
        tags: ['Direct Booking', 'Awaiting Payment'],
        labels: ['booking_confirmed'],
        sentiment: 'positive',
        sentimentNote: 'New confirmed booking with payment link sent',
        stayStatus: 'future',
        checkIn: opts.checkIn,
        checkOut: opts.checkOut,
        cleaningStatus: 'need_cleaning',
        linkedUpsellOrderIds: [],
      }
      conversations.value = [newConv, ...conversations.value]
    }
    else {
      conversationId = conv.id
      // Update metadata on existing conversation
      const idx = conversations.value.findIndex(c => c.id === conversationId)
      if (idx !== -1) {
        conversations.value[idx] = {
          ...conversations.value[idx],
          reservationId: opts.reservationId,
          stayStatus: 'future',
          checkIn: opts.checkIn,
          checkOut: opts.checkOut,
          lastMessage: '🎉 Booking Confirmed! Payment link sent.',
          lastMessageAt: new Date().toISOString(),
        }
      }
    }

    // 3. Generate message content
    const content = generateBookingConfirmationText({
      guestName: opts.guestName,
      listingName: opts.listingName,
      reservationId: opts.reservationId,
      checkIn: opts.checkIn,
      checkOut: opts.checkOut,
      nights: opts.nights,
      guestCount: opts.guestCount,
      totalPrice: opts.totalPrice,
      currency: opts.currency,
      paymentLink,
    })

    const messagePaymentRequest: MessagePaymentRequest = {
      id: req.id,
      title: req.title,
      amount: req.amount,
      currency: req.currency,
      feeAmount: req.feeAmount,
      totalAmount: req.totalAmount,
      status: req.status,
      paymentLink,
      expiresAt: req.expiresAt,
    }

    const messageId = `msg-bk-conf-${opts.reservationId}-${Date.now()}`
    const message: Message = {
      id: messageId,
      conversationId,
      sender: 'host',
      senderName: opts.senderName || 'ElevAI',
      senderRole: opts.senderRole || 'Guest Relations',
      aiWritten: true,
      channel: opts.channel || 'Direct',
      content,
      timestamp: new Date().toISOString(),
      sendStatus: 'sent',
      paymentRequest: messagePaymentRequest,
    }

    // 4. Append message to conversation thread
    const currentMsgs = messages.value[conversationId] ?? []
    messages.value = {
      ...messages.value,
      [conversationId]: [...currentMsgs, message],
    }

    // 5. Notify Journeys pipeline if active journeys match new_booking
    try {
      const reservation = reservations.value.find(r => r.id === opts.reservationId)
      if (journeys.onNewBooking) {
        journeys.onNewBooking(reservation ?? (opts as any), req)
      }
    }
    catch {
      // safe fallback in test / non-journey contexts
    }

    return {
      success: true,
      conversationId,
      paymentRequestId: req.id,
      messageId,
    }
  }

  return {
    sendBookingConfirmationWithPaymentLink,
    generateBookingConfirmationText,
  }
}
