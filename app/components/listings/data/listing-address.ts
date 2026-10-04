import type { Listing } from './listings'

export interface ListingAddress {
  street: string
  unitNumber: string
  city: string
  state: string
  postalCode: string
  /** ISO 3166-1 alpha-2, e.g. `ID`. */
  country: string
}

export const PROPERTY_TYPES = ['Villa', 'House', 'Apartment', 'Bungalow', 'Guesthouse', 'Cabin', 'Hotel', 'Resort'] as const

export const LISTING_COUNTRIES = ['ID', 'AU', 'AT', 'CH', 'DE', 'FR', 'GB', 'IT', 'MY', 'NL', 'SG', 'TH', 'US'] as const

const DEFAULT_TIME_ZONE: Record<string, string> = {
  ID: 'Asia/Makassar', // Bali is WITA
  AU: 'Australia/Sydney',
  AT: 'Europe/Vienna',
  CH: 'Europe/Zurich',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  GB: 'Europe/London',
  IT: 'Europe/Rome',
  MY: 'Asia/Kuala_Lumpur',
  NL: 'Europe/Amsterdam',
  SG: 'Asia/Singapore',
  TH: 'Asia/Bangkok',
}

const COUNTRY_BY_NAME: Record<string, string> = { germany: 'DE', switzerland: 'CH', austria: 'AT', indonesia: 'ID' }

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code
  }
  catch {
    return code
  }
}

/** Every IANA zone the runtime knows, with the listing's own kept even if it is not in the list. */
export function timeZoneOptions(current?: string): string[] {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : Object.values(DEFAULT_TIME_ZONE)
  return current && !zones.includes(current) ? [current, ...zones] : zones
}

/**
 * The listing's address. Listings not yet re-saved have only the `location`
 * label ("Canggu, Bali" or "Potsdam, Brandenburg, Germany"), so city, state
 * and country are read from it; a Bali listing defaults to Indonesia.
 */
export function listingAddress(listing: Listing): ListingAddress {
  if (listing.address)
    return listing.address
  const [city = '', state = '', countryLabel = ''] = listing.location.split(',').map(p => p.trim())
  const country = COUNTRY_BY_NAME[countryLabel.toLowerCase()] ?? (state === 'Bali' ? 'ID' : '')
  return { street: '', unitNumber: '', city, state, postalCode: '', country }
}

/** Set type first, else one named in the listing's tags or name ("5BR Pool Villa"). */
export function listingPropertyType(listing: Listing): string {
  if (listing.propertyType)
    return listing.propertyType
  const name = listing.name.toLowerCase()
  return PROPERTY_TYPES.find(t => listing.tags.includes(t) || name.includes(t.toLowerCase())) ?? ''
}

export function listingTimeZone(listing: Listing): string {
  return listing.timeZone ?? DEFAULT_TIME_ZONE[listingAddress(listing).country] ?? ''
}

/** Keeps the `location` label (shown across the app) in step with the address. */
export function locationLabel(address: ListingAddress, fallback: string): string {
  const parts = [address.city, address.state].map(p => p.trim()).filter(Boolean)
  if (!parts.length)
    return fallback
  if (address.country && address.country !== 'ID')
    parts.push(countryName(address.country))
  return parts.join(', ')
}

// --- Pinpoint ------------------------------------------------------------------

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Known areas for the mock reverse geocoder. Demo only: a real build would
 * call a geocoding service; here a pin takes the nearest area's address.
 */
const PLACES: (LatLng & Omit<ListingAddress, 'unitNumber'>)[] = [
  { lat: -8.6466, lng: 115.1225, street: 'Jl. Pantai Pererenan', city: 'Pererenan', state: 'Bali', postalCode: '80351', country: 'ID' },
  { lat: -8.6478, lng: 115.1385, street: 'Jl. Pantai Batu Bolong', city: 'Canggu', state: 'Bali', postalCode: '80361', country: 'ID' },
  { lat: -8.6656, lng: 115.1580, street: 'Jl. Bumbak', city: 'Umalas', state: 'Bali', postalCode: '80361', country: 'ID' },
  { lat: -8.6913, lng: 115.1683, street: 'Jl. Kayu Aya', city: 'Seminyak', state: 'Bali', postalCode: '80361', country: 'ID' },
  { lat: -8.6936, lng: 115.2627, street: 'Jl. Danau Tamblingan', city: 'Sanur', state: 'Bali', postalCode: '80228', country: 'ID' },
  { lat: -8.6705, lng: 115.2126, street: 'Jl. Gajah Mada', city: 'Denpasar', state: 'Bali', postalCode: '80232', country: 'ID' },
  { lat: -8.7184, lng: 115.1686, street: 'Jl. Pantai Kuta', city: 'Kuta', state: 'Bali', postalCode: '80361', country: 'ID' },
  { lat: -8.8008, lng: 115.2317, street: 'Jl. Pantai Mengiat', city: 'Nusa Dua', state: 'Bali', postalCode: '80363', country: 'ID' },
  { lat: -8.7905, lng: 115.1606, street: 'Jl. Bukit Permai', city: 'Jimbaran', state: 'Bali', postalCode: '80364', country: 'ID' },
  { lat: -8.8291, lng: 115.0849, street: 'Jl. Raya Uluwatu', city: 'Uluwatu', state: 'Bali', postalCode: '80364', country: 'ID' },
  { lat: -8.5069, lng: 115.2625, street: 'Jl. Raya Ubud', city: 'Ubud', state: 'Bali', postalCode: '80571', country: 'ID' },
  { lat: -8.2425, lng: 115.3270, street: 'Jl. Raya Penelokan', city: 'Kintamani', state: 'Bali', postalCode: '80652', country: 'ID' },
  { lat: 52.3906, lng: 13.0645, street: 'Friedrich-Ebert-Straße', city: 'Potsdam', state: 'Brandenburg', postalCode: '14467', country: 'DE' },
]

/** Pins further than this from every known area find no address. */
const MAX_MATCH_KM = 40
const BALI_CENTER: LatLng = { lat: -8.6705, lng: 115.2126 }

function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => d * Math.PI / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

/** The nearest known area's address, or null when the pin is far from all of them. */
export function nearestAddress(pin: LatLng): Omit<ListingAddress, 'unitNumber'> | null {
  let best: (typeof PLACES)[number] | null = null
  let bestKm = Infinity
  for (const place of PLACES) {
    const km = distanceKm(pin, place)
    if (km < bestKm) {
      best = place
      bestKm = km
    }
  }
  if (!best || bestKm > MAX_MATCH_KM)
    return null
  const { lat: _lat, lng: _lng, ...address } = best
  return address
}

/** Mock reverse geocoding: a short delay, then `nearestAddress`. */
export function reverseGeocode(pin: LatLng): Promise<Omit<ListingAddress, 'unitNumber'> | null> {
  return new Promise(resolve => setTimeout(() => resolve(nearestAddress(pin)), 500))
}

/** Where the pin starts: the saved point, else the listing's city, else central Bali. */
export function listingPin(listing: Listing): LatLng {
  if (listing.coordinates)
    return listing.coordinates
  const city = listingAddress(listing).city.toLowerCase()
  const place = PLACES.find(p => p.city.toLowerCase() === city)
  return place ? { lat: place.lat, lng: place.lng } : BALI_CENTER
}

export interface PlaceSuggestion {
  /** e.g. "Jl. Pantai Batu Bolong, Canggu" */
  label: string
  /** e.g. "Bali, Indonesia" */
  detail: string
  pin: LatLng
  address: Omit<ListingAddress, 'unitNumber'>
}

/**
 * Mock place search for the pinpoint's autocomplete: known areas whose city,
 * street, state or postal code contain every word typed, best matches (city
 * starts with the query) first. A real build would call a geocoding service.
 */
export function searchPlaces(query: string, limit = 6): PlaceSuggestion[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length)
    return []
  const q = words.join(' ')
  return PLACES
    .map(({ lat, lng, ...address }) => ({
      label: `${address.street}, ${address.city}`,
      detail: `${address.state}, ${countryName(address.country)}`,
      pin: { lat, lng },
      address,
    }))
    .filter((s) => {
      const haystack = `${s.address.city} ${s.address.street} ${s.address.state} ${s.address.postalCode} ${countryName(s.address.country)}`.toLowerCase()
      return words.every(w => haystack.includes(w))
    })
    .sort((a, b) => Number(b.address.city.toLowerCase().startsWith(q)) - Number(a.address.city.toLowerCase().startsWith(q)))
    .slice(0, limit)
}
