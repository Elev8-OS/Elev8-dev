import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildFolioSummary } from '~/components/reservations/data/folio'
import { initialReservations } from '~/components/reservations/data/reservations'
import { buildFolioInvoicePdf, buildInvoiceRoomRows } from '~/lib/folio-invoice-pdf'

describe('buildFolioInvoicePdf', () => {
  it('generates an A4 PDF matching the new receipt layout', async () => {
    const reservation = initialReservations.find(r => r.id === 'res-1') || initialReservations[0]!
    const blob = buildFolioInvoicePdf(reservation, { download: false })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(500)

    const buffer = Buffer.from(await blob.arrayBuffer())
    fs.writeFileSync('/tmp/real-reservation-invoice.pdf', buffer)
    expect(fs.existsSync('/tmp/real-reservation-invoice.pdf')).toBe(true)
  })

  it('renders Airbnb stay + on-site paid extras with accurate multi-payment breakdown', async () => {
    const base = initialReservations.find(r => r.id === 'res-1')!
    const reservationWithExtras = {
      ...base,
      folioItems: [
        {
          id: 'fol-1',
          label: 'Airport Transfer (Ngurah Rai) · Standard Sedan',
          quantity: 1,
          unitPrice: 12.6,
          taxPercent: 10,
          servicePercent: 0,
          status: 'paid' as const,
          paymentMethod: 'cash' as const,
          paidAt: '2026-07-11T10:00:00Z',
          paidAmount: 13.92,
          source: 'custom' as const,
          addedBy: 'Komang Juliantara',
          addedAt: '2026-07-11T09:00:00Z',
        },
        {
          id: 'fol-2',
          label: 'Private Chef - Dinner · Seafood BBQ',
          quantity: 1,
          unitPrice: 31.5,
          taxPercent: 10,
          servicePercent: 0,
          status: 'paid' as const,
          paymentMethod: 'cash' as const,
          paidAt: '2026-07-12T19:00:00Z',
          paidAmount: 34.8,
          source: 'custom' as const,
          addedBy: 'Komang Juliantara',
          addedAt: '2026-07-12T18:00:00Z',
        },
      ],
    }

    const blob = buildFolioInvoicePdf(reservationWithExtras, { download: false })
    const buffer = Buffer.from(await blob.arrayBuffer())
    fs.writeFileSync('/tmp/airbnb-with-extras-invoice.pdf', buffer)
    expect(fs.existsSync('/tmp/airbnb-with-extras-invoice.pdf')).toBe(true)
  })

  it('renders folio extra items, notes, voided lines and balances correctly', async () => {
    const reservation = initialReservations.find(r => r.id === 'res-3')!
    const blob = buildFolioInvoicePdf(reservation, { download: false })
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(500)

    const buffer = Buffer.from(await blob.arrayBuffer())
    fs.writeFileSync('/tmp/real-reservation-res3-invoice.pdf', buffer)
    expect(fs.existsSync('/tmp/real-reservation-res3-invoice.pdf')).toBe(true)
  })

  it('supports custom options (companyName, taxId, etc.)', async () => {
    const reservation = initialReservations[1]!
    const blob = buildFolioInvoicePdf(reservation, {
      download: false,
      companyName: 'BALI VILLA ESCAPES',
      taxId: 'NPWP 12.345.678.9-001.000',
      bankAccountName: 'Bali Villa Escapes PT',
      bankNameOrBsb: 'BCA 987654',
    })
    expect(blob.size).toBeGreaterThan(500)
  })

  it('automatically applies the template assigned to the reservation listing', async () => {
    // res-1 is on listing-1 which is assigned to Elevate Schweiz GmbH
    const res1 = { ...initialReservations[0]!, listingId: 'listing-1' }
    const blob1 = buildFolioInvoicePdf(res1, { download: false })
    expect(blob1.size).toBeGreaterThan(500)

    // res-bali on listing-11 which is assigned to PT Elev8 Bali Mandiri
    const resBali = { ...initialReservations[0]!, listingId: 'listing-11' }
    const blobBali = buildFolioInvoicePdf(resBali, { download: false })
    expect(blobBali.size).toBeGreaterThan(500)
  })

  describe('multi-room booking', () => {
    const multi = () => initialReservations.find(r => r.id === 'res-multi-1')!

    it('lists one row per room, then the billable charges, adding up to the booking total', () => {
      const reservation = multi()
      const rows = buildInvoiceRoomRows(reservation)

      expect(rows.slice(0, 3).map(r => r.title.split(' - ')[0])).toEqual(['Master Suite', 'Pool Unit', 'Loft Unit'])
      expect(rows.map(r => r.title)).toEqual(expect.arrayContaining(['Cleaning Fee', 'City Tax']))
      const sum = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100
      expect(sum).toBe(buildFolioSummary(reservation).bookingTotal)
    })

    it('skips inclusive charges and adds the payment charge row', () => {
      const reservation = {
        ...multi(),
        charges: [{ id: 'c1', kind: 'cleaning' as const, label: 'Cleaning Fee', amount: 85, inclusive: true }],
        paymentFeeMode: 'card' as const,
      }
      const rows = buildInvoiceRoomRows(reservation)
      expect(rows.map(r => r.title)).not.toContain('Cleaning Fee')
      expect(rows.at(-1)?.title).toBe('Payment charge')
    })

    it('has no room rows for a stay without room lines, which keeps the Accommodation row', () => {
      expect(buildInvoiceRoomRows({ ...multi(), rooms: undefined })).toEqual([])
    })

    it('still builds the PDF', () => {
      const blob = buildFolioInvoicePdf(multi(), { download: false })
      expect(blob.type).toBe('application/pdf')
      expect(blob.size).toBeGreaterThan(500)
    })
  })
})
