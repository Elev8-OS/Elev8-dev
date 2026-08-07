<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value: number
  /** Short label shown next to the delta (e.g. "vs last week") */
  label: string
  suffix?: string
  /** Optional tooltip explaining what the delta means */
  hint?: string
}>(), {
  suffix: '',
  hint: '',
})

const display = computed(() => {
  if (props.value === 0) {
    return { text: '0', tone: 'muted' as const }
  }
  const sign = props.value > 0 ? '+' : ''
  return {
    text: `${sign}${props.value.toFixed(2)}${props.suffix}`,
    tone: props.value > 0 ? 'positive' as const : 'negative' as const,
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
    :title="hint"
  >
    <Icon :name="iconName" class="size-3" aria-hidden="true" />
    <span>{{ display.text }}</span>
    <span class="text-muted-foreground">{{ label }}</span>
  </span>
</template>
