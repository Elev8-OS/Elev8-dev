<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { LineChart } from '~/components/ui/chart-line'

const props = defineProps<{
  series: { period: string, occupancy: number }[]
}>()

const lineData = computed(() => props.series.map(s => ({
  period: s.period,
  occupancy: s.occupancy * 100,
})))

function formatPercent(value: number) {
  return `${value.toFixed(0)}%`
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Occupancy
      </CardTitle>
    </CardHeader>
    <CardContent>
      <LineChart
        :data="lineData"
        :categories="['occupancy']"
        index="period"
        :y-formatter="(tick: number | Date) => formatPercent(Number(tick))"
        :colors="['var(--vis-primary-color)']"
        show-legend
        :show-grid-line="true"
      />
    </CardContent>
  </Card>
</template>
