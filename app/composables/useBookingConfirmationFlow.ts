import type { Conversation, Message, MessagePaymentRequest } from '~/components/inbox/data/conversations'
import type { FeeMode } from '~/components/payment-request/data/payment-requests'
import { generatePaymentLink } from '~/components/payment-request/data/payment-requests'
import { useInbox } from './useInbox'
import { useJourneys } from './useJourneys'
import { usePaymentRequests } from './usePaymentRequests'
import { useReservationsModule } from './useReservationsModule'

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
  /** Confirmation only: the booking is already paid, so no payment request or link is created or sent. */
  confirmationOnly?: boolean
  status?: string
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
  isConfirmed?: boolean
  /** With `isConfirmed`: the stay is paid in full, so the message carries no payment link. */
  paid?: boolean
}): string {
  const digits = opts.currency === 'IDR' ? 0 : 2
  const formattedAmount = `${opts.currency} ${opts.totalPrice.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`

  // Scenario 1: Confirmed booking with remaining balance or deposit payment
  if (opts.isConfirmed) {
    const paymentLine = opts.totalPrice > 0 && !opts.paid
      ? [
          `💳 Secure Payment Link (Remaining Balance):`,
          `Please settle your balance using the secure link below:`,
          `${opts.paymentLink}`,
        ]
      : [
          `💳 Payment Status:`,
          `Your reservation is fully confirmed and paid. No further action is required!`,
        ]

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
      `• Accommodation: Confirmed`,
      ...(opts.totalPrice > 0 ? [`• Total: ${formattedAmount}`] : []),
      ``,
      ...paymentLine,
      ``,
      `If you have any questions or special requests before your arrival, feel free to reply directly here. We look forward to welcoming you!`,
    ].join('\n')
  }

  // Scenario 2: Booking / deposit payment pending to guarantee reservation (e.g. inquiry)
  return [
    `📋 Reservation Reserved!`,
    ``,
    `Dear ${opts.guestName},`,
    ``,
    `Thank you for your reservation! Your dates at ${opts.listingName} have been secured:`,
    ``,
    `📋 Reservation Summary:`,
    `• Reservation ID: #${opts.reservationId}`,
    `• Check-in: ${opts.checkIn}`,
    `• Check-out: ${opts.checkOut} (${opts.nights} night${opts.nights > 1 ? 's' : ''})`,
    `• Guests: ${opts.guestCount} guest${opts.guestCount > 1 ? 's' : ''}`,
    `• Total: ${formattedAmount}`,
    ``,
    `💳 Secure Payment Link:`,
    `Please complete your payment using the secure link below to guarantee and confirm your booking:`,
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
    paymentRequestId?: string
    messageId: string
  } {
    // City tax is never part of this flow: it is neither named in the message nor
    // billed here. Its payment request is created when the guest taps Pay now in the
    // guide, on the final amount (docs/claude/city-tax.md).
    const reservation = reservations.value.find(r => r.id === opts.reservationId)
    const isConfirmed = opts.status
      ? opts.status !== 'inquiry'
      : (reservation ? reservation.status !== 'inquiry' : true)

    const payableCurrency = opts.currency === 'IDR' ? 'IDR' : opts.currency === 'EUR' ? 'EUR' : 'USD'

    // 2. Resolve or create the Payment Request
    let req = opts.paymentRequestId ? requests.value.find(r => r.id === opts.paymentRequestId) : undefined
    if (!req && !opts.confirmationOnly) {
      req = createRequest({
        guestName: opts.guestName,
        guestEmail: opts.guestEmail,
        guestPhone: opts.guestPhone,
        listingId: opts.listingId,
        title: `Reservation ${opts.reservationId}`,
        category: 'accommodation',
        amount: opts.totalPrice,
        currency: payableCurrency,
        feeMode: opts.feeMode ?? 'card',
        customFeePercentage: opts.customFeePercentage,
        expiresInHours: opts.expiresInHours ?? 24,
      })
      // Link payment request id to reservation
      updateReservation(opts.reservationId, { paymentRequestId: req.id })
    }

    const paymentLink = req ? (req.paymentLink || generatePaymentLink(req.id)) : ''

    // 3. Resolve or create Conversation in Inbox
    let conv = conversations.value.find(c => c.reservationId === opts.reservationId)
    if (!conv && opts.guestEmail) {
      conv = conversations.value.find(c => c.guestEmail?.toLowerCase() === opts.guestEmail.toLowerCase())
    }

    let conversationId: string
    const statusNote = opts.confirmationOnly
      ? '🎉 Booking Confirmed!'
      : '📋 Reservation Reserved! Payment link sent.'

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
        lastMessage: statusNote,
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
        isAssignedToMe: false,
        assignedTo: 'staff-2',
        tags: [opts.channel || 'Direct Booking', ...(opts.confirmationOnly ? [] : ['Awaiting Payment'])],
        labels: ['booking_confirmed'],
        sentiment: 'positive',
        sentimentNote: opts.confirmationOnly ? 'Booking confirmed and paid' : 'Reservation received, payment link sent',
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
          lastMessage: statusNote,
          lastMessageAt: new Date().toISOString(),
        }
      }
    }

    // 4. Generate message content
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
      isConfirmed,
      paid: opts.confirmationOnly,
    })

    const messagePaymentRequest: MessagePaymentRequest | undefined = req && {
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
      ...(messagePaymentRequest ? { paymentRequest: messagePaymentRequest } : {}),
    }

    // 5. Append message to conversation thread
    const currentMsgs = messages.value[conversationId] ?? []
    messages.value = {
      ...messages.value,
      [conversationId]: [...currentMsgs, message],
    }

    // 6. Notify Journeys pipeline if active journeys match new_booking
    try {
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
      paymentRequestId: req?.id,
      messageId,
    }
  }

  return {
    sendBookingConfirmationWithPaymentLink,
    generateBookingConfirmationText,
  }
}
