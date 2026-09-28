// Elev8's subscription invoice to the tenant: one billing period of the
// package, and how it was paid. Drawn in the shared Elev8 invoice frame
// (`elev8-invoice-pdf-kit.ts`), so it reads as one family with the damage
// waiver invoice.

import type { SubscriptionInvoice } from '~/components/billing/data/subscription-billing'
import type { WaiverInvoiceBillTo } from '~/components/damage-protection/data/waiver-billing'
import { ELEV8_BILLING_ENTITY } from '~/components/damage-protection/data/waiver-billing'
import { day, InvoiceDoc, money, sentence } from '~/lib/elev8-invoice-pdf-kit'

export function subscriptionInvoicePdfFilename(invoice: Pick<SubscriptionInvoice, 'number'>): string {
  return `Elev8 subscription invoice ${invoice.number}.pdf`
}

const COLUMNS = [
  { label: 'Item', x: 0, width: 88 },
  { label: 'Units', x: 92 },
  { label: 'Rate', x: 112 },
  { label: 'Amount', x: 0, align: 'right' as const },
]

export function buildSubscriptionInvoicePdf(
  invoice: SubscriptionInvoice,
  billTo: WaiverInvoiceBillTo,
  opts: { download?: boolean } = {},
): Blob {
  const pdf = new InvoiceDoc({
    issuer: ELEV8_BILLING_ENTITY.name,
    subtitle: 'Elev8 subscription',
    number: invoice.number,
    issuedOn: invoice.issuedOn,
  })

  pdf.section('Bill to')
  pdf.row('Company', billTo.companyName)
  if (billTo.addressLines.length)
    pdf.row('Address', billTo.addressLines.join(', '))
  if (billTo.vatNumber)
    pdf.row('VAT number', billTo.vatNumber)

  pdf.section(`Subscription, ${invoice.periodLabel}`, 17)
  pdf.table(
    COLUMNS,
    [[
      `${invoice.planName} package, billed per unit`,
      String(invoice.units),
      money(invoice.unitRateUsd, 'USD'),
      money(invoice.amountUsd, 'USD'),
    ]],
    { label: 'Total', amount: money(invoice.amountUsd, 'USD'), x: 112 },
  )

  pdf.section('Payment')
  if (invoice.status === 'paid')
    pdf.row('Status', `Paid on ${day(invoice.paidAt ?? invoice.issuedOn)}, charged to ${invoice.cardLabel}.`)
  else
    pdf.row('Status', `Not paid. ${sentence(invoice.failureReason ?? 'The charge was declined')} Update the card on your Elev8 subscription to pay it.`, true)

  return pdf.finish({ download: opts.download, filename: subscriptionInvoicePdfFilename(invoice) })
}
