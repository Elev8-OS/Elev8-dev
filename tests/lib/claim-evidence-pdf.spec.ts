// The claim evidence PDF. jsPDF is replaced with a recorder, so the assertions
// are about what lands on the page: which facts, which photos, how many pages.

import type { DamageProtection, ProtectionClaim } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildClaimEvidencePdf,
  claimEvidencePdfFilename,
  claimPhotoSources,
  loadEvidencePhotos,
} from '~/lib/claim-evidence-pdf'

const pdf = vi.hoisted(() => {
  const state = {
    texts: [] as string[],
    images: [] as { dataUrl: string, format: string }[],
    pages: 1,
    throwOnAddImage: false,
  }

  class FakeDoc {
    setFillColor() {}
    setTextColor() {}
    setFont() {}
    setFontSize() {}
    rect() {}
    text(value: string | string[]) {
      for (const v of Array.isArray(value) ? value : [value])
        state.texts.push(String(v))
    }

    addImage(dataUrl: string, format: string) {
      if (state.throwOnAddImage)
        throw new Error('corrupt image')
      state.images.push({ dataUrl, format })
    }

    getImageProperties() {
      return { width: 800, height: 600 }
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

const JPEG = 'data:image/jpeg;base64,/9j/AAAA'
const PNG = 'data:image/png;base64,iVBORw0KGgo='

const RESERVATION = {
  id: 'res-dp-unnotified',
  guestName: 'Priya Raman',
  guestEmail: 'priya@example.com',
  listingName: '5BR Pool the R Villa Luwa',
  checkIn: '2026-09-19',
  checkOut: '2026-09-24',
}

function claim(patch: Partial<ProtectionClaim> = {}): ProtectionClaim {
  return {
    id: 'clm-1',
    label: 'Cracked shower screen',
    amount: 180,
    coveredAmount: 180,
    excessAmount: 0,
    reason: 'Glass split from the bottom corner.',
    evidenceUrls: ['/mock/evidence/shower-screen.jpg', '/mock/evidence/quote.pdf'],
    cleaningReport: {
      cleaningJobId: 'cln-1',
      findingId: 'cln-1:problem:b-1',
      finding: 'Cracked shower screen',
      checklistItem: 'Clean shower, bath and basin',
      photoUrls: ['https://images.example/screen.jpg'],
      cleaningLabel: 'Check-out cleaning',
      reportedBy: 'Made Surya',
      reportedAt: '2026-09-24T05:30:00.000Z',
    },
    recordedBy: 'Komang Juliantara',
    recordedAt: '2026-09-24T06:00:00.000Z',
    guestNotifiedAt: '2026-09-24T07:00:00.000Z',
    ...patch,
  }
}

function deposit(patch: Partial<DamageProtection> = {}): DamageProtection {
  return {
    policyId: 'dp-standard',
    option: 'deposit',
    state: 'card_on_file',
    amount: 500,
    currency: 'USD',
    termsVersion: 'v1',
    termsText: 'The security deposit keeps your card on file.',
    acceptedAt: '2026-09-10T00:00:00.000Z',
    acceptedVia: 'guest_guide',
    card: { provider: 'stripe', paymentMethodId: 'pm_mock_5556', brand: 'mastercard', last4: '5556', expMonth: 12, expYear: 2028, savedAt: '2026-09-10T00:00:00.000Z' },
    chargeMandate: 'I authorise the property to keep this card on file and to charge it after check-out, up to USD 500.00.',
    claims: [],
    ...patch,
  }
}

function build(patch: { claim?: Partial<ProtectionClaim>, protection?: Partial<DamageProtection>, photos?: { url: string, caption: string, dataUrl?: string }[] } = {}) {
  return buildClaimEvidencePdf({
    reservation: RESERVATION,
    protection: deposit(patch.protection),
    claim: claim(patch.claim),
    photos: patch.photos ?? [],
    company: { companyName: 'Elev8 Bali' },
  })
}

const text = () => pdf.state.texts.join('\n')

describe('buildClaimEvidencePdf', () => {
  it('prints the claim, the guest and the stay', () => {
    build()
    expect(text()).toContain('Damage Claim Evidence')
    expect(text()).toContain('ELEV8 BALI')
    expect(text()).toContain('Priya Raman')
    expect(text()).toContain('priya@example.com')
    expect(text()).toContain('Cracked shower screen')
    expect(text()).toContain('Glass split from the bottom corner.')
    expect(text()).toContain('USD 180.00')
    expect(text()).toContain('Charged to card')
  })

  it('says when the guest was told, and says so plainly when they were not', () => {
    build()
    expect(pdf.state.texts.some(t => /24 Sept? 2026/.test(t))).toBe(true)
    pdf.state.texts = []
    build({ claim: { guestNotifiedAt: undefined } })
    expect(text()).toContain('Not yet. The guest has not been told about this claim.')
  })

  it('prints the saved card by its last four digits and the exact consent the guest gave', () => {
    build()
    expect(text()).toContain('Mastercard ending 5556, expires 12/28')
    expect(text()).toContain('"I authorise the property to keep this card on file and to charge it after check-out, up to USD 500.00."')
  })

  it('states a charge that went through, and one that was declined', () => {
    build({ protection: { state: 'deposit_charged', chargedAmount: 180, chargedAt: '2026-09-25T02:00:00.000Z' } })
    expect(text()).toMatch(/USD 180\.00 on 25 Sept? 2026/)
    pdf.state.texts = []
    build({ protection: { state: 'charge_failed', chargeFailureReason: 'Card declined by issuer' } })
    expect(text()).toContain('Declined: Card declined by issuer')
  })

  it('labels a waiver claim as paid by the waiver, with the cover', () => {
    build({ protection: { option: 'waiver', state: 'waiver_active', amount: 39, coverageCap: 2000, card: undefined, chargeMandate: undefined } })
    expect(text()).toContain('Paid by the waiver')
    expect(text()).toContain('Damage waiver, fee USD 39.00')
    expect(text()).toContain('USD 2\'000.00')
    expect(text()).not.toContain('Charge consent')
  })

  it('reports damage above the cover as invoiced separately', () => {
    build({ claim: { amount: 800, coveredAmount: 500, excessAmount: 300 } })
    expect(text()).toContain('USD 300.00, invoiced separately')
  })

  it('prints the cleaning report the claim came from, and the attached files', () => {
    build()
    expect(text()).toContain('Check-out cleaning')
    expect(text()).toContain('Made Surya')
    expect(text()).toContain('Clean shower, bath and basin')
    expect(text()).toContain('shower-screen.jpg')
    expect(text()).toContain('quote.pdf')
  })

  it('embeds each loaded photo in its own format, with its caption', () => {
    build({ photos: [
      { url: 'https://images.example/screen.jpg', caption: 'Check-out cleaning: Cracked shower screen', dataUrl: JPEG },
      { url: '/mock/evidence/tap.png', caption: 'Uploaded: tap.png', dataUrl: PNG },
    ] })
    expect(pdf.state.images).toEqual([{ dataUrl: JPEG, format: 'JPEG' }, { dataUrl: PNG, format: 'PNG' }])
    expect(text()).toContain('Photos (2)')
    expect(text()).toContain('Check-out cleaning: Cracked shower screen')
  })

  it('lists a photo it could not load instead of dropping it', () => {
    build({ photos: [
      { url: '/mock/evidence/shower-screen.jpg', caption: 'Uploaded: shower-screen.jpg' },
      { url: 'https://x/y.webp', caption: 'Uploaded: y.webp', dataUrl: 'data:image/webp;base64,AAAA' },
    ] })
    expect(pdf.state.images).toHaveLength(0)
    expect(text()).toContain('Uploaded: shower-screen.jpg. Could not be loaded into this file: /mock/evidence/shower-screen.jpg')
    expect(text()).toContain('Could not be loaded into this file: https://x/y.webp')
  })

  it('lists a photo jsPDF refuses rather than failing the whole file', () => {
    pdf.state.throwOnAddImage = true
    const blob = build({ photos: [{ url: 'https://x/a.jpg', caption: 'A', dataUrl: JPEG }] })
    expect(blob).toBeInstanceOf(Blob)
    expect(text()).toContain('Could not be loaded into this file: https://x/a.jpg')
  })

  it('paginates a claim with many photos and numbers the pages', () => {
    const photos = Array.from({ length: 12 }, (_, i) => ({ url: `https://x/${i}.jpg`, caption: `Photo ${i}`, dataUrl: JPEG }))
    build({ photos })
    expect(pdf.state.pages).toBeGreaterThan(1)
    expect(text()).toContain(`Page 1 of ${pdf.state.pages}`)
  })

  it('prints where the claim stands with the insurance partner', () => {
    build({
      protection: { option: 'waiver', state: 'waiver_active', amount: 39, coverageCap: 2000, card: undefined, chargeMandate: undefined },
      claim: { partnerClaim: {
        partnerId: 'p',
        partnerName: 'Demo Cover Partner',
        policyNumber: 'MP-2026-0001',
        currency: 'USD',
        claimedAmount: 80,
        deductible: 100,
        payoutAccountId: 'pay-1',
        payoutAccountName: 'Stripe Bali Main',
        status: 'paid',
        partnerClaimRef: 'PC-123',
        approvedAmount: 80,
        paidAmount: 80,
        payoutReference: 'TRF-9',
        events: [],
      } },
    })
    expect(text()).toContain('Insurance claim')
    expect(text()).toContain('Demo Cover Partner, policy MP-2026-0001')
    expect(text()).toContain('PC-123')
    expect(text()).toContain('Paid by partner')
    expect(text()).toContain('USD 80.00 (after the USD 100.00 deductible)')
    expect(text()).toContain('USD 80.00, ref TRF-9')
  })

  it('names the file after the guest and the claim, with nothing a file system rejects', () => {
    expect(claimEvidencePdfFilename({ guestName: 'Priya Raman' }, { label: 'Cracked screen / door: left' }))
      .toBe('Damage claim evidence - Priya Raman - Cracked screen door left.pdf')
  })
})

describe('claimPhotoSources', () => {
  it('takes the cleaning report photos first, then uploaded images, each once, and no documents', () => {
    const sources = claimPhotoSources(claim({
      evidenceUrls: ['/mock/evidence/tap.png', '/mock/evidence/quote.pdf', 'https://images.example/screen.jpg'],
    }))
    expect(sources.map(s => s.url)).toEqual(['https://images.example/screen.jpg', '/mock/evidence/tap.png'])
    expect(sources[0]!.caption).toBe('Check-out cleaning: Cracked shower screen')
  })
})

describe('loadEvidencePhotos', () => {
  function response(body: Blob, ok = true): Response {
    return { ok, blob: async () => body } as Response
  }

  it('turns a JPEG or PNG into a data URL the PDF can embed', async () => {
    const [photo] = await loadEvidencePhotos(
      [{ url: 'https://x/a.jpg', caption: 'A' }],
      async () => response(new Blob(['x'], { type: 'image/jpeg' })),
    )
    expect(photo!.dataUrl).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('leaves out the data URL for a missing file, another format, or a network error', async () => {
    const photos = await loadEvidencePhotos(
      [{ url: '/missing.jpg', caption: 'A' }, { url: '/a.webp', caption: 'B' }, { url: '/boom.jpg', caption: 'C' }],
      async (url) => {
        if (url === '/missing.jpg')
          return response(new Blob([]), false)
        if (url === '/a.webp')
          return response(new Blob(['x'], { type: 'image/webp' }))
        throw new Error('offline')
      },
    )
    expect(photos.map(p => p.dataUrl)).toEqual([undefined, undefined, undefined])
    expect(photos.map(p => p.caption)).toEqual(['A', 'B', 'C'])
  })
})
