// The owner statement PDF writer. jsPDF is replaced with a recorder so the
// assertions can be about what lands on the page — which figures, which
// lines, how many pages — rather than about bytes in a Blob.

import type { OwnerReservationForStatement } from '~/components/owners/data/owner-statement-reservations'
import type { OwnerStatement } from '~/components/owners/data/owner-statements'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildOwnerStatementPdf, ownerStatementPdfFilename } from '~/lib/owner-statement-pdf'

const pdf = vi.hoisted(() => {
  const state = {
    texts: [] as string[],
    images: [] as string[],
    pages: 1,
    throwOnAddImage: false,
  }

  class FakeDoc {
    setFillColor() {}
    setTextColor() {}
    setDrawColor() {}
    setFont() {}
    setFontSize() {}
    rect() {}
    roundedRect() {}
    line() {}
    text(value: string) {
      state.texts.push(String(value))
    }

    addImage(dataUrl: string) {
      if (state.throwOnAddImage)
        throw new Error('corrupt image')
      state.images.push(dataUrl)
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

    output() {
      return new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    }
  }

  return { state, FakeDoc }
})

vi.mock('jspdf', () => ({ jsPDF: pdf.FakeDoc }))

beforeEach(() => {
  pdf.state.texts = []
  pdf.state.images = []
  pdf.state.pages = 1
  pdf.state.throwOnAddImage = false
})

function statement(overrides: Partial<OwnerStatement> = {}): OwnerStatement {
  return {
    id: 'stmt-x',
    ownerId: 'own-1',
    listingId: 'lst-1',
    period: '2026-05',
    currency: 'IDR',
    status: 'published',
    createdAt: '2026-06-01T00:00:00.000Z',
    publishedAt: '2026-06-03T00:00:00.000Z',
    lines: [
      { id: 'l-1', category: 'revenue', label: 'Gross booking revenue', amount: 99_000_000 },
      { id: 'l-2', category: 'commission', label: 'Management commission', amount: -9_000_000 },
    ],
    totalAmount: 90_000_000,
    publishedSnapshot: {
      currency: 'IDR',
      totalAmount: 25_180_000,
      lines: [
        { id: 'l-1', category: 'revenue', label: 'Gross booking revenue', amount: 42_000_000 },
        { id: 'l-2', category: 'commission', label: 'Management commission', amount: -8_400_000 },
      ],
    },
    issues: [],
    ...overrides,
  }
}

function reservation(index: number): OwnerReservationForStatement {
  return {
    id: `res-${index}`,
    statementId: 'stmt-x',
    guestName: `Guest ${index}`,
    source: 'airbnb',
    checkIn: '2026-05-02',
    checkOut: '2026-05-06',
    nights: 4,
    grossAmount: 5_000_000,
    channelFee: 300_000,
    netToOwner: 4_700_000,
  } as OwnerReservationForStatement
}

/**
 * Mirrors the writer's own grouping. Hardcoding "25'180'000" would pin the
 * test to one ICU version: de-CH groups with a typographic apostrophe on
 * modern Node and with a plain one on older builds.
 */
function money(amount: number, currency = 'IDR') {
  const grouped = Math.abs(amount).toLocaleString('de-CH').replace(/\./g, '\'')
  return `${amount < 0 ? '−' : ''}${currency} ${grouped}`
}

const base = {
  owner: { id: 'own-1', name: 'Wayan Sari', email: 'wayan.sari@example.com' } as never,
  listing: { id: 'lst-1', name: 'Villa Luwa', location: 'Canggu' } as never,
  reservations: [],
}

describe('buildOwnerStatementPdf', () => {
  it('prints the frozen snapshot figures, never the live ones', () => {
    buildOwnerStatementPdf({ ...base, statement: statement() })
    const text = pdf.state.texts.join('\n')

    // 25'180'000 is the snapshot total; 90'000'000 is the live one.
    expect(text).toContain(money(25_180_000))
    expect(text).not.toContain(money(90_000_000))
    expect(text).toContain(money(42_000_000))
    expect(text).not.toContain(money(99_000_000))
  })

  it('prints only the lines it was given, so a hidden category cannot leak into the file', () => {
    const source = statement()
    buildOwnerStatementPdf({
      ...base,
      statement: source,
      lines: source.publishedSnapshot!.lines.filter(l => l.category === 'revenue'),
    })
    const text = pdf.state.texts.join('\n')

    expect(text).toContain('Gross booking revenue')
    expect(text).not.toContain('Management commission')
  })

  it('omits the payout figure when the owner may not see it', () => {
    buildOwnerStatementPdf({ ...base, statement: statement(), showPayout: false })
    const text = pdf.state.texts.join('\n')

    expect(text).not.toContain('OWNER PAYOUT')
    expect(text).not.toContain(money(25_180_000))
    // The rest of the statement still prints.
    expect(text).toContain('Gross booking revenue')
  })

  it('states which statement carries each correction, so nothing reads as a double count', () => {
    buildOwnerStatementPdf({
      ...base,
      statement: statement(),
      adjustments: [
        { id: 'a-1', label: 'Correction for 2026-04', amount: -180_000, reason: 'Host fee understated.', applied: true },
      ],
      relatedAdjustments: [
        { id: 'a-2', label: 'Correction for 2026-05', amount: 250_000, reason: 'Cleaning billed twice.', appliesInPeriod: '2026-06', applied: false },
        { id: 'a-3', label: 'Correction for 2026-05', amount: -50_000, reason: 'Late checkout fee.', appliesInPeriod: '2026-06', applied: true },
      ],
    })
    const text = pdf.state.texts.join('\n')

    expect(text).toContain('Adjustment details')
    expect(text).toContain('Included in the items above.')
    expect(text).toContain('Will appear in the 2026-06 statement.')
    expect(text).toContain('Paid out in the 2026-06 statement.')
    expect(text).toContain('Host fee understated.')
  })

  it('leaves the adjustment block out entirely when there is nothing to explain', () => {
    buildOwnerStatementPdf({ ...base, statement: statement() })
    expect(pdf.state.texts.join('\n')).not.toContain('Adjustment details')
  })

  it('paginates a long booking table and repeats the column headers', () => {
    const reservations = Array.from({ length: 60 }, (_, i) => reservation(i))
    buildOwnerStatementPdf({ ...base, statement: statement(), reservations })

    expect(pdf.state.pages).toBeGreaterThan(1)
    // The column headers are repeated, so a continued table is still readable.
    const headerCount = pdf.state.texts.filter(t => t === 'Net to owner').length
    expect(headerCount).toBeGreaterThan(1)
    // Every booking is drawn, none dropped at a page boundary.
    expect(pdf.state.texts.filter(t => t.startsWith('Guest '))).toHaveLength(60)
    // Page numbering only appears once the document actually has pages.
    expect(pdf.state.texts.join('\n')).toContain(`Page 1 of ${pdf.state.pages}`)
  })

  it('numbers no pages on a single-page statement', () => {
    buildOwnerStatementPdf({ ...base, statement: statement(), reservations: [reservation(1)] })
    expect(pdf.state.pages).toBe(1)
    expect(pdf.state.texts.join('\n')).not.toContain('Page 1 of')
  })

  it('embeds a PNG tenant logo in place of the wordmark', () => {
    buildOwnerStatementPdf({
      ...base,
      statement: statement(),
      branding: { logoDataUrl: 'data:image/png;base64,AAAA' },
    })

    expect(pdf.state.images).toHaveLength(1)
    // The fallback mark is not drawn when a logo embeds.
    expect(pdf.state.texts).not.toContain('E8')
  })

  it('falls back to the wordmark for a format jsPDF cannot embed', () => {
    buildOwnerStatementPdf({
      ...base,
      statement: statement(),
      branding: { logoDataUrl: 'data:image/webp;base64,AAAA' },
    })

    expect(pdf.state.images).toHaveLength(0)
    expect(pdf.state.texts).toContain('E8')
  })

  it('still produces the statement when the logo is corrupt', () => {
    pdf.state.throwOnAddImage = true
    expect(() => buildOwnerStatementPdf({
      ...base,
      statement: statement(),
      branding: { logoDataUrl: 'data:image/png;base64,BROKEN' },
    })).not.toThrow()

    expect(pdf.state.images).toHaveLength(0)
    expect(pdf.state.texts).toContain('E8')
    expect(pdf.state.texts.join('\n')).toContain('Gross booking revenue')
  })

  it('prints the owner address under their name, and their own payout account', () => {
    buildOwnerStatementPdf({
      ...base,
      statement: statement(),
      ownerAddressLines: ['Jl. Pantai Berawa No. 88', '80361 Canggu', 'Indonesia'],
      payoutBankLines: ['Bank: Bank Central Asia (BCA)', 'Account Holder: Wayan Sari', 'Account No: 7712345678'],
    })
    const text = pdf.state.texts.join('\n')

    expect(text).toContain('Jl. Pantai Berawa No. 88')
    expect(text).toContain('Payout Account')
    expect(text).toContain('Account No: 7712345678')
    expect(text).not.toContain('No payout account on file.')
  })

  it('says so when no payout account is on file, rather than printing the manager\'s', () => {
    buildOwnerStatementPdf({ ...base, statement: statement() })
    const text = pdf.state.texts.join('\n')

    expect(text).toContain('Payout Account')
    expect(text).toContain('No payout account on file.')
    // The letterhead company still appears at the top; its BANK account must
    // not, or the owner reads it as where they should send money.
    expect(text).not.toMatch(/^Bank: /m)
    expect(text).not.toMatch(/^IBAN: /m)
  })

  it('returns a PDF blob', () => {
    const blob = buildOwnerStatementPdf({ ...base, statement: statement() })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
  })

  it('names the file by property and period', () => {
    expect(ownerStatementPdfFilename(statement(), { name: 'Villa Luwa' } as never))
      .toBe('Owner Statement — Villa Luwa — 2026-05.pdf')
    // No listing resolved: the id is better than a blank.
    expect(ownerStatementPdfFilename(statement(), undefined))
      .toBe('Owner Statement — lst-1 — 2026-05.pdf')
  })
})
