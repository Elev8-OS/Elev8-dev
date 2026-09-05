<script setup lang="ts">
// One review as a readable card, used everywhere the Reviews step shows a review:
// the hand-pick list, the Auto pool (where the checkbox is replaced by a "shows on
// your site" line), and the host's own testimonials.
//
// There is no per-card main-page toggle: everything on the website is shown on the home
// page, so the only decision a card carries is whether the review shows at all — a pick in
// Manual mode, an un-hide in Auto.
//
// Picking a review means judging what it says, so the text is the largest thing on the
// card, clamped to three lines with an expander rather than truncated to one line.

import type { ReviewSource } from '~/components/review-hub/data/types'
import { channelIcons, channelLabels } from '~/components/review-hub/data/types'

export interface ReviewCardData {
  id: string
  guestName: string
  /** Display score in the channel's own scale, e.g. "4.8". Null when unrated. */
  scoreLabel: string | null
  scoreMax: number
  channel: ReviewSource
  listingName: string
  dateLabel: string | null
  text: string | null
  isManual?: boolean
}

const props = withDefaults(defineProps<{
  data: ReviewCardData
  /** Manual mode: the card toggles inclusion. Auto mode: inclusion is decided by rules. */
  selectable?: boolean
  selected?: boolean
  removable?: boolean
  editable?: boolean
}>(), {
  selectable: false,
  selected: false,
  removable: false,
  editable: false,
})

const emit = defineEmits<{
  toggle: []
  remove: []
  edit: []
}>()

// Long enough that three clamped lines would hide something worth reading.
const CLAMP_AT = 180
const expanded = ref(false)
const isLong = computed(() => (props.data.text ?? '').length > CLAMP_AT)

function onCardClick() {
  if (props.selectable)
    emit('toggle')
}
</script>

<template>
  <div
    data-testid="review-picker-card"
    class="flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors"
    :class="[
      selectable ? 'cursor-pointer hover:border-primary/40 hover:bg-muted/30' : '',
      selected ? 'border-primary/60 bg-primary/5' : '',
    ]"
    @click="onCardClick"
  >
    <!-- Identity row -->
    <div class="flex items-start gap-2">
      <Checkbox
        v-if="selectable"
        :model-value="selected"
        :aria-label="`Include the review by ${data.guestName}`"
        class="mt-0.5 shrink-0"
        @click.stop
        @update:model-value="emit('toggle')"
      />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-sm font-medium">{{ data.guestName }}</span>
          <Badge v-if="data.scoreLabel" variant="secondary" class="gap-0.5 px-1.5 py-0 text-[10px]">
            <Icon name="i-lucide-star" class="size-2.5" />
            {{ data.scoreLabel }}/{{ data.scoreMax }}
          </Badge>
          <Badge v-else variant="outline" class="px-1.5 py-0 text-[10px] text-muted-foreground">
            Unrated
          </Badge>
          <Badge variant="outline" class="px-1.5 py-0 text-[10px]">
            <Icon :name="channelIcons[data.channel]" class="mr-0.5 size-3" />
            {{ channelLabels[data.channel] }}
          </Badge>
          <Badge v-if="data.isManual" variant="secondary" class="px-1.5 py-0 text-[10px]">
            Your testimonial
          </Badge>
        </div>
        <p class="truncate text-xs text-muted-foreground">
          {{ data.listingName }}{{ data.dateLabel ? ` · ${data.dateLabel}` : '' }}
        </p>
      </div>
      <div v-if="editable || removable" class="flex shrink-0 items-center">
        <Button
          v-if="editable"
          variant="ghost"
          size="icon"
          class="size-7"
          :aria-label="`Edit the testimonial by ${data.guestName}`"
          @click.stop="emit('edit')"
        >
          <Icon name="i-lucide-pencil" class="size-3.5" />
        </Button>
        <Button
          v-if="removable"
          variant="ghost"
          size="icon"
          class="size-7"
          :aria-label="`Remove the testimonial by ${data.guestName}`"
          @click.stop="emit('remove')"
        >
          <Icon name="i-lucide-trash-2" class="size-3.5" />
        </Button>
      </div>
    </div>

    <!-- What the guest actually wrote — the part you pick on -->
    <p v-if="data.text" class="text-sm leading-relaxed" :class="expanded ? '' : 'line-clamp-3'">
      {{ data.text }}
    </p>
    <p v-else class="text-sm italic text-muted-foreground">
      No written comment. Only the rating would appear.
    </p>

    <button
      v-if="isLong"
      type="button"
      class="w-fit text-xs font-medium text-primary hover:underline"
      @click.stop="expanded = !expanded"
    >
      {{ expanded ? 'Show less' : 'Read full review' }}
    </button>

    <!-- Inclusion state. Everything included is shown on the home page, so there is
         nothing further to toggle here. -->
    <div class="mt-auto flex items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
      <template v-if="!selectable">
        <Icon name="i-lucide-check" class="size-3 text-primary" />
        Shows on your site
      </template>
      <template v-else>
        <Icon
          :name="selected ? 'i-lucide-check' : 'i-lucide-eye-off'"
          class="size-3"
          :class="selected ? 'text-primary' : ''"
        />
        {{ selected ? 'Shown on site' : 'Hidden' }}
      </template>
    </div>
  </div>
</template>
