<script setup lang="ts">
import { computed } from 'vue'
import { formatPeriod, makeChartTooltip } from '~/components/owner-portal/chart-format'
import ChartInfo from '~/components/owner-portal/ChartInfo.vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { LineChart } from '~/components/ui/chart-line'

const props = defineProps<{
  series: { period: string, occupancy: number }[]
}>()

/** Key doubles as the legend and tooltip label. */
const BOOKED = 'Occupancy'

const lineData = computed(() => props.series.map(s => ({
  period: formatPeriod(s.period),
  [BOOKED]: Math.round(s.occupancy * 100),
})))

const tooltip = makeChartTooltip((value: number) => `${value.toFixed(0)}%`)
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-1.5 text-base">
        Occupancy
        <ChartInfo text="The share of available nights that were booked. 100% means every night was sold." />
      </CardTitle>
    </CardHeader>
    <CardContent>
      <LineChart
        :custom-tooltip="tooltip"
        :data="lineData"
        :categories="[BOOKED]"
        index="period"
        :y-formatter="(tick: number | Date) => `${Number(tick).toFixed(0)}%`"
        :colors="['var(--vis-primary-color)']"
        show-legend
        :show-grid-line="true"
      />
    </CardContent>
  </Card>
</template>
