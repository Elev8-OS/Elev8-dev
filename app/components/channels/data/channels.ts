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

export type ChannelMappingStatus = 'syncing' | 'active' | 'error'

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
  error?: string
}

export const MAPPING_STATUS_LABEL: Record<ChannelMappingStatus, string> = {
  active: 'Live',
  syncing: 'Syncing',
  error: 'Error',
}
