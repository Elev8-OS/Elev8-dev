<script setup lang="ts">
import type { ReviewFeedItem } from '~/components/review-hub/data/types'
import type { HubSortKey } from '~/composables/useReviewHub'
import { format } from 'date-fns'
import { getDisplayScore, getDisplayMax } from '~/components/review-hub/data/types'

const props = defineProps<{
  items: ReviewFeedItem[]
  page: number
  pageSize: number
}>()

const emit = defineEmits<{
  select: [item: ReviewFeedItem]
  generate: [item: ReviewFeedItem]
  'update:page': [page: number]
}>()

const { getHostReviewCountdown, getUnitInfo, getListingStructure, isGuestReviewHidden, getReplyCountdown, getComputedStatus, sortBy, sortDir, setSort } = useReviewHub()

const totalPages = computed(() => Math.max(1, Math.ceil(props.items.length / props.pageSize)))

const pageItems = computed(() => {
  const start = (props.page - 1) * props.pageSize
  return props.items.slice(start, start + props.pageSize)
})

function toggleSort(key: HubSortKey) {
  setSort(key)
  emit('update:page', 1)
}

function sortIcon(key: HubSortKey) {
  if (sortBy.value !== key) return 'lucide:chevrons-up-down'
  return sortDir.value === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'
}

function sortHeaderClass(key: HubSortKey) {
  return sortBy.value === key ? 'text-foreground font-semibold' : ''
}

function getPropertySubtext(item: ReviewFeedItem) {
  const structure = getListingStructure(item.review_record.listing_id)
  if (structure === 'multi') {
    const unit = getUnitInfo(item.review_record.listing_id, item.review_record.unit_id)
    if (unit) return `${unit.unitTypeName} · ${unit.unitName}`
  }
  if (structure === 'single') return 'Single unit'
  return item.review_record.listing_location
}

const generatingIds = ref<Set<string>>(new Set())
const isGenerating = (id: string) => generatingIds.value.has(id)

async function handleGenerate(item: ReviewFeedItem) {
  generatingIds.value.add(item.id)
  emit('generate', item)
  await new Promise(resolve => setTimeout(resolve, 800))
  generatingIds.value.delete(item.id)
}

function formatDate(date: string) {
  return format(new Date(date), 'MMM d, yyyy')
}

function isRatingHidden(item: ReviewFeedItem) {
  return isGuestReviewHidden(item.review_record)
}

function ratingDisplay(rating: number | null, source: string) {
  if (rating === null) return '-'
  return `${getDisplayScore(rating, source as any)}/${getDisplayMax(source as any)}`
}

function isHostReviewExpired(item: ReviewFeedItem) {
  const r = item.review_record
  if (r.source === 'direct') return true
  return getHostReviewCountdown(r.checkout_date, r.source) <= 0
}

function hasHostReviewWindowOpen(item: ReviewFeedItem) {
  const r = item.review_record
  if (r.source === 'direct') return false
  if (r.host_review_id) return false
  return !isHostReviewExpired(item)
}

function canReplyToGuest(item: ReviewFeedItem) {
  const r = item.review_record
  const status = getComputedStatus(r)
  if (status === 'replied' || status === 'host_review_pending') return false
  if (!r.guest_review_text && r.guest_rating_overall === null) return false
  return true
}

function isReplyExpired(item: ReviewFeedItem) {
  const r = item.review_record
  if (r.source === 'direct') return false
  return getReplyCountdown(r.checkout_date, r.source) <= 0
}
</script>

<template>
  <div class="rounded-lg border bg-card">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded hover:text-foreground"
              :class="sortHeaderClass('guest_name')"
              @click="toggleSort('guest_name')"
            >
              Guest
              <Icon :name="sortIcon('guest_name')" class="size-3.5" />
            </button>
          </TableHead>
          <TableHead>Property</TableHead>
          <TableHead>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded hover:text-foreground"
              :class="sortHeaderClass('source')"
              @click="toggleSort('source')"
            >
              Channel
              <Icon :name="sortIcon('source')" class="size-3.5" />
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded hover:text-foreground"
              :class="sortHeaderClass('checkout_date')"
              @click="toggleSort('checkout_date')"
            >
              Checkout
              <Icon :name="sortIcon('checkout_date')" class="size-3.5" />
            </button>
          </TableHead>
          <TableHead>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded hover:text-foreground"
              :class="sortHeaderClass('rating')"
              @click="toggleSort('rating')"
            >
              Rating
              <Icon :name="sortIcon('rating')" class="size-3.5" />
            </button>
          </TableHead>
          <TableHead>Stay Report</TableHead>
          <TableHead>Status</TableHead>
          <TableHead class="text-right">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="item in pageItems"
          :key="item.id"
          class="cursor-pointer hover:bg-muted/50"
          @click="emit('select', item)"
        >
          <TableCell>
            <div>
              <p class="text-sm font-medium">
                {{ item.review_record.guest_name }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ item.review_record.nights }} night{{ item.review_record.nights !== 1 ? 's' : '' }} · {{ item.review_record.num_guests }} guest{{ item.review_record.num_guests !== 1 ? 's' : '' }}
              </p>
            </div>
          </TableCell>
          <TableCell>
            <div>
              <p class="text-sm">
                {{ item.review_record.listing_name }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ getPropertySubtext(item) }}
              </p>
            </div>
          </TableCell>
          <TableCell>
            <ReviewHubSourceBadge :source="item.review_record.source" />
          </TableCell>
          <TableCell class="text-sm">
            {{ formatDate(item.review_record.checkout_date) }}
          </TableCell>
          <TableCell>
            <div v-if="item.review_record.guest_rating_overall && !isRatingHidden(item)" class="flex items-center gap-1.5">
              <span class="text-sm font-medium">{{ ratingDisplay(item.review_record.guest_rating_overall, item.review_record.source) }}</span>
            </div>
            <div v-else-if="isRatingHidden(item)" class="flex items-center gap-1.5 text-muted-foreground">
              <Icon name="lucide:eye-off" class="size-3.5" />
              <span class="text-xs">Hidden</span>
            </div>
            <span v-else class="text-xs text-muted-foreground">-</span>
          </TableCell>
          <TableCell>
            <ReviewHubMiniBadges :sor="item.sor" />
          </TableCell>
          <TableCell>
            <ReviewHubStatusChip :status="getComputedStatus(item.review_record)" />
          </TableCell>
          <TableCell class="text-right">
            <Button
              v-if="hasHostReviewWindowOpen(item)"
              size="sm"
              class="h-8 gap-1.5"
              :disabled="isGenerating(item.id)"
              @click.stop="handleGenerate(item)"
            >
              <Icon v-if="isGenerating(item.id)" name="lucide:loader-circle" class="size-3.5 animate-spin" />
              <SharedAiIcon v-else custom-class="size-3.5" />
              {{ isGenerating(item.id) ? 'Generating...' : 'Write Host Review' }}
            </Button>
            <Button
              v-else-if="canReplyToGuest(item) && !isReplyExpired(item)"
              size="sm"
              :variant="item.review_record.reply_status === 'needs_reply' ? 'default' : 'outline'"
              class="h-8 gap-1.5"
              @click.stop="emit('select', item)"
            >
              <Icon name="lucide:message-circle" class="size-3.5" />
              Reply
            </Button>
            <Button v-else size="sm" variant="outline" class="h-8 gap-1.5" @click.stop="emit('select', item)">
              <Icon name="lucide:eye" class="size-3.5" />
              View
            </Button>
          </TableCell>
        </TableRow>
        <TableRow v-if="pageItems.length === 0">
          <TableCell colspan="8">
            <Empty class="py-10">
              <Icon name="lucide:message-square-text" class="size-8 text-muted-foreground" />
              <div class="space-y-1">
                <p class="font-medium">
                  No reviews found
                </p>
                <p class="text-sm text-muted-foreground">
                  Guest reviews will appear here after checkouts.
                </p>
              </div>
            </Empty>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <!-- Pagination -->
    <ReviewHubFeedPagination
      v-if="totalPages > 1"
      :page="page"
      :total-items="items.length"
      :page-size="pageSize"
      @update:page="(p: number) => emit('update:page', p)"
    />
  </div>
</template>
