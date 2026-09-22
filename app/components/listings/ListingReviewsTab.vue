<script setup lang="ts">
import type { Listing, Unit } from '~/components/listings/data/listings'

const props = defineProps<{ listing: Listing, activeUnit?: Unit | null }>()
const emit = defineEmits<{ update: [listing: Listing] }>()

const filterRating = ref<number | null>(null)

const avgCategories = computed(() => {
  const reviews = props.listing.reviews
  if (reviews.length === 0)
    return { cleanliness: 0, communication: 0, location: 0, value: 0 }
  const sum = reviews.reduce((acc, r) => ({
    cleanliness: acc.cleanliness + r.categories.cleanliness,
    communication: acc.communication + r.categories.communication,
    location: acc.location + r.categories.location,
    value: acc.value + r.categories.value,
  }), { cleanliness: 0, communication: 0, location: 0, value: 0 })
  const len = reviews.length
  return { cleanliness: sum.cleanliness / len, communication: sum.communication / len, location: sum.location / len, value: sum.value / len }
})

const filteredReviews = computed(() => {
  if (filterRating.value === null)
    return props.listing.reviews
  return props.listing.reviews.filter(r => r.rating === filterRating.value)
})

const replyText = ref<Record<string, string>>({})

function submitReply(reviewId: string) {
  const text = replyText.value[reviewId]
  if (!text?.trim())
    return
  const updatedReviews = props.listing.reviews.map(r =>
    r.id === reviewId ? { ...r, hostReply: text.trim() } : r,
  )
  emit('update', { ...props.listing, reviews: updatedReviews })
  replyText.value[reviewId] = ''
}

function renderStars(rating: number) {
  return '\u2605'.repeat(rating) + '\u2606'.repeat(5 - rating)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <Card class="p-5">
      <div class="flex items-center gap-6">
        <div class="text-center">
          <div class="text-3xl font-bold">
            {{ listing.stats.avgRating }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ listing.stats.totalReviews }} reviews
          </div>
        </div>
        <div class="flex-1 grid grid-cols-2 gap-3">
          <div v-for="(value, key) in avgCategories" :key="key" class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="text-xs capitalize">{{ key }}</span>
              <span class="text-xs font-medium">{{ value.toFixed(1) }}</span>
            </div>
            <Progress :model-value="value * 20" class="h-1.5" />
          </div>
        </div>
      </div>
    </Card>

    <div class="flex items-center gap-2">
      <Button variant="outline" size="sm" :class="filterRating === null ? 'border-primary' : ''" @click="filterRating = null">
        All
      </Button>
      <Button v-for="r in [5, 4, 3, 2, 1]" :key="r" variant="outline" size="sm" :class="filterRating === r ? 'border-primary' : ''" @click="filterRating = r">
        {{ r }}★
      </Button>
    </div>

    <div class="flex flex-col gap-4">
      <Card v-for="review in filteredReviews" :key="review.id" class="p-5">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">{{ review.guestName }}</span>
            <span class="text-xs text-muted-foreground">{{ formatDate(review.date) }}</span>
          </div>
          <span class="text-sm text-amber-500">{{ renderStars(review.rating) }}</span>
        </div>
        <p class="text-sm text-muted-foreground mb-3">
          {{ review.text }}
        </p>

        <div v-if="review.hostReply" class="rounded-lg bg-muted p-3">
          <span class="text-xs font-medium">Host Reply:</span>
          <p class="text-xs text-muted-foreground mt-1">
            {{ review.hostReply }}
          </p>
        </div>

        <div v-else class="flex gap-2 mt-3">
          <Textarea v-model="replyText[review.id]" placeholder="Write a reply..." class="min-h-[60px] text-xs" />
          <Button size="sm" class="shrink-0 self-end" @click="submitReply(review.id)">
            Reply
          </Button>
        </div>
      </Card>

      <p v-if="filteredReviews.length === 0" class="text-sm text-muted-foreground text-center py-8">
        No reviews matching this filter.
      </p>
    </div>
  </div>
</template>
