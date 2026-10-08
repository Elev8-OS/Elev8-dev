import { describe, expect, it } from 'vitest'
import { initialGuests, initialReservations } from '~/components/reservations/data/reservations'
import { stayExtensionDemoReservations } from '~/components/reservations/data/stay-extension-demo'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { nightsInPeriod } from '~/lib/reservation-period'

const byId = (id: string) => stayExtensionDemoReservations.find(r => r.id === id)!

describe('stay extension demo seed', () => {
  it('is part of the reservations seed, with guest profiles', () => {
    for (const r of stayExtensionDemoReservations) {
      expect(initialReservations.some(x => x.id === r.id)).toBe(true)
      expect(initialGuests.some(g => g.id === r.guestId)).toBe(true)
    }
  })

  it('every linked booking matches the extension that created it', () => {
    for (const r of stayExtensionDemoReservations) {
      for (const ext of r.extensions ?? []) {
        if (!ext.linkedReservationId)
          continue
        const linked = byId(ext.linkedReservationId)
        expect(linked.extensionOf).toBe(r.id)
        expect(linked.channel).toBe('Direct')
        expect(linked.status).toBe(r.status)
        expect([linked.checkIn, linked.checkOut]).toEqual([ext.previousCheckOut, ext.newCheckOut])
        expect(linked.nights).toBe(ext.extraNights)
        expect(linked.totalPrice).toBe(ext.amount)
        expect(linked.priceDetails!.guestPaid).toBe(ext.paymentStatus === 'paid' ? ext.amount : 0)
      }
    }
  })

  it('in-place extensions moved the stay the way extendReservation does', () => {
    for (const id of ['res-ext-direct-paid', 'res-ext-direct-pending']) {
      const r = byId(id)
      const ext = r.extensions![0]!
      const pd = r.priceDetails!
      expect(r.checkOut).toBe(ext.newCheckOut)
      expect(ext.amount).toBe(ext.nightlyRate * ext.extraNights)
      expect(r.totalPrice).toBe(pd.subtotal + pd.cleaningFee)
      expect(pd.guestPaid).toBe(ext.paymentStatus === 'paid' ? r.totalPrice : r.totalPrice - ext.amount)
    }
  })

  it('the month-crossing stay puts its added nights in next month', () => {
    const r = byId('res-ext-direct-paid')
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const nextMonth = { from: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`, to: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-28` }
    expect(nightsInPeriod(r, nextMonth)).toBe(2)
    expect(nightsInPeriod(r, { from: '', to: '' })).toBe(5)
  })

  it('no demo stay overlaps another stay on its listing', () => {
    for (const r of stayExtensionDemoReservations) {
      const clash = initialReservations.find(x =>
        x.id !== r.id
        && x.listingId === r.listingId
        && x.status !== 'cancelled'
        && x.extensionOf !== r.id
        && r.extensionOf !== x.id
        && !(r.extensionOf && x.extensionOf === r.extensionOf)
        && x.checkIn < r.checkOut && r.checkIn < x.checkOut,
      )
      expect(clash?.id).toBeUndefined()
    }
  })

  it('feeds the Extended and Unpaid extension filters', () => {
    const { filters, filteredReservations } = useReservationsModule()
    filters.value.extension = 'extended'
    const extended = filteredReservations.value.map(r => r.id)
    for (const r of stayExtensionDemoReservations)
      expect(extended).toContain(r.id)

    filters.value.extension = 'unpaid'
    const unpaid = filteredReservations.value.map(r => r.id)
    expect(unpaid).toEqual(expect.arrayContaining(['res-ext-direct-pending', 'res-ext-bdc', 'res-ext-bdc-x2']))
    expect(unpaid).not.toContain('res-ext-direct-paid')
    expect(unpaid).not.toContain('res-ext-airbnb')
    expect(unpaid).not.toContain('res-ext-bdc-x1')
  })
})
