<script setup lang="ts">
// Same visual as PortalYoYBadge but takes the inline shape
// `{ absolute, percent }` rather than the wrapped OwnerYoYChange.
// Used on PortalStatementSummary tiles.
import { computed } from 'vue'
import PortalYoYBadge from './PortalYoYBadge.vue'

const props = withDefaults(defineProps<{
  comparison: { absolute: number, percent: number | null } | null
  format?: 'percent' | 'currency' | 'number'
  label?: string
}>(), {
  format: 'percent',
  label: 'vs prior period',
})

const wrapped = computed(() => props.comparison)
</script>

<template>
  <PortalYoYBadge :change="wrapped" :format="format" :label="label" />
</template>
