// The Modify menu's two focused actions: moving a stay's check-in time and
// extending its check-out. Both write through useReservationsModule, so the
// rules live here rather than in the dialogs.

import type { ReservationEntry, ReservationRoomLine } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'
import { useReservationsModule } from '~/composables/useReservationsModule'

function stay(over: Partial<ReservationEntry> = {}): ReservationEntry {
  return {
    ...initialReservations[0]!,
    id: 'res-test-1',
    listingId: 'lst-1',
    checkIn: '2030-03-01',
    checkOut: '2030-03-04',
    nights: 3,
    totalPrice: 600,
    currency: 'USD',
    status: 'verified',
    rooms: undefined,
    priceDetails: undefined,
    checkInTime: undefined,
    checkOutTime: undefined,
    activity: [],
    ...over,
  }
}

function room(over: Partial<ReservationRoomLine> = {}): ReservationRoomLine {
  return {
    id: 'line-1',
    unitTypeId: 'ut-1',
    unitId: 'unit-a',
    unitName: 'Room A',
    ratePlanId: 'rp-1',
    rateLabel: 'Standard',
    pricePerNight: 100,
    lineTotal: 300,
    ...over,
  }
}

function seed(...entries: ReservationEntry[]) {
  const { reservations } = useReservationsModule()
  reservations.value = entries
}

function find(id = 'res-test-1') {
  return useReservationsModule().reservations.value.find(r => r.id === id)!
}

describe('reservation time', () => {
  beforeEach(() => seed(stay()))

  it('falls back to the listing defaults when the stay has none', () => {
    const { getCheckInTime, getCheckOutTime, getListingCheckInTime, getListingCheckOutTime } = useReservationsModule()
    expect(getCheckInTime(find())).toBe(getListingCheckInTime('lst-1'))
    expect(getCheckOutTime(find())).toBe(getListingCheckOutTime('lst-1'))
  })

  it('stores an early check-in and a late check-out, logged on the timeline', () => {
    const { updateReservationTimes, getCheckInTime, getCheckOutTime } = useReservationsModule()
    expect(updateReservationTimes('res-test-1', { checkInTime: '10:30', checkOutTime: '15:00' }).success).toBe(true)
    expect(getCheckInTime(find())).toBe('10:30')
    expect(getCheckOutTime(find())).toBe('15:00')
    expect(find().activity.at(-1)?.title).toBe('Reservation time changed')
    expect(find().activity.at(-1)?.description).toContain('check-out')
  })

  it('clears an override set back to the listing default', () => {
    const { updateReservationTimes, getListingCheckInTime } = useReservationsModule()
    updateReservationTimes('res-test-1', { checkInTime: '10:30' })
    updateReservationTimes('res-test-1', { checkInTime: getListingCheckInTime('lst-1') })
    expect(find().checkInTime).toBeUndefined()
  })

  it('logs nothing when nothing changed', () => {
    const { updateReservationTimes, getCheckInTime } = useReservationsModule()
    updateReservationTimes('res-test-1', { checkInTime: getCheckInTime(find()) })
    expect(find().activity).toHaveLength(0)
  })

  it('rejects a malformed time', () => {
    expect(useReservationsModule().updateReservationTimes('res-test-1', { checkOutTime: '25:00' }).success).toBe(false)
  })

  it('still allows a late check-out once checked in, but not a new check-in time', () => {
    seed(stay({ status: 'checked_in' }))
    const { updateReservationTimes } = useReservationsModule()
    expect(updateReservationTimes('res-test-1', { checkInTime: '10:00' }).success).toBe(false)
    expect(updateReservationTimes('res-test-1', { checkOutTime: '15:00' }).success).toBe(true)
    expect(find().checkOutTime).toBe('15:00')
  })

  it('locks both once the stay is over', () => {
    seed(stay({ status: 'checked_out' }))
    expect(useReservationsModule().updateReservationTimes('res-test-1', { checkOutTime: '15:00' }).success).toBe(false)
  })
})

describe('extend reservation', () => {
  it('prices a stay without room lines at its average nightly rate', () => {
    seed(stay())
    const { extendReservation } = useReservationsModule()
    expect(extendReservation('res-test-1', { checkOut: '2030-03-06' }).success).toBe(true)
    const r = find()
    expect(r.checkOut).toBe('2030-03-06')
    expect(r.nights).toBe(5)
    expect(r.totalPrice).toBe(1000)
    expect(r.activity.at(-1)?.title).toBe('Stay extended')
  })

  it('takes an overridden nightly rate', () => {
    seed(stay())
    useReservationsModule().extendReservation('res-test-1', { checkOut: '2030-03-05', nightlyRate: 150 })
    expect(find().totalPrice).toBe(750)
  })

  it('moves subtotal, guestPaid and payout but never the folio-owned extras', () => {
    seed(stay({ priceDetails: { subtotal: 450, cleaningFee: 50, serviceFee: 50, tax: 50, extras: 20, guestPaid: 620, commission: 0, payout: 620 } }))
    useReservationsModule().extendReservation('res-test-1', { checkOut: '2030-03-05' })
    const d = find().priceDetails!
    expect(d.subtotal).toBe(600)
    expect(d.guestPaid).toBe(770)
    expect(d.payout).toBe(770)
    expect(d.extras).toBe(20)
  })

  it('grows per-night room lines and leaves flat-rate lines alone', () => {
    seed(stay({
      totalPrice: 500,
      rooms: [room(), room({ id: 'line-2', unitId: 'unit-b', priceMode: 'per_stay', pricePerStay: 200, lineTotal: 200 })],
    }))
    useReservationsModule().extendReservation('res-test-1', { checkOut: '2030-03-06', nightlyRate: 999 })
    const r = find()
    expect(r.rooms![0]!.lineTotal).toBe(500)
    expect(r.rooms![1]!.lineTotal).toBe(200)
    expect(r.totalPrice).toBe(700)
  })

  it('is blocked when another stay holds the added nights', () => {
    seed(stay(), stay({ id: 'res-next', guestName: 'Next Guest', checkIn: '2030-03-05', checkOut: '2030-03-08' }))
    const { extendReservation, getExtensionConflicts } = useReservationsModule()
    expect(getExtensionConflicts('res-test-1', '2030-03-05')).toHaveLength(0)
    expect(getExtensionConflicts('res-test-1', '2030-03-06').map(r => r.id)).toEqual(['res-next'])
    expect(extendReservation('res-test-1', { checkOut: '2030-03-06' }).success).toBe(false)
    expect(find().checkOut).toBe('2030-03-04')
  })

  it('ignores cancelled stays and other units of a room-line booking', () => {
    seed(
      stay({ rooms: [room()] }),
      stay({ id: 'res-cancelled', status: 'cancelled', checkIn: '2030-03-04', checkOut: '2030-03-10' }),
      stay({ id: 'res-other-unit', checkIn: '2030-03-04', checkOut: '2030-03-10', rooms: [room({ unitId: 'unit-b' })] }),
    )
    expect(useReservationsModule().getExtensionConflicts('res-test-1', '2030-03-07')).toHaveLength(0)
  })

  it('refuses a cancelled stay and a date that is not later', () => {
    seed(stay({ status: 'cancelled' }), stay({ id: 'res-ok' }))
    const { extendReservation } = useReservationsModule()
    expect(extendReservation('res-test-1', { checkOut: '2030-03-06' }).success).toBe(false)
    expect(extendReservation('res-ok', { checkOut: '2030-03-04' }).success).toBe(false)
  })
})
