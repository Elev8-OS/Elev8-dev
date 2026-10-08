<script setup lang="ts">
import type { ListingPerformanceRow } from '~/components/analytics/data/analytics'
import { formatOwnerMoneyRounded } from '~/components/owners/data/owner-money'

// Listings ranked by revenue as horizontal bars: names stay readable at any
// length, which a vertical bar chart's axis cannot do.
const props = defineProps<{
  ranked: ListingPerformanceRow[]
  /** Listings earning in another currency, left out of the ranking. */
  otherCurrency: number
  currency: string
  basisLabel: string
}>()

const SHOWN = 10
const end = ref<'top' | 'bottom'>('top')

const rows = computed(() => end.value === 'top'
  ? props.ranked.slice(0, SHOWN)
  : props.ranked.slice(-SHOWN).reverse())
const max = computed(() => Math.max(...props.ranked.map(r => r.revenue), 0))
</script>

<template>
  <Card class="flex h-full flex-col" data-testid="analytics-listing-revenue">
    <CardHeader>
      <CardTitle class="text-base">
        Revenue by listing
      </CardTitle>
      <CardDescription>
        {{ basisLabel }}, {{ currency }} listings<template v-if="otherCurrency">
          ({{ otherCurrency }} in another currency not ranked; switch currency to see them)
        </template>
      </CardDescription>
      <CardAction>
        <ToggleGroup
          :model-value="end"
          type="single"
          variant="outline"
          size="sm"
          aria-label="Ranking end"
          @update:model-value="(v) => v && (end = v as 'top' | 'bottom')"
        >
          <ToggleGroupItem value="top" class="px-2.5 text-xs">
            Top {{ SHOWN }}
          </ToggleGroupItem>
          <ToggleGroupItem value="bottom" class="px-2.5 text-xs">
            Bottom {{ SHOWN }}
          </ToggleGroupItem>
        </ToggleGroup>
      </CardAction>
    </CardHeader>
    <CardContent class="flex-1">
      <ol v-if="rows.length" class="flex flex-col gap-2.5">
        <li v-for="row in rows" :key="row.listingId" class="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3" data-testid="analytics-listing-revenue-row">
          <span class="truncate text-sm" :title="row.listingName">{{ row.listingName }}</span>
          <div class="h-2.5 rounded-full bg-muted">
            <div class="h-full rounded-full" :style="{ width: `${max ? (row.revenue / max) * 100 : 0}%`, background: 'var(--viz-1)' }" />
          </div>
          <span class="text-right text-sm tabular-nums">{{ formatOwnerMoneyRounded(row.revenue, currency) }}</span>
        </li>
      </ol>
      <p v-else class="py-10 text-center text-sm text-muted-foreground">
        No {{ currency }} listings in scope
      </p>
    </CardContent>
  </Card>
</template>
