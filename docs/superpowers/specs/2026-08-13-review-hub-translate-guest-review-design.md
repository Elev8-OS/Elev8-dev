# Design: Review Hub — Translate Guest Review

**Date:** 2026-08-13
**Module:** Review Hub (`app/components/review-hub/`, `app/composables/useReviewHub.ts`)
**Status:** Approved — ready for implementation planning

## TL;DR

Guests sometimes leave reviews in languages other than the user's (German, French, etc.). This feature adds a **per-review Translate toggle** in the Review Hub detail drawer so the property manager can read the review in their preferred language. The target language follows the existing **Language setting** (`host_language`) in the Review Automation config — the same setting the AI reply generation already uses. Translation is **mock** (client-side lookup map with simulated delay), mirroring the Inbox module's existing `mockTranslate` pattern. Results persist on the `ReviewRecord` so a review is only translated once per target language.

## Scope

### In Scope

- Per-review translate toggle in `DetailGuestPanel.vue` (guest review text panel)
- `translated_content` + `translation_language` fields on `ReviewRecord`
- `translateReview(recordId)` async action in `useReviewHub.ts` with mock translate map
- Seed data: replace English texts of `rr-012` (German) and `rr-015` (French) with their actual non-English texts so the feature is demonstrable
- "Translated to {language}" label + loading state on translated review

### Out of Scope

- Real translation backend / LLM integration (mock only for now)
- Global auto-translate toggle for the whole Review Hub page
- Translation of reply text, host review text, private feedback, or SOR notes
- Translation of tag labels (tags are already English via `getTagLabel()`)
- Translation on the Analytics tab (analytics never renders review prose)

## Data Model

Add two optional nullable fields to `ReviewRecord` in `app/components/review-hub/data/types.ts`:

```ts
translated_content: string | null   // mock translation of guest_review_text
translation_language: string | null // target language code (matches HostLanguage), e.g. 'en'
```

- Optional + nullable → existing seed records remain valid.
- `reviewRecords` in `useReviewHub.ts` is deep-cloned from `mockReviewRecords`, so untouched records naturally carry `null`.

## Target Language

Read from the shared Review Automation config:

```ts
const { config } = useAirbnbReviews()
// config.host_language: 'en' | 'de' | 'fr' | 'id' | 'es' | 'it' | 'pt'
```

- `hostLanguageOptions` (already in `app/components/airbnb-reviews/data/reviews.ts`) provides the `{ value, label, flag }` list for display labels.
- Default is `'en'`.
- Reuses the existing setting → the "user's language" is the same one already configured for AI reply drafts. One config point, everything follows.

## Mock Translation

### `mockReviewTranslations` map

Keyed by the original guest review text; value is the English translation. Seeded with entries for the two non-English sample reviews (rr-012 German → English, rr-015 French → English). Because the default target is English, the map holds EN translations. If a future target differs (e.g. review already English but target is German), the same map pattern can be extended with per-language maps (`Record<HostLanguage, Record<string, string>>`), mirroring the Inbox `mockHostTranslations` structure. V1 ships the flat EN map only.

### Fallback

Text not found in the map → `[Translated to {language}] {original text}` (same convention as Inbox `[Diterjemahkan]`).

### Simulated latency

700ms delay before the translation is written, matching the Inbox translate pattern. A per-record `isTranslating` flag drives a spinner in the UI.

## `translateReview(recordId)` in `useReviewHub.ts`

```ts
async function translateReview(recordId: string): Promise<void>
```

Behavior:

1. Find record. If missing, or `guest_review_text` is empty → no-op.
2. If `translated_content` already exists → no-op (already translated; toggle just flips the view).
3. Resolve target language from `useAirbnbReviews().config.host_language`; skip if target === source (`language_detected`).
4. Simulated delay → resolve translation via map (or fallback).
5. Persist via existing `updateReviewRecord(recordId, { translated_content, translation_language })`.
6. `toast.success('Review translated.')` (matches app-wide toast-on-action convention).

Returned from `useReviewHub` alongside the existing actions.

## UI — `DetailGuestPanel.vue`

### Toggle button

In the panel header row, next to the existing `Language: {CODE}` label:

```html
<Button v-if="showTranslateButton" variant="outline" size="sm" class="gap-1" @click="handleToggle">
  <Icon name="lucide:languages" class="size-3.5" />
  {{ showTranslation ? 'Show original' : 'Translate' }}
</Button>
```

- `showTranslateButton`: visible only when `review.guest_review_text` is present AND translation is needed (target language differs from `language_detected`, or a translation already exists for the current target).
- `showTranslation = ref(false)`: default shows the original text.
- Clicking **Translate**: `showTranslation = true`, then `await translateReview(review.id)`; while pending, a `lucide:loader-2 animate-spin` + "Translating..." indicator replaces the text.
- Clicking **Show original**: `showTranslation = false` (cached translation stays on the record, so re-translating is instant).

### Translated display

When `showTranslation && review.translated_content`:

```html
<p class="text-sm leading-relaxed">{{ review.translated_content }}</p>
<span class="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
  <Icon name="lucide:languages" class="size-2.5" />
  Translated to {{ targetLangLabel }}
</span>
```

`targetLangLabel` resolves via `hostLanguageOptions` from `translation_language` (fallback to uppercase code).

Drawer reads live records from `useReviewHub().reviewRecords` (`DetailDrawer.vue` re-resolves by id), so the persisted translation re-renders automatically — including after closing and reopening the drawer.

## Seed Data

In `app/components/review-hub/data/mock-review-records.ts`, replace the English `guest_review_text` of the two records whose `language_detected` is already non-English, so the language tag matches the actual content:

- `rr-012` (Booking.com, `language_detected: 'de'`, Florian Weber) → German review text
- `rr-015` (Airbnb, `language_detected: 'fr'`, Nico Laurent) → French review text

English translations of both texts go into `mockReviewTranslations` so the toggle produces a correct result.

## Files Changed

| File | Change |
|---|---|
| `app/components/review-hub/data/types.ts` | +2 fields on `ReviewRecord` |
| `app/composables/useReviewHub.ts` | +`translateReview()`, +`mockReviewTranslations`, +target-lang resolution, +export |
| `app/components/review-hub/DetailGuestPanel.vue` | +toggle button, +translated display, +loading state |
| `app/components/review-hub/data/mock-review-records.ts` | rr-012 → German, rr-015 → French texts |

## Acceptance Criteria

- [ ] Review with `language_detected` ≠ target shows a **Translate** button next to the language label
- [ ] Clicking **Translate** shows a loading state, then the English translation with a "Translated to English" label
- [ ] Clicking **Show original** restores the original text
- [ ] Translation persists per record: closing and reopening the drawer shows the translation without re-running the mock
- [ ] Review already in the target language shows **no** Translate button
- [ ] Review with no guest review text shows no Translate button
- [ ] German (rr-012) and French (rr-015) sample reviews demonstrate the feature with real-looking texts
- [ ] `npx nuxi typecheck` passes on touched files
