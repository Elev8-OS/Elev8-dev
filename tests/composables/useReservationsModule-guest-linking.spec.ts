// A guest who checks out and books again two months later has to land on their
// existing profile, or the guest page silently loses the stay: Booking History
// filters on `guestId`, and `createReservation` used to hardcode it to ''.
//
// The rule under test is narrow on purpose. An explicit pick links; no pick
// creates a new profile; and nothing here guesses from email or phone, because
// a wrong merge would show one guest another guest's history.

import { beforeEach, describe, expect, it } from 'vitest'
import { initialGuests } from '~/components/reservations/data/reservations'
import { useReservationsModule } from '~/composables/useReservationsModule'

function draft(over: Record<string, unknown> = {}) {
  return {
    guestName: 'Emily Chen',
    guestEmail: 'emily.chen@email.com',
    guestPhone: '+65 8123 4567',
    guestLanguage: 'English',
    guestNotes: '',
    listingId: 'lst-2',
    listingName: 'The R Pererenan Mezzanine Studio + Plunge Pool',
    channel: 'Direct' as const,
    checkIn: '2026-11-10',
    checkOut: '2026-11-14',
    nights: 4,
    guestCount: 2,
    totalPrice: 640,
    currency: 'USD',
    ...over,
  }
}

describe('linking a booking to a guest', () => {
  beforeEach(() => {
    useReservationsModule()
  })

  it('puts a repeat booking on the picked guest, so it shows in their history', () => {
    const { createReservation, getReservationsForGuest, reservations } = useReservationsModule()
    const emily = initialGuests.find(g => g.name === 'Emily Chen')!
    const before = getReservationsForGuest(emily.id).length

    const result = createReservation(draft({ guestId: emily.id }))

    expect(result.success).toBe(true)
    expect(reservations.value.find(r => r.id === result.id)!.guestId).toBe(emily.id)
    expect(getReservationsForGuest(emily.id)).toHaveLength(before + 1)
  })

  it('never leaves a guest booking unlinked, which is what used to happen', () => {
    const { createReservation, reservations } = useReservationsModule()

    const result = createReservation(draft())

    expect(reservations.value.find(r => r.id === result.id)!.guestId).not.toBe('')
  })

  it('creates a profile for a guest nobody has stayed before', () => {
    const { createReservation, guests, reservations, getGuestById } = useReservationsModule()
    const before = guests.value.length

    const result = createReservation(draft({
      guestName: 'Priya Nair',
      guestEmail: 'priya.nair@email.com',
      guestPhone: '+91 98200 11223',
      guestNotes: 'Arrives late.',
    }))

    expect(guests.value).toHaveLength(before + 1)
    const linked = getGuestById(reservations.value.find(r => r.id === result.id)!.guestId)!
    expect(linked.name).toBe('Priya Nair')
    expect(linked.email).toBe('priya.nair@email.com')
    expect(linked.notes).toBe('Arrives late.')
    expect(linked.previousStays).toBe(0)
  })

  it('does not silently merge a new booking into a guest with the same email', () => {
    // The email matches Emily's exactly, and it still must not link: matching an
    // unlinked booking to a person is a separate, human-confirmed step.
    const { createReservation, guests, reservations } = useReservationsModule()
    const emily = initialGuests.find(g => g.name === 'Emily Chen')!
    const before = guests.value.length

    const result = createReservation(draft({ guestEmail: emily.email }))

    expect(reservations.value.find(r => r.id === result.id)!.guestId).not.toBe(emily.id)
    expect(guests.value).toHaveLength(before + 1)
  })

  it('ignores a guest id that does not exist rather than storing a dangling one', () => {
    const { createReservation, guests, getGuestById } = useReservationsModule()

    const result = createReservation(draft({ guestId: 'guest-does-not-exist' }))
    const stored = useReservationsModule().reservations.value.find(r => r.id === result.id)!

    expect(stored.guestId).not.toBe('guest-does-not-exist')
    expect(getGuestById(stored.guestId)).not.toBeNull()
    expect(guests.value.some(g => g.id === stored.guestId)).toBe(true)
  })

  it('does not manufacture a profile for an owner stay or a manual block', () => {
    // These hold the calendar rather than representing a paying guest, and
    // useOwnerStayApprovals creates them with a name but no contact details.
    const { createReservation, guests, reservations } = useReservationsModule()
    const before = guests.value.length

    for (const status of ['owner_request', 'blocked'] as const) {
      const result = createReservation(draft({
        guestName: 'Owner Stay',
        guestEmail: '',
        guestPhone: '',
        status,
      }))
      expect(reservations.value.find(r => r.id === result.id)!.guestId).toBe('')
    }

    expect(guests.value).toHaveLength(before)
  })

  it('refuses an incomplete draft without inventing a guest for it', () => {
    const { createReservation, guests } = useReservationsModule()
    const before = guests.value.length

    expect(createReservation(draft({ guestName: '  ' })).success).toBe(false)
    expect(guests.value).toHaveLength(before)
  })
})

describe('getPreviousStayCount', () => {
  beforeEach(() => {
    useReservationsModule()
  })

  it('counts only stays that have finished', () => {
    const { createReservation, getPreviousStayCount } = useReservationsModule()
    const emily = initialGuests.find(g => g.name === 'Emily Chen')!
    const before = getPreviousStayCount(emily.id)

    // A future stay is not a previous stay.
    createReservation(draft({ guestId: emily.id, checkIn: '2099-01-01', checkOut: '2099-01-05' }))
    expect(getPreviousStayCount(emily.id)).toBe(before)

    // A finished one is.
    createReservation(draft({ guestId: emily.id, checkIn: '2020-01-01', checkOut: '2020-01-05' }))
    expect(getPreviousStayCount(emily.id)).toBe(before + 1)
  })

  it('ignores a cancelled stay, since the guest never came', () => {
    const { createReservation, getPreviousStayCount } = useReservationsModule()
    const emily = initialGuests.find(g => g.name === 'Emily Chen')!
    const before = getPreviousStayCount(emily.id)

    createReservation(draft({
      guestId: emily.id,
      checkIn: '2020-02-01',
      checkOut: '2020-02-05',
      status: 'cancelled',
    }))

    expect(getPreviousStayCount(emily.id)).toBe(before)
  })

  it('reports zero for a guest with no stays rather than throwing', () => {
    expect(useReservationsModule().getPreviousStayCount('guest-nobody')).toBe(0)
  })

  it('moves when a stay is added, which the stored seed count never did', () => {
    const { createReservation, getPreviousStayCount, getGuestById } = useReservationsModule()
    const emily = initialGuests.find(g => g.name === 'Emily Chen')!
    const derivedBefore = getPreviousStayCount(emily.id)
    const storedBefore = getGuestById(emily.id)!.previousStays

    createReservation(draft({ guestId: emily.id, checkIn: '2019-01-01', checkOut: '2019-01-05' }))

    // The derived count follows the new stay; the stored field stays put, which
    // is exactly why the UI reads the derived one.
    expect(getPreviousStayCount(emily.id)).toBe(derivedBefore + 1)
    expect(getGuestById(emily.id)!.previousStays).toBe(storedBefore)
  })
})
