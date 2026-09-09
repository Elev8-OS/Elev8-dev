import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import type { UpsellItem, UpsellService } from '~/components/upsells/data/upsell-services'

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
  /**
   * Live (non-voided) items still owing nothing collected yet, i.e. status
   * `'unpaid'` (charge-to-room included). Distinct from `itemsBalance`, which
   * nets a refund against it: a stay can owe a refund on one line and still
   * owe unpaid money on another, and `itemsBalance` alone hides the second.
   */
  unpaidTotal: number
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
  const unpaidTotal = sum(items.filter(item => item.status === 'unpaid'))

  return {
    bookingTotal,
    itemsTotal,
    voidedTotal,
    grandTotal: roundFolioAmount(bookingTotal + itemsTotal),
    itemsPaid,
    itemsBalance,
    refundDue: itemsBalance < 0 ? roundFolioAmount(-itemsBalance) : 0,
    unpaidTotal,
  }
}

export interface FolioItemDraft {
  label: string
  quantity: number
  unitPrice: number
  taxPercent: number
  servicePercent: number
  note?: string
  source: FolioItemSource
  catalogServiceId?: string
  catalogItemId?: string
}

export type FolioDraftField = 'label' | 'quantity' | 'unitPrice' | 'taxPercent' | 'servicePercent'
export type FolioDraftErrors = Partial<Record<FolioDraftField, string>>

export function canDeleteFolioItem(item: FolioItem): boolean {
  return item.status === 'unpaid'
}

export function canVoidFolioItem(item: FolioItem): boolean {
  return item.status === 'paid'
}

export function validateFolioItemDraft(draft: FolioItemDraft): FolioDraftErrors {
  const errors: FolioDraftErrors = {}

  if (!draft.label.trim())
    errors.label = 'Give the item a name.'
  if (!Number.isFinite(draft.quantity) || draft.quantity < 1)
    errors.quantity = 'Quantity must be at least 1.'
  if (!Number.isFinite(draft.unitPrice) || draft.unitPrice <= 0)
    errors.unitPrice = 'Enter a price above 0.'
  if (!Number.isFinite(draft.taxPercent) || draft.taxPercent < 0 || draft.taxPercent > 100)
    errors.taxPercent = 'Tax must be between 0 and 100.'
  if (!Number.isFinite(draft.servicePercent) || draft.servicePercent < 0 || draft.servicePercent > 100)
    errors.servicePercent = 'Service must be between 0 and 100.'

  return errors
}

export function isFolioItemDraftValid(draft: FolioItemDraft): boolean {
  return Object.keys(validateFolioItemDraft(draft)).length === 0
}

export function createDefaultFolioItemDraft(): FolioItemDraft {
  return {
    label: '',
    quantity: 1,
    unitPrice: 0,
    taxPercent: 0,
    servicePercent: 0,
    note: '',
    source: 'custom',
  }
}

/**
 * A catalog pick is a snapshot. The price transfers only when it can be charged
 * as-is: same currency, and the service actually prices its items. Otherwise the
 * amount is left for staff, because no exchange rate belongs on a guest's bill.
 *
 * A service with `pricingEnabled: false` lends no percentages either, matching
 * `UpsellOrderCreator.vue:79`, which bills zero tax and zero service for one.
 */
export function folioDraftFromCatalog(service: UpsellService, item: UpsellItem, reservationCurrency: string): FolioItemDraft {
  const usablePrice = service.pricingEnabled && service.currency === reservationCurrency

  return {
    label: `${service.name} · ${item.name}`,
    quantity: 1,
    unitPrice: usablePrice ? item.price : 0,
    taxPercent: service.pricingEnabled ? service.taxPercent : 0,
    servicePercent: service.pricingEnabled ? service.servicePercent : 0,
    note: '',
    source: 'catalog',
    catalogServiceId: service.id,
    catalogItemId: item.id,
  }
}

let folioIdCounter = 0

export function generateFolioItemId(): string {
  folioIdCounter += 1
  return `fol-${Date.now().toString(36)}-${folioIdCounter}`
}

export function folioItemFromDraft(draft: FolioItemDraft, actor: string, now: string = new Date().toISOString()): FolioItem {
  return {
    id: generateFolioItemId(),
    label: draft.label.trim(),
    quantity: draft.quantity,
    unitPrice: draft.unitPrice,
    taxPercent: draft.taxPercent,
    servicePercent: draft.servicePercent,
    note: draft.note?.trim() || undefined,
    source: draft.source,
    catalogServiceId: draft.catalogServiceId,
    catalogItemId: draft.catalogItemId,
    status: 'unpaid',
    addedBy: actor,
    addedAt: now,
  }
}

export interface FolioCatalogRow {
  serviceId: string
  serviceName: string
  itemId: string
  itemName: string
  description?: string
  price: number
  /** The service's own currency, which may not be the folio's. */
  currency: string
  /** The price cannot be charged as-is: another currency, or an unpriced service. */
  needsPrice: boolean
}

/**
 * Catalog rows offered at this property. assignedListings holds listing NAMES,
 * not ids, so the caller passes reservation.listingName.
 */
export function folioCatalogRows(services: UpsellService[], listingName: string, reservationCurrency: string): FolioCatalogRow[] {
  return services
    .filter(service => service.status === 'active' && service.assignedListings.includes(listingName))
    .flatMap(service => service.items.map(item => ({
      serviceId: service.id,
      serviceName: service.name,
      itemId: item.id,
      itemName: item.name,
      description: item.description,
      price: item.price,
      currency: service.currency,
      needsPrice: !service.pricingEnabled || service.currency !== reservationCurrency,
    })))
}

export function filterFolioCatalogRows(rows: FolioCatalogRow[], query: string): FolioCatalogRow[] {
  const q = query.trim().toLowerCase()
  if (!q)
    return rows

  return rows.filter(row =>
    `${row.serviceName} ${row.itemName} ${row.description ?? ''}`.toLowerCase().includes(q))
}

export type FolioActivityKind = 'added' | 'paid' | 'deferred' | 'removed' | 'voided'

const folioActivityTitles: Record<FolioActivityKind, string> = {
  added: 'Folio item added',
  paid: 'Folio item paid',
  deferred: 'Folio item charged to room',
  removed: 'Folio item removed',
  voided: 'Folio item voided',
}

const folioActivityColors: Record<FolioActivityKind, ActivityEvent['colorDot']> = {
  added: 'blue',
  paid: 'green',
  deferred: 'blue',
  removed: 'gray',
  voided: 'gray',
}

export function folioActivityEvent(
  kind: FolioActivityKind,
  item: FolioItem,
  actor: string,
  currency: string,
  now: string = new Date().toISOString(),
): ActivityEvent {
  // A charge-to-room item was never collected, no matter what the caller
  // labels it as. This module is the source of truth for that distinction,
  // so a 'paid' kind on a 'room' item is normalised to 'deferred' here
  // rather than trusting every call site to pass the right kind.
  const effectiveKind: FolioActivityKind = kind === 'paid' && item.paymentMethod === 'room' ? 'deferred' : kind

  const unitPrice = item.unitPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })
  const amount = `${folioLineTotal(item).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
  const parts = [`${item.label} · ${item.quantity} × ${unitPrice} = ${amount}`]

  if (effectiveKind === 'paid' && item.paymentMethod)
    parts.push(FOLIO_PAYMENT_METHOD_LABELS[item.paymentMethod])
  if (effectiveKind === 'voided' && item.voidReason)
    parts.push(`Reason: ${item.voidReason}`)

  return {
    id: `act-fol-${item.id}-${effectiveKind}`,
    type: 'reservation',
    title: folioActivityTitles[effectiveKind],
    description: parts.join(' · '),
    actor,
    timestamp: now,
    colorDot: folioActivityColors[effectiveKind],
  }
}
