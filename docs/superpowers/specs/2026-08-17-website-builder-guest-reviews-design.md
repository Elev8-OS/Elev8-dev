# Design: Website Builder — Guest Reviews

**Date:** 2026-08-17
**Module:** Website Builder (`app/pages/website-builder/`, `app/components/website-builder/`), Review Hub (`app/components/review-hub/data/`)
**Status:** Approved — ready for implementation planning

## TL;DR

Website Builder wizard currently has 4 steps: Template → Settings → Property → Preview. This feature adds a **Reviews step** between Property and Preview so the property manager can pick which guest reviews appear on their generated website. The step filters reviews automatically to the property selected in the Property step, excludes hidden (double-blind) Airbnb reviews, lets the user set a minimum rating threshold, and supports **manual testimonials** (host-written guest reviews). A live testimonial-grid preview shows how the selected reviews will look on the website. Selected review ids + manual reviews persist on the `Website` stub and are restored in edit mode.

## Scope

### In Scope

- New `Reviews` step in the wizard (`ReviewStep.vue`), between Property and Preview
- Review picker filtered by the property selected in the Property step (via property→listing mapping)
- Minimum-rating filter (dropdown, default 8 on the Channex 0–10 scale), excludes `is_hidden` reviews
- "Add Manual Review" form (dialog): guest name, rating, text — stored as host-written testimonials
- Live testimonial-grid preview at the bottom of the Reviews step
- PreviewStep summary card for reviews
- Persist `reviewIds` + `manualReviews` on the `Website` stub; restore in edit mode (`?edit=<id>`)

### Out of Scope

- Real generated-website rendering (the wizard only produces the metadata stub; preview stays in-app)
- Publishing reviews to external channels (Airbnb/Booking.com reply flows already live in Review Hub)
- Editing/removing a review record in Review Hub from this step (selection only)
- Per-review translation/reply features (already in Review Hub)
- Analytics or moderation of review content in this step

## Data Model

### `ReviewSelection` (new, per-step state)

Defined in `ReviewStep.vue` (exported like the other step interfaces):

```ts
interface ReviewSelection {
  selectedReviewIds: string[]   // ids of chosen ReviewRecords (from Review Hub)
  manualReviews: ManualReview[] // host-written testimonials
}

interface ManualReview {
  id: string
  guestName: string
  rating: number    // 0–10, Channex scale (matches ReviewRecord.guest_rating_overall)
  text: string
  source: 'manual'
}
```

### `Website` stub extension (`app/components/website-builder/data/websites.ts`)

```ts
export interface Website {
  // existing fields...
  reviewIds: string[]            // new, optional for existing seed
  manualReviews: ManualReview[]  // new, optional
}
```

- Optional fields → existing 4 seed websites remain valid.
- `persistWebsite()` in `PreviewStep.vue` writes these on save/publish; create mode seeds empty arrays, edit mode preserves what was already there.

## Property → Listing Mapping

The Property step uses mock properties (`prop-1..4`), while Review Hub records are keyed by `listing_id` (`lst-1`, `lst-5`, `lst-12`, …). A small mapping module provides the link so the Reviews step can filter by the selected property:

```ts
// app/components/website-builder/data/property-listings.ts
export const propertyListingMap: Record<string, string[]> = {
  'prop-1': ['lst-1', 'lst-5'],   // Villa Sunset Bay → Luwa / Nomad Mansion Garden
  'prop-2': ['lst-12'],           // Ubud Jungle Retreat → Surf Shack Canggu
  'prop-3': ['lst-1', 'lst-12'],
  'prop-4': ['lst-5'],
}
```

- Values are configurable; reviews for all mapped listings appear in the step.
- If a property maps to no listings, the step shows an empty state prompting a manual review.

## Wizard Integration

- `STEPS` in `create.vue` gains `{ key: 'reviews', label: 'Reviews', icon: 'i-lucide-star' }` at index 3; Preview shifts to index 4.
- `goNext()` chain extended: step 2 (property) unchanged; new step 3 validates `selectedReviewIds.length > 0 || manualReviews.length > 0`; step 4 (preview) is the final step.
- `goBack()` decrements as before.
- Edit-mode prefill restores `reviewSelection` from the `Website` stub when `?edit=<id>` is present (step lands on Settings at index 1; user navigates forward and sees restored selections).
- PreviewStep "Edit" buttons that jump steps must use the new indices (template 0, settings 1, property 2, reviews 3, preview 4).

## `ReviewStep.vue` — UI Flow

### Layout (top → bottom)

1. **Header**: "Reviews" + subtitle ("Choose which guest reviews appear on your website").
2. **Rating filter row**: Label "Minimum rating" + Select (6–10, default 8). Options label "8+" etc. on the Channex 0–10 scale.
3. **Available reviews list**: cards for each candidate `ReviewRecord` for the mapped listing(s), excluding `is_hidden`. Each card shows: checkbox, rating badge (numeric, per Review Hub convention `getDisplayScore()`/`getDisplayMax()`), guest name, source channel badge (Airbnb/Booking.com/Direct), and 2-line clamped review text. Select All / Deselect All buttons.
4. **Add Manual Review button** → opens dialog with guest name (Input), rating (Select 1–10), text (Textarea). Save appends to `manualReviews` and marks it selected; Cancel closes. Validation: all three required.
5. **Manual reviews section**: chips/cards for added manual testimonials with a remove (X) button. Sourced `'manual'`, badge "Manual".
6. **Live preview**: testimonial grid (responsive columns like the website) rendering all selected reviews (real + manual) — rating badge, text, guest name, source. Manual ones labeled "Manual". This mirrors how the generated site would show the testimonials.

### Behavior

- Changing the selected property in the Property step **resets** `selectedReviewIds` + `manualReviews` (the step is only reachable after Property, and the mapped review set changes).
- If no reviews match the mapping/filters → empty state with "Add Manual Review" CTA.
- Property not selected (defensive) → empty state "Select a property first".

## Persistence & Edit Mode

- `PreviewStep.persistWebsite(status, message)`:
  - Edit mode: merge `reviewIds` and `manualReviews` into the existing stub.
  - Create mode: seed `reviewIds: []`, `manualReviews: []` on the pushed stub.
- `create.vue` edit prefill: after reading the stub, set `reviewSelection.value` from `website.reviewIds` / `website.manualReviews`.

## Edge Cases / Error Handling

- No reviews match → empty state + Add Manual Review CTA.
- `is_hidden` (Airbnb double-blind) records are never listed.
- Manual review validation: guest name, rating, and text all required; rating constrained 1–10.
- Property change resets selections (documented above).
- Duplicate protection: manual review ids unique (`manual-<timestamp>`); selecting a real review id twice is impossible via checkbox.

## Testing

- **Unit (optional)**: if filtering/validation is extracted into a small helper (e.g. `filterReviewsForProperty(propertyId, records)`), add Vitest coverage in `tests/composables/` for: mapping lookup, hidden exclusion, rating threshold, and selection reset.
- **Manual smoke**:
  - Wizard create: pick property → Reviews step shows only that property's reviews → set min rating → select some → add a manual review → verify live preview → Publish → card appears on index.
  - Edit mode: open the website → restore selections → change selection → save → verify index reflects it.
- **Lint/type**: `pnpm exec eslint` on changed files; `pnpm typecheck` (pre-existing errors in unrelated files are known and don't block).
