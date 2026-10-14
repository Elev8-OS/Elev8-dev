import type { CleaningTemplateType } from '~/components/cleaning/data/cleaning-step-templates'
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { computed } from 'vue'
import { LISTING_CUSTOM_STEPS, listingChecklistOverrides, withListingOverride } from '~/components/cleaning/data/cleaning-step-templates'
import { cloneCleaningSteps, hasCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import { listings } from '~/components/listings/data/listings'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

/**
 * Listing-level writes for cleaning checklists that reach beyond the listing
 * being edited: copying one listing's custom steps onto others, and setting a
 * cleaning type's checklist on many listings at once. Each target gets its own
 * copy of steps with fresh ids (`cloneCleaningSteps`), so listings never share
 * steps.
 *
 * Overrides are written through `withListingOverride`, which keeps a listing
 * on the lazy migration whole.
 */
export function useCleaningSteps() {
  const { templates } = useCleaningStepTemplates()
  const listingsWithSteps = computed(() => listings.value.filter(l => hasCleaningSteps(l)))

  /**
   * Replaces the custom steps of every listing in `listingIds`, and points
   * `customTypes` at them on each. Returns how many were updated.
   */
  function copyStepsToListings(steps: CleaningStepSection[], listingIds: string[], customTypes: CleaningTemplateType[] = []): number {
    const targets = new Set(listingIds)
    let count = 0
    listings.value = listings.value.map((l) => {
      if (!targets.has(l.id))
        return l
      count++
      const maintenance = { ...l.maintenance, cleaningSteps: cloneCleaningSteps(steps) }
      return customTypes.length
        ? { ...l, maintenance: { ...maintenance, cleaningTemplates: withListingOverride(l.maintenance, templates.value, customTypes, LISTING_CUSTOM_STEPS) } }
        : { ...l, maintenance }
    })
    return count
  }

  /**
   * Sets one cleaning type's checklist on every listing in `listingIds`: a
   * template id, `LISTING_CUSTOM_STEPS`, or null to follow the company default.
   * Returns how many listings changed.
   */
  function setListingChecklist(listingIds: string[], type: CleaningTemplateType, value: string | null): number {
    const targets = new Set(listingIds)
    let count = 0
    listings.value = listings.value.map((l) => {
      if (!targets.has(l.id))
        return l
      const before = listingChecklistOverrides(l.maintenance, templates.value)[type] ?? null
      const cleaningTemplates = withListingOverride(l.maintenance, templates.value, [type], value)
      if (before !== value)
        count++
      return { ...l, maintenance: { ...l.maintenance, cleaningTemplates } }
    })
    return count
  }

  return { listingsWithSteps, copyStepsToListings, setListingChecklist }
}
