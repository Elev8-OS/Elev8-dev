import type { WaiverInvoice } from '~/components/damage-protection/data/waiver-billing'
import { ELEV8_BILLING_ENTITY, periodLabel } from '~/components/damage-protection/data/waiver-billing'

/**
 * The emails Elev8 sends the tenant about its monthly damage waiver invoice.
 * Framework-free; `useWaiverBilling` decides when and sends them through
 * `/api/billing/send-email`.
 *
 * - `invoice_paid`: on the 1st, the invoice was charged to the subscription card.
 * - `payment_failed`: the charge was declined. Sent once per invoice, not on
 *   every failed retry.
 * - `payment_received`: a retry went through after a failure email.
 *
 * ⚠️ These are Elev8's emails TO the tenant. The tenant's own Settings, Billing
 * page never shows them (no "emailed to" log, no resend): that page is the
 * tenant's point of view.
 *
 * ⚠️ The sender is Elev8 Software AG by name only: the sending address is
 * still to come, and none is invented here. The PDF is named, not rendered:
 * the real provider builds it server-side from the invoice id
 * (`buildWaiverInvoicePdf`) and attaches it.
 */

export type WaiverBillingEmailKind = 'invoice_paid' | 'payment_failed' | 'payment_received'

export interface WaiverBillingEmail {
  kind: WaiverBillingEmailKind
  invoiceId: string
  to: string
  from: { name: string }
  subject: string
  text: string
  attachment: { filename: string, invoiceId: string }
}

/** Kept in step with the PDF kit's `money` and `day`, without pulling jsPDF in. */
function money(amount: number, currency: string): string {
  const digits = currency === 'IDR' ? 0 : 2
  return `${currency} ${amount.toLocaleString('de-CH', { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace(/’/g, '\'')}`
}

function day(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function sentence(value: string): string {
  const text = value.trim()
  return /[.!?]$/.test(text) ? text : `${text}.`
}

/** Which email a finished charge sends, or none when that one already went out. */
export function waiverBillingEmailKindFor(invoice: Pick<WaiverInvoice, 'status' | 'emailsSent'>): WaiverBillingEmailKind | null {
  const sent = invoice.emailsSent ?? {}
  if (invoice.status === 'payment_failed')
    return sent.payment_failed ? null : 'payment_failed'
  if (invoice.status === 'paid') {
    // Paid after the tenant was told it failed: tell them it is settled.
    if (sent.payment_failed)
      return sent.payment_received ? null : 'payment_received'
    return sent.invoice_paid ? null : 'invoice_paid'
  }
  return null
}

function stayLines(invoice: WaiverInvoice): string[] {
  return invoice.lines.map((line) => {
    const packages = line.packages > 1 ? ` (x${line.packages})` : ''
    return `- ${day(line.checkOut)}  ${line.listingName}, ${line.guestName}${packages}  ${money(line.fee, invoice.currency)}`
  })
}

export function buildWaiverBillingEmail(
  kind: WaiverBillingEmailKind,
  invoice: WaiverInvoice,
  opts: { to: string, billingUrl: string },
): WaiverBillingEmail {
  const month = periodLabel(invoice.period)
  const amount = money(invoice.total, invoice.currency)
  const stays = `${invoice.lines.length} covered stay${invoice.lines.length === 1 ? '' : 's'}`
  const summary = [
    `Invoice: ${invoice.number}`,
    `Issued: ${day(invoice.issuedOn)}`,
    `Amount: ${amount}`,
  ]
  let subject: string
  let body: string[]

  switch (kind) {
    case 'invoice_paid':
      subject = `Your Elev8 damage waiver invoice for ${month} (${invoice.number})`
      body = [
        `Here is your Elev8 damage waiver invoice for ${month}: ${stays} that checked out that month.`,
        '',
        ...summary,
        `Paid: charged to ${invoice.cardLabel} on ${day(invoice.chargedAt ?? invoice.issuedOn)}`,
        '',
        ...stayLines(invoice),
        '',
        `The invoice is attached as a PDF. You can also download it any time in Settings, Billing: ${opts.billingUrl}`,
      ]
      break
    case 'payment_failed':
      subject = `Payment failed: Elev8 damage waiver invoice ${invoice.number}`
      body = [
        `We could not charge your Elev8 damage waiver invoice for ${month}. ${sentence(invoice.failureReason ?? 'The charge was declined')} Nothing was taken.`,
        '',
        ...summary,
        `Card: ${invoice.cardLabel}`,
        '',
        `Please update the card on your Elev8 subscription and retry the payment in Settings, Billing: ${opts.billingUrl}`,
        '',
        'The invoice is attached as a PDF.',
      ]
      break
    case 'payment_received':
      subject = `Payment received: Elev8 damage waiver invoice ${invoice.number}`
      body = [
        `Thank you. Your Elev8 damage waiver invoice for ${month} is now paid.`,
        '',
        ...summary,
        `Paid: charged to ${invoice.cardLabel} on ${day(invoice.chargedAt ?? invoice.issuedOn)}`,
        '',
        `The paid invoice is attached as a PDF, and in Settings, Billing: ${opts.billingUrl}`,
      ]
      break
  }

  const text = [
    `Hello ${invoice.billTo.companyName},`,
    '',
    ...body,
    '',
    ELEV8_BILLING_ENTITY.name,
  ].join('\n')

  return {
    kind,
    invoiceId: invoice.id,
    to: opts.to,
    from: { name: ELEV8_BILLING_ENTITY.name },
    subject,
    text,
    attachment: { filename: `Elev8 damage waiver invoice ${invoice.number}.pdf`, invoiceId: invoice.id },
  }
}
