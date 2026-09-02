<script setup lang="ts">
import { computed } from 'vue'
import { formatPeriod, makeChartTooltip } from '~/components/owner-portal/chart-format'
import ChartInfo from '~/components/owner-portal/ChartInfo.vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { BarChart } from '~/components/ui/chart-bar'

const props = defineProps<{
  series: { period: string, adr: number }[]
  currency: string
}>()

/** Key doubles as the legend and tooltip label. */
const RATE = 'ADR'

const barData = computed(() => props.series.map(s => ({
  period: formatPeriod(s.period),
  [RATE]: Math.round(s.adr),
})))

function formatCurrency(amount: number) {
  return `${props.currency} ${Math.round(amount).toLocaleString('id-ID')}`
}

const tooltip = makeChartTooltip(formatCurrency)
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-1.5 text-base">
        ADR
        <ChartInfo text="Average Daily Rate — gross room revenue divided by the nights sold. It is the average price one night went for, before costs." />
      </CardTitle>
    </CardHeader>
    <CardContent>
      <BarChart
        :custom-tooltip="tooltip"
        :data="barData"
        :categories="[RATE]"
        index="period"
        :y-formatter="(tick: number | Date) => formatCurrency(Number(tick))"
        :colors="['var(--vis-secondary-color)']"
        show-legend
      />
    </CardContent>
  </Card>
</template>
