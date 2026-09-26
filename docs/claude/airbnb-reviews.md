> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Airbnb Reviews Module (`app/components/airbnb-reviews/`)

AI-powered guest review automation for Airbnb. Generates fair, professional reviews based on communication history and housekeeping feedback.

**New files:**
```
app/
├── pages/reviews.vue
├── components/airbnb-reviews/
│   ├── PreviewDialog.vue          # Editable preview (text, ratings, checkboxes)
│   └── data/reviews.ts            # Types, mock data, config defaults
├── components/settings/
│   └── AirbnbReviewConfig.vue     # Settings form in Integrations page
└── composables/useAirbnbReviews.ts # State + CRUD + mock generation
```

**Data Model:**
```ts
interface AutoReview {
  id: string
  booking_id: string
  property_id: string
  guest_name: string
  checkout_date: string
  listing_name: string
  listing_location: string
  num_guests: number
  nights: number
  status: 'pending' | 'generating' | 'draft' | 'posted' | 'failed'
  generated_at: string | null
  ai_model: string
  generation_cost: number | null
  host_language: HostLanguage
  strict_mode: boolean
  tone_mode: ToneMode
  public_review: string | null
  private_feedback: string | null
  ratings: ReviewRatings | null
  recommend_guest: boolean | null
  would_host_again: boolean | null
  manually_edited: boolean
  edited_at: string | null
  airbnb_review_id: string | null
  posted_to_airbnb_at: string | null
}

type ReviewStatus = 'pending' | 'generating' | 'draft' | 'posted' | 'failed'
type ToneMode = 'balanced' | 'gentle' | 'data-driven'
type HostLanguage = 'en' | 'de' | 'fr' | 'id' | 'es' | 'it' | 'pt'
```

**Settings (`ReviewAutomationConfig`):**
- `enabled` — toggle (default: false)
- `host_language` — 7 languages (en/de/fr/id/es/it/pt)
- `tone_mode` — balanced/gentle/data-driven
- `auto_post` — auto-post or save as draft
- `review_delay_hours` — 1-168 hours (default: 24)
- Persisted to localStorage (`elev8-airbnb-review-config`)

**Settings Page:** Review Hub settings moved to a right-side Sheet on `/reviews` page (via "Settings" button in page header). The `/settings/integrations` page now only contains WhatsApp integration. See **Review Hub Module** section for full config schema.

**Dashboard Page:** `/reviews` — stats cards (pending/draft/posted/failed), filter bar (search, status, listing), table with actions.

**Preview Dialog:** Single dialog for preview + edit. Draft reviews have editable Textareas, clickable star ratings, checkboxes, Regenerate/Save as Draft/Post to Airbnb buttons. Posted reviews are read-only.

**Status Lifecycle:** `pending` → `generating` → `draft` → `posted` (or `failed` → retry)

**Mock Generation:** `generateMockReview()` produces realistic reviews with positive/mixed variants. 1.5s simulated delay. `regenerateReview()` re-generates with different wording.

**Auto-open Preview:** Clicking Generate in table auto-opens preview dialog after generation completes.

**Composable (`useAirbnbReviews`):**
- `reviews` — `useState<AutoReview[]>` with JSON.parse(JSON.stringify(mockReviews))
- `config` — `useState<ReviewAutomationConfig>` with localStorage persistence
- `filterStatus`, `filterListing`, `searchQuery` — filter refs
- `filteredReviews` — computed from filters
- `stats` — computed counts by status
- `approveReview(id)` — sets status to posted
- `saveDraft(id, data)` — saves edits, marks manually_edited
- `generateReview(id)` — mock AI generation
- `regenerateReview(id)` — re-generates review
- `retryFailed(id)` — retries failed generation

**Notification Integration:**
- Alert types: `AIRBNB_REVIEW_GENERATED`, `AIRBNB_REVIEW_POSTED`, `AIRBNB_REVIEW_FAILED`
- Added to `alertDisplayLabels`, `alertIcons`, `alertRouteMap`, `getDescription()`
- `useNotifications` filter kind: `'reviews'`
- NotificationCenter kind tabs includes "Reviews" tab

**Sidebar:** Added under General section (`i-lucide-star` icon, marked `new: true`)
