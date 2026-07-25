<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { BarChart } from '~/components/ui/chart-bar'
import { LineChart } from '~/components/ui/chart-line'

const props = defineProps<{
  series: { period: string, occupancy: number, adr: number }[]
  currency: string
}>()

const lineData = computed(() => props.series.map(s => ({
  period: s.period,
  occupancy: s.occupancy * 100,
})))

const barData = computed(() => props.series.map(s => ({
  period: s.period,
  adr: s.adr,
})))

function formatPercent(value: number) {
  return `${value.toFixed(0)}%`
}

function formatCurrency(amount: number) {
  return `${props.currency} ${Math.round(amount).toLocaleString()}`
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Occupancy &amp; ADR
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div class="space-y-4">
        <div>
          <p class="mb-1 text-xs text-muted-foreground">
            Occupancy
          </p>
          <LineChart
            :data="lineData"
            :categories="['occupancy']"
            index="period"
            :y-formatter="(tick: number | Date) => formatPercent(Number(tick))"
            :colors="['var(--vis-primary-color)']"
            show-legend
            :show-grid-line="true"
          />
        </div>
        <div>
          <p class="mb-1 text-xs text-muted-foreground">
            ADR
          </p>
          <BarChart
            :data="barData"
            :categories="['adr']"
            index="period"
            :y-formatter="(tick: number | Date) => formatCurrency(Number(tick))"
            :colors="['var(--vis-secondary-color)']"
            show-legend
          />
        </div>
      </div>
    </CardContent>
  </Card>
</template>
