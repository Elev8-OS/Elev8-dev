<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** Normalised 0–1 series. Empty renders the no-data state. */
  values: number[]
  /** Normalised 0–1 reference line — the comparable-set median. */
  reference?: number
  width?: number
  height?: number
}>(), { width: 76, height: 26, reference: undefined })

const PAD = 3

/**
 * One series plus a reference line. Deliberately not two series: the reference
 * is a baseline, not a second category, so no categorical palette is needed.
 */
const path = computed(() => {
  if (props.values.length < 2)
    return ''
  const stepX = (props.width - PAD * 2) / (props.values.length - 1)
  const usable = props.height - PAD * 2
  return props.values
    .map((value, index) => {
      const x = PAD + index * stepX
      const y = PAD + (1 - Math.min(Math.max(value, 0), 1)) * usable
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
})

const referenceY = computed(() => {
  if (props.reference === undefined)
    return null
  const usable = props.height - PAD * 2
  return PAD + (1 - Math.min(Math.max(props.reference, 0), 1)) * usable
})
</script>

<template>
  <svg
    :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`"
    fill="none" class="shrink-0 overflow-visible"
    role="img"
    :aria-label="values.length < 2 ? 'No trend data' : 'Realised average daily rate over 30 days against the comparable-set median'"
  >
    <line
      v-if="referenceY !== null"
      :x1="PAD" :y1="referenceY" :x2="width - PAD" :y2="referenceY"
      class="stroke-muted-foreground" stroke-width="1.5" stroke-dasharray="3 3" stroke-linecap="round"
    />
    <path
      v-if="path"
      :d="path" class="stroke-foreground" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"
    />
    <line
      v-else
      :x1="PAD" :y1="height / 2" :x2="width - PAD" :y2="height / 2"
      class="stroke-border" stroke-width="1.5" stroke-dasharray="3 3" stroke-linecap="round"
    />
  </svg>
</template>
