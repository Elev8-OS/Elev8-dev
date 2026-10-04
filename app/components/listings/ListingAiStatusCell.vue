<script setup lang="ts">
import { AI_STATUS_LABELS as aiStatusLabels, listingAiStatus } from '~/components/listings/data/listing-ai-status'
import { getUnits, listings } from '~/components/listings/data/listings'

const props = defineProps<{ listingId: string }>()

const live = computed(() => listings.value.find(l => l.id === props.listingId))

// Multi-unit listings aggregate from their room types (`listingAiStatus`).
const status = computed(() => live.value ? listingAiStatus(live.value) : 'not_set')

const inactive = computed(() => {
  if (!live.value)
    return false
  if (live.value.unitType === 'multi')
    return getUnits(live.value).every(u => u.status === 'inactive')
  return live.value.status === 'inactive'
})
</script>

<template>
  <div class="flex items-center gap-1.5" :class="inactive ? 'opacity-40' : ''">
    <!-- The ElevAI mark, greyed out when the AI is not answering (its gradient cannot take a text colour). -->
    <SharedAiIcon :custom-class="status === 'active' ? 'size-4' : 'size-4 grayscale opacity-50'" />
    <span class="text-sm">{{ aiStatusLabels[status] || status }}</span>
  </div>
</template>
