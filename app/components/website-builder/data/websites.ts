import type { ReviewSource } from '~/components/review-hub/data/types'
import type { WebsiteReviewConfig } from '~/components/website-builder/data/review-config'

// Shared website-builder data. Originally lived inline in
// `app/pages/website-builder/index.vue` — extracted so other surfaces
// (e.g. Promo Code channel restriction) can read the same list of
// mock websites without forking the data.

export type WebsiteStatus = 'published' | 'draft' | 'building'

export interface ManualReview {
  id: string
  guestName: string
  rating: number
  text: string
  source: 'manual'
  listingId: string
  channel: ReviewSource
}

export interface Website {
  id: string
  name: string
  url: string
  status: WebsiteStatus
  template: string
  visits: number
  lastUpdated: string
  thumbnail: string | null
  reviewIds?: string[]
  featuredReviewIds?: string[]
  manualReviews?: ManualReview[]
  featuredManualReviewIds?: string[]
  // Optional so the seeded mock websites need no migration; readers fall back
  // to createDefaultReviewConfig().
  reviewConfig?: WebsiteReviewConfig
  // Website Builder properties this site markets — the same ids PropertyStep
  // collects. Resolve to listings with `getListingIdsForWebsite`. Optional:
  // an older website with no coverage recorded is treated as covering
  // everything rather than nothing, so nothing silently disappears.
  propertyIds?: string[]
}

export const websites = ref<Website[]>([
  {
    id: '1',
    name: 'Villa Sunset Bali',
    url: 'villa-sunset-bali.com',
    status: 'published',
    template: 'Luxury Villa',
    visits: 2847,
    lastUpdated: '2025-04-20T10:30:00Z',
    thumbnail: null,
    propertyIds: ['prop-1'],
  },
  {
    id: '2',
    name: 'Ubud Jungle Retreat',
    url: 'ubud-jungle-retreat.com',
    status: 'published',
    template: 'Modern Tropical',
    visits: 1523,
    lastUpdated: '2025-04-18T14:15:00Z',
    thumbnail: null,
    propertyIds: ['prop-2'],
  },
  {
    id: '3',
    name: 'Seminyak Beach House',
    url: 'seminyak-beach-house.com',
    status: 'draft',
    template: 'Beach House',
    visits: 0,
    lastUpdated: '2025-04-25T09:00:00Z',
    thumbnail: null,
    propertyIds: ['prop-3'],
  },
  {
    id: '4',
    name: 'Canggu Surf Villa',
    url: 'canggu-surf-villa.com',
    status: 'building',
    template: 'Modern Tropical',
    visits: 0,
    lastUpdated: '2025-04-28T16:45:00Z',
    thumbnail: null,
    propertyIds: ['prop-3', 'prop-4'],
  },
])

/**
 * Flips a website between published and draft.
 *
 * Unpublishing is not a delete: the site keeps its content, its review rules and its
 * property coverage, it just stops being served — so a host can take a site down for a
 * season and put it back without rebuilding it. Spread mutation, so the `ref` stays
 * reactive for the cards reading it.
 */
export function setWebsiteStatus(id: string, status: WebsiteStatus): Website | null {
  const index = websites.value.findIndex(w => w.id === id)
  const existing = websites.value[index]
  if (!existing)
    return null
  const updated: Website = { ...existing, status, lastUpdated: new Date().toISOString() }
  websites.value[index] = updated
  return updated
}
