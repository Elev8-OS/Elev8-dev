import type { NextPaxPropertyChannel } from './nextpax'

/**
 * OTA catalog for the Channels page. Mock only: connecting an account or a
 * listing is a timer, not a real channel manager call.
 *
 * Names match the strings already stored in `Listing.otaConnected`
 * ('Airbnb', 'Booking.com', 'Vrbo'), so the listings table keeps working.
 */

/** OAuth channels open a login window; property-id channels ask for the host's property id. */
export type ChannelConnectMethod = 'oauth' | 'property_id'

export interface ChannelDefinition {
  name: string
  icon: string
  description: string
  method: ChannelConnectMethod
  /** Label of the account-level property id field (property-id channels only). */
  propertyIdLabel?: string
  /** Label of the per-listing external id. */
  listingIdLabel: string
}

export const CHANNELS: ChannelDefinition[] = [
  {
    name: 'Airbnb',
    icon: 'logos:airbnb-icon',
    description: 'Sync listings, calendar, rates and messages with Airbnb.',
    method: 'oauth',
    listingIdLabel: 'Airbnb listing ID',
  },
  {
    name: 'Booking.com',
    icon: 'simple-icons:bookingdotcom',
    description: 'Push availability and rates, receive reservations and guest messages.',
    method: 'property_id',
    propertyIdLabel: 'Booking.com Hotel ID',
    listingIdLabel: 'Room ID',
  },
  {
    name: 'Vrbo',
    icon: 'lucide:house',
    description: 'Distribute whole-home listings to Vrbo and its partner sites.',
    method: 'oauth',
    listingIdLabel: 'Vrbo property ID',
  },
  {
    name: 'Expedia',
    icon: 'simple-icons:expedia',
    description: 'Expedia, Hotels.com and partner brands through Expedia Partner Central.',
    method: 'property_id',
    propertyIdLabel: 'Expedia property ID',
    listingIdLabel: 'Room type ID',
  },
  {
    name: 'Agoda',
    icon: 'lucide:hotel',
    description: 'Reach travellers across Asia with Agoda and its partner network.',
    method: 'property_id',
    propertyIdLabel: 'Agoda property ID',
    listingIdLabel: 'Room type ID',
  },
  {
    name: 'Trip.com',
    icon: 'simple-icons:tripdotcom',
    description: 'Distribute to Trip.com, Ctrip and Skyscanner hotel search.',
    method: 'property_id',
    propertyIdLabel: 'Trip.com hotel ID',
    listingIdLabel: 'Room ID',
  },
  {
    name: 'Google Vacation Rentals',
    icon: 'logos:google-icon',
    description: 'Show listings with a direct booking link in Google Search and Maps.',
    method: 'oauth',
    listingIdLabel: 'Google listing ID',
  },
]

export function getChannel(name: string): ChannelDefinition | undefined {
  return CHANNELS.find(c => c.name === name)
}

/** Logo for an OTA name stored on a listing. Unknown names get a neutral globe. */
export function otaIcon(name: string): string {
  return getChannel(name)?.icon ?? 'lucide:globe'
}

const CHANNEL_COLUMN_PREFIX = 'ota_'

/** Listings table column id for one channel, e.g. `ota_booking-com`. Stored in saved views, so keep it stable. */
export function channelColumnId(name: string): string {
  return CHANNEL_COLUMN_PREFIX + channelSlug(name)
}

/** The channel a listings table column belongs to, or undefined for any other column. */
export function channelForColumnId(columnId: string): ChannelDefinition | undefined {
  if (!columnId.startsWith(CHANNEL_COLUMN_PREFIX))
    return undefined
  return CHANNELS.find(c => channelColumnId(c.name) === columnId)
}

/** `/channels/<slug>`: the channel name in the URL, never its NextPax code. */
export function channelSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function getChannelBySlug(slug: string): ChannelDefinition | undefined {
  return CHANNELS.find(c => channelSlug(c.name) === slug)
}

/**
 * `attention`: the channel accepted the listing but warned about it (Booking.com
 * answers 200 and drops the property), so it is not selling. `error`: a sync job failed.
 */
export type ChannelMappingStatus = 'syncing' | 'active' | 'attention' | 'error'

/**
 * One login on one OTA. A channel can have several (e.g. one Airbnb host
 * account per owner or region), so mappings point at an account, not a channel.
 */
export interface ChannelAccount {
  id: string
  channel: string
  accountName: string
  /** Property id for property-id channels, empty for OAuth. Unique per channel. */
  propertyId: string
  connectedAt: string
}

/**
 * One listing published on one OTA through one account. A listing is on a
 * channel through at most one account, or it would be sold twice.
 */
export interface ChannelMapping {
  id: string
  listingId: string
  channel: string
  accountId: string
  externalId: string
  status: ChannelMappingStatus
  lastSyncAt: string | null
  /** The text behind `attention` or `error`: NextPax's own words, never a generic message. */
  error?: string
  /** A warning from the last connect. Kept apart from the row, which does not carry it. */
  warning?: string
  /**
   * The NextPax channel-status row behind `status` and `error`. Only channels
   * with a known NextPax code carry one; `useChannels` keeps the three in step.
   */
  row?: NextPaxPropertyChannel
}

export const MAPPING_STATUS_LABEL: Record<ChannelMappingStatus, string> = {
  active: 'Live',
  syncing: 'Syncing',
  attention: 'Needs attention',
  error: 'Error',
}

/** Status dot colour, shared by the Listings cells, the Cockpit links and the Channels pages. */
export const MAPPING_STATUS_DOT: Record<ChannelMappingStatus, string> = {
  active: 'bg-green-500',
  syncing: 'bg-amber-500 animate-pulse motion-reduce:animate-none',
  attention: 'bg-amber-500',
  error: 'bg-destructive',
}

/** Chip icon per status; `active` shows a green dot instead. */
export const MAPPING_STATUS_ICON: Record<ChannelMappingStatus, string | null> = {
  active: null,
  syncing: 'lucide:loader-circle',
  attention: 'lucide:triangle-alert',
  error: 'lucide:circle-alert',
}

/** Chip border and text per status. */
export const MAPPING_STATUS_TONE: Record<ChannelMappingStatus, string> = {
  active: 'border-green-500/40 text-green-700 dark:text-green-400',
  syncing: '',
  attention: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  error: 'border-destructive/40 text-destructive',
}

/**
 * Public page of a listing on its OTA, for "open on Airbnb" links. Built from
 * the mapping's external id (Airbnb, Vrbo) or the account's property id
 * (hotel-style channels). Null when the channel has no page to open or an id
 * is missing.
 */
export function channelListingUrl(channel: string, externalId: string, propertyId = ''): string | null {
  const ext = encodeURIComponent(externalId.trim())
  const prop = encodeURIComponent(propertyId.trim())
  switch (channel) {
    case 'Airbnb':
      return ext ? `https://www.airbnb.com/rooms/${ext}` : null
    case 'Vrbo':
      return ext ? `https://www.vrbo.com/${ext}` : null
    case 'Booking.com':
      return prop ? `https://www.booking.com/searchresults.html?dest_type=hotel&dest_id=${prop}` : null
    case 'Expedia':
      return prop ? `https://www.expedia.com/h${prop}.Hotel-Information` : null
    case 'Agoda':
      return prop ? `https://www.agoda.com/partners/partnersearch.aspx?hid=${prop}` : null
    case 'Trip.com':
      return prop ? `https://www.trip.com/hotels/detail/?hotelId=${prop}` : null
    default:
      return null
  }
}
