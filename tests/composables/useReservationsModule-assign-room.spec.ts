import { describe, expect, it } from 'vitest'
import { folioBookingTotal } from '~/components/reservations/data/folio'
import { useReservationsModule } from '~/composables/useReservationsModule'

function setup() {
  const mod = useReservationsModule()
  const multi = mod.reservations.value.find(r => r.listingId === 'lst-1' && (r.rooms?.length ?? 0) > 1)!
  const unroomed = mod.reservations.value.find(r => r.listingId === 'lst-1' && !r.rooms?.length && r.status !== 'cancelled')!
  return { mod, multi, unroomed }
}

describe('assignRoom', () => {
  it('puts a stay in a room without touching its price', () => {
    const { mod, unroomed } = setup()
    const before = folioBookingTotal(unroomed)
    const result = mod.assignRoom(unroomed.id, 'un-2')
    expect(result).toEqual({ success: true })
    const after = mod.reservations.value.find(r => r.id === unroomed.id)!
    expect(after.assignedUnitIds).toEqual(['un-2'])
    expect(after.rooms ?? []).toEqual([])
    expect(folioBookingTotal(after)).toBe(before)
  })

  it('refuses a stay with priced room lines', () => {
    const { mod, multi } = setup()
    expect(mod.assignRoom(multi.id, 'un-2').success).toBe(false)
  })

  it('refuses a room of another listing', () => {
    const { mod, unroomed } = setup()
    expect(mod.assignRoom(unroomed.id, 'no-such-room')).toEqual({ success: false, error: 'That room is not part of this listing.' })
  })

  it('refuses a room another stay holds on those dates, and counts assigned rooms as taken', () => {
    const { mod, multi, unroomed } = setup()
    const takenUnit = multi.rooms![0]!.unitId
    mod.updateReservation(unroomed.id, { checkIn: multi.checkIn, checkOut: multi.checkOut })
    const refused = mod.assignRoom(unroomed.id, takenUnit)
    expect(refused.success).toBe(false)
    expect(refused.error).toContain(multi.guestName)

    // Once assigned, the room shows up as taken for anyone else on those dates.
    expect(mod.assignRoom(unroomed.id, 'un-2').success).toBe(true)
    expect(mod.getConflictedUnitIds('lst-1', multi.checkIn, multi.checkOut)).toContain('un-2')
    const conflict = mod.getUnitConflicts('un-2', 'lst-1', multi.checkIn, multi.checkOut)
    expect(conflict[0]).toMatchObject({ reservationId: unroomed.id })
    expect(conflict[0]!.roomLine).toBeUndefined()
  })

  it('takes a stay out of its room', () => {
    const { mod, unroomed } = setup()
    mod.assignRoom(unroomed.id, 'un-2')
    mod.unassignRoom(unroomed.id)
    expect(mod.reservations.value.find(r => r.id === unroomed.id)!.assignedUnitIds).toBeUndefined()
  })
})
