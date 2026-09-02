<script setup lang="ts">
import { computed } from 'vue'
import { formatPeriod, makeChartTooltip } from '~/components/owner-portal/chart-format'
import ChartInfo from '~/components/owner-portal/ChartInfo.vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { AreaChart } from '~/components/ui/chart-area'

const props = defineProps<{
  series: { period: string, grossRevenue: number, netRevenue: number }[]
  priorYearSeries?: { period: string, grossRevenue: number }[]
  currency: string
}>()

// The keys below become the legend and tooltip labels, so they are written as
// the owner should read them.
const GROSS = 'Gross'
const NET = 'Net'
const PRIOR = 'Last year'

type RevenueKey = typeof GROSS | typeof NET | typeof PRIOR

const categories = computed<RevenueKey[]>(() =>
  props.priorYearSeries?.length ? [GROSS, NET, PRIOR] : [GROSS, NET])

const data = computed(() => {
  const priorByPeriod = new Map((props.priorYearSeries ?? []).map(s => [s.period, s.grossRevenue]))
  return props.series.map(s => ({
    period: formatPeriod(s.period),
    [GROSS]: s.grossRevenue,
    [NET]: s.netRevenue,
    [PRIOR]: priorByPeriod.get(s.period) ?? null,
  }))
})

function formatCurrency(amount: number) {
  return `${props.currency} ${Math.round(amount).toLocaleString('id-ID')}`
}

const tooltip = makeChartTooltip(formatCurrency)
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-1.5 text-base">
        Revenue
        <ChartInfo text="Gross is everything guests paid. Net is what reaches you after commission, platform fees, taxes and operating costs." />
      </CardTitle>
    </CardHeader>
    <CardContent>
      <AreaChart
        :custom-tooltip="tooltip"
        :data="data"
        :categories="categories"
        index="period"
        :colors="['var(--vis-primary-color)', 'var(--vis-secondary-color)', '#94a3b8']"
        :y-formatter="(tick: number | Date) => formatCurrency(Number(tick))"
        show-legend
      />
    </CardContent>
  </Card>
</template>
