<script setup lang="ts">
import type { AutoReview } from '~/components/airbnb-reviews/data/reviews'
import type { ReviewRecord, StayOperationalRecord } from '~/components/review-hub/data/types'
import { toast } from 'vue-sonner'
import { hostLanguageOptions } from '~/components/airbnb-reviews/data/reviews'
import { hostReviewTagOptions } from '~/components/review-hub/data/types'

const props = defineProps<{
  review: ReviewRecord
  sor: StayOperationalRecord | null
  hostReview: AutoReview | null
}>()

const emit = defineEmits<{
  reviewSubmitted: []
}>()

const { generateHostReviewDraft, submitHostReview, getHostReviewCountdown, translateText, rephraseText, resolveTargetLang } = useReviewHub()

// Only consider a host review "generated" if it has actual public_review text
const hasGeneratedData = computed(() => !!props.hostReview?.public_review)
const draftText = ref(props.hostReview?.public_review ?? '')
const privateFeedback = ref(props.hostReview?.private_feedback ?? '')
const cleanliness = ref(props.hostReview?.ratings?.cleanliness ?? 5)
const communication = ref(props.hostReview?.ratings?.communication ?? 5)
const respectHouseRules = ref(props.hostReview?.ratings?.respect_house_rules ?? 5)
const isRevieweeRecommended = ref(props.review.is_reviewee_recommended ?? true)
const selectedHostTags = ref<string[]>(props.review.host_review_tags ?? [])
const isGenerating = ref(false)
const isGenerated = ref(hasGeneratedData.value)
const isSubmitted = computed(() => props.review.host_review_id !== null)

// Translation state for the AI-generated draft
const showTranslation = ref(false)
const isTranslating = ref(false)
const isRephrasing = ref(false)
const originalDraft = ref('')

const targetLangLabel = computed(() => {
  const opt = hostLanguageOptions.find(o => o.value === resolveTargetLang())
  return opt ? opt.label : (resolveTargetLang() ?? 'English')
})

const canTranslate = computed(() => isGenerated.value && draftText.value.trim().length > 0 && !isSubmitted.value)

// Use saved review data from ReviewRecord for readonly view
const savedReviewText = computed(() => props.review.host_review_text)
const savedPrivateFeedback = computed(() => props.review.private_feedback)
const savedRatings = computed(() => props.review.host_review_ratings)

// Countdown (Airbnb 14d, Booking.com 365d)
const countdown = computed(() => getHostReviewCountdown(props.review.checkout_date, props.review.source))
const isExpired = computed(() => countdown.value <= 0)

// Only Airbnb supports host reviews of guests (Channex POST /guest_review is Airbnb-only)
const channelSupportsReview = computed(() => props.review.source === 'airbnb')
const isPublicOnly = computed(() => false)

// SOR-based preview
const sorAvailable = computed(() => props.sor !== null && (props.sor.cleaning_score !== null || props.sor.communication_score !== null))

async function handleGenerate() {
  isGenerating.value = true
  const result = await generateHostReviewDraft(props.review.id)
  draftText.value = result.text
  privateFeedback.value = result.privateFeedback
  cleanliness.value = result.ratings.cleanliness
  communication.value = result.ratings.communication
  respectHouseRules.value = result.ratings.respect_house_rules
  selectedHostTags.value = result.tags ?? []
  originalDraft.value = result.text
  showTranslation.value = false
  isGenerated.value = true
  isGenerating.value = false
}

async function handleTranslate() {
  if (!canTranslate.value)
    return
  if (showTranslation.value) {
    // Toggle back to the original draft
    draftText.value = originalDraft.value
    showTranslation.value = false
    return
  }
  isTranslating.value = true
  try {
    draftText.value = await translateText(originalDraft.value)
    showTranslation.value = true
  }
  finally {
    isTranslating.value = false
  }
}

async function handleRephrase() {
  if (!canTranslate.value)
    return
  isRephrasing.value = true
  try {
    // Rephrase whatever is currently shown (original or translated draft)
    draftText.value = await rephraseText(draftText.value)
    originalDraft.value = draftText.value
    showTranslation.value = false
  }
  finally {
    isRephrasing.value = false
  }
}

function handleSubmit() {
  if (!draftText.value.trim()) return
  if (isPublicOnly.value) {
    submitHostReview(props.review.id, draftText.value, null, isRevieweeRecommended.value, [])
  } else {
    submitHostReview(props.review.id, draftText.value, {
      cleanliness: cleanliness.value,
      communication: communication.value,
      respect_house_rules: respectHouseRules.value,
      privateFeedback: privateFeedback.value,
    }, isRevieweeRecommended.value, selectedHostTags.value)
  }
}

function toggleHostTag(code: string) {
  if (isSubmitted.value) return
  const idx = selectedHostTags.value.indexOf(code)
  if (idx >= 0) selectedHostTags.value.splice(idx, 1)
  else selectedHostTags.value.push(code)
}

async function autoGenerate() {
  if (isExpired.value || isSubmitted.value) return
  // Reset any prior generated state so the loading state is visible
  isGenerated.value = false
  await handleGenerate()
}

function setRating(field: 'cleanliness' | 'communication' | 'respectHouseRules', value: number) {
  if (isSubmitted.value) return
  const clamped = Math.max(1, Math.min(5, value))
  if (field === 'cleanliness') cleanliness.value = clamped
  else if (field === 'communication') communication.value = clamped
  else respectHouseRules.value = clamped
}

defineExpose({ autoGenerate })
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <SharedAiIcon custom-class="size-4 text-primary" />
        <span class="text-sm font-medium">AI Host Review of Guest</span>
      </div>
      <Badge v-if="!isExpired && channelSupportsReview" variant="outline" class="gap-1 text-xs">
        <Icon name="lucide:clock" class="size-3" />
        {{ countdown }}d remaining
      </Badge>
    </div>

    <p class="text-xs text-muted-foreground">
      AI generates this review based on real Operational Record data from Elev8 and conversation summary.
    </p>

    <!-- Channel doesn't support reviews -->
    <div v-if="!channelSupportsReview" class="rounded-lg border border-dashed p-6 text-center">
      <Icon name="lucide:info" class="mx-auto size-6 text-muted-foreground" />
      <p class="mt-2 text-sm text-muted-foreground">
        Direct bookings do not support host reviews of guests.
      </p>
    </div>

    <!-- Expired -->
    <div v-else-if="isExpired" class="rounded-lg border border-dashed p-6 text-center">
      <Icon name="lucide:clock" class="mx-auto size-6 text-muted-foreground" />
      <p class="mt-2 text-sm text-muted-foreground">
        The {{ review.source === 'booking_com' ? '365-day' : '14-day' }} review window has closed. Reviews can no longer be submitted.
      </p>
    </div>

    <!-- No SOR -->
    <div v-else-if="!sorAvailable && !isGenerated" class="rounded-lg border border-dashed p-6 text-center">
      <Icon name="lucide:clipboard-x" class="mx-auto size-6 text-muted-foreground" />
      <p class="mt-2 text-sm text-muted-foreground">
        Not enough operational data to generate a review. You can write one manually.
      </p>
      <Button class="mt-4 gap-2" :disabled="isExpired" @click="isGenerated = true">
        <Icon name="lucide:pen-line" class="size-4" />
        Write Manually
      </Button>
    </div>

    <!-- Generate or edit -->
    <template v-else>
      <!-- Submitted readonly view -->
      <template v-if="isSubmitted">
        <div class="rounded-lg border bg-green-50/50 p-4">
          <div class="flex items-center gap-2 text-green-700">
            <Icon name="lucide:check-circle-2" class="size-4" />
            <span class="text-sm font-medium">Review Submitted</span>
          </div>
        </div>

        <div class="space-y-2">
          <Label class="text-sm font-medium">Public Review</Label>
          <p class="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
            {{ savedReviewText }}
          </p>
        </div>

        <template v-if="!isPublicOnly">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <Label class="text-sm font-medium">Private Feedback</Label>
              <Badge variant="outline" class="text-[10px]">Host-Only</Badge>
            </div>
            <p class="rounded-lg border bg-amber-50 p-3 text-sm leading-relaxed">
              {{ savedPrivateFeedback }}
            </p>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="rounded-lg border bg-card p-3 text-center">
              <p class="text-xs text-muted-foreground">Cleanliness</p>
              <p class="mt-1 text-sm font-medium">{{ savedRatings?.cleanliness ?? '-' }}<span class="text-xs text-muted-foreground">/5</span></p>
            </div>
            <div class="rounded-lg border bg-card p-3 text-center">
              <p class="text-xs text-muted-foreground">Communication</p>
              <p class="mt-1 text-sm font-medium">{{ savedRatings?.communication ?? '-' }}<span class="text-xs text-muted-foreground">/5</span></p>
            </div>
            <div class="rounded-lg border bg-card p-3 text-center">
              <p class="text-xs text-muted-foreground">House Rules</p>
              <p class="mt-1 text-sm font-medium">{{ savedRatings?.respect_house_rules ?? '-' }}<span class="text-xs text-muted-foreground">/5</span></p>
            </div>
          </div>
        </template>
      </template>

      <!-- Edit/Generate view -->
      <template v-else>
        <template v-if="!isGenerated">
          <div v-if="isGenerating" class="space-y-4">
            <div class="flex flex-col items-center justify-center gap-3 rounded-lg border bg-gradient-to-b from-primary/5 to-transparent p-8 text-center">
              <div class="flex size-10 items-center justify-center rounded-full bg-primary/15">
                <Icon name="lucide:loader-circle" class="size-6 animate-spin text-primary" />
              </div>
              <div class="space-y-1">
                <p class="text-sm font-medium">
                  Generating host review
                </p>
                <p class="text-xs text-muted-foreground">
                  ElevAI is analyzing the stay's operational record and drafting an honest review. This usually takes a few seconds.
                </p>
              </div>
            </div>
            <div class="h-20 w-full animate-pulse rounded-lg bg-muted" />
            <div v-if="!isPublicOnly" class="h-16 w-full animate-pulse rounded-lg bg-muted" />
            <div v-if="!isPublicOnly" class="grid grid-cols-3 gap-3">
              <div class="h-16 w-full animate-pulse rounded-lg bg-muted" />
              <div class="h-16 w-full animate-pulse rounded-lg bg-muted" />
              <div class="h-16 w-full animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
          <div v-else class="rounded-lg border border-dashed p-6 text-center">
            <SharedAiIcon custom-class="mx-auto size-6 text-muted-foreground" />
            <p class="mt-2 text-sm text-muted-foreground">
              Generate an honest guest review grounded in the stay's operational record.
            </p>
            <Button class="mt-4 gap-2" :disabled="isGenerating" @click="handleGenerate">
              <SharedAiIcon custom-class="size-4" />
              Generate Host Review
            </Button>
          </div>
        </template>

        <template v-else>
          <!-- Public Review Editor -->
          <div class="space-y-2">
            <Label class="text-sm font-medium">Public Review</Label>
            <Textarea
              v-model="draftText"
              :rows="4"
              :maxlength="1000"
              placeholder="Edit the review..."
              class="text-sm"
            />
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted-foreground">{{ draftText.length }}/1000</span>
                <Button
                  v-if="canTranslate"
                  variant="ghost"
                  size="sm"
                  class="gap-1.5"
                  :disabled="isGenerating || isTranslating"
                  @click="handleTranslate"
                >
                  <Icon :name="showTranslation ? 'lucide:undo-2' : 'lucide:languages'" class="size-3.5" />
                  {{ showTranslation ? 'Show original' : 'Translate' }}
                </Button>
                <span v-if="isTranslating" class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Icon name="lucide:loader-2" class="size-3 animate-spin" />
                  Translating...
                </span>
                <span
                  v-else-if="showTranslation"
                  class="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                >
                  <Icon name="lucide:languages" class="size-2.5" />
                  Translated to {{ targetLangLabel }}
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <Button
                  v-if="canTranslate"
                  variant="ghost"
                  size="sm"
                  class="gap-1.5"
                  :disabled="isGenerating || isRephrasing || isTranslating"
                  @click="handleRephrase"
                >
                  <Icon name="lucide:refresh-cw" class="size-3.5" :class="isRephrasing && 'animate-spin'" />
                  {{ isRephrasing ? 'Rephrasing...' : 'Rephrase' }}
                </Button>
                <Button variant="ghost" size="sm" class="gap-1.5" :disabled="isGenerating" @click="handleGenerate">
                  <Icon name="lucide:refresh-cw" class="size-3.5" :class="isGenerating && 'animate-spin'" />
                  Regenerate
                </Button>
              </div>
            </div>
          </div>

          <template v-if="!isPublicOnly">
            <!-- Private Feedback (auto-generated) -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <Label class="text-sm font-medium">Private Feedback</Label>
                <Badge variant="outline" class="text-[10px]">Host-Only</Badge>
              </div>
              <Textarea
                v-model="privateFeedback"
                :rows="3"
                :maxlength="2000"
                placeholder="Private notes for other hosts..."
                class="text-sm"
              />
              <span class="text-xs text-muted-foreground">{{ privateFeedback.length }}/2000</span>
            </div>

            <!-- Category Ratings -->
            <div class="space-y-3">
              <Label class="text-sm font-medium">Ratings</Label>
              <div class="grid grid-cols-3 gap-3">
                <div class="rounded-lg border bg-card p-3 text-center">
                  <p class="text-xs text-muted-foreground">Cleanliness</p>
                  <div class="mt-1 inline-flex items-center gap-1">
                    <button
                      type="button"
                      class="size-6 rounded border text-sm transition-colors hover:bg-muted"
                      :disabled="isSubmitted || cleanliness <= 1"
                      @click="setRating('cleanliness', cleanliness - 1)"
                    >
                      −
                    </button>
                    <span class="min-w-[2.5rem] text-sm font-medium">{{ cleanliness }}<span class="text-xs text-muted-foreground">/5</span></span>
                    <button
                      type="button"
                      class="size-6 rounded border text-sm transition-colors hover:bg-muted"
                      :disabled="isSubmitted || cleanliness >= 5"
                      @click="setRating('cleanliness', cleanliness + 1)"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div class="rounded-lg border bg-card p-3 text-center">
                  <p class="text-xs text-muted-foreground">Communication</p>
                  <div class="mt-1 inline-flex items-center gap-1">
                    <button
                      type="button"
                      class="size-6 rounded border text-sm transition-colors hover:bg-muted"
                      :disabled="isSubmitted || communication <= 1"
                      @click="setRating('communication', communication - 1)"
                    >
                      −
                    </button>
                    <span class="min-w-[2.5rem] text-sm font-medium">{{ communication }}<span class="text-xs text-muted-foreground">/5</span></span>
                    <button
                      type="button"
                      class="size-6 rounded border text-sm transition-colors hover:bg-muted"
                      :disabled="isSubmitted || communication >= 5"
                      @click="setRating('communication', communication + 1)"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div class="rounded-lg border bg-card p-3 text-center">
                  <p class="text-xs text-muted-foreground">House Rules</p>
                  <div class="mt-1 inline-flex items-center gap-1">
                    <button
                      type="button"
                      class="size-6 rounded border text-sm transition-colors hover:bg-muted"
                      :disabled="isSubmitted || respectHouseRules <= 1"
                      @click="setRating('respectHouseRules', respectHouseRules - 1)"
                    >
                      −
                    </button>
                    <span class="min-w-[2.5rem] text-sm font-medium">{{ respectHouseRules }}<span class="text-xs text-muted-foreground">/5</span></span>
                    <button
                      type="button"
                      class="size-6 rounded border text-sm transition-colors hover:bg-muted"
                      :disabled="isSubmitted || respectHouseRules >= 5"
                      @click="setRating('respectHouseRules', respectHouseRules + 1)"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Recommend Guest -->
            <div class="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p class="text-sm font-medium">Recommend this guest?</p>
                <p class="text-xs text-muted-foreground">Visible to other hosts on the platform</p>
              </div>
              <Switch
                :model-value="isRevieweeRecommended"
                :disabled="isSubmitted"
                @update:model-value="isRevieweeRecommended = $event"
              />
            </div>

            <!-- Host Review Tags -->
            <div class="space-y-2">
              <Label class="text-sm font-medium">Tags</Label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="option in hostReviewTagOptions"
                  :key="option.code"
                  type="button"
                  class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors"
                  :class="selectedHostTags.includes(option.code)
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-muted/50 text-muted-foreground border-transparent hover:border-muted-foreground/30'"
                  :disabled="isSubmitted"
                  @click="toggleHostTag(option.code)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </template>

          <!-- Actions -->
          <div class="flex gap-2">
            <Button variant="outline" class="gap-1.5" :disabled="isGenerating" @click="handleGenerate">
              <Icon v-if="isGenerating" name="lucide:loader-circle" class="size-3.5 animate-spin" />
              <Icon v-else name="lucide:refresh-cw" class="size-3.5" />
              {{ isGenerating ? 'Regenerating...' : 'Regenerate' }}
            </Button>
            <Button class="gap-1.5" :disabled="isGenerating" @click="handleSubmit">
              <Icon name="lucide:send" class="size-3.5" />
              Submit Review
            </Button>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>
