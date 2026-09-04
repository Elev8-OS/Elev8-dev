<script setup lang="ts">
import type { ReviewSource } from '~/components/review-hub/data/types'
import type { AutoReviewStats, WebsiteReviewConfig } from '~/components/website-builder/data/review-config'
import { channelIcons, channelLabels, getDisplayMax } from '~/components/review-hub/data/types'
import { thresholdOptions } from '~/components/website-builder/data/review-config'

const props = defineProps<{
  modelValue: WebsiteReviewConfig
  stats: AutoReviewStats
}>()

const emit = defineEmits<{
  'update:modelValue': [value: WebsiteReviewConfig]
}>()

const CHANNELS: ReviewSource[] = ['airbnb', 'booking_com', 'direct']

// Every write goes through a spread, so the parent's config object is never mutated.
function patch(partial: Partial<WebsiteReviewConfig>) {
  emit('update:modelValue', { ...props.modelValue, ...partial })
}

function patchChannel(source: ReviewSource, partial: Partial<WebsiteReviewConfig['channels'][ReviewSource]>) {
  patch({
    channels: {
      ...props.modelValue.channels,
      [source]: { ...props.modelValue.channels[source], ...partial },
    },
  })
}

const breakdown = computed(() =>
  CHANNELS
    .filter(source => props.modelValue.channels[source].enabled)
    .map(source => `${channelLabels[source]} ${props.stats.byChannel[source]}`),
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Per-channel rules -->
    <div class="rounded-lg border">
      <div class="border-b px-4 py-3">
        <p class="text-sm font-medium">
          Auto-show rules
        </p>
        <p class="text-xs text-muted-foreground">
          Any review that clears its channel's rule appears on the website, including reviews
          that arrive after publishing.
        </p>
      </div>
      <div class="divide-y">
        <div
          v-for="source in CHANNELS"
          :key="source"
          class="flex flex-wrap items-center gap-3 px-4 py-3"
          :class="modelValue.channels[source].enabled ? '' : 'opacity-60'"
        >
          <Switch
            :id="`review-channel-${source}`"
            :model-value="modelValue.channels[source].enabled"
            @update:model-value="patchChannel(source, { enabled: Boolean($event) })"
          />
          <Icon :name="channelIcons[source]" class="size-4 shrink-0" />
          <Label :for="`review-channel-${source}`" class="text-sm font-medium min-w-28">
            {{ channelLabels[source] }}
          </Label>
          <div class="flex items-center gap-2 ml-auto">
            <span class="text-xs text-muted-foreground">Minimum rating</span>
            <Select
              :model-value="modelValue.channels[source].minRating"
              :disabled="!modelValue.channels[source].enabled"
              @update:model-value="patchChannel(source, { minRating: Number($event) })"
            >
              <SelectTrigger class="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in thresholdOptions(source)" :key="option" :value="option">
                  {{ option }}+
                </SelectItem>
              </SelectContent>
            </Select>
            <span class="text-xs text-muted-foreground w-10">of {{ getDisplayMax(source) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Content + display settings -->
    <div class="flex flex-col gap-3 rounded-lg border p-4">
      <div class="flex items-center gap-2">
        <Checkbox
          id="review-require-text"
          :model-value="modelValue.requireText"
          @update:model-value="patch({ requireText: Boolean($event) })"
        />
        <Label for="review-require-text" class="text-sm cursor-pointer">
          Only reviews with a written comment
        </Label>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Label for="review-min-count" class="text-sm">
          Hide the section until at least
        </Label>
        <Input
          id="review-min-count"
          type="number"
          min="0"
          class="w-20"
          :model-value="modelValue.minCountToShow"
          @update:model-value="patch({ minCountToShow: Math.max(0, Number($event) || 0) })"
        />
        <span class="text-sm">reviews match</span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Label for="review-batch-size" class="text-sm">
          Show
        </Label>
        <Input
          id="review-batch-size"
          type="number"
          min="1"
          class="w-20"
          :model-value="modelValue.batchSize"
          @update:model-value="patch({ batchSize: Math.max(1, Number($event) || 1) })"
        />
        <span class="text-sm">reviews per batch</span>
      </div>
      <p class="text-xs text-muted-foreground">
        Visitors see {{ modelValue.batchSize }} at a time with a Load more button. There is no
        limit on the total.
      </p>
    </div>

    <!-- Live match line -->
    <div
      class="flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm"
      :class="stats.total === 0 ? 'border-destructive/30 bg-destructive/5' : 'bg-muted/20'"
    >
      <Icon
        :name="stats.total === 0 ? 'i-lucide-alert-triangle' : 'i-lucide-check-circle-2'"
        class="size-4 shrink-0"
        :class="stats.total === 0 ? 'text-destructive' : 'text-muted-foreground'"
      />
      <span v-if="stats.total === 0" class="font-medium">
        No reviews match these rules yet
      </span>
      <span v-else class="font-medium">
        {{ stats.total }} review{{ stats.total === 1 ? ' matches' : 's match' }}
      </span>
      <span v-if="breakdown.length > 0" class="text-xs text-muted-foreground">
        {{ breakdown.join(' · ') }}
      </span>
    </div>
  </div>
</template>
