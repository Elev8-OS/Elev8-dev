import type { CityTaxTotal, ExtensionDirection, ExtensionPaymentMethod, ReservationEntry, SavedCard, StayExtension } from '~/components/reservations/data/reservations'
import type { ExtensionPaymentInput, ExtensionQuote } from '~/composables/useReservationsModule'
import { cleanerOptions } from '~/components/cleaning/data/cleaning-jobs'
import { cleaningDateKey } from '~/components/cleaning/data/cleaning-link'
import { generateCleaningJobsForReservation } from '~/components/reservations/data/cleaning-schedule'
import { formatSavedCard } from '~/components/reservations/data/damage-protection'
import { isActiveExtension } from '~/components/reservations/data/reservations'
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
  /** Defaults to `after` (a later check-out). `before` is an early arrival. */
  direction?: ExtensionDirection
  /** `after`: the new check-out. */
  checkOut?: string
  /** `before`: the new check-in. */
  checkIn?: string
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
  /** linked_booking: the nights become a direct booking linked to the stay. in_place: only older records, no new extension is written this way. */
  mode: 'in_place' | 'linked_booking'
  direction: ExtensionDirection
  /** Where the added nights start. */
  from: string
  /** Where they end (the new check-out, or the current check-in for an early arrival). */
  to: string
  /** The boundary that moves: the current check-out, or the current check-in for an early arrival. */
  anchor: string
  quote: ExtensionQuote
  conflicts: ReservationEntry[]
  /** `after` only: open check-out cleanings on the old check-out day. */
  cleaningsToMove: number
  /** Codes ending on the old check-out (`after`) or starting on the old check-in (`before`). */
  codesToExtend: number
  cityTax: ExtensionCityTaxImpact
}

export interface ExtensionCancelResult {
  success: boolean
  error?: string
  /** Paid extensions now owing the guest a refund. */
  refundsDue: StayExtension[]
  paymentLinksCancelled: number
  cleaningsMoved: number
  cleaningsCancelled: number
  /** One extension: door codes moved back to the original dates. */
  codesRestored: number
  /** The whole stay: its active door codes, revoked. */
  codesRevoked: number
  /** Every stay cancelled (the stay and its linked bookings, or the one linked booking). */
  cancelledIds: string[]
  guestNotified: boolean
}

const EMPTY_CANCEL: Omit<ExtensionCancelResult, 'success'> = {
  refundsDue: [],
  paymentLinksCancelled: 0,
  cleaningsMoved: 0,
  cleaningsCancelled: 0,
  codesRestored: 0,
  codesRevoked: 0,
  cancelledIds: [],
  guestNotified: false,
}

export interface CancelStayPreview {
  linked: ReservationEntry[]
  pendingLinks: number
  refunds: StayExtension[]
  /** Active door codes that will be revoked. */
  codes: number
  /** Open cleanings on the stay and its linked bookings that will be cancelled. */
  cleanings: number
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

/** "Airbnb booking", or plain "booking" for a direct stay. */
function bookingLabel(r: Pick<ReservationEntry, 'channel'>): string {
  return r.channel === 'Direct' ? 'booking' : `${r.channel} booking`
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
  /** The new check-out, or the new check-in for an early arrival. */
  checkOut: string
  direction?: ExtensionDirection
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

  if (opts.direction === 'before') {
    return [
      `Hi ${first},`,
      '',
      `Good news: you can arrive earlier at ${r.listingName}. Your new check-in is ${longDate(opts.checkOut)} (${n} more night${n === 1 ? '' : 's'}${totalNights ? `, ${totalNights} nights in total` : ''}).`,
      ...(opts.mode === 'linked_booking'
        ? ['', `Your ${bookingLabel(r)} stays exactly as it is. The extra nights before it are booked directly with us.`]
        : []),
      '',
      payment[opts.method],
      ...(opts.codesExtended > 0 ? ['', 'Your door code stays the same and now works from your new check-in.'] : []),
      '',
      'We look forward to welcoming you!',
    ].join('\n')
  }

  return [
    `Hi ${first},`,
    '',
    `Good news: your stay at ${r.listingName} is extended. Your new check-out is ${longDate(opts.checkOut)} (${n} more night${n === 1 ? '' : 's'}${totalNights ? `, ${totalNights} nights in total` : ''}).`,
    ...(opts.mode === 'linked_booking'
      ? ['', `Your ${bookingLabel(r)} stays exactly as it is. The extra nights are booked directly with us.`]
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

  function cityTaxImpact(r: ReservationEntry, mode: StayExtensionPreview['mode'], direction: ExtensionDirection, from: string, to: string, quote: ExtensionQuote): ExtensionCityTaxImpact {
    try {
      if (mode === 'linked_booking') {
        // What the new direct booking will owe on its own, as the city tax
        // section will show it once it exists.
        const projected: ReservationEntry = {
          ...r,
          id: `${r.id}-ext-preview`,
          channel: 'Direct',
          checkIn: from,
          checkOut: to,
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
        ...(direction === 'before' ? { checkIn: from } : { checkOut: to }),
        nights: quote.newNights,
        priceDetails: r.priceDetails ? { ...r.priceDetails, subtotal: r.priceDetails.subtotal + quote.amount } : undefined,
      })
      return after.status === 'due' && after.totals.length ? { kind: 'due', before: before.totals, after: after.totals } : { kind: 'none' }
    }
    catch {
      return { kind: 'none' }
    }
  }

  /**
   * `date` is the new check-out, or with `direction: 'before'` the new
   * check-in (early arrival).
   */
  function preview(r: ReservationEntry, date: string, nightlyRate?: number, direction: ExtensionDirection = 'after'): StayExtensionPreview {
    // Every channel, Direct included, adds nights as a linked booking; the stay itself is never rewritten.
    const mode: StayExtensionPreview['mode'] = 'linked_booking'
    const before = direction === 'before'
    const { from, to } = module.extensionRange(r, date, direction)
    const anchor = before ? to : from
    const quote = module.quoteExtension(r, date, nightlyRate, direction)
    // The cleaning to move belongs to whichever stay currently ends at `from`.
    // An early arrival moves none: the turnover is still on the last day.
    const lastLinked = module.reservations.value.find(x => x.extensionOf === r.id && x.checkOut === from && x.status !== 'cancelled')
    const cleaningOwner = lastLinked?.id ?? r.id
    const cleaningsToMove = before
      ? 0
      : cleaning.jobs.value.filter(j =>
        j.reservationId === cleaningOwner && j.source === 'checkout' && j.status !== 'done' && j.status !== 'cancelled' && cleaningDateKey(j.scheduledAt) === from,
      ).length
    const hasNights = to > from
    return {
      mode,
      direction,
      from,
      to,
      anchor,
      quote,
      conflicts: hasNights ? module.getExtensionConflicts(r.id, date, direction) : [],
      cleaningsToMove,
      codesToExtend: (before ? smartLock.codesStartingOn(r.id, anchor) : smartLock.codesEndingOn(r.id, anchor)).length,
      cityTax: hasNights ? cityTaxImpact(r, mode, direction, from, to, quote) : { kind: 'none' },
    }
  }

  /**
   * In place, a recurring schedule (daily, custom) gets its jobs for the added
   * nights; the existing ones, which staff may have reassigned, are kept.
   */
  function addScheduledCleanings(id: string, range: { from: string, to: string, direction: ExtensionDirection }): number {
    const updated = module.reservations.value.find(x => x.id === id)
    if (!updated?.cleaningSchedule || updated.cleaningSchedule.type === 'checkout')
      return 0
    // After: the days past the old check-out. Before: the days ahead of the
    // old check-in (that day already has its own job, if the rhythm has one).
    const added = (day: string) => range.direction === 'before'
      ? day >= range.from && day < range.to
      : day > range.from
    try {
      const inputs = generateCleaningJobsForReservation({ reservation: updated, schedule: updated.cleaningSchedule, cleaners: cleanerOptions })
        .filter(input => added(input.scheduledAt.slice(0, 10)) && input.source !== 'checkout')
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

    const direction: ExtensionDirection = plan.direction ?? (plan.checkIn ? 'before' : 'after')
    const before = direction === 'before'
    const date = (before ? plan.checkIn : plan.checkOut) ?? ''
    const { mode, from, to, anchor, quote, conflicts } = preview(r, date, plan.nightlyRate, direction)
    if (quote.extraNights <= 0)
      return { ...empty, success: false, error: before ? 'Pick a check-in date before the current one.' : 'Pick a check-out date after the current one.' }
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
        title: `${before ? 'Early arrival' : 'Stay extension'} · ${r.id}`,
        description: `${quote.extraNights} night${quote.extraNights === 1 ? '' : 's'}, ${from} to ${to}`,
        category: 'extension',
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
    const input = { ...(before ? { checkIn: date } : { checkOut: date }), nightlyRate: plan.nightlyRate, payment }
    const outcome: { success: boolean, error?: string, extensionId?: string, linkedReservationId?: string } = mode === 'in_place'
      ? module.extendReservation(r.id, input)
      : module.extendViaLinkedBooking(r.id, input)
    if (!outcome.success) {
      if (payment.paymentRequestId)
        payments.cancelRequest(payment.paymentRequestId, 'Stay extension was not saved.')
      return { ...empty, success: false, error: outcome.error }
    }
    const linkedReservationId = outcome.linkedReservationId

    // 3. Operations follow the new check-out (or check-in).
    let cleaningsMoved = 0
    let cleaningsAdded = 0
    let codesExtended = 0
    if (before) {
      // The guest stays on through the old check-in: the linked booking's own
      // "check-out" day is not a turnover, and the stay already cleans that day.
      if (linkedReservationId)
        cleaning.dropArrivalOverlap(linkedReservationId, r.id, to)
      cleaningsAdded = mode === 'in_place' ? addScheduledCleanings(r.id, { from, to, direction }) : 0
      codesExtended = smartLock.advanceCodesForReservation(r.id, anchor, from)
    }
    else {
      cleaningsMoved = cleaning.moveCheckoutCleanings(cleaningOwner, from, to, linkedReservationId ?? r.id)
      cleaningsAdded = mode === 'in_place' ? addScheduledCleanings(r.id, { from, to, direction }) : 0
      codesExtended = smartLock.extendCodesForReservation(r.id, from, to)
    }

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

  function cancelPaymentLink(ext: StayExtension, reason: string): number {
    if (ext.paymentStatus !== 'pending' || !ext.paymentRequestId)
      return 0
    if (payments.requests.value.find(p => p.id === ext.paymentRequestId)?.status !== 'pending')
      return 0
    payments.cancelRequest(ext.paymentRequestId, reason)
    return 1
  }

  /** The guest stay as one span: the root booking and its live linked bookings. */
  function staySpan(root: ReservationEntry): { checkIn: string, checkOut: string, linked: ReservationEntry[] } {
    const linked = module.reservations.value
      .filter(x => x.extensionOf === root.id && x.status !== 'cancelled')
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    return {
      checkIn: linked.reduce((d, x) => x.checkIn < d ? x.checkIn : d, root.checkIn),
      checkOut: linked.reduce((d, x) => x.checkOut > d ? x.checkOut : d, root.checkOut),
      linked,
    }
  }

  /** What cancelling the whole stay will touch, for the confirm dialog. */
  function previewCancelStay(reservationId: string): CancelStayPreview | null {
    const r = module.reservations.value.find(x => x.id === reservationId)
    if (!r || r.extensionOf)
      return null
    const { linked } = staySpan(r)
    const active = (r.extensions ?? []).filter(isActiveExtension)
    const ids = new Set([r.id, ...linked.map(x => x.id)])
    return {
      linked,
      pendingLinks: active.filter(e => e.paymentStatus === 'pending' && e.paymentRequestId
        && payments.requests.value.find(p => p.id === e.paymentRequestId)?.status === 'pending').length,
      refunds: active.filter(e => e.paymentStatus === 'paid'),
      codes: smartLock.codes.value.filter(c => c.reservationId === r.id && c.status === 'active').length,
      cleanings: cleaning.jobs.value.filter(j => j.reservationId && ids.has(j.reservationId) && j.status !== 'done' && j.status !== 'cancelled').length,
    }
  }

  /**
   * Takes one extension back (see `canCancelExtension`: the outermost one,
   * before its nights begin) and undoes what followed it: the payment link,
   * the door codes, the moved check-out cleaning and the added cleanings.
   * A non-blank `guestMessage` goes to the guest's thread.
   */
  async function cancelExtension(reservationId: string, extensionId: string, opts: { guestMessage?: string } = {}): Promise<ExtensionCancelResult> {
    const outcome = module.cancelExtension(reservationId, extensionId)
    if (!outcome.success || !outcome.extension)
      return { ...EMPTY_CANCEL, success: false, error: outcome.error }
    const ext = outcome.extension
    const linkedId = ext.linkedReservationId
    const open = (j: { source: string }) => j.source !== 'checkout' && j.source !== 'check_out'
    let cleaningsMoved = 0
    let cleaningsCancelled = 0
    let codesRestored = 0

    if (ext.direction === 'before') {
      codesRestored = smartLock.advanceCodesForReservation(reservationId, ext.newCheckIn!, ext.previousCheckIn!)
      cleaningsCancelled = linkedId
        ? cleaning.cancelOpenJobs(linkedId)
        : cleaning.cancelOpenJobs(reservationId, j => open(j) && cleaningDateKey(j.scheduledAt) < ext.previousCheckIn!)
    }
    else {
      codesRestored = smartLock.extendCodesForReservation(reservationId, ext.newCheckOut!, ext.previousCheckOut!)
      // The check-out cleaning goes back to whichever stay now ends on the old day.
      const previousOwner = module.reservations.value.find(x => x.extensionOf === reservationId && x.checkOut === ext.previousCheckOut && x.status !== 'cancelled')?.id ?? reservationId
      cleaningsMoved = cleaning.moveCheckoutCleanings(linkedId ?? reservationId, ext.newCheckOut!, ext.previousCheckOut!, previousOwner)
      cleaningsCancelled = linkedId
        ? cleaning.cancelOpenJobs(linkedId)
        : cleaning.cancelOpenJobs(reservationId, j => open(j) && cleaningDateKey(j.scheduledAt) > ext.previousCheckOut!)
    }
    const paymentLinksCancelled = cancelPaymentLink(ext, 'Stay extension was cancelled.')

    const r = module.reservations.value.find(x => x.id === reservationId)
    const text = opts.guestMessage?.trim()
    const guestNotified = text && r ? await messageGuest(r, text) : false

    return {
      ...EMPTY_CANCEL,
      success: true,
      refundsDue: ext.paymentStatus === 'paid' ? [ext] : [],
      paymentLinksCancelled,
      cleaningsMoved,
      cleaningsCancelled,
      codesRestored,
      cancelledIds: linkedId ? [linkedId] : [],
      guestNotified,
    }
  }

  /**
   * Cancels a stay with everything linked to it: every linked booking, every
   * extension record, their open payment links, every open cleaning, and the
   * stay's door codes (revoked). Called on a linked booking, it cancels just
   * that extension (`cancelExtension`). Every cancel from the detail sheet
   * comes through here, with or without extensions.
   */
  async function cancelStay(reservationId: string, opts: { guestMessage?: string } = {}): Promise<ExtensionCancelResult> {
    const r = module.reservations.value.find(x => x.id === reservationId)
    if (!r)
      return { ...EMPTY_CANCEL, success: false, error: 'Reservation not found.' }
    if (r.extensionOf) {
      const ext = module.reservations.value.find(x => x.id === r.extensionOf)?.extensions?.find(e => e.linkedReservationId === r.id && isActiveExtension(e))
      return ext ? cancelExtension(r.extensionOf, ext.id, opts) : { ...EMPTY_CANCEL, success: false, error: 'Extension not found.' }
    }
    if (r.status === 'cancelled')
      return { ...EMPTY_CANCEL, success: false, error: 'This stay is already cancelled.' }
    const active = (r.extensions ?? []).filter(isActiveExtension)
    const cancelledIds = module.updateReservationStatus(reservationId, 'cancelled')
    const paymentLinksCancelled = active.reduce((n, e) => n + cancelPaymentLink(e, 'The stay was cancelled.'), 0)
    const cleaningsCancelled = cancelledIds.reduce((n, id) => n + cleaning.cancelOpenJobs(id), 0)
    const revoking = smartLock.codes.value.filter(c => c.reservationId === reservationId && c.status === 'active')
    for (const c of revoking)
      smartLock.revokeAccessCode(c.id)

    const text = opts.guestMessage?.trim()
    const guestNotified = text ? await messageGuest(r, text) : false

    return {
      ...EMPTY_CANCEL,
      success: true,
      refundsDue: active.filter(e => e.paymentStatus === 'paid'),
      paymentLinksCancelled,
      cleaningsCancelled,
      codesRevoked: revoking.length,
      cancelledIds,
      guestNotified,
    }
  }

  /** The message staff start from in the cancel dialog; editable, blank sends nothing. */
  function defaultCancelMessage(reservationId: string, extensionId?: string): string {
    const r = module.reservations.value.find(x => x.id === reservationId)
    if (!r)
      return ''
    const first = r.guestFirstName?.trim() || r.guestName.split(' ')[0] || r.guestName
    const closing = 'If you have any questions, just reply to this message.'
    const ext = extensionId ? r.extensions?.find(e => e.id === extensionId) : undefined

    if (!ext) {
      const { checkIn, checkOut, linked } = staySpan(r)
      const refunds = (r.extensions ?? []).filter(e => isActiveExtension(e) && e.paymentStatus === 'paid')
      return [
        `Hi ${first},`,
        '',
        `Your booking at ${r.listingName} from ${longDate(checkIn)} to ${longDate(checkOut)} has been cancelled${linked.length ? ', including the extra nights booked directly with us' : ''}.`,
        ...(refunds.length ? ['', `We will refund ${refunds.map(e => money(e.amount, e.currency)).join(' + ')} for the extra nights.`] : []),
        '',
        closing,
      ].join('\n')
    }

    const n = ext.extraNights
    const nights = `${n} night${n === 1 ? '' : 's'}`
    const before = ext.direction === 'before'
    const payment = ext.paymentStatus === 'paid'
      ? `We will refund the ${money(ext.amount, ext.currency)} you paid for them.`
      : ext.paymentRequestId ? 'The payment link we sent is no longer needed.' : ''
    return [
      `Hi ${first},`,
      '',
      before
        ? `Your early arrival at ${r.listingName} (${nights}) is cancelled. Your check-in stays on ${longDate(ext.previousCheckIn!)}.`
        : `Your extra ${nights} at ${r.listingName} are cancelled. Your check-out stays on ${longDate(ext.previousCheckOut!)}.`,
      ...(ext.linkedReservationId ? ['', `Your ${bookingLabel(r)} stays exactly as it is.`] : []),
      ...(payment ? ['', payment] : []),
      '',
      closing,
    ].join('\n')
  }

  return {
    preview,
    confirmExtension,
    cancelExtension,
    cancelStay,
    previewCancelStay,
    defaultCancelMessage,
    canCancelExtension: module.canCancelExtension,
    markExtensionRefunded: module.markExtensionRefunded,
    markExtensionPaid,
    defaultExtensionMessage,
    formatSavedCard,
  }
}
