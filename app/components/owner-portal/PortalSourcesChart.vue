<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { BarChart } from '~/components/ui/chart-bar'

const props = defineProps<{
  series: Record<string, number>[]
  currency: string
}>()

const categories = computed(() => {
  const set = new Set<string>()
  for (const row of props.series) {
    for (const key of Object.keys(row)) {
      if (key !== 'period')
        set.add(key)
    }
  }
  return Array.from(set)
})

const data = computed(() => props.series.map((row) => {
  const out: Record<string, number | string> = { period: String(row.period) }
  for (const cat of categories.value) out[cat] = (row[cat] as number) ?? 0
  return out
}))

function formatCurrency(amount: number) {
  return `${props.currency} ${Math.round(amount).toLocaleString()}`
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Booking sources
      </CardTitle>
    </CardHeader>
    <CardContent>
      <BarChart
        :data="data"
        :categories="categories"
        index="period"
        :y-formatter="(tick: number | Date) => formatCurrency(Number(tick))"
        :colors="['var(--vis-primary-color)', 'var(--vis-secondary-color)', '#f59e0b', '#10b981', '#8b5cf6']"
        show-legend
      />
    </CardContent>
  </Card>
</template>
