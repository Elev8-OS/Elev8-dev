import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultFolioItemDraft } from '~/components/reservations/data/folio'
import { useReservationFolio } from '~/composables/useReservationFolio'
import { useReservationsModule } from '~/composables/useReservationsModule'

/** res-3 is the in-house USD stay carrying the seeded folio. */
const RES = 'res-3'

function draft(over: Record<string, unknown> = {}) {
  return { ...createDefaultFolioItemDraft(), label: 'Minibar - Beer', quantity: 2, unitPrice: 6, ...over }
}

function reservation() {
  return useReservationsModule().reservations.value.find(r => r.id === RES)!
}

describe('useReservationFolio', () => {
  beforeEach(() => {
    // tests/setup.ts clears the useState store between tests, so each test
    // starts from the seeded reservations.
    useReservationsModule()
  })

  it('posts an unpaid item onto the reservation', () => {
    const folio = useReservationFolio()
    const before = folio.itemsFor(RES).length

    const posted = folio.addItem(RES, draft())

    expect(posted).not.toBeNull()
    expect(folio.itemsFor(RES)).toHaveLength(before + 1)
    expect(folio.itemsFor(RES).at(-1)!.status).toBe('unpaid')
  })

  it('stamps the posting with the current dashboard user', () => {
    const folio = useReservationFolio()

    folio.addItem(RES, draft())

    expect(folio.itemsFor(RES).at(-1)!.addedBy).toBe('Komang Juliantara')
  })

  it('writes exactly one activity entry per posting', () => {
    const folio = useReservationFolio()
    const before = reservation().activity.length

    folio.addItem(RES, draft())

    expect(reservation().activity).toHaveLength(before + 1)
    // Appended, not prepended: every seeded activity array is oldest-first.
    expect(reservation().activity.at(-1)!.title).toBe('Folio item added')
  })

  it('refuses an invalid draft without touching the reservation', () => {
    const folio = useReservationFolio()
    const items = folio.itemsFor(RES).length
    const activity = reservation().activity.length

    expect(folio.addItem(RES, draft({ label: '  ', unitPrice: 0 }))).toBeNull()
    expect(folio.itemsFor(RES)).toHaveLength(items)
    expect(reservation().activity).toHaveLength(activity)
  })

  it('refuses to post onto a cancelled reservation', () => {
    const folio = useReservationFolio()
    const cancelled = useReservationsModule().reservations.value.find(r => r.status === 'cancelled')!

    expect(folio.canPostTo(cancelled.id)).toBe(false)
    expect(folio.addItem(cancelled.id, draft())).toBeNull()
  })

  it('marks an item paid and drops it out of the balance', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!
    const owed = folio.summaryFor(RES)!.itemsBalance

    folio.markPaid(RES, posted.id, 'cash')

    const item = folio.itemsFor(RES).find(i => i.id === posted.id)!
    expect(item.status).toBe('paid')
    expect(item.paymentMethod).toBe('cash')
    expect(item.paidAt).toBeTruthy()
    // The draft carries no tax, so a 2 x 6 line is 12.
    expect(folio.summaryFor(RES)!.itemsBalance).toBe(Math.round((owed - 12) * 100) / 100)
  })

  it('leaves a charge-to-room item unpaid and still owing', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!
    const owed = folio.summaryFor(RES)!.itemsBalance

    folio.markPaid(RES, posted.id, 'room')

    const item = folio.itemsFor(RES).find(i => i.id === posted.id)!
    expect(item.status).toBe('unpaid')
    expect(item.paymentMethod).toBe('room')
    expect(item.paidAt).toBeUndefined()
    expect(folio.summaryFor(RES)!.itemsBalance).toBe(owed)
  })

  it('removes an unpaid item outright', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!

    folio.deleteItem(RES, posted.id)

    expect(folio.itemsFor(RES).some(i => i.id === posted.id)).toBe(false)
    expect(reservation().activity.at(-1)!.title).toBe('Folio item removed')
  })

  it('will not remove a paid item', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!
    folio.markPaid(RES, posted.id, 'card')

    folio.deleteItem(RES, posted.id)

    expect(folio.itemsFor(RES).some(i => i.id === posted.id)).toBe(true)
  })

  it('voids a paid item with a reason and raises a refund due', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!
    folio.markPaid(RES, posted.id, 'card')
    const refundBefore = folio.summaryFor(RES)!.refundDue

    folio.voidItem(RES, posted.id, '  charged twice  ')

    const item = folio.itemsFor(RES).find(i => i.id === posted.id)!
    expect(item.status).toBe('voided')
    expect(item.voidReason).toBe('charged twice')
    expect(item.voidedBy).toBe('Komang Juliantara')
    expect(folio.summaryFor(RES)!.refundDue).toBe(Math.round((refundBefore + 12) * 100) / 100)
  })

  it('will not void without a reason, or void an unpaid item', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!

    folio.voidItem(RES, posted.id, '   ')
    expect(folio.itemsFor(RES).find(i => i.id === posted.id)!.status).toBe('unpaid')

    folio.markPaid(RES, posted.id, 'cash')
    folio.voidItem(RES, posted.id, '')
    expect(folio.itemsFor(RES).find(i => i.id === posted.id)!.status).toBe('paid')

    // A genuinely unpaid item, even with a valid reason, is not voidable: only removed.
    const secondPosted = folio.addItem(RES, draft({ label: 'Laundry' }))!
    folio.voidItem(RES, secondPosted.id, 'Charged twice')
    expect(folio.itemsFor(RES).find(i => i.id === secondPosted.id)!.status).toBe('unpaid')
  })

  it('keeps priceDetails.extras, guestPaid and payout in step with the folio', () => {
    const folio = useReservationFolio()
    const before = reservation().priceDetails!

    folio.addItem(RES, draft())

    const after = reservation().priceDetails!
    const summary = folio.summaryFor(RES)!
    expect(after.extras).toBe(summary.itemsTotal)
    // guestPaid moves by the change in extras, not by the whole extras total.
    const delta = Math.round((after.extras - before.extras) * 100) / 100
    expect(after.guestPaid).toBe(Math.round((before.guestPaid + delta) * 100) / 100)
    // Desk extras carry no OTA commission, so payout moves by the same delta
    // as guestPaid and commission is untouched.
    expect(after.payout).toBe(Math.round((before.payout + delta) * 100) / 100)
    expect(after.commission).toBe(before.commission)
    // The invariant a refactor that recomputed absolutely (instead of by
    // delta) would still pass here, since addItem's delta is the only write
    // so far. It is the two writes below that would catch such a refactor.
    expect(after.payout).toBe(Math.round((after.guestPaid - after.commission) * 100) / 100)
  })

  it('keeps payout = guestPaid - commission after markPaid, which patches through the same delta path', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!

    folio.markPaid(RES, posted.id, 'cash')

    const { guestPaid, commission, payout } = reservation().priceDetails!
    expect(payout).toBe(Math.round((guestPaid - commission) * 100) / 100)
  })

  it('keeps payout = guestPaid - commission after voidItem, the other delta exit path', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!
    folio.markPaid(RES, posted.id, 'card')

    folio.voidItem(RES, posted.id, 'charged twice')

    const { guestPaid, commission, payout } = reservation().priceDetails!
    expect(payout).toBe(Math.round((guestPaid - commission) * 100) / 100)
  })

  it('will not re-defer an item already charged to room', () => {
    const folio = useReservationFolio()
    const posted = folio.addItem(RES, draft())!
    const activityBefore = reservation().activity.length

    folio.markPaid(RES, posted.id, 'room')
    const afterFirst = reservation().activity.length
    expect(afterFirst).toBe(activityBefore + 1)

    // A second "Charge to room" on the same item is a no-op: no new item
    // state, no duplicate activity entry.
    folio.markPaid(RES, posted.id, 'room')

    const item = folio.itemsFor(RES).find(i => i.id === posted.id)!
    expect(item.status).toBe('unpaid')
    expect(item.paymentMethod).toBe('room')
    expect(reservation().activity.length).toBe(afterFirst)
  })

  it('offers the catalog rows for the reservation property and currency', () => {
    const folio = useReservationFolio()
    const rows = folio.catalogRowsFor(RES)

    expect(rows.length).toBeGreaterThan(0)
    // res-3 is USD while the seeded services are IDR, so every price needs a human.
    expect(rows.every(row => row.needsPrice)).toBe(true)
  })

  it('never writes to the upsell catalog', () => {
    const folio = useReservationFolio()
    const { services } = useUpsellServices()
    const snapshot = JSON.stringify(services.value)

    folio.addItem(RES, draft({ source: 'catalog', catalogServiceId: 'svc-001', catalogItemId: 'itm-001a' }))

    expect(JSON.stringify(services.value)).toBe(snapshot)
  })
})
