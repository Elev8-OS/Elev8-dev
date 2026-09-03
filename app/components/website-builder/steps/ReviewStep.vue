<script setup lang="ts">
import type { ReviewRecord, ReviewSource } from '~/components/review-hub/data/types'
import type { AutoReviewStats, WebsiteReviewConfig } from '~/components/website-builder/data/review-config'
import type { ManualReview } from '~/components/website-builder/data/websites'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { channelIcons, channelLabels, getDisplayMax, getDisplayScore } from '~/components/review-hub/data/types'
import { getListingsForProperties, propertyNames } from '~/components/website-builder/data/property-listings'
import {
  autoReviewStats,
  cloneReviewConfig,
  createDefaultReviewConfig,
  resolveAutoReviews,
} from '~/components/website-builder/data/review-config'
import { useReviewHub } from '~/composables/useReviewHub'

export interface ReviewSelection {
  selectedReviewIds: string[]
  featuredReviewIds: string[]
  manualReviews: ManualReview[]
  featuredManualReviewIds: string[]
  config: WebsiteReviewConfig
}

const props = defineProps<{
  modelValue: ReviewSelection
  propertyIds: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ReviewSelection]
  'next': []
  'back': []
}>()

const { reviewRecords } = useReviewHub()

const selectedReviewIds = ref<string[]>([...props.modelValue.selectedReviewIds])
const featuredReviewIds = ref<string[]>([...props.modelValue.featuredReviewIds])
const manualReviews = ref<ManualReview[]>([...props.modelValue.manualReviews])
const featuredManualReviewIds = ref<string[]>([...props.modelValue.featuredManualReviewIds])
const config = ref<WebsiteReviewConfig>(
  cloneReviewConfig(props.modelValue.config ?? createDefaultReviewConfig()),
)
const isAuto = computed(() => config.value.mode === 'auto')

watch(() => props.modelValue, (val) => {
  selectedReviewIds.value = [...val.selectedReviewIds]
  featuredReviewIds.value = [...val.featuredReviewIds]
  manualReviews.value = [...val.manualReviews]
  featuredManualReviewIds.value = [...val.featuredManualReviewIds]
  config.value = cloneReviewConfig(val.config ?? createDefaultReviewConfig())
}, { deep: true })

watch(() => props.propertyIds, () => {
  selectedReviewIds.value = []
  featuredReviewIds.value = []
  manualReviews.value = []
  featuredManualReviewIds.value = []
  resetVisibleCounts()
  emitUpdate()
}, { deep: true })

function emitUpdate() {
  emit('update:modelValue', {
    selectedReviewIds: [...selectedReviewIds.value],
    featuredReviewIds: [...featuredReviewIds.value],
    manualReviews: [...manualReviews.value],
    featuredManualReviewIds: [...featuredManualReviewIds.value],
    config: cloneReviewConfig(config.value),
  })
}

function toggleFeatured(id: string) {
  const idx = featuredReviewIds.value.indexOf(id)
  if (idx === -1)
    featuredReviewIds.value.push(id)
  else featuredReviewIds.value.splice(idx, 1)
  emitUpdate()
}

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

const selectedRecords = computed(() => {
  const ids = new Set(selectedReviewIds.value)
  return candidateReviews.value.filter(r => ids.has(r.id))
})

// Whichever list is authoritative for the current mode — this is also what actually
// publishes, so pruning against it (rather than special-casing Auto) keeps a mode switch
// in sync too, not just a rule change within Auto.
const featuredPool = computed(() => (isAuto.value ? autoReviews.value : selectedRecords.value))

// A rule change, a mode switch, or losing a pick can each drop a review that was featured
// on the main page. Leaving a stale id in place would publish a review that mode no longer
// allows. The length guard keeps this from re-emitting once the id is already gone (e.g.
// `toggleReview` already pruned it) and stops the watcher from looping.
watch(featuredPool, () => {
  const pool = new Set(featuredPool.value.map(r => r.id))
  const pruned = featuredReviewIds.value.filter(id => pool.has(id))
  if (pruned.length !== featuredReviewIds.value.length) {
    featuredReviewIds.value = pruned
    emitUpdate()
  }
})

// Group candidate reviews by property (a review's listing maps back to its property)
interface ReviewGroup {
  propertyId: string
  propertyName: string
  reviews: ReviewRecord[]
}

const reviewGroups = computed<ReviewGroup[]>(() => {
  return props.propertyIds.map((propertyId) => {
    const listings = getListingsForProperties([propertyId])
    return {
      propertyId,
      propertyName: propertyNames[propertyId] ?? propertyId,
      reviews: candidateReviews.value.filter(r => listings.includes(r.listing_id)),
    }
  })
})

function allSelectedForGroup(group: ReviewGroup): boolean {
  return group.reviews.length > 0 && group.reviews.every(r => selectedReviewIds.value.includes(r.id))
}

function toggleAllForGroup(group: ReviewGroup) {
  const ids = group.reviews.map(r => r.id)
  const allSelected = allSelectedForGroup(group)
  if (allSelected) {
    const removeSet = new Set(ids)
    selectedReviewIds.value = selectedReviewIds.value.filter(id => !removeSet.has(id))
    featuredReviewIds.value = featuredReviewIds.value.filter(id => !removeSet.has(id))
  }
  else {
    const currentSet = new Set(selectedReviewIds.value)
    for (const id of ids) {
      if (!currentSet.has(id))
        selectedReviewIds.value.push(id)
    }
  }
  emitUpdate()
}

function toggleReview(id: string) {
  const idx = selectedReviewIds.value.indexOf(id)
  if (idx === -1) {
    selectedReviewIds.value.push(id)
  }
  else {
    selectedReviewIds.value.splice(idx, 1)
    const fIdx = featuredReviewIds.value.indexOf(id)
    if (fIdx !== -1)
      featuredReviewIds.value.splice(fIdx, 1)
  }
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
  featuredReviewIds.value = []
  emitUpdate()
}

const manualDialogOpen = ref(false)
const manualForm = ref({ guestName: '', rating: 8, text: '', listingId: '', channel: 'airbnb' as ReviewSource })

// Listings available for manual reviews = those mapped to the selected properties
const manualListingOptions = computed(() => {
  return listings.value.filter(l => listingIds.value.includes(l.id))
})

const channelOptions: { value: ReviewSource, label: string, icon: string }[] = [
  { value: 'airbnb', label: 'Airbnb', icon: 'logos:airbnb' },
  { value: 'booking_com', label: 'Booking.com', icon: 'simple-icons:bookingdotcom' },
  { value: 'direct', label: 'Direct', icon: 'lucide:globe' },
]

function openManualDialog() {
  manualForm.value = {
    guestName: '',
    rating: 8,
    text: '',
    listingId: manualListingOptions.value[0]?.id ?? '',
    channel: 'airbnb',
  }
  manualDialogOpen.value = true
}

function saveManualReview() {
  if (!manualForm.value.guestName.trim() || !manualForm.value.text.trim() || !manualForm.value.listingId) {
    toast.error('Guest name, listing and review text are required')
    return
  }
  const manual: ManualReview = {
    id: `manual-${Date.now()}`,
    guestName: manualForm.value.guestName.trim(),
    rating: manualForm.value.rating,
    text: manualForm.value.text.trim(),
    source: 'manual',
    listingId: manualForm.value.listingId,
    channel: manualForm.value.channel,
  }
  manualReviews.value.push(manual)
  emitUpdate()
  manualDialogOpen.value = false
  toast.success('Manual review added')
}

function listingName(listingId: string): string {
  return listings.value.find(l => l.id === listingId)?.name ?? listingId
}

function removeManualReview(id: string) {
  manualReviews.value = manualReviews.value.filter(m => m.id !== id)
  const fIdx = featuredManualReviewIds.value.indexOf(id)
  if (fIdx !== -1)
    featuredManualReviewIds.value.splice(fIdx, 1)
  emitUpdate()
}

function toggleFeaturedManual(id: string) {
  const idx = featuredManualReviewIds.value.indexOf(id)
  if (idx === -1)
    featuredManualReviewIds.value.push(id)
  else featuredManualReviewIds.value.splice(idx, 1)
  emitUpdate()
}

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

const previewOpen = ref(false)
const mainPageOpen = ref(false)

// ── Property filter + collapse (scale for many properties) ───────
const activePropertyFilter = ref<'all' | string>('all')
const collapsedProperties = ref<Set<string>>(new Set())

const filteredGroups = computed(() => {
  if (activePropertyFilter.value === 'all')
    return reviewGroups.value
  return reviewGroups.value.filter(g => g.propertyId === activePropertyFilter.value)
})

watch(activePropertyFilter, () => {
  resetVisibleCounts()
})

function toggleGroupCollapsed(propertyId: string) {
  const next = new Set(collapsedProperties.value)
  if (next.has(propertyId))
    next.delete(propertyId)
  else next.add(propertyId)
  collapsedProperties.value = next
}

function selectedCountFor(group: ReviewGroup): number {
  const ids = new Set(selectedReviewIds.value)
  return group.reviews.filter(r => ids.has(r.id)).length
}

// Per-group "show more" pagination (scale for many reviews)
const GROUP_PAGE_SIZE = 8
const visibleCounts = ref<Record<string, number>>({})

function visibleReviewsFor(group: ReviewGroup): ReviewRecord[] {
  const limit = visibleCounts.value[group.propertyId] ?? GROUP_PAGE_SIZE
  return group.reviews.slice(0, limit)
}

function showMoreFor(group: ReviewGroup) {
  const current = visibleCounts.value[group.propertyId] ?? GROUP_PAGE_SIZE
  visibleCounts.value = {
    ...visibleCounts.value,
    [group.propertyId]: current + GROUP_PAGE_SIZE,
  }
}

function resetVisibleCounts() {
  visibleCounts.value = {}
}

function handleNext() {
  if (isValid.value)
    emit('next')
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
                name="i-lucide-star"
                class="size-3"
              />
              Main Page
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Toolbar: filter + global actions -->
    <div v-if="!isAuto" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">
      <div class="flex items-center gap-3">
        <Label class="text-sm font-medium shrink-0">Property</Label>
        <Select :model-value="activePropertyFilter" @update:model-value="activePropertyFilter = $event as string">
          <SelectTrigger class="w-48">
            <SelectValue placeholder="All properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All properties
            </SelectItem>
            <SelectItem v-for="group in reviewGroups" :key="group.propertyId" :value="group.propertyId">
              {{ group.propertyName }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div v-if="candidateReviews.length > 0" class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          class="text-xs h-7"
          @click="allSelected ? deselectAll() : selectAll()"
        >
          <Icon :name="allSelected ? 'i-lucide-square' : 'i-lucide-check-square'" class="size-3.5 mr-1" />
          {{ allSelected ? 'Deselect All' : 'Select All' }}
        </Button>
      </div>
    </div>

    <!-- Manual review add button (visible in both modes) -->
    <div class="flex justify-end">
      <Button variant="outline" size="sm" class="text-xs h-7" @click="openManualDialog">
        <Icon name="i-lucide-plus" class="size-3.5 mr-1" />
        Manual Review
      </Button>
    </div>

    <!-- Manual review chips (inline) -->
    <div v-if="manualReviews.length > 0" class="flex flex-wrap gap-2">
      <div
        v-for="m in manualReviews"
        :key="m.id"
        class="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
      >
        <Badge variant="secondary" class="text-[9px] px-1 py-0">
          {{ m.rating }}/10
        </Badge>
        <span class="font-medium">{{ m.guestName }}</span>
        <span class="text-muted-foreground truncate max-w-[180px]">{{ listingName(m.listingId) }}</span>
        <Badge variant="outline" class="text-[9px] px-1 py-0">
          <Icon :name="channelIcons[m.channel]" class="size-3 mr-0.5" />
          {{ channelLabels[m.channel] }}
        </Badge>
        <Badge variant="outline" class="text-[9px] px-1 py-0">
          Manual
        </Badge>
        <!-- Featured (main page) toggle for manual reviews -->
        <button
          type="button"
          class="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors"
          :class="featuredManualReviewIds.includes(m.id)
            ? 'bg-primary text-primary-foreground border-primary'
            : 'text-muted-foreground hover:bg-muted/50'"
          :title="featuredManualReviewIds.includes(m.id) ? 'Shown on main page' : 'Click to feature on main page'"
          @click="toggleFeaturedManual(m.id)"
        >
          <Icon
            name="i-lucide-star"
            class="size-3"
          />
          Main Page
        </button>
        <Button variant="ghost" size="icon-sm" class="size-5" @click="removeManualReview(m.id)">
          <Icon name="i-lucide-x" class="size-3" />
        </Button>
      </div>
    </div>

    <!-- Review list, grouped by property -->
    <div v-if="!isAuto && candidateReviews.length > 0" class="space-y-2">
      <div
        v-for="group in filteredGroups"
        :key="group.propertyId"
        class="rounded-lg border"
        :class="collapsedProperties.has(group.propertyId) ? 'bg-muted/20' : ''"
      >
        <!-- Group header (click to collapse/expand) -->
        <div class="flex items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            class="flex items-center gap-2 min-w-0 flex-1 text-left"
            @click="toggleGroupCollapsed(group.propertyId)"
          >
            <Icon
              :name="collapsedProperties.has(group.propertyId) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
              class="size-4 shrink-0 text-muted-foreground"
            />
            <span class="text-sm font-medium truncate">{{ group.propertyName }}</span>
            <span class="text-xs text-muted-foreground shrink-0">
              {{ selectedCountFor(group) }}/{{ group.reviews.length }} selected
            </span>
          </button>
          <Button
            v-if="group.reviews.length > 0"
            variant="ghost"
            size="sm"
            class="text-xs h-6 px-2 shrink-0"
            @click.stop="toggleAllForGroup(group)"
          >
            <Icon
              :name="allSelectedForGroup(group) ? 'i-lucide-square' : 'i-lucide-check-square'"
              class="size-3 mr-1"
            />
            {{ allSelectedForGroup(group) ? 'Deselect All' : 'Select All' }}
          </Button>
        </div>

        <!-- Group content (hidden when collapsed) -->
        <div v-show="!collapsedProperties.has(group.propertyId)" class="space-y-1.5 border-t px-3 py-2">
          <div
            v-for="review in visibleReviewsFor(group)"
            :key="review.id"
            class="flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors hover:bg-muted/50"
            :class="{ 'bg-muted/30 border-primary/30': selectedReviewIds.includes(review.id) }"
            @click="toggleReview(review.id)"
          >
            <Checkbox
              :checked="selectedReviewIds.includes(review.id)"
              class="shrink-0"
              @update:checked="toggleReview(review.id)"
            />
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
            <!-- Featured (main page) toggle — only for selected reviews -->
            <button
              v-if="selectedReviewIds.includes(review.id)"
              type="button"
              class="shrink-0 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors"
              :class="featuredReviewIds.includes(review.id)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'text-muted-foreground hover:bg-muted/50'"
              :title="featuredReviewIds.includes(review.id) ? 'Shown on main page' : 'Click to feature on main page'"
              @click.stop="toggleFeatured(review.id)"
            >
              <Icon
                name="i-lucide-star"
                class="size-3"
              />
              Main Page
            </button>
          </div>

          <!-- Show more / hidden count -->
          <button
            v-if="visibleReviewsFor(group).length < group.reviews.length"
            type="button"
            class="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
            @click="showMoreFor(group)"
          >
            <Icon name="i-lucide-chevron-down" class="size-3" />
            Show {{ group.reviews.length - visibleReviewsFor(group).length }} more
          </button>

          <p v-if="group.reviews.length === 0" class="text-xs text-muted-foreground py-1">
            No reviews for this property yet.
          </p>
        </div>
      </div>
    </div>

    <div v-else-if="!isAuto" class="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 gap-2 text-muted-foreground">
      <Icon name="i-lucide-star" class="size-8" />
      <p class="text-sm">
        No reviews match. Add a manual testimonial above.
      </p>
    </div>

    <!-- Collapsible live preview -->
    <div v-if="totalSelected > 0" class="rounded-lg border">
      <button
        type="button"
        class="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium"
        @click="previewOpen = !previewOpen"
      >
        <Icon name="i-lucide-eye" class="size-4 text-muted-foreground" />
        Website Preview
        <span class="text-xs text-muted-foreground font-normal">{{ totalSelected }} {{ isAuto ? 'matching' : 'selected' }}</span>
        <span v-if="featuredCount > 0" class="flex items-center gap-1 text-xs font-medium text-primary">
          <Icon name="i-lucide-star" class="size-3" />
          {{ featuredCount }} on main page
        </span>
        <Icon
          :name="previewOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="size-4 ml-auto text-muted-foreground"
        />
      </button>
      <div v-if="previewOpen" class="grid grid-cols-1 gap-3 border-t p-4 @xl/main:grid-cols-2">
        <div v-for="r in featuredPool" :key="r.id" class="rounded-lg border bg-card p-4">
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
            <Badge
              v-if="featuredReviewIds.includes(r.id)"
              class="ml-auto text-[9px] px-1.5 py-0"
            >
              <Icon name="i-lucide-star" class="size-2.5 mr-0.5" />
              Main Page
            </Badge>
          </div>
        </div>
        <div v-for="m in manualReviews" :key="m.id" class="rounded-lg border bg-card p-4">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium">{{ m.guestName }}</span>
            <span class="text-sm font-semibold">{{ m.rating }}/10</span>
          </div>
          <p class="text-sm text-muted-foreground line-clamp-3">
            {{ m.text }}
          </p>
          <div class="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Icon :name="channelIcons[m.channel]" class="size-3" />
            {{ channelLabels[m.channel] }} · {{ listingName(m.listingId) }}
            <Badge
              v-if="featuredManualReviewIds.includes(m.id)"
              class="ml-auto text-[9px] px-1.5 py-0"
            >
              <Icon name="i-lucide-star" class="size-2.5 mr-0.5" />
              Main Page
            </Badge>
          </div>
        </div>
      </div>
    </div>

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
            <Label for="manual-listing">Listing</Label>
            <Select v-model="manualForm.listingId">
              <SelectTrigger id="manual-listing" class="w-full">
                <SelectValue placeholder="Select listing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="l in manualListingOptions" :key="l.id" :value="l.id">
                  {{ l.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="manual-channel">Channel</Label>
            <Select v-model="manualForm.channel">
              <SelectTrigger id="manual-channel" class="w-full">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="c in channelOptions" :key="c.value" :value="c.value">
                  <span class="flex items-center gap-2">
                    <Icon :name="c.icon" class="size-3.5" />
                    {{ c.label }}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
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
          <Button variant="outline" @click="manualDialogOpen = false">
            Cancel
          </Button>
          <Button @click="saveManualReview">
            Save Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
