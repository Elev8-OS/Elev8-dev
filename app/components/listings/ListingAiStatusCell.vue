<script setup lang="ts">
import { getUnits, listings } from '~/components/listings/data/listings'

const props = defineProps<{ listingId: string }>()

const aiStatusLabels: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  not_set: 'Not Set',
}

const live = computed(() => listings.value.find(l => l.id === props.listingId))

// For multi-unit listings, aggregate AI status from unit types (any active = active, all paused = paused).
// For single-unit listings, use the listing-level aiStatus directly.
const status = computed(() => {
  if (!live.value)
    return 'not_set'
  if (live.value.unitType !== 'multi' || !live.value.unitTypes?.length)
    return live.value.aiStatus
  const types = live.value.unitTypes
  const allPaused = types.every(ut => (ut.aiStatus ?? 'active') === 'paused')
  if (allPaused)
    return 'paused'
  const anyActive = types.some(ut => (ut.aiStatus ?? 'active') === 'active')
  if (anyActive)
    return 'active'
  return live.value.aiStatus
})

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
