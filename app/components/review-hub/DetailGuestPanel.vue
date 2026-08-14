<script setup lang="ts">
import type { ReviewRecord } from '~/components/review-hub/data/types'
import { format } from 'date-fns'
import { hostLanguageOptions } from '~/components/airbnb-reviews/data/reviews'
import { channelIcons, channelLabels, getCategoryDisplayLabel, getDisplayMax, getDisplayScore, getTagLabel, getTagSentiment } from '~/components/review-hub/data/types'

const props = defineProps<{
  review: ReviewRecord
}>()

const { isGuestReviewHidden, resolveTargetLang, translateReview } = useReviewHub()
useAirbnbReviews()

const showTranslation = ref(false)
const isTranslating = ref(false)

const targetLang = computed(() => resolveTargetLang())

const ratingsExpanded = ref(false)

const sourceIcon = computed(() => channelIcons[props.review.source])
const sourceLabel = computed(() => channelLabels[props.review.source])

const reviewHidden = computed(() => isGuestReviewHidden(props.review))

const displayMax = computed(() => getDisplayMax(props.review.source))

// Guest left a review?
const hasGuestReview = computed(() => props.review.guest_rating_overall !== null || !!props.review.guest_review_text)

// Whether a translation is meaningful for this review
const translationNeeded = computed(() => {
  if (!props.review.guest_review_text)
    return false
  const target = targetLang.value
  return props.review.language_detected !== target || !!props.review.translated_content
})

const showTranslateButton = computed(() => translationNeeded.value)

const translatedLabel = computed(() => {
  const lang = props.review.translation_language
  const opt = hostLanguageOptions.find(o => o.value === lang)
  return opt ? opt.label : (lang ?? 'English')
})

// State label
const stateLabel = computed(() => {
  if (reviewHidden.value)
    return 'Review hidden (double-blind)'
  if (!hasGuestReview.value)
    return 'Guest has not left a review yet'
  return null
})

const stateIcon = computed(() => {
  if (reviewHidden.value)
    return 'lucide:eye-off'
  if (!hasGuestReview.value)
    return 'lucide:message-square-dashed'
  return 'lucide:eye-off' // fallback, won't render
})

async function handleToggle() {
  if (showTranslation.value)
    return showTranslation.value = false

  showTranslation.value = true
  if (!props.review.translated_content) {
    isTranslating.value = true
    try {
      await translateReview(props.review.id)
    }
    finally {
      isTranslating.value = false
    }
  }
}

function formatDate(date: string) {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

const categoryEntries = computed(() => {
  if (!props.review.scores || props.review.scores.length === 0)
    return []
  return props.review.scores.map(s => ({
    key: s.category,
    label: getCategoryDisplayLabel(s.category),
    score: s.score,
  }))
})

// Tags grouped by sentiment
const positiveTags = computed(() => props.review.tags.filter(t => getTagSentiment(t) === 'positive'))
const negativeTags = computed(() => props.review.tags.filter(t => getTagSentiment(t) === 'negative'))
const hasTags = computed(() => props.review.tags.length > 0 && !reviewHidden.value)

// Show max 6 tags, expandable
const visibleTagCount = ref(4)
const allTagsVisible = computed(() => visibleTagCount.value >= props.review.tags.length)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Icon :name="sourceIcon" class="size-4" />
        <span class="text-sm font-medium">{{ sourceLabel }} Review</span>
      </div>
      <div class="flex items-center gap-2">
        <span
          v-if="review.language_detected"
          class="text-xs text-muted-foreground"
        >
          Language: {{ review.language_detected.toUpperCase() }}
        </span>
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
      </div>
    </div>

    <!-- State indicator -->
    <div v-if="stateLabel" class="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
      <Icon :name="stateIcon" class="size-4 text-muted-foreground shrink-0" />
      <span class="text-sm text-muted-foreground">{{ stateLabel }}</span>
    </div>

    <!-- Rating Accordion -->
    <template v-if="!reviewHidden && hasGuestReview">
      <button
        v-if="review.guest_rating_overall"
        type="button"
        class="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
        @click="ratingsExpanded = !ratingsExpanded"
      >
        <div class="flex items-center gap-3">
          <span class="text-3xl font-bold">
            {{ getDisplayScore(review.guest_rating_overall, review.source) }}
            <span class="text-base font-normal text-muted-foreground">/{{ displayMax }}</span>
          </span>
          <p class="text-xs text-muted-foreground">
            Overall Rating
          </p>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="ratingsExpanded && 'rotate-180'"
        />
      </button>

      <!-- Category Ratings -->
      <div v-if="categoryEntries.length > 0 && ratingsExpanded" class="grid grid-cols-3 gap-2">
        <div v-for="cat in categoryEntries" :key="cat.key" class="rounded-lg border bg-card p-2 text-center">
          <p class="text-[10px] text-muted-foreground">
            {{ cat.label }}
          </p>
          <p class="mt-0.5 text-sm font-medium">
            {{ getDisplayScore(cat.score, review.source) }}/{{ displayMax }}
          </p>
        </div>
      </div>
    </template>

    <!-- Review Text -->
    <template v-if="reviewHidden">
      <div class="rounded-lg border border-dashed bg-muted/30 p-4 text-center">
        <Icon name="lucide:eye-off" class="mx-auto size-5 text-muted-foreground" />
        <p class="mt-2 text-sm text-muted-foreground">
          Submit your host review to reveal the guest's feedback.
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          Or it will auto-reveal 14 days after checkout.
        </p>
      </div>
    </template>
    <template v-else-if="hasGuestReview">
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
    </template>

    <!-- Tags (Channex review tags) -->
    <div v-if="hasTags" class="space-y-2">
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="tag in [...positiveTags, ...negativeTags].slice(0, allTagsVisible ? 99 : visibleTagCount)"
          :key="tag"
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          :class="getTagSentiment(tag) === 'positive'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'"
        >
          <Icon
            :name="getTagSentiment(tag) === 'positive' ? 'lucide:check' : 'lucide:alert-triangle'"
            class="size-2.5"
          />
          {{ getTagLabel(tag) }}
        </span>
        <button
          v-if="props.review.tags.length > visibleTagCount && !allTagsVisible"
          type="button"
          class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          @click="visibleTagCount = props.review.tags.length"
        >
          +{{ props.review.tags.length - visibleTagCount }} more
        </button>
      </div>
    </div>
  </div>
</template>
