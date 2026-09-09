import { describe, expect, it } from 'vitest'
import {
  buildFolioSummary,
  folioBookingTotal,
  folioLineNet,
  folioLineService,
  folioLineTax,
  folioLineTotal,
} from '~/components/reservations/data/folio'
import type { FolioItem } from '~/components/reservations/data/folio'
import type { ReservationEntry } from '~/components/reservations/data/reservations'

/** A priceable line. Only the four pricing fields are needed. */
function line(over: Partial<{ quantity: number, unitPrice: number, taxPercent: number, servicePercent: number }> = {}) {
  return { quantity: 1, unitPrice: 0, taxPercent: 0, servicePercent: 0, ...over }
}

/** A reservation carrying only what the folio reads. */
function reservation(over: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    id: 'res-test',
    guestId: 'guest-test',
    guestName: 'Test Guest',
    guestEmail: 't@example.com',
    guestPhone: '+10000000000',
    guestLanguage: 'English',
    guestNotes: '',
    listingId: 'lst-2',
    listingName: 'The R Pererenan Mezzanine Studio + Plunge Pool',
    channel: 'Direct',
    checkIn: '2026-09-08',
    checkOut: '2026-09-12',
    nights: 4,
    guestCount: 2,
    totalPrice: 640,
    currency: 'USD',
    status: 'checked_in',
    activity: [],
    ...over,
  }
}

function folioItem(over: Partial<FolioItem> = {}): FolioItem {
  return {
    id: 'fol-test',
    label: 'Minibar - Beer',
    quantity: 1,
    unitPrice: 6,
    taxPercent: 0,
    servicePercent: 0,
    source: 'custom',
    status: 'unpaid',
    addedBy: 'Komang Juliantara',
    addedAt: '2026-09-09T10:00:00Z',
    ...over,
  }
}

describe('folio line arithmetic', () => {
  it('multiplies quantity by unit price for the net', () => {
    expect(folioLineNet(line({ quantity: 2, unitPrice: 6 }))).toBe(12)
  })

  it('applies tax and service to the net in parallel, never compounded', () => {
    const item = line({ quantity: 1, unitPrice: 100, taxPercent: 11, servicePercent: 5 })

    expect(folioLineTax(item)).toBe(11)
    expect(folioLineService(item)).toBe(5)
    // Compounding would make this 116.55 instead of 116.
    expect(folioLineTotal(item)).toBe(116)
  })

  it('rounds to the currency minor unit, not the whole unit', () => {
    // A CHF 6.00 beer at 10 percent owes 0.60, not 1.
    expect(folioLineTax(line({ quantity: 1, unitPrice: 6, taxPercent: 10 }))).toBe(0.6)
    expect(folioLineTotal(line({ quantity: 1, unitPrice: 6, taxPercent: 10 }))).toBe(6.6)
  })

  it('prices a whole-unit currency line without stray decimals', () => {
    const item = line({ quantity: 1, unitPrice: 350000, taxPercent: 11, servicePercent: 5 })

    expect(folioLineTotal(item)).toBe(406000)
  })

  it('treats a zero-percent line as its net', () => {
    expect(folioLineTotal(line({ quantity: 3, unitPrice: 4 }))).toBe(12)
  })
})

describe('folio booking total', () => {
  it('uses totalPrice when the reservation has no room lines', () => {
    expect(folioBookingTotal(reservation())).toBe(640)
  })

  it('folds room lines, charges and the card payment fee', () => {
    const r = reservation({
      totalPrice: 1000,
      paymentFeeMode: 'card',
      rooms: [
        { id: 'r1', unitTypeId: 'ut-1', unitId: 'un-1', unitName: 'Master Suite', ratePlanId: 'rp-1', rateLabel: 'Standard', pricePerNight: 100, lineTotal: 700 },
        { id: 'r2', unitTypeId: 'ut-1', unitId: 'un-2', unitName: 'Garden Room', ratePlanId: 'rp-1', rateLabel: 'Standard', pricePerNight: 75, lineTotal: 300 },
      ],
      charges: [
        { id: 'chg-1', kind: 'cleaning', label: 'Cleaning Fee', amount: 85 },
        { id: 'chg-2', kind: 'city_tax', label: 'City Tax', amount: 25 },
      ],
    })

    // 1000 rooms + 110 charges + 30 card fee
    expect(folioBookingTotal(r)).toBe(1140)
  })

  it('applies the custom percentage for a manual payment fee', () => {
    const r = reservation({
      paymentFeeMode: 'manual',
      paymentCustomFeePct: 1.5,
      rooms: [{ id: 'r1', unitTypeId: 'ut-1', unitId: 'un-1', unitName: 'Suite', ratePlanId: 'rp-1', rateLabel: 'Standard', pricePerNight: 100, lineTotal: 400 }],
    })

    expect(folioBookingTotal(r)).toBe(406)
  })
})

describe('buildFolioSummary', () => {
  it('reports zeros for extras when nothing has been posted', () => {
    const summary = buildFolioSummary(reservation())

    expect(summary.itemsTotal).toBe(0)
    expect(summary.itemsPaid).toBe(0)
    expect(summary.itemsBalance).toBe(0)
    expect(summary.refundDue).toBe(0)
    expect(summary.grandTotal).toBe(640)
  })

  it('adds live items to the grand total and leaves them owing', () => {
    const summary = buildFolioSummary(reservation({
      folioItems: [
        folioItem({ id: 'f1', quantity: 2, unitPrice: 6 }),
        folioItem({ id: 'f2', label: 'Laundry', unitPrice: 4 }),
      ],
    }))

    expect(summary.itemsTotal).toBe(16)
    expect(summary.grandTotal).toBe(656)
    expect(summary.itemsBalance).toBe(16)
  })

  it('counts a paid item as collected so it leaves the balance', () => {
    const summary = buildFolioSummary(reservation({
      folioItems: [
        folioItem({ id: 'f1', unitPrice: 12, status: 'paid', paymentMethod: 'cash', paidAt: '2026-09-09T11:00:00Z' }),
        folioItem({ id: 'f2', label: 'Laundry', unitPrice: 4 }),
      ],
    }))

    expect(summary.itemsTotal).toBe(16)
    expect(summary.itemsPaid).toBe(12)
    expect(summary.itemsBalance).toBe(4)
  })

  it('leaves a charge-to-room item owing, since nothing was collected', () => {
    const summary = buildFolioSummary(reservation({
      folioItems: [folioItem({ unitPrice: 18, paymentMethod: 'room' })],
    }))

    expect(summary.itemsPaid).toBe(0)
    expect(summary.itemsBalance).toBe(18)
  })

  it('drops a voided unpaid item out of the total with no refund', () => {
    const summary = buildFolioSummary(reservation({
      folioItems: [folioItem({ unitPrice: 18, status: 'voided', voidReason: 'wrong room' })],
    }))

    expect(summary.itemsTotal).toBe(0)
    expect(summary.voidedTotal).toBe(18)
    expect(summary.itemsBalance).toBe(0)
    expect(summary.refundDue).toBe(0)
  })

  it('turns a voided paid item into a refund due', () => {
    const summary = buildFolioSummary(reservation({
      folioItems: [folioItem({
        unitPrice: 18,
        status: 'voided',
        paymentMethod: 'cash',
        paidAt: '2026-09-09T11:00:00Z',
        voidReason: 'charged twice',
      })],
    }))

    expect(summary.itemsTotal).toBe(0)
    expect(summary.itemsPaid).toBe(18)
    expect(summary.itemsBalance).toBe(-18)
    expect(summary.refundDue).toBe(18)
  })
})
