import { ref, computed } from 'vue'

export type OverrideAudience = 'future' | 'current' | 'inquiry'

export interface TimeSlot {
  id: string
  start: string // 24h "HH:MM"
  end: string
}

export interface DayHours {
  enabled: boolean
  slots: TimeSlot[]
  activeFor: OverrideAudience[]
}

export interface DateOverride {
  id: string
  startDate: string // ISO date
  startTime: string // "HH:MM"
  endDate: string
  endTime: string
  activeFor: OverrideAudience[]
}

export interface AiSchedule {
  always: boolean // 24/7 availability
  days: DayHours[] // 7 entries, Mon..Sun
  dateOverrides: DateOverride[]
}

export interface ListingStats {
  monthlyRevenue: number
  revenueTrend: number
  occupancyRate: number
  occupancyTrend: number
  avgRating: number
  totalReviews: number
}

export interface ListingPricing {
  nightlyRate: number
  cleaningFee: number
  serviceFee: number
  weeklyDiscount: number
  monthlyDiscount: number
  seasonalRates: Array<{ startDate: string, endDate: string, rate: number, label: string }>
}

export interface Booking {
  id: string
  guestName: string
  checkIn: string
  checkOut: string
  nights: number
  status: 'confirmed' | 'pending' | 'cancelled'
  revenue: number
  source: string
  hasPet?: boolean
}

export interface Review {
  id: string
  guestName: string
  date: string
  rating: number
  text: string
  hostReply?: string
  categories: {
    cleanliness: number
    communication: number
    location: number
    value: number
  }
}

export interface MaintenanceTask {
  id: string
  title: string
  date: string
  assignedTo: string
  status: 'pending' | 'in_progress' | 'completed'
  type: 'cleaning' | 'repair' | 'inspection'
}

export interface ListingMaintenance {
  cleaningSchedule: Array<{ task: string, frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' }>
  tasks: MaintenanceTask[]
}

export interface ListingDocument {
  id: string
  name: string
  url: string
  size: number
  uploadedAt: string
}

export type ReservationStage = 'future' | 'inquiry_past' | 'current'

export interface FieldConfig {
  stages: ReservationStage[]
}

export interface ListingResources {
  documents: ListingDocument[]
  basics: {
    description?: string
    houseRules?: string
    neighborhood?: string
    checkInTime?: string
    checkOutTime?: string
  }
  listingDetails?: string
  sops?: string
  topicsToAvoid?: string[]
  propertyUpsells?: string[]
  fieldConfig?: Record<string, FieldConfig>
}

export interface Unit {
  id: string
  name: string
  identifier?: string
  status?: 'active' | 'inactive'
  otaConnected?: string[]
}

export interface Bed {
  id: string
  type: string
  count: number
}

export interface RatePlan {
  id: string
  name: string
  pricePerNight: number
  pricePerAdditionalGuest: number
  isBase: boolean
}

export interface RatePlanOffering {
  id: string
  name: string
  adjustmentType: 'fixed' | 'percent'
  adjustmentValue: number
}

export interface LengthOfStayDiscount {
  id: string
  minNights: number
  discountType: 'percent' | 'fixed'
  value: number
}

export interface Fee {
  id: string
  name: string
  enabled: boolean
  amount: number
  type: 'cleaning' | 'early_checkin' | 'late_checkout'
}

export interface UnitTypePricing {
  currency: string
  ratePlans: RatePlan[]
  offerings: RatePlanOffering[]
  lengthOfStayDiscounts: LengthOfStayDiscount[]
  fees: Fee[]
}

export interface UnitType {
  id: string
  name: string
  identifier?: string
  description?: string
  quantity: number
  maxAdults: number
  maxChildren: number
  maxInfants: number
  bedrooms: number
  bathrooms: number
  beds: Bed[]
  photos: string[]
  pricing: UnitTypePricing
  aiStatus?: 'active' | 'paused' | 'not_set'
  units: Unit[]
}

export interface Listing {
  id: string
  name: string
  property: string
  location: string
  tags: string[]
  otaConnected: string[]
  amenities: string[]
  room: string
  unitTypes?: UnitType[]
  activeUnitId?: string
  capacity: number
  aiStatus: 'active' | 'paused' | 'not_set'
  status?: 'active' | 'inactive'
  unitType: 'single' | 'multi'
  photos: string[]
  aiSchedule: AiSchedule
  stats: ListingStats
  pricing: ListingPricing
  bookings: Booking[]
  blockedDates: string[]
  reviews: Review[]
  maintenance: ListingMaintenance
  resources: ListingResources
  // Guest guide fallback fields (top-level because they are property facts,
  // not "resource documents")
  wifiSsid?: string
  wifiPassword?: string
  checkInInstructions?: string
  checkOutInstructions?: string
}

export function getUnits(listing: Listing): Unit[] {
  return listing.unitTypes?.flatMap(ut => ut.units) ?? []
}

export function getUnitTypes(listing: Listing): UnitType[] {
  return listing.unitTypes ?? []
}

export function getUnitById(listing: Listing, unitId: string): Unit | undefined {
  return getUnits(listing).find(u => u.id === unitId)
}

export function getUnitTypeForUnit(listing: Listing, unitId: string): UnitType | undefined {
  return listing.unitTypes?.find(ut => ut.units.some(u => u.id === unitId))
}

function alwaysOn(): AiSchedule {
  return {
    always: true,
    days: Array.from({ length: 7 }, () => ({ enabled: true, slots: [{ id: 'ts-0', start: '00:00', end: '23:59' }], activeFor: ['future', 'current', 'inquiry'] as OverrideAudience[] })),
    dateOverrides: [],
  }
}

export const listings = ref<Listing[]>([
  {
    id: 'lst-1',
    name: '5BR Pool the R Villa Luwa – Serene near Canggu',
    property: 'Canggu Properties',
    location: 'Canggu, Bali',
    tags: ['Canggu', 'Pool', '4BR'],
    otaConnected: ['Airbnb'],
    amenities: ['Pool', 'WiFi', 'AC', 'Kitchen', 'Parking', 'Garden'],
    room: 'Master Suite',
    unitTypes: [
      {
        id: 'ut-1',
        name: 'Kingbed',
        identifier: 'king',
        description: 'Spacious room with king-size bed and garden view',
        quantity: 2,
        maxAdults: 2,
        maxChildren: 1,
        maxInfants: 1,
        bedrooms: 1,
        bathrooms: 1,
        beds: [{ id: 'bed-1', type: 'Double Bed', count: 1 }],
        photos: [
          'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop',
        ],
        pricing: {
          currency: 'USD',
          ratePlans: [
            { id: 'rp-1', name: 'Standard Rate', pricePerNight: 100, pricePerAdditionalGuest: 50, isBase: true },
          ],
          offerings: [],
          lengthOfStayDiscounts: [],
          fees: [
            { id: 'fee-1', name: 'Cleaning Fee', enabled: true, amount: 50, type: 'cleaning' },
            { id: 'fee-2', name: 'Early Check-in Fee', enabled: false, amount: 25, type: 'early_checkin' },
            { id: 'fee-3', name: 'Late Check-out Fee', enabled: false, amount: 25, type: 'late_checkout' },
          ],
        },
        aiStatus: 'active',
        units: [
          { id: 'un-1', name: 'Master Suite', identifier: 'K1' },
          { id: 'un-2', name: 'Garden Unit', identifier: 'K2' },
        ],
      },
      {
        id: 'ut-2',
        name: 'Single Bed',
        identifier: 'single',
        description: 'Cozy room with single beds',
        quantity: 2,
        maxAdults: 2,
        maxChildren: 0,
        maxInfants: 0,
        bedrooms: 1,
        bathrooms: 1,
        beds: [{ id: 'bed-2', type: 'Single Bed', count: 2 }],
        photos: [
          'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&h=600&fit=crop',
        ],
        pricing: {
          currency: 'USD',
          ratePlans: [
            { id: 'rp-2', name: 'Standard Rate', pricePerNight: 75, pricePerAdditionalGuest: 30, isBase: true },
          ],
          offerings: [],
          lengthOfStayDiscounts: [],
          fees: [
            { id: 'fee-4', name: 'Cleaning Fee', enabled: true, amount: 35, type: 'cleaning' },
            { id: 'fee-5', name: 'Early Check-in Fee', enabled: false, amount: 20, type: 'early_checkin' },
            { id: 'fee-6', name: 'Late Check-out Fee', enabled: false, amount: 20, type: 'late_checkout' },
          ],
        },
        aiStatus: 'active',
        units: [
          { id: 'un-3', name: 'Pool Unit', identifier: 'S1' },
          { id: 'un-4', name: 'Loft Unit', identifier: 'S2' },
        ],
      },
    ],
    capacity: 10,
    aiStatus: 'active',
    unitType: 'multi',
    photos: [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
    ],
    aiSchedule: {
      always: false,
      days: [
        { enabled: true, slots: [{ id: 'ts-0', start: '08:00', end: '22:00' }], activeFor: ['future', 'current', 'inquiry'] },
        { enabled: true, slots: [{ id: 'ts-0', start: '08:00', end: '22:00' }], activeFor: ['future', 'current', 'inquiry'] },
        { enabled: true, slots: [{ id: 'ts-0', start: '08:00', end: '12:00' }, { id: 'ts-1', start: '14:00', end: '22:00' }], activeFor: ['future', 'current', 'inquiry'] },
        { enabled: true, slots: [{ id: 'ts-0', start: '08:00', end: '22:00' }], activeFor: ['future', 'current', 'inquiry'] },
        { enabled: true, slots: [{ id: 'ts-0', start: '08:00', end: '22:00' }], activeFor: ['future', 'current', 'inquiry'] },
        { enabled: false, slots: [{ id: 'ts-0', start: '00:00', end: '23:59' }], activeFor: ['future', 'current', 'inquiry'] },
        { enabled: false, slots: [{ id: 'ts-0', start: '00:00', end: '23:59' }], activeFor: ['future', 'current', 'inquiry'] },
      ],
      dateOverrides: [],
    },
    stats: {
      monthlyRevenue: 4280,
      revenueTrend: 12,
      occupancyRate: 78,
      occupancyTrend: 5,
      avgRating: 4.8,
      totalReviews: 24,
    },
    pricing: {
      nightlyRate: 185,
      cleaningFee: 45,
      serviceFee: 25,
      weeklyDiscount: 10,
      monthlyDiscount: 20,
      seasonalRates: [
        { startDate: '2026-07-01', endDate: '2026-08-31', rate: 220, label: 'Peak Season' },
        { startDate: '2026-12-20', endDate: '2027-01-05', rate: 250, label: 'Holiday' },
      ],
    },
    bookings: [
      { id: 'bk-1', guestName: 'Sarah Mitchell', checkIn: '2026-06-05', checkOut: '2026-06-09', nights: 4, status: 'confirmed', revenue: 740, source: 'Airbnb', hasPet: true },
      { id: 'bk-2', guestName: 'James Kim', checkIn: '2026-06-12', checkOut: '2026-06-15', nights: 3, status: 'confirmed', revenue: 555, source: 'Booking.com' },
      { id: 'bk-3', guestName: 'Emma Wilson', checkIn: '2026-06-20', checkOut: '2026-06-25', nights: 5, status: 'pending', revenue: 925, source: 'Airbnb', hasPet: true },
    ],
    blockedDates: ['2026-06-10', '2026-06-11'],
    reviews: [
      { id: 'rv-1', guestName: 'Sarah Mitchell', date: '2026-05-20', rating: 5, text: 'Amazing villa! The pool was perfect and staff was incredibly helpful. Would definitely come back.', categories: { cleanliness: 5, communication: 5, location: 4, value: 5 } },
      { id: 'rv-2', guestName: 'David Lee', date: '2026-05-10', rating: 4, text: 'Great location and beautiful property. WiFi could be better but overall a wonderful stay.', hostReply: 'Thank you David! We have upgraded our WiFi since your visit.', categories: { cleanliness: 4, communication: 5, location: 5, value: 4 } },
      { id: 'rv-3', guestName: 'Anna Chen', date: '2026-04-28', rating: 5, text: 'Absolutely stunning property. The garden is beautiful and the rooms are spacious and clean.', categories: { cleanliness: 5, communication: 5, location: 5, value: 5 } },
    ],
    maintenance: {
      cleaningSchedule: [
        { task: 'Pool cleaning', frequency: 'daily' },
        { task: 'Garden maintenance', frequency: 'weekly' },
        { task: 'Deep clean', frequency: 'biweekly' },
        { task: 'AC filter replacement', frequency: 'monthly' },
      ],
      tasks: [
        { id: 'mt-1', title: 'Fix leaking faucet - Master bathroom', date: '2026-06-03', assignedTo: 'Wayan Adi', status: 'pending', type: 'repair' },
        { id: 'mt-2', title: 'Pre-arrival deep clean', date: '2026-06-04', assignedTo: 'Made Surya', status: 'in_progress', type: 'cleaning' },
        { id: 'mt-3', title: 'Pool pump inspection', date: '2026-05-28', assignedTo: 'Wayan Adi', status: 'completed', type: 'inspection' },
      ],
    },
    resources: {
      documents: [
        { id: 'doc-1', name: 'Villa_Luwa_Info.pdf', url: '', size: 245000, uploadedAt: '2026-05-15' },
        { id: 'doc-2', name: 'SOPs_Template.docx', url: '', size: 89000, uploadedAt: '2026-05-20' },
      ],
      basics: {
        description: 'A serene 5-bedroom villa with private pool near Canggu beach. Perfect for families and groups seeking a luxurious Bali experience with modern amenities and traditional Balinese architecture.',
        checkInTime: '14:00',
        checkOutTime: '11:00',
        houseRules: 'No smoking inside\nNo parties or events\nQuiet hours after 10pm\nCheck-out by 11:00 AM',
      },
      topicsToAvoid: ['competitor pricing', 'refund disputes'],
      propertyUpsells: [],
    },
    wifiSsid: 'VillaBali_5G',
    wifiPassword: 'serenity2026',
    checkInInstructions: 'Our staff will meet you at the gate. Look for the welcome sign with your name.',
    checkOutInstructions: 'Leave the keys on the kitchen counter. Safe travels!',
  },
  {
    id: 'lst-2',
    name: 'Apartments Pool',
    property: 'Seminyak Suites',
    location: 'Seminyak, Bali',
    tags: ['Seminyak', 'Rooftop'],
    otaConnected: ['Booking.com'],
    amenities: ['Pool', 'WiFi', 'AC', 'Kitchen', 'Rooftop Deck'],
    room: 'Studio Suite',
    capacity: 4,
    aiStatus: 'active',
    unitType: 'multi',
    photos: [
      'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-3',
    name: 'The R Pererenan Mezzanine Studio + Plunge Pool',
    property: 'Canggu Properties',
    location: 'Pererenan, Bali',
    tags: ['Canggu', 'Beachfront', 'Pool'],
    otaConnected: ['Airbnb'],
    amenities: ['Plunge Pool', 'WiFi', 'AC', 'Beach Access'],
    room: 'Mezzanine Studio',
    capacity: 2,
    aiStatus: 'active',
    unitType: 'multi',
    photos: [
      'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [
      { id: 'bk-3b', guestName: 'Reto Wyss', checkIn: '2026-06-22', checkOut: '2026-06-25', nights: 3, status: 'confirmed', revenue: 360, source: 'Direct' },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-4',
    name: 'The R Villa Merapi',
    property: 'Umalas Villas',
    location: 'Umalas, Bali',
    tags: ['Umalas', 'Pool', 'Private'],
    otaConnected: ['Airbnb'],
    amenities: ['Pool', 'WiFi', 'AC', 'Kitchen', 'Garden', 'Parking'],
    room: '4-Bedroom Villa',
    capacity: 8,
    aiStatus: 'active',
    unitType: 'multi',
    photos: [
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [
      { id: 'bk-4', guestName: 'Thomas Wikes', checkIn: '2026-06-21', checkOut: '2026-06-24', nights: 3, status: 'confirmed', revenue: 360, source: 'Direct' },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-5',
    name: 'Nomad Mansion Garden',
    property: 'Ubud Retreats',
    location: 'Ubud, Bali',
    tags: ['Ubud', 'Rice Terrace', 'Yoga'],
    otaConnected: ['Airbnb'],
    amenities: ['WiFi', 'AC', 'Garden', 'Yoga Deck'],
    room: 'Garden Room',
    capacity: 2,
    aiStatus: 'paused',
    unitType: 'single',
    photos: [
      'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [
      { id: 'bk-5', guestName: 'Mate Bezdek', checkIn: '2026-06-22', checkOut: '2026-06-25', nights: 3, status: 'confirmed', revenue: 390, source: 'Airbnb' },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-6',
    name: 'Nomad Mansion Pool',
    property: 'Ubud Retreats',
    location: 'Ubud, Bali',
    tags: ['Ubud', 'Pool'],
    otaConnected: ['Booking.com'],
    amenities: ['Pool', 'WiFi', 'AC', 'Kitchen'],
    room: 'Pool Villa',
    capacity: 4,
    aiStatus: 'active',
    unitType: 'multi',
    photos: [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [
      { id: 'bk-6', guestName: 'Nina Schwarz', checkIn: '2026-06-23', checkOut: '2026-06-26', nights: 3, status: 'confirmed', revenue: 450, source: 'Booking.com', hasPet: true },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-7',
    name: 'Apartments Main',
    property: 'Seminyak Suites',
    location: 'Seminyak, Bali',
    tags: ['Seminyak', 'Rooftop'],
    otaConnected: ['Booking.com', 'Airbnb'],
    amenities: ['WiFi', 'AC', 'Rooftop Deck', 'Kitchen'],
    room: '1-Bedroom Suite',
    capacity: 3,
    aiStatus: 'active',
    unitType: 'multi',
    photos: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-8',
    name: 'Villa Sunset Cliff',
    property: 'Uluwatu Villas',
    location: 'Uluwatu, Bali',
    tags: ['Uluwatu', 'Cliff', 'Ocean View', 'Sunset'],
    otaConnected: ['Airbnb'],
    amenities: ['Pool', 'WiFi', 'AC', 'Ocean View', 'Cliff Deck'],
    room: '3-Bedroom Villa',
    capacity: 6,
    aiStatus: 'not_set',
    unitType: 'single',
    photos: [
      'https://images.unsplash.com/photo-1499793983394-12dec4e36d3b?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1549294413-26f195200c16?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [
      { id: 'bk-8', guestName: 'Cameron Skillcorn', checkIn: '2026-06-22', checkOut: '2026-06-25', nights: 3, status: 'confirmed', revenue: 420, source: 'Direct' },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-9',
    name: 'Jungle Treehouse Retreat',
    property: 'Ubud Retreats',
    location: 'Ubud, Bali',
    tags: ['Ubud', 'Jungle', 'Unique'],
    otaConnected: ['Booking.com'],
    amenities: ['WiFi', 'Jungle View', 'Hammock Deck', 'Nature Bath'],
    room: 'Treehouse',
    capacity: 2,
    aiStatus: 'active',
    unitType: 'multi',
    photos: [
      'https://images.unsplash.com/photo-1515496281361-44a3de5b3482?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1416339306562-f3d12fefd36f?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-10',
    name: 'Beachfront Bungalow Seminyak',
    property: 'Seminyak Suites',
    location: 'Seminyak, Bali',
    tags: ['Seminyak', 'Beachfront', 'Pool'],
    otaConnected: ['Airbnb'],
    amenities: ['Pool', 'WiFi', 'AC', 'Beach Access', 'Kitchen'],
    room: 'Bungalow',
    capacity: 4,
    aiStatus: 'active',
    unitType: 'multi',
    photos: [
      'https://images.unsplash.com/photo-1573755111591-8a8e12c93f74?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1615571022219-eb45cf7faa36?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [
      { id: 'bk-10', guestName: 'Robert Chen', checkIn: '2026-06-24', checkOut: '2026-06-27', nights: 3, status: 'confirmed', revenue: 285, source: 'Booking.com' },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-11',
    name: 'Villa Rice Terrace Jimbaran',
    property: 'Jimbaran Villas',
    location: 'Jimbaran, Bali',
    tags: ['Jimbaran', 'Rice Terrace', 'Pool'],
    otaConnected: ['Booking.com'],
    amenities: ['Pool', 'WiFi', 'AC', 'Garden', 'Rice Terrace View'],
    room: '2-Bedroom Villa',
    capacity: 5,
    aiStatus: 'paused',
    unitType: 'single',
    photos: [
      'https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-12',
    name: 'Surf Shack Canggu',
    property: 'Canggu Properties',
    location: 'Canggu, Bali',
    tags: ['Canggu', 'Beachfront', 'Surf'],
    otaConnected: ['Airbnb'],
    amenities: ['WiFi', 'AC', 'Surfboard Storage', 'Beach Access'],
    room: 'Studio',
    capacity: 2,
    aiStatus: 'active',
    unitType: 'multi',
    photos: [
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1468413253725-0d5181091126?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [
      { id: 'bk-12', guestName: 'Marco Silva', checkIn: '2026-06-25', checkOut: '2026-06-28', nights: 3, status: 'confirmed', revenue: 225, source: 'Booking.com' },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-13',
    name: 'Volcano View Villa Kintamani',
    property: 'Kintamani Villas',
    location: 'Kintamani, Bali',
    tags: ['Kintamani', 'Mountain', 'Unique'],
    otaConnected: ['Booking.com'],
    amenities: ['WiFi', 'AC', 'Mountain View', 'Hot Tub', 'Fireplace'],
    room: '3-Bedroom Villa',
    capacity: 6,
    aiStatus: 'not_set',
    unitType: 'single',
    photos: [
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [
      { id: 'bk-13', guestName: 'Reto Wyss', checkIn: '2026-06-26', checkOut: '2026-06-29', nights: 3, status: 'confirmed', revenue: 255, source: 'Airbnb' },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-14',
    name: 'The R Canggu Riverside',
    property: 'Canggu Properties',
    location: 'Canggu, Bali',
    tags: ['Canggu', 'River', 'Pool'],
    otaConnected: ['Airbnb', 'Booking.com'],
    amenities: ['Pool', 'WiFi', 'AC', 'River View', 'Garden'],
    room: '2-Bedroom Suite',
    capacity: 4,
    aiStatus: 'active',
    unitType: 'multi',
    photos: [
      'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-15',
    name: 'Luxury Penthouse Seminyak',
    property: 'Seminyak Suites',
    location: 'Seminyak, Bali',
    tags: ['Seminyak', 'Luxury', 'Rooftop'],
    otaConnected: ['Airbnb'],
    amenities: ['Pool', 'WiFi', 'AC', 'Rooftop Deck', 'Kitchen', 'Ocean View'],
    room: 'Penthouse',
    capacity: 6,
    aiStatus: 'active',
    unitType: 'multi',
    photos: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600585154363-67eb9e2e2099?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-16',
    name: 'Eco Bamboo House Ubud',
    property: 'Ubud Retreats',
    location: 'Ubud, Bali',
    tags: ['Ubud', 'Eco', 'Unique', 'Bamboo'],
    otaConnected: ['Booking.com'],
    amenities: ['WiFi', 'Bamboo Construction', 'Nature Bath', 'Garden'],
    room: 'Bamboo Suite',
    capacity: 2,
    aiStatus: 'active',
    unitType: 'multi',
    photos: [
      'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=800&h=600&fit=crop',
    ],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2800, revenueTrend: 5, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.5, totalReviews: 12 },
    pricing: { nightlyRate: 120, cleaningFee: 30, serviceFee: 20, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  // Multi-room demo: same property + room type
  {
    id: 'lst-17',
    name: 'Apartments Pool - Room 2',
    property: 'Seminyak Suites',
    location: 'Seminyak, Bali',
    tags: ['Seminyak', 'Pool'],
    otaConnected: ['Booking.com'],
    amenities: ['Pool', 'WiFi', 'AC', 'Kitchen'],
    room: 'Studio Suite',
    capacity: 2,
    aiStatus: 'active',
    unitType: 'single',
    photos: ['https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&h=600&fit=crop'],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 1800, revenueTrend: 3, occupancyRate: 55, occupancyTrend: 1, avgRating: 4.3, totalReviews: 6 },
    pricing: { nightlyRate: 95, cleaningFee: 25, serviceFee: 15, weeklyDiscount: 5, monthlyDiscount: 10, seasonalRates: [] },
    bookings: [],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-18',
    name: 'Apartments Pool - Room 3',
    property: 'Seminyak Suites',
    location: 'Seminyak, Bali',
    tags: ['Seminyak', 'Pool'],
    otaConnected: ['Airbnb'],
    amenities: ['Pool', 'WiFi', 'AC'],
    room: 'Studio Suite',
    capacity: 2,
    aiStatus: 'active',
    unitType: 'single',
    photos: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop'],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 1600, revenueTrend: 2, occupancyRate: 48, occupancyTrend: -1, avgRating: 4.1, totalReviews: 4 },
    pricing: { nightlyRate: 85, cleaningFee: 25, serviceFee: 15, weeklyDiscount: 5, monthlyDiscount: 10, seasonalRates: [] },
    bookings: [],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-19',
    name: 'Surf Shack Canggu - Unit 2',
    property: 'Canggu Properties',
    location: 'Canggu, Bali',
    tags: ['Canggu', 'Budget'],
    otaConnected: ['Booking.com'],
    amenities: ['WiFi', 'AC', 'Kitchen'],
    room: 'Studio',
    capacity: 2,
    aiStatus: 'active',
    unitType: 'single',
    photos: ['https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&h=600&fit=crop'],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 1200, revenueTrend: 8, occupancyRate: 60, occupancyTrend: 4, avgRating: 4.4, totalReviews: 8 },
    pricing: { nightlyRate: 75, cleaningFee: 20, serviceFee: 10, weeklyDiscount: 5, monthlyDiscount: 10, seasonalRates: [] },
    bookings: [],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
])

export const allTags = computed(() => [...new Set(listings.value.flatMap(l => l.tags))].sort())

export const allLocations = computed(() => [...new Set(listings.value.map(l => l.location))].sort())

export const allProperties = computed(() => [...new Set(listings.value.map(l => l.property))].sort())

export const allOtas = computed(() => [...new Set(listings.value.flatMap(l => l.otaConnected))].sort())

export const aiStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'not_set', label: 'Not Set' },
]

export const aiStatusLabels: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  not_set: 'Not Set',
}
