import { beforeEach, describe, expect, it } from 'vitest'
import { useReservationsModule } from '~/composables/useReservationsModule'

describe('useReservationsModule', () => {
  beforeEach(() => {
    // Reset module state between tests (useState persists across calls)
    const { reset } = useReservationsModule()
    reset()
  })

  it('initializes with mock data', () => {
    const { reservations, guests } = useReservationsModule()
    expect(reservations.value.length).toBeGreaterThanOrEqual(5)
    expect(guests.value.length).toBeGreaterThanOrEqual(5)
  })

  it('getGuestById returns a guest and null for missing id', () => {
    const { getGuestById } = useReservationsModule()
    expect(getGuestById('guest-1')?.name).toBe('Sarah Mitchell')
    expect(getGuestById('missing')).toBeNull()
  })

  it('getReservationsForGuest returns all stays sorted by check-in desc', () => {
    const { getReservationsForGuest } = useReservationsModule()
    const stays = getReservationsForGuest('guest-1')
    expect(stays.length).toBeGreaterThanOrEqual(1)
    const dates = stays.map(s => s.checkIn)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('filteredReservations applies search, status, listing, and date range filters', () => {
    const { filteredReservations, filters } = useReservationsModule()
    filters.value.search = 'sarah'
    expect(filteredReservations.value.every(r => r.guestName.toLowerCase().includes('sarah'))).toBe(true)
    filters.value.search = ''
    filters.value.status = 'confirmed'
    expect(filteredReservations.value.every(r => r.status === 'confirmed')).toBe(true)
    filters.value.status = 'all'
    filters.value.listings = ['lst-1']
    expect(filteredReservations.value.every(r => r.listingId === 'lst-1')).toBe(true)
    filters.value.listings = []
    filters.value.dateFrom = '2026-07-20'
    filters.value.dateTo = '2026-07-25'
    expect(filteredReservations.value.every(r => r.checkIn >= '2026-07-20' && r.checkIn <= '2026-07-25')).toBe(true)
  })

  it('stats counts upcoming, current, past, and cancelled reservations', () => {
    const { stats } = useReservationsModule()
    expect(stats.value.upcoming + stats.value.current + stats.value.past + stats.value.cancelled)
      .toBeGreaterThanOrEqual(5)
  })

  it('createReservation validates required fields and adds to list', () => {
    const { createReservation, reservations } = useReservationsModule()
    const before = reservations.value.length
    const result = createReservation({
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      guestLanguage: '',
      guestNotes: '',
      listingId: '',
      listingName: '',
      channel: 'Direct',
      checkIn: '',
      checkOut: '',
      nights: 1,
      guestCount: 1,
      totalPrice: 100,
      currency: 'USD',
    })
    expect(result.success).toBe(false)
    const ok = createReservation({
      guestName: 'Test Guest',
      guestEmail: 'test@email.com',
      guestPhone: '+1 555-0000',
      guestLanguage: 'English',
      guestNotes: '',
      listingId: 'lst-1',
      listingName: 'Test Villa',
      channel: 'Direct',
      checkIn: '2026-09-01',
      checkOut: '2026-09-03',
      nights: 2,
      guestCount: 2,
      totalPrice: 300,
      currency: 'USD',
    })
    expect(ok.success).toBe(true)
    expect(reservations.value.length).toBe(before + 1)
    expect(reservations.value[0].guestName).toBe('Test Guest')
    expect(reservations.value[0].status).toBe('confirmed')
  })

  it('updateGuestNotes updates a guest profile', () => {
    const { updateGuestNotes, getGuestById } = useReservationsModule()
    updateGuestNotes('guest-1', 'New note')
    expect(getGuestById('guest-1')?.notes).toBe('New note')
    updateGuestNotes('missing', 'x')
    expect(getGuestById('missing')).toBeNull()
  })
})
