import type { GuideContentItem, GuideContentKind } from './guest-guide-content'
import type { Listing } from './listings'
import type { PetPolicy } from './pet-policy'
import { listingCheckinStepsVisibility } from './checkin-steps-visibility'
import { cloneGuideItems, GUIDE_CONTENT_KINDS, listingGuideItems } from './guest-guide-content'
import { listingGuestVerification } from './guest-verification'
import { listings } from './listings'
import { listingPetPolicy } from './pet-policy'

/**
 * Bulk actions on a listing's guest guide items (the Guest Guide tab's Select
 * mode). Kept out of `guest-guide-content.ts`, which the guide server imports
 * and should not pull in the listings store.
 */

/** The listing without these items of one kind. */
export function removeGuideItems(listing: Listing, kind: GuideContentKind, ids: string[]): Listing {
  const items = listingGuideItems(listing, kind).filter(item => !ids.includes(item.id))
  return { ...listing, guestGuide: { ...listing.guestGuide, [kind]: items } }
}

/**
 * Adds copies of the items (fresh ids, no room label) to the end of the same
 * section of each picked listing, never the source. Returns how many listings
 * were written.
 */
export function copyGuideItemsToListings(sourceId: string, kind: GuideContentKind, items: GuideContentItem[], targetIds: string[]): number {
  const targets = new Set(targetIds.filter(id => id !== sourceId))
  const copies = () => cloneGuideItems(items).map(({ roomName: _room, ...item }) => item)
  listings.value = listings.value.map(l => targets.has(l.id)
    ? { ...l, guestGuide: { ...l.guestGuide, [kind]: [...listingGuideItems(l, kind), ...copies()] } }
    : l)
  return targets.size
}

/**
 * The listing with the items imported from another listing: copies (fresh ids,
 * no room label) added to the end, or replacing this kind's items.
 */
export function importGuideItems(target: Listing, kind: GuideContentKind, items: GuideContentItem[], mode: 'append' | 'replace'): Listing {
  const copies = cloneGuideItems(items).map(({ roomName: _room, ...item }) => item)
  const next = mode === 'replace' ? copies : [...listingGuideItems(target, kind), ...copies]
  return { ...target, guestGuide: { ...target.guestGuide, [kind]: next } }
}

// --- Copy a listing's whole guest guide setup to other listings ---------------

export type GuideSetupPart = 'guide' | 'content' | 'verification'

/**
 * One guide PER LISTING is not the model yet: for now one guide serves every
 * listing. While false the Guest Guide tab hides the assigned guide (card, "not
 * in the guide" warnings) and the whole-setup copy leaves the guide out.
 */
export const GUIDE_PER_LISTING = false

export const GUIDE_SETUP_PARTS: { value: GuideSetupPart, label: string, description: string }[] = [
  { value: 'guide', label: 'Assigned guide', description: 'They use the same guest guide (the look and which sections show).' },
  { value: 'content', label: 'Content', description: 'Check-in steps and when they show, check-out steps, house rules with pets, and Good to Know. Replaces theirs.' },
  { value: 'verification', label: 'Guest verification', description: 'What guests are asked before arrival. Replaces theirs.' },
]

/** Whether a pet package (an upsell service id) reaches guests of the listing with this name. */
export type PackageOffered = (serviceId: string, listingName: string) => boolean

/** What a copy did to one listing: the pet packages left out because the listing does not offer them. */
export interface GuideSetupResult {
  listingId: string
  listingName: string
  skippedPackageIds: string[]
}

/** The pet settings of `source` for a listing with this name, and the packages that listing does not offer. */
function petsFor(source: Listing, targetName: string, offered?: PackageOffered): { policy: PetPolicy, skippedPackageIds: string[] } {
  const pets = listingPetPolicy(source)
  const packageIds = pets.packageIds.filter(id => !offered || offered(id, targetName))
  return { policy: { ...pets, packageIds }, skippedPackageIds: pets.packageIds.filter(id => !packageIds.includes(id)) }
}

/**
 * The parts of `source`'s guest guide setup on `target`, and the pet packages
 * left out. A room's own items are not copied: rooms differ. The content part
 * brings the "Show check-in steps" timing with the steps, and the pet settings
 * with the house rules (pets are part of the house rules). With `offered`, a
 * pet package the target does not offer is skipped, never assigned.
 */
export function applyGuideSetupReport(source: Listing, target: Listing, parts: GuideSetupPart[], offered?: PackageOffered): { listing: Listing, skippedPackageIds: string[] } {
  let next = target
  let skippedPackageIds: string[] = []
  if (parts.includes('content')) {
    const guestGuide = Object.fromEntries(GUIDE_CONTENT_KINDS.map(kind => [kind, cloneGuideItems(listingGuideItems(source, kind))]))
    const pets = petsFor(source, target.name, offered)
    skippedPackageIds = pets.skippedPackageIds
    next = { ...next, guestGuide, checkinStepsVisibility: { ...listingCheckinStepsVisibility(source) }, petPolicy: pets.policy }
  }
  // Through the readers, so a listing still on the defaults copies the defaults.
  if (parts.includes('verification'))
    next = { ...next, guestVerification: { ...listingGuestVerification(source) } }
  return { listing: next, skippedPackageIds }
}

export function applyGuideSetup(source: Listing, target: Listing, parts: GuideSetupPart[], offered?: PackageOffered): Listing {
  return applyGuideSetupReport(source, target, parts, offered).listing
}

/** Writes the listing parts to the picked listings (never the source), one result per listing. The assigned guide is the caller's (`useGuestGuides`). */
export function copyGuideSetupToListings(source: Listing, targetIds: string[], parts: GuideSetupPart[], offered?: PackageOffered): GuideSetupResult[] {
  const targets = new Set(targetIds.filter(id => id !== source.id))
  const results: GuideSetupResult[] = []
  listings.value = listings.value.map((l) => {
    if (!targets.has(l.id))
      return l
    const { listing, skippedPackageIds } = applyGuideSetupReport(source, l, parts, offered)
    results.push({ listingId: l.id, listingName: l.name, skippedPackageIds })
    return listing
  })
  return results
}

// --- Import a setting from another listing ------------------------------------

/** The listing with the guest verification of `source` (replaces its own). */
export function importGuestVerification(target: Listing, source: Listing): Listing {
  return { ...target, guestVerification: { ...listingGuestVerification(source) } }
}

/** The listing with the pet settings of `source` (replaces its own), and the packages it does not offer, left out. */
export function importPetPolicy(target: Listing, source: Listing, offered?: PackageOffered): { listing: Listing, skippedPackageIds: string[] } {
  const { policy, skippedPackageIds } = petsFor(source, target.name, offered)
  return { listing: { ...target, petPolicy: policy }, skippedPackageIds }
}
