import type { CityTaxTotal, ExtensionPaymentMethod, ReservationEntry, SavedCard } from '~/components/reservations/data/reservations'
import type { ExtensionPaymentInput, ExtensionQuote } from '~/composables/useReservationsModule'
import { cleanerOptions } from '~/components/cleaning/data/cleaning-jobs'
import { cleaningDateKey } from '~/components/cleaning/data/cleaning-link'
import { generateCleaningJobsForReservation } from '~/components/reservations/data/cleaning-schedule'
import { formatSavedCard } from '~/components/reservations/data/damage-protection'
import { useCityTax } from '~/composables/useCityTax'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { usePaymentRequests } from '~/composables/usePaymentRequests'
import { NON_EXTENDABLE_STATUSES, useReservationsModule } from '~/composables/useReservationsModule'
import { useSmartLock } from '~/composables/useSmartLock'

/** Replaced with the real link when the guest message is sent. */
export const PAYMENT_LINK_TOKEN = '[payment link]'

/** Mock card charge, long enough for the button's loading state to show. */
export const SAVED_CARD_CHARGE_MS = 1200

export type ExtensionFeeMode = 'card' | 'no_fee'

export interface StayExtensionPlan {
  reservationId: string
  checkOut: string
  nightlyRate?: number
  payment: { method: ExtensionPaymentMethod, feeMode?: ExtensionFeeMode }
  /** Sent to the guest's thread; `PAYMENT_LINK_TOKEN` becomes the link. Blank sends nothing. */
  guestMessage?: string
}

export type ExtensionCityTaxImpact
  = { kind: 'none' }
    | { kind: 'due', before: CityTaxTotal[], after: CityTaxTotal[] }
    | { kind: 'settled' }
    | { kind: 'linked_due', totals: CityTaxTotal[] }

export interface StayExtensionPreview {
  /** in_place: the stay's own check-out moves. linked_booking: an OTA stay, the nights become a direct booking. */
  mode: 'in_place' | 'linked_booking'
  /** Where the added nights start. */
  from: string
  quote: ExtensionQuote
  conflicts: ReservationEntry[]
  cleaningsToMove: number
  codesToExtend: number
  cityTax: ExtensionCityTaxImpact
}

export interface StayExtensionResult {
  success: boolean
  error?: string
  extensionId?: string
  linkedReservationId?: string
  paymentRequestId?: string
  paymentLink?: string
  cleaningsMoved: number
  cleaningsAdded: number
  codesExtended: number
  guestNotified: boolean
}

/** Airbnb and Booking.com own their bookings' dates and price; only a direct stay is moved in place. */
export function isOtaStay(r: Pick<ReservationEntry, 'channel'>): boolean {
  return r.channel !== 'Direct'
}

export function canExtend(r: Pick<ReservationEntry, 'status'>): boolean {
  return !NON_EXTENDABLE_STATUSES.includes(r.status)
}

export function savedCardFor(r: ReservationEntry): SavedCard | undefined {
  return r.damageProtection?.card
}

function money(amount: number, currency: string): string {
  const digits = currency === 'IDR' ? 0 : 2
  const locale = currency === 'CHF' ? 'de-CH' : 'en-US'
  return `${currency} ${amount.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** The message staff start from in the review step; they can rewrite it before it goes. */
export function defaultExtensionMessage(r: ReservationEntry, opts: {
  checkOut: string
  quote: ExtensionQuote
  mode: StayExtensionPreview['mode']
  method: ExtensionPaymentMethod
  codesExtended: number
}): string {
  const first = r.guestFirstName?.trim() || r.guestName.split(' ')[0] || r.guestName
  const n = opts.quote.extraNights
  const amount = money(opts.quote.amount, r.currency)
  const totalNights = opts.mode === 'in_place' ? opts.quote.newNights : null
  const card = savedCardFor(r)

  const payment: Record<ExtensionPaymentMethod, string> = {
    payment_link: `The extra night${n === 1 ? '' : 's'} come to ${amount}. You can pay securely here: ${PAYMENT_LINK_TOKEN}`,
    saved_card: `We charged ${amount} to your saved card${card ? ` ending ${card.last4}` : ''}.`,
    at_property: `The extra night${n === 1 ? '' : 's'} come to ${amount}, payable at the property.`,
    already_paid: `We have received your payment of ${amount}, thank you.`,
  }

  return [
    `Hi ${first},`,
    '',
    `Good news: your stay at ${r.listingName} is extended. Your new check-out is ${longDate(opts.checkOut)} (${n} more night${n === 1 ? '' : 's'}${totalNights ? `, ${totalNights} nights in total` : ''}).`,
    ...(opts.mode === 'linked_booking'
      ? ['', `Your ${r.channel} booking stays exactly as it is. The extra nights are booked directly with us.`]
      : []),
    '',
    payment[opts.method],
    ...(opts.codesExtended > 0 ? ['', 'Your door code stays the same and now works until your new check-out.'] : []),
    '',
    'Enjoy the rest of your stay!',
  ].join('\n')
}

export function useStayExtension() {
  const module = useReservationsModule()
  const cleaning = useCleaningJobs()
  const smartLock = useSmartLock()
  const cityTax = useCityTax()
  const payments = usePaymentRequests()

  function cityTaxImpact(r: ReservationEntry, mode: StayExtensionPreview['mode'], from: string, checkOut: string, quote: ExtensionQuote): ExtensionCityTaxImpact {
    try {
      if (mode === 'linked_booking') {
        // What the new direct booking will owe on its own, as the city tax
        // section will show it once it exists.
        const projected: ReservationEntry = {
          ...r,
          id: `${r.id}-ext-preview`,
          channel: 'Direct',
          checkIn: from,
          checkOut,
          nights: quote.extraNights,
          totalPrice: quote.amount,
          priceDetails: r.priceDetails ? { ...r.priceDetails, subtotal: quote.amount } : undefined,
          cityTaxSettlement: undefined,
        }
        const after = cityTax.assess(projected)
        return after.status === 'due' && after.totals.length ? { kind: 'linked_due', totals: after.totals } : { kind: 'none' }
      }
      const before = cityTax.assess(r)
      if (before.settlement)
        return { kind: 'settled' }
      const after = cityTax.assess({
        ...r,
        checkOut,
        nights: quote.newNights,
        priceDetails: r.priceDetails ? { ...r.priceDetails, subtotal: r.priceDetails.subtotal + quote.amount } : undefined,
      })
      return after.status === 'due' && after.totals.length ? { kind: 'due', before: before.totals, after: after.totals } : { kind: 'none' }
    }
    catch {
      return { kind: 'none' }
    }
  }

  function preview(r: ReservationEntry, checkOut: string, nightlyRate?: number): StayExtensionPreview {
    const mode = isOtaStay(r) ? 'linked_booking' : 'in_place'
    const from = module.extensionStart(r)
    const quote = module.quoteExtension(r, checkOut, nightlyRate)
    // The cleaning to move belongs to whichever stay currently ends at `from`.
    const lastLinked = module.reservations.value.find(x => x.extensionOf === r.id && x.checkOut === from && x.status !== 'cancelled')
    const cleaningOwner = lastLinked?.id ?? r.id
    const cleaningsToMove = cleaning.jobs.value.filter(j =>
      j.reservationId === cleaningOwner && j.source === 'checkout' && j.status !== 'done' && j.status !== 'cancelled' && cleaningDateKey(j.scheduledAt) === from,
    ).length
    return {
      mode,
      from,
      quote,
      conflicts: checkOut > from ? module.getExtensionConflicts(r.id, checkOut) : [],
      cleaningsToMove,
      codesToExtend: smartLock.codesEndingOn(r.id, from).length,
      cityTax: checkOut > from ? cityTaxImpact(r, mode, from, checkOut, quote) : { kind: 'none' },
    }
  }

  /**
   * In place, a recurring schedule (daily, custom) gets its jobs for the added
   * nights; the existing ones, which staff may have reassigned, are kept.
   */
  function addScheduledCleanings(id: string, from: string): number {
    const updated = module.reservations.value.find(x => x.id === id)
    if (!updated?.cleaningSchedule || updated.cleaningSchedule.type === 'checkout')
      return 0
    try {
      const inputs = generateCleaningJobsForReservation({ reservation: updated, schedule: updated.cleaningSchedule, cleaners: cleanerOptions })
        .filter(input => input.scheduledAt.slice(0, 10) > from && input.source !== 'checkout')
      return inputs.map(input => cleaning.createJob(input)).filter(Boolean).length
    }
    catch {
      return 0
    }
  }

  async function messageGuest(r: ReservationEntry, text: string): Promise<boolean> {
    try {
      // ⚠️ useInbox imports useUpsellOrders, which reaches back into the
      // reservation composables: a static import closes a cycle. Same rule as
      // useDamageProtection. Do not tidy this into a top-level import.
      const { useInbox } = await import('~/composables/useInbox')
      const inbox = useInbox()
      const conversationId = inbox.ensureConversationForReservation(r)
      const conversation = inbox.conversations.value.find(c => c.id === conversationId)
      if (!conversation)
        return false
      inbox.sendMessage(conversation.id, text, conversation.otaSource)
      return true
    }
    catch {
      return false
    }
  }

  async function confirmExtension(plan: StayExtensionPlan): Promise<StayExtensionResult> {
    const empty = { cleaningsMoved: 0, cleaningsAdded: 0, codesExtended: 0, guestNotified: false }
    const r = module.reservations.value.find(x => x.id === plan.reservationId)
    if (!r)
      return { ...empty, success: false, error: 'Reservation not found.' }
    if (!canExtend(r))
      return { ...empty, success: false, error: 'This stay can no longer be extended.' }

    const { mode, from, quote, conflicts } = preview(r, plan.checkOut, plan.nightlyRate)
    if (quote.extraNights <= 0)
      return { ...empty, success: false, error: 'Pick a check-out date after the current one.' }
    if (conflicts.length)
      return { ...empty, success: false, error: `Those nights are already booked by ${conflicts[0]!.guestName}.` }

    // 1. Money first, so a failed charge leaves the stay untouched.
    const { method } = plan.payment
    let payment: ExtensionPaymentInput = { method, status: method === 'already_paid' ? 'paid' : 'pending' }
    let paymentLink: string | undefined
    if (method === 'saved_card') {
      if (!savedCardFor(r))
        return { ...empty, success: false, error: 'This guest has no saved card.' }
      await new Promise(resolve => setTimeout(resolve, SAVED_CARD_CHARGE_MS))
      payment = { method, status: 'paid' }
    }
    if (method === 'payment_link') {
      const request = payments.createRequest({
        guestName: r.guestName,
        guestEmail: r.guestEmail,
        guestPhone: r.guestPhone,
        listingId: r.listingId,
        title: `Stay extension · ${r.id}`,
        description: `${quote.extraNights} night${quote.extraNights === 1 ? '' : 's'}, ${from} to ${plan.checkOut}`,
        amount: quote.amount,
        currency: r.currency as 'USD' | 'IDR' | 'EUR' | 'CHF',
        feeMode: plan.payment.feeMode ?? 'card',
        expiresInHours: 24,
      })
      payment = { method, status: 'pending', paymentRequestId: request.id }
      paymentLink = request.paymentLink
    }

    // 2. The nights themselves.
    const cleaningOwner = module.reservations.value.find(x => x.extensionOf === r.id && x.checkOut === from && x.status !== 'cancelled')?.id ?? r.id
    const input = { checkOut: plan.checkOut, nightlyRate: plan.nightlyRate, payment }
    const outcome: { success: boolean, error?: string, extensionId?: string, linkedReservationId?: string } = mode === 'in_place'
      ? module.extendReservation(r.id, input)
      : module.extendViaLinkedBooking(r.id, input)
    if (!outcome.success) {
      if (payment.paymentRequestId)
        payments.cancelRequest(payment.paymentRequestId, 'Stay extension was not saved.')
      return { ...empty, success: false, error: outcome.error }
    }
    const linkedReservationId = outcome.linkedReservationId

    // 3. Operations follow the new check-out.
    const cleaningsMoved = cleaning.moveCheckoutCleanings(cleaningOwner, from, plan.checkOut, linkedReservationId ?? r.id)
    const cleaningsAdded = mode === 'in_place' ? addScheduledCleanings(r.id, from) : 0
    const codesExtended = smartLock.extendCodesForReservation(r.id, from, plan.checkOut)

    // 4. Tell the guest.
    const text = plan.guestMessage?.trim()
    const guestNotified = text
      ? await messageGuest(r, paymentLink ? text.replaceAll(PAYMENT_LINK_TOKEN, paymentLink) : text)
      : false

    return {
      success: true,
      extensionId: outcome.extensionId,
      linkedReservationId,
      paymentRequestId: payment.paymentRequestId,
      paymentLink,
      cleaningsMoved,
      cleaningsAdded,
      codesExtended,
      guestNotified,
    }
  }

  /** Staff confirm the money arrived (link paid, collected at the desk). Closes the payment request too. */
  function markExtensionPaid(reservationId: string, extensionId: string): boolean {
    const ext = module.reservations.value.find(x => x.id === reservationId)?.extensions?.find(e => e.id === extensionId)
    if (!module.markExtensionPaid(reservationId, extensionId))
      return false
    if (ext?.paymentRequestId) {
      const paidAt = new Date().toISOString()
      payments.requests.value = payments.requests.value.map(p =>
        p.id === ext.paymentRequestId && p.status === 'pending' ? { ...p, status: 'paid', paidAt } : p,
      )
    }
    return true
  }

  return {
    preview,
    confirmExtension,
    markExtensionPaid,
    defaultExtensionMessage,
    formatSavedCard,
  }
}
