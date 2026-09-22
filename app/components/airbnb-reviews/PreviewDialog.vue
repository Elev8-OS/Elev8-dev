<script setup lang="ts">
import type { AutoReview, ReviewRatings } from '~/components/airbnb-reviews/data/reviews'
import { format } from 'date-fns'
import { toast } from 'vue-sonner'
import { hostLanguageOptions, toneModeOptions } from '~/components/airbnb-reviews/data/reviews'

const props = defineProps<{
  open: boolean
  review: AutoReview | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = useVModel(props, 'open', emit)
const { saveDraft, approveReview, regenerateReview } = useAirbnbReviews()

const publicReview = ref('')
const privateFeedback = ref('')
const cleanliness = ref(5)
const communication = ref(5)
const respectHouseRules = ref(5)
const recommendGuest = ref(true)
const wouldHostAgain = ref(true)
const isRegenerating = ref(false)

watch(() => props.review, (r) => {
  if (r) {
    publicReview.value = r.public_review || ''
    privateFeedback.value = r.private_feedback || ''
    cleanliness.value = r.ratings?.cleanliness ?? 5
    communication.value = r.ratings?.communication ?? 5
    respectHouseRules.value = r.ratings?.respect_house_rules ?? 5
    recommendGuest.value = r.recommend_guest ?? true
    wouldHostAgain.value = r.would_host_again ?? true
  }
}, { immediate: true })

const isDraft = computed(() => props.review?.status === 'draft')

function handleSave() {
  if (!props.review)
    return
  const ratings: ReviewRatings = {
    cleanliness: cleanliness.value,
    communication: communication.value,
    respect_house_rules: respectHouseRules.value,
  }
  saveDraft(props.review.id, {
    public_review: publicReview.value,
    private_feedback: privateFeedback.value,
    ratings,
    recommend_guest: recommendGuest.value,
    would_host_again: wouldHostAgain.value,
  })
  toast.success('Review saved as draft.')
  isOpen.value = false
}

function handlePost() {
  if (!props.review)
    return
  const ratings: ReviewRatings = {
    cleanliness: cleanliness.value,
    communication: communication.value,
    respect_house_rules: respectHouseRules.value,
  }
  saveDraft(props.review.id, {
    public_review: publicReview.value,
    private_feedback: privateFeedback.value,
    ratings,
    recommend_guest: recommendGuest.value,
    would_host_again: wouldHostAgain.value,
  })
  approveReview(props.review.id)
  toast.success('Review posted to Airbnb.')
  isOpen.value = false
}

async function handleRegenerate() {
  if (!props.review)
    return
  isRegenerating.value = true
  await regenerateReview(props.review.id)
  isRegenerating.value = false
  toast.success('Review regenerated.')
}

function setRating(field: 'cleanliness' | 'communication' | 'respectHouseRules', value: number) {
  const clamped = Math.max(1, Math.min(5, value))
  if (field === 'cleanliness')
    cleanliness.value = clamped
  else if (field === 'communication')
    communication.value = clamped
  else respectHouseRules.value = clamped
}

function ratingStars(rating: number) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

function formatDate(date: string) {
  return format(new Date(date), 'd MMM yyyy, HH:mm')
}

function getLangLabel(code: string) {
  return hostLanguageOptions.find(l => l.value === code)?.label ?? code
}

function getToneLabel(code: string) {
  return toneModeOptions.find(t => t.value === code)?.label ?? code
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Review Preview</DialogTitle>
        <DialogDescription v-if="review">
          {{ review.guest_name }} at {{ review.listing_name }}
        </DialogDescription>
      </DialogHeader>

      <template v-if="review">
        <!-- Meta info -->
        <div class="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Generated: {{ review.generated_at ? formatDate(review.generated_at) : '-' }}</span>
          <span>Language: {{ getLangLabel(review.host_language) }}</span>
          <span>Tone: {{ getToneLabel(review.tone_mode) }}</span>
          <span v-if="review.manually_edited" class="text-blue-600">Edited</span>
        </div>

        <ScrollArea class="max-h-[60vh] pr-3">
          <div class="space-y-5">
            <!-- Public Review -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:eye" class="size-4 text-muted-foreground" />
                  <Label class="text-sm font-medium">Public Review</Label>
                  <Badge variant="outline" class="text-[10px]">
                    Visible to Guest
                  </Badge>
                </div>
                <span class="text-xs text-muted-foreground">{{ publicReview.length }}/500</span>
              </div>
              <Textarea
                v-if="isDraft"
                v-model="publicReview"
                rows="4"
                placeholder="Write your review..."
                class="text-sm"
                :maxlength="500"
              />
              <div v-else class="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
                {{ review.public_review || 'No review generated yet.' }}
              </div>
            </div>

            <!-- Private Feedback -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:lock" class="size-4 text-muted-foreground" />
                  <Label class="text-sm font-medium">Private Feedback</Label>
                  <Badge variant="outline" class="text-[10px]">
                    Host-Only
                  </Badge>
                </div>
                <span class="text-xs text-muted-foreground">{{ privateFeedback.length }}/1000</span>
              </div>
              <Textarea
                v-if="isDraft"
                v-model="privateFeedback"
                rows="3"
                placeholder="Private notes for other hosts..."
                class="text-sm"
                :maxlength="1000"
              />
              <div v-else class="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
                {{ review.private_feedback || 'No feedback.' }}
              </div>
            </div>

            <!-- Ratings -->
            <div class="space-y-3">
              <Label class="text-sm font-medium">Ratings</Label>
              <div class="grid grid-cols-3 gap-3">
                <div class="rounded-lg border bg-card p-3 text-center">
                  <p class="text-xs text-muted-foreground">
                    Cleanliness
                  </p>
                  <template v-if="isDraft">
                    <div class="mt-1 flex items-center justify-center gap-0.5">
                      <button
                        v-for="n in 5"
                        :key="`clean-${n}`"
                        type="button"
                        class="text-lg transition-colors"
                        :class="n <= cleanliness ? 'text-yellow-500' : 'text-muted-foreground/30'"
                        @click="setRating('cleanliness', n)"
                      >
                        ★
                      </button>
                    </div>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      {{ cleanliness }}/5
                    </p>
                  </template>
                  <template v-else>
                    <p class="mt-1 text-lg text-yellow-500">
                      {{ ratingStars(cleanliness) }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ cleanliness }}/5
                    </p>
                  </template>
                </div>
                <div class="rounded-lg border bg-card p-3 text-center">
                  <p class="text-xs text-muted-foreground">
                    Communication
                  </p>
                  <template v-if="isDraft">
                    <div class="mt-1 flex items-center justify-center gap-0.5">
                      <button
                        v-for="n in 5"
                        :key="`comm-${n}`"
                        type="button"
                        class="text-lg transition-colors"
                        :class="n <= communication ? 'text-yellow-500' : 'text-muted-foreground/30'"
                        @click="setRating('communication', n)"
                      >
                        ★
                      </button>
                    </div>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      {{ communication }}/5
                    </p>
                  </template>
                  <template v-else>
                    <p class="mt-1 text-lg text-yellow-500">
                      {{ ratingStars(communication) }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ communication }}/5
                    </p>
                  </template>
                </div>
                <div class="rounded-lg border bg-card p-3 text-center">
                  <p class="text-xs text-muted-foreground">
                    House Rules
                  </p>
                  <template v-if="isDraft">
                    <div class="mt-1 flex items-center justify-center gap-0.5">
                      <button
                        v-for="n in 5"
                        :key="`rules-${n}`"
                        type="button"
                        class="text-lg transition-colors"
                        :class="n <= respectHouseRules ? 'text-yellow-500' : 'text-muted-foreground/30'"
                        @click="setRating('respectHouseRules', n)"
                      >
                        ★
                      </button>
                    </div>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      {{ respectHouseRules }}/5
                    </p>
                  </template>
                  <template v-else>
                    <p class="mt-1 text-lg text-yellow-500">
                      {{ ratingStars(respectHouseRules) }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ respectHouseRules }}/5
                    </p>
                  </template>
                </div>
              </div>
            </div>

            <!-- Checkboxes -->
            <div class="flex gap-6">
              <template v-if="isDraft">
                <label class="flex cursor-pointer items-center gap-2">
                  <Checkbox v-model="recommendGuest" />
                  <span class="text-sm">Recommend this guest</span>
                </label>
                <label class="flex cursor-pointer items-center gap-2">
                  <Checkbox v-model="wouldHostAgain" />
                  <span class="text-sm">Would host again</span>
                </label>
              </template>
              <template v-else>
                <div class="flex items-center gap-2">
                  <Icon :name="recommendGuest ? 'lucide:check-circle-2' : 'lucide:circle'" class="size-4" :class="recommendGuest ? 'text-green-600' : 'text-muted-foreground'" />
                  <span class="text-sm">{{ recommendGuest ? 'Recommend this guest' : 'Would not recommend' }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <Icon :name="wouldHostAgain ? 'lucide:check-circle-2' : 'lucide:circle'" class="size-4" :class="wouldHostAgain ? 'text-green-600' : 'text-muted-foreground'" />
                  <span class="text-sm">{{ wouldHostAgain ? 'Would host again' : 'Would not host again' }}</span>
                </div>
              </template>
            </div>

            <!-- Status info for posted -->
            <div v-if="review.status === 'posted' && review.airbnb_review_id" class="rounded-lg border bg-green-50 p-3 text-sm">
              <div class="flex items-center gap-2 text-green-700">
                <Icon name="lucide:check-circle-2" class="size-4" />
                <span>Posted to Airbnb</span>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                Review ID: {{ review.airbnb_review_id }} · {{ review.posted_to_airbnb_at ? formatDate(review.posted_to_airbnb_at) : '' }}
              </p>
            </div>
          </div>
        </ScrollArea>
      </template>

      <DialogFooter class="flex-row gap-2 sm:justify-between">
        <div class="flex gap-2">
          <Button v-if="isDraft" variant="outline" class="gap-1.5" :disabled="isRegenerating" @click="handleRegenerate">
            <Icon name="lucide:refresh-cw" class="size-3.5" :class="isRegenerating && 'animate-spin'" />
            Regenerate
          </Button>
        </div>
        <div class="flex gap-2">
          <template v-if="isDraft">
            <Button variant="outline" class="gap-1.5" @click="handleSave">
              <Icon name="lucide:save" class="size-3.5" />
              Save as Draft
            </Button>
            <Button class="gap-1.5" @click="handlePost">
              <Icon name="lucide:send" class="size-3.5" />
              Post to Airbnb
            </Button>
          </template>
          <Button v-else variant="outline" @click="isOpen = false">
            Close
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
