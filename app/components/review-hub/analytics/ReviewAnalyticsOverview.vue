<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardContent } from '~/components/ui/card'

const {
  overallScoreDisplay,
  ratedCount,
  starRate,
  topNegativeTags,
  listingStatuses,
  wowDelta,
  cmpDelta,
  starWowDelta,
  starCmpDelta,
  comparisonMode,
  channelFilter,
} = useReviewAnalytics()

// Label for the comparison delta, matching the selected comparison mode
const cmpLabel = computed(() => comparisonMode.value === 'previous_year' ? 'vs last year' : 'vs prev. period')
const cmpHint = computed(() => comparisonMode.value === 'previous_year'
  ? 'Change compared with the same week last year'
  : 'Change compared with the previous period of the same length')
</script>

<template>
  <div class="space-y-4">
    <!-- KPI row -->
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <!-- Overall review score -->
      <ReviewAnalyticsStatCard
        label="Overall Review Score"
        :value="overallScoreDisplay !== null ? `${overallScoreDisplay.toFixed(2)} / 10` : '-'"
        :sublabel="`based on ${ratedCount} reviews`"
        icon="lucide:star"
      >
        <div class="flex flex-wrap gap-x-3 gap-y-1 pt-1">
          <ReviewAnalyticsDeltaBadge
            :value="wowDelta"
            label="vs last week"
            hint="Change compared with the previous 30-day period"
          />
          <ReviewAnalyticsDeltaBadge
            :value="cmpDelta"
            :label="cmpLabel"
            :hint="cmpHint"
          />
        </div>
      </ReviewAnalyticsStatCard>

      <!-- 5-star review rate -->
      <ReviewAnalyticsStatCard
        label="5-Star Review Rate"
        :value="`${starRate.toFixed(2)} %`"
        sublabel="Share of reviews rated 5 stars"
        icon="lucide:gauge"
      >
        <div class="flex flex-wrap gap-x-3 gap-y-1 pt-1">
          <ReviewAnalyticsDeltaBadge
            :value="starWowDelta"
            label="vs last week"
            suffix="%"
            hint="Change compared with the previous 30-day period"
          />
          <ReviewAnalyticsDeltaBadge
            :value="starCmpDelta"
            :label="cmpLabel"
            :hint="cmpHint"
            suffix="%"
          />
        </div>
      </ReviewAnalyticsStatCard>

      <!-- Top negative tags -->
      <Card class="sm:col-span-2 xl:col-span-2">
        <CardContent class="space-y-2 p-4">
          <div class="flex items-center justify-between">
            <p class="text-xs font-medium text-muted-foreground">
              Top Negative Tags
            </p>
            <Icon name="lucide:alert-triangle" class="size-4 text-muted-foreground" />
          </div>
          <div v-if="topNegativeTags.length > 0" class="space-y-1.5">
            <div v-for="(tag, i) in topNegativeTags" :key="tag.tag" class="flex items-center justify-between gap-2 text-sm">
              <span class="flex items-center gap-2 min-w-0">
                <span class="text-xs text-muted-foreground w-4 shrink-0">{{ i + 1 }}</span>
                <span class="truncate">{{ tag.label }}</span>
              </span>
              <span class="text-xs text-muted-foreground shrink-0">{{ tag.percentage.toFixed(1) }}%</span>
            </div>
          </div>
          <p v-else class="text-sm text-muted-foreground">
            No negative tags found.
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- Listing statuses -->
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="status in listingStatuses" :key="status.label" class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between">
          <p class="text-xs font-medium text-muted-foreground">
            {{ status.label }}
          </p>
          <Icon v-if="status.viewListings" name="lucide:external-link" class="size-3.5 text-muted-foreground" />
        </div>
        <p class="mt-1 text-2xl font-bold">
          {{ status.count }}<span class="text-sm font-normal text-muted-foreground"> / {{ status.total }}</span>
        </p>
        <button
          v-if="status.viewListings"
          type="button"
          class="mt-1 text-xs text-primary hover:underline"
          @click="channelFilter = 'all'"
        >
          View listings
        </button>
      </div>
    </div>
  </div>
</template>
