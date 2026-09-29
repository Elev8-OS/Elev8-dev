import type { WaiverInvoice } from '~/components/damage-protection/data/waiver-billing'
import { describe, expect, it } from 'vitest'
import { buildWaiverBillingEmail, waiverBillingEmailKindFor } from '~/components/damage-protection/data/waiver-billing-emails'
import { waiverInvoicePdfFilename } from '~/lib/waiver-invoice-pdf'

function invoice(patch: Partial<WaiverInvoice> = {}): WaiverInvoice {
  return {
    id: 'wi-1',
    number: 'E8-DW-202609-001',
    period: '2026-09',
    issuedOn: '2026-10-01',
    currency: 'USD',
    lines: [
      { reservationId: 'a', guestName: 'Anna Schmidt', listingId: 'lst-1', listingName: 'Villa Luwa', checkIn: '2026-09-01', checkOut: '2026-09-10', tier: 'bronze', paidBy: 'guest', packages: 1, fee: 9 },
      { reservationId: 'b', guestName: 'Ben Ito', listingId: 'lst-1', listingName: 'Villa Luwa', checkIn: '2026-08-01', checkOut: '2026-09-20', tier: 'bronze', paidBy: 'host', packages: 2, fee: 18 },
    ],
    total: 27,
    status: 'paid',
    attempts: 1,
    billTo: { companyName: 'Elevate Schweiz GmbH', addressLines: [] },
    paymentMethodId: 'pm_1',
    cardLabel: 'Visa ending 4242',
    chargedAt: '2026-10-01T00:06:00',
    createdAt: '2026-10-01T00:05:00',
    ...patch,
  }
}

const OPTS = { to: 'ops@example.com', billingUrl: 'https://app.example.com/settings/billing' }

describe('waiverBillingEmailKindFor', () => {
  it('sends the invoice when paid first time, and nothing twice', () => {
    expect(waiverBillingEmailKindFor(invoice())).toBe('invoice_paid')
    expect(waiverBillingEmailKindFor(invoice({ emailsSent: { invoice_paid: 'x' } }))).toBeNull()
  })

  it('tells of a failure once, then that the retry went through', () => {
    expect(waiverBillingEmailKindFor(invoice({ status: 'payment_failed' }))).toBe('payment_failed')
    expect(waiverBillingEmailKindFor(invoice({ status: 'payment_failed', emailsSent: { payment_failed: 'x' } }))).toBeNull()
    expect(waiverBillingEmailKindFor(invoice({ emailsSent: { payment_failed: 'x' } }))).toBe('payment_received')
    expect(waiverBillingEmailKindFor(invoice({ emailsSent: { payment_failed: 'x', payment_received: 'y' } }))).toBeNull()
  })

  it('sends nothing while the charge is running', () => {
    expect(waiverBillingEmailKindFor(invoice({ status: 'charging' }))).toBeNull()
  })
})

describe('buildWaiverBillingEmail', () => {
  it('writes the monthly invoice from Elev8 Software AG, with every stay and the PDF attached', () => {
    const email = buildWaiverBillingEmail('invoice_paid', invoice(), OPTS)
    expect(email).toMatchObject({ kind: 'invoice_paid', to: 'ops@example.com', from: { name: 'Elev8 Software AG' }, subject: 'Your Elev8 damage waiver invoice for September 2026 (E8-DW-202609-001)' })
    expect(email.text).toContain('Hello Elevate Schweiz GmbH,')
    expect(email.text).toContain('2 covered stays')
    expect(email.text).toContain('Amount: USD 27.00')
    expect(email.text).toContain('charged to Visa ending 4242')
    expect(email.text).toContain('Villa Luwa, Ben Ito (x2)  USD 18.00')
    expect(email.text).toContain(OPTS.billingUrl)
    expect(email.attachment).toEqual({ filename: waiverInvoicePdfFilename(invoice()), invoiceId: 'wi-1' })
  })

  it('says why the charge failed, that nothing was taken, and where to fix it', () => {
    const email = buildWaiverBillingEmail('payment_failed', invoice({ status: 'payment_failed', failureReason: 'Declined: card expired' }), OPTS)
    expect(email.subject).toBe('Payment failed: Elev8 damage waiver invoice E8-DW-202609-001')
    expect(email.text).toContain('Declined: card expired. Nothing was taken.')
    expect(email.text).toContain('retry the payment in Settings, Billing')
  })

  it('confirms the payment after a retry', () => {
    const email = buildWaiverBillingEmail('payment_received', invoice({ attempts: 2 }), OPTS)
    expect(email.subject).toBe('Payment received: Elev8 damage waiver invoice E8-DW-202609-001')
    expect(email.text).toContain('is now paid')
  })

  it('never names a currency symbol or the insurer', () => {
    for (const kind of ['invoice_paid', 'payment_failed', 'payment_received'] as const) {
      const { subject, text } = buildWaiverBillingEmail(kind, invoice(), OPTS)
      expect(`${subject}\n${text}`).not.toMatch(/\$|Tern/)
    }
  })
})
