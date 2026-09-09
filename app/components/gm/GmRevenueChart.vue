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

const props = defineProps<{
  series: GmRevenuePoint[]
  metrics: GmPeriodMetrics
}>()

const range = defineModel<GmRevenueRange>('range', { required: true })

const REVENUE = 'Room revenue'

const chartData = computed(() => props.series.map(point => ({
  label: formatDayShort(point.date),
  [REVENUE]: point.revenue,
})))

const tooltip = makeChartTooltip((value: number) => formatMoney(value))
</script>

<template>
  <Card class="@container/card">
    <CardHeader>
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
    <CardContent>
      <BarChart
        :data="chartData"
        :categories="[REVENUE]"
        index="label"
        :colors="['var(--vis-primary-color)']"
        :rounded-corners="4"
        :custom-tooltip="tooltip"
        :y-formatter="(tick: number | Date) => formatCompactMoney(Number(tick))"
        :show-legend="false"
        class="h-[240px]"
      />
    </CardContent>
  </Card>
</template>
