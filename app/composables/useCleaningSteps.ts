import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { computed } from 'vue'
import { cloneCleaningSteps, hasCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import { listings } from '~/components/listings/data/listings'

/**
 * Listing-level writes for cleaning steps that reach beyond the listing being
 * edited: copying one listing's steps onto others. Each target gets its own
 * copy with fresh ids (`cloneCleaningSteps`), so listings never share steps.
 */
export function useCleaningSteps() {
  const listingsWithSteps = computed(() => listings.value.filter(l => hasCleaningSteps(l)))

  /** Replaces the cleaning steps of every listing in `listingIds`. Returns how many were updated. */
  function copyStepsToListings(steps: CleaningStepSection[], listingIds: string[]): number {
    const targets = new Set(listingIds)
    let count = 0
    listings.value = listings.value.map((l) => {
      if (!targets.has(l.id))
        return l
      count++
      return { ...l, maintenance: { ...l.maintenance, cleaningSteps: cloneCleaningSteps(steps) } }
    })
    return count
  }

  return { listingsWithSteps, copyStepsToListings }
}
