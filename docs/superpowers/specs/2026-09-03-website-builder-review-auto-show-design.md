# Design: Website Builder Review Auto-Show Rules

**Date:** 2026-09-03
**Module:** Website Builder (`app/pages/website-builder/`, `app/components/website-builder/`), Review Hub (`app/components/review-hub/data/types.ts`)
**Status:** Approved, ready for implementation planning
**Extends:** `2026-08-17-website-builder-guest-reviews-design.md`

## TL;DR

The Reviews step of the Website Builder wizard is hand-picked only: the host ticks individual
reviews at build time, so a review that arrives after publishing never reaches the site. This
feature adds an **Auto mode** driven by per-channel rating rules in each channel's native scale
(Airbnb 4.5+ of 5, Booking.com 9+ of 10, Direct 4.5+ of 5). Every matching review shows on the
published site, with no cap on the total: visitors get a batch at a time behind a **Load more**
button. The existing hand-picked flow stays available as **Manual mode** behind a segmented
toggle.

## Scope

### In Scope

- `Auto` / `Manual` segmented toggle at the top of the Reviews step; `auto` is the default
- Per-channel auto rules: enable switch plus minimum rating in the channel's native scale
- `Only reviews with a written comment` filter
- `Hide the section until at least N reviews match` gate
- `Show N reviews per batch` display setting, feeding a Load more control (no total cap)
- Newest-first ordering of the resolved pool
- Live match count with a per-channel breakdown, recomputed as rules change
- Main Page (featured) selection over the auto-resolved pool, with pruning of stale ids
- `WebsiteReviewConfig` persisted on the `Website` stub and restored in edit mode
- One-line fix to `getDisplayScore` so Direct reviews render on their 5-star scale
- New `ReviewAutoSettings.vue` component, keeping `ReviewStep.vue` from growing further

### Out of Scope

- Real generated-website rendering. The Load more control is exercised in the wizard preview only
- Recency rules (`only reviews from the last N months`) (considered and dropped)
- Numbered pagination on the published site (Load more was chosen instead)
- Host-selectable sort order (newest-first is fixed)
- Per-review exclusions in Auto mode. Hiding one specific high-rated review means switching to
  Manual mode
- Review moderation, translation, or reply flows. Those live in Review Hub

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Auto vs. manual | Mutually exclusive mode toggle | One mental model per screen. Include-checkboxes that mean "exclude" in the other mode is the kind of overloading that produces support tickets |
| Rating scale in the UI | Native per channel | The host thinks in the scale their channel shows them. Airbnb 4.5 and Booking.com 9 are the same normalized 9.0, and asking for "9+" on Airbnb would read as near-impossible |
| Recency cap | Dropped | Newest-first ordering already buries old reviews. A second recency knob is a field to explain for no behavior change on page one |
| Pagination | Load more | Matches the "Show more" affordance the builder already uses, and needs no page-count state in the mock |
| Sort order | Newest first, fixed | A fresh 5-star review reaching the top with no host action is the point of Auto mode |
| Direct scale | 5-star, fix `getDisplayScore` | Direct is our own guest-facing rating, and 5 stars is what a booking widget shows. Also corrects a live display bug |

## Existing behavior this builds on

`ReviewStep.vue` (635 lines) already resolves the property to listing ids via
`getListingsForProperties()`, reads `ReviewRecord`s from `useReviewHub()`, excludes `is_hidden`
(Airbnb double-blind) reviews, applies a single normalized `minRating` select (10/9/8/7/6),
groups candidates by property with Select All, offers a `Main Page` star per selected review,
supports manual testimonials, and paginates its own list 8 at a time. It persists to `Website`
as `reviewIds`, `featuredReviewIds`, `manualReviews`, `featuredManualReviewIds`.

The single normalized `minRating` select is what Auto mode replaces. Everything else survives.

## Data Model

### `WebsiteReviewConfig` (new)

New file `app/components/website-builder/data/review-config.ts`, matching the existing
`data/property-listings.ts` convention of pure data plus pure helpers:

```ts
export type WebsiteReviewMode = 'auto' | 'manual'

export interface ReviewChannelRule {
  enabled: boolean
  minRating: number        // native scale: airbnb/direct 0-5, booking_com 0-10
}

export interface WebsiteReviewConfig {
  mode: WebsiteReviewMode
  channels: Record<ReviewSource, ReviewChannelRule>
  requireText: boolean
  minCountToShow: number   // hide the whole section below this many matches
  batchSize: number        // Load more batch; there is no total cap
}
```

Flat by design. Five fields plus the channel map does not need nested `autoRules` / `display`
objects, and a flat shape keeps the `v-model` patching in the settings component to one spread.

### Defaults

```ts
export function createDefaultReviewConfig(): WebsiteReviewConfig {
  return {
    mode: 'auto',
    channels: {
      airbnb: { enabled: true, minRating: 4.5 },
      booking_com: { enabled: true, minRating: 9 },
      direct: { enabled: true, minRating: 4.5 },
    },
    requireText: true,
    minCountToShow: 3,
    batchSize: 12,
  }
}
```

### `ReviewSelection` (extended)

```ts
export interface ReviewSelection {
  selectedReviewIds: string[]        // manual mode only
  featuredReviewIds: string[]        // both modes
  manualReviews: ManualReview[]      // both modes
  featuredManualReviewIds: string[]  // both modes
  config: WebsiteReviewConfig        // new
}
```

### `Website` (extended)

`app/components/website-builder/data/websites.ts` gains `reviewConfig?: WebsiteReviewConfig`
next to the existing review fields. Optional, so the four seeded mock websites need no edit;
a website without one falls back to `createDefaultReviewConfig()` on load.

## Scale mapping

The store is normalized 0-10 (`ReviewRecord.guest_rating_overall`); the host types native.
One helper pair owns the conversion, both derived from the Review Hub's `getDisplayMax()` so
they cannot drift:

```ts
nativeToNormalized(4.5, 'airbnb')      // 9
nativeToNormalized(9,   'booking_com') // 9
nativeToNormalized(4.5, 'direct')      // 9

thresholdOptions('airbnb')             // [5, 4.5, 4, 3.5, 3]
thresholdOptions('booking_com')        // [10, 9.5, 9, 8.5, 8]
thresholdOptions('direct')             // [5, 4.5, 4, 3.5, 3]
```

### Review Hub fix

`getDisplayScore()` divides only Airbnb by 2, while `getDisplayMax()` returns 5 for Airbnb
**and** Direct. Direct records store normalized 10 (`rr-007`, `rr-014`), so the Review Hub
renders them today as `10.0/5`. The fix is to divide Direct by 2 as well:

```ts
if (source === 'airbnb' || source === 'direct') return (overallScore / 2).toFixed(1)
```

This is shared code: it corrects `ReviewStep.vue` and `review-hub/DetailGuestPanel.vue` in the
same change. It is in scope because the per-channel thresholds are meaningless if the number
the host reads back is on a different scale than the one they set.

## Resolver

A pure function in `review-config.ts`, no reactivity and no composable, because the reactive
state already lives in the wizard's refs:

```ts
export function resolveAutoReviews(
  records: ReviewRecord[],
  listingIds: string[],
  config: WebsiteReviewConfig,
): ReviewRecord[]
```

A review is kept when all of the following hold:

1. `listingIds.includes(record.listing_id)`
2. `!record.is_hidden` (Airbnb double-blind reviews stay out)
3. `config.channels[record.source].enabled`
4. `record.guest_rating_overall !== null`
5. `guest_rating_overall >= nativeToNormalized(rule.minRating, record.source)` , inclusive: so
   a review at exactly the threshold passes
6. `!config.requireText || (record.guest_review_text?.trim() ?? '') !== ''`

Sorted by `review_received_at` descending. No cap is applied at any point. Manual mode never
calls the resolver; it keeps reading `selectedReviewIds`.

A companion helper returns the counts the UI needs:

```ts
export function autoReviewStats(records, listingIds, config): {
  total: number
  byChannel: Record<ReviewSource, number>
}
```

The section gate is a separate one-liner, because only the caller knows the manual-testimonial
count:

```ts
export function meetsMinCount(autoTotal: number, manualCount: number, config): boolean
```

## Components

### `ReviewAutoSettings.vue` (new)

`app/components/website-builder/steps/ReviewAutoSettings.vue`. Props `modelValue:
WebsiteReviewConfig` plus `stats`, emits `update:modelValue`. Patches by spread so the prop is
never mutated, following the `DatevFields*.vue` shared-field-group pattern.

```
Auto-show rules
[✓] (airbnb)      Airbnb        Minimum rating  [ 4.5+ ▾ ]  of 5
[✓] (booking)     Booking.com   Minimum rating  [ 9+   ▾ ]  of 10
[✓] (globe)       Direct        Minimum rating  [ 4.5+ ▾ ]  of 5

[✓] Only reviews with a written comment
    Hide the section until at least [ 3 ] reviews match
    Show [ 12 ] reviews per batch
    Visitors see 12 at a time with a Load more button. There is no limit on the total.

-> 34 reviews match  ·  Airbnb 18  ·  Booking.com 11  ·  Direct 5
```

The match line recomputes as thresholds move, so a rule is never abstract. A disabled channel
row dims its rating select but keeps it readable. Channel icons and labels come from
`channelIcons` / `channelLabels`.

Below the rules, a collapsible **Choose main page reviews** section lists the resolved pool with
star toggles only, no include checkboxes. Reuses the existing `Main Page` button styling.

### `ReviewStep.vue` (changed)

- Adds the segmented `Auto` / `Manual` toggle at the top, same two-button pattern as the
  Property/Rooms toggle in `ListingSetupOverlay.vue`
- Auto branch renders `ReviewAutoSettings` and the featured picker over the resolved pool
- Manual branch renders today's grouped checkbox list unchanged, minus the `Min rating` select
- The manual testimonial block and its dialog stay visible in both modes
- On `propertyIds` change, keeps `config` (rules are property-independent) and prunes
  `featuredReviewIds` to ids still in the pool, alongside the existing selection reset
- `totalSelected` becomes mode-aware: resolved count in Auto, `selectedReviewIds.length` in
  Manual, plus `manualReviews.length` in both

Both reka-ui rules apply to the new controls: `model-value` / `@update:model-value` on every
Switch and Checkbox, and no `<label>` wrapper around a Checkbox.

### `PreviewStep.vue` (changed)

The reviews summary card shows the mode. In Auto it lists the active rules in native scale
("Airbnb 4.5+, Booking.com 9+"), the resolved count, and the batch size. It persists
`reviewConfig` onto the `Website` stub with the existing review fields.

The in-wizard preview renders the reviews page with a real **Load more reviews** button that
appends `batchSize` at a time and disappears when the pool is exhausted, so the host can click
the actual behavior before publishing.

### `create.vue` (changed)

`reviewSelection` initializes `config: createDefaultReviewConfig()`. Edit mode reads
`site.reviewConfig ?? createDefaultReviewConfig()`.

## Published behavior (mocked in the wizard preview)

- **Homepage section** renders featured reviews only, in both modes
- **Reviews page** renders the resolved pool (Auto) or the selected list (Manual), newest first,
  `batchSize` at a time behind Load more
- **Section gate**: the whole reviews section is hidden when resolved + manual count is below
  `minCountToShow`. Manual testimonials count toward that total, so a brand-new property with
  two host testimonials and one matching review still shows its section at the default of 3

## Validation

The step-3 gate currently requires at least one selected or manual review. It becomes
mode-aware:

- **Manual**: unchanged
- **Auto**: at least one channel enabled, and (resolved count >= 1 or at least one manual
  testimonial)

A zero-match Auto config shows an inline warning naming the likely cause (thresholds too high,
or written-comment filter with untexted reviews) rather than silently disabling Next. The
warning is advisory when a manual testimonial exists, blocking when nothing at all would render.

## Testing

`tests/components/website-builder/review-config.spec.ts`:

- `nativeToNormalized`: Airbnb 4.5 -> 9, Booking.com 9 -> 9, Direct 4.5 -> 9
- `thresholdOptions` shape per channel
- Threshold boundary is inclusive: a review at exactly 9.0 passes a 4.5 Airbnb rule
- A disabled channel excludes all of its reviews even when they clear the threshold
- `requireText` drops null and whitespace-only text (`rr-008` has a null rating and is dropped
  by the null guard regardless)
- `is_hidden` reviews never resolve
- Ordering is `review_received_at` descending
- No cap: 200 synthetic records in, 200 out
- `minCountToShow` does not filter the pool, it only gates the section flag
- `autoReviewStats` per-channel counts sum to `total`

`tests/components/website-builder/ReviewAutoSettings.spec.ts`: renders three channel rows,
toggling a channel switch emits an updated config, changing a threshold emits native scale.

`tests/components/review-hub/`: a `getDisplayScore('direct')` case asserting 10 renders as
`5.0`.

Nuxt auto-imported children must be registered in `global.components` to render under Vitest,
per the existing test setup.

## Edge cases

| Case | Behavior |
| --- | --- |
| Property selection changes | `config` is kept (rules are property-independent); selection and featured ids are pruned to the new pool |
| `guest_rating_overall: null` | Never matches any rule (`rr-008`) |
| Airbnb double-blind (`is_hidden`) | Excluded, same as today |
| All channels disabled | Resolved pool is empty; step-3 gate blocks with the inline warning |
| Featured review falls out of the pool after a threshold change | Pruned from `featuredReviewIds` on resolve, so a stale id cannot reach the homepage |
| Website saved before this feature | `reviewConfig` is undefined; falls back to `createDefaultReviewConfig()` |
| `batchSize` set below 1 | Clamped to 1 on input |
