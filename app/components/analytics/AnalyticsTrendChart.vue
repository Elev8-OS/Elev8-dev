<script setup lang="ts">
import type { PeriodPerformance, TrendGrain, TrendPoint } from '~/components/analytics/data/analytics'
import { formatCompactMoney, spanDays } from '~/components/analytics/data/analytics'
import { makeChartTooltip } from '~/components/owner-portal/chart-format'
import { formatOwnerMoneyRounded } from '~/components/owners/data/owner-money'
import { LineChart } from '~/components/ui/chart-line'

const props = defineProps<{
  points: TrendPoint[]
  currency: string
  grain: TrendGrain
  compareLabel: string
}>()

type Metric = 'revenue' | 'occupancy' | 'adr' | 'revpar'

const METRICS: { value: Metric, label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'occupancy', label: 'Occupancy' },
  { value: 'adr', label: 'ADR' },
  { value: 'revpar', label: 'RevPAR' },
]
const metric = ref<Metric>('revenue')

// The keys double as legend and tooltip labels.
const CURRENT = 'This period'
const PREVIOUS = 'Comparison'

function read(p: PeriodPerformance, m: Metric): number {
  return m === 'occupancy' ? Math.round(p.occupancy * 1000) / 10 : Math.round(p[m])
}

/** Comparison turned off: no second line, and no empty legend entry for it. */
const hasComparison = computed(() => props.points.some(p => p.previous))
const categories = computed<(typeof CURRENT | typeof PREVIOUS)[]>(() => hasComparison.value ? [CURRENT, PREVIOUS] : [CURRENT])

const data = computed(() => props.points.map(p => ({
  label: p.label,
  [CURRENT]: read(p.current, metric.value),
  // A bucket with no counterpart is absent, not zero.
  [PREVIOUS]: p.previous ? read(p.previous, metric.value) : null,
})))

const isPercent = computed(() => metric.value === 'occupancy')
const format = (v: number) => isPercent.value ? `${v}%` : formatOwnerMoneyRounded(v, props.currency)
const formatAxis = (v: number) => isPercent.value ? `${v}%` : formatCompactMoney(v, props.currency)

// Rebuilt with the metric so the tooltip formats in the right unit.
const tooltip = computed(() => makeChartTooltip(format))

/** Totals in a cut-off week or month look like a collapse, so the chart says so. */
const partialNote = computed(() => {
  if (metric.value !== 'revenue')
    return null
  const cut = props.points.filter(p => p.partial)
  if (!cut.length)
    return null
  return `${cut.map(p => `${p.label} (${spanDays(p.span)} ${spanDays(p.span) === 1 ? 'day' : 'days'})`).join(' and ')} ${cut.length === 1 ? 'is' : 'are'} only partly inside the period, so ${cut.length === 1 ? 'its total is' : 'their totals are'} lower.`
})

const grainLabel = computed(() => ({ day: 'Daily', week: 'Weekly', month: 'Monthly' })[props.grain])
</script>

<template>
  <Card class="flex h-full flex-col" data-testid="analytics-trend-chart">
    <CardHeader class="max-sm:has-data-[slot=card-action]:grid-cols-1">
      <CardTitle>Performance trend</CardTitle>
      <CardDescription>{{ [grainLabel, compareLabel, isPercent ? '' : currency].filter(Boolean).join(', ') }}</CardDescription>
      <!-- Under the title on phones, where four toggles do not fit beside it. -->
      <CardAction class="col-start-1 row-span-1 row-start-3 justify-self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end">
        <ToggleGroup
          :model-value="metric"
          type="single"
          variant="outline"
          size="sm"
          @update:model-value="(v) => v && (metric = v as Metric)"
        >
          <ToggleGroupItem v-for="m in METRICS" :key="m.value" :value="m.value" class="px-2.5 text-xs">
            {{ m.label }}
          </ToggleGroupItem>
        </ToggleGroup>
      </CardAction>
    </CardHeader>
    <CardContent class="flex-1">
      <ClientOnly>
        <LineChart
          :key="`${metric}-${categories.length}`"
          :data="data"
          :categories="categories"
          index="label"
          :colors="['var(--viz-1)', 'var(--muted-foreground)'].slice(0, categories.length)"
          :show-legend="categories.length > 1"
          :custom-tooltip="tooltip"
          :y-formatter="(tick: number | Date) => formatAxis(Number(tick))"
          :x-formatter="(tick: number | Date) => Number.isInteger(tick) ? (data[Number(tick)]?.label ?? '') : ''"
          class="h-[300px]"
        />
      </ClientOnly>
      <!-- LineChart spills its legend height below its own box, hence the wide gap. -->
      <p v-if="partialNote" class="mt-10 text-xs text-muted-foreground" data-testid="analytics-trend-partial">
        {{ partialNote }}
      </p>
    </CardContent>
  </Card>
</template>
