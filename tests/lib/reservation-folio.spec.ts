import { describe, expect, it } from 'vitest'
import {
  buildFolioSummary,
  canDeleteFolioItem,
  canVoidFolioItem,
  createDefaultFolioItemDraft,
  filterFolioCatalogRows,
  folioActivityEvent,
  folioBookingTotal,
  folioCatalogRows,
  folioDraftFromCatalog,
  folioItemFromDraft,
  folioLineNet,
  folioLineService,
  folioLineTax,
  folioLineTotal,
  isFolioItemDraftValid,
  validateFolioItemDraft,
} from '~/components/reservations/data/folio'
import type { FolioItem } from '~/components/reservations/data/folio'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'

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

describe('folio state rules', () => {
  it('lets an unpaid item be removed but not voided', () => {
    const item = folioItem()

    expect(canDeleteFolioItem(item)).toBe(true)
    expect(canVoidFolioItem(item)).toBe(false)
  })

  it('lets a paid item be voided but not removed', () => {
    const item = folioItem({ status: 'paid', paidAt: '2026-09-09T11:00:00Z' })

    expect(canDeleteFolioItem(item)).toBe(false)
    expect(canVoidFolioItem(item)).toBe(true)
  })

  it('keeps a charge-to-room item removable, since it is still unpaid', () => {
    expect(canDeleteFolioItem(folioItem({ paymentMethod: 'room' }))).toBe(true)
  })

  it('allows neither action on a voided item', () => {
    const item = folioItem({ status: 'voided', voidReason: 'duplicate' })

    expect(canDeleteFolioItem(item)).toBe(false)
    expect(canVoidFolioItem(item)).toBe(false)
  })
})

describe('validateFolioItemDraft', () => {
  it('accepts a complete draft', () => {
    const draft = { ...createDefaultFolioItemDraft(), label: 'Minibar - Beer', quantity: 2, unitPrice: 6 }

    expect(validateFolioItemDraft(draft)).toEqual({})
    expect(isFolioItemDraftValid(draft)).toBe(true)
  })

  it('rejects a blank or whitespace label', () => {
    const draft = { ...createDefaultFolioItemDraft(), label: '   ', unitPrice: 6 }

    expect(validateFolioItemDraft(draft).label).toBeTruthy()
  })

  it('rejects a quantity below one and a price at or below zero', () => {
    const draft = { ...createDefaultFolioItemDraft(), label: 'Laundry', quantity: 0, unitPrice: 0 }
    const errors = validateFolioItemDraft(draft)

    expect(errors.quantity).toBeTruthy()
    expect(errors.unitPrice).toBeTruthy()
  })

  it('rejects percentages outside 0 to 100', () => {
    const draft = { ...createDefaultFolioItemDraft(), label: 'Spa', unitPrice: 80, taxPercent: 120, servicePercent: -1 }
    const errors = validateFolioItemDraft(draft)

    expect(errors.taxPercent).toBeTruthy()
    expect(errors.servicePercent).toBeTruthy()
  })
})

describe('folioDraftFromCatalog', () => {
  const service = mockUpsellServices.find(s => s.id === 'svc-001')!
  const item = service.items[0]!

  it('copies the price and both percentages when the currency matches', () => {
    const draft = folioDraftFromCatalog(service, item, 'IDR')

    expect(draft.unitPrice).toBe(item.price)
    expect(draft.taxPercent).toBe(service.taxPercent)
    expect(draft.servicePercent).toBe(service.servicePercent)
    expect(draft.source).toBe('catalog')
    expect(draft.catalogServiceId).toBe('svc-001')
    expect(draft.catalogItemId).toBe(item.id)
    expect(draft.label).toContain(service.name)
    expect(draft.label).toContain(item.name)
  })

  it('leaves the price empty across currencies rather than inventing a rate', () => {
    const draft = folioDraftFromCatalog(service, item, 'USD')

    expect(draft.unitPrice).toBe(0)
    // The percentages still transfer; only the amount needs a human.
    expect(draft.taxPercent).toBe(service.taxPercent)
  })

  it('leaves the price empty when the service does not price its items', () => {
    const draft = folioDraftFromCatalog({ ...service, pricingEnabled: false }, item, 'IDR')

    expect(draft.unitPrice).toBe(0)
    expect(draft.taxPercent).toBe(0)
    expect(draft.servicePercent).toBe(0)
  })
})

describe('folioItemFromDraft', () => {
  it('posts an unpaid item stamped with the actor', () => {
    const draft = { ...createDefaultFolioItemDraft(), label: '  Minibar - Beer  ', quantity: 2, unitPrice: 6 }
    const item = folioItemFromDraft(draft, 'Komang Juliantara', '2026-09-09T10:00:00Z')

    expect(item.label).toBe('Minibar - Beer')
    expect(item.status).toBe('unpaid')
    expect(item.paidAt).toBeUndefined()
    expect(item.addedBy).toBe('Komang Juliantara')
    expect(item.addedAt).toBe('2026-09-09T10:00:00Z')
    expect(item.id).toBeTruthy()
  })

  it('gives each posting its own id', () => {
    const draft = { ...createDefaultFolioItemDraft(), label: 'Beer', unitPrice: 6 }

    expect(folioItemFromDraft(draft, 'A').id).not.toBe(folioItemFromDraft(draft, 'A').id)
  })

  it('snapshots the catalog price so a later price change cannot rewrite it', () => {
    const service = { ...mockUpsellServices.find(s => s.id === 'svc-001')! }
    const catalogItem = { ...service.items[0]! }
    const draft = folioDraftFromCatalog(service, catalogItem, 'IDR')
    const posted = folioItemFromDraft(draft, 'Komang Juliantara')

    catalogItem.price = 999999
    service.taxPercent = 50

    expect(posted.unitPrice).toBe(350000)
    expect(posted.taxPercent).toBe(11)
  })
})

describe('folioCatalogRows', () => {
  it('lists items of active services offered at the property, by listing name', () => {
    const rows = folioCatalogRows(mockUpsellServices, 'The R Pererenan Mezzanine Studio + Plunge Pool', 'IDR')

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => row.itemId && row.serviceName)).toBe(true)
    // svc-002 is assigned to five other villas only.
    expect(rows.some(row => row.serviceId === 'svc-002')).toBe(false)
  })

  it('returns nothing for a property no service is assigned to', () => {
    expect(folioCatalogRows(mockUpsellServices, 'Villa Nowhere', 'IDR')).toEqual([])
  })

  it('skips inactive services', () => {
    const services = mockUpsellServices.map(s => ({ ...s, status: 'inactive' as const }))

    expect(folioCatalogRows(services, 'The R Pererenan Mezzanine Studio + Plunge Pool', 'IDR')).toEqual([])
  })

  it('flags a row whose price cannot be used as-is on this folio', () => {
    const same = folioCatalogRows(mockUpsellServices, 'The R Pererenan Mezzanine Studio + Plunge Pool', 'IDR')
    const across = folioCatalogRows(mockUpsellServices, 'The R Pererenan Mezzanine Studio + Plunge Pool', 'USD')

    expect(same.every(row => row.needsPrice === false)).toBe(true)
    expect(across.every(row => row.needsPrice === true)).toBe(true)
    // The catalog is still offered across currencies, not hidden.
    expect(across.length).toBe(same.length)
  })

  it('matches the query against service name, item name and description', () => {
    const rows = folioCatalogRows(mockUpsellServices, 'The R Pererenan Mezzanine Studio + Plunge Pool', 'IDR')

    expect(filterFolioCatalogRows(rows, 'sedan').length).toBe(1)
    expect(filterFolioCatalogRows(rows, 'AIRPORT').length).toBeGreaterThan(0)
    expect(filterFolioCatalogRows(rows, '')).toEqual(rows)
  })
})

describe('folioActivityEvent', () => {
  it('records a posting with the actor, the label and the amount', () => {
    const item = folioItem({ quantity: 2, unitPrice: 6 })
    const event = folioActivityEvent('added', item, 'Komang Juliantara', 'USD', '2026-09-09T10:00:00Z')

    expect(event.type).toBe('reservation')
    expect(event.actor).toBe('Komang Juliantara')
    expect(event.timestamp).toBe('2026-09-09T10:00:00Z')
    expect(event.title).toBe('Folio item added')
    expect(event.description).toContain('Minibar - Beer')
    expect(event.description).toContain('12')
    expect(event.id).toBeTruthy()
  })

  it('names the payment method when money is collected', () => {
    const item = folioItem({ status: 'paid', paymentMethod: 'cash', paidAt: '2026-09-09T11:00:00Z' })
    const event = folioActivityEvent('paid', item, 'Komang Juliantara', 'USD')

    expect(event.title).toBe('Folio item paid')
    expect(event.description).toContain('Cash')
    expect(event.colorDot).toBe('green')
  })

  it('carries the reason when an item is voided', () => {
    const item = folioItem({ status: 'voided', voidReason: 'charged twice' })
    const event = folioActivityEvent('voided', item, 'Komang Juliantara', 'USD')

    expect(event.title).toBe('Folio item voided')
    expect(event.description).toContain('charged twice')
  })

  it('says the charge was deferred rather than collected', () => {
    const item = folioItem({ paymentMethod: 'room' })
    const event = folioActivityEvent('deferred', item, 'Komang Juliantara', 'USD')

    expect(event.title).toBe('Folio item charged to room')
  })
})
