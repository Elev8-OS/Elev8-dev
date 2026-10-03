import type { GuideContentItem, GuideContentKind } from '~/components/listings/data/guest-guide-content'
import { cloneGuideItems, listingGuideItems } from '~/components/listings/data/guest-guide-content'
import { listings } from '~/components/listings/data/listings'

/**
 * Writes guest guide content onto listings beyond the one being edited:
 * copying one kind to other listings. Each target gets its own copy with fresh
 * ids (`cloneGuideItems`). The listing being edited saves through its own
 * `update` emit, like every other listing tab.
 */
export function useListingGuideContent() {
  /** Listings that have items of this kind, for "Import from another listing". */
  function listingsWith(kind: GuideContentKind) {
    return listings.value.filter(l => listingGuideItems(l, kind).length > 0)
  }

  /** Replaces this kind's items on every listing in `listingIds`. Returns how many were updated. */
  function copyToListings(kind: GuideContentKind, items: GuideContentItem[], listingIds: string[]): number {
    const targets = new Set(listingIds)
    let count = 0
    listings.value = listings.value.map((l) => {
      if (!targets.has(l.id))
        return l
      count++
      return { ...l, guestGuide: { ...l.guestGuide, [kind]: cloneGuideItems(items) } }
    })
    return count
  }

  return { listingsWith, copyToListings }
}
