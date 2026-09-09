import type { ReservationEntry } from '~/components/reservations/data/reservations'

export type FolioItemStatus = 'unpaid' | 'paid' | 'voided'
export type FolioPaymentMethod = 'cash' | 'card' | 'room'
export type FolioItemSource = 'catalog' | 'custom'

export interface FolioItem {
  id: string
  label: string
  quantity: number
  unitPrice: number
  taxPercent: number
  servicePercent: number
  note?: string
  source: FolioItemSource
  /** Provenance only, never a live join back into the catalog. */
  catalogServiceId?: string
  catalogItemId?: string
  status: FolioItemStatus
  paymentMethod?: FolioPaymentMethod
  /**
   * When the money was actually collected. Survives a void on purpose: a paid
   * item that gets voided still owes the guest a refund, and that falls out of
   * the summary arithmetic only if the collection is still on record.
   */
  paidAt?: string
  voidReason?: string
  voidedAt?: string
  voidedBy?: string
  addedBy: string
  addedAt: string
}

/** The four fields a line needs to price itself. Structural so a draft prices too. */
export type FolioPriceable = Pick<FolioItem, 'quantity' | 'unitPrice' | 'taxPercent' | 'servicePercent'>

export const FOLIO_PAYMENT_METHOD_LABELS: Record<FolioPaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  room: 'Charge to room',
}

/** Round to the currency's minor unit. IDR amounts are whole already. */
export function roundFolioAmount(value: number): number {
  return Math.round(value * 100) / 100
}

export function folioLineNet(item: FolioPriceable): number {
  return roundFolioAmount(item.quantity * item.unitPrice)
}

export function folioLineTax(item: FolioPriceable): number {
  return roundFolioAmount(folioLineNet(item) * (item.taxPercent / 100))
}

export function folioLineService(item: FolioPriceable): number {
  return roundFolioAmount(folioLineNet(item) * (item.servicePercent / 100))
}

export function folioLineTotal(item: FolioPriceable): number {
  return roundFolioAmount(folioLineNet(item) + folioLineTax(item) + folioLineService(item))
}

export interface FolioSummary {
  /** Room lines, charges and the payment fee, or totalPrice when there are no rooms. */
  bookingTotal: number
  /** Live (non-voided) staff items. */
  itemsTotal: number
  /** Voided staff items, kept for display only. */
  voidedTotal: number
  grandTotal: number
  /** Extras actually collected, including a voided item that had been paid. */
  itemsPaid: number
  itemsBalance: number
  refundDue: number
}

/** Mirrors ReservationRoomsSection.vue:460 so the folio cannot disagree with it. */
export function folioPaymentFee(reservation: ReservationEntry, roomLinesTotal: number): number {
  if (reservation.paymentFeeMode === 'card')
    return roundFolioAmount(roomLinesTotal * 0.03)
  if (reservation.paymentFeeMode === 'manual')
    return roundFolioAmount(roomLinesTotal * ((reservation.paymentCustomFeePct ?? 0) / 100))
  return 0
}

export function folioBookingTotal(reservation: ReservationEntry): number {
  if (!reservation.rooms?.length)
    return reservation.totalPrice

  const rooms = reservation.rooms.reduce((sum, line) => sum + line.lineTotal, 0)
  const charges = (reservation.charges ?? []).reduce((sum, charge) => sum + charge.amount, 0)
  return roundFolioAmount(rooms + charges + folioPaymentFee(reservation, rooms))
}

export function buildFolioSummary(reservation: ReservationEntry): FolioSummary {
  const items = reservation.folioItems ?? []
  const sum = (list: FolioItem[]) => roundFolioAmount(list.reduce((total, item) => total + folioLineTotal(item), 0))

  const bookingTotal = folioBookingTotal(reservation)
  const itemsTotal = sum(items.filter(item => item.status !== 'voided'))
  const voidedTotal = sum(items.filter(item => item.status === 'voided'))
  // paidAt, not status: a voided item that was paid still owes a refund.
  const itemsPaid = sum(items.filter(item => Boolean(item.paidAt)))
  const itemsBalance = roundFolioAmount(itemsTotal - itemsPaid)

  return {
    bookingTotal,
    itemsTotal,
    voidedTotal,
    grandTotal: roundFolioAmount(bookingTotal + itemsTotal),
    itemsPaid,
    itemsBalance,
    refundDue: itemsBalance < 0 ? roundFolioAmount(-itemsBalance) : 0,
  }
}
