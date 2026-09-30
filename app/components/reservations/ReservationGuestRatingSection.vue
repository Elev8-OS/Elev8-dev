<script setup lang="ts">
import type { GuestRating } from '~/components/reservations/data/guest-rating'
import ImageViewer from '~/components/inbox/ImageViewer.vue'
import ClaimPhotoThumb from '~/components/reservations/ClaimPhotoThumb.vue'
import { GUEST_CLEANLINESS_LABELS, GUEST_HOUSE_RULES_LABELS } from '~/components/reservations/data/guest-rating'

const props = defineProps<{
  rating: GuestRating
}>()

const VIEWER_SCOPE = 'guest-rating'
const viewer = useImageViewer(VIEWER_SCOPE)

const questions = computed(() => [
  {
    key: 'cleanliness',
    question: 'How clean did the guest leave the property?',
    value: props.rating.cleanliness,
    label: GUEST_CLEANLINESS_LABELS[props.rating.cleanliness],
  },
  {
    key: 'house-rules',
    question: 'How well did the guest follow the house rules?',
    value: props.rating.houseRules,
    label: GUEST_HOUSE_RULES_LABELS[props.rating.houseRules],
  },
])

const ratedAtLabel = computed(() => {
  if (!props.rating.ratedAt)
    return ''
  return new Date(props.rating.ratedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
})

function viewPhoto(url: string) {
  viewer.openImage({ url, caption: 'Guest rating photo', senderName: props.rating.ratedBy, timestamp: props.rating.ratedAt ?? undefined })
}
</script>

<template>
  <div class="space-y-3" data-testid="guest-rating">
    <!-- Overall -->
    <div class="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
      <div class="min-w-0">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Overall rating
        </p>
        <p class="mt-0.5 truncate text-xs text-muted-foreground">
          By {{ rating.ratedBy }}<template v-if="ratedAtLabel">
            · {{ ratedAtLabel }}
          </template>
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <Icon name="lucide:star" class="size-5 fill-current text-amber-500" />
        <span class="text-xl font-bold" data-testid="guest-rating-overall">{{ rating.overall }}</span>
        <span class="text-xs text-muted-foreground">/ 5</span>
      </div>
    </div>

    <!-- Questions -->
    <div
      v-for="q in questions"
      :key="q.key"
      class="rounded-lg border p-3"
      :data-testid="`guest-rating-${q.key}`"
    >
      <p class="text-xs font-medium">
        {{ q.question }}
      </p>
      <div class="mt-2 flex items-center justify-between gap-3">
        <div class="flex items-center gap-0.5" role="img" :aria-label="`${q.value} out of 5`">
          <Icon
            v-for="n in 5"
            :key="n"
            name="lucide:star"
            class="size-4"
            :class="n <= q.value ? 'fill-current text-amber-500' : 'text-muted-foreground/40'"
          />
        </div>
        <span class="text-xs text-muted-foreground">{{ q.label }}</span>
      </div>
    </div>

    <!-- Comment -->
    <div v-if="rating.comment" class="rounded-lg border p-3">
      <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Comment
      </p>
      <p class="mt-1 whitespace-pre-line text-sm leading-relaxed" data-testid="guest-rating-comment">
        {{ rating.comment }}
      </p>
    </div>

    <!-- Photos -->
    <div v-if="rating.photoUrls.length" class="rounded-lg border p-3">
      <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Photos ({{ rating.photoUrls.length }})
      </p>
      <div class="mt-2 flex flex-wrap gap-2" data-testid="guest-rating-photos">
        <ClaimPhotoThumb
          v-for="url in rating.photoUrls"
          :key="url"
          :src="url"
          alt="Guest rating photo"
          zoomable
          @open="viewPhoto(url)"
        />
      </div>
    </div>

    <ImageViewer :scope="VIEWER_SCOPE" />
  </div>
</template>
