<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { LineChart } from '~/components/ui/chart-line'
import ReviewAnalyticsTrendTooltip from './ReviewAnalyticsTrendTooltip.vue'

const { trendPoints, comparisonMode } = useReviewAnalytics()

// Clean legend labels based on the selected comparison mode
const comparisonLabel = computed(() => comparisonMode.value === 'previous_year' ? 'Last year' : 'Previous period')

const legendLabels = computed(() => ({
  averageScore: 'Selected period',
  averageScoreComparison: comparisonLabel.value,
  fiveStarRate: 'Selected period',
  fiveStarRateComparison: comparisonLabel.value,
}))

const comparisonHint = computed(() => comparisonMode.value === 'previous_year'
  ? 'Weekly average compared with the same week one year earlier.'
  : 'Weekly average compared with the same number of days immediately before the selected period.')

// Explicit chart colors (indigo + slate) so charts stay readable regardless of theme
const CHART_PRIMARY = '#6366f1'
const CHART_COMPARISON = '#94a3b8'
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-2">
    <!-- Average Review Score -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Average Review Score {{ comparisonMode === 'previous_year' ? 'vs last year' : 'vs previous period' }}
        </CardTitle>
        <p class="text-xs text-muted-foreground">
          {{ comparisonHint }}
        </p>
      </CardHeader>
      <CardContent class="pb-6">
        <LineChart
          :data="trendPoints"
          :categories="['averageScore', 'averageScoreComparison']"
          :legend-labels="legendLabels"
          :custom-tooltip="ReviewAnalyticsTrendTooltip"
          index="period"
          :colors="[CHART_PRIMARY, CHART_COMPARISON]"
          :y-formatter="(tick: number | Date) => Number(tick).toFixed(1)"
          :x-formatter="(tick: number | Date, i: number) => String(trendPoints[i]?.period ?? '').slice(5)"
          show-legend
        />
      </CardContent>
    </Card>

    <!-- 5-Star Review Rate -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          5-Star Review Rate {{ comparisonMode === 'previous_year' ? 'vs last year' : 'vs previous period' }}
        </CardTitle>
        <p class="text-xs text-muted-foreground">
          {{ comparisonHint }}
        </p>
      </CardHeader>
      <CardContent class="pb-6">
        <LineChart
          :data="trendPoints"
          :categories="['fiveStarRate', 'fiveStarRateComparison']"
          :legend-labels="legendLabels"
          :custom-tooltip="ReviewAnalyticsTrendTooltip"
          index="period"
          :colors="[CHART_PRIMARY, CHART_COMPARISON]"
          :y-formatter="(tick: number | Date) => `${Number(tick).toFixed(0)}%`"
          :x-formatter="(tick: number | Date, i: number) => String(trendPoints[i]?.period ?? '').slice(5)"
          show-legend
        />
      </CardContent>
    </Card>
  </div>
</template>
