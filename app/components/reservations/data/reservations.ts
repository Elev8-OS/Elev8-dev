import type { ActivityEvent } from '~/components/inbox/data/conversations'

export type ReservationStatus = 'inquiry' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'

export interface ReservationEntry {
  id: string
  guestId: string
  guestName: string
  guestEmail: string
  guestPhone: string
  guestLanguage: string
  guestNotes: string
  listingId: string
  listingName: string
  channel: 'Airbnb' | 'Booking.com' | 'Direct'
  checkIn: string // ISO date YYYY-MM-DD
  checkOut: string // ISO date YYYY-MM-DD
  nights: number
  guestCount: number
  totalPrice: number
  currency: string
  status: ReservationStatus
  conversationId?: string
  paymentRequestId?: string
  guestGuideId?: string
  upsellIds?: string[]
  activity: ActivityEvent[]
}

export interface GuestProfile {
  id: string
  name: string
  email: string
  phone: string
  language: string
  notes: string
  previousStays: number
  tags: string[]
  createdAt: string
}

export interface GuestBookingHistoryItem {
  id: string
  checkIn: string
  nights: number
  listingName: string
  totalPrice: number
  currency: string
  hostReviewOfGuest?: { rating: number, text: string }
  guestReviewOfProperty?: { rating: number, text: string }
}

export interface ReservationDraft {
  guestName: string
  guestEmail: string
  guestPhone: string
  guestLanguage: string
  guestNotes: string
  listingId: string
  listingName: string
  channel: 'Airbnb' | 'Booking.com' | 'Direct'
  checkIn: string
  checkOut: string
  nights: number
  guestCount: number
  totalPrice: number
  currency: string
}

export function generateReservationId(): string {
  return `res-${Date.now()}`
}

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  inquiry: 'Inquiry',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
}

export const initialReservations: ReservationEntry[] = [
  // Rich records (from inbox, enriched)
  {
    id: 'res-1',
    guestId: 'guest-1',
    guestName: 'Sarah Mitchell',
    guestEmail: 'sarah.mitchell@email.com',
    guestPhone: '+1 555-0142',
    guestLanguage: 'English',
    guestNotes: 'Returning guest. Prefers early check-in. Allergic to feather pillows.',
    listingId: 'lst-1',
    listingName: '5BR Pool the R Villa Luwa – Serene near Canggu',
    channel: 'Airbnb',
    checkIn: '2026-07-10',
    checkOut: '2026-07-15',
    nights: 5,
    guestCount: 2,
    totalPrice: 750,
    currency: 'USD',
    status: 'checked_out',
    conversationId: 'conv-1',
    activity: [],
  },
  {
    id: 'res-2',
    guestId: 'guest-2',
    guestName: 'James Carter',
    guestEmail: 'james.carter@email.com',
    guestPhone: '+44 20 7946 0958',
    guestLanguage: 'English',
    guestNotes: 'Anniversary trip. Wants a welcome bottle on arrival.',
    listingId: 'lst-2',
    listingName: 'Villa Sehnsucht – Seegrundstück Mecklenburg',
    channel: 'Booking.com',
    checkIn: '2026-07-20',
    checkOut: '2026-07-27',
    nights: 7,
    guestCount: 2,
    totalPrice: 2460,
    currency: 'EUR',
    status: 'checked_out',
    conversationId: 'conv-2',
    activity: [],
  },
  // Finance-derived records (blended)
  {
    id: 'lex-res-001',
    guestId: 'guest-3',
    guestName: 'Erik Hoffmann',
    guestEmail: 'erik.hoffmann@email.com',
    guestPhone: '+49 151 23456789',
    guestLanguage: 'German',
    guestNotes: '',
    listingId: 'lst-3',
    listingName: 'Villa Luwa – Hügellage Brandenburg',
    channel: 'Airbnb',
    checkIn: '2026-07-21',
    checkOut: '2026-07-26',
    nights: 5,
    guestCount: 2,
    totalPrice: 1280,
    currency: 'EUR',
    status: 'checked_out',
    activity: [],
  },
  {
    id: 'lex-res-008',
    guestId: 'guest-4',
    guestName: 'Marta Kowalski',
    guestEmail: 'marta.kowalski@email.com',
    guestPhone: '+48 600 123456',
    guestLanguage: 'Polish',
    guestNotes: '',
    listingId: 'lst-4',
    listingName: 'Villa Zeitreise – Weinregion Pfalz',
    channel: 'Direct',
    checkIn: '2026-08-08',
    checkOut: '2026-08-13',
    nights: 5,
    guestCount: 3,
    totalPrice: 1200,
    currency: 'EUR',
    status: 'confirmed',
    activity: [],
  },
  {
    id: 'lex-res-002',
    guestId: 'guest-5',
    guestName: 'Anna Brunner',
    guestEmail: 'anna.brunner@email.com',
    guestPhone: '+43 660 1234567',
    guestLanguage: 'German',
    guestNotes: '',
    listingId: 'lst-5',
    listingName: 'Villa Bergfried – Schwarzwald',
    channel: 'Airbnb',
    checkIn: '2026-07-22',
    checkOut: '2026-07-29',
    nights: 7,
    guestCount: 2,
    totalPrice: 2460,
    currency: 'EUR',
    status: 'checked_out',
    activity: [],
  },
]

export const initialGuests: GuestProfile[] = [
  {
    id: 'guest-1',
    name: 'Sarah Mitchell',
    email: 'sarah.mitchell@email.com',
    phone: '+1 555-0142',
    language: 'English',
    notes: 'Returning guest. Prefers early check-in. Allergic to feather pillows.',
    previousStays: 2,
    tags: ['Returning', 'Early check-in'],
    createdAt: '2025-11-02',
  },
  {
    id: 'guest-2',
    name: 'James Carter',
    email: 'james.carter@email.com',
    phone: '+44 20 7946 0958',
    language: 'English',
    notes: 'Anniversary trip. Wants a welcome bottle on arrival.',
    previousStays: 1,
    tags: ['Anniversary'],
    createdAt: '2026-01-14',
  },
  {
    id: 'guest-3',
    name: 'Erik Hoffmann',
    email: 'erik.hoffmann@email.com',
    phone: '+49 151 23456789',
    language: 'German',
    notes: '',
    previousStays: 1,
    tags: [],
    createdAt: '2026-02-10',
  },
  {
    id: 'guest-4',
    name: 'Marta Kowalski',
    email: 'marta.kowalski@email.com',
    phone: '+48 600 123456',
    language: 'Polish',
    notes: '',
    previousStays: 0,
    tags: [],
    createdAt: '2026-07-28',
  },
  {
    id: 'guest-5',
    name: 'Anna Brunner',
    email: 'anna.brunner@email.com',
    phone: '+43 660 1234567',
    language: 'German',
    notes: '',
    previousStays: 1,
    tags: [],
    createdAt: '2026-01-20',
  },
]

// Convenience: helper to compute nights between two ISO dates
export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`)
  const end = new Date(`${checkOut}T00:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}
