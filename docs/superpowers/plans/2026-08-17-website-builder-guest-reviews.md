# Website Builder — Guest Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Reviews step to the Website Builder wizard so the property manager can pick which guest reviews (from Review Hub) appear on their website, set a minimum-rating filter, and add manual testimonials — with a live preview and persistence on the Website stub.

**Architecture:** A new `ReviewStep.vue` wizard step sits between Property and Preview. It filters `ReviewRecord`s by a `propertyListingMap` (property id → listing ids), excludes `is_hidden` records, applies a minimum-rating threshold, and lets the user check reviews or add manual testimonials. A `ReviewSelection` state object (`selectedReviewIds` + `manualReviews`) flows through the wizard via `v-model`, persists on the `Website` stub through `persistWebsite()`, and is restored in edit mode.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, TypeScript, shadcn-vue UI components, Tailwind CSS v4, Vitest, vue-sonner toasts.

---

### Task 1: Add property → listing mapping module

**Files:**
- Create: `app/components/website-builder/data/property-listings.ts`
- Test: `tests/website-builder/property-listings.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/website-builder/property-listings.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getListingsForProperty, propertyListingMap } from '../../app/components/website-builder/data/property-listings'

describe('propertyListingMap', () => {
  it('maps every property id to at least one listing id', () => {
    expect(Object.keys(propertyListingMap).length).toBeGreaterThan(0)
    for (const listings of Object.values(propertyListingMap)) {
      expect(listings.length).toBeGreaterThan(0)
    }
  })

  it('returns the mapped listings for a known property', () => {
    expect(getListingsForProperty('prop-1')).toEqual(['lst-1', 'lst-5'])
  })

  it('returns an empty array for an unknown property', () => {
    expect(getListingsForProperty('unknown')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/website-builder/property-listings.spec.ts`
Expected: FAIL — `Cannot find module .../property-listings`

- [ ] **Step 3: Write minimal implementation**

Create `app/components/website-builder/data/property-listings.ts`:

```ts
// Maps Website Builder mock properties (PropertyStep) to Review Hub listing ids.
// Configurable: extend this map as mock data grows.
export const propertyListingMap: Record<string, string[]> = {
  'prop-1': ['lst-1', 'lst-5'],   // Villa Sunset Bay
  'prop-2': ['lst-12'],           // Ubud Jungle Retreat
  'prop-3': ['lst-1', 'lst-12'],  // Beachfront Canggu Villa
  'prop-4': ['lst-5'],            // Cliffside Uluwatu
}

export function getListingsForProperty(propertyId: string | null): string[] {
  if (!propertyId) return []
  return propertyListingMap[propertyId] ?? []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/website-builder/property-listings.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/website-builder/property-listings.spec.ts app/components/website-builder/data/property-listings.ts
git commit -m "feat(website-builder): add property-to-listing mapping"
```

---

### Task 2: Extend Website stub with review fields

**Files:**
- Modify: `app/components/website-builder/data/websites.ts`
- Test: `tests/website-builder/property-listings.spec.ts` (already covers map; add website type smoke here)

- [ ] **Step 1: Write the failing type-level test**

Append to `tests/website-builder/property-listings.spec.ts`:

```ts
import type { Website } from '../../app/components/website-builder/data/websites'

describe('Website type', () => {
  it('accepts reviewIds and manualReviews', () => {
    const site: Website = {
      id: 'x',
      name: 'X',
      url: 'x.com',
      status: 'published',
      template: 'Luxury Villa',
      visits: 0,
      lastUpdated: '2026-01-01T00:00:00Z',
      thumbnail: null,
      reviewIds: ['rr-001'],
      manualReviews: [{ id: 'm1', guestName: 'G', rating: 9, text: 'Great', source: 'manual' }],
    }
    expect(site.reviewIds).toHaveLength(1)
    expect(site.manualReviews[0].guestName).toBe('G')
  })
})
```

- [ ] **Step 2: Run test to verify it fails (type error)**

Run: `pnpm vitest run tests/website-builder/property-listings.spec.ts`
Expected: FAIL — TS2322: `reviewIds` does not exist on type `Website`

- [ ] **Step 3: Implement — add optional fields to `Website`**

In `app/components/website-builder/data/websites.ts`, add `ManualReview` interface and extend `Website`:

```ts
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
  manualReviews?: ManualReview[]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/website-builder/property-listings.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/website-builder/property-listings.spec.ts app/components/website-builder/data/websites.ts
git commit -m "feat(website-builder): add review fields to Website stub"
```

---

### Task 3: Create ReviewStep.vue

**Files:**
- Create: `app/components/website-builder/steps/ReviewStep.vue`
- Modify: `app/components/website-builder/steps/PropertyStep.vue` (no change — only read)

- [ ] **Step 1: Write the component with full behavior**

Create `app/components/website-builder/steps/ReviewStep.vue`:

```vue
<script setup lang="ts">
import type { ReviewRecord, ReviewSource } from '~/components/review-hub/data/types'
import { getDisplayMax, getDisplayScore, channelLabels, channelIcons } from '~/components/review-hub/data/types'
import { useReviewHub } from '~/composables/useReviewHub'
import { getListingsForProperty } from '~/components/website-builder/data/property-listings'
import type { ManualReview } from '~/components/website-builder/data/websites'
import { toast } from 'vue-sonner'

export interface ReviewSelection {
  selectedReviewIds: string[]
  manualReviews: ManualReview[]
}

const props = defineProps<{
  modelValue: ReviewSelection
  propertyId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ReviewSelection]
  'next': []
  'back': []
}>()

const { reviewRecords } = useReviewHub()

const selectedReviewIds = ref<string[]>([...props.modelValue.selectedReviewIds])
const manualReviews = ref<ManualReview[]>([...props.modelValue.manualReviews])
const minRating = ref(8)

watch(() => props.modelValue, (val) => {
  selectedReviewIds.value = [...val.selectedReviewIds]
  manualReviews.value = [...val.manualReviews]
}, { deep: true })

watch(() => props.propertyId, () => {
  selectedReviewIds.value = []
  manualReviews.value = []
  emitUpdate()
})

function emitUpdate() {
  emit('update:modelValue', {
    selectedReviewIds: [...selectedReviewIds.value],
    manualReviews: [...manualReviews.value],
  })
}

const ratingOptions = [10, 9, 8, 7, 6]

const candidateReviews = computed<ReviewRecord[]>(() => {
  const listingIds = getListingsForProperty(props.propertyId)
  if (listingIds.length === 0) return []
  return reviewRecords.value.filter(r =>
    listingIds.includes(r.listing_id)
    && !r.is_hidden
    && (r.guest_rating_overall ?? 0) >= minRating.value,
  )
})

const selectedRecords = computed(() => {
  const ids = new Set(selectedReviewIds.value)
  return candidateReviews.value.filter(r => ids.has(r.id))
})

function toggleReview(id: string) {
  const idx = selectedReviewIds.value.indexOf(id)
  if (idx === -1) selectedReviewIds.value.push(id)
  else selectedReviewIds.value.splice(idx, 1)
  emitUpdate()
}

const allSelected = computed(() =>
  candidateReviews.value.length > 0 && candidateReviews.value.every(r => selectedReviewIds.value.includes(r.id)),
)

function selectAll() {
  selectedReviewIds.value = candidateReviews.value.map(r => r.id)
  emitUpdate()
}

function deselectAll() {
  selectedReviewIds.value = []
  emitUpdate()
}

// ── Manual review dialog ──
const manualDialogOpen = ref(false)
const manualForm = ref({ guestName: '', rating: 8, text: '' })

function openManualDialog() {
  manualForm.value = { guestName: '', rating: 8, text: '' }
  manualDialogOpen.value = true
}

function saveManualReview() {
  if (!manualForm.value.guestName.trim() || !manualForm.value.text.trim()) {
    toast.error('Guest name and review text are required')
    return
  }
  const manual: ManualReview = {
    id: `manual-${Date.now()}`,
    guestName: manualForm.value.guestName.trim(),
    rating: manualForm.value.rating,
    text: manualForm.value.text.trim(),
    source: 'manual',
  }
  manualReviews.value.push(manual)
  emitUpdate()
  manualDialogOpen.value = false
  toast.success('Manual review added')
}

function removeManualReview(id: string) {
  manualReviews.value = manualReviews.value.filter(m => m.id !== id)
  emitUpdate()
}

const totalSelected = computed(() => selectedReviewIds.value.length + manualReviews.value.length)
const isValid = computed(() => totalSelected.value > 0)

function handleNext() {
  if (isValid.value) emit('next')
}
function handleBack() {
  emit('back')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="text-lg font-semibold">
        Reviews
      </h3>
      <p class="text-sm text-muted-foreground">
        Choose which guest reviews appear on your website. Add your own testimonials if you like.
      </p>
    </div>

    <!-- Minimum rating filter -->
    <div class="flex items-center gap-3">
      <Label class="text-sm font-medium shrink-0">Minimum rating</Label>
      <Select :model-value="minRating" @update:model-value="minRating = $event as number">
        <SelectTrigger class="w-28">
          <SelectValue placeholder="Select rating" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="r in ratingOptions" :key="r" :value="r">
            {{ r }}+
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Available reviews -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <Label class="text-sm font-medium">Available Reviews</Label>
        <Button
          v-if="candidateReviews.length > 0"
          variant="ghost"
          size="sm"
          class="text-xs h-7"
          @click="allSelected ? deselectAll() : selectAll()"
        >
          <Icon :name="allSelected ? 'i-lucide-square' : 'i-lucide-check-square'" class="size-3.5 mr-1.5" />
          {{ allSelected ? 'Deselect All' : 'Select All' }}
        </Button>
      </div>

      <div v-if="candidateReviews.length > 0" class="grid grid-cols-1 gap-2 @xl/main:grid-cols-2">
        <div
          v-for="review in candidateReviews"
          :key="review.id"
          class="flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer hover:bg-muted/50"
          :class="{ 'bg-muted/30 border-primary/30': selectedReviewIds.includes(review.id) }"
          @click="toggleReview(review.id)"
        >
          <Checkbox
            :checked="selectedReviewIds.includes(review.id)"
            class="mt-0.5"
            @update:checked="toggleReview(review.id)"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">{{ review.guest_name }}</span>
              <Badge variant="secondary" class="text-[10px] px-1.5 py-0">
                {{ getDisplayScore(review.guest_rating_overall, review.source) }}/{{ getDisplayMax(review.source) }}
              </Badge>
              <Badge variant="outline" class="text-[10px] px-1.5 py-0">
                <Icon :name="channelIcons[review.source]" class="size-3 mr-0.5" />
                {{ channelLabels[review.source] }}
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {{ review.guest_review_text || 'No written review' }}
            </p>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 gap-2 text-muted-foreground">
        <Icon name="i-lucide-star" class="size-8" />
        <p class="text-sm">No reviews match. Add a manual testimonial below.</p>
      </div>
    </div>

    <!-- Add manual review -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium">Manual Reviews</p>
        <p class="text-xs text-muted-foreground">Testimonials you write yourself.</p>
      </div>
      <Button variant="outline" size="sm" @click="openManualDialog">
        <Icon name="i-lucide-plus" class="size-4 mr-1.5" />
        Add Manual Review
      </Button>
    </div>

    <!-- Manual review chips -->
    <div v-if="manualReviews.length > 0" class="flex flex-wrap gap-2">
      <div
        v-for="m in manualReviews"
        :key="m.id"
        class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
      >
        <Badge variant="secondary" class="text-[9px] px-1 py-0">{{ m.rating }}/10</Badge>
        <span class="font-medium">{{ m.guestName }}</span>
        <Badge variant="outline" class="text-[9px] px-1 py-0">Manual</Badge>
        <Button variant="ghost" size="icon-sm" class="size-5" @click="removeManualReview(m.id)">
          <Icon name="i-lucide-x" class="size-3" />
        </Button>
      </div>
    </div>

    <!-- Live preview -->
    <div v-if="totalSelected > 0" class="rounded-lg border bg-muted/30 p-4">
      <div class="flex items-center gap-2 mb-3">
        <Icon name="i-lucide-eye" class="size-4 text-muted-foreground" />
        <span class="text-sm font-medium">Website Preview</span>
        <span class="text-xs text-muted-foreground">{{ totalSelected }} testimonial{{ totalSelected !== 1 ? 's' : '' }}</span>
      </div>
      <div class="grid grid-cols-1 gap-3 @xl/main:grid-cols-2">
        <div v-for="r in selectedRecords" :key="r.id" class="rounded-lg border bg-card p-4">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium">{{ r.guest_name }}</span>
            <span class="text-sm font-semibold">{{ getDisplayScore(r.guest_rating_overall, r.source) }}/{{ getDisplayMax(r.source) }}</span>
          </div>
          <p class="text-sm text-muted-foreground line-clamp-3">
            {{ r.guest_review_text || 'No written review' }}
          </p>
          <div class="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Icon :name="channelIcons[r.source]" class="size-3" />
            {{ channelLabels[r.source] }}
          </div>
        </div>
        <div v-for="m in manualReviews" :key="m.id" class="rounded-lg border bg-card p-4">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium">{{ m.guestName }}</span>
            <span class="text-sm font-semibold">{{ m.rating }}/10</span>
          </div>
          <p class="text-sm text-muted-foreground line-clamp-3">{{ m.text }}</p>
          <div class="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Icon name="i-lucide-user-pen" class="size-3" />
            Manual
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <div class="flex items-center justify-between pt-2">
      <Button variant="ghost" @click="handleBack">
        <Icon name="i-lucide-arrow-left" class="size-4 mr-2" />
        Back
      </Button>
      <Button :disabled="!isValid" @click="handleNext">
        Next
        <Icon name="i-lucide-arrow-right" class="size-4 ml-2" />
      </Button>
    </div>

    <!-- Manual review dialog -->
    <Dialog v-model:open="manualDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Manual Review</DialogTitle>
          <DialogDescription>Write a testimonial to show on your website.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="manual-guest">Guest Name</Label>
            <Input id="manual-guest" v-model="manualForm.guestName" placeholder="e.g. Maria Schmidt" />
          </div>
          <div class="space-y-2">
            <Label for="manual-rating">Rating</Label>
            <Select v-model="manualForm.rating">
              <SelectTrigger id="manual-rating" class="w-full">
                <SelectValue placeholder="Select rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="n in [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]" :key="n" :value="n">
                  {{ n }}/10
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="manual-text">Review Text</Label>
            <Textarea id="manual-text" v-model="manualForm.text" placeholder="What did the guest love?" class="min-h-[100px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="manualDialogOpen = false">Cancel</Button>
          <Button @click="saveManualReview">Save Review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
```

Note: `useReviewHub()` is already used across the app; it returns `reviewRecords` as a `Ref<ReviewRecord[]>`. The `channelIcons[review.source]` uses `logos:airbnb`/`simple-icons:bookingdotcom` per project convention.

- [ ] **Step 2: Run lint**

Run: `pnpm exec eslint app/components/website-builder/steps/ReviewStep.vue`
Expected: PASS (0 errors). If import-order errors appear, reorder: internal `~/...` type imports first, then `vue-sonner`.

- [ ] **Step 3: Commit**

```bash
git add app/components/website-builder/steps/ReviewStep.vue
git commit -m "feat(website-builder): add Reviews step with picker and manual testimonials"
```

---

### Task 4: Wire Reviews step into the wizard

**Files:**
- Modify: `app/pages/website-builder/create.vue`

- [ ] **Step 1: Update script — state, step list, navigation, edit prefill**

In `app/pages/website-builder/create.vue`:

```ts
import type { PropertySelection } from '~/components/website-builder/steps/PropertyStep.vue'
import type { WebsiteSettings } from '~/components/website-builder/steps/SettingsStep.vue'
import type { Template } from '~/components/website-builder/steps/TemplateStep.vue'
import type { ReviewSelection } from '~/components/website-builder/steps/ReviewStep.vue'
import { websites } from '~/components/website-builder/data/websites'
```

Add to `STEPS` (after `property`):

```ts
const STEPS = [
  { key: 'template', label: 'Template', icon: 'i-lucide-layout-template' },
  { key: 'settings', label: 'Settings', icon: 'i-lucide-settings' },
  { key: 'property', label: 'Property', icon: 'i-lucide-home' },
  { key: 'reviews', label: 'Reviews', icon: 'i-lucide-star' },
  { key: 'preview', label: 'Preview', icon: 'i-lucide-eye' },
] as const
```

Add state (after `propertySelection`):

```ts
const reviewSelection = ref<ReviewSelection>({
  selectedReviewIds: [],
  manualReviews: [],
})
```

In the edit-mode prefill block, restore reviews:

```ts
if (import.meta.client && editingWebsite.value) {
  const site = editingWebsite.value
  // ...existing settings/template prefill...
  reviewSelection.value = {
    selectedReviewIds: site.reviewIds ?? [],
    manualReviews: site.manualReviews ?? [],
  }
  currentStep.value = 1
}
```

Update `goNext()`:

```ts
function goNext() {
  if (currentStep.value === 0 && selectedTemplate.value) {
    currentStep.value = 1
  }
  else if (currentStep.value === 1 && websiteSettings.value.name && websiteSettings.value.domain) {
    currentStep.value = 2
  }
  else if (currentStep.value === 2 && propertySelection.value.propertyId && propertySelection.value.roomIds.length > 0) {
    currentStep.value = 3
  }
  else if (currentStep.value === 3 && (reviewSelection.value.selectedReviewIds.length > 0 || reviewSelection.value.manualReviews.length > 0)) {
    currentStep.value = 4
  }
}
```

- [ ] **Step 2: Update template — render Reviews step, shift Preview**

Replace the PreviewStep block (currently `v-else-if="currentStep === 3"`) with:

```vue
      <!-- Step 4: Reviews -->
      <WebsiteBuilderStepsReviewStep
        v-else-if="currentStep === 3"
        v-model="reviewSelection"
        :property-id="propertySelection.propertyId"
        @next="goNext"
        @back="goBack"
      />

      <!-- Step 5: Preview & Publish -->
      <WebsiteBuilderStepsPreviewStep
        v-else-if="currentStep === 4"
        :template="selectedTemplate"
        :settings="websiteSettings"
        :property="propertySelection"
        :reviews="reviewSelection"
        @back="goBack"
        @go-to-step="(s: number) => currentStep = s"
      />
```

- [ ] **Step 3: Run lint**

Run: `pnpm exec eslint app/pages/website-builder/create.vue`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/pages/website-builder/create.vue
git commit -m "feat(website-builder): wire Reviews step into wizard"
```

---

### Task 5: PreviewStep — accept reviews, show summary, persist

**Files:**
- Modify: `app/components/website-builder/steps/PreviewStep.vue`

- [ ] **Step 1: Add `reviews` prop + type import**

At the top of the script, add to imports and props:

```ts
import type { ReviewSelection } from '~/components/website-builder/steps/ReviewStep.vue'
```

```ts
const props = defineProps<{
  template: Template | null
  settings: WebsiteSettings
  property: PropertySelection
  reviews: ReviewSelection
}>()
```

- [ ] **Step 2: Persist review fields in `persistWebsite`**

Edit mode branch — add after `lastUpdated`:

```ts
websites.value[index] = {
  ...existing,
  name: props.settings.name,
  url: props.settings.domain,
  status,
  template: props.template?.name ?? existing.template,
  lastUpdated: new Date().toISOString(),
  reviewIds: props.reviews.selectedReviewIds,
  manualReviews: props.reviews.manualReviews,
}
```

Create branch — add to the pushed stub:

```ts
websites.value.push({
  id: String(Date.now()),
  name: props.settings.name,
  url: props.settings.domain,
  status,
  template: props.template?.name ?? 'Luxury Villa',
  visits: 0,
  lastUpdated: new Date().toISOString(),
  thumbnail: null,
  reviewIds: props.reviews.selectedReviewIds,
  manualReviews: props.reviews.manualReviews,
})
```

- [ ] **Step 3: Add a Reviews summary card in the template**

Insert after the "Selected Content" card's closing `</Card>` (before the Navigation div):

```vue
    <!-- Reviews Summary -->
    <Card>
      <CardHeader class="pb-3">
        <div class="flex items-center justify-between">
          <CardTitle class="text-base">
            Guest Reviews
          </CardTitle>
          <Button variant="ghost" size="sm" class="text-xs h-7" @click="emit('goToStep', 3)">
            <Icon name="i-lucide-pencil" class="size-3 mr-1" />
            Edit
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-3">
        <div class="flex items-center gap-2 text-sm">
          <Icon name="i-lucide-star" class="size-4 text-muted-foreground" />
          <span class="font-medium">{{ reviews.selectedReviewIds.length + reviews.manualReviews.length }}</span>
          <span class="text-muted-foreground">review{{ reviews.selectedReviewIds.length + reviews.manualReviews.length !== 1 ? 's' : '' }} selected</span>
        </div>
        <div v-if="reviews.manualReviews.length > 0" class="flex flex-wrap gap-2">
          <div
            v-for="m in reviews.manualReviews"
            :key="m.id"
            class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
          >
            <Badge variant="secondary" class="text-[9px] px-1 py-0">{{ m.rating }}/10</Badge>
            <span class="font-medium">{{ m.guestName }}</span>
            <Badge variant="outline" class="text-[9px] px-1 py-0">Manual</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
```

- [ ] **Step 4: Run lint**

Run: `pnpm exec eslint app/components/website-builder/steps/PreviewStep.vue`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/website-builder/steps/PreviewStep.vue
git commit -m "feat(website-builder): show and persist selected reviews in preview"
```

---

### Task 6: Typecheck + full verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run unit tests**

Run: `pnpm vitest run tests/website-builder/property-listings.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 2: Run typecheck filtered to website-builder + review-hub**

Run: `pnpm exec vue-tsc --noEmit 2>&1 | grep -E "website-builder|review-hub" || echo "No website-builder/review-hub type errors"`
Expected: no new errors (pre-existing SettingsStep errors are known and unrelated)

- [ ] **Step 3: Run ESLint on all changed files**

Run: `pnpm exec eslint app/pages/website-builder/create.vue app/components/website-builder/steps/PreviewStep.vue app/components/website-builder/steps/ReviewStep.vue app/components/website-builder/data/websites.ts app/components/website-builder/data/property-listings.ts`
Expected: 0 errors

- [ ] **Step 4: Manual smoke via dev server**

Run: `pnpm dev` (background), then:

1. Visit `/website-builder` → click **Create Website**.
2. Template → Next; Settings → fill name + domain → Next; Property → select a property → Next.
3. On **Reviews** step: verify reviews shown are only for the mapped listing(s), min-rating filter works, `is_hidden` records absent.
4. Select some reviews + add a manual review → verify live preview updates.
5. Next → verify **Guest Reviews** summary card in PreviewStep → Publish Website.
6. Return to `/website-builder` → verify the new card appears.
7. Click **Edit** on it → navigate to Reviews step → verify selections restored.
8. Check dev log for `Failed to resolve component` or Vue warnings.

Stop the dev server when done.

---

## Self-Review

- **Spec coverage:** property→listing mapping (Task 1), Website stub fields (Task 2), ReviewStep picker + min rating + hidden exclusion + manual reviews + live preview (Task 3), wizard wiring + edit prefill (Task 4), PreviewStep summary + persistence (Task 5), verification (Task 6). All spec sections covered.
- **Placeholder scan:** No TBD/TODO; every step has concrete code or exact commands.
- **Type consistency:** `ReviewSelection` (`selectedReviewIds`, `manualReviews`), `ManualReview` (`id`, `guestName`, `rating`, `text`, `source`), `getListingsForProperty`, `Website.reviewIds?/manualReviews?` — consistent across Tasks 2–5.
