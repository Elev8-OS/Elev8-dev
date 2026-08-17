<script setup lang="ts">
import type { ReviewRecord } from '~/components/review-hub/data/types'
import type { ManualReview } from '~/components/website-builder/data/websites'
import { toast } from 'vue-sonner'
import { channelIcons, channelLabels, getDisplayMax, getDisplayScore } from '~/components/review-hub/data/types'
import { getListingsForProperty } from '~/components/website-builder/data/property-listings'
import { useReviewHub } from '~/composables/useReviewHub'

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
  if (listingIds.length === 0)
    return []
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
  if (idx === -1)
    selectedReviewIds.value.push(id)
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
        <p class="text-sm">
          No reviews match. Add a manual testimonial below.
        </p>
      </div>
    </div>

    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium">
          Manual Reviews
        </p>
        <p class="text-xs text-muted-foreground">
          Testimonials you write yourself.
        </p>
      </div>
      <Button variant="outline" size="sm" @click="openManualDialog">
        <Icon name="i-lucide-plus" class="size-4 mr-1.5" />
        Add Manual Review
      </Button>
    </div>

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
        <Badge variant="outline" class="text-[9px] px-1 py-0">
          Manual
        </Badge>
        <Button variant="ghost" size="icon-sm" class="size-5" @click="removeManualReview(m.id)">
          <Icon name="i-lucide-x" class="size-3" />
        </Button>
      </div>
    </div>

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
          <p class="text-sm text-muted-foreground line-clamp-3">
            {{ m.text }}
          </p>
          <div class="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Icon name="i-lucide-user-pen" class="size-3" />
            Manual
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
