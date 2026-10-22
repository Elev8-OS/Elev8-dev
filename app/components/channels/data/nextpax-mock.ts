/**
 * Mock stand-ins for what the NextPax backend would answer on the channel detail
 * page. Setting names and which ones are required come from the backend's own
 * comments (`docs/claude/nextpax-channels.md`); the option lists and payment
 * method codes are invented, because the real ones arrive from
 * `channel-settings-definitions` and `constants/mapping-codes` at runtime.
 */
import type { ConnectResult } from './nextpax'

export interface NextPaxSettingDefinition {
  settingName: string
  settingDescription: string
  settingType: 'text' | 'number' | 'select'
  settingRequired: boolean
  settingOptions?: string[]
  /** Can differ per listing, e.g. a villa owned by someone else. Set per row in the wizard's Listings step. */
  availableOnPropertyLevel: boolean
}

export const NEXTPAX_SETTING_DEFINITIONS: Record<string, NextPaxSettingDefinition[]> = {
  // Airbnb asks for nothing at account level; its host id is entered per listing.
  AIR298: [],
  BOO142: [
    { settingName: 'legal_entity_id', settingDescription: 'The contracting entity id from your Booking.com extranet.', settingType: 'text', settingRequired: true, availableOnPropertyLevel: true },
    { settingName: 'pricing_model', settingDescription: 'How Booking.com prices a stay.', settingType: 'select', settingRequired: true, settingOptions: ['Per night', 'Per person'], availableOnPropertyLevel: false },
  ],
  HOM143: [
    { settingName: 'advertiser_id', settingDescription: 'Your Vrbo advertiser id.', settingType: 'text', settingRequired: true, availableOnPropertyLevel: true },
  ],
  EXP270: [
    { settingName: 'pricing_model', settingDescription: 'How Expedia prices a stay.', settingType: 'select', settingRequired: true, settingOptions: ['Per night', 'Per person'], availableOnPropertyLevel: true },
  ],
}

export const NEXTPAX_PAYMENT_METHODS = [
  { value: 'credit-card', label: 'Credit card' },
  { value: 'debit-card', label: 'Debit card' },
  { value: 'bank-transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash on arrival' },
]

export const BOOKING_RATE_PLAN_WARNING = 'Property must have a rate plan created specifically for Booking.com.'

/**
 * The connect answer for these listings. Booking.com is the one channel that
 * accepts the write and quietly drops a property, saying why only in the
 * warnings, so the first listing carries that warning to keep the case visible.
 * A listing linked with its rate plans paired already has one, so it is spared.
 */
export function mockConnectResult(channelCode: string, listingIds: string[], ratePlansPaired: string[] = []): ConnectResult {
  const warned = channelCode === 'BOO142' ? listingIds.find(id => !ratePlansPaired.includes(id)) : undefined
  return {
    channel_id: channelCode,
    enabled: listingIds.length,
    failed: 0,
    properties: listingIds.map(id => ({
      property_id: id,
      is_parent: false,
      enabled: true,
      warnings: id === warned ? [BOOKING_RATE_PLAN_WARNING] : undefined,
    })),
  }
}

/** `legal_entity_id` to "Legal entity id". */
export function prettySettingName(name: string): string {
  const spaced = name.replace(/_/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
