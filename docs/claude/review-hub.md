> Split out of CLAUDE.md to keep the always-loaded context small. Read this file before working on this area; keep it updated when the code changes.

### Review Hub Module (`app/components/review-hub/`)

3-panel guest review aggregator (Airbnb + Booking.com + Direct), aligned with **Channex API**. Combines guest review replies, AI-drafted host review-of-guest, and Stay Operational Record (SOR) signals with tag enrichment.

**New files:**
```
app/
├── pages/reviews.vue                   # Page: feed table + ScoreCards + settings sheet + banner
├── components/review-hub/
│   ├── DetailDrawer.vue                # 3-panel drawer (guest review, SOR, reply, host review)
│   ├── DetailGuestPanel.vue            # Guest review + rating breakdown + Channex tags chips
│   ├── DetailSorPanel.vue              # Stay Report (cleaning, house rules, communication)
│   ├── FeedTable.vue                   # TanStack table with contextual action buttons
│   ├── Filters.vue                     # Status / channel / property (PropertyPicker)
│   ├── HostReviewPanel.vue             # AI host review of guest (Airbnb-only) + rating + tags
│   ├── MiniBadges.vue                  # Numeric badges: cleaning/house rules/communication
│   ├── ReplyPanel.vue                  # AI reply to guest review (text-only, all channels)
│   ├── ScoreCards.vue                  # Aggregate property scores above feed
│   ├── SourceBadge.vue                 # Channel badge (Airbnb / Booking.com / Direct)
│   ├── StatusChip.vue                  # Reply status chip (3 states)
│   └── data/
│       ├── types.ts                    # Channex-aligned types + tag mappings + display helpers
│       ├── mock-review-records.ts      # 10 mock records (Channex format, 0-10 scores)
│       └── mock-sor.ts                 # 10 mock SOR records
├── composables/useReviewHub.ts         # State + filters + computed status + tag enrichment
└── components/settings/AirbnbReviewConfig.vue  # Host review + reply auto-post settings
```

**Data Model (Channex-Aligned):**
```ts
type ReviewSource = 'airbnb' | 'booking_com' | 'direct'
type ReplyStatus = 'host_review_pending' | 'needs_reply' | 'replied'

interface ScoreCategory {
  category: string  // Channex: "clean", "accuracy", "communication", "location", etc.
  score: number     // 0-10 scale, all channels normalized
}

interface ReviewRecord {
  id: string
  reservation_id: string
  source: ReviewSource
  listing_id, listing_name, listing_location
  unit_id: string | null
  guest_name, num_guests, nights
  guest_rating_overall: number | null  // Channex: 0-10, all channels normalized
  scores: ScoreCategory[]              // Channex: [{category: "clean", score: 9.5}, ...]
  tags: string[]                       // Channex: ~80+ predefined tag codes (Airbnb only)
  guest_review_text: string | null
  is_hidden: boolean                   // Channex: Airbnb double-blind flag
  is_replied: boolean                  // Channex: host has replied
  private_feedback: string | null
  review_received_at, language_detected
  reply_status: ReplyStatus            // Elev8 computed
  reply_text, reply_posted_at
  host_review_id: string | null
  host_review_text: string | null
  host_review_ratings: { cleanliness, communication, respect_house_rules } | null  // Channex 1-5
  is_reviewee_recommended: boolean | null  // Channex flag
  host_review_tags: string[]           // Channex host review tags
  sor_id, checkout_date, created_at, updated_at
}
```

**Channex API Mapping:**
- `GET /reviews` → `ReviewRecord` (scores[], tags[], is_hidden, is_replied)
- `POST /reviews/:id/reply` → text-only reply (`{ reply: { reply: "text" } }`)
- `POST /reviews/:id/guest_review` → **Airbnb only**: scores, public_review, private_review, `is_reviewee_recommended`, tags[]
- Tags are Airbnb-only; Booking.com reviews have empty `tags[]`
- All scores normalized to 0-10 by Channex; display helpers: `getDisplayScore()` (Airbnb ÷2, Booking.com as-is), `getDisplayMax()` (Airbnb 5, Booking.com 10)

**Computed Status (getComputedStatus):**
- `replied` — `is_replied === true`
- `host_review_pending` — Airbnb: `!host_review_id && window > 0`; Booking.com: same + 365d window
- `needs_reply` — guest review visible + has content + not replied

**Airbnb Double-Blind (isGuestReviewHidden):**
- Hidden when: `is_hidden === true` + `!host_review_id` + `< 14 days since checkout`
- Auto-reveal: after 14d from checkout OR when host submits review (sets `is_hidden: false`)
- Reply window: Airbnb ~44d from checkout (14d blind + 30d reply), Booking.com 30d

**Host Review of Guest (Airbnb Only):**
- Channex `POST /guest_review` is Airbnb only — Booking.com/Direct don't support it
- HostReviewPanel rendered only when `showHostReviewPanel` computed is true:
  - Already submitted (readonly view)
  - Airbnb: guest review still hidden (double-blind active)
- Panel includes: public review, private feedback, 3 ratings (cleanliness, communication, respect_house_rules), `is_reviewee_recommended` toggle, 22 host review tags selector
- `generateHostReviewDraft()` returns tags[] derived from SOR signals (auto-selected on generate)
- `submitHostReview(id, text, ratings, isRecommended, tags)` — sets `is_hidden: false`

**Tag System:**
- **Guest review tags** (~80+): `guest_review_host_positive_spotless_furniture_and_linens`, `negative_dirty_or_dusty`, etc. Displayed as green/red chips in DetailGuestPanel (expandable, 4 visible + "+N more")
- **Host review tags** (22): 8 cleanliness, 7 house_rules, 7 communication — selectable chips in HostReviewPanel
- **Tag enrichment** (`enrichSorFromTags`): derives cleaning_score/communication_score/house_rule_flags from Channex tags when SOR data is missing or sparse. Does not override existing SOR data.

**ScoreCards:**
- Aggregate scores computed from `filteredFeedItems`: overall average + top 3 category scores with counts
- Rendered above feed table on `/reviews` page

**Settings (AirbnbReviewConfig.vue):**
- Two separate sections with distinct icons:
  - **Host Review of Guest** (icon: user-check): Airbnb auto-post toggle, submission delay (1-13d), auto-select tags toggle
  - **Reply to Guest Review** (icon: message-circle): Airbnb + Booking.com per-channel auto-post toggles, reply delay (0-30d)
- Shared: master toggle, language (7 options), tone (balanced/gentle/data-driven), generation delay (1-168h)
- Config fields: `auto_post_host_review`, `host_review_delay_days`, `auto_select_tags`, `auto_post_replies: { airbnb, booking_com }`, `reply_delay_days`

**Composable (`useReviewHub`):**
- `reviewRecords`, `sorRecords` — `useState<>()` with deep-cloned mock data
- `filteredFeedItems` — computed: filter by status (computed)/channel/property + search, sorted by checkout desc
- `feedItems` — computed: merges ReviewRecord + enriched SOR + hostReview from `useAirbnbReviews`
- `getComputedStatus(record)` — derives ReplyStatus from is_hidden/is_replied/host_review_id/countdown
- `isGuestReviewHidden(record)` — double-blind check (is_hidden + 14d)
- `isGuestReviewVisible(record)` — inverse
- `getHostReviewCountdown(checkout, source)` — 14d Airbnb / 365d Booking.com
- `getReplyCountdown(checkout, source)` — 44d Airbnb / 30d Booking.com
- `enrichSorFromTags(record, sor)` — tag-derived SOR signals
- `generateReplyDraft(recordId)` — 1.5s mock, positive/mixed/negative based on overall score (≥8 positive)
- `generateHostReviewDraft(recordId)` — 1.5s mock, returns `{ text, privateFeedback, ratings, tags }`
- `approveReply(recordId, text)` — sets is_replied + reply_status
- `submitHostReview(recordId, text, ratings, isRecommended, tags)` — sets host_review_id + is_hidden: false
- `translateReview(recordId)` — mock translate (700ms) of `guest_review_text`; target lang from `useAirbnbReviews().config.host_language`; persists `translated_content` + `translation_language` via `updateReviewRecord`; no-op when already translated, target == source, or no text; toast on success
- `resolveTargetLang()` — returns current `host_language` (default `'en'`)

**Translate Guest Review:**
- `DetailGuestPanel` shows a per-review **Translate** toggle next to the `Language:` label when the review language differs from the configured target (or a translation already exists)
- Toggle switches between original text and `translated_content`; "Translated to {language}" label (resolved via `hostLanguageOptions`) shown while translated
- `language_detected` values: `de` (rr-012, German text) and `fr` (rr-015, French text) — both map to English in `mockReviewTranslations` in `useReviewHub.ts`

**Mock Data (10 records):**
- 3 Airbnb (1 double-blind hidden, 2 visible), 3 Booking.com (1 replied, 2 host_review_pending), 2 Direct (1 replied, 1 no review), 2 past Airbnb (>14d, auto-revealed)
- All scores in 0-10 Channex format, realistic tags on Airbnb records
- 10 SOR records with cleaning_score 2-5, house_rule_flags 0-3, communication_score 3-5
