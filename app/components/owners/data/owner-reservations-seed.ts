import type { OwnerReservation, OwnerRoom, OwnerRoomType } from './owner-reservations'

// Seed reservations used by the owner-portal calendar view. The list is
// owner-scoped: only reservations on the listings owned by the active
// owner are included. Each seed variant here includes both guest bookings
// across channels and a few personal-use owner blocks so the calendar
// exercises every bar shape, overlap pattern, and channel badge.

export const mockOwnerReservations: OwnerReservation[] = [
  // Wayan (own-1, lst-1) — three guest bookings + two owner blocks.
  {
    id: 'or-1', type: 'guest', listingId: 'lst-1', channel: 'airbnb',
    guestName: 'Amelia Hart', roomTypeId: 'rt-1-mz', checkIn: '2025-12-15', checkOut: '2025-12-20', status: 'confirmed',
  },
  {
    id: 'or-2', type: 'guest', listingId: 'lst-1', channel: 'booking',
    guestName: 'Daniel Ortega', roomTypeId: 'rt-1-st', checkIn: '2025-12-22', checkOut: '2025-12-26', status: 'confirmed',
  },
  {
    id: 'or-3', type: 'guest', listingId: 'lst-1', channel: 'direct',
    guestName: 'Hannah Okafor', roomTypeId: 'rt-1-st', checkIn: '2026-01-04', checkOut: '2026-01-08', status: 'pending',
  },
  {
    id: 'or-4', type: 'owner_block', listingId: 'lst-1',
    roomTypeId: 'rt-1-mz',
    note: 'Family visit', checkIn: '2025-12-27', checkOut: '2025-12-30', status: 'confirmed',
  },
  {
    id: 'or-5', type: 'owner_block', listingId: 'lst-1',
    roomTypeId: 'rt-1-st',
    note: 'Maintenance window', checkIn: '2026-01-15', checkOut: '2026-01-17', status: 'confirmed',
  },

  // I Putu (own-2) — two guest bookings that overlap on lst-3.
  {
    id: 'or-6', type: 'guest', listingId: 'lst-3', channel: 'airbnb',
    guestName: 'Ravi Singh', roomTypeId: 'rt-3-mz', checkIn: '2025-12-10', checkOut: '2025-12-15', status: 'confirmed',
  },
  {
    id: 'or-7', type: 'guest', listingId: 'lst-3', channel: 'vrbo',
    guestName: 'Mia Tanaka', roomTypeId: 'rt-3-mz', checkIn: '2025-12-13', checkOut: '2025-12-18', status: 'confirmed',
  },
  {
    id: 'or-8', type: 'owner_block', listingId: 'lst-8',
    roomTypeId: 'rt-8-st',
    note: 'Personal stay', checkIn: '2026-02-05', checkOut: '2026-02-08', status: 'confirmed',
  },
]

export const mockOwnerRoomTypes: OwnerRoomType[] = [
  // Villa Sunset (lst-1) — 2 Mezzanine + 3 Studio.
  { id: 'rt-1-mz', listingId: 'lst-1', name: 'Mezzanine', capacity: 2 },
  { id: 'rt-1-st', listingId: 'lst-1', name: 'Studio', capacity: 3 },
  // Bali Villa (lst-3) — 1 Mezzanine + 2 Studio.
  { id: 'rt-3-mz', listingId: 'lst-3', name: 'Mezzanine', capacity: 1 },
  { id: 'rt-3-st', listingId: 'lst-3', name: 'Studio', capacity: 2 },
  // Beach House (lst-8) — 2 Studio.
  { id: 'rt-8-st', listingId: 'lst-8', name: 'Studio', capacity: 2 },
]

export const mockOwnerRooms: OwnerRoom[] = [
  // Villa Sunset
  { id: 'rm-1-1', listingId: 'lst-1', roomTypeId: 'rt-1-mz', label: 'Mezzanine 1' },
  { id: 'rm-1-2', listingId: 'lst-1', roomTypeId: 'rt-1-mz', label: 'Mezzanine 2' },
  { id: 'rm-1-3', listingId: 'lst-1', roomTypeId: 'rt-1-st', label: 'Studio 1' },
  { id: 'rm-1-4', listingId: 'lst-1', roomTypeId: 'rt-1-st', label: 'Studio 2' },
  { id: 'rm-1-5', listingId: 'lst-1', roomTypeId: 'rt-1-st', label: 'Studio 3' },
  // Bali Villa
  { id: 'rm-3-1', listingId: 'lst-3', roomTypeId: 'rt-3-mz', label: 'Mezzanine 1' },
  { id: 'rm-3-2', listingId: 'lst-3', roomTypeId: 'rt-3-st', label: 'Studio 1' },
  { id: 'rm-3-3', listingId: 'lst-3', roomTypeId: 'rt-3-st', label: 'Studio 2' },
  // Beach House
  { id: 'rm-8-1', listingId: 'lst-8', roomTypeId: 'rt-8-st', label: 'Studio 1' },
  { id: 'rm-8-2', listingId: 'lst-8', roomTypeId: 'rt-8-st', label: 'Studio 2' },
]
