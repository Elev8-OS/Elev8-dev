import type { FeeMode } from '~/components/payment-request/data/payment-requests'
import type { Conversation, Message, MessagePaymentRequest } from '~/components/inbox/data/conversations'
import { generatePaymentLink } from '~/components/payment-request/data/payment-requests'
import { usePaymentRequests } from './usePaymentRequests'
import { useInbox } from './useInbox'
import { useReservationsModule } from './useReservationsModule'
import { useJourneys } from './useJourneys'
import { useCityTax } from './useCityTax'

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
  purpose?: 'city_tax' | 'booking' | 'auto'
  cityTaxAmount?: number
  cityTaxCurrency?: string
  cityTaxAuthority?: string
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
  purpose?: 'city_tax' | 'booking'
  cityTaxAmount?: number
  cityTaxCurrency?: string
  cityTaxAuthority?: string
}): string {
  const digits = opts.currency === 'IDR' ? 0 : 2
  const formattedAmount = `${opts.currency} ${opts.totalPrice.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`

  // Scenario: City Tax collection for confirmed booking
  if (opts.purpose === 'city_tax' && opts.cityTaxAmount) {
    const taxDigits = opts.cityTaxCurrency === 'IDR' ? 0 : 2
    const taxCurrency = opts.cityTaxCurrency ?? opts.currency
    const formattedTax = `${taxCurrency} ${opts.cityTaxAmount.toLocaleString(undefined, { minimumFractionDigits: taxDigits, maximumFractionDigits: taxDigits })}`
    const authorityStr = opts.cityTaxAuthority ? `(${opts.cityTaxAuthority})` : ''

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
      ``,
      `🏛️ Mandatory Local City Tax ${authorityStr}:`,
      `As required by local regulations, a mandatory tourist tax of ${formattedTax} is due for your stay and is collected directly by the host.`,
      ``,
      `💳 Secure Payment Link (City Tax):`,
      `Please settle your local city tax using the secure link below:`,
      `${opts.paymentLink}`,
      ``,
      `If you have any questions or special requests before your arrival, feel free to reply directly here. We look forward to welcoming you!`,
    ].join('\n')
  }

  // Scenario: Booking / deposit payment pending
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
  const cityTax = useCityTax()

  function sendBookingConfirmationWithPaymentLink(opts: BookingConfirmationOptions): {
    success: boolean
    conversationId: string
    paymentRequestId: string
    messageId: string
    isCityTax: boolean
  } {
    // 1. Detect if this is specifically a City Tax collection
    const reservation = reservations.value.find(r => r.id === opts.reservationId)
    let isCityTax = opts.purpose === 'city_tax'
    let cityTaxAmount = opts.cityTaxAmount
    let cityTaxCurrency = opts.cityTaxCurrency
    let cityTaxAuthority = opts.cityTaxAuthority

    if (!isCityTax && opts.purpose !== 'booking' && reservation) {
      try {
        const assessment = cityTax.assess(reservation)
        if (assessment.status === 'due' && assessment.collector === 'host' && assessment.totals.length > 0) {
          isCityTax = true
          cityTaxAmount = assessment.totals[0].amount
          cityTaxCurrency = assessment.totals[0].currency
          cityTaxAuthority = assessment.lines[0]?.authorityName || 'Local City Tax'
        }
      }
      catch {
        // Safe fallback in isolated/test environments
      }
    }

    const payableAmount = isCityTax && cityTaxAmount ? cityTaxAmount : opts.totalPrice
    const payableCurrency = isCityTax && cityTaxCurrency
      ? (cityTaxCurrency as any)
      : (opts.currency === 'IDR' ? 'IDR' : opts.currency === 'EUR' ? 'EUR' : 'USD')

    const requestTitle = isCityTax
      ? `City Tax - ${opts.listingName} (#${opts.reservationId})`
      : `Reservation ${opts.reservationId}`

    // 2. Resolve or create the Payment Request
    let req = opts.paymentRequestId ? requests.value.find(r => r.id === opts.paymentRequestId) : undefined
    if (!req) {
      req = createRequest({
        guestName: opts.guestName,
        guestEmail: opts.guestEmail,
        guestPhone: opts.guestPhone,
        listingId: opts.listingId,
        title: requestTitle,
        amount: payableAmount,
        currency: payableCurrency,
        feeMode: opts.feeMode ?? 'card',
        customFeePercentage: opts.customFeePercentage,
        expiresInHours: opts.expiresInHours ?? 24,
      })
      // Link payment request id to reservation
      updateReservation(opts.reservationId, { paymentRequestId: req.id })
    }

    const paymentLink = req.paymentLink || generatePaymentLink(req.id)

    // 3. Resolve or create Conversation in Inbox
    let conv = conversations.value.find(c => c.reservationId === opts.reservationId)
    if (!conv && opts.guestEmail) {
      conv = conversations.value.find(c => c.guestEmail?.toLowerCase() === opts.guestEmail.toLowerCase())
    }

    let conversationId: string
    const statusNote = isCityTax ? '🎉 Booking Confirmed! City tax link sent.' : '📋 Reservation Reserved! Payment link sent.'

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
        tags: [opts.channel || 'Direct Booking', isCityTax ? 'City Tax Due' : 'Awaiting Payment'],
        labels: ['booking_confirmed'],
        sentiment: 'positive',
        sentimentNote: isCityTax ? 'Booking confirmed, city tax payment link sent' : 'Reservation received, payment link sent',
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
      purpose: isCityTax ? 'city_tax' : 'booking',
      cityTaxAmount,
      cityTaxCurrency,
      cityTaxAuthority,
    })

    const messagePaymentRequest: MessagePaymentRequest = {
      id: req.id,
      title: isCityTax ? `City Tax · #${opts.reservationId}` : req.title,
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
      paymentRequestId: req.id,
      messageId,
      isCityTax,
    }
  }

  return {
    sendBookingConfirmationWithPaymentLink,
    generateBookingConfirmationText,
  }
}
