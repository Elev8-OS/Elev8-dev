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

export type TaxType = 'tax' | 'fee' | 'city_tax'

export type TaxLogic = 'percent' | 'per_room' | 'per_room_per_night' | 'per_person' | 'per_person_per_night' | 'per_night' | 'per_booking'

export interface TaxDateRange {
  after: string
  before: string
}

export interface ListingFeeTaxItem {
  id: string
  title: string
  type: TaxType
  logic: TaxLogic
  rate: number
  currency?: string
  isInclusive: boolean
  skipNights?: number | null
  maxNights?: number | null
  applicableDateRanges: TaxDateRange[]
}

export interface TaxSetTaxRef {
  id: string
  level: number
}

export interface TaxSet {
  id: string
  title: string
  currency?: string
  taxes: TaxSetTaxRef[]
  associatedRatePlanIds: string[]
  isDefault: boolean
}

export interface ListingPricing {
  nightlyRate: number
  cleaningFee: number
  serviceFee: number
  weeklyDiscount: number
  monthlyDiscount: number
  seasonalRates: Array<{ startDate: string, endDate: string, rate: number, label: string }>
  feesTaxes?: ListingFeeTaxItem[]
  taxSets?: TaxSet[]
}

export type BookingType = 'reservation' | 'block'

export type BookingStatus
  = 'unverified'
    | 'verified'
    | 'checked_in'
    | 'checked_out'
    | 'cancelled'
    | 'inquiry'

export interface Booking {
  id: string
  type?: BookingType
  guestName: string
  checkIn: string
  checkOut: string
  nights: number
  adults?: number
  children?: number
  infants?: number
  pets?: number
  status: BookingStatus
  /** For type=block — the reason staff entered when blocking the calendar. */
  blockReason?: string
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
      feesTaxes: [
        {
          id: 'ft-1',
          title: 'Cleaning Fee',
          type: 'fee',
          logic: 'per_booking',
          rate: 45,
          currency: 'USD',
          isInclusive: false,
          skipNights: null,
          maxNights: null,
          applicableDateRanges: [],
        },
        {
          id: 'ft-2',
          title: 'Local Tax',
          type: 'city_tax',
          logic: 'percent',
          rate: 10,
          isInclusive: true,
          skipNights: null,
          maxNights: null,
          applicableDateRanges: [],
        },
      ],
      taxSets: [
        {
          id: 'ts-1',
          title: 'Standard Tax Set',
          currency: 'USD',
          taxes: [
            { id: 'ft-1', level: 1 },
            { id: 'ft-2', level: 0 },
          ],
          associatedRatePlanIds: [],
          isDefault: true,
        },
      ],
    },
    bookings: [
      { id: 'bk-1', guestName: 'Sarah Mitchell', checkIn: '2026-06-05', checkOut: '2026-06-09', nights: 4, status: 'checked_out', revenue: 740, source: 'Airbnb', hasPet: true },
      { id: 'bk-2', guestName: 'James Kim', checkIn: '2026-06-12', checkOut: '2026-06-15', nights: 3, status: 'checked_out', revenue: 555, source: 'Booking.com' },
      { id: 'bk-3', guestName: 'Emma Wilson', checkIn: '2026-06-20', checkOut: '2026-06-25', nights: 5, adults: 4, children: 0, infants: 0, pets: 1, status: 'inquiry', revenue: 925, source: 'Airbnb', hasPet: true },
    
      { id: 'bk-1c', guestName: 'Isabella Romano', checkIn: '2026-07-30', checkOut: '2026-08-04', nights: 5, adults: 2, children: 1, infants: 0, pets: 1, status: 'checked_in', revenue: 1850, source: 'Airbnb', hasPet: true },],
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
    bookings: [
      { id: 'bk-2a', guestName: 'Olivia Tan', checkIn: '2026-07-12', checkOut: '2026-07-16', nights: 4, status: 'checked_out', revenue: 480, source: 'Airbnb' },
      { id: 'bk-2b', guestName: 'Marco Rossi', checkIn: '2026-07-22', checkOut: '2026-07-26', nights: 4, status: 'checked_out', revenue: 480, source: 'Booking.com', hasPet: true },
      { id: 'bk-2e', guestName: 'Pierre Dubois', checkIn: '2026-08-01', checkOut: '2026-08-05', nights: 4, adults: 2, children: 0, infants: 0, pets: 1, status: 'checked_in', revenue: 480, source: 'Airbnb', hasPet: true },
      { id: 'bk-2c', guestName: 'Hannah Lee', checkIn: '2026-08-08', checkOut: '2026-08-13', nights: 5, status: 'verified', revenue: 600, source: 'Direct' },
      { id: 'bk-2d', guestName: 'Diana Park', checkIn: '2026-08-20', checkOut: '2026-08-25', nights: 5, status: 'inquiry', revenue: 600, source: 'Airbnb' },
    ],
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
      { id: 'bk-3b', guestName: 'Reto Wyss', checkIn: '2026-06-22', checkOut: '2026-06-25', nights: 3, status: 'verified', revenue: 360, source: 'Direct' },
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
      { id: 'bk-4', guestName: 'Thomas Wikes', checkIn: '2026-06-21', checkOut: '2026-06-24', nights: 3, status: 'checked_in', revenue: 360, source: 'Direct' },
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
      { id: 'bk-5', guestName: 'Mate Bezdek', checkIn: '2026-06-22', checkOut: '2026-06-25', nights: 3, status: 'unverified', revenue: 390, source: 'Airbnb' },
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
      { id: 'bk-6', guestName: 'Nina Schwarz', checkIn: '2026-06-23', checkOut: '2026-06-26', nights: 3, status: 'verified', revenue: 450, source: 'Booking.com', hasPet: true },
      { id: 'bk-6a', guestName: 'Lucas Oliveira', checkIn: '2026-08-02', checkOut: '2026-08-07', nights: 5, adults: 2, children: 1, infants: 0, pets: 1, status: 'checked_in', revenue: 750, source: 'Direct', hasPet: true },
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
    bookings: [
      { id: 'bk-7a', guestName: 'Sophie Mueller', checkIn: '2026-07-05', checkOut: '2026-07-09', nights: 4, status: 'checked_out', revenue: 560, source: 'Direct' },
      { id: 'bk-7b', guestName: 'Liam O. Brien', checkIn: '2026-07-15', checkOut: '2026-07-19', nights: 4, status: 'verified', revenue: 560, source: 'Airbnb', hasPet: true },
      { id: 'bk-7d', guestName: 'Aria Patel', checkIn: '2026-08-01', checkOut: '2026-08-05', nights: 4, adults: 2, children: 2, infants: 0, pets: 1, status: 'checked_in', revenue: 560, source: 'Airbnb', hasPet: true },
      { id: 'bk-7c', guestName: 'Yuki Sato', checkIn: '2026-08-05', checkOut: '2026-08-09', nights: 4, status: 'verified', revenue: 560, source: 'Booking.com' },
      { id: 'blk-7a', type: 'block', guestName: 'Owner stay', checkIn: '2026-08-15', checkOut: '2026-08-19', nights: 4, status: 'verified', revenue: 0, source: 'Manual', blockReason: 'Owner personal visit' },
    ],
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
      { id: 'bk-8', guestName: 'Cameron Skillcorn', checkIn: '2026-06-22', checkOut: '2026-06-25', nights: 3, status: 'cancelled', revenue: 420, source: 'Direct' },
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
    bookings: [
      { id: 'bk-9a', guestName: 'Aiden Wright', checkIn: '2026-07-08', checkOut: '2026-07-11', nights: 3, status: 'checked_out', revenue: 480, source: 'Airbnb' },
      { id: 'bk-9b', guestName: 'Chloe Wang', checkIn: '2026-07-25', checkOut: '2026-07-30', nights: 5, status: 'unverified', revenue: 800, source: 'Booking.com' },
      { id: 'bk-9c', guestName: 'Felix Schmidt', checkIn: '2026-08-10', checkOut: '2026-08-15', nights: 5, status: 'verified', revenue: 800, source: 'Direct' },
      { id: 'bk-9d', guestName: 'Anika Patel', checkIn: '2026-08-22', checkOut: '2026-08-28', nights: 6, status: 'inquiry', revenue: 960, source: 'Airbnb' },
    ],
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
      { id: 'bk-10', guestName: 'Robert Chen', checkIn: '2026-06-24', checkOut: '2026-06-27', nights: 3, status: 'verified', revenue: 285, source: 'Booking.com' },
      { id: 'bk-10a', guestName: 'Min-jae Kim', checkIn: '2026-08-13', checkOut: '2026-08-18', nights: 5, status: 'checked_in', revenue: 475, source: 'Airbnb', hasPet: true },
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
    bookings: [
      { id: 'bk-11a', guestName: 'George Hartley', checkIn: '2026-07-10', checkOut: '2026-07-15', nights: 5, status: 'checked_out', revenue: 1250, source: 'Direct' },
      { id: 'bk-11b', guestName: 'Yuna Park', checkIn: '2026-07-20', checkOut: '2026-07-25', nights: 5, status: 'checked_in', revenue: 1250, source: 'Airbnb' },
      { id: 'bk-11c', guestName: 'Beatriz Costa', checkIn: '2026-08-05', checkOut: '2026-08-10', nights: 5, status: 'verified', revenue: 1250, source: 'Booking.com', hasPet: true },
      { id: 'bk-11d', guestName: 'Theo Andersen', checkIn: '2026-08-18', checkOut: '2026-08-24', nights: 6, status: 'verified', revenue: 1500, source: 'Direct' },
    ],
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
      { id: 'bk-12', guestName: 'Marco Silva', checkIn: '2026-06-25', checkOut: '2026-06-28', nights: 3, status: 'verified', revenue: 225, source: 'Booking.com' },
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
      { id: 'bk-13', guestName: 'Reto Wyss', checkIn: '2026-06-26', checkOut: '2026-06-29', nights: 3, status: 'verified', revenue: 255, source: 'Airbnb' },
      { id: 'bk-13a', guestName: 'Frederik Madsen', checkIn: '2026-08-05', checkOut: '2026-08-10', nights: 5, adults: 2, children: 0, infants: 0, pets: 1, status: 'checked_in', revenue: 425, source: 'Booking.com', hasPet: true },
      { id: 'blk-1', type: 'block', guestName: 'Maintenance window', checkIn: '2026-06-22', checkOut: '2026-06-23', nights: 1, status: 'verified', revenue: 0, source: 'Manual', blockReason: 'Pool deck resurfacing' },
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
    bookings: [
      { id: 'bk-14a', guestName: 'Mira Holmberg', checkIn: '2026-07-14', checkOut: '2026-07-18', nights: 4, status: 'checked_out', revenue: 960, source: 'Direct' },
      { id: 'bk-14b', guestName: 'Ravi Sharma', checkIn: '2026-08-02', checkOut: '2026-08-06', nights: 4, status: 'verified', revenue: 960, source: 'Airbnb' },
      { id: 'bk-14c', guestName: 'Elise Laurent', checkIn: '2026-08-20', checkOut: '2026-08-25', nights: 5, status: 'inquiry', revenue: 1200, source: 'Booking.com' },
    ],
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
    bookings: [
      { id: 'bk-15a', guestName: 'Charlotte Moore', checkIn: '2026-08-03', checkOut: '2026-08-08', nights: 5, adults: 2, children: 1, infants: 1, pets: 1, status: 'checked_in', revenue: 450, source: 'Airbnb', hasPet: true },
    ],
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
    bookings: [
      { id: 'bk-16a', guestName: 'Akira Tanaka', checkIn: '2026-07-06', checkOut: '2026-07-10', nights: 4, status: 'checked_out', revenue: 600, source: 'Booking.com' },
      { id: 'bk-16b', guestName: 'Lucia Romero', checkIn: '2026-07-24', checkOut: '2026-07-30', nights: 6, status: 'verified', revenue: 900, source: 'Direct' },
      { id: 'bk-16c', guestName: 'Henrik Olsen', checkIn: '2026-08-12', checkOut: '2026-08-17', nights: 5, status: 'unverified', revenue: 750, source: 'Airbnb' },
      { id: 'bk-16d', guestName: 'Sienna Cooper', checkIn: '2026-08-26', checkOut: '2026-08-31', nights: 5, status: 'verified', revenue: 750, source: 'Booking.com' },
    ],
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
    bookings: [
      { id: 'bk-17a', guestName: 'Aisha Khan', checkIn: '2026-07-09', checkOut: '2026-07-13', nights: 4, status: 'checked_out', revenue: 400, source: 'Booking.com' },
      { id: 'bk-17b', guestName: 'Lukas Becker', checkIn: '2026-07-23', checkOut: '2026-07-28', nights: 5, status: 'verified', revenue: 500, source: 'Airbnb' },
      { id: 'bk-17c', guestName: 'Carmen Diaz', checkIn: '2026-08-05', checkOut: '2026-08-09', nights: 4, status: 'inquiry', revenue: 400, source: 'Direct' },
      { id: 'bk-17d', guestName: 'Henrik Berg', checkIn: '2026-08-22', checkOut: '2026-08-27', nights: 5, status: 'verified', revenue: 500, source: 'Booking.com' },
    ],
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
    bookings: [
      { id: 'bk-18a', guestName: 'Tariq Hassan', checkIn: '2026-07-11', checkOut: '2026-07-15', nights: 4, status: 'verified', revenue: 400, source: 'Airbnb' },
      { id: 'bk-18b', guestName: 'Greta Lindqvist', checkIn: '2026-07-26', checkOut: '2026-07-30', nights: 4, status: 'unverified', revenue: 400, source: 'Booking.com' },
      { id: 'bk-18c', guestName: 'Daniel Park', checkIn: '2026-08-07', checkOut: '2026-08-11', nights: 4, status: 'verified', revenue: 400, source: 'Direct' },
      { id: 'bk-18d', guestName: 'Layla Saeed', checkIn: '2026-08-24', checkOut: '2026-08-29', nights: 5, status: 'inquiry', revenue: 500, source: 'Airbnb' },
    ],
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
    bookings: [
      { id: 'bk-19a', guestName: 'Tyler Brooks', checkIn: '2026-07-04', checkOut: '2026-07-08', nights: 4, status: 'checked_out', revenue: 320, source: 'Direct' },
      { id: 'bk-19b', guestName: 'Maya Iversen', checkIn: '2026-07-26', checkOut: '2026-07-31', nights: 5, status: 'verified', revenue: 400, source: 'Airbnb' },
      { id: 'bk-19e', guestName: 'Connor Walsh', checkIn: '2026-08-10', checkOut: '2026-08-15', nights: 5, adults: 2, children: 0, infants: 0, pets: 1, status: 'checked_in', revenue: 400, source: 'Direct', hasPet: true },
      { id: 'bk-19c', guestName: 'Joao Mendes', checkIn: '2026-08-15', checkOut: '2026-08-19', nights: 4, status: 'inquiry', revenue: 320, source: 'Booking.com' },
      { id: 'bk-19d', guestName: 'Priya Iyer', checkIn: '2026-08-22', checkOut: '2026-08-26', nights: 4, status: 'verified', revenue: 320, source: 'Direct' },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  // ── EUR-denominated DACH listings (Lexware-eligible) ───────────────────
  {
    id: 'lst-20',
    name: 'Villa Luwa – Hügellage Brandenburg',
    property: 'Elev8 Suite DACH',
    location: 'Potsdam, Brandenburg, Germany',
    tags: ['Potsdam', 'Brandenburg', 'Villa', 'EUR'],
    otaConnected: ['Airbnb', 'Booking.com'],
    amenities: ['Pool', 'WiFi', 'Heating', 'Kitchen', 'Parking', 'Garden', 'Sauna'],
    room: 'Master Suite',
    capacity: 8,
    aiStatus: 'active',
    unitType: 'single',
    photos: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop'],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 4800, revenueTrend: 6, occupancyRate: 72, occupancyTrend: 3, avgRating: 4.8, totalReviews: 32 },
    pricing: { nightlyRate: 220, cleaningFee: 90, serviceFee: 35, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [
      { id: 'bk-20a', guestName: 'Erik Hoffmann', checkIn: '2026-07-21', checkOut: '2026-07-26', nights: 5, status: 'checked_out', revenue: 1280, source: 'Airbnb' },
      { id: 'bk-20b', guestName: 'Christina Wolf', checkIn: '2026-07-28', checkOut: '2026-08-02', nights: 5, status: 'checked_out', revenue: 1450, source: 'Booking.com' },
      { id: 'bk-20c', guestName: 'Marta Kowalski', checkIn: '2026-08-08', checkOut: '2026-08-13', nights: 5, status: 'verified', revenue: 1200, source: 'Direct' },
      { id: 'bk-20d', guestName: 'Felix Brenner', checkIn: '2026-08-20', checkOut: '2026-08-25', nights: 5, status: 'inquiry', revenue: 1100, source: 'Airbnb' },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-21',
    name: 'Villa Sehnsucht – Seegrundstück Mecklenburg',
    property: 'Elev8 Suite DACH',
    location: 'Waren (Müritz), Mecklenburg, Germany',
    tags: ['Müritz', 'Mecklenburg', 'Seegrundstück', 'EUR'],
    otaConnected: ['Airbnb', 'Booking.com', 'Vrbo'],
    amenities: ['Lake Access', 'WiFi', 'Heating', 'Kitchen', 'Parking', 'Sauna', 'Boat Dock'],
    room: 'Seeblick Suite',
    capacity: 6,
    aiStatus: 'active',
    unitType: 'single',
    photos: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop'],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 5400, revenueTrend: 8, occupancyRate: 68, occupancyTrend: 5, avgRating: 4.9, totalReviews: 28 },
    pricing: { nightlyRate: 280, cleaningFee: 120, serviceFee: 45, weeklyDiscount: 10, monthlyDiscount: 18, seasonalRates: [] },
    bookings: [
      { id: 'bk-21a', guestName: 'Anna Brunner', checkIn: '2026-07-22', checkOut: '2026-07-29', nights: 7, status: 'checked_out', revenue: 2460, source: 'Airbnb' },
      { id: 'bk-21b', guestName: 'Lukas Maier', checkIn: '2026-08-04', checkOut: '2026-08-09', nights: 5, status: 'verified', revenue: 1640, source: 'Booking.com' },
      { id: 'bk-21c', guestName: 'Sandra Berger', checkIn: '2026-08-16', checkOut: '2026-08-23', nights: 7, status: 'verified', revenue: 2240, source: 'Direct' },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-22',
    name: 'Villa Bergfried – Schwarzwald',
    property: 'Elev8 Suite DACH',
    location: 'Freiburg, Baden-Württemberg, Germany',
    tags: ['Freiburg', 'Schwarzwald', 'Bergblick', 'EUR'],
    otaConnected: ['Airbnb', 'Booking.com'],
    amenities: ['Mountain View', 'WiFi', 'Heating', 'Kitchen', 'Parking', 'Fireplace'],
    room: 'Bergfried Suite',
    capacity: 4,
    aiStatus: 'active',
    unitType: 'single',
    photos: ['https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&h=600&fit=crop'],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 3200, revenueTrend: 4, occupancyRate: 65, occupancyTrend: 2, avgRating: 4.7, totalReviews: 21 },
    pricing: { nightlyRate: 260, cleaningFee: 90, serviceFee: 40, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [
      { id: 'bk-22a', guestName: 'Lukas Vogel', checkIn: '2026-07-18', checkOut: '2026-07-21', nights: 3, status: 'checked_out', revenue: 980, source: 'Airbnb' },
      { id: 'bk-22b', guestName: 'Petra Schulz', checkIn: '2026-08-01', checkOut: '2026-08-06', nights: 5, status: 'verified', revenue: 1500, source: 'Booking.com' },
      { id: 'bk-22c', guestName: 'Andreas Hoffmann', checkIn: '2026-08-15', checkOut: '2026-08-19', nights: 4, status: 'inquiry', revenue: 1240, source: 'Direct' },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-23',
    name: 'Villa Zeitreise – Weinregion Pfalz',
    property: 'Elev8 Suite DACH',
    location: 'Neustadt an der Weinstraße, Rheinland-Pfalz, Germany',
    tags: ['Neustadt', 'Pfalz', 'Weinregion', 'EUR'],
    otaConnected: ['Airbnb', 'Booking.com'],
    amenities: ['Vineyard View', 'WiFi', 'Heating', 'Kitchen', 'Parking', 'Wine Cellar'],
    room: 'Weingut Suite',
    capacity: 6,
    aiStatus: 'active',
    unitType: 'single',
    photos: ['https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&h=600&fit=crop'],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 3800, revenueTrend: 5, occupancyRate: 70, occupancyTrend: 4, avgRating: 4.8, totalReviews: 19 },
    pricing: { nightlyRate: 320, cleaningFee: 120, serviceFee: 50, weeklyDiscount: 9, monthlyDiscount: 16, seasonalRates: [] },
    bookings: [
      { id: 'bk-23a', guestName: 'Markus Steiner', checkIn: '2026-07-12', checkOut: '2026-07-16', nights: 4, status: 'cancelled', revenue: 1640, source: 'Airbnb' },
      { id: 'bk-23b', guestName: 'Julia Wagner', checkIn: '2026-07-26', checkOut: '2026-07-30', nights: 4, status: 'checked_out', revenue: 1500, source: 'Booking.com' },
      { id: 'bk-23c', guestName: 'Thomas Richter', checkIn: '2026-08-10', checkOut: '2026-08-15', nights: 5, status: 'verified', revenue: 1850, source: 'Direct' },
    ],
    blockedDates: [],
    reviews: [],
    maintenance: { cleaningSchedule: [], tasks: [] },
    resources: { documents: [], basics: {}, topicsToAvoid: [], propertyUpsells: [] },
  },
  {
    id: 'lst-24',
    name: 'Villa Kunstpause – Kulturhaupstadt Weimar',
    property: 'Elev8 Suite DACH',
    location: 'Weimar, Thüringen, Germany',
    tags: ['Weimar', 'Thüringen', 'Kultur', 'EUR'],
    otaConnected: ['Airbnb', 'Booking.com'],
    amenities: ['Garden', 'WiFi', 'Heating', 'Kitchen', 'Parking', 'Library'],
    room: 'Kunstpause Suite',
    capacity: 4,
    aiStatus: 'paused',
    unitType: 'single',
    photos: ['https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800&h=600&fit=crop'],
    aiSchedule: alwaysOn(),
    stats: { monthlyRevenue: 2400, revenueTrend: -2, occupancyRate: 58, occupancyTrend: -3, avgRating: 4.6, totalReviews: 14 },
    pricing: { nightlyRate: 300, cleaningFee: 120, serviceFee: 45, weeklyDiscount: 8, monthlyDiscount: 15, seasonalRates: [] },
    bookings: [
      { id: 'bk-24a', guestName: 'Sophia Maier', checkIn: '2026-07-28', checkOut: '2026-07-30', nights: 2, status: 'checked_out', revenue: 720, source: 'Airbnb' },
      { id: 'bk-24b', guestName: 'Heinrich Müller', checkIn: '2026-08-06', checkOut: '2026-08-10', nights: 4, status: 'verified', revenue: 1380, source: 'Booking.com' },
      { id: 'bk-24c', guestName: 'Eva Krause', checkIn: '2026-08-18', checkOut: '2026-08-22', nights: 4, status: 'inquiry', revenue: 1320, source: 'Direct' },
    ],
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

export interface BookingStatusMeta {
  status: BookingStatus
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  badgeClass: string
  cardClass: string
  icon: string
  isStrikethrough: boolean
}

export const bookingStatusMeta: Record<BookingStatus, BookingStatusMeta> = {
  unverified: {
    status: 'unverified',
    label: 'Unverified',
    variant: 'secondary',
    badgeClass: 'bg-zinc-500/15 text-zinc-700 border-zinc-500/30',
    cardClass: 'border-zinc-300/60 bg-zinc-50 dark:bg-zinc-900/30',
    icon: 'lucide:user-round-x',
    isStrikethrough: false,
  },
  verified: {
    status: 'verified',
    label: 'Verified',
    variant: 'default',
    badgeClass: 'bg-green-500/15 text-green-700 border-green-500/30',
    cardClass: 'border-green-300/60 bg-green-50 dark:bg-green-900/20',
    icon: 'lucide:badge-check',
    isStrikethrough: false,
  },
  checked_in: {
    status: 'checked_in',
    label: 'Checked-in',
    variant: 'default',
    badgeClass: 'bg-orange-500/15 text-orange-700 border-orange-500/30',
    cardClass: 'border-orange-300/60 bg-orange-50 dark:bg-orange-900/20',
    icon: 'lucide:log-in',
    isStrikethrough: false,
  },
  checked_out: {
    status: 'checked_out',
    label: 'Checked-out',
    variant: 'default',
    badgeClass: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
    cardClass: 'border-blue-300/60 bg-blue-50 dark:bg-blue-900/20',
    icon: 'lucide:log-out',
    isStrikethrough: false,
  },
  cancelled: {
    status: 'cancelled',
    label: 'Cancelled',
    variant: 'secondary',
    badgeClass: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30',
    cardClass: 'border-zinc-300/60 bg-zinc-50 dark:bg-zinc-900/30',
    icon: 'lucide:ban',
    isStrikethrough: true,
  },
  inquiry: {
    status: 'inquiry',
    label: 'Inquiry',
    variant: 'default',
    badgeClass: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30',
    cardClass: 'border-yellow-300/60 bg-yellow-50 dark:bg-yellow-900/20',
    icon: 'lucide:help-circle',
    isStrikethrough: false,
  },
}

export const blockStatusMeta: BookingStatusMeta = {
  status: 'verified',
  label: 'Manual block',
  variant: 'outline',
  badgeClass: 'bg-zinc-900 text-white border-zinc-900',
  cardClass: 'border-zinc-900 bg-zinc-900 text-white',
  icon: 'lucide:ban',
  isStrikethrough: false,
}
