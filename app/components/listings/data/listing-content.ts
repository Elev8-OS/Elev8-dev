/**
 * Listing content the channels take beyond the basics: what each photo shows,
 * descriptions in other languages, and places nearby. NextPax sends these as
 * `properties/:id/images` (type code, caption), `descriptions` (type code,
 * language) and `nearest-places` (type, meters). Edited in Listing Setup. The
 * type lists are a readable subset; the real codes come from
 * `constants/mapping-codes` at runtime.
 */
import type { Listing } from './listings'

export interface ListingPhotoDetails {
  /** One of `PHOTO_TYPES`. */
  type?: string
  caption?: string
}

export const PHOTO_TYPES = [
  'Exterior',
  'Living room',
  'Bedroom',
  'Bathroom',
  'Kitchen',
  'Dining area',
  'Pool',
  'Garden',
  'View',
  'Beach',
  'Other',
]

export const PHOTO_CAPTION_MAX = 100

/** Details of the photos still on the listing. Keyed by photo URL, so a replaced or deleted photo loses its own. */
export function listingPhotoDetails(listing: Listing): Record<string, ListingPhotoDetails> {
  const details = listing.photoDetails ?? {}
  return Object.fromEntries(listing.photos.filter(p => details[p]).map(p => [p, details[p]!]))
}

/** Drops details whose photo is gone, and empty ones. */
export function prunePhotoDetails(details: Record<string, ListingPhotoDetails>, photos: string[]): Record<string, ListingPhotoDetails> {
  return Object.fromEntries(photos
    .filter(p => details[p]?.type || details[p]?.caption?.trim())
    .map(p => [p, details[p]!]))
}

export interface DescriptionTranslation {
  description: string
  neighborhood: string
}

/**
 * Languages a listing can be described in besides the default (English, the
 * Listing Details fields). ISO 639-1 codes, as NextPax expects.
 */
export const DESCRIPTION_LANGUAGES: { code: string, label: string }[] = [
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'nl', label: 'Dutch' },
  { code: 'it', label: 'Italian' },
  { code: 'es', label: 'Spanish' },
  { code: 'id', label: 'Indonesian' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
]

export const languageLabel = (code: string) => DESCRIPTION_LANGUAGES.find(l => l.code === code)?.label ?? code.toUpperCase()

export function listingDescriptionTranslations(listing: Listing): Record<string, DescriptionTranslation> {
  return listing.descriptionTranslations ?? {}
}

export interface NearbyPlace {
  id: string
  /** One of `NEARBY_PLACE_TYPES`. */
  type: string
  /** Optional name, e.g. "Ngurah Rai International". */
  name: string
  meters: number
}

export const NEARBY_PLACE_TYPES = [
  'Airport',
  'Beach',
  'City centre',
  'Restaurant',
  'Supermarket',
  'Public transport',
  'Hospital',
  'Pharmacy',
  'ATM',
  'Golf course',
  'Ski area',
  'Lake',
]

export function listingNearbyPlaces(listing: Listing): NearbyPlace[] {
  return listing.nearbyPlaces ?? []
}

export type DistanceUnit = 'm' | 'km'

/** A distance typed in metres or kilometres, stored in whole metres. Null when it is not a positive number. */
export function toMeters(value: string | number, unit: DistanceUnit): number | null {
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0)
    return null
  return Math.round(unit === 'km' ? n * 1000 : n)
}

/** "350 m", "1.2 km", "12 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000)
    return `${meters} m`
  const km = meters / 1000
  return `${km < 10 ? Math.round(km * 10) / 10 : Math.round(km)} km`
}

/** Closest first, so the list reads like a guidebook. */
export const sortNearby = (places: NearbyPlace[]) => [...places].sort((a, b) => a.meters - b.meters)
