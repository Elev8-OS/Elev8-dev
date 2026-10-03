import type { Listing } from './listings'

/**
 * Listing Setup > Listing Details: what ElevAI tells guests about booking,
 * arrival and the property. Information only: min/max stay here do not drive
 * the rate plans' stay restrictions.
 */
export interface ListingDetailsInfo {
  airbnbCancellationPolicy?: string
  vrboCancellationPolicy?: string
  directBookingChanges?: string
  paymentSchedule?: string
  bookingWindow?: string
  supportHours?: string
  /** End of the check-in window; the start is `resources.basics.checkInTime`. */
  checkInUntil?: string
  howToFind?: string
  parking?: string
  extraParking?: string
  access?: string
  backupAccess?: string
  accessTroubleshooting?: string
  earlyLateCheck?: string
  trash?: string
  minStay?: string
  maxStay?: string
  minGuestAge?: string
  propertySize?: string
  floors?: string
  bedrooms?: string
  additionalSleeping?: string
  bathrooms?: string
}

export type ListingDetailsKey = keyof ListingDetailsInfo

export const AIRBNB_CANCELLATION_POLICIES = ['Flexible', 'Moderate', 'Limited', 'Firm', 'Strict', 'Super Strict 30 Days', 'Super Strict 60 Days', 'Not listed on Airbnb']
export const VRBO_CANCELLATION_POLICIES = ['Relaxed', 'Moderate', 'Firm', 'Strict', 'No Refund', 'Not listed on VRBO']
export const BOOKING_WINDOWS = ['Any time', '3 months in advance', '6 months in advance', '9 months in advance', '12 months in advance', '24 months in advance']

export interface ListingDetailField {
  /** Also the `FieldConfigDialog` key; the older fields keep their keys (`checkInTime`, `description`...). */
  key: string
  label: string
  input: 'text' | 'textarea' | 'number' | 'time' | 'time-range' | 'select' | 'password'
  placeholder?: string
  options?: string[]
  /** Not counted in the setup progress. */
  optional?: boolean
  read: (listing: Listing) => string
  /** Returns a new Listing. Never mutates the one passed in. */
  write: (listing: Listing, value: string) => Listing
  /** `time-range` only: the end of the range. */
  readEnd?: (listing: Listing) => string
  writeEnd?: (listing: Listing, value: string) => Listing
}

/** A group of fields shown as one accordion card (Listing Details, SOPs). */
export interface ListingDetailGroup {
  key: string
  label: string
  icon?: string
  fields: ListingDetailField[]
}

function readDetail(key: ListingDetailsKey) {
  return (l: Listing) => l.details?.[key] ?? ''
}
function writeDetail(key: ListingDetailsKey) {
  return (l: Listing, value: string): Listing => ({ ...l, details: { ...l.details, [key]: value } })
}
function detail(key: ListingDetailsKey, label: string, input: ListingDetailField['input'], extra: Partial<ListingDetailField> = {}): ListingDetailField {
  return { key, label, input, read: readDetail(key), write: writeDetail(key), ...extra }
}
function basicsField(key: 'checkInTime' | 'checkOutTime' | 'description' | 'neighborhood', fallback = '') {
  return {
    read: (l: Listing) => l.resources.basics[key] ?? fallback,
    write: (l: Listing, value: string): Listing => ({ ...l, resources: { ...l.resources, basics: { ...l.resources.basics, [key]: value } } }),
  }
}

export const LISTING_DETAIL_GROUPS: ListingDetailGroup[] = [
  {
    key: 'booking',
    label: 'Booking',
    icon: 'lucide:calendar-check',
    fields: [
      detail('airbnbCancellationPolicy', 'If you\'re listed on Airbnb, what is your cancellation policy?', 'select', { options: AIRBNB_CANCELLATION_POLICIES }),
      detail('vrboCancellationPolicy', 'If you\'re listed on VRBO, what is your cancellation policy?', 'select', { options: VRBO_CANCELLATION_POLICIES }),
      detail('directBookingChanges', 'How can guests change or cancel their direct booking?', 'textarea'),
      detail('paymentSchedule', 'For bookings outside of Airbnb, is the full balance charged to guests at the time of booking?', 'textarea', { placeholder: 'e.g. 50% at time of booking, 50% 30 days before check-in' }),
      detail('bookingWindow', 'How far in advance can guests book?', 'select', { options: BOOKING_WINDOWS }),
    ],
  },
  {
    key: 'arrival',
    label: 'Check-in and Check-out',
    icon: 'lucide:key-round',
    fields: [
      detail('supportHours', 'What hours are you available to support guests?', 'textarea'),
      {
        key: 'checkInTime',
        label: 'Check-In Time',
        input: 'time-range',
        ...basicsField('checkInTime', '14:00'),
        readEnd: readDetail('checkInUntil'),
        writeEnd: writeDetail('checkInUntil'),
      },
      { key: 'checkOutTime', label: 'Check-Out Time', input: 'time', ...basicsField('checkOutTime', '11:00') },
      detail('howToFind', 'How to find the property', 'textarea'),
      detail('parking', 'Is parking provided?', 'textarea'),
      detail('extraParking', 'Where is the closest parking area for additional vehicles?', 'textarea'),
      detail('access', 'How to access the property', 'textarea'),
      detail('backupAccess', 'Backup Access', 'textarea'),
      detail('accessTroubleshooting', 'Access Troubleshooting', 'textarea'),
      detail('earlyLateCheck', 'Do you allow early check-in or late check-out?', 'textarea'),
      detail('trash', 'Where is trash placed?', 'textarea'),
    ],
  },
  {
    key: 'details',
    label: 'Details',
    icon: 'lucide:house',
    fields: [
      detail('minStay', 'Minimum Stay', 'number', { placeholder: 'Nights' }),
      detail('maxStay', 'Maximum Stay', 'number', { placeholder: 'Nights' }),
      detail('minGuestAge', 'Minimum Guest Age', 'number', { placeholder: 'e.g. 18' }),
      {
        key: 'capacity',
        label: 'Maximum Number of Guests',
        input: 'number',
        read: l => l.capacity ? String(l.capacity) : '',
        write: (l, value) => ({ ...l, capacity: Math.max(0, Math.floor(Number(value) || 0)) }),
      },
      detail('propertySize', 'Property Size', 'text', { placeholder: 'e.g. 750 SF' }),
      detail('floors', 'Number of Floors', 'number', { placeholder: 'e.g. 2' }),
      detail('bedrooms', 'Describe each bedroom and sleeping arrangement', 'textarea'),
      detail('additionalSleeping', 'Additional Sleeping Arrangements', 'textarea', { placeholder: 'e.g. 1 pullout couch in the living room', optional: true }),
      detail('bathrooms', 'Number of Bathrooms and Layout', 'textarea'),
      {
        key: 'wifiSsid',
        label: 'WiFi Network',
        input: 'text',
        read: l => l.wifiSsid ?? '',
        write: (l, value) => ({ ...l, wifiSsid: value }),
      },
      {
        key: 'wifiPassword',
        label: 'WiFi Password',
        input: 'password',
        read: l => l.wifiPassword ?? '',
        write: (l, value) => ({ ...l, wifiPassword: value }),
      },
      { key: 'description', label: 'Describe the property', input: 'textarea', ...basicsField('description') },
      { key: 'neighborhood', label: 'Describe the neighborhood', input: 'textarea', ...basicsField('neighborhood') },
    ],
  },
]

/** Counted fields of a group that are filled in. */
export function detailGroupProgress(listing: Listing, group: ListingDetailGroup): { done: number, total: number } {
  const counted = group.fields.filter(f => !f.optional)
  return { done: counted.filter(f => !!f.read(listing).trim()).length, total: counted.length }
}
