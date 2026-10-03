<script setup lang="ts">
import type { Listing, Unit } from '~/components/listings/data/listings'
import type { ReplyStatus, ReviewFeedItem, ReviewSource } from '~/components/review-hub/data/types'
import { averageOverallScore, listingFeedItems } from '~/components/listings/data/listing-reviews'
import { channelIcons, channelLabels, getCategoryDisplayLabel, replyStatusLabels } from '~/components/review-hub/data/types'
import DetailDrawer from '~/components/review-hub/DetailDrawer.vue'
import FeedTable from '~/components/review-hub/FeedTable.vue'
import { sortFeedItems, useReviewHub } from '~/composables/useReviewHub'

/**
 * The listing's reviews, read from the Review Hub (`useReviewHub`) so both
 * pages show the same records, statuses and AI replies. The tab keeps its own
 * filters: the hub's filters are shared state and would leak into its page.
 */
const props = defineProps<{ listing: Listing, activeUnit?: Unit | null }>()

const { feedItems, sortBy, sortDir, getComputedStatus, isGuestReviewHidden } = useReviewHub()

const listingItems = computed(() => listingFeedItems(feedItems.value, props.listing.id, props.activeUnit?.id))

const statusFilter = ref<ReplyStatus | 'all'>('all')
const channelFilter = ref<ReviewSource | 'all'>('all')
const page = ref(1)
const pageSize = 10

watch([statusFilter, channelFilter], () => {
  page.value = 1
})

const filteredItems = computed(() =>
  sortFeedItems(
    listingItems.value.filter(item =>
      (statusFilter.value === 'all' || getComputedStatus(item.review_record) === statusFilter.value)
      && (channelFilter.value === 'all' || item.review_record.source === channelFilter.value),
    ),
    sortBy.value,
    sortDir.value,
  ),
)

/** Ratings a guest can see: double-blind hidden reviews count once they are revealed, as on the hub. */
const ratedRecords = computed(() =>
  listingItems.value
    .map(item => item.review_record)
    .filter(r => r.guest_rating_overall !== null && !isGuestReviewHidden(r)),
)

const averageScore = computed(() => averageOverallScore(listingItems.value.map(item => item.review_record), isGuestReviewHidden))

/** Category averages across channels, merged by display label (Booking.com `clean` and Airbnb `cleanliness` are one). */
const categoryAverages = computed(() => {
  const totals = new Map<string, { sum: number, count: number }>()
  for (const record of ratedRecords.value) {
    for (const { category, score } of record.scores) {
      const label = getCategoryDisplayLabel(category)
      const entry = totals.get(label) ?? { sum: 0, count: 0 }
      totals.set(label, { sum: entry.sum + score, count: entry.count + 1 })
    }
  }
  return Array.from(totals.entries())
    .map(([label, { sum, count }]) => ({ label, value: sum / count }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

const STATUSES: ReplyStatus[] = ['host_review_pending', 'needs_reply', 'replied']
const CHANNELS: ReviewSource[] = ['airbnb', 'booking_com', 'direct']

const statusCounts = computed(() => {
  const counts: Record<ReplyStatus, number> = { host_review_pending: 0, needs_reply: 0, replied: 0 }
  for (const item of listingItems.value)
    counts[getComputedStatus(item.review_record)]++
  return counts
})

const channelCounts = computed(() => {
  const counts: Record<ReviewSource, number> = { airbnb: 0, booking_com: 0, direct: 0 }
  for (const item of listingItems.value)
    counts[item.review_record.source]++
  return counts
})

const drawerOpen = ref(false)
const selectedItem = ref<ReviewFeedItem | null>(null)
const drawerRef = ref<InstanceType<typeof DetailDrawer> | null>(null)

function openDrawer(item: ReviewFeedItem) {
  selectedItem.value = item
  drawerOpen.value = true
}

function openDrawerAndGenerate(item: ReviewFeedItem) {
  openDrawer(item)
  drawerRef.value?.generateHostReview()
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <Card class="p-5">
      <div class="flex flex-col gap-5 md:flex-row md:items-center">
        <div class="flex shrink-0 flex-col items-center md:w-32">
          <div class="text-3xl font-bold" data-testid="reviews-average">
            {{ averageScore === null ? '-' : averageScore.toFixed(1) }}
          </div>
          <div class="text-xs text-muted-foreground">
            out of 10 · {{ listingItems.length }} {{ listingItems.length === 1 ? 'review' : 'reviews' }}
          </div>
        </div>
        <div v-if="categoryAverages.length" class="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-3">
          <div v-for="category in categoryAverages" :key="category.label" class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="text-xs">{{ category.label }}</span>
              <span class="text-xs font-medium">{{ category.value.toFixed(1) }}</span>
            </div>
            <Progress :model-value="category.value * 10" class="h-1.5" />
          </div>
        </div>
        <p v-else class="flex-1 text-sm text-muted-foreground">
          No visible ratings yet.
        </p>
      </div>
    </Card>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          :class="statusFilter === 'all' ? 'border-primary' : ''"
          @click="statusFilter = 'all'"
        >
          All
          <span class="text-muted-foreground">{{ listingItems.length }}</span>
        </Button>
        <Button
          v-for="status in STATUSES"
          :key="status"
          variant="outline"
          size="sm"
          :class="statusFilter === status ? 'border-primary' : ''"
          :data-testid="`reviews-status-${status}`"
          @click="statusFilter = status"
        >
          {{ replyStatusLabels[status] }}
          <span class="text-muted-foreground">{{ statusCounts[status] }}</span>
        </Button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          :class="channelFilter === 'all' ? 'border-primary' : ''"
          @click="channelFilter = 'all'"
        >
          All channels
        </Button>
        <Button
          v-for="channel in CHANNELS"
          :key="channel"
          variant="outline"
          size="sm"
          class="gap-1.5"
          :class="channelFilter === channel ? 'border-primary' : ''"
          :disabled="channelCounts[channel] === 0"
          :data-testid="`reviews-channel-${channel}`"
          @click="channelFilter = channel"
        >
          <Icon :name="channelIcons[channel]" class="size-3.5" />
          {{ channelLabels[channel] }}
        </Button>
      </div>
    </div>

    <ClientOnly>
      <FeedTable
        v-model:page="page"
        :items="filteredItems"
        :page-size="pageSize"
        @select="openDrawer"
        @generate="openDrawerAndGenerate"
      />
      <DetailDrawer
        ref="drawerRef"
        v-model:open="drawerOpen"
        :item="selectedItem"
      />
    </ClientOnly>
  </div>
</template>
