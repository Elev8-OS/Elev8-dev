<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { BarChart } from '~/components/ui/chart-bar'
import { RadarChart } from '~/components/ui/chart-radar'
import ReviewAnalyticsCategoryTooltip from './ReviewAnalyticsCategoryTooltip.vue'

const { categoryPerformance, categoryTags } = useReviewAnalytics()

// Data for the "Avg Review Score by Category" bar chart
const barData = computed(() => {
  return categoryPerformance.value.map(c => ({
    category: c.label,
    score: c.score,
  }))
})

// Data for the radar chart (6 categories, 0-10 scale)
const radarData = computed(() => {
  return categoryPerformance.value.map(c => ({
    label: c.label,
    value: c.score,
  }))
})

// Max mention count across all tags → used to scale bar widths
const maxTagCount = computed(() => {
  let max = 0
  categoryTags.value.forEach((g) => {
    g.positive.forEach((t) => { max = Math.max(max, t.count) })
    g.negative.forEach((t) => { max = Math.max(max, t.count) })
  })
  return max || 1
})

// Bar width as a percentage of the track (relative to the max count)
function barWidth(count: number) {
  return `${Math.max(4, Math.round((count / maxTagCount.value) * 100))}%`
}

// Explicit chart color (indigo) so charts stay readable regardless of theme
const CHART_PRIMARY = '#6366f1'
</script>

<template>
  <div class="space-y-4">
    <!-- Category Performance -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Category Performance
        </CardTitle>
      </CardHeader>
      <CardContent class="pb-6">
        <div class="grid gap-6 lg:grid-cols-2">
          <!-- Radar chart -->
          <RadarChart :data="radarData" :max-value="10" :color="CHART_PRIMARY" />
          <!-- Score cards -->
          <div class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="cat in categoryPerformance"
              :key="cat.category"
              class="rounded-lg border bg-card p-3"
            >
              <div class="flex items-center justify-between">
                <p class="text-sm font-medium">
                  {{ cat.label }}
                </p>
                <span class="text-lg font-bold">
                  {{ cat.score.toFixed(2) }}<span class="text-xs font-normal text-muted-foreground">/10</span>
                </span>
              </div>
              <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <ReviewAnalyticsDeltaBadge
                  :value="cat.wow"
                  label="vs last week"
                  hint="Change compared with the previous period"
                />
                <ReviewAnalyticsDeltaBadge
                  :value="cat.yoy"
                  label="vs last year"
                  hint="Change compared with the same week last year"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Category Tags -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Category Tags
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="categoryTags.length > 0" class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="group in categoryTags" :key="group.category" class="space-y-3">
            <p class="text-sm font-medium">
              {{ group.label }}
            </p>

            <!-- Positive tags -->
            <div v-if="group.positive.length > 0" class="space-y-1.5">
              <div v-for="tag in group.positive" :key="tag.tag" class="flex items-center gap-2">
                <span class="w-40 shrink-0 truncate text-xs text-muted-foreground" :title="tag.label">
                  {{ tag.label }}
                </span>
                <div class="h-2.5 flex-1 rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-emerald-500"
                    :style="{ width: barWidth(tag.count) }"
                    :title="`${tag.count} mention${tag.count !== 1 ? 's' : ''}`"
                  />
                </div>
                <span class="w-12 shrink-0 text-right text-xs font-medium">
                  {{ tag.count }}
                </span>
              </div>
            </div>
            <p v-else class="text-xs text-muted-foreground">
              No positive tags
            </p>

            <!-- Negative tags -->
            <div v-if="group.negative.length > 0" class="space-y-1.5">
              <div v-for="tag in group.negative" :key="tag.tag" class="flex items-center gap-2">
                <span class="w-40 shrink-0 truncate text-xs text-muted-foreground" :title="tag.label">
                  {{ tag.label }}
                </span>
                <div class="h-2.5 flex-1 rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-red-500"
                    :style="{ width: barWidth(tag.count) }"
                    :title="`${tag.count} mention${tag.count !== 1 ? 's' : ''}`"
                  />
                </div>
                <span class="w-12 shrink-0 text-right text-xs font-medium">
                  {{ tag.count }}
                </span>
              </div>
            </div>
            <p v-else class="text-xs text-muted-foreground">
              No negative tags
            </p>
          </div>
        </div>
        <p v-else class="text-sm text-muted-foreground">
          No category data available.
        </p>
      </CardContent>
    </Card>

    <!-- Avg Review Score by Category -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">
          Avg. Review Score by Category
        </CardTitle>
      </CardHeader>
      <CardContent class="pb-6">
        <BarChart
          :data="barData"
          :categories="['score']"
          :custom-tooltip="ReviewAnalyticsCategoryTooltip"
          index="category"
          :colors="[CHART_PRIMARY]"
          :y-formatter="(tick: number | Date) => Number(tick).toFixed(1)"
          :show-legend="false"
        />
      </CardContent>
    </Card>
  </div>
</template>
