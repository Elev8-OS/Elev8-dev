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
  /** Labels of what is still to fill in, in the section's order. */
  missing: string[]
}

export interface ListingSetupProgress {
  sections: ListingSetupSectionProgress[]
  completeSections: number
  /** Average of the sections' own completion, so Basics' 8 fields do not outweigh the rest. */
  percent: number
}

const filled = (val?: string) => !!val?.trim()

interface SetupCheck { label: string, ok: boolean }

function section(key: ListingSetupSection, label: string, icon: string, checks: SetupCheck[]): ListingSetupSectionProgress {
  const done = checks.filter(c => c.ok).length
  const missing = checks.filter(c => !c.ok).map(c => c.label)
  return { key, label, icon, done, total: checks.length, complete: done === checks.length, missing }
}

/** One check per counted (not `optional`) field across the groups. */
function groupChecks(listing: Listing, groups: ListingDetailGroup[]): SetupCheck[] {
  return groups.flatMap(g => g.fields.filter(f => !f.optional).map(f => ({ label: f.label, ok: filled(f.read(listing)) })))
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
      { label: 'Name', ok: filled(listing.name) },
      { label: 'Time zone', ok: filled(listingTimeZone(listing)) },
      { label: 'Property type', ok: filled(listingPropertyType(listing)) },
      { label: 'Street', ok: filled(address.street) },
      { label: 'City', ok: filled(address.city) },
      { label: 'State', ok: filled(address.state) },
      { label: 'Postal code', ok: filled(address.postalCode) },
      { label: 'Country', ok: filled(address.country) },
      { label: 'Photos', ok: listing.photos.length > 0 },
    ]),
    section('listing-details', 'Listing Details', 'lucide:file-text', groupChecks(listing, LISTING_DETAIL_GROUPS)),
    section('amenities', 'Amenities', 'lucide:sofa', [
      { label: 'Property amenities', ok: listing.amenities.length > 0 },
      { label: 'Room amenities', ok: roomAmenityTargets(listing).every(t => t.amenities.length > 0) },
    ]),
    section('sops', 'SOPs', 'lucide:clipboard-list', groupChecks(listing, visibleSopGroups(listing))),
    section('topics', 'Topics to Avoid', 'lucide:message-circle-off', [{ label: 'Topics to avoid', ok: listingAvoidTopics(listing).length > 0 }]),
  ]
  // A section with nothing to fill in (every SOP question deleted) counts as done.
  const percent = Math.round(sections.reduce((sum, s) => sum + (s.total ? s.done / s.total : 1), 0) / sections.length * 100)
  return { sections, completeSections: sections.filter(s => s.complete).length, percent }
}
