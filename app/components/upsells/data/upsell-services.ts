import type { LockAccessConfig } from './lock-access'

export type UpsellCategory
  = | 'Vehicle Rental'
    | 'Airport Transport'
    | 'Private Chef'
    | 'Spa'
    | 'Activity'
    | 'Late Check-out'
    | 'Early Check-in'
    | 'Mid-stay Cleaning'
    | 'Office Equipment'
    | 'Baby'
    | 'Miscellaneous'
    | 'Pet'

export type BookingStatusFilter
  = | 'inquiry'
    | 'confirmed'
    | 'checked_in'
    | 'checked_out'
    | 'cancelled'

export type OtaChannel
  = | 'airbnb'
    | 'booking_com'
    | 'direct'
    | 'agoda'
    | 'vrbo'
    | 'expedia'

export type VisibilityMatchMode = 'all' | 'any'

export type VisibilityConditionKey
  = | 'hoursBeforeCheckIn'
    | 'hoursBeforeCheckOut'
    | 'bookingStatuses'
    | 'guestCountMin'
    | 'guestCountMax'
    | 'lengthOfStayMin'
    | 'lengthOfStayMax'
    | 'excludeIfUpsellPurchased'
    | 'channels'

export interface VisibilityConditions {
  hoursBeforeCheckIn: number | null
  hoursBeforeCheckOut: number | null
  bookingStatuses: BookingStatusFilter[] | null
  guestCountMin: number | null
  guestCountMax: number | null
  lengthOfStayMin: number | null
  lengthOfStayMax: number | null
  excludeIfUpsellPurchased: string[] | null
  channels: OtaChannel[] | null
}

export function emptyVisibilityConditions(): VisibilityConditions {
  return {
    hoursBeforeCheckIn: null,
    hoursBeforeCheckOut: null,
    bookingStatuses: null,
    guestCountMin: null,
    guestCountMax: null,
    lengthOfStayMin: null,
    lengthOfStayMax: null,
    excludeIfUpsellPurchased: null,
    channels: null,
  }
}

export function getConditionDefault(key: VisibilityConditionKey): VisibilityConditions[VisibilityConditionKey] {
  switch (key) {
    case 'hoursBeforeCheckIn':
    case 'hoursBeforeCheckOut':
      return 24
    case 'bookingStatuses':
      return ['confirmed', 'checked_in']
    case 'guestCountMin':
    case 'lengthOfStayMin':
      return 1
    case 'guestCountMax':
    case 'lengthOfStayMax':
      return 10
    case 'excludeIfUpsellPurchased':
      return []
    case 'channels':
      return ['airbnb']
  }
}

export function getConditionEmpty(key: VisibilityConditionKey): VisibilityConditions[VisibilityConditionKey] {
  return null
}

export function summarizeCondition(
  key: VisibilityConditionKey,
  value: VisibilityConditions[VisibilityConditionKey],
): string {
  if (value === null)
    return ''
  switch (key) {
    case 'hoursBeforeCheckIn':
      return `Time before Check-in (within ${value as number}h)`
    case 'hoursBeforeCheckOut':
      return `Time before Check-out (within ${value as number}h)`
    case 'bookingStatuses': {
      const arr = value as BookingStatusFilter[]
      const labels: Record<BookingStatusFilter, string> = {
        inquiry: 'Inquiry',
        confirmed: 'Confirmed',
        checked_in: 'Checked-in',
        checked_out: 'Checked-out',
        cancelled: 'Cancelled',
      }
      return `Booking Status (${arr.map(s => labels[s]).join(', ')})`
    }
    case 'guestCountMin':
      return `Guest Count min (${value as number})`
    case 'guestCountMax':
      return `Guest Count max (${value as number})`
    case 'lengthOfStayMin':
      return `Length of Stay min (${value as number} nights)`
    case 'lengthOfStayMax':
      return `Length of Stay max (${value as number} nights)`
    case 'excludeIfUpsellPurchased': {
      const ids = value as string[]
      return `Related Upsell (${ids.length} selected)`
    }
    case 'channels': {
      const arr = value as OtaChannel[]
      const labels: Record<OtaChannel, string> = {
        airbnb: 'Airbnb',
        booking_com: 'Booking.com',
        direct: 'Direct',
        agoda: 'Agoda',
        vrbo: 'VRBO',
        expedia: 'Expedia',
      }
      return `Channels (${arr.map(c => labels[c]).join(', ')})`
    }
  }
}

export function summarizeVisibility(
  conditions: VisibilityConditions,
): Array<{ key: VisibilityConditionKey, label: string }> {
  const entries: Array<{ key: VisibilityConditionKey, label: string }> = []

  // Time conditions
  if (conditions.hoursBeforeCheckIn !== null) {
    entries.push({
      key: 'hoursBeforeCheckIn',
      label: `Time before Check-in (within ${conditions.hoursBeforeCheckIn}h)`,
    })
  }
  if (conditions.hoursBeforeCheckOut !== null) {
    entries.push({
      key: 'hoursBeforeCheckOut',
      label: `Time before Check-out (within ${conditions.hoursBeforeCheckOut}h)`,
    })
  }

  // Booking statuses
  if (conditions.bookingStatuses !== null) {
    const labels: Record<BookingStatusFilter, string> = {
      inquiry: 'Inquiry',
      confirmed: 'Confirmed',
      checked_in: 'Checked-in',
      checked_out: 'Checked-out',
      cancelled: 'Cancelled',
    }
    entries.push({
      key: 'bookingStatuses',
      label: `Booking Status (${conditions.bookingStatuses.map(s => labels[s]).join(', ')})`,
    })
  }

  // Guest count — combined
  if (conditions.guestCountMin !== null || conditions.guestCountMax !== null) {
    const min = conditions.guestCountMin !== null ? conditions.guestCountMin : 'any'
    const max = conditions.guestCountMax !== null ? conditions.guestCountMax : 'any'
    entries.push({
      key: 'guestCountMin',
      label: `Guest Count (${min}–${max} guests)`,
    })
  }

  // Length of stay — combined
  if (conditions.lengthOfStayMin !== null || conditions.lengthOfStayMax !== null) {
    const min = conditions.lengthOfStayMin !== null ? conditions.lengthOfStayMin : 'any'
    const max = conditions.lengthOfStayMax !== null ? conditions.lengthOfStayMax : 'any'
    entries.push({
      key: 'lengthOfStayMin',
      label: `Length of Stay (${min}–${max} nights)`,
    })
  }

  // Related upsell
  if (conditions.excludeIfUpsellPurchased !== null) {
    entries.push({
      key: 'excludeIfUpsellPurchased',
      label: `Related Upsell (${conditions.excludeIfUpsellPurchased.length} selected)`,
    })
  }

  // Channels
  if (conditions.channels !== null) {
    const labels: Record<OtaChannel, string> = {
      airbnb: 'Airbnb',
      booking_com: 'Booking.com',
      direct: 'Direct',
      agoda: 'Agoda',
      vrbo: 'VRBO',
      expedia: 'Expedia',
    }
    entries.push({
      key: 'channels',
      label: `Channels (${conditions.channels.map(c => labels[c]).join(', ')})`,
    })
  }

  return entries
}

export interface UpsellItem {
  id: string
  name: string
  description?: string
  price: number
  image?: string
}

export interface UpsellService {
  id: string
  name: string
  description: string
  category: UpsellCategory
  currency: string
  image?: string
  youtubeLinks: string[]
  internalNotes: string
  notificationUsers: string[]
  pricingEnabled: boolean
  taxPercent: number
  servicePercent: number
  items: UpsellItem[]
  assignedListings: string[]
  availability: 'always' | 'by_request'
  /**
   * Buying this service hands the guest a smart-lock code. Optional so every existing
   * service keeps working untouched.
   */
  lockAccess?: LockAccessConfig
  status: 'active' | 'inactive'
  visibility: VisibilityConditions
  visibilityMatchMode: VisibilityMatchMode
  createdAt: string
  updatedAt: string
}

export const UPSPELL_CATEGORIES: UpsellCategory[] = [
  'Airport Transport',
  'Vehicle Rental',
  'Private Chef',
  'Spa',
  'Activity',
  'Late Check-out',
  'Early Check-in',
  'Mid-stay Cleaning',
  'Office Equipment',
  'Baby',
  'Pet',
  'Miscellaneous',
]

export const BALI_LISTINGS = [
  'The R Pererenan Mezzanine Studio + Plunge Pool',
  'Cozy 2BR - the R Villa Sinabung w/ Pool in Sanur',
  'The R Villa Merapi',
  'TAMBORA - The R Tambora: Stylish 3BR Tropical Escape',
  'The R Loft - Cosy Suite Kalmantan incl Breakfast',
  'BRATAN - The R Bratan | 3BR- Serene Getaway in Canggu',
  'KABA - Stylish 2BR the R Villa Kaba-Kerobokan+Pool/Bikes',
  'The R Apartments Studio walk to the Beach',
  'Tranquil the R Villa Patuha-Pool/Rice Field Views',
  'Cozy Meets Luxe – 3BR the R Villa Ranakah Stay',
  'Tropical 2BR the R Villa Dempo w/Pool - Pererenan',
  '2BR-Tropical Escape at Villa Toba | Pool & Bikes',
  '5BR Pool the R Villa Luwa – Serene near Canggu',
  'Modern 2BR the R Villa Swantika w/Pool - Pererenan',
  'The R Pererenan Mezzanine Apartment w/ balcony',
  'The R Villa Samalas | 4BR Retreat in Pererenan',
]

export const mockUpsellServices: UpsellService[] = [
  {
    id: 'svc-001',
    name: 'Airport Transfer (Ngurah Rai)',
    description: 'Private airport transfer from Ngurah Rai International Airport to your villa. Includes meet & greet, luggage assistance, and cold towels upon arrival.',
    category: 'Airport Transport',
    currency: 'IDR',
    youtubeLinks: [],
    internalNotes: 'Coordinate with driver 24h before arrival. Confirm flight number.',
    notificationUsers: ['Komang Juliantara'],
    pricingEnabled: true,
    taxPercent: 11,
    servicePercent: 5,
    items: [
      { id: 'itm-001a', name: 'Standard Sedan', description: 'Toyota Avanza or similar. Fits 3 passengers with luggage.', price: 350000 },
      { id: 'itm-001b', name: 'SUV (up to 5 pax)', description: 'Toyota Fortuner or similar. Spacious with AC.', price: 500000 },
      { id: 'itm-001c', name: 'Minivan (up to 8 pax)', description: 'Toyota Hiace or similar. Ideal for groups and families.', price: 650000 },
    ],
    assignedListings: BALI_LISTINGS,
    availability: 'always',
    status: 'active',
    visibility: emptyVisibilityConditions(),
    visibilityMatchMode: 'all',
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-04-20T10:30:00Z',
  },
  {
    id: 'svc-002',
    name: 'Private Chef - Dinner',
    description: 'Experience a private dinner prepared by a local Balinese chef at your villa. Choose from Balinese, Indonesian, or Western menu. Includes appetizer, main course, dessert for up to 4 guests.',
    category: 'Private Chef',
    currency: 'IDR',
    youtubeLinks: [],
    internalNotes: 'Confirm dietary restrictions 48h before. Chef arrives 2h before dinner.',
    notificationUsers: ['Komang Juliantara'],
    pricingEnabled: true,
    taxPercent: 11,
    servicePercent: 5,
    items: [
      { id: 'itm-002a', name: 'Balinese Set Menu', description: 'Lawar, sate lilit, bebek betutu, nasi campur, dessert.', price: 1500000 },
      { id: 'itm-002b', name: 'Seafood BBQ', description: 'Grilled snapper, prawns, squid, clams with Balinese sambal.', price: 1800000 },
      { id: 'itm-002c', name: 'Western Fine Dining', description: 'Beef tenderloin, truffle mash, seasonal vegetables, chocolate fondant.', price: 2200000 },
    ],
    assignedListings: ['TAMBORA - The R Tambora: Stylish 3BR Tropical Escape', 'BRATAN - The R Bratan | 3BR- Serene Getaway in Canggu', 'Cozy Meets Luxe – 3BR the R Villa Ranakah Stay', '5BR Pool the R Villa Luwa – Serene near Canggu', 'The R Villa Samalas | 4BR Retreat in Pererenan'],
    availability: 'by_request',
    status: 'active',
    visibility: emptyVisibilityConditions(),
    visibilityMatchMode: 'all',
    createdAt: '2026-01-20T09:00:00Z',
    updatedAt: '2026-05-01T14:00:00Z',
  },
  {
    id: 'svc-003',
    name: 'In-Villa Spa Treatment',
    description: 'Relaxing in-villa spa treatment with professional therapists. Choose from Balinese massage, aromatherapy, or body scrub. 90-minute session.',
    category: 'Spa',
    currency: 'IDR',
    youtubeLinks: [],
    internalNotes: '',
    notificationUsers: [],
    pricingEnabled: true,
    taxPercent: 11,
    servicePercent: 0,
    items: [
      { id: 'itm-003a', name: 'Balinese Massage', description: 'Traditional deep tissue massage using palm and thumb pressure techniques.', price: 800000 },
      { id: 'itm-003b', name: 'Aromatherapy Massage', description: 'Relaxing massage with essential oils of your choice.', price: 900000 },
      { id: 'itm-003c', name: 'Body Scrub + Massage', description: 'Full body scrub with Balinese boreh spices followed by 60-min massage.', price: 1100000 },
    ],
    assignedListings: BALI_LISTINGS,
    availability: 'always',
    status: 'active',
    visibility: emptyVisibilityConditions(),
    visibilityMatchMode: 'all',
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-03-15T11:00:00Z',
  },
  {
    id: 'svc-004',
    name: 'Ubud Rice Terrace Tour',
    description: 'Full-day guided tour to Tegallalang Rice Terraces, Tirta Empul water temple, and Ubud Monkey Forest. Includes private driver, lunch, and entrance fees.',
    category: 'Activity',
    currency: 'IDR',
    youtubeLinks: [],
    internalNotes: 'Pickup at 8am. Bring sunscreen and comfortable shoes.',
    notificationUsers: ['Komang Juliantara'],
    pricingEnabled: true,
    taxPercent: 11,
    servicePercent: 5,
    items: [
      { id: 'itm-004a', name: 'Group Tour (shared)', description: 'Join a small group of up to 6 guests. Includes shared van and English-speaking guide.', price: 600000 },
      { id: 'itm-004b', name: 'Private Tour', description: 'Dedicated car and guide for your group only. Flexible itinerary.', price: 950000 },
    ],
    assignedListings: BALI_LISTINGS,
    availability: 'by_request',
    status: 'active',
    visibility: emptyVisibilityConditions(),
    visibilityMatchMode: 'all',
    createdAt: '2026-02-10T12:00:00Z',
    updatedAt: '2026-04-05T09:30:00Z',
  },
  {
    id: 'svc-005',
    name: 'Surf Lesson at Canggu',
    description: '2-hour surf lesson with certified instructor at Canggu or Batu Bolong beach. Includes surfboard rental, rash guard, and bottled water. Suitable for beginners.',
    category: 'Activity',
    currency: 'IDR',
    youtubeLinks: [],
    internalNotes: '',
    notificationUsers: [],
    pricingEnabled: true,
    taxPercent: 11,
    servicePercent: 0,
    items: [
      { id: 'itm-005a', name: 'Beginner Lesson', description: 'Learn basics on soft-top longboard. Safety briefing included.', price: 500000 },
      { id: 'itm-005b', name: 'Intermediate Lesson', description: 'Work on duck dives, bottom turns, and reading waves.', price: 600000 },
      { id: 'itm-005c', name: 'Private 1-on-1', description: 'Personalized coaching tailored to your level.', price: 850000 },
    ],
    assignedListings: ['The R Apartments Studio walk to the Beach', 'BRATAN - The R Bratan | 3BR- Serene Getaway in Canggu', '5BR Pool the R Villa Luwa – Serene near Canggu', 'The R Villa Samalas | 4BR Retreat in Pererenan', 'Tropical 2BR the R Villa Dempo w/Pool - Pererenan'],
    availability: 'by_request',
    status: 'active',
    visibility: emptyVisibilityConditions(),
    visibilityMatchMode: 'all',
    createdAt: '2026-02-15T08:00:00Z',
    updatedAt: '2026-04-10T15:00:00Z',
  },
  {
    id: 'svc-006',
    name: 'Late Check-out (until 2pm)',
    description: 'Extend your check-out time until 2:00 PM. Subject to availability and next-day bookings.',
    category: 'Late Check-out',
    currency: 'IDR',
    youtubeLinks: [],
    internalNotes: 'Check next-day booking before confirming.',
    notificationUsers: [],
    pricingEnabled: true,
    taxPercent: 11,
    servicePercent: 0,
    items: [
      { id: 'itm-006a', name: 'Late Check-out', description: 'Extend until 2:00 PM. Subject to next-day booking availability.', price: 450000 },
    ],
    assignedListings: BALI_LISTINGS,
    availability: 'by_request',
    status: 'active',
    visibility: emptyVisibilityConditions(),
    visibilityMatchMode: 'all',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'svc-007',
    name: 'Early Check-in (from 10am)',
    description: 'Check in early from 10:00 AM instead of the standard 3:00 PM. Subject to availability and prior-night bookings.',
    category: 'Early Check-in',
    currency: 'IDR',
    youtubeLinks: [],
    internalNotes: 'Check prior-night booking before confirming.',
    notificationUsers: [],
    pricingEnabled: true,
    taxPercent: 11,
    servicePercent: 0,
    items: [
      { id: 'itm-007a', name: 'Early Check-in', description: 'Check in from 10:00 AM. Subject to prior-night booking availability.', price: 450000 },
    ],
    assignedListings: BALI_LISTINGS,
    availability: 'by_request',
    status: 'active',
    visibility: emptyVisibilityConditions(),
    visibilityMatchMode: 'all',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'svc-008',
    name: 'Vehicle Rental',
    description: 'Vehicle rental delivered to your villa. Includes basic insurance. Perfect for exploring Bali at your own pace.',
    category: 'Vehicle Rental',
    currency: 'IDR',
    youtubeLinks: [],
    internalNotes: 'Collect passport copy for car rental. Scooter requires international license.',
    notificationUsers: ['Komang Juliantara'],
    pricingEnabled: true,
    taxPercent: 11,
    servicePercent: 5,
    items: [
      { id: 'itm-008a', name: 'Scooter (Automatic)', description: 'Honda Vario 125cc. Helmet included. International license required.', price: 120000 },
      { id: 'itm-008b', name: 'Honda Scoopy', description: 'Retro 110cc scooter. Great for short trips around Canggu.', price: 150000 },
      { id: 'itm-008c', name: 'Toyota Avanza', description: '7-seat MPV with AC. Ideal for families.', price: 450000 },
      { id: 'itm-008d', name: 'Toyota Innova', description: '8-seat MPV with AC. Extra luggage space.', price: 650000 },
    ],
    assignedListings: BALI_LISTINGS,
    availability: 'always',
    status: 'active',
    visibility: emptyVisibilityConditions(),
    visibilityMatchMode: 'all',
    createdAt: '2026-03-10T14:00:00Z',
    updatedAt: '2026-05-10T16:00:00Z',
  },
  {
    id: 'svc-009',
    name: 'Baby Equipment Setup',
    description: 'Baby equipment delivered and set up in your villa prior to arrival.',
    category: 'Baby',
    currency: 'IDR',
    youtubeLinks: [],
    internalNotes: 'Set up before guest arrival. Confirm equipment availability.',
    notificationUsers: [],
    pricingEnabled: true,
    taxPercent: 11,
    servicePercent: 0,
    items: [
      { id: 'itm-009a', name: 'Baby Crib', description: 'Portable crib with mattress and fitted sheet. Suitable up to 2 years.', price: 250000 },
      { id: 'itm-009b', name: 'High Chair', description: 'Foldable high chair with tray. Easy to clean.', price: 150000 },
      { id: 'itm-009c', name: 'Baby Crib + High Chair Bundle', description: 'Complete set with crib, high chair, and baby bath.', price: 350000 },
    ],
    assignedListings: ['TAMBORA - The R Tambora: Stylish 3BR Tropical Escape', 'BRATAN - The R Bratan | 3BR- Serene Getaway in Canggu', 'KABA - Stylish 2BR the R Villa Kaba-Kerobokan+Pool/Bikes', 'Cozy Meets Luxe – 3BR the R Villa Ranakah Stay', '5BR Pool the R Villa Luwa – Serene near Canggu'],
    availability: 'always',
    status: 'active',
    visibility: emptyVisibilityConditions(),
    visibilityMatchMode: 'all',
    createdAt: '2026-03-20T11:00:00Z',
    updatedAt: '2026-04-15T08:00:00Z',
  },
  {
    id: 'svc-010',
    name: 'Mid-stay Deep Cleaning',
    description: 'Thorough mid-stay cleaning service including fresh linens, towel replacement, and full villa refresh. Recommended for stays of 5+ nights.',
    category: 'Mid-stay Cleaning',
    currency: 'IDR',
    youtubeLinks: [],
    internalNotes: 'Schedule when guests are out on excursion if possible.',
    notificationUsers: ['Made Surya'],
    pricingEnabled: true,
    taxPercent: 11,
    servicePercent: 0,
    items: [
      { id: 'itm-010a', name: 'Standard Cleaning', description: 'Full villa tidy, bathroom refresh, bed making, trash removal.', price: 400000 },
      { id: 'itm-010b', name: 'Deep Clean + Laundry', description: 'Includes standard cleaning plus fresh linens, towel replacement, and surface deep clean.', price: 600000 },
    ],
    assignedListings: BALI_LISTINGS,
    availability: 'by_request',
    status: 'active',
    visibility: emptyVisibilityConditions(),
    visibilityMatchMode: 'all',
    createdAt: '2026-04-01T09:00:00Z',
    updatedAt: '2026-04-01T09:00:00Z',
  },
  {
    id: 'svc-011',
    name: 'Pool & Wellness Area Access',
    description: 'Unlock the shared pool deck and wellness area for the rest of your stay. Your personal gate code is issued the moment payment goes through.',
    category: 'Activity',
    currency: 'IDR',
    youtubeLinks: [],
    internalNotes: 'Code is issued automatically on payment. No staff action needed.',
    notificationUsers: ['Komang Juliantara'],
    pricingEnabled: true,
    taxPercent: 11,
    servicePercent: 0,
    items: [
      { id: 'itm-011a', name: 'Pool & Wellness Access', description: 'Gate code valid until check-out, for the whole booking party.', price: 350000 },
    ],
    assignedListings: BALI_LISTINGS,
    availability: 'always',
    lockAccess: {
      enabled: true,
      lockNames: ['Pool Gate'],
      instructions: 'The gate is on the left of the pool deck. Enter the code, then press the key symbol.',
    },
    status: 'active',
    visibility: emptyVisibilityConditions(),
    visibilityMatchMode: 'all',
    createdAt: '2026-05-02T09:00:00Z',
    updatedAt: '2026-05-02T09:00:00Z',
  },
  {
    id: 'svc-012',
    name: 'Private Workspace Access',
    description: 'A quiet, air-conditioned office with a standing desk and fibre internet. Door code issued on payment, valid until check-out.',
    category: 'Office Equipment',
    currency: 'IDR',
    youtubeLinks: [],
    internalNotes: 'Confirm the office is not booked by another guest before approving.',
    notificationUsers: ['Komang Juliantara'],
    pricingEnabled: true,
    taxPercent: 11,
    servicePercent: 5,
    items: [
      { id: 'itm-012a', name: 'Workspace Access', description: 'Door code valid until check-out.', price: 500000 },
    ],
    assignedListings: BALI_LISTINGS,
    availability: 'by_request',
    lockAccess: {
      enabled: true,
      lockNames: ['Office Door'],
      instructions: 'The office is at the end of the corridor past the kitchen.',
    },
    status: 'active',
    visibility: emptyVisibilityConditions(),
    visibilityMatchMode: 'all',
    createdAt: '2026-05-02T09:30:00Z',
    updatedAt: '2026-05-02T09:30:00Z',
  },
]
