import type { GuestProfile, ReservationDraft, ReservationEntry, ReservationStatus } from '~/components/reservations/data/reservations'
import { generateReservationId, initialGuests, initialReservations } from '~/components/reservations/data/reservations'

export interface ReservationFilters {
  search: string
  status: ReservationStatus | 'all'
  listings: string[]
  dateFrom: string
  dateTo: string
}

export function useReservationsModule() {
  const reservations = useState<ReservationEntry[]>('reservations-entries', () =>
    initialReservations.map(r => ({ ...r })))
  const guests = useState<GuestProfile[]>('reservations-guests', () =>
    initialGuests.map(g => ({ ...g })))

  const filters = useState<ReservationFilters>('reservations-filters', () => ({
    search: '',
    status: 'all',
    listings: [],
    dateFrom: '',
    dateTo: '',
  }))

  const filteredReservations = computed(() => {
    return reservations.value.filter((r) => {
      if (filters.value.status !== 'all' && r.status !== filters.value.status)
        return false
      if (filters.value.listings.length > 0 && !filters.value.listings.includes(r.listingId))
        return false
      if (filters.value.dateFrom && r.checkIn < filters.value.dateFrom)
        return false
      if (filters.value.dateTo && r.checkIn > filters.value.dateTo)
        return false
      if (filters.value.search) {
        const q = filters.value.search.toLowerCase()
        const haystack = `${r.guestName} ${r.guestEmail} ${r.listingName} ${r.id}`.toLowerCase()
        if (!haystack.includes(q))
          return false
      }
      return true
    })
  })

  const today = new Date().toISOString().split('T')[0] ?? ''

  const stats = computed(() => {
    let upcoming = 0
    let current = 0
    let past = 0
    let cancelled = 0
    for (const r of reservations.value) {
      if (r.status === 'cancelled') {
        cancelled++
        continue
      }
      if (r.checkIn > today)
        upcoming++
      else if (r.checkOut >= today)
        current++
      else
        past++
    }
    return { upcoming, current, past, cancelled }
  })

  function getGuestById(id: string): GuestProfile | null {
    return guests.value.find(g => g.id === id) ?? null
  }

  function getReservationsForGuest(guestId: string): ReservationEntry[] {
    return reservations.value
      .filter(r => r.guestId === guestId)
      .sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1))
  }

  function createReservation(draft: ReservationDraft): { success: boolean, id?: string } {
    if (!draft.guestName.trim() || !draft.listingId.trim() || !draft.checkIn.trim() || !draft.checkOut.trim())
      return { success: false }

    const id = generateReservationId()
    const entry: ReservationEntry = {
      id,
      guestId: '',
      ...draft,
      status: 'verified',
      activity: [],
    }
    reservations.value = [entry, ...reservations.value]
    return { success: true, id }
  }

  function updateGuestNotes(id: string, notes: string) {
    guests.value = guests.value.map(g =>
      g.id === id ? { ...g, notes } : g,
    )
  }

  function updateReservationStatus(id: string, status: ReservationStatus) {
    reservations.value = reservations.value.map(r =>
      r.id === id ? { ...r, status } : r,
    )
  }

  function reset() {
    reservations.value = initialReservations.map(r => ({ ...r }))
    guests.value = initialGuests.map(g => ({ ...g }))
    filters.value = { search: '', status: 'all', listings: [], dateFrom: '', dateTo: '' }
  }

  return {
    reservations,
    guests,
    filters,
    filteredReservations,
    stats,
    getGuestById,
    getReservationsForGuest,
    createReservation,
    updateGuestNotes,
    updateReservationStatus,
    reset,
  }
}
