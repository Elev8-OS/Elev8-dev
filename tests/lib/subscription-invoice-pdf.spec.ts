import type { SubscriptionInvoice } from '~/components/billing/data/subscription-billing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSubscriptionInvoicePdf, subscriptionInvoicePdfFilename } from '~/lib/subscription-invoice-pdf'

const pdf = vi.hoisted(() => {
  const state = { texts: [] as string[] }
  class FakeDoc {
    setFillColor() {}
    setTextColor() {}
    setDrawColor() {}
    setFont() {}
    setFontSize() {}
    rect() {}
    line() {}
    text(value: string | string[]) {
      for (const v of Array.isArray(value) ? value : [value])
        state.texts.push(String(v))
    }

    getTextWidth(value: string) {
      return value.length * 1.6
    }

    splitTextToSize(value: string) {
      return [value]
    }

    addPage() {}
    getNumberOfPages() {
      return 1
    }

    setPage() {}
    save() {}
    output() {
      return new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    }
  }
  return { state, FakeDoc }
})

vi.mock('jspdf', () => ({ jsPDF: pdf.FakeDoc }))

const INVOICE: SubscriptionInvoice = {
  id: 'inv-2026-08',
  number: 'INV-2026-08-0131',
  periodLabel: 'August 2026',
  issuedOn: '2026-08-26T09:00:00.000Z',
  amountUsd: 944,
  status: 'paid',
  planName: 'Growth',
  units: 16,
  unitRateUsd: 59,
  cardLabel: 'Visa ending 4242',
  paidAt: '2026-08-26T09:00:00.000Z',
}
const BILL_TO = { companyName: 'Elevate Schweiz GmbH', addressLines: ['Im Fueler 7', '4616 Kappel'], vatNumber: 'CHE-163.290.666MWST' }

beforeEach(() => {
  pdf.state.texts = []
})

describe('buildSubscriptionInvoicePdf', () => {
  it('prints the issuer, who it bills, the package line and the total', () => {
    buildSubscriptionInvoicePdf(INVOICE, BILL_TO)
    const text = pdf.state.texts.join('\n')
    for (const expected of ['ELEV8 SOFTWARE AG', 'INV-2026-08-0131', 'Elevate Schweiz GmbH', 'CHE-163.290.666MWST', 'Subscription, August 2026', 'Growth package, billed per unit', '16', 'USD 59.00', 'USD 944.00'])
      expect(text).toContain(expected)
    expect(text).toContain('Paid on 26 Aug 2026, charged to Visa ending 4242.')
  })

  it('states an unpaid invoice as unpaid', () => {
    buildSubscriptionInvoicePdf({ ...INVOICE, status: 'payment_failed', paidAt: undefined, failureReason: 'The card on file has expired' }, BILL_TO)
    const text = pdf.state.texts.join('\n')
    expect(text).not.toContain('Paid on')
    expect(text).toContain('Not paid. The card on file has expired. Update the card')
  })

  it('names the file after the invoice number', () => {
    expect(subscriptionInvoicePdfFilename(INVOICE)).toBe('Elev8 subscription invoice INV-2026-08-0131.pdf')
  })
})
