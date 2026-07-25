<script setup lang="ts">
import type { OwnerYoYChange } from '~/composables/useOwnerDashboard'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  change: OwnerYoYChange | null
  format?: 'percent' | 'currency' | 'number'
  label?: string
}>(), {
  format: 'percent',
  label: 'vs prior year',
})

const display = computed(() => {
  if (!props.change || props.change.percent === null) {
    return { text: '—', tone: 'muted' as const }
  }
  const pct = props.change.percent
  const sign = pct > 0 ? '+' : ''
  if (props.format === 'currency') {
    return {
      text: `${sign}${pct.toFixed(1)}%`,
      tone: pct > 0 ? 'positive' as const : pct < 0 ? 'negative' as const : 'muted' as const,
    }
  }
  return {
    text: `${sign}${(pct * 100).toFixed(1)}%`,
    tone: pct > 0 ? 'positive' as const : pct < 0 ? 'negative' as const : 'muted' as const,
  }
})

const iconName = computed(() => {
  if (display.value.tone === 'positive')
    return 'lucide:trending-up'
  if (display.value.tone === 'negative')
    return 'lucide:trending-down'
  return 'lucide:minus'
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1 text-xs font-medium"
    :class="{
      'text-emerald-600': display.tone === 'positive',
      'text-destructive': display.tone === 'negative',
      'text-muted-foreground': display.tone === 'muted',
    }"
    :data-testid="`yoy-badge-${display.tone}`"
  >
    <Icon :name="iconName" class="size-3" aria-hidden="true" />
    <span>{{ display.text }}</span>
    <span v-if="label" class="text-muted-foreground">{{ label }}</span>
  </span>
</template>
