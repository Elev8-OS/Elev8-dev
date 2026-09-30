// The House Rules Agreement is generated, not stored, so the rules a guest sees
// depend on the fallback chain: active guest guide, then the listing, then the
// default set. These specs pin that chain and what the signed copy prints.

import type { GuestGuide } from '~/components/guest-guides/data/types'
import type { Listing } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { describe, expect, it, vi } from 'vitest'
import {
  buildHouseRulesAgreementPdf,
  DEFAULT_HOUSE_RULES,
  houseRulesAgreementFileName,
  houseRulesAgreementInput,
  resolveHouseRules,
} from '~/lib/house-rules-agreement-pdf'

const pdf = vi.hoisted(() => {
  const state = { texts: [] as string[], images: 0, pages: 1 }
  class FakeDoc {
    setFillColor() {}
    setTextColor() {}
    setDrawColor() {}
    setFont() {}
    setFontSize() {}
    rect() {}
    line() {}
    addImage() {
      state.images++
    }

    text(value: string | string[]) {
      state.texts.push(Array.isArray(value) ? value.join('\n') : String(value))
    }

    splitTextToSize(value: string) {
      return [value]
    }

    addPage() {
      state.pages++
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

function reset() {
  pdf.state.texts = []
  pdf.state.images = 0
  pdf.state.pages = 1
}

const listing = {
  id: 'lst-1',
  resources: { documents: [], basics: { houseRules: 'No smoking inside\n\nNo parties', checkInTime: '14:00', checkOutTime: '11:00' } },
} as unknown as Listing

function guide(partial: Partial<GuestGuide> & { rules?: string[], enabled?: boolean }): GuestGuide {
  return {
    id: 'gg-1',
    title: 'Guide',
    assignedListingIds: ['lst-1'],
    status: 'active',
    defaultLanguage: 'en',
    createdBy: 'staff-1',
    createdAt: '',
    updatedAt: '',
    sections: [{ id: 's1', type: 'house_rules', order: 1, enabled: partial.enabled ?? true, data: { rules: partial.rules ?? ['Shoes off inside'] } }],
    ...partial,
  } as GuestGuide
}

const reservation = {
  id: 'res-1',
  guestName: 'Sarah Johnson',
  guestEmail: 'sarah@example.com',
  listingId: 'lst-1',
  listingName: 'Villa Luwa',
  channel: 'Airbnb',
  checkIn: '2026-07-10',
  checkOut: '2026-07-15',
  nights: 5,
  guestCount: 2,
  identity: {
    status: 'verified',
    submittedAt: '2026-07-08T10:00:00Z',
    documents: [
      { id: 'd1', kind: 'signature', name: 'Guest signature', url: 'data:image/png;base64,AAAA', uploadedAt: '2026-07-08T10:00:00Z' },
      { id: 'd2', kind: 'agreement', name: 'House Rules Agreement (PDF)', uploadedAt: '2026-07-08T10:05:00Z' },
    ],
  },
} as unknown as ReservationEntry

describe('resolveHouseRules', () => {
  it('prefers the active guide assigned to the listing', () => {
    expect(resolveHouseRules(reservation, { listings: [listing], guides: [guide({})] }))
      .toEqual({ rules: [{ title: 'Shoes off inside' }], source: 'guest_guide' })
  })

  it('keeps titled rules with their description and drops blank ones', () => {
    const rules = [
      { title: 'No Smoking', description: 'Smoking is strictly prohibited inside the apartment.' },
      { title: 'No Pets', description: '  ' },
      { title: ' ', description: 'Orphan description' },
      '',
    ] as unknown as string[]
    expect(resolveHouseRules(reservation, { listings: [listing], guides: [guide({ rules })] }).rules).toEqual([
      { title: 'No Smoking', description: 'Smoking is strictly prohibited inside the apartment.' },
      { title: 'No Pets' },
    ])
  })

  it('skips a draft guide or a disabled section and uses the listing rules', () => {
    const result = resolveHouseRules(reservation, {
      listings: [listing],
      guides: [guide({ status: 'draft' }), guide({ id: 'gg-2', enabled: false })],
    })
    expect(result).toEqual({ rules: [{ title: 'No smoking inside' }, { title: 'No parties' }], source: 'listing' })
  })

  it('falls back to the default set', () => {
    expect(resolveHouseRules(reservation, { listings: [], guides: [] }))
      .toEqual({ rules: DEFAULT_HOUSE_RULES, source: 'default' })
  })
})

describe('buildHouseRulesAgreementPdf', () => {
  it('prints the stay, every rule and the signed state', () => {
    reset()
    const input = houseRulesAgreementInput(reservation, { listings: [listing], guides: [] })
    buildHouseRulesAgreementPdf(input)
    const text = pdf.state.texts.join('\n')

    expect(text).toContain('House Rules Agreement')
    expect(text).toContain('Sarah Johnson')
    expect(text).toContain('Villa Luwa')
    expect(text).toContain('from 14:00')
    expect(text).toContain('by 11:00')
    expect(text).toContain('No smoking inside')
    expect(text).toContain('No parties')
    expect(text).toContain('SIGNED')
    expect(pdf.state.images).toBe(1)
  })

  it('prints each rule title with its description', () => {
    reset()
    const input = houseRulesAgreementInput(reservation, { listings: [listing], guides: [] })
    buildHouseRulesAgreementPdf({
      ...input,
      rules: [
        { title: 'No Smoking', description: 'Damage compensation for violations: minimum CHF 500.' },
        { title: 'Quiet Hours' },
      ],
    })
    const texts = pdf.state.texts

    expect(texts).toContain('No Smoking')
    expect(texts).toContain('Damage compensation for violations: minimum CHF 500.')
    expect(texts).toContain('Quiet Hours')
    expect(texts.indexOf('No Smoking')).toBeLessThan(texts.indexOf('Damage compensation for violations: minimum CHF 500.'))
  })

  it('marks an agreement without a signed document as awaiting signature', () => {
    reset()
    const unsigned = { ...reservation, identity: { status: 'pending', documents: [] } } as unknown as ReservationEntry
    buildHouseRulesAgreementPdf(houseRulesAgreementInput(unsigned, { listings: [listing], guides: [] }))
    const text = pdf.state.texts.join('\n')

    expect(text).toContain('AWAITING SIGNATURE')
    expect(text).toContain('Not yet signed')
    expect(pdf.state.images).toBe(0)
  })

  it('types the guest name when the signature cannot be embedded', () => {
    reset()
    const svgSigned = {
      ...reservation,
      identity: {
        ...reservation.identity,
        documents: reservation.identity!.documents.map(d => d.kind === 'signature' ? { ...d, url: 'data:image/svg+xml;utf8,<svg/>' } : d),
      },
    } as unknown as ReservationEntry
    buildHouseRulesAgreementPdf(houseRulesAgreementInput(svgSigned, { listings: [listing], guides: [] }))

    expect(pdf.state.images).toBe(0)
    expect(pdf.state.texts.filter(t => t === 'Sarah Johnson').length).toBeGreaterThanOrEqual(2)
  })

  it('names the file after the guest', () => {
    expect(houseRulesAgreementFileName({ guestName: 'Sarah Johnson', reservationId: 'res-1' }))
      .toBe('house-rules-agreement-sarah-johnson.pdf')
  })
})
