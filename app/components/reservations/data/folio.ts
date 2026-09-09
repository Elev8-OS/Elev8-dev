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
