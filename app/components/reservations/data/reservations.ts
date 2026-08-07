import type { ActivityEvent } from '~/components/inbox/data/conversations'

export type ReservationStatus = 'inquiry' | 'unverified' | 'verified' | 'checked_in' | 'checked_out' | 'cancelled' | 'blocked'

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
  blockReason?: string
  bookingNote?: string
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
  unverified: 'Unverified',
  verified: 'Verified',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  blocked: 'Blocked',
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
    checkIn: '2026-08-20',
    checkOut: '2026-08-27',
    nights: 7,
    guestCount: 2,
    totalPrice: 2460,
    currency: 'EUR',
    status: 'inquiry',
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
    status: 'verified',
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
    checkIn: '2026-08-22',
    checkOut: '2026-08-29',
    nights: 7,
    guestCount: 2,
    totalPrice: 2460,
    currency: 'EUR',
    status: 'unverified',
    activity: [],
  },
  {
    id: 'res-3',
    guestId: 'guest-6',
    guestName: 'Emily Chen',
    guestEmail: 'emily.chen@email.com',
    guestPhone: '+65 8123 4567',
    guestLanguage: 'English',
    guestNotes: 'Prefers a quiet room away from the pool. Interested in spa services.',
    listingId: 'lst-2',
    listingName: 'The R Pererenan Mezzanine Studio + Plunge Pool',
    channel: 'Airbnb',
    checkIn: '2026-08-08',
    checkOut: '2026-08-12',
    nights: 4,
    guestCount: 2,
    totalPrice: 640,
    currency: 'USD',
    status: 'checked_in',
    conversationId: 'conv-3',
    paymentRequestId: 'pr-006',
    guestGuideId: 'ggl-mock-002',
    upsellIds: ['ord-003'],
    bookingNote: '** THIS RESERVATION HAS BEEN PRE-PAID ** BOOKING NOTE : Payment charge is IDR 542087.253 Approximate time of arrival: between 21:00 and 22:00 Meal Plan: There is no meal option with this room. Smoking Preference: Non-Smoking Payment Collect: OTA collect OTA Commission: 3535352.00',
    activity: [
      {
        id: 'act-res3-1',
        type: 'reservation',
        title: 'Reservation Confirmed',
        description: 'Booking for 4 nights at The R Pererenan Mezzanine Studio.',
        actor: 'System',
        timestamp: '2026-07-02T09:00:00Z',
        colorDot: 'green',
      },
      {
        id: 'act-res3-2',
        type: 'message',
        title: 'Guest asked about early check-in',
        description: 'Requested early check-in around 12:00.',
        actor: 'Emily Chen',
        timestamp: '2026-07-10T14:30:00Z',
        channel: 'Airbnb',
        colorDot: 'blue',
      },
      {
        id: 'act-res3-3',
        type: 'guide_sent',
        title: 'Guest Guide Sent',
        description: 'Bali Villa Welcome Guide shared via WhatsApp.',
        actor: 'Komang Juliantara',
        timestamp: '2026-08-01T08:15:00Z',
        channel: 'WhatsApp',
        colorDot: 'gold',
      },
      {
        id: 'act-res3-4',
        type: 'reservation',
        title: 'Downpayment Received',
        description: 'USD 200 downpayment paid via payment link.',
        actor: 'System',
        timestamp: '2026-08-02T11:45:00Z',
        colorDot: 'green',
      },
      {
        id: 'act-res3-5',
        type: 'cleaning',
        title: 'Cleaning Completed',
        description: 'Pre-arrival deep clean finished.',
        actor: 'Made Surya',
        timestamp: '2026-08-07T16:00:00Z',
        colorDot: 'gold',
      },
      {
        id: 'act-res3-6',
        type: 'message',
        title: 'Guest checked in',
        description: 'Arrived and settled in. Welcomed by staff.',
        actor: 'Emily Chen',
        timestamp: '2026-08-08T15:20:00Z',
        channel: 'WhatsApp',
        colorDot: 'green',
      },
    ],
  },
  // Manual block — not a reservation; blocks the calendar with a reason
  {
    id: 'res-block-1',
    guestId: '',
    guestName: '—',
    guestEmail: '',
    guestPhone: '',
    guestLanguage: '',
    guestNotes: '',
    listingId: 'lst-2',
    listingName: 'The R Pererenan Mezzanine Studio + Plunge Pool',
    channel: 'Direct',
    checkIn: '2026-08-15',
    checkOut: '2026-08-17',
    nights: 2,
    guestCount: 0,
    totalPrice: 0,
    currency: 'USD',
    status: 'blocked',
    blockReason: 'Owner family stay — property unavailable',
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
  {
    id: 'guest-6',
    name: 'Emily Chen',
    email: 'emily.chen@email.com',
    phone: '+65 8123 4567',
    language: 'English',
    notes: 'Prefers a quiet room away from the pool. Interested in spa services.',
    previousStays: 0,
    tags: ['Spa', 'Quiet room'],
    createdAt: '2026-07-01',
  },
]

// Convenience: helper to compute nights between two ISO dates
export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`)
  const end = new Date(`${checkOut}T00:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}
