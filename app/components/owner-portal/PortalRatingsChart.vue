<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { LineChart } from '~/components/ui/chart-line'

const props = defineProps<{
  series: { period: string, averageRating: number | null, ratingsCount: number }[]
}>()

const data = computed(() => props.series.map(s => ({
  period: s.period,
  averageRating: s.averageRating ?? 0,
  ratingsCount: s.ratingsCount,
})))

const totalRatings = computed(() => props.series.reduce((s, r) => s + r.ratingsCount, 0))
const currentRating = computed(() => {
  for (let i = props.series.length - 1; i >= 0; i--) {
    const r = props.series[i]
    if (r && r.averageRating !== null)
      return r.averageRating
  }
  return null
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center justify-between text-base">
        <span>Guest ratings</span>
        <span class="text-sm font-normal text-muted-foreground">
          <template v-if="currentRating !== null">
            {{ currentRating.toFixed(1) }} avg · {{ totalRatings }} reviews
          </template>
          <template v-else>No ratings yet</template>
        </span>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <LineChart
        :data="data"
        :categories="['averageRating', 'ratingsCount']"
        index="period"
        :y-formatter="(tick: number | Date) => Number(tick).toFixed(1)"
        :colors="['var(--vis-primary-color)', 'var(--vis-secondary-color)']"
        show-legend
      />
    </CardContent>
  </Card>
</template>
