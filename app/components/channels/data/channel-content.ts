/**
 * What a channel needs from a listing's content before it publishes it: the
 * listing side of NextPax's `constants/channel-content-definitions`. Mock rules
 * with placeholder limits; the real ones arrive from that endpoint at runtime.
 * Each check names the Listing Setup section where it is fixed.
 */
import type { ListingSetupSection } from '~/components/listings/data/listing-setup-progress'
import type { Listing } from '~/components/listings/data/listings'
import { listingAddress } from '~/components/listings/data/listing-address'
import { getSetupSpec } from './channel-setup'

/** Longest listing name a channel shows. Placeholders. */
const NAME_MAX: Record<string, number> = {
  'Airbnb': 50,
  'Vrbo': 80,
  'Booking.com': 100,
}
const DEFAULT_NAME_MAX = 100

/** Shortest property description a channel accepts. Placeholder. */
export const DESCRIPTION_MIN = 100

export type ContentCheckKey = 'photos' | 'name' | 'description' | 'address' | 'amenities' | 'bedrooms'

export interface ContentCheck {
  key: ContentCheckKey
  ok: boolean
  /** A blocking check stops the channel from publishing; the rest it publishes with a weaker page. */
  blocking: boolean
  /** What is wrong, in the host's words, when not ok. */
  detail: string
}

export const CONTENT_CHECKS: { key: ContentCheckKey, label: string, section: ListingSetupSection }[] = [
  { key: 'photos', label: 'Photos', section: 'basics' },
  { key: 'name', label: 'Listing name', section: 'basics' },
  { key: 'address', label: 'Address', section: 'basics' },
  { key: 'description', label: 'Description', section: 'listing-details' },
  { key: 'bedrooms', label: 'Bedrooms and beds', section: 'listing-details' },
  { key: 'amenities', label: 'Amenities', section: 'amenities' },
]

const filled = (value?: string) => !!value?.trim()

/** Every check for one listing on one channel, in `CONTENT_CHECKS` order. */
export function channelContentChecks(listing: Listing, channel: string): ContentCheck[] {
  const minPhotos = getSetupSpec(channel).minPhotos
  const nameMax = NAME_MAX[channel] ?? DEFAULT_NAME_MAX
  const description = listing.resources.basics.description?.trim() ?? ''
  const address = listingAddress(listing)
  const missingAddress = [
    filled(address.street) ? null : 'street',
    filled(address.city) ? null : 'city',
    filled(address.country) ? null : 'country',
  ].filter(Boolean)

  const checks: Record<ContentCheckKey, Omit<ContentCheck, 'key'>> = {
    photos: {
      ok: listing.photos.length >= minPhotos,
      blocking: false,
      detail: `${listing.photos.length} of ${minPhotos} photos`,
    },
    name: {
      ok: filled(listing.name) && listing.name.length <= nameMax,
      blocking: true,
      detail: filled(listing.name) ? `${listing.name.length} characters, ${channel} shows ${nameMax}` : 'No name',
    },
    address: {
      ok: missingAddress.length === 0,
      blocking: true,
      detail: `No ${missingAddress.join(', ')}`,
    },
    description: {
      ok: description.length >= DESCRIPTION_MIN,
      blocking: true,
      detail: description ? `${description.length} of ${DESCRIPTION_MIN} characters` : 'No description',
    },
    bedrooms: {
      ok: filled(listing.details?.bedrooms),
      blocking: false,
      detail: 'Bedrooms not described',
    },
    amenities: {
      ok: listing.amenities.length > 0,
      blocking: false,
      detail: 'No amenities ticked',
    },
  }
  return CONTENT_CHECKS.map(c => ({ key: c.key, ...checks[c.key] }))
}

export interface ContentSummary {
  blocking: number
  warnings: number
}

export function contentSummary(checks: ContentCheck[]): ContentSummary {
  return {
    blocking: checks.filter(c => !c.ok && c.blocking).length,
    warnings: checks.filter(c => !c.ok && !c.blocking).length,
  }
}
