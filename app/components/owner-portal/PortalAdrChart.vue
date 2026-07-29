<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { BarChart } from '~/components/ui/chart-bar'

const props = defineProps<{
  series: { period: string, adr: number }[]
  currency: string
}>()

const barData = computed(() => props.series.map(s => ({
  period: s.period,
  adr: s.adr,
})))

function formatCurrency(amount: number) {
  return `${props.currency} ${Math.round(amount).toLocaleString()}`
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        ADR
      </CardTitle>
    </CardHeader>
    <CardContent>
      <BarChart
        :data="barData"
        :categories="['adr']"
        index="period"
        :y-formatter="(tick: number | Date) => formatCurrency(Number(tick))"
        :colors="['var(--vis-secondary-color)']"
        show-legend
      />
    </CardContent>
  </Card>
</template>
