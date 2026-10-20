import type { Website } from '~/components/website-builder/data/websites'
import type { PropertySelection } from '~/components/website-builder/steps/PropertyStep.vue'
import type { ReviewSelection } from '~/components/website-builder/steps/ReviewStep.vue'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import type { Template } from '~/components/website-builder/steps/TemplateStep.vue'
import { websites } from '~/components/website-builder/data/websites'
import { useWebsiteChannel } from '~/composables/useWebsiteChannel'

export interface WebsiteDraft {
  template: Template | null
  settings: WebsiteSettings
  property: PropertySelection
  reviews: ReviewSelection
}

/**
 * Writes a Website Builder website: the wizard's last step and the website
 * editor both save through it. The site's booking rules go to the Website
 * channel, never onto the Website object.
 */
export function useWebsiteSave() {
  const { saveSiteRules } = useWebsiteChannel()

  /** Updates the site `editId`, or adds a new one. Returns its id. */
  function saveWebsite(draft: WebsiteDraft, status: Website['status'], editId?: string) {
    const { template, settings, property, reviews } = draft
    const fields = {
      name: settings.name,
      url: settings.domain,
      status,
      lastUpdated: new Date().toISOString(),
      propertyIds: property.propertyIds,
      reviewIds: reviews.selectedReviewIds,
      featuredReviewIds: reviews.featuredReviewIds,
      manualReviews: reviews.manualReviews,
      featuredManualReviewIds: reviews.featuredManualReviewIds,
      reviewConfig: reviews.config,
    }
    const index = editId ? websites.value.findIndex(w => w.id === editId) : -1
    const existing = websites.value[index]
    let id: string
    if (existing) {
      id = existing.id
      websites.value[index] = { ...existing, ...fields, template: template?.name ?? existing.template }
    }
    else {
      id = String(Date.now())
      websites.value.push({ id, template: template?.name ?? 'Luxury Villa', visits: 0, thumbnail: null, ...fields })
    }
    if (settings.rules)
      saveSiteRules(id, settings.name, settings.rules)
    return id
  }

  return { saveWebsite }
}
