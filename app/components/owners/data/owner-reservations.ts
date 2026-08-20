// Owner-portal reservation data.
//
// Distinct from owner stays: these are the public-facing reservations
// guests book through any channel (read-only here) plus the owner's own
// personal-use blocks (read-write). Reservations can optionally be scoped
// to a room type (e.g. "Mezzanine") or a specific room within a listing.

export type OwnerReservationType = 'guest' | 'owner_block'

export type OwnerReservationChannel = 'airbnb' | 'booking' | 'direct' | 'vrbo'

export type OwnerReservationStatus = 'confirmed' | 'pending' | 'cancelled'

export interface OwnerRoomType {
  id: string
  listingId: string
  name: string
  /** Number of physical rooms of this type. */
  capacity: number
}

export interface OwnerRoom {
  id: string
  listingId: string
  roomTypeId: string
  label: string
}

export interface OwnerReservation {
  id: string
  type: OwnerReservationType
  listingId: string
  roomTypeId?: string
  roomId?: string
  /** ISO date `YYYY-MM-DD` (check-in night, inclusive). */
  checkIn: string
  /** ISO date `YYYY-MM-DD` (check-out day, exclusive). */
  checkOut: string
  /** Guest bookings: visible channel + guest name. */
  guestName?: string
  channel?: OwnerReservationChannel
  /** Owner blocks: free-text label. */
  note?: string
  status: OwnerReservationStatus
  /** When the reservation is an owner block that went through the approval flow. */
  ownerStayStatus?: 'pending_approval' | 'active' | 'rejected' | 'cancelled'
}

export interface OwnerReservationDay {
  key: string
  date: Date
  weekday: string
  inMonth: boolean
  isToday: boolean
}

export interface OwnerReservationBar {
  id: string
  type: OwnerReservationType
  listingId: string
  roomTypeId?: string
  roomId?: string
  guestName?: string
  channel?: OwnerReservationChannel
  note?: string
  status: OwnerReservationStatus
  /** When the reservation is an owner block that went through the approval flow. */
  ownerStayStatus?: 'pending_approval' | 'active' | 'rejected' | 'cancelled'
  startDay: number
  endDay: number
  /** 1-based row index inside the listing's mini-grid (multi-row allowed for overlap). */
  row: number
  /** Indicates the bar's first segment wraps onto the previous/next week. */
  wrapsForward: boolean
  wrapsBackward: boolean
}
