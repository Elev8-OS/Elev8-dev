import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import { newReservationConflicts } from '~/composables/useReservationsModule'

// lst-1 is multi-unit with four rooms (un-1 to un-4); lst-5 is a single-unit villa.
function stay(id: string, over: Partial<ReservationEntry>): ReservationEntry {
  return {
    id,
    guestName: `Guest ${id}`,
    listingId: 'lst-5',
    checkIn: '2026-11-10',
    checkOut: '2026-11-13',
    status: 'verified',
    ...over,
  } as ReservationEntry
}

const draft = { listingId: 'lst-5', checkIn: '2026-11-12', checkOut: '2026-11-15' }

describe('newReservationConflicts', () => {
  it('flags any stay sharing a night on a single-unit listing', () => {
    const conflicts = newReservationConflicts(draft, [stay('a', {})])
    expect(conflicts).toEqual([expect.objectContaining({ reservationId: 'a', guestName: 'Guest a', unitNames: [] })])
  })

  it('ignores a stay that leaves on the check-in day, another listing, cancelled stays and non-blocking inquiries', () => {
    const conflicts = newReservationConflicts(draft, [
      stay('leaves', { checkOut: '2026-11-12' }),
      stay('other', { listingId: 'lst-1' }),
      stay('cancelled', { status: 'cancelled' }),
      stay('inquiry', { status: 'inquiry', blocksAvailability: false }),
    ])
    expect(conflicts).toEqual([])
  })

  it('counts blocks and inquiries that hold the dates', () => {
    const conflicts = newReservationConflicts(draft, [
      stay('block', { status: 'blocked' }),
      stay('inquiry', { status: 'inquiry', blocksAvailability: true }),
    ])
    expect(conflicts.map(c => c.reservationId)).toEqual(['block', 'inquiry'])
  })

  describe('multi-unit listing', () => {
    const multiDraft = { ...draft, listingId: 'lst-1' }

    it('flags a stay in the same room, by name', () => {
      const conflicts = newReservationConflicts({ ...multiDraft, unitIds: ['un-2'] }, [
        stay('same', { listingId: 'lst-1', assignedUnitIds: ['un-2'] }),
        stay('other-room', { listingId: 'lst-1', assignedUnitIds: ['un-3'] }),
      ])
      expect(conflicts).toEqual([expect.objectContaining({ reservationId: 'same', unitNames: ['Garden Unit'] })])
    })

    it('reads priced room lines as the rooms a stay takes', () => {
      const conflicts = newReservationConflicts({ ...multiDraft, unitIds: ['un-3'] }, [
        stay('lines', { listingId: 'lst-1', rooms: [{ unitId: 'un-3' } as never] }),
      ])
      expect(conflicts.map(c => c.reservationId)).toEqual(['lines'])
    })

    it('does not flag stays without a room while a room is still free', () => {
      const unroomed = ['x', 'y', 'z'].map(id => stay(id, { listingId: 'lst-1' }))
      expect(newReservationConflicts({ ...multiDraft, unitIds: ['un-1'] }, unroomed)).toEqual([])
      expect(newReservationConflicts(multiDraft, unroomed)).toEqual([])
    })

    it('flags the stays on a night where every room is taken', () => {
      const full = [
        stay('a', { listingId: 'lst-1', assignedUnitIds: ['un-1'] }),
        stay('b', { listingId: 'lst-1', assignedUnitIds: ['un-2'] }),
        stay('c', { listingId: 'lst-1' }),
        stay('d', { listingId: 'lst-1' }),
      ]
      // No room named: the listing has none left.
      expect(newReservationConflicts(multiDraft, full).map(c => c.reservationId)).toEqual(['a', 'b', 'c', 'd'])
      // Room 3 named: the two stays without a room now have nowhere to go.
      expect(newReservationConflicts({ ...multiDraft, unitIds: ['un-3'] }, full).map(c => c.reservationId)).toEqual(['c', 'd'])
    })
  })
})
