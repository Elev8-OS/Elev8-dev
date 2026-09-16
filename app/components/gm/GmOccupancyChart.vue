<script setup lang="ts">
import type { GmDayFlow } from '~/components/gm/data/gm-dashboard'
import { formatDayShort, formatPercent } from '~/components/gm/data/gm-dashboard'
import { makeChartTooltip } from '~/components/owner-portal/chart-format'

const props = withDefaults(
  defineProps<{
    days: GmDayFlow[]
    anchorDate: string
    height?: number
  }>(),
  {
    height: 360,
  },
)

// The keys double as the legend and tooltip labels.
const ARRIVALS = 'Check-ins'
const DEPARTURES = 'Check-outs'

/**
 * Bidirectional: check-ins stack above the zero line, check-outs below it, so
 * a heavy turnover day reads as one tall column split by the axis.
 */
const chartData = computed(() => props.days.map(day => ({
  label: formatDayShort(day.date),
  [ARRIVALS]: day.arrivals,
  [DEPARTURES]: -day.departures,
})))

/** Both series read as counts, so the sign is stripped for display. */
const tooltip = makeChartTooltip((value: number) => `${Math.abs(value)}`)

const peakTurnover = computed(() =>
  props.days.reduce((max, day) => Math.max(max, day.arrivals + day.departures), 0))

const nextSevenNights = computed(() => {
  const ahead = props.days.filter(day => day.date >= props.anchorDate).slice(0, 7)
  if (!ahead.length)
    return 0
  return ahead.reduce((sum, day) => sum + day.occupancy, 0) / ahead.length
})
</script>

<template>
  <Card class="@container/card flex h-full flex-col">
    <CardHeader class="pb-2">
      <CardTitle>Occupancy flow</CardTitle>
      <CardDescription>
        Check-ins above the line, check-outs below — next {{ days.length }} days
      </CardDescription>
      <CardAction class="text-right">
        <div class="text-sm font-medium tabular-nums">
          {{ formatPercent(nextSevenNights) }}
        </div>
        <div class="text-xs text-muted-foreground">
          avg. next 7 nights
        </div>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-1 flex-col min-h-0 pt-0 pb-3 justify-between">
      <div class="flex-1 min-h-[140px] w-full">
        <BarChart
          :data="chartData"
          :categories="[ARRIVALS, DEPARTURES]"
          index="label"
          type="stacked"
          :colors="['var(--vis-primary-color)', 'var(--vis-secondary-color)']"
          :rounded-corners="4"
          :custom-tooltip="tooltip"
          :y-formatter="(tick: number | Date) => `${Math.abs(Number(tick))}`"
          class="w-full h-full min-h-[140px]"
        />
      </div>
      <p class="text-xs text-muted-foreground pt-2 shrink-0">
        Busiest turnover in this window: {{ peakTurnover }} movements in a day.
      </p>
    </CardContent>
  </Card>
</template>
