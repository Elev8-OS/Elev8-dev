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
  },
])
