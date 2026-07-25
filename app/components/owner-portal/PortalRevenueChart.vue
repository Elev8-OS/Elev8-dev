<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { AreaChart } from '~/components/ui/chart-area'

const props = defineProps<{
  series: { period: string, grossRevenue: number, netRevenue: number }[]
  priorYearSeries?: { period: string, grossRevenue: number }[]
  currency: string
}>()

const data = computed(() => {
  const yoyByPeriod = new Map((props.priorYearSeries ?? []).map(s => [s.period, s.grossRevenue]))
  return props.series.map((s) => {
    const row: Record<string, string | number | null> = { period: s.period, gross: s.grossRevenue, net: s.netRevenue }
    row.prior = yoyByPeriod.get(s.period) ?? null
    return row
  })
})

function formatCurrency(amount: number) {
  return `${props.currency} ${Math.round(amount).toLocaleString()}`
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Revenue trend
      </CardTitle>
    </CardHeader>
    <CardContent>
      <AreaChart
        :data="data"
        :categories="['gross', 'net', 'prior']"
        index="period"
        :colors="['var(--vis-primary-color)', 'var(--vis-secondary-color)', '#94a3b8']"
        :y-formatter="(tick: number | Date) => formatCurrency(Number(tick))"
        show-legend
      />
    </CardContent>
  </Card>
</template>
