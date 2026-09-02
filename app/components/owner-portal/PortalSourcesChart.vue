<script setup lang="ts">
import type { OwnerSourcesRow } from '~/composables/useOwnerDashboard'
import { computed } from 'vue'
import { formatChannel, formatPeriod, makeChartTooltip } from '~/components/owner-portal/chart-format'
import ChartInfo from '~/components/owner-portal/ChartInfo.vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { BarChart } from '~/components/ui/chart-bar'

const props = defineProps<{
  series: OwnerSourcesRow[]
  currency: string
}>()

/** Raw channel keys (`booking_com`) in, readable labels out — they become the legend. */
const channels = computed(() => {
  const keys = new Set<string>()
  for (const row of props.series) {
    for (const key of Object.keys(row)) {
      if (key !== 'period')
        keys.add(key)
    }
  }
  return Array.from(keys).map(key => ({ key, label: formatChannel(key) }))
})

const categories = computed(() => channels.value.map(c => c.label))

const data = computed(() => props.series.map((row) => {
  const out: Record<string, number | string> = { period: formatPeriod(row.period) }
  for (const channel of channels.value)
    out[channel.label] = Number(row[channel.key] ?? 0)
  return out
}))

function formatCurrency(amount: number) {
  return `${props.currency} ${Math.round(amount).toLocaleString('id-ID')}`
}

const tooltip = makeChartTooltip(formatCurrency)
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-1.5 text-base">
        Booking sources
        <ChartInfo text="Gross revenue split by the channel the booking came through. Direct bookings carry no platform fee." />
      </CardTitle>
    </CardHeader>
    <CardContent>
      <BarChart
        :custom-tooltip="tooltip"
        :data="data"
        :categories="categories"
        index="period"
        :y-formatter="(tick: number | Date) => formatCurrency(Number(tick))"
        :colors="['var(--vis-primary-color)', 'var(--vis-secondary-color)', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9']"
        show-legend
      />
    </CardContent>
  </Card>
</template>
