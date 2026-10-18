/**
 * Payment links on the Revenue tab, grouped by the revenue category staff set
 * when they created them. Unlike the rest of this page these are the real
 * payment requests, not generated. A paid link counts on the day it was paid;
 * a pending one waits on the day it was created. Only the listing scope
 * applies (a link has no channel or guest market), one currency at a time,
 * and the amount is what the link charged before any card fee.
 */

import type { DateSpan } from '~/components/analytics/data/analytics'
import type { PaymentCategory, PaymentRequest } from '~/components/payment-request/data/payment-requests'
import { PAYMENT_CATEGORIES } from '~/components/payment-request/data/payment-requests'

/** Local `YYYY-MM-DD` of an ISO timestamp, the way the rest of the page reads dates. */
function dayOf(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const inSpan = (iso: string, span: DateSpan) => iso >= span.start && iso <= span.end

export interface PaymentLinkCategoryRow {
  category: PaymentCategory
  label: string
  links: number
  amount: number
}

export interface PaymentLinkSummary {
  /** Paid links in the period. */
  paidLinks: number
  paid: number
  /** Links still waiting for the guest, created in the period. */
  pendingLinks: number
  pending: number
  /** Paid amount per category, biggest first, empty categories left out. */
  byCategory: PaymentLinkCategoryRow[]
}

export function paymentLinkSummary(requests: PaymentRequest[], listingIds: ReadonlySet<string>, span: DateSpan, currency: string): PaymentLinkSummary {
  const mine = requests.filter(r => r.currency === currency && listingIds.has(r.listingId))
  const paid = mine.filter(r => r.status === 'paid' && inSpan(dayOf(r.paidAt ?? r.createdAt), span))
  const pending = mine.filter(r => r.status === 'pending' && inSpan(dayOf(r.createdAt), span))

  const byCategory = PAYMENT_CATEGORIES
    .map((c) => {
      const rows = paid.filter(r => r.category === c.value)
      return { category: c.value, label: c.label, links: rows.length, amount: rows.reduce((s, r) => s + r.amount, 0) }
    })
    .filter(r => r.links > 0)
    .sort((a, b) => b.amount - a.amount)

  return {
    paidLinks: paid.length,
    paid: paid.reduce((s, r) => s + r.amount, 0),
    pendingLinks: pending.length,
    pending: pending.reduce((s, r) => s + r.amount, 0),
    byCategory,
  }
}
