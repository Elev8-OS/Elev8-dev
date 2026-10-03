import type { ListingDetailGroup } from './listing-details'
import type { Listing } from './listings'
import { listingAddress, listingPropertyType, listingTimeZone } from './listing-address'
import { roomAmenityTargets } from './listing-amenities'
import { listingAvoidTopics } from './listing-avoid-topics'
import { LISTING_DETAIL_GROUPS } from './listing-details'
import { visibleSopGroups } from './listing-sops'

export type ListingSetupSection = 'basics' | 'listing-details' | 'amenities' | 'sops' | 'topics'

export interface ListingSetupSectionProgress {
  key: ListingSetupSection
  label: string
  icon: string
  done: number
  total: number
  complete: boolean
}

export interface ListingSetupProgress {
  sections: ListingSetupSectionProgress[]
  completeSections: number
  /** Average of the sections' own completion, so Basics' 8 fields do not outweigh the rest. */
  percent: number
}

const filled = (val?: string) => !!val?.trim()

function section(key: ListingSetupSection, label: string, icon: string, checks: boolean[]): ListingSetupSectionProgress {
  const done = checks.filter(Boolean).length
  return { key, label, icon, done, total: checks.length, complete: done === checks.length }
}

/** One check per counted (not `optional`) field across the groups. */
function groupChecks(listing: Listing, groups: ListingDetailGroup[]): boolean[] {
  return groups.flatMap(g => g.fields.filter(f => !f.optional).map(f => filled(f.read(listing))))
}

/**
 * What the property view of Listing Setup counts as filled in. Unit Number is
 * optional (most villas have none) and is not counted. Listing Details counts
 * the fields of `LISTING_DETAIL_GROUPS` that are not `optional`; check-in/out
 * times count when set or still on the default the form shows. Amenities is two
 * checks: some property amenity, and some room amenity on every room type. SOPs
 * counts the `SOP_GROUPS` questions the listing has not deleted; General
 * procedures and custom SOPs are optional.
 */
export function listingSetupProgress(listing: Listing): ListingSetupProgress {
  const address = listingAddress(listing)
  const sections = [
    section('basics', 'Basics', 'lucide:house', [
      filled(listing.name),
      filled(listingTimeZone(listing)),
      filled(listingPropertyType(listing)),
      filled(address.street),
      filled(address.city),
      filled(address.state),
      filled(address.postalCode),
      filled(address.country),
    ]),
    section('listing-details', 'Listing Details', 'lucide:file-text', groupChecks(listing, LISTING_DETAIL_GROUPS)),
    section('amenities', 'Amenities', 'lucide:sofa', [
      listing.amenities.length > 0,
      roomAmenityTargets(listing).every(t => t.amenities.length > 0),
    ]),
    section('sops', 'SOPs', 'lucide:clipboard-list', groupChecks(listing, visibleSopGroups(listing))),
    section('topics', 'Topics to Avoid', 'lucide:message-circle-off', [listingAvoidTopics(listing).length > 0]),
  ]
  // A section with nothing to fill in (every SOP question deleted) counts as done.
  const percent = Math.round(sections.reduce((sum, s) => sum + (s.total ? s.done / s.total : 1), 0) / sections.length * 100)
  return { sections, completeSections: sections.filter(s => s.complete).length, percent }
}
