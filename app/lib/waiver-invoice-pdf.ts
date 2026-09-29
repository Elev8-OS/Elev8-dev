// Elev8's monthly damage waiver invoice to the tenant: one month, one
// currency, every covered stay that checked out in it, and how it was paid.
// Drawn in the shared Elev8 invoice frame (`elev8-invoice-pdf-kit.ts`).
//
// It prints the FROZEN invoice: the lines are snapshots taken on the 1st,
// never re-read from a reservation or the Tern price list. It never prints a
// card number: there is none, only a reference and a label.

import type { WaiverInvoice } from '~/components/damage-protection/data/waiver-billing'
import { ELEV8_BILLING_ENTITY, periodLabel } from '~/components/damage-protection/data/waiver-billing'
import { ternProduct } from '~/components/reservations/data/tern-products'
import { day, InvoiceDoc, money, sentence } from '~/lib/elev8-invoice-pdf-kit'

/** File name the browser offers. Exported so tests can pin it. */
export function waiverInvoicePdfFilename(invoice: Pick<WaiverInvoice, 'number'>): string {
  return `Elev8 damage waiver invoice ${invoice.number}.pdf`
}

/** Where the payment stands, in every state. */
function paymentLine(invoice: WaiverInvoice): { text: string, warn: boolean } {
  switch (invoice.status) {
    case 'paid':
      return { text: `Paid on ${day(invoice.chargedAt ?? invoice.issuedOn)}, charged to ${invoice.cardLabel}.`, warn: false }
    case 'payment_failed':
      return { text: `Not paid. ${sentence(invoice.failureReason ?? 'The charge was declined')} It will be charged again once the card on your Elev8 subscription is updated.`, warn: true }
    default:
      return { text: `Not paid yet. Being charged to ${invoice.cardLabel}.`, warn: true }
  }
}

/** Table columns, left edges in mm from the margin. */
const COLUMNS = [
  { label: 'Check-out', x: 0 },
  { label: 'Guest', x: 24, width: 37 },
  { label: 'Property', x: 64, width: 57 },
  { label: 'Cover', x: 124 },
  { label: 'Paid by', x: 142 },
  { label: 'Fee', x: 0, align: 'right' as const },
]

/**
 * Build the invoice PDF. Returns a Blob; also triggers a browser download
 * when `download` is true.
 */
export function buildWaiverInvoicePdf(invoice: WaiverInvoice, opts: { download?: boolean } = {}): Blob {
  const pdf = new InvoiceDoc({
    issuer: ELEV8_BILLING_ENTITY.name,
    subtitle: 'Elev8 Cover damage waiver fees',
    number: invoice.number,
    issuedOn: invoice.issuedOn,
  })
  const { currency } = invoice

  pdf.section('Bill to')
  pdf.row('Company', invoice.billTo.companyName)
  if (invoice.billTo.addressLines.length)
    pdf.row('Address', invoice.billTo.addressLines.join(', '))
  if (invoice.billTo.vatNumber)
    pdf.row('VAT number', invoice.billTo.vatNumber)
  if (invoice.billTo.ternOrganizationId !== undefined)
    pdf.row('Cover account', String(invoice.billTo.ternOrganizationId))

  const count = invoice.lines.length
  pdf.section(`Covered stays that checked out in ${periodLabel(invoice.period)}`, 17)
  pdf.table(
    COLUMNS,
    invoice.lines.map(line => [
      day(line.checkOut),
      line.guestName,
      line.listingName,
      line.tier ? `${ternProduct(line.tier).name}${(line.packages ?? 1) > 1 ? ` x${line.packages}` : ''}` : '-',
      line.paidBy === 'host' ? 'You' : 'Guest',
      money(line.fee, currency),
    ]),
    { label: `Total, ${count} ${count === 1 ? 'stay' : 'stays'}`, amount: money(invoice.total, currency), x: 124 },
  )

  pdf.section('Payment')
  const payment = paymentLine(invoice)
  pdf.row('Status', payment.text, payment.warn)

  pdf.section('How this invoice is worked out')
  pdf.note(
    'One fixed fee per 30 nights for every stay covered by the damage waiver whose guest checked out in the month, '
    + 'whether the guest or you paid for the waiver: a stay of 31 to 60 nights takes two packages (x2), and so on. '
    + 'The fee is the one fixed when the stay was covered. Cancelled stays and '
    + 'owner stays are never billed. Invoiced on the 1st of the following month and charged to the card on your '
    + 'Elev8 subscription.',
  )

  return pdf.finish({ download: opts.download, filename: waiverInvoicePdfFilename(invoice) })
}
