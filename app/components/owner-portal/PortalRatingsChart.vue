<script setup lang="ts">
import { computed } from 'vue'
import { formatPeriod, makeChartTooltip } from '~/components/owner-portal/chart-format'
import ChartInfo from '~/components/owner-portal/ChartInfo.vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { LineChart } from '~/components/ui/chart-line'

const props = defineProps<{
  series: { period: string, averageRating: number | null, ratingsCount: number }[]
}>()

/** Key doubles as the tooltip label. */
const RATING = 'Rating'

/**
 * Only the score is plotted. Review COUNT used to share this axis, which made
 * the chart unreadable — a month with 12 reviews dwarfed a 4.8 rating, and the
 * y-formatter rendered the count as "12.0" out of 5. The count belongs in the
 * header, where it already is.
 */
const data = computed(() => props.series
  .filter(s => s.averageRating !== null)
  .map(s => ({
    period: formatPeriod(s.period),
    [RATING]: Number(s.averageRating),
  })))

const totalRatings = computed(() => props.series.reduce((sum, r) => sum + r.ratingsCount, 0))

const tooltip = makeChartTooltip((value: number) => `${value.toFixed(1)} out of 5`)

const currentRating = computed(() => {
  for (let i = props.series.length - 1; i >= 0; i--) {
    const entry = props.series[i]
    if (entry && entry.averageRating !== null)
      return entry.averageRating
  }
  return null
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex flex-wrap items-center justify-between gap-2 text-base">
        <span class="flex items-center gap-1.5">
          Guest ratings
          <ChartInfo text="Your average review score for stays that ended that month, out of 5." />
        </span>
        <span class="text-sm font-normal text-muted-foreground">
          <template v-if="currentRating !== null">
            {{ currentRating.toFixed(1) }} out of 5 · {{ totalRatings }} review{{ totalRatings === 1 ? '' : 's' }}
          </template>
          <template v-else>
            No reviews yet
          </template>
        </span>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p v-if="!data.length" class="py-8 text-center text-sm text-muted-foreground">
        No reviews yet — scores will appear here once guests start rating their stay.
      </p>
      <LineChart
        v-else
        :data="data"
        :custom-tooltip="tooltip"
        :categories="[RATING]"
        index="period"
        :y-formatter="(tick: number | Date) => Number(tick).toFixed(1)"
        :colors="['var(--vis-primary-color)']"
        show-legend
      />
    </CardContent>
  </Card>
</template>
