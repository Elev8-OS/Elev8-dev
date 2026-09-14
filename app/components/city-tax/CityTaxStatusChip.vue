<script setup lang="ts">
import type { CityTaxAlertStage, CityTaxStatus } from '~/components/reservations/data/city-tax'

const props = defineProps<{
  status: CityTaxStatus
  stage?: CityTaxAlertStage | null
}>()

const meta = computed(() => {
  if (props.status === 'due') {
    return props.stage === 'overdue'
      ? { label: 'Tax missed', class: 'border-destructive/30 bg-destructive/10 text-destructive' }
      : { label: 'Tax due', class: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' }
  }
  if (props.status === 'collected')
    return { label: 'Collected', class: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400' }
  if (props.status === 'waived')
    return { label: 'Waived', class: 'border-muted-foreground/30 bg-muted text-muted-foreground' }
  if (props.status === 'channel_collects')
    return { label: 'Channel', class: 'border-muted-foreground/30 bg-muted text-muted-foreground' }
  // not_required: a property that levies nothing should add nothing to the row.
  return null
})
</script>

<template>
  <Badge v-if="meta" variant="outline" :class="meta.class">
    {{ meta.label }}
  </Badge>
</template>
