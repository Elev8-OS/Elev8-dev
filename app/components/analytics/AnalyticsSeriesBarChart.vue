<script setup lang="ts">
import { makeChartTooltip } from '~/components/owner-portal/chart-format'
import { BarChart } from '~/components/ui/chart-bar'

// Bars per trend bucket for two or more series: grouped to compare them
// (bookings vs cancellations), stacked when they add up to a whole (revenue
// per channel). One axis, one unit.
const props = withDefaults(defineProps<{
  title: string
  description: string
  /** `label` plus one numeric field per series key. */
  rows: ReadonlyArray<{ label: string }>
  series: { key: string, label: string, color: string }[]
  type?: 'grouped' | 'stacked'
  formatValue?: (v: number) => string
  formatAxis?: (v: number) => string
  /** Period totals beside the title, e.g. "312 booked". */
  totals?: { label: string, value: string }[]
  testId?: string
}>(), {
  type: 'grouped',
  formatValue: (v: number) => v.toLocaleString('en-US'),
  formatAxis: (v: number) => (Number.isInteger(v) ? v.toLocaleString('en-US') : ''),
})

// The chart reads series by key and shows the key in its legend and tooltip,
// so the rows are re-keyed by label.
const read = (r: { label: string }, key: string) => Number((r as Record<string, unknown>)[key] ?? 0)
const data = computed<Record<string, string | number>[]>(() => props.rows.map(r => ({
  label: r.label,
  ...Object.fromEntries(props.series.map(s => [s.label, read(r, s.key)])),
})))
const categories = computed<string[]>(() => props.series.map(s => s.label))
const tooltip = computed(() => makeChartTooltip(props.formatValue))
const empty = computed(() => props.rows.every(r => props.series.every(s => !read(r, s.key))))

/** At most about eight labels on a dense axis. */
function xLabel(tick: number | Date) {
  const i = Number(tick)
  if (!Number.isInteger(i))
    return ''
  const step = Math.max(1, Math.ceil(data.value.length / 8))
  return i % step === 0 ? String(data.value[i]?.label ?? '') : ''
}
</script>

<template>
  <Card class="flex h-full flex-col" :data-testid="testId">
    <CardHeader>
      <CardTitle class="text-base">
        {{ title }}
      </CardTitle>
      <CardDescription>{{ description }}</CardDescription>
      <CardAction v-if="totals?.length" class="flex flex-col items-end gap-0.5 text-right">
        <span v-for="t in totals" :key="t.label" class="text-xs text-muted-foreground">
          <span class="font-medium tabular-nums text-foreground">{{ t.value }}</span> {{ t.label }}
        </span>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-1 flex-col gap-3">
      <!-- Our own legend: the chart's built-in one is a single right-aligned
           row that spills out of the card with four long names. -->
      <div v-if="series.length > 1" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" data-testid="analytics-series-legend">
        <span v-for="s in series" :key="s.key" class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-full" :style="{ background: s.color }" />
          {{ s.label }}
        </span>
      </div>
      <ClientOnly v-if="!empty">
        <BarChart
          :key="`${type}-${categories.join()}`"
          :data="data"
          :categories="categories"
          index="label"
          :type="type"
          :colors="series.map(s => s.color)"
          :rounded-corners="type === 'grouped' ? 3 : 0"
          :custom-tooltip="tooltip"
          :y-formatter="(tick: number | Date) => formatAxis(Number(tick))"
          :x-formatter="xLabel"
          :show-legend="false"
          class="h-[260px]"
        />
      </ClientOnly>
      <p v-else class="py-10 text-center text-sm text-muted-foreground">
        Nothing in this period
      </p>
    </CardContent>
  </Card>
</template>
