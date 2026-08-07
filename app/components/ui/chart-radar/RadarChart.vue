<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** Category labels + scores (0-maxValue scale) */
  data: { label: string, value: number }[]
  /** Max value for the radial scale (default 10) */
  maxValue?: number
  /** Number of concentric grid rings */
  rings?: number
  /** Fill color of the polygon */
  color?: string
  /** Show numeric value next to each vertex */
  showValues?: boolean
}>(), {
  maxValue: 10,
  rings: 4,
  color: 'var(--vis-primary-color)',
  showValues: true,
})

const SIZE = 320
const CENTER = SIZE / 2
const RADIUS = 120

const angleFor = (i: number) => (Math.PI * 2 * i / props.data.length) - Math.PI / 2

function pointAt(i: number, ratio: number) {
  const angle = angleFor(i)
  const r = RADIUS * ratio
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) }
}

// Grid rings (polygons)
const rings = computed(() => {
  return Array.from({ length: props.rings }, (_, ring) => {
    const ratio = (ring + 1) / props.rings
    const points = props.data.map((_, i) => {
      const p = pointAt(i, ratio)
      return `${p.x},${p.y}`
    }).join(' ')
    const label = ring + 1 < props.rings ? Math.round(props.maxValue * ratio) : ''
    return { points, label }
  })
})

// Axis lines + labels
const axes = computed(() => {
  return props.data.map((d, i) => {
    const tip = pointAt(i, 1)
    const labelPos = pointAt(i, 1.18)
    return {
      x1: CENTER,
      y1: CENTER,
      x2: tip.x,
      y2: tip.y,
      labelX: labelPos.x,
      labelY: labelPos.y,
      label: d.label,
    }
  })
})

// Data polygon
const polygonPoints = computed(() => {
  return props.data.map((d, i) => {
    const ratio = Math.max(0.02, Math.min(1, d.value / props.maxValue))
    const p = pointAt(i, ratio)
    return `${p.x},${p.y}`
  }).join(' ')
})

// Value labels at each vertex
const vertices = computed(() => {
  return props.data.map((d, i) => {
    const ratio = Math.max(0.02, Math.min(1, d.value / props.maxValue))
    const p = pointAt(i, ratio)
    return { x: p.x, y: p.y, value: d.value }
  })
})
</script>

<template>
  <div class="flex justify-center">
    <svg :width="SIZE" :height="SIZE" viewBox="0 0 320 320" role="img" aria-label="Category performance radar chart">
      <!-- Grid rings -->
      <polygon
        v-for="(ring, r) in rings"
        :key="r"
        :points="ring.points"
        fill="none"
        stroke="var(--muted-foreground)"
        stroke-opacity="0.25"
        stroke-width="1"
      />

      <!-- Ring value labels -->
      <text
        v-for="(ring, r) in rings"
        :key="`label-${r}`"
        :x="CENTER"
        :y="CENTER - RADIUS * ((r + 1) / rings) + 4"
        text-anchor="middle"
        class="fill-muted-foreground"
        font-size="9"
      >
        {{ ring.label }}
      </text>

      <!-- Axis lines -->
      <line
        v-for="(axis, i) in axes"
        :key="`axis-${i}`"
        :x1="axis.x1"
        :y1="axis.y1"
        :x2="axis.x2"
        :y2="axis.y2"
        stroke="var(--muted-foreground)"
        stroke-opacity="0.2"
        stroke-width="1"
      />

      <!-- Axis labels -->
      <text
        v-for="(axis, i) in axes"
        :key="`label-${i}`"
        :x="axis.labelX"
        :y="axis.labelY"
        text-anchor="middle"
        dominant-baseline="middle"
        class="fill-foreground"
        font-size="11"
        font-weight="500"
      >
        {{ axis.label }}
      </text>

      <!-- Data polygon -->
      <polygon
        :points="polygonPoints"
        :fill="color"
        fill-opacity="0.25"
        :stroke="color"
        stroke-width="2"
        stroke-linejoin="round"
      />

      <!-- Vertices + values -->
      <g v-for="(v, i) in vertices" :key="`v-${i}`">
        <circle :cx="v.x" :cy="v.y" :r="3.5" :fill="color" stroke="white" stroke-width="1.5" />
        <text
          v-if="showValues"
          :x="v.x"
          :y="v.y - 8"
          text-anchor="middle"
          class="fill-foreground"
          font-size="10"
          font-weight="600"
        >
          {{ v.value.toFixed(1) }}
        </text>
      </g>
    </svg>
  </div>
</template>
