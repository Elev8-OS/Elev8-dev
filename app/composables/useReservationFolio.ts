import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type { FolioCatalogRow, FolioItem, FolioItemDraft, FolioPaymentMethod, FolioSummary } from '~/components/reservations/data/folio'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import {
  buildFolioSummary,
  canDeleteFolioItem,
  canVoidFolioItem,
  FOLIO_PAYMENT_METHOD_LABELS,
  folioActivityEvent,
  folioCatalogRows,
  folioItemFromDraft,
  folioItemUnpaidAmount,
  folioLineTotal,
  isFolioItemDraftValid,
  roundFolioAmount,
} from '~/components/reservations/data/folio'
import { useReservationsModule } from '~/composables/useReservationsModule'

/**
 * Staff-posted charges on a stay. The only writer of `ReservationEntry.folioItems`.
 *
 * It reads the upsell catalog as a price list and never writes to it, and it
 * never touches `useUpsellOrders`: keeping a folio line out of the order
 * lifecycle is what keeps one number for one charge.
 */
export function useReservationFolio() {
  const { reservations, updateReservation } = useReservationsModule()
  const { services } = useUpsellServices()
  const { currentUser } = useCurrentDashboardUser()

  const actor = computed(() => currentUser.value?.name ?? 'Staff')

  function reservationById(id: string): ReservationEntry | null {
    return reservations.value.find(r => r.id === id) ?? null
  }

  function itemsFor(id: string): FolioItem[] {
    return reservationById(id)?.folioItems ?? []
  }

  function summaryFor(id: string): FolioSummary | null {
    const reservation = reservationById(id)
    return reservation ? buildFolioSummary(reservation) : null
  }

  /** A cancelled or blocked stay takes no new charges. */
  function canPostTo(id: string): boolean {
    const reservation = reservationById(id)
    if (!reservation)
      return false
    return reservation.status !== 'cancelled' && reservation.status !== 'blocked'
  }

  function catalogRowsFor(id: string): FolioCatalogRow[] {
    const reservation = reservationById(id)
    if (!reservation)
      return []
    return folioCatalogRows(services.value, reservation.listingName, reservation.currency)
  }

  /**
   * One patch, so the items and their audit line can never land apart. Keeps
   * priceDetails in step where a reservation has one, and leaves `totalPrice`
   * alone: that is the booked price and much of the app reads it.
   */
  function commit(reservation: ReservationEntry, items: FolioItem[], event: ActivityEvent) {
    const patch: Partial<ReservationEntry> = {
      folioItems: items,
      // Oldest-first, matching every seeded activity array and the timeline
      // that renders it: prepending would land a new folio entry above a
      // months-old reservation-confirmed one.
      activity: [...reservation.activity, event],
    }

    if (reservation.priceDetails) {
      // The folio owns `priceDetails.extras`: this replaces the field outright
      // rather than aggregating into it, so nothing else should also be
      // writing it (a reservation's `upsellIds` total is separate and never
      // merged in here). Desk-posted extras carry no OTA commission, so the
      // whole delta moves onto `guestPaid` and `payout` together, in lockstep,
      // while `commission` is left untouched.
      const extras = buildFolioSummary({ ...reservation, folioItems: items }).itemsTotal
      const extrasDelta = roundFolioAmount(extras - reservation.priceDetails.extras)
      patch.priceDetails = {
        ...reservation.priceDetails,
        extras,
        guestPaid: roundFolioAmount(reservation.priceDetails.guestPaid + extrasDelta),
        payout: roundFolioAmount(reservation.priceDetails.payout + extrasDelta),
      }
    }

    updateReservation(reservation.id, patch)
  }

  function addItem(reservationId: string, draft: FolioItemDraft): FolioItem | null {
    const reservation = reservationById(reservationId)
    if (!reservation || !canPostTo(reservationId) || !isFolioItemDraftValid(draft))
      return null

    const item = folioItemFromDraft(draft, actor.value)
    commit(reservation, [...itemsFor(reservationId), item], folioActivityEvent('added', item, actor.value, reservation.currency))
    toast.success(`Added ${item.label}`)
    return item
  }

  function markPaid(
    reservationId: string,
    itemId: string,
    method: FolioPaymentMethod,
    options?: { amount?: number, note?: string },
  ) {
    const reservation = reservationById(reservationId)
    if (!reservation)
      return

    const current = itemsFor(reservationId).find(item => item.id === itemId)
    if (!current || (current.status !== 'unpaid' && current.status !== 'partially_paid'))
      return
    // A 'room' item stays 'unpaid' by design, so the guard above does not
    // catch a repeated "Charge to room": without this, a second call would
    // produce a second activity event sharing the same id (derived from
    // itemId + kind, not a timestamp). Already deferred is a no-op.
    if (method === 'room' && current.paymentMethod === 'room')
      return

    const now = new Date().toISOString()
    const total = folioLineTotal(current)
    const alreadyPaid = current.paidAmount ?? 0
    const remaining = roundFolioAmount(total - alreadyPaid)

    // 'room' defers the charge: it stays unpaid and keeps counting in the balance.
    if (method === 'room') {
      const updated: FolioItem = { ...current, paymentMethod: 'room' }
      const items = itemsFor(reservationId).map(item => (item.id === itemId ? updated : item))
      commit(reservation, items, folioActivityEvent('deferred', updated, actor.value, reservation.currency))
      toast.success(`${updated.label} charged to room`)
      return
    }

    const payAmount = (options?.amount !== undefined && options.amount > 0)
      ? roundFolioAmount(Math.min(options.amount, remaining))
      : remaining

    const newPaidAmount = roundFolioAmount(alreadyPaid + payAmount)
    const isPartial = newPaidAmount < total

    const updated: FolioItem = {
      ...current,
      status: isPartial ? 'partially_paid' : 'paid',
      paymentMethod: method,
      paidAt: now,
      paidAmount: newPaidAmount,
      note: options?.note ? [current.note, options.note].filter(Boolean).join(' · ') : current.note,
    }

    const items = itemsFor(reservationId).map(item => (item.id === itemId ? updated : item))
    commit(
      reservation,
      items,
      folioActivityEvent(isPartial ? 'partial_paid' : 'paid', updated, actor.value, reservation.currency, now),
    )

    const formatted = `${payAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${reservation.currency}`
    toast.success(isPartial ? `Recorded DP / partial payment of ${formatted} for ${updated.label}` : `${updated.label} marked paid`)
  }

  interface MarkAllAsPaidInput {
    method: FolioPaymentMethod
    amount?: number
    isPartial?: boolean
    note?: string
  }

  function markAllAsPaid(reservationId: string, input: MarkAllAsPaidInput) {
    const reservation = reservationById(reservationId)
    if (!reservation || !canPostTo(reservationId))
      return

    const summary = summaryFor(reservationId)
    if (!summary || summary.unpaidTotal <= 0)
      return

    const method = input.method
    const now = new Date().toISOString()
    const targetAmount = (input.isPartial && input.amount !== undefined && input.amount > 0)
      ? roundFolioAmount(Math.min(input.amount, summary.unpaidTotal))
      : summary.unpaidTotal

    let remainingToPay = targetAmount
    const isPartial = targetAmount < summary.unpaidTotal

    const items = itemsFor(reservationId).map((item) => {
      if (item.status === 'voided' || item.status === 'paid' || remainingToPay <= 0)
        return item

      const unpaidOnItem = folioItemUnpaidAmount(item)
      if (unpaidOnItem <= 0)
        return item

      const currentPaid = item.paidAmount ?? 0
      if (remainingToPay >= unpaidOnItem) {
        // Paid in full
        remainingToPay = roundFolioAmount(remainingToPay - unpaidOnItem)
        return {
          ...item,
          status: 'paid' as const,
          paidAmount: folioLineTotal(item),
          paymentMethod: method,
          paidAt: now,
          note: input.note ? [item.note, input.note].filter(Boolean).join(' · ') : item.note,
        }
      }
      else {
        // Partially paid
        const allocated = remainingToPay
        remainingToPay = 0
        return {
          ...item,
          status: 'partially_paid' as const,
          paidAmount: roundFolioAmount(currentPaid + allocated),
          paymentMethod: method,
          paidAt: now,
          note: input.note ? [item.note, input.note].filter(Boolean).join(' · ') : item.note,
        }
      }
    })

    const formattedAmount = `${targetAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${reservation.currency}`
    const eventTitle = isPartial ? 'Folio down payment (DP) received' : 'Folio marked paid in full'
    const eventDescParts = [
      `${isPartial ? 'Partial payment (DP)' : 'Full payment'} of ${formattedAmount}`,
      FOLIO_PAYMENT_METHOD_LABELS[method],
    ]
    if (input.note)
      eventDescParts.push(input.note)

    const activityEvent: ActivityEvent = {
      id: `act-fol-${Date.now()}-${isPartial ? 'partial' : 'all-paid'}`,
      type: 'reservation',
      title: eventTitle,
      description: eventDescParts.join(' · '),
      actor: actor.value,
      timestamp: now,
      colorDot: 'green',
    }

    commit(reservation, items, activityEvent)
    toast.success(isPartial ? `Recorded DP / partial payment of ${formattedAmount}` : 'Marked all folio items as paid')
  }

  function deleteItem(reservationId: string, itemId: string) {
    const reservation = reservationById(reservationId)
    if (!reservation)
      return

    const item = itemsFor(reservationId).find(entry => entry.id === itemId)
    if (!item || !canDeleteFolioItem(item))
      return

    const items = itemsFor(reservationId).filter(entry => entry.id !== itemId)
    commit(reservation, items, folioActivityEvent('removed', item, actor.value, reservation.currency))
    toast.success(`Removed ${item.label}`)
  }

  function voidItem(reservationId: string, itemId: string, reason: string) {
    const reservation = reservationById(reservationId)
    if (!reservation)
      return

    const trimmed = reason.trim()
    if (!trimmed)
      return

    const item = itemsFor(reservationId).find(entry => entry.id === itemId)
    if (!item || !canVoidFolioItem(item))
      return

    const voided: FolioItem = {
      ...item,
      status: 'voided',
      voidReason: trimmed,
      voidedAt: new Date().toISOString(),
      voidedBy: actor.value,
    }

    const items = itemsFor(reservationId).map(entry => (entry.id === itemId ? voided : entry))
    commit(reservation, items, folioActivityEvent('voided', voided, actor.value, reservation.currency))
    toast.success(`Voided ${item.label}`)
  }

  return {
    actor,
    itemsFor,
    summaryFor,
    canPostTo,
    catalogRowsFor,
    addItem,
    markPaid,
    markAllAsPaid,
    deleteItem,
    voidItem,
  }
}
