import type { ProtectionPayer, ReservationEntry } from '~/components/reservations/data/reservations'
import type { TernTier } from '~/components/reservations/data/tern-products'

/**
 * Elev8 billing the tenant for the damage waiver (owner's decision,
 * 2026-09-28). On the 1st of every month Elev8 invoices the per-stay Tern fee
 * for every covered stay whose guest CHECKED OUT in the month before, and
 * charges it to the card on the tenant's Elev8 subscription. Framework-free;
 * `useWaiverBilling` owns the state and calls in.
 *
 * ⚠️ Billed on check-out, not on booking, the same way Tern bills Elev8
 * (monthly in arrears for completed bookings). A cancelled stay therefore
 * never reaches an invoice, and there are no credit lines.
 *
 * ⚠️ The fee is the one FROZEN on the protection (`elev8Fee`) at acceptance,
 * never re-read from the Tern price list: a later price change cannot rewrite
 * a stay already covered.
 *
 * ⚠️ One invoice per currency per month. Nothing is converted or blended.
 *
 * ⚠️ A stay is billed once, ever: a line's reservation id is never billed
 * again, even if a later run looks at the same stay.
 */

export type WaiverInvoiceStatus = 'charging' | 'paid' | 'payment_failed'

/** One covered stay on an invoice. A SNAPSHOT: editing the reservation later cannot change it. */
export interface WaiverInvoiceLine {
  reservationId: string
  guestName: string
  listingId: string
  listingName: string
  checkIn: string
  checkOut: string
  tier?: TernTier
  paidBy: ProtectionPayer
  /** The stay's 30-night cover packages, frozen on it. `fee` is already the total for all of them. */
  packages: number
  fee: number
}

export interface WaiverInvoiceBillTo {
  companyName: string
  addressLines: string[]
  vatNumber?: string
  ternOrganizationId?: string
}

export interface WaiverInvoice {
  id: string
  number: string
  /** The month the stays checked out in, `YYYY-MM`. */
  period: string
  /** The 1st of the month after `period`, local `YYYY-MM-DD`. */
  issuedOn: string
  currency: string
  lines: WaiverInvoiceLine[]
  total: number
  status: WaiverInvoiceStatus
  attempts: number
  billTo: WaiverInvoiceBillTo
  /** The subscription card, frozen when charged: a reference and a label, never a number. */
  paymentMethodId: string
  cardLabel: string
  chargedAt?: string
  failureReason?: string
  createdAt: string
}

/** A month that has been billed, including one with nothing to bill, so it is not billed twice. */
export interface WaiverBillingRun {
  period: string
  ranAt: string
  invoiceIds: string[]
}

/**
 * Who issues the invoice (owner's confirmation, 2026-09-28). ⚠️ Name only: the
 * address and tax number are still to come, and none is invented here.
 */
export const ELEV8_BILLING_ENTITY = { name: 'Elev8 Software AG' }

/** Reservation statuses that are never a stay Tern covered. */
const NOT_A_STAY: ReservationEntry['status'][] = ['cancelled', 'blocked', 'owner_request', 'inquiry']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local `YYYY-MM`. Never `toISOString()`, which shifts a UTC+8 midnight into the previous day. */
export function periodKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

/** Local `YYYY-MM-DD`. */
export function dayKey(date: Date): string {
  return `${periodKey(date)}-${pad(date.getDate())}`
}

export function periodLabel(period: string): string {
  const [year, month] = period.split('-').map(Number)
  return new Date(year!, month! - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** The 1st of the month after `period`: the day it is billed. Local midnight. */
export function billingDateFor(period: string): Date {
  const [year, month] = period.split('-').map(Number)
  return new Date(year!, month!, 1)
}

function nextPeriod(period: string): string {
  return periodKey(billingDateFor(period))
}

/**
 * Every month from `firstPeriod` whose 1st-of-next-month has come by `now`
 * and which has not been billed yet, oldest first. The app has no scheduler,
 * so a run missed on the 1st is caught up on the next visit.
 */
export function periodsDue(firstPeriod: string, now: Date, billed: Set<string>): string[] {
  const due: string[] = []
  let period = firstPeriod
  // A billing date is due once local midnight on the 1st has passed.
  while (billingDateFor(period).getTime() <= now.getTime()) {
    if (!billed.has(period))
      due.push(period)
    period = nextPeriod(period)
  }
  return due
}

export interface BillableStay {
  reservation: Pick<ReservationEntry, 'id' | 'guestName' | 'listingId' | 'listingName' | 'checkIn' | 'checkOut' | 'status' | 'damageProtection'>
}

export interface BillableLine extends WaiverInvoiceLine {
  currency: string
}

/**
 * The covered stays that belong on `period`'s invoices: a waiver still in
 * force (cancelling a stay moves it to `cancelled`), a real guest stay, a fee
 * frozen on it, a check-out inside the month, and not billed before.
 * `upTo` narrows it to check-outs on or before a day, for the month so far.
 */
export function billableLines(stays: BillableStay[], period: string, alreadyBilled: Set<string>, upTo?: string): BillableLine[] {
  return stays
    .filter(({ reservation: r }) => {
      const p = r.damageProtection
      return p?.option === 'waiver'
        && p.state === 'waiver_active'
        && typeof p.elev8Fee === 'number'
        && !NOT_A_STAY.includes(r.status)
        && r.checkOut.startsWith(`${period}-`)
        && (!upTo || r.checkOut <= upTo)
        && !alreadyBilled.has(r.id)
    })
    .map(({ reservation: r }) => ({
      reservationId: r.id,
      guestName: r.guestName,
      listingId: r.listingId,
      listingName: r.listingName,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      tier: r.damageProtection!.tier,
      paidBy: r.damageProtection!.paidBy ?? 'guest',
      packages: r.damageProtection!.packages ?? 1,
      fee: r.damageProtection!.elev8Fee!,
      currency: r.damageProtection!.currency,
    }))
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut) || a.guestName.localeCompare(b.guestName))
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Totals per currency, never blended. */
export function totalsByCurrency(lines: BillableLine[]): { currency: string, total: number, count: number }[] {
  const map = new Map<string, { total: number, count: number }>()
  for (const line of lines) {
    const entry = map.get(line.currency) ?? { total: 0, count: 0 }
    map.set(line.currency, { total: roundMoney(entry.total + line.fee), count: entry.count + 1 })
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, v]) => ({ currency, ...v }))
}

/** `E8-DW-202609-001`: the month, then a running number within that month. */
export function waiverInvoiceNumber(period: string, sequence: number): string {
  return `E8-DW-${period.replace('-', '')}-${String(sequence).padStart(3, '0')}`
}

export interface InvoiceContext {
  billTo: WaiverInvoiceBillTo
  paymentMethodId: string
  cardLabel: string
  /** Invoices already numbered in this period, so the sequence continues. */
  existingInPeriod: number
  now: Date
}

/** One invoice per currency for the month, lines kept whole. Charged separately. */
export function buildPeriodInvoices(lines: BillableLine[], period: string, ctx: InvoiceContext): WaiverInvoice[] {
  const issuedOn = dayKey(billingDateFor(period))
  return totalsByCurrency(lines).map(({ currency, total }, index) => {
    const number = waiverInvoiceNumber(period, ctx.existingInPeriod + index + 1)
    return {
      id: `winv-${number.toLowerCase()}`,
      number,
      period,
      issuedOn,
      currency,
      lines: lines.filter(l => l.currency === currency).map(({ currency: _c, ...line }) => line),
      total,
      status: 'charging' as const,
      attempts: 0,
      billTo: ctx.billTo,
      paymentMethodId: ctx.paymentMethodId,
      cardLabel: ctx.cardLabel,
      createdAt: ctx.now.toISOString(),
    }
  })
}

export const WAIVER_INVOICE_STATUS_LABELS: Record<WaiverInvoiceStatus, string> = {
  charging: 'Charging',
  paid: 'Paid',
  payment_failed: 'Payment failed',
}
