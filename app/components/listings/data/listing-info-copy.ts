import type { GuideContentKind } from './guest-guide-content'
import type { Listing } from './listings'
import { listingCheckinStepsVisibility } from './checkin-steps-visibility'
import { cloneGuideItems, listingGuideItems } from './guest-guide-content'
import { listingGuestVerification } from './guest-verification'
import { applyAvoidTopics, listingAvoidTopics } from './listing-avoid-topics'
import { LISTING_DETAIL_GROUPS } from './listing-details'
import { applySops, selectableSopIds } from './listing-sops'
import { listings } from './listings'
import { listingPetPolicy } from './pet-policy'

/**
 * Copy a listing's info to other listings, part by part (the hero's "Copy
 * info" button). A part is a section of Listing Setup or the Guest Guide tab.
 * Not copied at all: name, address, photos, rooms, pricing, channels. Kept in
 * `listings/data` next to the other bulk helpers; the writers are the same
 * ones the per-section Select mode uses, so both behave alike.
 */
export type ListingInfoPart = 'booking' | 'arrival' | 'details' | 'amenities' | 'sops' | 'avoid_topics' | GuestGuideInfoPart

/** The guest guide, one part per piece so the dialog can expand it. */
export type GuestGuideInfoPart = 'guide_checkin' | 'guide_checkout' | 'guide_house_rules' | 'guide_good_to_know' | 'guide_verification' | 'guide_pets' | 'guide_checkin_visibility'

/**
 * Listing Details fields that belong to one property and are never copied:
 * Wi-Fi, how to find it and the two descriptions.
 */
export const PROPERTY_ONLY_DETAIL_KEYS = ['wifiSsid', 'wifiPassword', 'howToFind', 'description', 'neighborhood']

export const LISTING_INFO_PARTS: Array<{ value: ListingInfoPart, label: string, description: string, icon: string }> = [
  { value: 'booking', label: 'Booking', description: 'Cancellation policies, direct booking changes, payment schedule, booking window.', icon: 'lucide:calendar-check' },
  { value: 'arrival', label: 'Check-in and check-out', description: 'Support hours, check-in window, check-out time, parking, access, early and late, trash.', icon: 'lucide:key-round' },
  { value: 'details', label: 'Details', description: 'Min and max stay, guest age, max guests, size, floors, bedrooms, bathrooms. Not Wi-Fi or the descriptions.', icon: 'lucide:house' },
  { value: 'amenities', label: 'Amenities', description: 'The property amenities. Replaces theirs.', icon: 'lucide:sofa' },
  { value: 'sops', label: 'SOPs', description: 'Answered SOPs and custom SOPs. Their own answers stay where you have none.', icon: 'lucide:clipboard-list' },
  { value: 'avoid_topics', label: 'Topics to avoid', description: 'Added to theirs; a topic with the same name is replaced.', icon: 'lucide:message-circle-off' },
]

/** Parts shown under one expandable row. Items replace the target's. */
export const GUEST_GUIDE_INFO_PARTS: Array<{ value: GuestGuideInfoPart, label: string, description: string, icon: string }> = [
  { value: 'guide_checkin', label: 'Check-in steps', description: 'The steps and their photos.', icon: 'lucide:log-in' },
  { value: 'guide_checkout', label: 'Check-out steps', description: 'The steps and their photos.', icon: 'lucide:log-out' },
  { value: 'guide_house_rules', label: 'House rules', description: 'Also printed on the house-rules agreement.', icon: 'lucide:scroll' },
  { value: 'guide_good_to_know', label: 'Good to know', description: 'Tips with their icons and photos.', icon: 'lucide:info' },
  { value: 'guide_verification', label: 'Guest verification', description: 'What guests are asked before arrival.', icon: 'lucide:shield-check' },
  { value: 'guide_pets', label: 'Pets', description: 'Whether pets are allowed, and the pet packages.', icon: 'lucide:paw-print' },
  { value: 'guide_checkin_visibility', label: 'When check-in steps show', description: 'Hours before check-in, or always.', icon: 'lucide:eye' },
]

const GUIDE_KIND_BY_PART: Partial<Record<ListingInfoPart, GuideContentKind>> = {
  guide_checkin: 'checkin',
  guide_checkout: 'checkout',
  guide_house_rules: 'house_rules',
  guide_good_to_know: 'good_to_know',
}

const DETAIL_GROUP_BY_PART: Partial<Record<ListingInfoPart, string>> = { booking: 'booking', arrival: 'arrival', details: 'details' }

/** What this listing has for a part, so the dialog can grey out an empty one. */
export function listingInfoPartCount(listing: Listing, part: ListingInfoPart): number {
  const group = DETAIL_GROUP_BY_PART[part]
  if (group)
    return copyableDetailFields(group).filter(f => f.read(listing).trim()).length
  if (part === 'amenities')
    return listing.amenities?.length ?? 0
  if (part === 'sops')
    return selectableSopIds(listing).length
  if (part === 'avoid_topics')
    return listingAvoidTopics(listing).length
  const kind = GUIDE_KIND_BY_PART[part]
  if (kind)
    return listingGuideItems(listing, kind).length
  // Settings with defaults: always something to copy.
  return 1
}

function copyableDetailFields(groupKey: string) {
  return (LISTING_DETAIL_GROUPS.find(g => g.key === groupKey)?.fields ?? []).filter(f => !PROPERTY_ONLY_DETAIL_KEYS.includes(f.key))
}

/** `target` with the parts of `source` applied. Never mutates either; an unanswered field never wipes the target's answer. */
export function applyListingInfo(source: Listing, target: Listing, parts: ListingInfoPart[]): Listing {
  let next = target
  for (const part of parts) {
    const group = DETAIL_GROUP_BY_PART[part]
    if (group) {
      for (const field of copyableDetailFields(group)) {
        if (field.read(source).trim())
          next = field.write(next, field.read(source))
        if (field.writeEnd && field.readEnd?.(source).trim())
          next = field.writeEnd(next, field.readEnd(source))
      }
    }
    else if (part === 'amenities') {
      next = { ...next, amenities: [...(source.amenities ?? [])] }
    }
    else if (part === 'sops') {
      next = applySops(source, next, selectableSopIds(source))
    }
    else if (part === 'avoid_topics') {
      next = applyAvoidTopics(next, listingAvoidTopics(source))
    }
    else if (GUIDE_KIND_BY_PART[part]) {
      const kind = GUIDE_KIND_BY_PART[part]!
      next = { ...next, guestGuide: { ...next.guestGuide, [kind]: cloneGuideItems(listingGuideItems(source, kind)) } }
    }
    else if (part === 'guide_verification') {
      next = { ...next, guestVerification: { ...listingGuestVerification(source) } }
    }
    else if (part === 'guide_pets') {
      const pets = listingPetPolicy(source)
      next = { ...next, petPolicy: { ...pets, packageIds: [...pets.packageIds] } }
    }
    else if (part === 'guide_checkin_visibility') {
      next = { ...next, checkinStepsVisibility: { ...listingCheckinStepsVisibility(source) } }
    }
  }
  return next
}

/** Writes the parts to the picked listings (never the source). Returns how many listings were written. */
export function copyListingInfoToListings(source: Listing, targetIds: string[], parts: ListingInfoPart[]): number {
  const targets = new Set(targetIds.filter(id => id !== source.id))
  listings.value = listings.value.map(l => targets.has(l.id) ? applyListingInfo(source, l, parts) : l)
  return targets.size
}
