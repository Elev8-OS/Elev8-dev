<script setup lang="ts">
import type { PacePoint } from '~/components/analytics/data/analytics'
import { makeChartTooltip } from '~/components/owner-portal/chart-format'
import { BarChart } from '~/components/ui/chart-bar'

const props = defineProps<{ points: PacePoint[] }>()

// The keys double as legend and tooltip labels.
const NOW = 'On the books'
const LAST_YEAR = 'Same time last year'

const data = computed(() => props.points.map(p => ({
  label: p.label,
  [NOW]: Math.round(p.onBooks * 100),
  [LAST_YEAR]: Math.round(p.lastYear * 100),
})))

const next90 = computed(() => {
  const head = props.points.slice(0, 3)
  if (!head.length)
    return null
  const now = head.reduce((s, p) => s + p.onBooks, 0) / head.length
  const before = head.reduce((s, p) => s + p.lastYear, 0) / head.length
  return { now, delta: now - before }
})

const tooltip = makeChartTooltip(value => `${value}%`)
</script>

<template>
  <Card class="flex h-full flex-col" data-testid="analytics-pace-chart">
    <CardHeader>
      <CardTitle>Booking pace</CardTitle>
      <CardDescription>Occupancy already booked for the coming months, against the same day last year</CardDescription>
      <CardAction v-if="next90" class="text-right">
        <div class="text-sm font-medium tabular-nums">
          {{ Math.round(next90.now * 100) }}% next 3 months
        </div>
        <div
          class="text-xs tabular-nums"
          :class="next90.delta >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'"
        >
          {{ next90.delta >= 0 ? '+' : '' }}{{ (next90.delta * 100).toFixed(1) }} pts vs last year
        </div>
      </CardAction>
    </CardHeader>
    <CardContent class="flex-1">
      <ClientOnly>
        <BarChart
          :data="data"
          :categories="[NOW, LAST_YEAR]"
          index="label"
          :colors="['var(--viz-1)', 'var(--muted-foreground)']"
          :rounded-corners="4"
          :custom-tooltip="tooltip"
          :y-formatter="(tick: number | Date) => `${tick}%`"
          class="h-[260px]"
        />
      </ClientOnly>
    </CardContent>
  </Card>
</template>
