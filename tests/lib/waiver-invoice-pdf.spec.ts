// The damage waiver invoice PDF. jsPDF is replaced with a recorder, so the
// assertions are about what lands on the page.

import type { WaiverInvoice } from '~/components/damage-protection/data/waiver-billing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildWaiverInvoicePdf, waiverInvoicePdfFilename } from '~/lib/waiver-invoice-pdf'

const pdf = vi.hoisted(() => {
  const state = { texts: [] as string[], pages: 1 }
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

    addPage() {
      state.pages += 1
    }

    getNumberOfPages() {
      return state.pages
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

function invoice(patch: Partial<WaiverInvoice> = {}): WaiverInvoice {
  return {
    id: 'winv-e8-dw-202609-001',
    number: 'E8-DW-202609-001',
    period: '2026-09',
    issuedOn: '2026-10-01',
    currency: 'USD',
    lines: [
      { reservationId: 'a', guestName: 'Zoë Müller', listingId: 'lst-1', listingName: 'Villa Luwa', checkIn: '2026-09-01', checkOut: '2026-09-10', tier: 'bronze', paidBy: 'guest', fee: 9 },
      { reservationId: 'b', guestName: 'Hannah Brecht', listingId: 'lst-18', listingName: 'Apartments Pool - Room 3', checkIn: '2026-08-01', checkOut: '2026-09-20', tier: 'gold', paidBy: 'host', fee: 25 },
    ],
    total: 34,
    status: 'paid',
    attempts: 1,
    billTo: { companyName: 'Bali Villas Co.', addressLines: ['Jl. Pantai 1', '80361 Canggu'], ternOrganizationId: 10421 },
    paymentMethodId: 'pm_demo',
    cardLabel: 'Visa ending 4242',
    chargedAt: '2026-10-01T00:05:00.000Z',
    createdAt: '2026-10-01T00:05:00.000Z',
    ...patch,
  }
}

beforeEach(() => {
  pdf.state.texts = []
  pdf.state.pages = 1
})

describe('buildWaiverInvoicePdf', () => {
  it('prints the invoice, who it bills, each stay and the total', () => {
    buildWaiverInvoicePdf(invoice())
    const text = pdf.state.texts.join('\n')
    expect(text).toContain('ELEV8 SOFTWARE AG')
    expect(text).toContain('Invoice')
    expect(text).toContain('E8-DW-202609-001')
    expect(text).toContain('Bali Villas Co.')
    expect(text).toContain('Covered stays that checked out in September 2026')
    expect(text).toContain('Hannah Brecht')
    expect(text).toContain('Gold')
    expect(text).toContain('You')
    expect(text).toContain('Total, 2 stays')
    expect(text).toContain('USD 34.00')
  })

  it('prints ASCII only: jsPDF Helvetica cannot print the rest', () => {
    buildWaiverInvoicePdf(invoice())
    expect(pdf.state.texts).toContain('Zoe Muller')
    expect(pdf.state.texts.every(t => /^[\x20-\x7E]*$/.test(t))).toBe(true)
  })

  it('says it was paid only once it was, and states a declined charge', () => {
    buildWaiverInvoicePdf(invoice())
    expect(pdf.state.texts.join('\n')).toContain('Paid on 01 Oct 2026, charged to Visa ending 4242.')
    pdf.state.texts = []
    buildWaiverInvoicePdf(invoice({ status: 'payment_failed', chargedAt: undefined, failureReason: 'Declined: card expired' }))
    const text = pdf.state.texts.join('\n')
    expect(text).not.toContain('Paid on')
    expect(text).toContain('Not paid. Declined: card expired. It will be charged again')
  })

  it('names the file after the invoice number', () => {
    expect(waiverInvoicePdfFilename(invoice())).toBe('Elev8 damage waiver invoice E8-DW-202609-001.pdf')
  })
})
