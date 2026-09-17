// The signed management agreement. The one thing that must not drift is the
// payout clause: the signing screen renders `OWNER_CONTRACT_PAYOUT_CLAUSE`
// directly, so this asserts the signed copy carries the same sentence.

import type { OwnerContract } from '~/components/owners/data/owner-contracts'
import { describe, expect, it, vi } from 'vitest'
import { OWNER_CONTRACT_PAYOUT_CLAUSE } from '~/components/owners/data/owner-contracts'
import { buildOwnerContractPdf } from '~/lib/owner-contract-pdf'

const pdf = vi.hoisted(() => {
  const state = { texts: [] as string[] }
  class FakeDoc {
    setFillColor() {}
    setTextColor() {}
    setDrawColor() {}
    setFont() {}
    setFontSize() {}
    rect() {}
    roundedRect() {}
    line() {}
    addImage() {}
    text(value: string | string[]) {
      state.texts.push(Array.isArray(value) ? value.join('\n') : String(value))
    }

    splitTextToSize(value: string) {
      return [value]
    }

    addPage() {}
    getNumberOfPages() {
      return 1
    }

    setPage() {}
    output() {
      return new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    }
  }
  return { state, FakeDoc }
})

vi.mock('jspdf', () => ({ jsPDF: pdf.FakeDoc }))

const contract = {
  id: 'ctr-1',
  ownerId: 'own-1',
  ownerName: 'Wayan Sari',
  listingIds: ['lst-1'],
  status: 'signed',
  createdAt: '2026-01-15T08:00:00.000Z',
  sentAt: '2026-01-16T08:00:00.000Z',
  signedAt: '2026-01-17T08:00:00.000Z',
  terms: {
    commissionType: 'gross',
    rate: 20,
    basis: 'gross',
    includedServices: ['Channel management'],
    operationalFee: 100,
  },
} as unknown as OwnerContract

describe('buildOwnerContractPdf', () => {
  it('writes the payout clause into the signed copy', () => {
    pdf.state.texts = []
    buildOwnerContractPdf(contract, undefined)
    const text = pdf.state.texts.join('\n')

    expect(text).toContain(OWNER_CONTRACT_PAYOUT_CLAUSE)
    expect(OWNER_CONTRACT_PAYOUT_CLAUSE).toMatch(/Bank Details/)
  })
})
