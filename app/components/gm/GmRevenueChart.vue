<script setup lang="ts">
import type { GmPeriodMetrics, GmRevenuePoint } from '~/components/gm/data/gm-dashboard'
import type { GmRevenueRange } from '~/composables/useGmDashboard'
import {
  formatCompactMoney,
  formatDayShort,
  formatMoney,
  formatPercent,
} from '~/components/gm/data/gm-dashboard'
import { makeChartTooltip } from '~/components/owner-portal/chart-format'

const props = withDefaults(
  defineProps<{
    series: GmRevenuePoint[]
    metrics: GmPeriodMetrics
    height?: number
  }>(),
  {
    height: 360,
  },
)

const range = defineModel<GmRevenueRange>('range', { required: true })

const REVENUE = 'Room revenue'

const chartData = computed(() => props.series.map(point => ({
  label: formatDayShort(point.date),
  [REVENUE]: point.revenue,
})))

const tooltip = makeChartTooltip((value: number) => formatMoney(value))
</script>

<template>
  <Card class="@container/card flex h-full flex-col">
    <CardHeader class="pb-2">
      <CardTitle>Revenue trend</CardTitle>
      <CardDescription>
        {{ formatMoney(metrics.revenue) }} booked ·
        {{ formatPercent(metrics.occupancy) }} occupancy ·
        {{ formatMoney(metrics.adr) }} ADR
      </CardDescription>
      <CardAction>
        <ToggleGroup v-model="range" type="single" variant="outline" size="sm">
          <ToggleGroupItem value="14d">
            14 days
          </ToggleGroupItem>
          <ToggleGroupItem value="30d">
            30 days
          </ToggleGroupItem>
        </ToggleGroup>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-1 flex-col min-h-0 pt-0 pb-3">
      <div class="flex-1 min-h-[140px] w-full">
        <BarChart
          :data="chartData"
          :categories="[REVENUE]"
          index="label"
          :colors="['var(--vis-primary-color)']"
          :rounded-corners="4"
          :custom-tooltip="tooltip"
          :y-formatter="(tick: number | Date) => formatCompactMoney(Number(tick))"
          :show-legend="false"
          class="w-full h-full min-h-[140px]"
        />
      </div>
    </CardContent>
  </Card>
</template>
