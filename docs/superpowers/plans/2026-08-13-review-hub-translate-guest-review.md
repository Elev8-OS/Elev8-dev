# Review Hub — Translate Guest Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-review Translate toggle in the Review Hub detail drawer so property managers can read guest reviews in their configured language.

**Architecture:** Add two nullable fields (`translated_content`, `translation_language`) to `ReviewRecord`. Add a `translateReview(recordId)` async action to `useReviewHub.ts` that resolves the target language from the existing Review Automation config (`host_language`) and writes a mock translation (lookup map + 700ms delay) into the record via the existing `updateReviewRecord`. `DetailGuestPanel.vue` renders a Translate / Show original toggle next to the language label, with a loading state and a "Translated to {language}" label. Seed data for `rr-012` (German) and `rr-015` (French) is replaced with real non-English texts so the feature is demonstrable.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, shadcn-vue `Button`/`Icon`, `useState`-based composables, `vue-sonner` toasts, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-08-13-review-hub-translate-guest-review-design.md`

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `app/components/review-hub/data/types.ts` | `ReviewRecord` type + helpers | Modify: +2 fields |
| `app/composables/useReviewHub.ts` | State + actions + mock translate | Modify: +`translateReview`, +map, +helpers |
| `app/components/review-hub/DetailGuestPanel.vue` | Guest review panel UI | Modify: toggle + translated display |
| `app/components/review-hub/data/mock-review-records.ts` | Seed data | Modify: rr-012/rr-015 texts |
| `tests/composables/useReviewHub-translate.spec.ts` | Unit tests for translate logic | Create |

---

## Task 1: Add `translated_content` / `translation_language` to `ReviewRecord`

**Files:**
- Modify: `app/components/review-hub/data/types.ts:19-51`

- [ ] **Step 1: Add the two fields to the interface**

In `ReviewRecord`, immediately after `language_detected: string | null` (line 38), insert:

```ts
  translated_content: string | null // mock translation of guest_review_text
  translation_language: string | null // target language code of the translation (HostLanguage)
```

- [ ] **Step 2: Verify typecheck on the touched file**

Run: `npx nuxi typecheck 2>&1 | grep -iE "types.ts" | head -20`
Expected: no output (no new type errors). The optional fields are added as required-with-null on the interface, matching every other field's style; all existing mock records will now type-error, which is resolved in Task 4 when seed data gains the fields. If you want a clean intermediate state, add `translated_content: null, translation_language: null,` to every mock record in Task 4.

- [ ] **Step 3: Commit**

```bash
git add app/components/review-hub/data/types.ts
git commit -m "feat(review-hub): add translated_content fields to ReviewRecord"
```

---

## Task 2: Write failing tests for `translateReview`

**Files:**
- Create: `tests/composables/useReviewHub-translate.spec.ts`

- [ ] **Step 1: Write the test file**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useAirbnbReviews } from '~/composables/useAirbnbReviews'
import { useReviewHub } from '~/composables/useReviewHub'
import { mockReviewRecords } from '~/components/review-hub/data/mock-review-records'

describe('useReviewHub translateReview', () => {
  beforeEach(() => {
    // Fresh deep-clone state per test so assertions are deterministic
    const { reviewRecords } = useReviewHub()
    reviewRecords.value = JSON.parse(JSON.stringify(mockReviewRecords))
  })

  it('translates a non-English review into the configured target language', async () => {
    const { translateReview } = useReviewHub()
    const { config } = useAirbnbReviews()
    config.value = { ...config.value, host_language: 'en' }

    const original = mockReviewRecords.find(r => r.id === 'rr-012')!
    await translateReview('rr-012')

    const { reviewRecords } = useReviewHub()
    const record = reviewRecords.value.find(r => r.id === 'rr-012')!
    expect(record.translated_content).toBeTruthy()
    expect(record.translation_language).toBe('en')
    expect(record.translated_content).not.toBe(original.guest_review_text)
  })

  it('persists the translation so a second call is a no-op', async () => {
    const { translateReview, reviewRecords } = useReviewHub()
    await translateReview('rr-012')
    const first = reviewRecords.value.find(r => r.id === 'rr-012')!.translated_content

    await translateReview('rr-012')
    const second = reviewRecords.value.find(r => r.id === 'rr-012')!.translated_content
    expect(second).toBe(first)
  })

  it('does nothing when the review is already in the target language', async () => {
    const { translateReview, reviewRecords } = useReviewHub()
    const { config } = useAirbnbReviews()
    config.value = { ...config.value, host_language: 'en' }

    // rr-001 is already English
    await translateReview('rr-001')
    const record = reviewRecords.value.find(r => r.id === 'rr-001')!
    expect(record.translated_content).toBeNull()
  })

  it('does nothing for a review with no guest review text', async () => {
    const { translateReview, reviewRecords } = useReviewHub()
    const record = reviewRecords.value.find(r => r.id === 'rr-001')!
    const original = record.guest_review_text
    ;(record as any).guest_review_text = null

    await translateReview('rr-001')
    expect(reviewRecords.value.find(r => r.id === 'rr-001')!.translated_content).toBeNull()
    expect(reviewRecords.value.find(r => r.id === 'rr-001')!.guest_review_text).toBeNull()
  })
})
```

Notes:
- `useState` is module-global, so `beforeEach` re-seeds `reviewRecords` to a fresh deep clone for determinism.
- The first test will fail until `translateReview` exists (RED).
- `config` comes from `useAirbnbReviews` (already exported). Tests that don't set it default to `'en'` from `defaultConfig`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `NODE_ENV=test pnpm exec vitest run tests/composables/useReviewHub-translate.spec.ts`
Expected: FAIL — `TypeError: translateReview is not a function` (or similar). This is the RED state.

---

## Task 3: Implement `translateReview` in `useReviewHub.ts`

**Files:**
- Modify: `app/composables/useReviewHub.ts`

- [ ] **Step 1: Add the mock translation map + target-lang helper at module top (after imports, before `export function useReviewHub()`)**

```ts
// Mock translation lookup: original guest review text -> English translation.
// Mirrors the Inbox module's mockTranslate pattern. V1 ships EN target only;
// extend to per-language maps (Record<HostLanguage, ...>) when multi-target is needed.
const mockReviewTranslations: Record<string, string> = {
  'Perfekter Ort für einen Surf-Trip! Nur wenige Schritte vom Strand, großartiger Board-Stauraum und nachts ruhig. Der Gastgeber hatte tolle lokale Tipps.': 'Perfect spot for a surf trip! Steps from the beach, great board storage, and quiet at night. The host had great local tips.',
  'Leider war unser Aufenthalt enttäuschend. Die Unterkunft hatte einen starken muffigen Geruch, die Bettwäsche war fleckig und ab 7 Uhr morgens begann Baulärm von nebenan. Der Gastgeber gab klare Anweisungen, aber die Unterkunft braucht dringend Instandhaltung.': 'Unfortunately our stay was disappointing. The unit had a strong damp smell, the sheets were stained, and construction noise from next door started at 7am. The host gave clear instructions but the property needs serious upkeep.',
  "Malheureusement, notre séjour a été décevant. Le logement avait une forte odeur d'humidité, les draps étaient tachés et le bruit des travaux du voisin commençait à 7h du matin. L'hôte a donné des instructions claires mais le bien nécessite un sérieux entretien.": 'Unfortunately our stay was disappointing. The unit had a strong damp smell, the sheets were stained, and construction noise from next door started at 7am. The host gave clear instructions but the property needs serious upkeep.',
}

// Fallback label when the text has no map entry (same convention as Inbox).
function mockTranslateFallback(text: string, targetLang: string): string {
  return `[Translated to ${targetLang}] ${text}`
}
```

- [ ] **Step 2: Add `translateReview` + target-lang resolution inside `useReviewHub()` (after `updateReviewRecord`, line ~228)**

```ts
  // Resolve the target language for translations from the Review Automation
  // config (same source as AI reply generation). One config point.
  function resolveTargetLang(): string {
    const { config } = useAirbnbReviews()
    return config.value?.host_language ?? 'en'
  }

  // Translate the guest review text (mock). Persists on the record so a
  // review is only translated once per target language.
  async function translateReview(recordId: string): Promise<void> {
    const record = reviewRecords.value.find(r => r.id === recordId)
    if (!record || !record.guest_review_text) return

    // Already translated -> keep cached result.
    if (record.translated_content) return

    const targetLang = resolveTargetLang()
    // Nothing to translate when the review is already in the target language.
    if (record.language_detected === targetLang) return

    await new Promise(resolve => setTimeout(resolve, 700))

    const text = record.guest_review_text
    const translated = mockReviewTranslations[text] ?? mockTranslateFallback(text, targetLang)
    updateReviewRecord(recordId, {
      translated_content: translated,
      translation_language: targetLang,
    })
    toast.success('Review translated.')
  }
```

- [ ] **Step 3: Export both from the returned object**

In the `return { ... }` block, add `resolveTargetLang` and `translateReview` (alphabetical placement near `updateReviewRecord`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `NODE_ENV=test pnpm exec vitest run tests/composables/useReviewHub-translate.spec.ts`
Expected: PASS (4 tests). GREEN.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useReviewHub.ts tests/composables/useReviewHub-translate.spec.ts
git commit -m "feat(review-hub): add mock translateReview action with persisted translation"
```

---

## Task 4: Seed data — real German/French review texts

**Files:**
- Modify: `app/components/review-hub/data/mock-review-records.ts:442,551`
- Modify: `app/components/review-hub/data/types.ts` (add fields to records, if not already done)

- [ ] **Step 1: Add the two new fields to every mock record**

Every object in `mockReviewRecords` must include:

```ts
    translated_content: null,
    translation_language: null,
```

Add them next to `language_detected` in each of the 15 records. (If Task 1 Step 2's typecheck flagged these, this resolves it.)

- [ ] **Step 2: Replace `rr-012`'s English review text with German**

In the `rr-012` record, change:

```ts
    guest_review_text: 'Perfect spot for a surf trip! Steps from the beach, great board storage, and quiet at night. The host had great local tips.',
```

to:

```ts
    guest_review_text: 'Perfekter Ort für einen Surf-Trip! Nur wenige Schritte vom Strand, großartiger Board-Stauraum und nachts ruhig. Der Gastgeber hatte tolle lokale Tipps.',
```

- [ ] **Step 3: Replace `rr-015`'s English review text with French**

In the `rr-015` record, change:

```ts
    guest_review_text: 'Unfortunately our stay was disappointing. The unit had a strong damp smell, the sheets were stained, and construction noise from next door started at 7am. The host gave clear instructions but the property needs serious upkeep.',
```

to:

```ts
    guest_review_text: "Malheureusement, notre séjour a été décevant. Le logement avait une forte odeur d'humidité, les draps étaient tachés et le bruit des travaux du voisin commençait à 7h du matin. L'hôte a donné des instructions claires mais le bien nécessite un sérieux entretien.",
```

- [ ] **Step 4: Run the translate tests again**

Run: `NODE_ENV=test pnpm exec vitest run tests/composables/useReviewHub-translate.spec.ts`
Expected: PASS — the map keys now match the seeded German/French texts, so `translateReview('rr-012')` returns the English translation from the map (not the fallback).

- [ ] **Step 5: Verify typecheck on touched files**

Run: `npx nuxi typecheck 2>&1 | grep -iE "mock-review-records|types.ts" | head -20`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/components/review-hub/data/mock-review-records.ts app/components/review-hub/data/types.ts
git commit -m "feat(review-hub): seed German and French guest review texts"
```

---

## Task 5: DetailGuestPanel — Translate toggle + translated display

**Files:**
- Modify: `app/components/review-hub/DetailGuestPanel.vue`

- [ ] **Step 1: Import `useAirbnbReviews` and add script logic**

In `<script setup>`, after the existing `useReviewHub()` call (line 10), add:

```ts
const { config } = useAirbnbReviews()
const { resolveTargetLang, translateReview } = useReviewHub()

const showTranslation = ref(false)
const isTranslating = ref(false)

const targetLang = computed(() => resolveTargetLang())

// Whether a translation is meaningful for this review
const translationNeeded = computed(() => {
  if (!props.review.guest_review_text) return false
  const target = targetLang.value
  return props.review.language_detected !== target || !!props.review.translated_content
})

const showTranslateButton = computed(() => translationNeeded.value)

const translatedLabel = computed(() => {
  const lang = props.review.translation_language
  const opt = hostLanguageOptions.find(o => o.value === lang)
  return opt ? opt.label : (lang ?? 'English')
})

async function handleToggle() {
  if (showTranslation.value) {
    showTranslation.value = false
    return
  }
  showTranslation.value = true
  if (!props.review.translated_content) {
    isTranslating.value = true
    try {
      await translateReview(props.review.id)
    } finally {
      isTranslating.value = false
    }
  }
}
```

Import `hostLanguageOptions` alongside the existing type imports:

```ts
import { channelIcons, channelLabels, getDisplayScore, getDisplayMax, getCategoryDisplayLabel, getTagLabel, getTagSentiment, hostLanguageOptions } from '~/components/review-hub/data/types'
```

(If `hostLanguageOptions` is exported from `app/components/airbnb-reviews/data/reviews.ts` instead — it is — import from there. Verify the export location before coding.)

- [ ] **Step 2: Add the toggle button to the header row**

In the template, next to the existing language span (line 68-70), inside the same `div.flex.items-center.gap-2`:

```html
      <Button
        v-if="showTranslateButton"
        variant="outline"
        size="sm"
        class="gap-1"
        @click="handleToggle"
      >
        <Icon :name="showTranslation ? 'lucide:undo-2' : 'lucide:languages'" class="size-3.5" />
        {{ showTranslation ? 'Show original' : 'Translate' }}
      </Button>
```

Place it after the `Language:` span. The button only appears when `showTranslateButton` is true.

- [ ] **Step 3: Render translated content with loading + label**

In the `v-else-if="hasGuestReview"` review-text block (line 123-132), change the inner content to:

```html
      <div v-if="review.guest_review_text" class="rounded-lg border bg-muted/30 p-4">
        <div v-if="isTranslating" class="flex items-center gap-1.5">
          <Icon name="lucide:loader-2" class="size-3 animate-spin text-muted-foreground" />
          <span class="text-xs text-muted-foreground">Translating...</span>
        </div>
        <template v-else-if="showTranslation && review.translated_content">
          <p class="text-sm leading-relaxed">
            "{{ review.translated_content }}"
          </p>
          <span class="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Icon name="lucide:languages" class="size-2.5" />
            Translated to {{ translatedLabel }}
          </span>
        </template>
        <template v-else>
          <p class="text-sm leading-relaxed">
            "{{ review.guest_review_text }}"
          </p>
        </template>
        <p v-if="review.review_received_at" class="mt-2 text-xs text-muted-foreground">
          Received {{ formatDate(review.review_received_at) }}
        </p>
      </div>
```

- [ ] **Step 4: Verify no component-resolution errors**

Run: `NODE_ENV=test pnpm exec vitest run tests/components/review-hub/DetailGuestPanel.spec.ts 2>&1 | head -30`
Expected: file does not exist yet — skip. Instead verify via typecheck + dev-log:

Run: `npx nuxi typecheck 2>&1 | grep -iE "DetailGuestPanel" | head -20`
Expected: no errors referencing `DetailGuestPanel.vue`.

- [ ] **Step 5: Commit**

```bash
git add app/components/review-hub/DetailGuestPanel.vue
git commit -m "feat(review-hub): add per-review translate toggle to guest review panel"
```

---

## Task 6: Verification & wrap-up

**Files:** none (verification only)

- [ ] **Step 1: Run the full Review Hub test suite**

Run: `NODE_ENV=test pnpm exec vitest run tests/composables/useReviewHub-translate.spec.ts tests/composables/useInbox-email-channel.spec.ts tests/composables/useNotifications.spec.ts`
Expected: all pass.

- [ ] **Step 2: Run typecheck filtered to touched files**

Run: `npx nuxi typecheck 2>&1 | grep -iE "review-hub|useReviewHub|DetailGuestPanel|mock-review-records|types.ts" | head -30`
Expected: no new errors. (Pre-existing baseline errors elsewhere are out of scope.)

- [ ] **Step 3: Lint touched files**

Run: `pnpm exec eslint app/composables/useReviewHub.ts app/components/review-hub/DetailGuestPanel.vue app/components/review-hub/data/types.ts app/components/review-hub/data/mock-review-records.ts tests/composables/useReviewHub-translate.spec.ts`
Expected: no errors.

- [ ] **Step 4: Manual smoke check in dev**

Run: `pnpm dev` (background). Open `http://localhost:3000/reviews`, open the drawer for `Florian Weber` (rr-012, German) → click **Translate** → expect loading state → English text + "Translated to English" label. Toggle **Show original** and back. Repeat for `Nico Laurent` (rr-015, French). Close and reopen the drawer → translation persists.

Stop the dev server after verification.

- [ ] **Step 5: Update CLAUDE.md**

Add a short section under the Review Hub module documenting the translate feature:

```
- **Translate guest review**: `DetailGuestPanel` shows a per-review Translate toggle when the review language differs from the Review Automation `host_language`. `useReviewHub.translateReview()` (mock, 700ms) persists `translated_content` + `translation_language` on the `ReviewRecord`; label "Translated to {language}" shown while translated.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(review-hub): document translate guest review feature"
```

---

## Self-Review

**Spec coverage:**
- Per-review toggle → Task 5
- `translated_content` + `translation_language` fields → Task 1
- `translateReview(recordId)` async action → Task 3
- Mock translate map + fallback + 700ms delay → Task 3
- Seed data rr-012/rr-015 → Task 4
- "Translated to {language}" label + loading → Task 5
- Target language from config (`host_language`) → Task 3 `resolveTargetLang`
- Skip when already target language / no text → Task 3 logic + Task 2 tests
- Toast on success → Task 3
- Typecheck + lint + manual smoke → Task 6

**Placeholder scan:** All steps contain concrete code or commands. The only conditional ("If `hostLanguageOptions`... verify export location") is a verification instruction with an explicit fallback, not a placeholder — `hostLanguageOptions` is confirmed exported from `app/components/airbnb-reviews/data/reviews.ts` (line 88).

**Type consistency:** `translated_content`/`translation_language` names match across Task 1 (type), Task 2 (tests), Task 3 (implementation), Task 5 (template). `translateReview`/`resolveTargetLang` exported names match between Task 3 and Task 5. Test file path matches Task 2/6.
