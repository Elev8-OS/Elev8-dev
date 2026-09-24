import type { Booking } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import { resolveStayForCleaning } from '~/components/cleaning/data/cleaning-link'
import { allStays, bookingReservationStatus, mergedBookingsFor, reservationToBooking } from '~/components/operations-calendar/data/calendar-stays'
import { buildAllEvents, getCalendarListings } from '~/components/operations-calendar/data/operations-calendar'
import { damageProtectionDemoReservations } from '~/components/reservations/data/damage-protection-demo'

function res(patch: Partial<ReservationEntry> & Pick<ReservationEntry, 'id' | 'status'>): ReservationEntry {
  return {
    listingId: 'lst-1',
    listingName: 'Villa',
    guestName: 'Priya Raman',
    checkIn: '2026-11-01',
    checkOut: '2026-11-05',
    nights: 4,
    totalPrice: 1300,
    channel: 'Direct',
    guestAdults: 2,
    guestNotes: '',
    ...patch,
  } as ReservationEntry
}

const booking: Booking = { id: 'bk-1', guestName: 'Listing Guest', checkIn: '2026-10-20', checkOut: '2026-10-24', nights: 4, status: 'verified', revenue: 400, source: 'Airbnb' }

describe('reservationToBooking', () => {
  it('carries a guest stay across with its own status', () => {
    expect(reservationToBooking(res({ id: 'r1', status: 'checked_out' }))).toMatchObject({
      id: 'r1',
      type: 'reservation',
      status: 'checked_out',
      guestName: 'Priya Raman',
      checkIn: '2026-11-01',
      checkOut: '2026-11-05',
      revenue: 1300,
      source: 'Direct',
    })
  })

  it('draws an owner stay and a maintenance block as blocks, never as guests', () => {
    expect(reservationToBooking(res({ id: 'o', status: 'owner_request' }))).toMatchObject({ type: 'block', blockReason: 'Owner stay' })
    expect(reservationToBooking(res({ id: 'b', status: 'blocked', guestNotes: 'Pool pump' }))).toMatchObject({ type: 'block', blockReason: 'Pool pump' })
  })
})

describe('bookingReservationStatus', () => {
  it('reads an owner stay and a maintenance block back out of their blocks', () => {
    expect(bookingReservationStatus(reservationToBooking(res({ id: 'o', status: 'owner_request' })))).toBe('owner_request')
    expect(bookingReservationStatus(reservationToBooking(res({ id: 'b', status: 'blocked' })))).toBe('blocked')
  })

  it('passes a guest stay\'s own status through', () => {
    expect(bookingReservationStatus(reservationToBooking(res({ id: 'r', status: 'checked_in' })))).toBe('checked_in')
    expect(bookingReservationStatus(booking)).toBe('verified')
  })

  it('treats a listing block with any other reason as a maintenance block', () => {
    expect(bookingReservationStatus({ ...booking, type: 'block', blockReason: 'Pool deck resurfacing' })).toBe('blocked')
  })
})

describe('mergedBookingsFor', () => {
  it('puts both sources on the listing, by check-in, and only that listing\'s', () => {
    const merged = mergedBookingsFor('lst-1', [booking], [res({ id: 'r1', status: 'verified' }), res({ id: 'r2', status: 'verified', listingId: 'lst-2' })])
    expect(merged.map(b => b.id)).toEqual(['bk-1', 'r1'])
  })
})

describe('allStays', () => {
  it('treats a listing block as not a stay, and keeps a reservation\'s own status', () => {
    const block: Booking = { ...booking, id: 'blk', type: 'block' }
    const stays = allStays([{ id: 'lst-1', bookings: [booking, block] }], [res({ id: 'o', status: 'owner_request' })])
    expect(stays.find(s => s.id === 'blk')!.status).toBe('blocked')
    expect(stays.find(s => s.id === 'o')!.status).toBe('owner_request')
    expect(stays.map(s => s.origin).sort()).toEqual(['listing_booking', 'listing_booking', 'reservation'])
  })

  it('lets a cleaning link to a listing booking too, so the link matches what the calendar draws', () => {
    const stays = allStays([{ id: 'lst-1', bookings: [booking] }], [])
    expect(resolveStayForCleaning({ listingId: 'lst-1', scheduledAt: '2026-10-22T11:00:00+08:00' }, stays)?.id).toBe('bk-1')
  })
})

describe('the operations calendar', () => {
  const priya = damageProtectionDemoReservations.find(r => r.id === 'res-dp-unnotified')!

  it('shows a stay made on the Reservations page', () => {
    const events = buildAllEvents([], [priya])
    const stayNights = events.filter(e => e.type === 'guest_stay' && e.guestName === 'Priya Raman')
    expect(stayNights).toHaveLength(priya.nights)
    expect(getCalendarListings([priya]).find(l => l.id === 'lst-1')!.bookings.some(b => b.id === priya.id)).toBe(true)
  })

  it('shows only listing bookings when no reservations are passed, as before', () => {
    expect(getCalendarListings().find(l => l.id === 'lst-1')!.bookings.some(b => b.id === priya.id)).toBe(false)
  })
})
