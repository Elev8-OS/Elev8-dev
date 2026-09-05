<script setup lang="ts">
import type { ReviewRecord, ReviewSource } from '~/components/review-hub/data/types'
import type { AutoReviewStats, WebsiteReviewConfig } from '~/components/website-builder/data/review-config'
import type { ManualReview } from '~/components/website-builder/data/websites'
import type { ReviewCardData } from '~/components/website-builder/ReviewPickerCard.vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { channelLabels, getDisplayMax, getDisplayScore } from '~/components/review-hub/data/types'
import { getListingsForProperties, propertyNames } from '~/components/website-builder/data/property-listings'
import {
  autoReviewStats,
  cloneReviewConfig,
  compareByReceivedDesc,
  createDefaultReviewConfig,
  excludedIds,
  nativeToNormalized,
  resolveAutoReviews,
  resolveRuleMatches,
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
const manualReviews = ref<ManualReview[]>([...props.modelValue.manualReviews])
const config = ref<WebsiteReviewConfig>(
  cloneReviewConfig(props.modelValue.config ?? createDefaultReviewConfig()),
)
const isAuto = computed(() => config.value.mode === 'auto')

watch(() => props.modelValue, (val) => {
  selectedReviewIds.value = [...val.selectedReviewIds]
  manualReviews.value = [...val.manualReviews]
  config.value = cloneReviewConfig(val.config ?? createDefaultReviewConfig())
}, { deep: true })

watch(() => props.propertyIds, () => {
  selectedReviewIds.value = []
  manualReviews.value = []
  // Exclusions are ids from the old scope; the rules survive a property change, they do not.
  config.value = { ...cloneReviewConfig(config.value), excludedReviewIds: [] }
  resetFilters()
  emitUpdate()
}, { deep: true })

const listingIds = computed(() => getListingsForProperties(props.propertyIds))

// Manual mode: everything in scope except Airbnb double-blind reviews. No rating floor,
// because the score is on every card and picking is the point of this mode.
const candidateReviews = computed<ReviewRecord[]>(() => {
  if (listingIds.value.length === 0)
    return []
  return reviewRecords.value.filter(r =>
    listingIds.value.includes(r.listing_id) && !r.is_hidden,
  )
})

// Auto mode. Two pools, deliberately: the rules admit `ruleMatches`, and the host can hide
// individual ones from there. The picker lists the matches — a hidden review has to stay on
// screen, unticked, or it could never be brought back — while `autoReviews` is what
// publishes.
const ruleMatches = computed<ReviewRecord[]>(() =>
  resolveRuleMatches(reviewRecords.value, listingIds.value, config.value),
)

const excludedReviewIds = computed(() => excludedIds(config.value))

const autoReviews = computed<ReviewRecord[]>(() =>
  resolveAutoReviews(reviewRecords.value, listingIds.value, config.value),
)

/** Hiding is stored on the config, so it travels with the rules into `Website.reviewConfig`. */
function setExcluded(ids: string[]) {
  config.value = { ...cloneReviewConfig(config.value), excludedReviewIds: [...ids] }
  emitUpdate()
}

function toggleExcluded(id: string) {
  const current = excludedReviewIds.value
  setExcluded(current.includes(id) ? current.filter(x => x !== id) : [...current, id])
}

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
  resetFilters()
  emitUpdate()
}

const selectedRecords = computed(() => {
  const ids = new Set(selectedReviewIds.value)
  return candidateReviews.value.filter(r => ids.has(r.id)).sort(compareByReceivedDesc)
})

// Whichever list is authoritative for the current mode — this is what publishes, and
// therefore also what the home page shows. Deriving the featured ids from it means a rule
// change, a mode switch or a dropped pick can never leave a stale id behind.
const featuredPool = computed(() => (isAuto.value ? autoReviews.value : selectedRecords.value))

// Every review the website publishes is also shown on the home page, so the featured ids
// are derived here rather than starred one by one. They stay in the payload because the
// published site and `Website.featuredReviewIds` still read them.
function emitUpdate() {
  emit('update:modelValue', {
    selectedReviewIds: [...selectedReviewIds.value],
    featuredReviewIds: featuredPool.value.map(r => r.id),
    manualReviews: [...manualReviews.value],
    featuredManualReviewIds: manualReviews.value.map(m => m.id),
    config: cloneReviewConfig(config.value),
  })
}

// ── Browsing the pool: search, filter, sort, then paginate ───────
// One flat list beats collapsible per-property groups here: each card names its own
// listing, so a property becomes just another filter instead of a section to open.
type SortKey = 'newest' | 'highest'

const search = ref('')
const propertyFilter = ref<'all' | string>('all')
const channelFilter = ref<'all' | ReviewSource>('all')
const sortBy = ref<SortKey>('newest')
const onlyWithText = ref(false)
const PAGE_SIZE = 10
const currentPage = ref(1)

function resetFilters() {
  search.value = ''
  propertyFilter.value = 'all'
  channelFilter.value = 'all'
  sortBy.value = 'newest'
  onlyWithText.value = false
  currentPage.value = 1
}

const propertyOptions = computed(() =>
  props.propertyIds.map(id => ({ id, name: propertyNames[id] ?? id })),
)

const filterListingIds = computed(() =>
  propertyFilter.value === 'all' ? null : getListingsForProperties([propertyFilter.value]),
)

/** What the picker lists, before any browsing filter — not what publishes. */
const modePool = computed(() => (isAuto.value ? ruleMatches.value : candidateReviews.value))

const filteredPool = computed(() => {
  const term = search.value.trim().toLowerCase()
  const scope = filterListingIds.value
  const rows = modePool.value.filter((r) => {
    if (scope && !scope.includes(r.listing_id))
      return false
    if (channelFilter.value !== 'all' && r.source !== channelFilter.value)
      return false
    if (onlyWithText.value && !(r.guest_review_text ?? '').trim())
      return false
    if (term) {
      const haystack = `${r.guest_name} ${r.guest_review_text ?? ''} ${r.listing_name}`.toLowerCase()
      if (!haystack.includes(term))
        return false
    }
    return true
  })
  return sortBy.value === 'highest'
    ? [...rows].sort((a, b) => (b.guest_rating_overall ?? -1) - (a.guest_rating_overall ?? -1))
    : [...rows].sort(compareByReceivedDesc)
})

/** Hidden among what the filters currently show — the number the status line reports. */
const hiddenInView = computed(() =>
  filteredPool.value.filter(r => excludedReviewIds.value.includes(r.id)).length,
)

const totalPages = computed(() => Math.max(1, Math.ceil(filteredPool.value.length / PAGE_SIZE)))

const visiblePool = computed(() =>
  filteredPool.value.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE),
)

/** "Showing 1-10 of 34 reviews" — a page range, not just a count, once there is more than one page. */
const rangeLabel = computed(() => {
  const total = filteredPool.value.length
  if (total === 0)
    return 'No reviews match'
  const start = (currentPage.value - 1) * PAGE_SIZE + 1
  const end = Math.min(currentPage.value * PAGE_SIZE, total)
  const range = start === end ? `${start}` : `${start}-${end}`
  return `Showing ${range} of ${total} review${total === 1 ? '' : 's'}`
})

// A tightened rule or a narrower filter can leave the host stranded past the last page.
watch(totalPages, () => {
  if (currentPage.value > totalPages.value)
    currentPage.value = totalPages.value
})

const hasActiveFilters = computed(() =>
  search.value.trim() !== ''
  || propertyFilter.value !== 'all'
  || channelFilter.value !== 'all'
  || onlyWithText.value,
)

watch([search, propertyFilter, channelFilter, sortBy, onlyWithText], () => {
  currentPage.value = 1
})

// ── Picking ──────────────────────────────────────────────────────
/** One switch per card: in Auto it un-hides, in Manual it picks. Both mean "show this". */
function toggleShown(id: string) {
  if (isAuto.value)
    toggleExcluded(id)
  else toggleReview(id)
}

function isShown(id: string): boolean {
  return isAuto.value
    ? !excludedReviewIds.value.includes(id)
    : selectedReviewIds.value.includes(id)
}

function toggleReview(id: string) {
  const idx = selectedReviewIds.value.indexOf(id)
  if (idx === -1) {
    selectedReviewIds.value.push(id)
  }
  else {
    selectedReviewIds.value.splice(idx, 1)
  }
  emitUpdate()
}

/** Bulk actions read against what is visible, so search and filters double as a picker. */
function selectShown() {
  const current = new Set(selectedReviewIds.value)
  for (const review of filteredPool.value) {
    if (!current.has(review.id))
      selectedReviewIds.value.push(review.id)
  }
  emitUpdate()
}

const allShownSelected = computed(() =>
  filteredPool.value.length > 0
  && filteredPool.value.every(r => isShown(r.id)),
)

/** Tri-state for the bulk checkbox: mixed while only part of the visible set is picked. */
const bulkSelectState = computed<boolean | 'indeterminate'>(() => {
  if (allShownSelected.value)
    return true
  return filteredPool.value.some(r => isShown(r.id))
    ? 'indeterminate'
    : false
})

// reka-ui resolves a click on an indeterminate box to `true`, which is what a host means
// by clicking it: take everything currently on screen.
function setBulkSelect(value: boolean | 'indeterminate') {
  if (value === true)
    selectShown()
  else
    clearShown()
}

function clearShown() {
  const shown = new Set(filteredPool.value.map(r => r.id))
  selectedReviewIds.value = selectedReviewIds.value.filter(id => !shown.has(id))
  emitUpdate()
}

// ── Card view models ─────────────────────────────────────────────
const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function formatReviewDate(iso: string | null): string | null {
  if (!iso)
    return null
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? null : dateFormatter.format(new Date(parsed))
}

function toCardData(review: ReviewRecord): ReviewCardData {
  return {
    id: review.id,
    guestName: review.guest_name,
    scoreLabel: review.guest_rating_overall === null
      ? null
      : getDisplayScore(review.guest_rating_overall, review.source),
    scoreMax: getDisplayMax(review.source),
    channel: review.source,
    listingName: review.listing_name,
    dateLabel: formatReviewDate(review.review_received_at),
    text: review.guest_review_text,
  }
}

function manualCardData(manual: ManualReview): ReviewCardData {
  return {
    id: manual.id,
    guestName: manual.guestName,
    scoreLabel: getDisplayScore(manual.rating, manual.channel),
    scoreMax: getDisplayMax(manual.channel),
    channel: manual.channel,
    listingName: listingName(manual.listingId),
    dateLabel: null,
    text: manual.text,
    isManual: true,
  }
}

// ── Own testimonials ─────────────────────────────────────────────
const manualDialogOpen = ref(false)
const editingManualId = ref<string | null>(null)
const manualForm = ref({
  guestName: '',
  /** Native scale for the chosen channel; stored normalized to 0-10. */
  rating: 5,
  text: '',
  listingId: '',
  channel: 'airbnb' as ReviewSource,
})

// Listings available for manual reviews = those mapped to the selected properties
const manualListingOptions = computed(() =>
  listings.value.filter(l => listingIds.value.includes(l.id)),
)

const channelOptions: { value: ReviewSource, label: string, icon: string }[] = [
  { value: 'airbnb', label: 'Airbnb', icon: 'logos:airbnb' },
  { value: 'booking_com', label: 'Booking.com', icon: 'simple-icons:bookingdotcom' },
  { value: 'direct', label: 'Direct', icon: 'lucide:globe' },
]

/** Ratings in the channel's own scale, highest first — 5 stars on Airbnb, 10 on Booking.com. */
const manualRatingOptions = computed(() => {
  const max = getDisplayMax(manualForm.value.channel)
  const options: number[] = []
  for (let value = max; value >= 1; value -= max === 5 ? 0.5 : 1)
    options.push(value)
  return options
})

function setManualChannel(channel: ReviewSource) {
  const max = getDisplayMax(channel)
  const previousMax = getDisplayMax(manualForm.value.channel)
  manualForm.value = {
    ...manualForm.value,
    channel,
    // Keep the same intent across scales: a top rating stays a top rating.
    rating: manualForm.value.rating === previousMax ? max : Math.min(manualForm.value.rating, max),
  }
}

function openManualDialog() {
  editingManualId.value = null
  manualForm.value = {
    guestName: '',
    rating: 5,
    text: '',
    listingId: manualListingOptions.value[0]?.id ?? '',
    channel: 'airbnb',
  }
  manualDialogOpen.value = true
}

function openManualEdit(manual: ManualReview) {
  editingManualId.value = manual.id
  const max = getDisplayMax(manual.channel)
  manualForm.value = {
    guestName: manual.guestName,
    rating: max === 5 ? manual.rating / 2 : manual.rating,
    text: manual.text,
    listingId: manual.listingId,
    channel: manual.channel,
  }
  manualDialogOpen.value = true
}

function saveManualReview() {
  if (!manualForm.value.guestName.trim() || !manualForm.value.text.trim() || !manualForm.value.listingId) {
    toast.error('Guest name, listing and review text are required')
    return
  }
  const payload = {
    guestName: manualForm.value.guestName.trim(),
    rating: nativeToNormalized(manualForm.value.rating, manualForm.value.channel),
    text: manualForm.value.text.trim(),
    source: 'manual' as const,
    listingId: manualForm.value.listingId,
    channel: manualForm.value.channel,
  }
  if (editingManualId.value) {
    const id = editingManualId.value
    manualReviews.value = manualReviews.value.map(m => (m.id === id ? { ...m, ...payload } : m))
    toast.success('Testimonial updated')
  }
  else {
    manualReviews.value.push({ id: `manual-${Date.now()}`, ...payload })
    toast.success('Testimonial added')
  }
  emitUpdate()
  manualDialogOpen.value = false
  editingManualId.value = null
}

function listingName(listingId: string): string {
  return listings.value.find(l => l.id === listingId)?.name ?? listingId
}

function removeManualReview(id: string) {
  manualReviews.value = manualReviews.value.filter(m => m.id !== id)
  emitUpdate()
}

// ── Totals, validity, warnings ───────────────────────────────────
const totalSelected = computed(() =>
  (isAuto.value ? autoReviews.value.length : selectedReviewIds.value.length)
  + manualReviews.value.length,
)

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
  // Rules are fine; the host hid everything they let through. Say that, rather than
  // sending them off to loosen a rule that is not the problem.
  if (ruleMatches.value.length > 0)
    return 'Every review your rules let through is hidden. Tick one below to show it again.'
  if (!anyChannelEnabled.value)
    return 'Every channel is switched off, so no guest review can appear. Enable at least one.'
  if (config.value.requireText)
    return 'No review clears these rules. Try a lower minimum rating, or allow reviews without a written comment.'
  return 'No review clears these rules. Try a lower minimum rating.'
})

const previewOpen = ref(false)

// Newest first, the order the published page uses.
const previewRecords = computed(() => featuredPool.value)

function handleNext() {
  if (isValid.value)
    emit('next')
}
function handleBack() {
  emit('back')
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <div>
      <h3 class="text-lg font-semibold">
        Reviews
      </h3>
      <p class="text-sm text-muted-foreground">
        Choose which guest reviews appear on your website. Add your own testimonials if you like.
      </p>
    </div>

    <!-- Mode choice: two cards, each stating what it does and what it currently yields -->
    <div class="grid gap-3 @xl/main:grid-cols-2">
      <button
        type="button"
        data-testid="review-mode-auto"
        class="flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors"
        :class="isAuto ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'"
        @click="setMode('auto')"
      >
        <span class="flex items-center gap-2 text-sm font-medium">
          <Icon name="i-lucide-wand-sparkles" class="size-4" />
          Automatic
          <Icon v-if="isAuto" name="i-lucide-check-circle-2" class="ml-auto size-4 text-primary" />
        </span>
        <span class="text-xs text-muted-foreground">
          Every review that clears your rating bar appears on its own, including reviews that
          arrive after publishing.
        </span>
        <span class="mt-1 text-xs font-medium">
          {{ autoStats.total }} review{{ autoStats.total === 1 ? '' : 's' }} would show right now
        </span>
      </button>
      <button
        type="button"
        data-testid="review-mode-manual"
        class="flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors"
        :class="isAuto ? 'hover:bg-muted/40' : 'border-primary bg-primary/5'"
        @click="setMode('manual')"
      >
        <span class="flex items-center gap-2 text-sm font-medium">
          <Icon name="i-lucide-hand" class="size-4" />
          Hand-picked
          <Icon v-if="!isAuto" name="i-lucide-check-circle-2" class="ml-auto size-4 text-primary" />
        </span>
        <span class="text-xs text-muted-foreground">
          You choose each review yourself. New reviews stay off the site until you edit it again.
        </span>
        <span class="mt-1 text-xs font-medium">
          {{ selectedReviewIds.length }} of {{ candidateReviews.length }} chosen
        </span>
      </button>
    </div>

    <template v-if="isAuto">
      <WebsiteBuilderStepsReviewAutoSettings
        :model-value="config"
        :stats="autoStats"
        @update:model-value="updateConfig"
      />

      <div v-if="autoWarning" class="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        <Icon name="i-lucide-alert-triangle" class="mt-0.5 size-4 shrink-0 text-amber-600" />
        <span>{{ autoWarning }}</span>
      </div>
    </template>

    <!-- The picker: one list, one toolbar, in both modes -->
    <div class="rounded-lg border">
      <div class="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
        <div>
          <p class="text-sm font-medium">
            {{ isAuto ? 'Reviews your rules let through' : 'Pick the reviews to show' }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ isAuto
              ? 'These clear your rules. Untick any you would rather not show — the rules keep running for everything else.'
              : 'Tick the reviews to show.' }}
            Whatever is ticked appears on your home page as well as the reviews page.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <Badge v-if="!isAuto" variant="secondary" class="font-medium">
            {{ selectedReviewIds.length }} of {{ candidateReviews.length }} chosen
          </Badge>
          <Badge v-else variant="secondary" class="font-medium">
            {{ autoReviews.length }} of {{ ruleMatches.length }} showing
          </Badge>
          <Badge v-if="isAuto && excludedReviewIds.length > 0" variant="outline" class="gap-1 font-medium">
            <Icon name="i-lucide-eye-off" class="size-3" />
            {{ excludedReviewIds.length }} hidden
          </Badge>
        </div>
      </div>

      <!-- Toolbar -->
      <div
        v-if="modePool.length > 0"
        class="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-muted/60 px-4 py-3 backdrop-blur"
      >
        <div class="relative w-full sm:w-56">
          <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="search"
            aria-label="Search reviews"
            placeholder="Search guest or wording"
            class="h-8 pl-8 text-xs"
          />
        </div>

        <Select
          v-if="propertyOptions.length > 1"
          :model-value="propertyFilter"
          @update:model-value="propertyFilter = $event as string"
        >
          <SelectTrigger class="h-8 w-40 text-xs">
            <SelectValue placeholder="All properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All properties
            </SelectItem>
            <SelectItem v-for="option in propertyOptions" :key="option.id" :value="option.id">
              {{ option.name }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          :model-value="channelFilter"
          @update:model-value="channelFilter = $event as 'all' | ReviewSource"
        >
          <SelectTrigger class="h-8 w-36 text-xs">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              All channels
            </SelectItem>
            <SelectItem v-for="option in channelOptions" :key="option.value" :value="option.value">
              {{ channelLabels[option.value] }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          :model-value="sortBy"
          @update:model-value="sortBy = $event as SortKey"
        >
          <SelectTrigger class="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">
              Newest first
            </SelectItem>
            <SelectItem value="highest">
              Highest rated
            </SelectItem>
          </SelectContent>
        </Select>

        <div v-if="!isAuto" class="flex items-center gap-2">
          <Checkbox
            id="review-only-with-text"
            :model-value="onlyWithText"
            @update:model-value="onlyWithText = Boolean($event)"
          />
          <Label for="review-only-with-text" class="cursor-pointer text-xs font-normal">
            With a written comment
          </Label>
        </div>

        <!-- Bulk pick, Manual only. Auto has no counterpart on purpose: hiding is the
             escape hatch for the odd review, and "hide all" would just be Manual mode with
             extra steps. Tri-state, because "all" means every match of the current filters,
             of which only a slice may be on screen. -->
        <div v-if="!isAuto" class="ml-auto flex items-center gap-2">
          <Checkbox
            id="review-select-all"
            :model-value="bulkSelectState"
            :disabled="filteredPool.length === 0"
            class="data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
            @update:model-value="setBulkSelect($event)"
          >
            <Icon
              :name="bulkSelectState === 'indeterminate' ? 'i-lucide-minus' : 'i-lucide-check'"
              class="size-3.5"
            />
          </Checkbox>
          <Label for="review-select-all" class="cursor-pointer text-xs font-normal">
            {{ allShownSelected ? 'Unselect all' : 'Select all' }}
          </Label>
        </div>
      </div>

      <!-- Where you are in a long list, and what the bulk action would act on. With a
           filter running, "all" means the matches, not the whole pool — so say both. -->
      <div
        v-if="modePool.length > 0"
        class="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-2 text-xs text-muted-foreground"
      >
        <span>{{ rangeLabel }}</span>
        <template v-if="filteredPool.length !== modePool.length">
          <span aria-hidden="true">·</span>
          <span>filtered from {{ modePool.length }}</span>
        </template>
        <template v-if="!isAuto">
          <span aria-hidden="true">·</span>
          <span :class="selectedReviewIds.length > 0 ? 'font-medium text-foreground' : ''">{{ selectedReviewIds.length }} selected</span>
        </template>
        <template v-else-if="hiddenInView > 0">
          <span aria-hidden="true">·</span>
          <span class="font-medium text-foreground">{{ hiddenInView }} hidden here</span>
        </template>
      </div>

      <!-- Cards -->
      <div class="p-3">
        <div v-if="visiblePool.length > 0" class="flex flex-col gap-2">
          <WebsiteBuilderReviewPickerCard
            v-for="review in visiblePool"
            :key="review.id"
            :data="toCardData(review)"
            selectable
            :selected="isShown(review.id)"
            @toggle="toggleShown(review.id)"
          />
        </div>

        <Pagination
          v-if="totalPages > 1"
          v-slot="{ page }"
          :page="currentPage"
          :total="filteredPool.length"
          :items-per-page="PAGE_SIZE"
          :sibling-count="1"
          show-edges
          class="mt-3"
          @update:page="currentPage = $event"
        >
          <PaginationContent v-slot="{ items }">
            <PaginationPrevious data-testid="review-page-prev" size="sm" />
            <template v-for="(item, index) in items">
              <PaginationItem
                v-if="item.type === 'page'"
                :key="`page-${item.value}`"
                :value="item.value"
                :is-active="item.value === page"
                size="sm"
                class="size-8"
              >
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else :key="`ellipsis-${index}`" :index="index" class="size-8" />
            </template>
            <PaginationNext data-testid="review-page-next" size="sm" />
          </PaginationContent>
        </Pagination>

        <!-- Nothing left after filtering, versus nothing to filter at all -->
        <div
          v-if="visiblePool.length === 0 && modePool.length > 0"
          class="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground"
        >
          <Icon name="i-lucide-search-x" class="size-7" />
          <p class="text-sm">
            No review matches these filters.
          </p>
          <Button v-if="hasActiveFilters" variant="outline" size="sm" class="h-7 text-xs" @click="resetFilters">
            Clear filters
          </Button>
        </div>
        <div
          v-else-if="modePool.length === 0"
          class="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground"
        >
          <Icon name="i-lucide-star" class="size-7" />
          <p class="text-sm">
            {{ isAuto
              ? 'No guest review clears your rules yet.'
              : 'No guest review is available for these properties yet.' }}
          </p>
          <p class="text-xs">
            Your own testimonials still show, so a brand-new property is not left empty.
          </p>
        </div>
      </div>
    </div>

    <!-- Own testimonials: same cards, so they read as part of the same set -->
    <div class="rounded-lg border">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <p class="text-sm font-medium">
            Your own testimonials
          </p>
          <p class="text-xs text-muted-foreground">
            Written by you, not pulled from a channel. Useful before the first guest review lands.
          </p>
        </div>
        <Button variant="outline" size="sm" class="h-7 text-xs" @click="openManualDialog">
          <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
          Add testimonial
        </Button>
      </div>
      <div class="p-3">
        <div v-if="manualReviews.length > 0" class="flex flex-col gap-2">
          <WebsiteBuilderReviewPickerCard
            v-for="m in manualReviews"
            :key="m.id"
            :data="manualCardData(m)"
            editable
            removable
            @edit="openManualEdit(m)"
            @remove="removeManualReview(m.id)"
          />
        </div>
        <p v-else class="py-2 text-center text-xs text-muted-foreground">
          None yet.
        </p>
      </div>
    </div>

    <!-- Collapsible live preview -->
    <div v-if="totalSelected > 0" class="rounded-lg border">
      <button
        type="button"
        class="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium"
        @click="previewOpen = !previewOpen"
      >
        <Icon name="i-lucide-eye" class="size-4 text-muted-foreground" />
        Website Preview
        <span class="text-xs font-normal text-muted-foreground">
          {{ totalSelected }} {{ isAuto ? 'matching' : 'selected' }} · all shown on the home page
        </span>
        <Icon
          :name="previewOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="ml-auto size-4 text-muted-foreground"
        />
      </button>
      <div v-if="previewOpen" class="flex flex-col gap-3 border-t p-4">
        <div
          v-for="r in previewRecords"
          :key="r.id"
          data-testid="review-preview-card"
          class="rounded-lg border bg-card p-4"
        >
          <div class="mb-1 flex items-center justify-between">
            <span class="text-sm font-medium">{{ r.guest_name }}</span>
            <span class="text-sm font-semibold">{{ getDisplayScore(r.guest_rating_overall, r.source) }}/{{ getDisplayMax(r.source) }}</span>
          </div>
          <p class="line-clamp-3 text-sm text-muted-foreground">
            {{ r.guest_review_text || 'No written review' }}
          </p>
          <div class="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            {{ channelLabels[r.source] }}
          </div>
        </div>
        <div
          v-for="m in manualReviews"
          :key="m.id"
          data-testid="review-preview-card"
          class="rounded-lg border bg-card p-4"
        >
          <div class="mb-1 flex items-center justify-between">
            <span class="text-sm font-medium">{{ m.guestName }}</span>
            <span class="text-sm font-semibold">{{ getDisplayScore(m.rating, m.channel) }}/{{ getDisplayMax(m.channel) }}</span>
          </div>
          <p class="line-clamp-3 text-sm text-muted-foreground">
            {{ m.text }}
          </p>
          <div class="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            {{ channelLabels[m.channel] }} · {{ listingName(m.listingId) }}
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between pt-2">
      <Button variant="ghost" data-testid="review-step-back" @click="handleBack">
        <Icon name="i-lucide-arrow-left" class="mr-2 size-4" />
        Back
      </Button>
      <Button data-testid="review-step-next" :disabled="!isValid" @click="handleNext">
        Next
        <Icon name="i-lucide-arrow-right" class="ml-2 size-4" />
      </Button>
    </div>

    <Dialog v-model:open="manualDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editingManualId ? 'Edit testimonial' : 'Add testimonial' }}</DialogTitle>
          <DialogDescription>Write a testimonial to show on your website.</DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="manual-guest">Guest name</Label>
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
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="manual-channel">Channel</Label>
              <Select
                :model-value="manualForm.channel"
                @update:model-value="setManualChannel($event as ReviewSource)"
              >
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
              <Select
                :model-value="manualForm.rating"
                @update:model-value="manualForm.rating = Number($event)"
              >
                <SelectTrigger id="manual-rating" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="n in manualRatingOptions" :key="n" :value="n">
                    {{ n }}/{{ getDisplayMax(manualForm.channel) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="space-y-2">
            <Label for="manual-text">Review text</Label>
            <Textarea id="manual-text" v-model="manualForm.text" placeholder="What did the guest love?" class="min-h-[100px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="manualDialogOpen = false">
            Cancel
          </Button>
          <Button @click="saveManualReview">
            {{ editingManualId ? 'Save changes' : 'Add testimonial' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
