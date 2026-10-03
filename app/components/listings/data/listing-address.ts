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
