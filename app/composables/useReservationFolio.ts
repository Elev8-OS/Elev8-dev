import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type { FolioCatalogRow, FolioItem, FolioItemDraft, FolioPaymentMethod, FolioSummary } from '~/components/reservations/data/folio'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import {
  buildFolioSummary,
  canDeleteFolioItem,
  canVoidFolioItem,
  folioActivityEvent,
  folioCatalogRows,
  folioItemFromDraft,
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
      activity: [event, ...reservation.activity],
    }

    if (reservation.priceDetails) {
      const extras = buildFolioSummary({ ...reservation, folioItems: items }).itemsTotal
      patch.priceDetails = {
        ...reservation.priceDetails,
        extras,
        guestPaid: roundFolioAmount(reservation.priceDetails.guestPaid - reservation.priceDetails.extras + extras),
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

  function markPaid(reservationId: string, itemId: string, method: FolioPaymentMethod) {
    const reservation = reservationById(reservationId)
    if (!reservation)
      return

    const current = itemsFor(reservationId).find(item => item.id === itemId)
    if (!current || current.status !== 'unpaid')
      return

    // 'room' defers the charge: it stays unpaid and keeps counting in the balance.
    const updated: FolioItem = method === 'room'
      ? { ...current, paymentMethod: 'room' }
      : { ...current, status: 'paid', paymentMethod: method, paidAt: new Date().toISOString() }

    const items = itemsFor(reservationId).map(item => (item.id === itemId ? updated : item))
    commit(reservation, items, folioActivityEvent(method === 'room' ? 'deferred' : 'paid', updated, actor.value, reservation.currency))
    toast.success(method === 'room' ? `${updated.label} charged to room` : `${updated.label} marked paid`)
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
    deleteItem,
    voidItem,
  }
}
