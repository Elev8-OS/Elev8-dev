import type { GuideContentItem, GuideContentKind } from './guest-guide-content'
import type { Listing } from './listings'
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

export type GuideSetupPart = 'guide' | 'content' | 'verification' | 'pets'

/**
 * One guide PER LISTING is not the model yet: for now one guide serves every
 * listing. While false the Guest Guide tab hides the assigned guide (card, "not
 * in the guide" warnings) and the whole-setup copy leaves the guide out.
 */
export const GUIDE_PER_LISTING = false

export const GUIDE_SETUP_PARTS: { value: GuideSetupPart, label: string, description: string }[] = [
  { value: 'guide', label: 'Assigned guide', description: 'They use the same guest guide (the look and which sections show).' },
  { value: 'content', label: 'Content', description: 'Check-in steps, check-out steps, house rules and Good to Know. Replaces theirs.' },
  { value: 'verification', label: 'Guest verification', description: 'What guests are asked before arrival.' },
  { value: 'pets', label: 'Pets', description: 'Whether pets are allowed, and the pet packages.' },
]

/** The parts of `source`'s guest guide setup on `target`. A room's own items are not copied: rooms differ. */
export function applyGuideSetup(source: Listing, target: Listing, parts: GuideSetupPart[]): Listing {
  let next = target
  if (parts.includes('content')) {
    const guestGuide = Object.fromEntries(GUIDE_CONTENT_KINDS.map(kind => [kind, cloneGuideItems(listingGuideItems(source, kind))]))
    next = { ...next, guestGuide }
  }
  // Through the readers, so a listing still on the defaults copies the defaults.
  if (parts.includes('verification'))
    next = { ...next, guestVerification: { ...listingGuestVerification(source) } }
  if (parts.includes('pets')) {
    const pets = listingPetPolicy(source)
    next = { ...next, petPolicy: { ...pets, packageIds: [...pets.packageIds] } }
  }
  return next
}

/** Writes the listing parts to the picked listings (never the source). The assigned guide is the caller's (`useGuestGuides`). */
export function copyGuideSetupToListings(source: Listing, targetIds: string[], parts: GuideSetupPart[]): number {
  const targets = new Set(targetIds.filter(id => id !== source.id))
  listings.value = listings.value.map(l => targets.has(l.id) ? applyGuideSetup(source, l, parts) : l)
  return targets.size
}
