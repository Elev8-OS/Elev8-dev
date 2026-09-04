# Website Builder Review Auto-Show Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Auto mode to the Website Builder Reviews step that shows every guest review clearing a per-channel rating rule (Airbnb 4.5+ of 5, Booking.com 9+ of 10, Direct 4.5+ of 5), uncapped and newest-first, served a batch at a time behind a Load more button, with the existing hand-picked flow preserved as Manual mode.

**Spec:** `docs/superpowers/specs/2026-09-03-website-builder-review-auto-show-design.md`

**Architecture:** All rule logic lives in one new framework-free module,
`app/components/website-builder/data/review-config.ts` (types, defaults, scale mapping, a pure
resolver, count helpers). The wizard keeps its reactive state in the existing refs and calls
those pure functions, so nothing needs a composable. The rules UI is a new focused component,
`ReviewAutoSettings.vue`, because `ReviewStep.vue` is already 635 lines. One shared bug fix in
`app/components/review-hub/data/types.ts` makes Direct reviews render on their 5-star scale,
which the per-channel thresholds depend on.

**Tech Stack:** Nuxt 3, Vue 3 (script setup, composition API), shadcn-vue + reka-ui primitives,
Tailwind CSS v4, Vitest + @vue/test-utils (jsdom).

**Run tests with:** `npx vitest run <path>` (there is no `npm test` script in this repo).

---

## File Structure

**Create:**

| File | Responsibility |
| --- | --- |
| `app/components/website-builder/data/review-config.ts` | Types, defaults, clone, native-scale mapping, `resolveAutoReviews`, `autoReviewStats`, `meetsMinCount`. Pure, no Vue imports |
| `app/components/website-builder/steps/ReviewAutoSettings.vue` | The Auto rules form: 3 channel rows, written-comment filter, min-count gate, batch size, live match line |
| `tests/website-builder/review-config.spec.ts` | Unit tests for every helper in `review-config.ts` |
| `tests/website-builder/ReviewAutoSettings.spec.ts` | Render + emit tests for the new component |
| `tests/components/review-hub/display-score.spec.ts` | Regression test for the Direct scale fix |

**Modify:**

| File | Change |
| --- | --- |
| `app/components/review-hub/data/types.ts:96-100` | `getDisplayScore` divides Direct by 2 |
| `app/components/website-builder/data/websites.ts` | `Website.reviewConfig?: WebsiteReviewConfig` |
| `app/components/website-builder/steps/ReviewStep.vue` | `config` in `ReviewSelection`, mode toggle, Auto/Manual branches, featured pruning, mode-aware validity. Drops its own `minRating` select |
| `app/components/website-builder/steps/PreviewStep.vue` | Mode-aware summary, persists `reviewConfig`, Load more preview |
| `app/pages/website-builder/create.vue` | Seeds `config`, restores it in edit mode, drops the now-duplicated step-3 gate |

Existing website-builder tests live in `tests/website-builder/` (not `tests/components/`), so the
new specs follow that. This differs from the paths named in the spec's Testing section; the
existing convention wins.

---

## Task 1: Fix the Direct review display scale

`getDisplayScore` divides only Airbnb by 2, while `getDisplayMax` returns 5 for Airbnb **and**
Direct. Direct mock records store normalized `10` (`rr-007`, `rr-014`), so the Review Hub renders
them as `10.0/5` today. The per-channel thresholds are meaningless if the number the host reads
back sits on a different scale than the one they set, so this goes first.

**Files:**
- Modify: `app/components/review-hub/data/types.ts:96-100`
- Test: `tests/components/review-hub/display-score.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/review-hub/display-score.spec.ts`:

```ts
// getDisplayMax reports 5 for Airbnb and Direct, 10 for Booking.com. getDisplayScore
// must divide by 2 for every channel shown on a 5-point scale, or a Direct review
// renders as "10.0/5".
import { describe, expect, it } from 'vitest'
import { getDisplayMax, getDisplayScore } from '~/components/review-hub/data/types'

describe('getDisplayScore', () => {
  it('halves an Airbnb score for its 5-point scale', () => {
    expect(getDisplayScore(10, 'airbnb')).toBe('5.0')
    expect(getDisplayScore(9, 'airbnb')).toBe('4.5')
  })

  it('halves a Direct score for its 5-point scale', () => {
    expect(getDisplayScore(10, 'direct')).toBe('5.0')
    expect(getDisplayScore(9, 'direct')).toBe('4.5')
  })

  it('leaves a Booking.com score on its 10-point scale', () => {
    expect(getDisplayScore(9, 'booking_com')).toBe('9.0')
  })

  it('renders a dash for a missing score', () => {
    expect(getDisplayScore(null, 'airbnb')).toBe('-')
  })

  it('never reports a score above its own display max', () => {
    for (const source of ['airbnb', 'booking_com', 'direct'] as const) {
      expect(Number(getDisplayScore(10, source))).toBeLessThanOrEqual(getDisplayMax(source))
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/review-hub/display-score.spec.ts`
Expected: FAIL. The Direct cases report `'10.0'` instead of `'5.0'`, and the display-max case
fails for `direct` with `10 <= 5`.

- [ ] **Step 3: Apply the fix**

In `app/components/review-hub/data/types.ts`, replace the body of `getDisplayScore`:

```ts
export function getDisplayScore(overallScore: number | null, source: ReviewSource): string {
  if (overallScore === null) return '-'
  // Every channel whose display max is 5 needs halving; only Booking.com is a 10-point scale.
  if (getDisplayMax(source) === 5) return (overallScore / 2).toFixed(1)
  return overallScore.toFixed(1)
}
```

Deriving from `getDisplayMax` keeps the two helpers from drifting apart again.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/review-hub/display-score.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Check nothing else regressed**

Run: `npx vitest run tests/composables/useReviewHub-translate.spec.ts tests/website-builder/`
Expected: PASS. This fix also changes what `FeedTable.vue` and `DetailGuestPanel.vue` render for
Direct reviews, which is the point.

- [ ] **Step 6: Commit**

```bash
git add app/components/review-hub/data/types.ts tests/components/review-hub/display-score.spec.ts
git commit -m "fix(review-hub): show Direct review scores on their 5-star scale"
```

---

## Task 2: Config types, defaults and scale mapping

**Files:**
- Create: `app/components/website-builder/data/review-config.ts`
- Test: `tests/website-builder/review-config.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/website-builder/review-config.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  cloneReviewConfig,
  createDefaultReviewConfig,
  nativeToNormalized,
  thresholdOptions,
} from '~/components/website-builder/data/review-config'

describe('createDefaultReviewConfig', () => {
  it('starts in auto mode with every channel enabled', () => {
    const config = createDefaultReviewConfig()
    expect(config.mode).toBe('auto')
    expect(config.channels.airbnb).toEqual({ enabled: true, minRating: 4.5 })
    expect(config.channels.booking_com).toEqual({ enabled: true, minRating: 9 })
    expect(config.channels.direct).toEqual({ enabled: true, minRating: 4.5 })
  })

  it('requires a written comment, gates at 3 matches and batches 12', () => {
    const config = createDefaultReviewConfig()
    expect(config.requireText).toBe(true)
    expect(config.minCountToShow).toBe(3)
    expect(config.batchSize).toBe(12)
  })

  it('returns a fresh object each call so two websites cannot share one', () => {
    const a = createDefaultReviewConfig()
    const b = createDefaultReviewConfig()
    a.channels.airbnb.minRating = 3
    expect(b.channels.airbnb.minRating).toBe(4.5)
  })
})

describe('cloneReviewConfig', () => {
  it('deep-copies the channel map', () => {
    const original = createDefaultReviewConfig()
    const copy = cloneReviewConfig(original)
    copy.channels.booking_com.enabled = false
    expect(original.channels.booking_com.enabled).toBe(true)
  })
})

describe('nativeToNormalized', () => {
  it('doubles a 5-point channel rating onto the 0-10 store scale', () => {
    expect(nativeToNormalized(4.5, 'airbnb')).toBe(9)
    expect(nativeToNormalized(4.5, 'direct')).toBe(9)
    expect(nativeToNormalized(5, 'airbnb')).toBe(10)
  })

  it('passes a 10-point channel rating through unchanged', () => {
    expect(nativeToNormalized(9, 'booking_com')).toBe(9)
  })
})

describe('thresholdOptions', () => {
  it('offers 5 down to 3 in half steps for a 5-point channel', () => {
    expect(thresholdOptions('airbnb')).toEqual([5, 4.5, 4, 3.5, 3])
    expect(thresholdOptions('direct')).toEqual([5, 4.5, 4, 3.5, 3])
  })

  it('offers 10 down to 8 in half steps for a 10-point channel', () => {
    expect(thresholdOptions('booking_com')).toEqual([10, 9.5, 9, 8.5, 8])
  })

  it('includes each channel default in its own option list', () => {
    const config = createDefaultReviewConfig()
    for (const source of ['airbnb', 'booking_com', 'direct'] as const) {
      expect(thresholdOptions(source)).toContain(config.channels[source].minRating)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/website-builder/review-config.spec.ts`
Expected: FAIL to even load, with "Failed to resolve import ... review-config".

- [ ] **Step 3: Create the module**

Create `app/components/website-builder/data/review-config.ts`:

```ts
// Auto-show rules for guest reviews on a generated website.
//
// The review store is normalized to 0-10 (Channex `guest_rating_overall`), but a host
// thinks in the scale their channel shows them: 4.5 of 5 on Airbnb is the same bar as
// 9 of 10 on Booking.com. Thresholds are therefore stored NATIVE and converted here,
// so the number in the form always matches the number on the channel.
//
// Framework-free on purpose: the wizard owns the reactive state and calls these.

import type { ReviewRecord, ReviewSource } from '~/components/review-hub/data/types'
import { getDisplayMax } from '~/components/review-hub/data/types'

export type WebsiteReviewMode = 'auto' | 'manual'

export interface ReviewChannelRule {
  enabled: boolean
  minRating: number // native scale: airbnb/direct 0-5, booking_com 0-10
}

export interface WebsiteReviewConfig {
  mode: WebsiteReviewMode
  channels: Record<ReviewSource, ReviewChannelRule>
  requireText: boolean
  minCountToShow: number // hide the whole section below this many matches
  batchSize: number // Load more batch; there is no cap on the total
}

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

export function cloneReviewConfig(config: WebsiteReviewConfig): WebsiteReviewConfig {
  return {
    ...config,
    channels: {
      airbnb: { ...config.channels.airbnb },
      booking_com: { ...config.channels.booking_com },
      direct: { ...config.channels.direct },
    },
  }
}

/** Converts a host-facing native rating to the 0-10 scale the store uses. */
export function nativeToNormalized(rating: number, source: ReviewSource): number {
  return getDisplayMax(source) === 5 ? rating * 2 : rating
}

/** The five selectable thresholds for a channel, highest first, in native scale. */
export function thresholdOptions(source: ReviewSource): number[] {
  const max = getDisplayMax(source)
  return [0, 1, 2, 3, 4].map(step => max - step * 0.5)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/website-builder/review-config.spec.ts`
Expected: PASS, 9 tests. `ReviewRecord` is imported but unused so far; Task 3 uses it.

- [ ] **Step 5: Commit**

```bash
git add app/components/website-builder/data/review-config.ts tests/website-builder/review-config.spec.ts
git commit -m "feat(website-builder): add review auto-show config types and scale mapping"
```

---

## Task 3: The resolver

**Files:**
- Modify: `app/components/website-builder/data/review-config.ts`
- Test: `tests/website-builder/review-config.spec.ts`

Facts about the mock data this task's tests rely on (from
`app/components/review-hub/data/mock-review-records.ts`, 15 records):

| id | source | listing | rating | hidden | received |
| --- | --- | --- | --- | --- | --- |
| rr-001 | airbnb | lst-1 | 10 | no | 2026-06-25 |
| rr-002 | airbnb | lst-5 | 8 | no | 2026-06-24 |
| rr-003 | airbnb | lst-1 | 8 | **yes** | dynamic (yesterday) |
| rr-005 | booking_com | lst-5 | 10 | no | 2026-06-26 |
| rr-007 | direct | lst-1 | 10 | no | 2026-06-23 |
| rr-008 | direct | lst-1 | **null** | no | null |
| rr-011 | airbnb | lst-1 | 10 | no | 2026-07-01 |
| rr-012 | booking_com | lst-12 | 9 | no | 2026-07-02 |
| rr-014 | direct | lst-1 | 10 | no | 2026-07-04 |

`prop-1` maps to `['lst-1', 'lst-5']`, `prop-2` to `['lst-12']`. Every record except `rr-008`
has review text, so `requireText` needs a synthetic record to be tested meaningfully.

- [ ] **Step 1: Write the failing tests**

Append to `tests/website-builder/review-config.spec.ts`. Add these two imports to the existing
import block at the top of the file:

```ts
import type { ReviewRecord } from '~/components/review-hub/data/types'
import { mockReviewRecords } from '~/components/review-hub/data/mock-review-records'
```

and add `resolveAutoReviews` to the names imported from `review-config`. Then append:

```ts
const PROP_1_LISTINGS = ['lst-1', 'lst-5']

/** A record with only the fields the resolver reads, for cases the mock data cannot express. */
function makeRecord(over: Partial<ReviewRecord> & { id: string }): ReviewRecord {
  return {
    reservation_id: 'res-x',
    source: 'airbnb',
    listing_id: 'lst-1',
    listing_name: 'Test',
    listing_location: 'Bali',
    unit_id: null,
    guest_name: 'Test Guest',
    num_guests: 2,
    nights: 3,
    guest_rating_overall: 10,
    scores: [],
    tags: [],
    guest_review_text: 'Lovely stay',
    is_hidden: false,
    is_replied: false,
    private_feedback: null,
    review_received_at: '2026-06-01T00:00:00Z',
    language_detected: 'en',
    translated_content: null,
    translation_language: null,
    reply_status: 'needs_reply',
    reply_text: null,
    reply_posted_at: null,
    host_review_id: null,
    host_review_text: null,
    host_review_ratings: null,
    is_reviewee_recommended: null,
    host_review_tags: [],
    sor_id: null,
    checkout_date: '2026-05-30',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...over,
  } as ReviewRecord
}

describe('resolveAutoReviews', () => {
  it('returns the five default-passing reviews for prop-1', () => {
    const config = createDefaultReviewConfig()
    const ids = resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, config).map(r => r.id)
    expect(ids.sort()).toEqual(['rr-001', 'rr-005', 'rr-007', 'rr-011', 'rr-014'])
  })

  it('orders the pool newest first', () => {
    const config = createDefaultReviewConfig()
    const ids = resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, config).map(r => r.id)
    expect(ids).toEqual(['rr-014', 'rr-011', 'rr-005', 'rr-001', 'rr-007'])
  })

  it('sorts a review with no received date last', () => {
    const records = [
      makeRecord({ id: 'undated', review_received_at: null }),
      makeRecord({ id: 'dated', review_received_at: '2026-01-01T00:00:00Z' }),
    ]
    const ids = resolveAutoReviews(records, ['lst-1'], createDefaultReviewConfig()).map(r => r.id)
    expect(ids).toEqual(['dated', 'undated'])
  })

  it('excludes listings outside the selected properties', () => {
    const config = createDefaultReviewConfig()
    const ids = resolveAutoReviews(mockReviewRecords, ['lst-12'], config).map(r => r.id)
    expect(ids).toEqual(['rr-012'])
  })

  it('returns nothing when no listing is in scope', () => {
    expect(resolveAutoReviews(mockReviewRecords, [], createDefaultReviewConfig())).toEqual([])
  })

  it('treats the threshold as inclusive', () => {
    // rr-012 is a Booking.com 9 and the default Booking.com rule is exactly 9+.
    const ids = resolveAutoReviews(mockReviewRecords, ['lst-12'], createDefaultReviewConfig())
      .map(r => r.id)
    expect(ids).toContain('rr-012')
  })

  it('applies each channel threshold in its own native scale', () => {
    // A normalized 9 clears Airbnb 4.5 and Booking.com 9, but not Airbnb 5.
    const records = [
      makeRecord({ id: 'ab', source: 'airbnb', guest_rating_overall: 9 }),
      makeRecord({ id: 'bc', source: 'booking_com', guest_rating_overall: 9 }),
    ]
    const config = createDefaultReviewConfig()
    expect(resolveAutoReviews(records, ['lst-1'], config).map(r => r.id).sort())
      .toEqual(['ab', 'bc'])

    config.channels.airbnb.minRating = 5
    expect(resolveAutoReviews(records, ['lst-1'], config).map(r => r.id)).toEqual(['bc'])
  })

  it('drops every review from a disabled channel, however high its rating', () => {
    const config = createDefaultReviewConfig()
    config.channels.direct.enabled = false
    const ids = resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, config).map(r => r.id)
    expect(ids).not.toContain('rr-007') // a Direct 10
    expect(ids).not.toContain('rr-014')
    expect(ids).toContain('rr-001')
  })

  it('returns nothing when every channel is disabled', () => {
    const config = createDefaultReviewConfig()
    for (const rule of Object.values(config.channels)) rule.enabled = false
    expect(resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, config)).toEqual([])
  })

  it('never returns a hidden double-blind review', () => {
    const config = createDefaultReviewConfig()
    config.channels.airbnb.minRating = 3 // low enough that rr-003 would otherwise qualify
    const ids = resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, config).map(r => r.id)
    expect(ids).not.toContain('rr-003')
  })

  it('never returns a review with no rating', () => {
    const ids = resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, createDefaultReviewConfig())
      .map(r => r.id)
    expect(ids).not.toContain('rr-008')
  })

  it('drops untexted reviews when requireText is on and keeps them when off', () => {
    const records = [
      makeRecord({ id: 'null-text', guest_review_text: null }),
      makeRecord({ id: 'blank-text', guest_review_text: '   ' }),
      makeRecord({ id: 'has-text', guest_review_text: 'Wonderful villa' }),
    ]
    const config = createDefaultReviewConfig()
    expect(resolveAutoReviews(records, ['lst-1'], config).map(r => r.id)).toEqual(['has-text'])

    config.requireText = false
    expect(resolveAutoReviews(records, ['lst-1'], config).map(r => r.id).sort())
      .toEqual(['blank-text', 'has-text', 'null-text'])
  })

  it('applies no cap to the pool', () => {
    const records = Array.from({ length: 200 }, (_, i) => makeRecord({
      id: `bulk-${i}`,
      review_received_at: new Date(2026, 0, 1 + i).toISOString(),
    }))
    expect(resolveAutoReviews(records, ['lst-1'], createDefaultReviewConfig())).toHaveLength(200)
  })

  it('ignores batchSize and minCountToShow, which are display concerns', () => {
    const config = createDefaultReviewConfig()
    config.batchSize = 2
    config.minCountToShow = 99
    expect(resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, config)).toHaveLength(5)
  })

  it('does not mutate the records it was given', () => {
    const snapshot = mockReviewRecords.map(r => r.id)
    resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, createDefaultReviewConfig())
    expect(mockReviewRecords.map(r => r.id)).toEqual(snapshot)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/website-builder/review-config.spec.ts`
Expected: FAIL with `resolveAutoReviews is not a function` (or an unresolved-export error).

- [ ] **Step 3: Implement the resolver**

Append to `app/components/website-builder/data/review-config.ts`:

```ts
function hasText(record: ReviewRecord): boolean {
  return (record.guest_review_text ?? '').trim() !== ''
}

/**
 * Every review that should appear on the published site, newest first, uncapped.
 *
 * Pure: does not mutate `records`. `batchSize` and `minCountToShow` are display
 * settings and deliberately play no part here.
 */
export function resolveAutoReviews(
  records: ReviewRecord[],
  listingIds: string[],
  config: WebsiteReviewConfig,
): ReviewRecord[] {
  if (listingIds.length === 0)
    return []
  const inScope = new Set(listingIds)

  return records
    .filter((record) => {
      if (!inScope.has(record.listing_id))
        return false
      // Airbnb double-blind reviews are not public yet.
      if (record.is_hidden)
        return false
      const rule = config.channels[record.source]
      if (!rule?.enabled)
        return false
      if (record.guest_rating_overall === null)
        return false
      if (record.guest_rating_overall < nativeToNormalized(rule.minRating, record.source))
        return false
      if (config.requireText && !hasText(record))
        return false
      return true
    })
    .sort((a, b) => {
      // Undated reviews sort last rather than jumping to the top as epoch 0.
      const left = a.review_received_at ? Date.parse(a.review_received_at) : -Infinity
      const right = b.review_received_at ? Date.parse(b.review_received_at) : -Infinity
      return right - left
    })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/website-builder/review-config.spec.ts`
Expected: PASS, 24 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/website-builder/data/review-config.ts tests/website-builder/review-config.spec.ts
git commit -m "feat(website-builder): resolve the auto-show review pool from per-channel rules"
```

---

## Task 4: Count helpers

`autoReviewStats` feeds the live match line in the settings form. `meetsMinCount` is separate
because only the caller knows how many manual testimonials to add in.

**Files:**
- Modify: `app/components/website-builder/data/review-config.ts`
- Test: `tests/website-builder/review-config.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add `autoReviewStats` and `meetsMinCount` to the `review-config` import block, then append to
`tests/website-builder/review-config.spec.ts`:

```ts
describe('autoReviewStats', () => {
  it('counts the pool per channel and in total', () => {
    const stats = autoReviewStats(mockReviewRecords, PROP_1_LISTINGS, createDefaultReviewConfig())
    expect(stats.total).toBe(5)
    expect(stats.byChannel).toEqual({ airbnb: 2, booking_com: 1, direct: 2 })
  })

  it('has per-channel counts that sum to the total', () => {
    const stats = autoReviewStats(mockReviewRecords, PROP_1_LISTINGS, createDefaultReviewConfig())
    const sum = Object.values(stats.byChannel).reduce((a, b) => a + b, 0)
    expect(sum).toBe(stats.total)
  })

  it('reports zero for a channel with no passing reviews rather than omitting it', () => {
    const config = createDefaultReviewConfig()
    config.channels.direct.enabled = false
    const stats = autoReviewStats(mockReviewRecords, PROP_1_LISTINGS, config)
    expect(stats.byChannel.direct).toBe(0)
  })

  it('reports an empty pool with no listings in scope', () => {
    const stats = autoReviewStats(mockReviewRecords, [], createDefaultReviewConfig())
    expect(stats.total).toBe(0)
    expect(stats.byChannel).toEqual({ airbnb: 0, booking_com: 0, direct: 0 })
  })
})

describe('meetsMinCount', () => {
  it('counts manual testimonials toward the gate', () => {
    const config = createDefaultReviewConfig() // minCountToShow: 3
    expect(meetsMinCount(1, 2, config)).toBe(true)
    expect(meetsMinCount(1, 1, config)).toBe(false)
  })

  it('passes on the boundary', () => {
    expect(meetsMinCount(3, 0, createDefaultReviewConfig())).toBe(true)
  })

  it('always passes when the gate is zero', () => {
    const config = createDefaultReviewConfig()
    config.minCountToShow = 0
    expect(meetsMinCount(0, 0, config)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/website-builder/review-config.spec.ts`
Expected: FAIL with `autoReviewStats is not a function`.

- [ ] **Step 3: Implement the helpers**

Append to `app/components/website-builder/data/review-config.ts`:

```ts
export interface AutoReviewStats {
  total: number
  byChannel: Record<ReviewSource, number>
}

/** Pool size overall and per channel, for the live match line in the rules form. */
export function autoReviewStats(
  records: ReviewRecord[],
  listingIds: string[],
  config: WebsiteReviewConfig,
): AutoReviewStats {
  const resolved = resolveAutoReviews(records, listingIds, config)
  const byChannel: Record<ReviewSource, number> = { airbnb: 0, booking_com: 0, direct: 0 }
  for (const record of resolved)
    byChannel[record.source] += 1
  return { total: resolved.length, byChannel }
}

/**
 * Whether the published site should render its reviews section at all.
 * Manual testimonials count, so a new property with two host-written reviews and one
 * matching guest review still clears the default gate of 3.
 */
export function meetsMinCount(
  autoTotal: number,
  manualCount: number,
  config: WebsiteReviewConfig,
): boolean {
  return autoTotal + manualCount >= config.minCountToShow
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/website-builder/review-config.spec.ts`
Expected: PASS, 31 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/website-builder/data/review-config.ts tests/website-builder/review-config.spec.ts
git commit -m "feat(website-builder): add auto-review count helpers and the section gate"
```

---

## Task 5: Persist the config on the Website stub

**Files:**
- Modify: `app/components/website-builder/data/websites.ts`
- Test: `tests/website-builder/property-listings.spec.ts` (its `website type` describe block)

- [ ] **Step 1: Write the failing test**

Append to the existing `describe('website type', ...)` block in
`tests/website-builder/property-listings.spec.ts`:

```ts
  it('accepts an optional reviewConfig', () => {
    const site: Website = {
      id: 'y',
      name: 'Y',
      url: 'y.com',
      status: 'draft',
      template: 'Beach House',
      visits: 0,
      lastUpdated: '2026-01-01T00:00:00Z',
      thumbnail: null,
      reviewConfig: createDefaultReviewConfig(),
    }
    expect(site.reviewConfig?.mode).toBe('auto')
    expect(site.reviewConfig?.channels.booking_com.minRating).toBe(9)
  })

  it('is valid without a reviewConfig, so seeded websites need no migration', () => {
    const site: Website = {
      id: 'z',
      name: 'Z',
      url: 'z.com',
      status: 'draft',
      template: 'Beach House',
      visits: 0,
      lastUpdated: '2026-01-01T00:00:00Z',
      thumbnail: null,
    }
    expect(site.reviewConfig).toBeUndefined()
  })
```

Add to the file's imports:

```ts
import { createDefaultReviewConfig } from '../../app/components/website-builder/data/review-config'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/website-builder/property-listings.spec.ts`
Expected: PASS at runtime (TypeScript excess-property errors do not fail Vitest), so verify the
type instead.

Run: `npm run typecheck`
Expected: FAIL with "Object literal may only specify known properties, and 'reviewConfig' does
not exist in type 'Website'".

- [ ] **Step 3: Extend the interface**

In `app/components/website-builder/data/websites.ts`, add the import and the field:

```ts
import type { WebsiteReviewConfig } from '~/components/website-builder/data/review-config'
```

```ts
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
}
```

Leave the four seeded websites untouched.

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/website-builder/property-listings.spec.ts`
Expected: PASS, 9 tests.

Run: `npm run typecheck`
Expected: no errors for `websites.ts` or the spec.

- [ ] **Step 5: Commit**

```bash
git add app/components/website-builder/data/websites.ts tests/website-builder/property-listings.spec.ts
git commit -m "feat(website-builder): persist the review config on the website stub"
```

---

## Task 6: The ReviewAutoSettings component

**Files:**
- Create: `app/components/website-builder/steps/ReviewAutoSettings.vue`
- Test: `tests/website-builder/ReviewAutoSettings.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/website-builder/ReviewAutoSettings.spec.ts`:

```ts
// The Auto rules form. Its job is to render one row per channel in that channel's own
// scale and to emit a patched config without ever mutating the prop.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import ReviewAutoSettings from '~/components/website-builder/steps/ReviewAutoSettings.vue'

const global = {
  components: { Checkbox, Input, Label, Switch },
  // The reka-ui Select renders through teleports the shallow mount does not need.
  stubs: {
    Select: { template: '<div class="select-stub"><slot /></div>' },
    SelectTrigger: { template: '<button class="select-trigger"><slot /></button>' },
    SelectValue: { template: '<span />' },
    SelectContent: { template: '<div><slot /></div>' },
    SelectItem: { template: '<div class="select-item"><slot /></div>' },
    Icon: { template: '<i />' },
  },
  config: { warnHandler: () => {} },
}

const stats = { total: 34, byChannel: { airbnb: 18, booking_com: 11, direct: 5 } }

function mountSettings(overrides = {}) {
  return mount(ReviewAutoSettings, {
    props: { modelValue: createDefaultReviewConfig(), stats, ...overrides },
    global,
  })
}

describe('reviewAutoSettings', () => {
  it('renders one row per channel', () => {
    const text = mountSettings().text()
    expect(text).toContain('Airbnb')
    expect(text).toContain('Booking.com')
    expect(text).toContain('Direct')
  })

  it('labels each channel with its own scale', () => {
    const text = mountSettings().text()
    expect(text).toContain('of 5')
    expect(text).toContain('of 10')
  })

  it('shows the live match count with a per-channel breakdown', () => {
    const text = mountSettings().text()
    expect(text).toContain('34 reviews match')
    expect(text).toContain('Airbnb 18')
    expect(text).toContain('Booking.com 11')
    expect(text).toContain('Direct 5')
  })

  it('says one review matches without pluralising', () => {
    const wrapper = mountSettings({
      stats: { total: 1, byChannel: { airbnb: 1, booking_com: 0, direct: 0 } },
    })
    expect(wrapper.text()).toContain('1 review matches')
  })

  it('warns when nothing matches', () => {
    const wrapper = mountSettings({
      stats: { total: 0, byChannel: { airbnb: 0, booking_com: 0, direct: 0 } },
    })
    expect(wrapper.text()).toContain('No reviews match')
  })

  it('emits a config with the channel disabled when its switch is turned off', async () => {
    const wrapper = mountSettings()
    await wrapper.findAll('button[role="switch"]')[0]!.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    const next = emitted![0]![0] as ReturnType<typeof createDefaultReviewConfig>
    expect(next.channels.airbnb.enabled).toBe(false)
    expect(next.channels.booking_com.enabled).toBe(true)
  })

  it('never mutates the config it was given', async () => {
    const modelValue = createDefaultReviewConfig()
    const wrapper = mount(ReviewAutoSettings, { props: { modelValue, stats }, global })
    await wrapper.findAll('button[role="switch"]')[0]!.trigger('click')
    expect(modelValue.channels.airbnb.enabled).toBe(true)
  })

  // The reka-ui Checkbox renders a button carrying role="checkbox". If that selector
  // finds nothing in your reka-ui version, target `#review-require-text` instead.
  it('emits requireText off when its checkbox is cleared', async () => {
    const wrapper = mountSettings()
    await wrapper.find('button[role="checkbox"]').trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    const next = emitted![0]![0] as ReturnType<typeof createDefaultReviewConfig>
    expect(next.requireText).toBe(false)
  })

  it('clamps a batch size below 1 up to 1', async () => {
    const wrapper = mountSettings()
    const batchInput = wrapper.find('input#review-batch-size')
    await batchInput.setValue('0')

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as ReturnType<typeof createDefaultReviewConfig>
    expect(last.batchSize).toBe(1)
  })

  it('clamps a negative minimum count up to 0', async () => {
    const wrapper = mountSettings()
    await wrapper.find('input#review-min-count').setValue('-5')

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as ReturnType<typeof createDefaultReviewConfig>
    expect(last.minCountToShow).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/website-builder/ReviewAutoSettings.spec.ts`
Expected: FAIL to load, "Failed to resolve import ... ReviewAutoSettings.vue".

- [ ] **Step 3: Create the component**

Create `app/components/website-builder/steps/ReviewAutoSettings.vue`:

```vue
<script setup lang="ts">
import type { ReviewSource } from '~/components/review-hub/data/types'
import type { AutoReviewStats, WebsiteReviewConfig } from '~/components/website-builder/data/review-config'
import { channelIcons, channelLabels, getDisplayMax } from '~/components/review-hub/data/types'
import { thresholdOptions } from '~/components/website-builder/data/review-config'

const props = defineProps<{
  modelValue: WebsiteReviewConfig
  stats: AutoReviewStats
}>()

const emit = defineEmits<{
  'update:modelValue': [value: WebsiteReviewConfig]
}>()

const CHANNELS: ReviewSource[] = ['airbnb', 'booking_com', 'direct']

// Every write goes through a spread, so the parent's config object is never mutated.
function patch(partial: Partial<WebsiteReviewConfig>) {
  emit('update:modelValue', { ...props.modelValue, ...partial })
}

function patchChannel(source: ReviewSource, partial: Partial<WebsiteReviewConfig['channels'][ReviewSource]>) {
  patch({
    channels: {
      ...props.modelValue.channels,
      [source]: { ...props.modelValue.channels[source], ...partial },
    },
  })
}

const breakdown = computed(() =>
  CHANNELS
    .filter(source => props.modelValue.channels[source].enabled)
    .map(source => `${channelLabels[source]} ${props.stats.byChannel[source]}`),
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Per-channel rules -->
    <div class="rounded-lg border">
      <div class="border-b px-4 py-3">
        <p class="text-sm font-medium">
          Auto-show rules
        </p>
        <p class="text-xs text-muted-foreground">
          Any review that clears its channel's rule appears on the website, including reviews
          that arrive after publishing.
        </p>
      </div>
      <div class="divide-y">
        <div
          v-for="source in CHANNELS"
          :key="source"
          class="flex flex-wrap items-center gap-3 px-4 py-3"
          :class="modelValue.channels[source].enabled ? '' : 'opacity-60'"
        >
          <Switch
            :id="`review-channel-${source}`"
            :model-value="modelValue.channels[source].enabled"
            @update:model-value="patchChannel(source, { enabled: Boolean($event) })"
          />
          <Icon :name="channelIcons[source]" class="size-4 shrink-0" />
          <Label :for="`review-channel-${source}`" class="text-sm font-medium min-w-28">
            {{ channelLabels[source] }}
          </Label>
          <div class="flex items-center gap-2 ml-auto">
            <span class="text-xs text-muted-foreground">Minimum rating</span>
            <Select
              :model-value="modelValue.channels[source].minRating"
              :disabled="!modelValue.channels[source].enabled"
              @update:model-value="patchChannel(source, { minRating: Number($event) })"
            >
              <SelectTrigger class="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in thresholdOptions(source)" :key="option" :value="option">
                  {{ option }}+
                </SelectItem>
              </SelectContent>
            </Select>
            <span class="text-xs text-muted-foreground w-10">of {{ getDisplayMax(source) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Content + display settings -->
    <div class="flex flex-col gap-3 rounded-lg border p-4">
      <div class="flex items-center gap-2">
        <Checkbox
          id="review-require-text"
          :model-value="modelValue.requireText"
          @update:model-value="patch({ requireText: Boolean($event) })"
        />
        <Label for="review-require-text" class="text-sm cursor-pointer">
          Only reviews with a written comment
        </Label>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Label for="review-min-count" class="text-sm">
          Hide the section until at least
        </Label>
        <Input
          id="review-min-count"
          type="number"
          min="0"
          class="w-20"
          :model-value="modelValue.minCountToShow"
          @update:model-value="patch({ minCountToShow: Math.max(0, Number($event) || 0) })"
        />
        <span class="text-sm">reviews match</span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Label for="review-batch-size" class="text-sm">
          Show
        </Label>
        <Input
          id="review-batch-size"
          type="number"
          min="1"
          class="w-20"
          :model-value="modelValue.batchSize"
          @update:model-value="patch({ batchSize: Math.max(1, Number($event) || 1) })"
        />
        <span class="text-sm">reviews per batch</span>
      </div>
      <p class="text-xs text-muted-foreground">
        Visitors see {{ modelValue.batchSize }} at a time with a Load more button. There is no
        limit on the total.
      </p>
    </div>

    <!-- Live match line -->
    <div
      class="flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm"
      :class="stats.total === 0 ? 'border-destructive/30 bg-destructive/5' : 'bg-muted/20'"
    >
      <Icon
        :name="stats.total === 0 ? 'i-lucide-alert-triangle' : 'i-lucide-check-circle-2'"
        class="size-4 shrink-0"
        :class="stats.total === 0 ? 'text-destructive' : 'text-muted-foreground'"
      />
      <span v-if="stats.total === 0" class="font-medium">
        No reviews match these rules yet
      </span>
      <span v-else class="font-medium">
        {{ stats.total }} review{{ stats.total === 1 ? ' matches' : 's match' }}
      </span>
      <span v-if="breakdown.length > 0" class="text-xs text-muted-foreground">
        {{ breakdown.join(' · ') }}
      </span>
    </div>
  </div>
</template>
```

Note the reka-ui rules from CLAUDE.md: `Switch` and `Checkbox` take `model-value` /
`@update:model-value`, and the `Checkbox` sits beside its `Label` rather than inside it, because
a wrapping `<label>` re-dispatches the click and double-toggles.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/website-builder/ReviewAutoSettings.spec.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add app/components/website-builder/steps/ReviewAutoSettings.vue tests/website-builder/ReviewAutoSettings.spec.ts
git commit -m "feat(website-builder): add the review auto-show rules form"
```

---

## Task 7: Wire Auto and Manual modes into the Reviews step

`ReviewStep.vue` keeps its whole manual flow. It gains the mode toggle, the Auto branch, and a
mode-aware notion of validity. Its own `minRating` select goes away: rating floors are Auto's
job, and in Manual mode the host hand-picks from everything in scope with the score badge
visible on each row. That is an intentional behavior change, since Manual previously defaulted
to a hidden 8+ floor.

**Files:**
- Modify: `app/components/website-builder/steps/ReviewStep.vue`
- Test: `tests/website-builder/ReviewStep.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/website-builder/ReviewStep.spec.ts`:

```ts
// The Reviews step in both modes. Auto resolves a pool from the rules; Manual keeps the
// hand-picked list. The step owns validity, so the wizard can trust its `next` event.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import ReviewAutoSettings from '~/components/website-builder/steps/ReviewAutoSettings.vue'
import ReviewStep from '~/components/website-builder/steps/ReviewStep.vue'

const global = {
  components: {
    WebsiteBuilderStepsReviewAutoSettings: ReviewAutoSettings,
  },
  stubs: {
    Button: { template: '<button><slot /></button>' },
    Badge: { template: '<span><slot /></span>' },
    Label: { template: '<label><slot /></label>' },
    Input: { template: '<input>' },
    Textarea: { template: '<textarea />' },
    Checkbox: { template: '<button role="checkbox" />' },
    Switch: { template: '<button role="switch" />' },
    Select: { template: '<div><slot /></div>' },
    SelectTrigger: { template: '<button><slot /></button>' },
    SelectValue: { template: '<span />' },
    SelectContent: { template: '<div><slot /></div>' },
    SelectItem: { template: '<div><slot /></div>' },
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<div><slot /></div>' },
    DialogTitle: { template: '<div><slot /></div>' },
    DialogDescription: { template: '<div><slot /></div>' },
    DialogFooter: { template: '<div><slot /></div>' },
    Icon: { template: '<i />' },
  },
  config: { warnHandler: () => {} },
}

function baseSelection(configOverrides = {}) {
  return {
    selectedReviewIds: [],
    featuredReviewIds: [],
    manualReviews: [],
    featuredManualReviewIds: [],
    config: { ...createDefaultReviewConfig(), ...configOverrides },
  }
}

function mountStep(selection = baseSelection(), propertyIds = ['prop-1']) {
  return mount(ReviewStep, { props: { modelValue: selection, propertyIds }, global })
}

describe('reviewStep mode toggle', () => {
  it('renders the auto rules form in auto mode', () => {
    const wrapper = mountStep()
    expect(wrapper.findComponent(ReviewAutoSettings).exists()).toBe(true)
  })

  it('renders the hand-picked list instead in manual mode', () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    expect(wrapper.findComponent(ReviewAutoSettings).exists()).toBe(false)
  })

  it('emits the new mode when the toggle is clicked', async () => {
    const wrapper = mountStep()
    const manualButton = wrapper.findAll('button').find(b => b.text().trim() === 'Manual')
    await manualButton!.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as ReturnType<typeof baseSelection>
    expect(last.config.mode).toBe('manual')
  })
})

describe('reviewStep auto pool', () => {
  it('reports the resolved count for the selected property', () => {
    const wrapper = mountStep()
    // prop-1 maps to lst-1 + lst-5; five mock reviews clear the default rules.
    expect(wrapper.findComponent(ReviewAutoSettings).props('stats').total).toBe(5)
  })

  it('recomputes the pool when a rule tightens', async () => {
    const wrapper = mountStep()
    const config = createDefaultReviewConfig()
    config.channels.direct.enabled = false
    await wrapper.findComponent(ReviewAutoSettings).vm.$emit('update:modelValue', config)

    expect(wrapper.findComponent(ReviewAutoSettings).props('stats').total).toBe(3)
  })

  it('prunes a featured id that falls out of the pool', async () => {
    const selection = baseSelection()
    selection.featuredReviewIds = ['rr-007'] // a Direct review
    const wrapper = mountStep(selection)

    const config = createDefaultReviewConfig()
    config.channels.direct.enabled = false
    await wrapper.findComponent(ReviewAutoSettings).vm.$emit('update:modelValue', config)
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as ReturnType<typeof baseSelection>
    expect(last.featuredReviewIds).not.toContain('rr-007')
  })
})

describe('reviewStep validity', () => {
  function nextButton(wrapper: ReturnType<typeof mountStep>) {
    return wrapper.findAll('button').find(b => b.text().trim().startsWith('Next'))!
  }

  it('allows Next in auto mode when the pool has reviews', async () => {
    const wrapper = mountStep()
    await nextButton(wrapper).trigger('click')
    expect(wrapper.emitted('next')).toBeTruthy()
  })

  it('blocks Next in auto mode when every channel is disabled', async () => {
    const config = createDefaultReviewConfig()
    for (const rule of Object.values(config.channels)) rule.enabled = false
    const wrapper = mountStep(baseSelection(config))

    await nextButton(wrapper).trigger('click')
    expect(wrapper.emitted('next')).toBeFalsy()
  })

  it('blocks Next in manual mode with nothing picked', async () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    await nextButton(wrapper).trigger('click')
    expect(wrapper.emitted('next')).toBeFalsy()
  })

  it('allows Next in manual mode once a review is picked', async () => {
    const selection = baseSelection({ mode: 'manual' })
    selection.selectedReviewIds = ['rr-001']
    const wrapper = mountStep(selection)

    await nextButton(wrapper).trigger('click')
    expect(wrapper.emitted('next')).toBeTruthy()
  })
})

describe('reviewStep manual candidates', () => {
  it('offers every in-scope review, with no hidden rating floor', () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    // lst-1 holds 6 records (rr-003 hidden) and lst-5 holds 4, so 9 are pickable.
    // Under the old 8+ floor this list would have shown 6.
    expect(wrapper.text()).toContain('/9 selected')
  })
})

describe('reviewStep property changes', () => {
  it('keeps the rules but clears the picks when the property changes', async () => {
    const selection = baseSelection()
    selection.config.channels.direct.enabled = false
    selection.selectedReviewIds = ['rr-001']
    const wrapper = mountStep(selection)

    await wrapper.setProps({ propertyIds: ['prop-2'] })
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as ReturnType<typeof baseSelection>
    expect(last.config.channels.direct.enabled).toBe(false)
    expect(last.selectedReviewIds).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/website-builder/ReviewStep.spec.ts`
Expected: FAIL. `ReviewSelection` has no `config`, there is no mode toggle, and
`ReviewAutoSettings` is never rendered.

- [ ] **Step 3: Update the script block**

In `app/components/website-builder/steps/ReviewStep.vue`, add to the imports:

```ts
import type { AutoReviewStats, WebsiteReviewConfig } from '~/components/website-builder/data/review-config'
import {
  autoReviewStats,
  cloneReviewConfig,
  createDefaultReviewConfig,
  resolveAutoReviews,
} from '~/components/website-builder/data/review-config'
```

Extend the exported interface:

```ts
export interface ReviewSelection {
  selectedReviewIds: string[]
  featuredReviewIds: string[]
  manualReviews: ManualReview[]
  featuredManualReviewIds: string[]
  config: WebsiteReviewConfig
}
```

Replace `const minRating = ref(8)` with the config ref:

```ts
const config = ref<WebsiteReviewConfig>(
  cloneReviewConfig(props.modelValue.config ?? createDefaultReviewConfig()),
)
const isAuto = computed(() => config.value.mode === 'auto')
```

Add `config` to the incoming-prop watcher, next to the four arrays:

```ts
watch(() => props.modelValue, (val) => {
  selectedReviewIds.value = [...val.selectedReviewIds]
  featuredReviewIds.value = [...val.featuredReviewIds]
  manualReviews.value = [...val.manualReviews]
  featuredManualReviewIds.value = [...val.featuredManualReviewIds]
  config.value = cloneReviewConfig(val.config ?? createDefaultReviewConfig())
}, { deep: true })
```

Add `config` to `emitUpdate`:

```ts
function emitUpdate() {
  emit('update:modelValue', {
    selectedReviewIds: [...selectedReviewIds.value],
    featuredReviewIds: [...featuredReviewIds.value],
    manualReviews: [...manualReviews.value],
    featuredManualReviewIds: [...featuredManualReviewIds.value],
    config: cloneReviewConfig(config.value),
  })
}
```

Delete `const ratingOptions = [10, 9, 8, 7, 6]`, and drop the rating floor from
`candidateReviews` so Manual mode offers everything in scope:

```ts
const listingIds = computed(() => getListingsForProperties(props.propertyIds))

// Manual mode: everything in scope except Airbnb double-blind reviews. No rating floor,
// because the score badge is on every row and picking is the point of this mode.
const candidateReviews = computed<ReviewRecord[]>(() => {
  if (listingIds.value.length === 0)
    return []
  return reviewRecords.value.filter(r =>
    listingIds.value.includes(r.listing_id) && !r.is_hidden,
  )
})

// Auto mode: the rules decide, uncapped and newest first.
const autoReviews = computed<ReviewRecord[]>(() =>
  resolveAutoReviews(reviewRecords.value, listingIds.value, config.value),
)

const autoStats = computed<AutoReviewStats>(() =>
  autoReviewStats(reviewRecords.value, listingIds.value, config.value),
)
```

Replace `reviewGroups`' internal call to `getListingsForProperties([propertyId])` as-is (it
stays per-property) and leave `selectedRecords` reading from `candidateReviews`.

Add the config handler, the featured-pruning watcher and mode-aware totals:

```ts
function updateConfig(next: WebsiteReviewConfig) {
  config.value = cloneReviewConfig(next)
  emitUpdate()
}

function setMode(mode: WebsiteReviewConfig['mode']) {
  if (config.value.mode === mode)
    return
  config.value = { ...cloneReviewConfig(config.value), mode }
  emitUpdate()
}

// A threshold change can drop a review that was featured on the main page. Leaving a stale
// id in place would publish a review the rules no longer allow.
watch([autoReviews, isAuto], () => {
  if (!isAuto.value)
    return
  const pool = new Set(autoReviews.value.map(r => r.id))
  const pruned = featuredReviewIds.value.filter(id => pool.has(id))
  if (pruned.length !== featuredReviewIds.value.length) {
    featuredReviewIds.value = pruned
    emitUpdate()
  }
})

const featuredPool = computed(() => (isAuto.value ? autoReviews.value : selectedRecords.value))
```

Replace `totalSelected` and `isValid`:

```ts
const totalSelected = computed(() =>
  (isAuto.value ? autoReviews.value.length : selectedReviewIds.value.length)
  + manualReviews.value.length,
)

const featuredCount = computed(() => featuredReviewIds.value.length + featuredManualReviewIds.value.length)

const anyChannelEnabled = computed(() =>
  Object.values(config.value.channels).some(rule => rule.enabled),
)

const isValid = computed(() => {
  if (!isAuto.value)
    return selectedReviewIds.value.length > 0 || manualReviews.value.length > 0
  return anyChannelEnabled.value
    && (autoReviews.value.length > 0 || manualReviews.value.length > 0)
})

// Advisory when a manual testimonial would still render, blocking when nothing would.
const autoWarning = computed(() => {
  if (!isAuto.value || autoReviews.value.length > 0)
    return null
  if (!anyChannelEnabled.value)
    return 'Every channel is switched off, so no guest review can appear. Enable at least one.'
  if (config.value.requireText)
    return 'No review clears these rules. Try a lower minimum rating, or allow reviews without a written comment.'
  return 'No review clears these rules. Try a lower minimum rating.'
})
```

Keep the existing `propertyIds` watcher as it is: it resets the picks and the visible counts,
and it must NOT touch `config`, because the rules are property-independent.

- [ ] **Step 4: Update the template**

Insert the mode toggle directly after the header block at the top of the template:

```vue
    <!-- Mode toggle -->
    <div class="flex items-center gap-1 rounded-lg border p-1 w-fit">
      <Button
        :variant="isAuto ? 'default' : 'ghost'"
        size="sm"
        class="h-7 text-xs"
        @click="setMode('auto')"
      >
        <Icon name="i-lucide-wand-sparkles" class="size-3.5 mr-1" />
        Auto
      </Button>
      <Button
        :variant="isAuto ? 'ghost' : 'default'"
        size="sm"
        class="h-7 text-xs"
        @click="setMode('manual')"
      >
        <Icon name="i-lucide-hand" class="size-3.5 mr-1" />
        Manual
      </Button>
    </div>
    <p class="text-xs text-muted-foreground -mt-3">
      {{ isAuto
        ? 'Reviews that clear your rules appear automatically, including new ones after publishing.'
        : 'You pick each review by hand. New reviews will not appear until you edit this website.' }}
    </p>
```

Wrap the existing toolbar, manual chips and grouped list so they render in Manual mode only.
Concretely: on the toolbar `<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">`
add `v-if="!isAuto"`, and delete the `Min rating` `Label` + `Select` pair from inside it (the
`Property` filter select stays). Add `v-if="!isAuto"` to the `<div v-if="candidateReviews.length > 0" class="space-y-2">`
group list (making it `v-if="!isAuto && candidateReviews.length > 0"`) and to its sibling empty
state (making it `v-else-if="!isAuto"`).

Add the Auto branch immediately after the mode toggle copy:

```vue
    <template v-if="isAuto">
      <WebsiteBuilderStepsReviewAutoSettings
        :model-value="config"
        :stats="autoStats"
        @update:model-value="updateConfig"
      />

      <div v-if="autoWarning" class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        <Icon name="i-lucide-alert-triangle" class="size-4 shrink-0 mt-0.5 text-amber-600" />
        <span>{{ autoWarning }}</span>
      </div>

      <!-- Featuring over the resolved pool: star toggles only, no include checkboxes. -->
      <div v-if="autoReviews.length > 0" class="rounded-lg border">
        <button
          type="button"
          class="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium"
          @click="mainPageOpen = !mainPageOpen"
        >
          <Icon name="i-lucide-star" class="size-4 text-muted-foreground" />
          Choose main page reviews
          <span class="text-xs font-normal text-muted-foreground">
            {{ featuredReviewIds.length }} of {{ autoReviews.length }}
          </span>
          <Icon
            :name="mainPageOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="size-4 ml-auto text-muted-foreground"
          />
        </button>
        <div v-if="mainPageOpen" class="space-y-1.5 border-t px-3 py-2">
          <div
            v-for="review in autoReviews"
            :key="review.id"
            class="flex items-center gap-2.5 rounded-lg border px-3 py-2"
          >
            <span class="text-sm font-medium min-w-0 truncate">{{ review.guest_name }}</span>
            <Badge variant="secondary" class="shrink-0 text-[10px] px-1.5 py-0">
              {{ getDisplayScore(review.guest_rating_overall, review.source) }}/{{ getDisplayMax(review.source) }}
            </Badge>
            <Badge variant="outline" class="shrink-0 text-[10px] px-1.5 py-0">
              <Icon :name="channelIcons[review.source]" class="size-3 mr-0.5" />
              {{ channelLabels[review.source] }}
            </Badge>
            <span class="text-xs text-muted-foreground flex-1 min-w-0 truncate hidden sm:inline">
              {{ review.guest_review_text || 'No written review' }}
            </span>
            <button
              type="button"
              class="shrink-0 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors"
              :class="featuredReviewIds.includes(review.id)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground hover:bg-muted/50'"
              @click="toggleFeatured(review.id)"
            >
              <Icon
                :name="featuredReviewIds.includes(review.id) ? 'i-lucide-star' : 'i-lucide-star-outline'"
                class="size-3"
              />
              Main Page
            </button>
          </div>
        </div>
      </div>
    </template>
```

Add the collapse ref to the script, beside the existing `previewOpen`:

```ts
const mainPageOpen = ref(false)
```

Finally, make the existing collapsible preview render the right pool by swapping its
`v-for="r in selectedRecords"` to `v-for="r in featuredPool"`, so Auto previews the resolved
reviews and Manual still previews the picked ones.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/website-builder/ReviewStep.spec.ts`
Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
git add app/components/website-builder/steps/ReviewStep.vue tests/website-builder/ReviewStep.spec.ts
git commit -m "feat(website-builder): add Auto and Manual review modes to the Reviews step"
```

---

## Task 8: Seed and restore the config in the wizard

The wizard also has a duplicated step-3 gate that repeats the step's validity rules and would
now be wrong in Auto mode. `ReviewStep.handleNext` already guards on `isValid` before emitting
`next`, so the parent should trust the event instead of re-deriving the rule.

**Files:**
- Modify: `app/pages/website-builder/create.vue`

No spec accompanies this task. `create.vue` is a page: it calls `definePageMeta`, `useRoute`,
`useRouter` and `navigateTo`, and mounting it renders the whole wizard. No page in this repo has
a unit test for that reason. The three changes here are covered by `npm run typecheck`, by the
Task 7 and Task 9 specs on the components it feeds, and by the manual walkthrough in Task 10.

- [ ] **Step 1: Seed the config**

Add the import:

```ts
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
```

Extend the initial `reviewSelection`:

```ts
const reviewSelection = ref<ReviewSelection>({
  selectedReviewIds: [],
  featuredReviewIds: [],
  manualReviews: [],
  featuredManualReviewIds: [],
  config: createDefaultReviewConfig(),
})
```

- [ ] **Step 2: Restore it in edit mode**

In the `if (import.meta.client && editingWebsite.value)` block, extend the review prefill:

```ts
  reviewSelection.value = {
    selectedReviewIds: site.reviewIds ?? [],
    featuredReviewIds: site.featuredReviewIds ?? [],
    manualReviews: site.manualReviews ?? [],
    featuredManualReviewIds: site.featuredManualReviewIds ?? [],
    // Websites saved before auto-show existed have no config.
    config: site.reviewConfig ?? createDefaultReviewConfig(),
  }
```

- [ ] **Step 3: Stop re-deriving validity in the parent**

Replace the step-3 branch of `goNext`:

```ts
  // ReviewStep owns review validity (it differs by Auto/Manual mode) and only emits
  // `next` when its own rules pass, so this step just advances.
  else if (currentStep.value === 3) {
    currentStep.value = 4
  }
```

- [ ] **Step 4: Verify the wizard still typechecks and the suite is green**

Run: `npm run typecheck`
Expected: no errors in `create.vue`, `ReviewStep.vue`, `PreviewStep.vue`.

Run: `npx vitest run tests/website-builder/`
Expected: PASS, all specs.

- [ ] **Step 5: Commit**

```bash
git add app/pages/website-builder/create.vue
git commit -m "feat(website-builder): seed and restore the review config in the wizard"
```

---

## Task 9: Preview the published behavior

**Files:**
- Modify: `app/components/website-builder/steps/PreviewStep.vue`
- Test: `tests/website-builder/PreviewStep-reviews.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/website-builder/PreviewStep-reviews.spec.ts`:

```ts
// The reviews part of the final wizard step: a mode-aware summary, and a Load more control
// that behaves the way the published site will.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import PreviewStep from '~/components/website-builder/steps/PreviewStep.vue'

const global = {
  stubs: {
    Button: { template: '<button><slot /></button>' },
    Badge: { template: '<span><slot /></span>' },
    Card: { template: '<div><slot /></div>' },
    CardHeader: { template: '<div><slot /></div>' },
    CardTitle: { template: '<div><slot /></div>' },
    CardContent: { template: '<div><slot /></div>' },
    Separator: { template: '<hr>' },
    Icon: { template: '<i />' },
  },
  config: { warnHandler: () => {} },
}

function mountPreview(configOverrides = {}, reviewOverrides = {}) {
  return mount(PreviewStep, {
    props: {
      template: { id: 'luxury-villa', name: 'Luxury Villa', description: '', gradient: '', icon: '' },
      settings: {
        name: 'Villa Test',
        domain: 'villa-test.com',
        description: '',
        brandColor: '#1a1a2e',
        fontFamily: 'Inter',
        logoFile: null,
        faviconFile: null,
        useDefaultFavicon: true,
      },
      property: { propertyIds: ['prop-1'], roomIds: [] },
      reviews: {
        selectedReviewIds: [],
        featuredReviewIds: [],
        manualReviews: [],
        featuredManualReviewIds: [],
        config: { ...createDefaultReviewConfig(), ...configOverrides },
        ...reviewOverrides,
      },
    },
    global,
  })
}

describe('previewStep review summary', () => {
  it('names auto mode and lists the rules in native scale', () => {
    const text = mountPreview().text()
    expect(text).toContain('Auto')
    expect(text).toContain('Airbnb 4.5+')
    expect(text).toContain('Booking.com 9+')
    expect(text).toContain('Direct 4.5+')
  })

  it('reports the resolved count in auto mode, not the picked count', () => {
    expect(mountPreview().text()).toContain('5 reviews match')
  })

  it('omits a disabled channel from the rule list', () => {
    const config = createDefaultReviewConfig()
    config.channels.direct.enabled = false
    expect(mountPreview(config).text()).not.toContain('Direct 4.5+')
  })

  it('reports the picked count in manual mode', () => {
    const text = mountPreview({ mode: 'manual' }, { selectedReviewIds: ['rr-001', 'rr-011'] }).text()
    expect(text).toContain('2 reviews selected')
  })

  it('warns when the section would be hidden by the minimum count', () => {
    const config = createDefaultReviewConfig()
    config.minCountToShow = 20
    expect(mountPreview(config).text()).toContain('hidden')
  })
})

describe('previewStep load more', () => {
  it('shows only one batch at first', () => {
    const config = createDefaultReviewConfig()
    config.batchSize = 2
    const wrapper = mountPreview(config)
    expect(wrapper.findAll('[data-testid="preview-review-card"]')).toHaveLength(2)
  })

  it('appends the next batch when Load more is clicked', async () => {
    const config = createDefaultReviewConfig()
    config.batchSize = 2
    const wrapper = mountPreview(config)

    const loadMore = wrapper.find('[data-testid="preview-load-more"]')
    await loadMore.trigger('click')
    expect(wrapper.findAll('[data-testid="preview-review-card"]')).toHaveLength(4)
  })

  it('hides Load more once the pool is exhausted', async () => {
    const config = createDefaultReviewConfig()
    config.batchSize = 4
    const wrapper = mountPreview(config)

    await wrapper.find('[data-testid="preview-load-more"]').trigger('click')
    expect(wrapper.findAll('[data-testid="preview-review-card"]')).toHaveLength(5)
    expect(wrapper.find('[data-testid="preview-load-more"]').exists()).toBe(false)
  })

  it('never shows Load more when one batch covers everything', () => {
    const wrapper = mountPreview() // batchSize 12, pool of 5
    expect(wrapper.find('[data-testid="preview-load-more"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/website-builder/PreviewStep-reviews.spec.ts`
Expected: FAIL. The summary shows the old "selected" count in every mode and there is no
`preview-load-more` element.

- [ ] **Step 3: Extend the script block**

In `app/components/website-builder/steps/PreviewStep.vue`, add the imports:

```ts
import type { ReviewSource } from '~/components/review-hub/data/types'
import {
  channelIcons,
  channelLabels,
  getDisplayMax,
  getDisplayScore,
} from '~/components/review-hub/data/types'
import { getListingsForProperties } from '~/components/website-builder/data/property-listings'
import { meetsMinCount, resolveAutoReviews } from '~/components/website-builder/data/review-config'
import { useReviewHub } from '~/composables/useReviewHub'
```

Add, before the actions block:

```ts
// ── Review resolution (mirrors what the published site will render) ─────
const { reviewRecords } = useReviewHub()

const reviewConfig = computed(() => props.reviews.config)
const isAutoMode = computed(() => reviewConfig.value.mode === 'auto')

const CHANNELS: ReviewSource[] = ['airbnb', 'booking_com', 'direct']

const activeRules = computed(() =>
  CHANNELS
    .filter(source => reviewConfig.value.channels[source].enabled)
    .map(source => `${channelLabels[source]} ${reviewConfig.value.channels[source].minRating}+`),
)

const resolvedReviews = computed(() =>
  isAutoMode.value
    ? resolveAutoReviews(
        reviewRecords.value,
        getListingsForProperties(props.property.propertyIds),
        reviewConfig.value,
      )
    : reviewRecords.value.filter(r => props.reviews.selectedReviewIds.includes(r.id)),
)

const sectionHidden = computed(() => !meetsMinCount(
  resolvedReviews.value.length,
  props.reviews.manualReviews.length,
  reviewConfig.value,
))

// Load more, exactly as a visitor will meet it.
const visibleCount = ref(reviewConfig.value.batchSize)
watch([resolvedReviews, () => reviewConfig.value.batchSize], () => {
  visibleCount.value = reviewConfig.value.batchSize
})
const visibleReviews = computed(() => resolvedReviews.value.slice(0, visibleCount.value))
const hasMoreReviews = computed(() => visibleCount.value < resolvedReviews.value.length)
function loadMoreReviews() {
  visibleCount.value += reviewConfig.value.batchSize
}
```

- [ ] **Step 4: Persist the config**

In `persistWebsite`, add `reviewConfig` to both the edit branch and the create branch, next to
the four existing review fields:

```ts
          reviewConfig: props.reviews.config,
```

- [ ] **Step 5: Update the reviews summary card**

Replace the two count rows in the Reviews Summary `CardContent` (the `selectedReviewIds.length +
manualReviews.length` block) with:

```vue
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" class="text-[10px] px-1.5 py-0">
            {{ isAutoMode ? 'Auto' : 'Manual' }}
          </Badge>
          <Icon name="i-lucide-star" class="size-4 text-muted-foreground" />
          <span class="font-medium">{{ resolvedReviews.length + reviews.manualReviews.length }}</span>
          <span class="text-muted-foreground">
            {{ isAutoMode
              ? `review${resolvedReviews.length + reviews.manualReviews.length === 1 ? ' matches' : 's match'}`
              : `review${resolvedReviews.length + reviews.manualReviews.length === 1 ? '' : 's'} selected` }}
          </span>
        </div>
        <div v-if="isAutoMode" class="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span v-if="activeRules.length > 0">{{ activeRules.join(' · ') }}</span>
          <span v-else class="text-destructive">Every channel is switched off</span>
          <span>· {{ reviewConfig.batchSize }} per batch, no total limit</span>
        </div>
        <div v-if="sectionHidden" class="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <Icon name="i-lucide-eye-off" class="size-3.5 shrink-0 mt-0.5 text-amber-600" />
          <span>
            The reviews section stays hidden until at least
            {{ reviewConfig.minCountToShow }} reviews match.
          </span>
        </div>
```

Keep the existing featured-count row and manual-chip row below, unchanged.

- [ ] **Step 6: Add the reviews page preview**

Append this block inside the Reviews Summary `CardContent`, after the manual chips:

```vue
        <div v-if="visibleReviews.length > 0" class="space-y-3 border-t pt-3">
          <p class="text-xs font-medium text-muted-foreground">
            Reviews page preview
          </p>
          <div class="grid grid-cols-1 gap-3 @xl/main:grid-cols-2">
            <div
              v-for="r in visibleReviews"
              :key="r.id"
              data-testid="preview-review-card"
              class="rounded-lg border bg-card p-4"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium">{{ r.guest_name }}</span>
                <span class="text-sm font-semibold">
                  {{ getDisplayScore(r.guest_rating_overall, r.source) }}/{{ getDisplayMax(r.source) }}
                </span>
              </div>
              <p class="text-sm text-muted-foreground line-clamp-3">
                {{ r.guest_review_text || 'No written review' }}
              </p>
              <div class="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Icon :name="channelIcons[r.source]" class="size-3" />
                {{ channelLabels[r.source] }}
              </div>
            </div>
          </div>
          <button
            v-if="hasMoreReviews"
            type="button"
            data-testid="preview-load-more"
            class="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:bg-muted/50"
            @click="loadMoreReviews"
          >
            <Icon name="i-lucide-chevron-down" class="size-3" />
            Load more reviews
          </button>
        </div>
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/website-builder/PreviewStep-reviews.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 8: Commit**

```bash
git add app/components/website-builder/steps/PreviewStep.vue tests/website-builder/PreviewStep-reviews.spec.ts
git commit -m "feat(website-builder): preview the auto review pool with Load more"
```

---

## Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite**

Run: `npx vitest run`
Expected: PASS. If a Review Hub spec now fails on a Direct score, that is Task 1 working as
intended; update the expectation to the 5-point value.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: clean. Run `npm run format` to auto-fix, then re-run.

- [ ] **Step 4: Exercise the wizard by hand**

Run: `npm run dev`, then walk `/website-builder` → Create:

1. Pick a template, fill name and domain, select **Villa Sunset Bay**
2. The Reviews step opens in **Auto** with 5 matches and the breakdown `Airbnb 2 · Booking.com 1 · Direct 2`
3. Move Airbnb to `5+`: the count drops and the breakdown updates live
4. Switch Direct off: its rating select dims and its reviews leave the pool
5. Set every channel off: the amber warning appears and **Next** is disabled
6. Re-enable, open **Choose main page reviews**, star two reviews, then tighten a threshold so
   one of them drops out: the star count falls with it
7. Set the batch size to 2 and go to Preview: two cards plus **Load more reviews**, which appends
   two more per click and disappears at the end
8. Publish, reopen the website via Edit: it returns in Auto with the same rules
9. Switch to **Manual** and confirm the hand-picked list still works, now with no rating floor

- [ ] **Step 5: Update the module docs**

Add a Website Builder review-config entry to `CLAUDE.md` beside the other module notes: the
`Auto` / `Manual` mode, native-scale thresholds, `review-config.ts` as the single home for the
rules, and the `getDisplayScore` Direct fix.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe the website-builder review auto-show rules"
```
