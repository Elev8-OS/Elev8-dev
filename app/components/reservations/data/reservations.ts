import type { ActivityEvent } from '~/components/inbox/data/conversations'

export type ReservationStatus = 'inquiry' | 'unverified' | 'verified' | 'checked_in' | 'checked_out' | 'cancelled' | 'blocked' | 'owner_request'

export type GuestCategory = 'adult' | 'child' | 'infant'

export interface GuestOccupant {
  id: string
  name: string
  category: GuestCategory
  email?: string
  phone?: string
  dob?: string
  nationality?: string
  idType?: 'passport' | 'id_card' | 'drivers_license'
  idNumber?: string
  isPrimary?: boolean
  identityVerified?: boolean
}

export interface PriceDetails {
  /** Subtotal = nights × nightly rate, before fees/tax */
  subtotal: number
  cleaningFee: number
  serviceFee: number
  tax: number
  /** Extra charges (upsells, extras) paid by guest */
  extras: number
  /** What the guest paid in total (subtotal + fees + tax + extras) */
  guestPaid: number
  /** OTA/booking commission (percentage or amount) */
  commission: number
  /** What the host/owner receives after commission */
  payout: number
}

export type IdentityVerificationStatus = 'verified' | 'pending' | 'not_started' | 'rejected'

export interface GuestDocument {
  id: string
  kind: 'id' | 'selfie' | 'signature' | 'agreement'
  name: string
  /** Mock file path; data: URIs can be previewed/downloaded */
  url?: string
  uploadedAt: string
  fileName?: string
}

export interface IdentityVerification {
  status: IdentityVerificationStatus
  submittedAt?: string
  verifiedAt?: string
  documents: GuestDocument[]
}

export interface ReservationRoomLine {
  id: string
  unitTypeId: string
  unitId: string
  unitName: string
  ratePlanId: string
  rateLabel: string
  pricePerNight: number
  lineTotal: number
  guestNames?: string
  /** 'per_night' = pricePerNight × nights; 'per_stay' = flat pricePerStay for the whole stay. */
  priceMode?: 'per_night' | 'per_stay'
  pricePerStay?: number
}

export type BookingMode = 'entire_property' | 'rooms'

export type PaymentFeeMode = 'card' | 'manual' | 'no_fee'

export type ReservationChargeKind = 'cleaning' | 'city_tax' | 'service' | 'other'

export interface ReservationCharge {
  id: string
  kind: ReservationChargeKind
  label: string
  amount: number
}

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
  /** Guest count breakdown by category. */
  guestAdults?: number
  guestChildren?: number
  guestInfants?: number
  guests?: GuestOccupant[]
  totalPrice: number
  currency: string
  priceDetails?: PriceDetails
  status: ReservationStatus
  conversationId?: string
  paymentRequestId?: string
  guestGuideId?: string
  upsellIds?: string[]
  blockReason?: string
  bookingNote?: string
  identity?: IdentityVerification
  activity: ActivityEvent[]
  /** Estimated guest arrival time ("HH:MM"). */
  estimatedArrivalTime?: string
  /** Inquiry-only: hours before the inquiry expires. */
  inquiryExpiryHours?: number
  /** false = "Do not block availability" (inquiry does not block the calendar). */
  blocksAvailability?: boolean
  guestFirstName?: string
  guestLastName?: string
  guestAddress?: string
  guestCity?: string
  guestZip?: string
  guestCountry?: string
  /** Multi-room booking: one line per booked unit. */
  rooms?: ReservationRoomLine[]
  bookingMode?: BookingMode
  paymentFeeMode?: PaymentFeeMode
  paymentCustomFeePct?: number
  charges?: ReservationCharge[]
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
  /** Guest count breakdown by category. */
  guestAdults?: number
  guestChildren?: number
  guestInfants?: number
  totalPrice: number
  currency: string
  /** Owner stay requests / blocked reservations carry extra context. */
  blockReason?: string
  bookingNote?: string
  estimatedArrivalTime?: string
  inquiryExpiryHours?: number
  blocksAvailability?: boolean
  guestFirstName?: string
  guestLastName?: string
  guestAddress?: string
  guestCity?: string
  guestZip?: string
  guestCountry?: string
  /** Multi-room booking: one line per booked unit. */
  rooms?: ReservationRoomLine[]
  bookingMode?: BookingMode
  paymentFeeMode?: PaymentFeeMode
  paymentCustomFeePct?: number
  charges?: ReservationCharge[]
}

export function generateReservationId(): string {
  return `res-${Date.now()}`
}

/** Curated country list for the reservation contact-details form. */
export const COUNTRIES: string[] = [
  'Indonesia',
  'Switzerland',
  'Australia',
  'Singapore',
  'Malaysia',
  'United States',
  'United Kingdom',
  'Germany',
  'France',
  'Netherlands',
  'Italy',
  'Spain',
  'Austria',
  'Belgium',
  'Denmark',
  'Sweden',
  'Norway',
  'Finland',
  'Ireland',
  'Portugal',
  'Poland',
  'Czech Republic',
  'Japan',
  'South Korea',
  'China',
  'Hong Kong',
  'Taiwan',
  'India',
  'Thailand',
  'Vietnam',
  'Philippines',
  'New Zealand',
  'Canada',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Turkey',
  'South Africa',
  'Brazil',
  'Argentina',
  'Mexico',
  'Russia',
  'Ukraine',
  'Greece',
  'Hungary',
  'Luxembourg',
  'Liechtenstein',
  'Monaco',
  'Iceland',
  'Israel',
]

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  inquiry: 'Inquiry',
  unverified: 'Unverified',
  verified: 'Verified',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  blocked: 'Blocked',
  owner_request: 'Owner Request',
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
    priceDetails: {
      subtotal: 700,
      cleaningFee: 30,
      serviceFee: 0,
      tax: 20,
      extras: 0,
      guestPaid: 750,
      commission: 75,
      payout: 675,
    },
    status: 'checked_out',
    conversationId: 'conv-1',
    guests: [
      {
        id: 'occ-4',
        name: 'Sarah Mitchell',
        category: 'adult',
        email: 'sarah.mitchell@email.com',
        phone: '+1 555-0142',
        dob: '1988-03-15',
        nationality: 'American',
        idType: 'passport',
        idNumber: 'P45278123',
        isPrimary: true,
        identityVerified: true,
      },
      {
        id: 'occ-5',
        name: 'Michael Mitchell',
        category: 'adult',
        email: 'michael.mitchell@email.com',
        phone: '+1 555-0143',
        dob: '1986-07-22',
        nationality: 'American',
        idType: 'passport',
        idNumber: 'P45102286',
        isPrimary: false,
        identityVerified: true,
      },
    ],
    identity: {
      status: 'verified',
      submittedAt: '2026-07-08T10:00:00Z',
      verifiedAt: '2026-07-09T09:00:00Z',
      documents: [
        {
          id: 'doc-id-sarah',
          kind: 'id',
          name: 'Passport — Sarah Mitchell',
          url: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22800%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e7f6ec%22%2F%3E%3Ctext%20x%3D%22300%22%20y%3D%22380%22%20font-family%3D%22Arial%22%20font-size%3D%2230%22%20fill%3D%22%231d7a44%22%20text-anchor%3D%22middle%22%20font-weight%3D%22bold%22%3EPassport%20%7C%20Sarah%20Mitchell%3C%2Ftext%3E%3C%2Fsvg%3E',
          uploadedAt: '2026-07-08T10:00:00Z',
          fileName: 'sarah-passport.jpg',
        },
        {
          id: 'doc-selfie-sarah',
          kind: 'selfie',
          name: 'Guest selfie',
          url: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22800%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e8f0fe%22%2F%3E%3Ctext%20x%3D%22300%22%20y%3D%22380%22%20font-family%3D%22Arial%22%20font-size%3D%2230%22%20fill%3D%22%231a56c4%22%20text-anchor%3D%22middle%22%20font-weight%3D%22bold%22%3ESELFIE%3C%2Ftext%3E%3C%2Fsvg%3E',
          uploadedAt: '2026-07-08T10:00:00Z',
          fileName: 'selfie.jpg',
        },
        {
          id: 'doc-sign-sarah',
          kind: 'signature',
          name: 'Guest signature',
          url: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22800%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23fdf3e3%22%2F%3E%3Ctext%20x%3D%22300%22%20y%3D%22380%22%20font-family%3D%22Arial%22%20font-size%3D%2230%22%20fill%3D%22%2392600a%22%20text-anchor%3D%22middle%22%20font-weight%3D%22bold%22%3ESIGNATURE%3C%2Ftext%3E%3C%2Fsvg%3E',
          uploadedAt: '2026-07-08T10:00:00Z',
          fileName: 'signature.png',
        },
        {
          id: 'doc-agree-sarah',
          kind: 'agreement',
          name: 'House Rules Agreement (PDF)',
          url: 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22800%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e8f0fe%22%2F%3E%3Ctext%20x%3D%22300%22%20y%3D%22380%22%20font-family%3D%22Arial%22%20font-size%3D%2230%22%20fill%3D%22%231a56c4%22%20text-anchor%3D%22middle%22%20font-weight%3D%22bold%22%3EHouse%20Rules%20Agreement%3C%2Ftext%3E%3C%2Fsvg%3E',
          uploadedAt: '2026-07-08T10:00:00Z',
          fileName: 'house-rules-agreement.pdf',
        },
      ],
    },
    bookingNote: '** THIS RESERVATION HAS BEEN PRE-PAID ** BOOKING NOTE : Payment charge is USD 750.00 Approximate time of arrival: between 14:00 and 15:00 Meal Plan: There is no meal option with this room. Smoking Preference: Non-Smoking Payment Collect: OTA collect OTA Commission: 75.00',
    activity: [
      {
        id: 'act-res1-1',
        type: 'reservation',
        title: 'Reservation Confirmed',
        description: 'Booking for 5 nights at 5BR Pool the R Villa Luwa.',
        actor: 'System',
        timestamp: '2026-06-20T10:00:00Z',
        colorDot: 'green',
      },
      {
        id: 'act-res1-2',
        type: 'message',
        title: 'Guest asked about early check-in',
        description: 'Requested early check-in around 12:00.',
        actor: 'Sarah Mitchell',
        timestamp: '2026-07-09T16:45:00Z',
        channel: 'Airbnb',
        colorDot: 'blue',
      },
      {
        id: 'act-res1-3',
        type: 'reservation',
        title: 'Full Payment Received',
        description: 'USD 750 paid in full via the OTA.',
        actor: 'System',
        timestamp: '2026-07-09T18:00:00Z',
        colorDot: 'green',
      },
      {
        id: 'act-res1-4',
        type: 'guide_sent',
        title: 'Guest Guide Sent',
        description: 'Bali Villa Welcome Guide shared via WhatsApp.',
        actor: 'Komang Juliantara',
        timestamp: '2026-07-09T19:00:00Z',
        channel: 'WhatsApp',
        colorDot: 'gold',
      },
      {
        id: 'act-res1-5',
        type: 'cleaning',
        title: 'Cleaning Completed',
        description: 'Pre-arrival clean finished.',
        actor: 'Made Surya',
        timestamp: '2026-07-09T14:00:00Z',
        colorDot: 'gold',
      },
      {
        id: 'act-res1-6',
        type: 'message',
        title: 'Guest checked in',
        description: 'Arrived and settled in. Welcomed by staff.',
        actor: 'Sarah Mitchell',
        timestamp: '2026-07-10T13:30:00Z',
        channel: 'WhatsApp',
        colorDot: 'green',
      },
      {
        id: 'act-res1-7',
        type: 'message',
        title: 'Guest checked out',
        description: 'Departed. Keys returned and property inspected.',
        actor: 'Sarah Mitchell',
        timestamp: '2026-07-15T11:10:00Z',
        channel: 'WhatsApp',
        colorDot: 'blue',
      },
    ],
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
    priceDetails: {
      subtotal: 2310,
      cleaningFee: 75,
      serviceFee: 0,
      tax: 75,
      extras: 0,
      guestPaid: 2460,
      commission: 246,
      payout: 2214,
    },
    status: 'inquiry',
    conversationId: 'conv-2',
    guests: [
      {
        id: 'occ-6',
        name: 'James Carter',
        category: 'adult',
        email: 'james.carter@email.com',
        phone: '+44 20 7946 0958',
        dob: '1984-09-05',
        nationality: 'British',
        idType: 'passport',
        idNumber: 'GB1527483',
        isPrimary: true,
      },
      {
        id: 'occ-7',
        name: 'Olivia Carter',
        category: 'adult',
        email: 'olivia.carter@email.com',
        phone: '+44 20 7946 0959',
        dob: '1986-01-28',
        nationality: 'British',
        idType: 'passport',
        idNumber: 'GB1602194',
        isPrimary: false,
      },
    ],
    identity: {
      status: 'not_started',
      documents: [],
    },
    bookingNote: '** THIS RESERVATION HAS BEEN PRE-PAID ** BOOKING NOTE : Payment charge is EUR 2460.00 Approximate time of arrival: between 18:00 and 19:00 Meal Plan: There is no meal option with this room. Smoking Preference: Non-Smoking Payment Collect: OTA collect OTA Commission: 246.00',
    activity: [
      {
        id: 'act-res2-1',
        type: 'message',
        title: 'Availability Inquiry',
        description: 'Guest asked about availability for the anniversary week.',
        actor: 'James Carter',
        timestamp: '2026-08-10T09:30:00Z',
        channel: 'Booking.com',
        colorDot: 'blue',
      },
      {
        id: 'act-res2-2',
        type: 'reservation',
        title: 'Reservation Confirmed',
        description: 'Booking for 7 nights at Villa Sehnsucht.',
        actor: 'System',
        timestamp: '2026-08-10T14:00:00Z',
        colorDot: 'green',
      },
      {
        id: 'act-res2-3',
        type: 'reservation',
        title: 'Downpayment Received',
        description: 'EUR 500 downpayment paid via payment link.',
        actor: 'System',
        timestamp: '2026-08-11T10:15:00Z',
        colorDot: 'green',
      },
      {
        id: 'act-res2-4',
        type: 'message',
        title: 'Welcome bottle requested',
        description: 'Anniversary trip — wants a welcome bottle on arrival.',
        actor: 'James Carter',
        timestamp: '2026-08-12T20:40:00Z',
        channel: 'Booking.com',
        colorDot: 'blue',
      },
    ],
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
    priceDetails: {
      subtotal: 1200,
      cleaningFee: 40,
      serviceFee: 0,
      tax: 40,
      extras: 0,
      guestPaid: 1280,
      commission: 128,
      payout: 1152,
    },
    status: 'checked_out',
    guests: [
      {
        id: 'occ-8',
        name: 'Erik Hoffmann',
        category: 'adult',
        email: 'erik.hoffmann@email.com',
        phone: '+49 151 23456789',
        dob: '1979-12-03',
        nationality: 'German',
        idType: 'passport',
        idNumber: 'C9XK24T1',
        isPrimary: true,
        identityVerified: true,
      },
      {
        id: 'occ-9',
        name: 'Julia Hoffmann',
        category: 'adult',
        email: 'julia.hoffmann@email.com',
        phone: '+49 151 23456790',
        dob: '1981-05-17',
        nationality: 'German',
        idType: 'passport',
        idNumber: 'C9XK24T2',
        isPrimary: false,
        identityVerified: true,
      },
    ],
    identity: seedIdentity({
      status: 'verified',
      submittedAt: '2026-07-18T09:00:00Z',
      verifiedAt: '2026-07-19T11:00:00Z',
      idName: 'Erik Hoffmann',
      idDocName: 'Passport — Erik Hoffmann',
    }),
    bookingNote: '** THIS RESERVATION HAS BEEN PRE-PAID ** BOOKING NOTE : Payment charge is EUR 1280.00 Approximate time of arrival: between 15:00 and 16:00 Meal Plan: There is no meal option with this room. Smoking Preference: Non-Smoking Payment Collect: OTA collect OTA Commission: 128.00',
    activity: [
      {
        id: 'act-lex1-1',
        type: 'reservation',
        title: 'Reservation Confirmed',
        description: 'Booking for 5 nights at Villa Luwa.',
        actor: 'System',
        timestamp: '2026-07-05T08:00:00Z',
        colorDot: 'green',
      },
      {
        id: 'act-lex1-2',
        type: 'guide_sent',
        title: 'Guest Guide Sent',
        description: 'Welcome guide shared via WhatsApp.',
        actor: 'Komang Juliantara',
        timestamp: '2026-07-20T10:00:00Z',
        channel: 'WhatsApp',
        colorDot: 'gold',
      },
      {
        id: 'act-lex1-3',
        type: 'message',
        title: 'Guest checked in',
        description: 'Arrived and welcomed by staff.',
        actor: 'Erik Hoffmann',
        timestamp: '2026-07-21T15:20:00Z',
        channel: 'WhatsApp',
        colorDot: 'green',
      },
      {
        id: 'act-lex1-4',
        type: 'cleaning',
        title: 'Cleaning Completed',
        description: 'Mid-stay clean finished.',
        actor: 'Made Surya',
        timestamp: '2026-07-23T13:00:00Z',
        colorDot: 'gold',
      },
      {
        id: 'act-lex1-5',
        type: 'message',
        title: 'Guest checked out',
        description: 'Departed. Property inspected and left in good condition.',
        actor: 'Erik Hoffmann',
        timestamp: '2026-07-26T11:00:00Z',
        channel: 'WhatsApp',
        colorDot: 'blue',
      },
    ],
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
    priceDetails: {
      subtotal: 1100,
      cleaningFee: 40,
      serviceFee: 0,
      tax: 60,
      extras: 0,
      guestPaid: 1200,
      commission: 0,
      payout: 1200,
    },
    status: 'verified',
    guests: [
      {
        id: 'occ-10',
        name: 'Marta Kowalski',
        category: 'adult',
        email: 'marta.kowalski@email.com',
        phone: '+48 600 123456',
        dob: '1991-08-14',
        nationality: 'Polish',
        idType: 'passport',
        idNumber: 'EK2509147',
        isPrimary: true,
        identityVerified: true,
      },
      {
        id: 'occ-11',
        name: 'Tomasz Kowalski',
        category: 'adult',
        email: 'tomasz.kowalski@email.com',
        phone: '+48 600 123457',
        dob: '1989-02-26',
        nationality: 'Polish',
        idType: 'passport',
        idNumber: 'EK2408015',
        isPrimary: false,
        identityVerified: true,
      },
      {
        id: 'occ-12',
        name: 'Hanna Kowalski',
        category: 'child',
        dob: '2018-04-30',
        nationality: 'Polish',
        idType: 'passport',
        idNumber: 'EK1809032',
        isPrimary: false,
      },
    ],
    identity: seedIdentity({
      status: 'pending',
      submittedAt: '2026-08-05T12:00:00Z',
      idName: 'Marta Kowalski',
      idDocName: 'Passport — Marta Kowalski',
    }),
    bookingNote: '** THIS RESERVATION HAS BEEN PRE-PAID ** BOOKING NOTE : Payment charge is EUR 1200.00 Approximate time of arrival: between 13:00 and 14:00 Meal Plan: There is no meal option with this room. Smoking Preference: Non-Smoking Payment Collect: Direct Payment OTA Commission: 0.00',
    activity: [
      {
        id: 'act-lex8-1',
        type: 'reservation',
        title: 'Reservation Confirmed',
        description: 'Direct booking for 5 nights at Villa Zeitreise.',
        actor: 'System',
        timestamp: '2026-07-28T09:00:00Z',
        colorDot: 'green',
      },
      {
        id: 'act-lex8-2',
        type: 'reservation',
        title: 'Full Payment Received',
        description: 'EUR 1200 paid in full via direct transfer.',
        actor: 'System',
        timestamp: '2026-07-29T11:30:00Z',
        colorDot: 'green',
      },
      {
        id: 'act-lex8-3',
        type: 'message',
        title: 'Guest asked about check-in details',
        description: 'Requested directions and parking information.',
        actor: 'Marta Kowalski',
        timestamp: '2026-08-07T18:20:00Z',
        channel: 'Email',
        colorDot: 'blue',
      },
      {
        id: 'act-lex8-4',
        type: 'guide_sent',
        title: 'Guest Guide Sent',
        description: 'Welcome guide shared via email.',
        actor: 'Komang Juliantara',
        timestamp: '2026-08-07T19:00:00Z',
        channel: 'Email',
        colorDot: 'gold',
      },
    ],
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
    priceDetails: {
      subtotal: 2310,
      cleaningFee: 75,
      serviceFee: 0,
      tax: 75,
      extras: 0,
      guestPaid: 2460,
      commission: 246,
      payout: 2214,
    },
    status: 'unverified',
    guests: [
      {
        id: 'occ-13',
        name: 'Anna Brunner',
        category: 'adult',
        email: 'anna.brunner@email.com',
        phone: '+43 660 1234567',
        dob: '1985-10-09',
        nationality: 'Austrian',
        idType: 'passport',
        idNumber: 'P3098217',
        isPrimary: true,
        identityVerified: true,
      },
      {
        id: 'occ-14',
        name: 'Stefan Brunner',
        category: 'adult',
        email: 'stefan.brunner@email.com',
        phone: '+43 660 1234568',
        dob: '1983-03-30',
        nationality: 'Austrian',
        idType: 'passport',
        idNumber: 'P3104521',
        isPrimary: false,
      },
    ],
    identity: seedIdentity({
      status: 'pending',
      submittedAt: '2026-08-14T16:00:00Z',
      idName: 'Anna Brunner',
      idDocName: 'Passport — Anna Brunner',
    }),
    bookingNote: '** THIS RESERVATION HAS BEEN PRE-PAID ** BOOKING NOTE : Payment charge is EUR 2460.00 Approximate time of arrival: between 20:00 and 21:00 Meal Plan: There is no meal option with this room. Smoking Preference: Non-Smoking Payment Collect: OTA collect OTA Commission: 246.00',
    activity: [
      {
        id: 'act-lex2-1',
        type: 'reservation',
        title: 'Reservation Confirmed',
        description: 'Booking for 7 nights at Villa Bergfried.',
        actor: 'System',
        timestamp: '2026-08-01T10:00:00Z',
        colorDot: 'green',
      },
      {
        id: 'act-lex2-2',
        type: 'message',
        title: 'Guest asked about early check-in',
        description: 'Requested early check-in around 14:00.',
        actor: 'Anna Brunner',
        timestamp: '2026-08-14T15:30:00Z',
        channel: 'Airbnb',
        colorDot: 'blue',
      },
      {
        id: 'act-lex2-3',
        type: 'reservation',
        title: 'Downpayment Received',
        description: 'EUR 800 downpayment paid via payment link.',
        actor: 'System',
        timestamp: '2026-08-15T09:45:00Z',
        colorDot: 'green',
      },
    ],
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
    guestCount: 3,
    totalPrice: 640,
    currency: 'USD',
    priceDetails: {
      subtotal: 600,
      cleaningFee: 25,
      serviceFee: 0,
      tax: 15,
      extras: 0,
      guestPaid: 640,
      commission: 64,
      payout: 576,
    },
    status: 'checked_in',
    conversationId: 'conv-3',
    paymentRequestId: 'pr-006',
    guestGuideId: 'ggl-mock-002',
    upsellIds: ['ord-003'],
    guests: [
      {
        id: 'occ-1',
        name: 'Emily Chen',
        category: 'adult',
        email: 'emily.chen@email.com',
        phone: '+65 8123 4567',
        dob: '1992-04-18',
        nationality: 'Singaporean',
        idType: 'passport',
        idNumber: 'E4829137',
        isPrimary: true,
        identityVerified: true,
      },
      {
        id: 'occ-2',
        name: 'Daniel Chen',
        category: 'adult',
        email: 'daniel.chen@email.com',
        phone: '+65 8123 8901',
        dob: '1990-11-02',
        nationality: 'Singaporean',
        idType: 'passport',
        idNumber: 'E5012478',
        isPrimary: false,
        identityVerified: true,
      },
      {
        id: 'occ-3',
        name: 'Lily Chen',
        category: 'child',
        dob: '2019-06-23',
        nationality: 'Singaporean',
        idType: 'passport',
        idNumber: 'E7781902',
        isPrimary: false,
      },
    ],
    identity: seedIdentity({
      status: 'verified',
      submittedAt: '2026-08-02T14:00:00Z',
      verifiedAt: '2026-08-03T10:30:00Z',
      idName: 'Emily Chen',
      idDocName: 'Passport — Emily Chen',
    }),
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
  // Multi-room booking — 2 rooms in one reservation
  {
    id: 'res-multi-1',
    guestId: 'guest-7',
    guestName: 'Nathan Hale',
    guestEmail: 'nathan.hale@email.com',
    guestPhone: '+1 555-0198',
    guestLanguage: 'English',
    guestNotes: 'Family reunion. Early check-in requested for the grandparents.',
    listingId: 'lst-1',
    listingName: '5BR Pool the R Villa Luwa – Serene near Canggu',
    channel: 'Direct',
    checkIn: '2026-09-12',
    checkOut: '2026-09-16',
    nights: 4,
    guestCount: 5,
    guestAdults: 4,
    guestChildren: 1,
    guestInfants: 0,
    totalPrice: 1000,
    currency: 'USD',
    status: 'verified',
    guestFirstName: 'Nathan',
    guestLastName: 'Hale',
    guestAddress: '221 Oak Avenue',
    guestCity: 'Austin',
    guestZip: '73301',
    guestCountry: 'United States',
    estimatedArrivalTime: '14:30',
    bookingMode: 'rooms',
    paymentFeeMode: 'card',
    priceDetails: {
      subtotal: 1000,
      cleaningFee: 85,
      serviceFee: 0,
      tax: 25,
      extras: 0,
      guestPaid: 1143,
      commission: 114,
      payout: 1029,
    },
    rooms: [
      {
        id: 'room-multi-1',
        unitTypeId: 'ut-1',
        unitId: 'un-1',
        unitName: 'Master Suite',
        ratePlanId: 'rp-1',
        rateLabel: 'Kingbed — Standard Rate',
        pricePerNight: 100,
        lineTotal: 400,
        priceMode: 'per_night',
        guestNames: 'Nathan & Laura Hale',
      },
      {
        id: 'room-multi-2',
        unitTypeId: 'ut-2',
        unitId: 'un-3',
        unitName: 'Pool Unit',
        ratePlanId: 'rp-2',
        rateLabel: 'Single Bed — Standard Rate',
        pricePerNight: 75,
        lineTotal: 300,
        priceMode: 'per_night',
        guestNames: 'Grandma & Grandpa',
      },
      {
        id: 'room-multi-3',
        unitTypeId: 'ut-2',
        unitId: 'un-4',
        unitName: 'Loft Unit',
        ratePlanId: 'rp-2',
        rateLabel: 'Single Bed — Standard Rate',
        pricePerNight: 75,
        lineTotal: 300,
        priceMode: 'per_stay',
        pricePerStay: 300,
        guestNames: 'Kids',
      },
    ],
    charges: [
      { id: 'chg-multi-1', kind: 'cleaning', label: 'Cleaning Fee', amount: 85 },
      { id: 'chg-multi-2', kind: 'city_tax', label: 'City Tax', amount: 25 },
    ],
    activity: [
      {
        id: 'act-multi-1',
        type: 'reservation',
        title: 'Reservation Confirmed',
        description: 'Direct multi-room booking for 3 rooms at Villa Luwa.',
        actor: 'Komang Juliantara',
        timestamp: '2026-08-18T10:20:00Z',
        colorDot: 'green',
      },
      {
        id: 'act-multi-2',
        type: 'message',
        title: 'Guest asked about early check-in',
        description: 'Requested 14:30 arrival for the grandparents.',
        actor: 'Nathan Hale',
        timestamp: '2026-08-19T09:05:00Z',
        channel: 'WhatsApp',
        colorDot: 'blue',
      },
    ],
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
  {
    id: 'guest-7',
    name: 'Nathan Hale',
    email: 'nathan.hale@email.com',
    phone: '+1 555-0198',
    language: 'English',
    notes: 'Books multiple rooms for family reunions. Prefers early check-in.',
    previousStays: 1,
    tags: ['Family', 'Multi-room'],
    createdAt: '2026-08-18',
  },
]

// Convenience: helper to compute nights between two ISO dates
export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T00:00:00Z`)
  const end = new Date(`${checkOut}T00:00:00Z`)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

// Build a tiny SVG data-URI placeholder so mock documents can be previewed/downloaded
function docDataUri(label: string, tone: 'green' | 'amber' | 'blue'): string {
  const bg = tone === 'green' ? '#e7f6ec' : tone === 'amber' ? '#fdf3e3' : '#e8f0fe'
  const fg = tone === 'green' ? '#1d7a44' : tone === 'amber' ? '#92600a' : '#1a56c4'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="100%" height="100%" fill="${bg}"/><rect x="40" y="40" width="520" height="720" fill="none" stroke="${fg}" stroke-width="2"/><text x="300" y="380" font-family="Arial" font-size="30" fill="${fg}" text-anchor="middle" font-weight="bold">${label}</text><text x="300" y="430" font-family="Arial" font-size="18" fill="${fg}" text-anchor="middle">Mock document preview</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// Seed identity verification + documents for a reservation
export function seedIdentity(partial: {
  status: IdentityVerificationStatus
  submittedAt?: string
  verifiedAt?: string
  idName: string
  idDocName: string
  hasSelfie?: boolean
  hasSignature?: boolean
  hasAgreement?: boolean
}): IdentityVerification {
  const docs: GuestDocument[] = []
  if (partial.hasSelfie !== false) {
    docs.push({
      id: `doc-selfie-${partial.idName.toLowerCase().replace(/[^a-z]+/g, '-')}`,
      kind: 'selfie',
      name: 'Guest selfie',
      url: docDataUri('SELFIE', 'blue'),
      uploadedAt: partial.submittedAt ?? '',
      fileName: 'selfie.jpg',
    })
  }
  docs.push({
    id: `doc-id-${partial.idName.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    kind: 'id',
    name: partial.idDocName,
    url: docDataUri(partial.idDocName, 'green'),
    uploadedAt: partial.submittedAt ?? '',
    fileName: 'id-document.jpg',
  })
  if (partial.hasSignature !== false) {
    docs.push({
      id: `doc-sign-${partial.idName.toLowerCase().replace(/[^a-z]+/g, '-')}`,
      kind: 'signature',
      name: 'Guest signature',
      url: docDataUri('SIGNATURE', 'amber'),
      uploadedAt: partial.submittedAt ?? '',
      fileName: 'signature.png',
    })
  }
  if (partial.hasAgreement !== false) {
    docs.push({
      id: `doc-agree-${partial.idName.toLowerCase().replace(/[^a-z]+/g, '-')}`,
      kind: 'agreement',
      name: 'House Rules Agreement (PDF)',
      url: docDataUri('HOUSE RULES AGREEMENT', 'blue'),
      uploadedAt: partial.submittedAt ?? '',
      fileName: 'house-rules-agreement.pdf',
    })
  }
  return { status: partial.status, submittedAt: partial.submittedAt, verifiedAt: partial.verifiedAt, documents: docs }
}
