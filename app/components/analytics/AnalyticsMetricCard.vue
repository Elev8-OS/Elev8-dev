<script setup lang="ts">
import type { BulletLegendItemInterface } from '@unovis/ts'
import { Axis, CurveType } from '@unovis/ts'
import { VisAxis, VisLine, VisScatter, VisXYContainer } from '@unovis/vue'
import { useMounted } from '@vueuse/core'
import { makeChartTooltip } from '~/components/owner-portal/chart-format'
import { ChartCrosshair } from '~/components/ui/chart'

// One measure over the period: a headline figure, the dates it covers, and a
// line with a dot per bucket on an axis that starts at zero. Four of these
// side by side replace a single chart with a metric switch.
const props = defineProps<{
  title: string
  /** The figure for the whole period, already formatted. */
  value: string
  /** The dates the figure covers. */
  periodLabel: string
  /** `previous` is the comparison bucket in the same position; null where it has none. */
  points: { label: string, value: number | null, previous?: number | null }[]
  /** Axis ticks and tooltip values. */
  formatAxis: (v: number) => string
  formatTooltip: (v: number) => string
  /** Fixed top of the axis (100 for a percentage); otherwise a round number above the highest point. */
  max?: number
  /** Change against the comparison period, already formatted and judged. */
  delta?: { text: string, trend: 'up' | 'down' | 'flat', label: string }
  /** A caveat under the chart, e.g. a partial month. */
  note?: string | null
  /** How the headline figure is reached, e.g. gross down to net. */
  breakdown?: { label: string, value: string, total?: boolean }[]
  /** e.g. "vs previous period"; empty with comparison off. */
  compareLabel?: string
}>()

const COLOR = 'var(--viz-1)'
/** The comparison is context, not a second series to read first: muted and dashed. */
const COMPARE_COLOR = 'var(--muted-foreground)'
const CURRENT = 'This period'
const PREVIOUS = 'Comparison'

const hasComparison = computed(() => props.points.some(p => p.previous !== null && p.previous !== undefined))
const TICK_STEPS = 4

/** 0 to a round top, split into four even steps, so gridlines land on readable values. */
const ticks = computed(() => {
  if (props.max)
    return Array.from({ length: TICK_STEPS + 1 }, (_, i) => (props.max! / TICK_STEPS) * i)
  const highest = Math.max(...props.points.flatMap(p => [p.value ?? 0, p.previous ?? 0]), 0)
  if (highest === 0)
    return [0, 1]
  const raw = highest / TICK_STEPS
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].find(n => n * magnitude >= raw)! * magnitude
  return Array.from({ length: TICK_STEPS + 1 }, (_, i) => step * i)
})
const top = computed(() => ticks.value.at(-1)!)

type Datum = typeof props.points[number]

/** At most about seven labels, so none has to wrap in a half-width card. */
const MAX_X_LABELS = 7
const xTicks = computed(() => {
  const step = Math.max(1, Math.ceil(props.points.length / MAX_X_LABELS))
  return props.points.map((_, i) => i).filter(i => i % step === 0)
})

const legend = computed<BulletLegendItemInterface[]>(() => hasComparison.value
  ? [{ name: CURRENT, color: COLOR }, { name: PREVIOUS, color: COMPARE_COLOR }]
  : [{ name: props.title, color: COLOR }])
const tooltipKeys = computed(() => hasComparison.value ? ['value', 'previous'] : ['value'])
// The crosshair hands the raw value over; the tooltip formats it.
const tooltip = computed(() => makeChartTooltip(props.formatTooltip))

const trendClass = computed(() => {
  if (props.delta?.trend === 'up')
    return 'border-green-500/30 text-green-700 dark:text-green-400'
  if (props.delta?.trend === 'down')
    return 'border-red-500/30 text-red-700 dark:text-red-400'
  return 'text-muted-foreground'
})
const trendIcon = computed(() => ({ up: 'lucide:trending-up', down: 'lucide:trending-down', flat: 'lucide:minus' })[props.delta?.trend ?? 'flat'])

const isMounted = useMounted()
</script>

<template>
  <Card class="flex h-full flex-col" data-testid="analytics-metric-card">
    <CardHeader class="gap-1">
      <CardTitle class="text-base">
        {{ title }}
      </CardTitle>
      <CardAction v-if="delta">
        <Badge variant="outline" :class="trendClass" :title="delta.label">
          <Icon :name="trendIcon" class="size-3.5" />
          {{ delta.text }}
        </Badge>
      </CardAction>
      <!-- The breakdown sits behind a button, so every card keeps the same
           title / figure / dates / chart rhythm and the charts line up. -->
      <div class="col-start-1 mt-3 flex items-center gap-1.5">
        <span class="text-2xl font-semibold tabular-nums" data-testid="analytics-metric-value">{{ value }}</span>
        <Popover v-if="breakdown?.length">
          <PopoverTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-7 text-muted-foreground"
              :aria-label="`How ${title} is calculated`"
              data-testid="analytics-metric-breakdown-trigger"
            >
              <Icon name="lucide:info" class="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" class="w-72 p-3">
            <p class="mb-2 text-xs font-medium">
              How {{ title }} is calculated
            </p>
            <dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs" data-testid="analytics-metric-breakdown">
              <template v-for="row in breakdown" :key="row.label">
                <dt :class="row.total ? 'border-t pt-1 font-medium' : 'text-muted-foreground'">
                  {{ row.label }}
                </dt>
                <dd class="text-right tabular-nums" :class="row.total ? 'border-t pt-1 font-medium' : 'text-muted-foreground'">
                  {{ row.value }}
                </dd>
              </template>
            </dl>
          </PopoverContent>
        </Popover>
      </div>
      <CardDescription class="col-start-1">
        {{ periodLabel }}
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-1 flex-col justify-end gap-2">
      <!-- Two lines need a key; one line is named by the card title. -->
      <div v-if="hasComparison" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" data-testid="analytics-metric-legend">
        <span class="flex items-center gap-1.5">
          <span class="h-0.5 w-4 rounded-full" :style="{ background: COLOR }" />
          {{ CURRENT }}
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-4 border-t-2 border-dashed" :style="{ borderColor: COMPARE_COLOR }" />
          {{ PREVIOUS }}{{ compareLabel ? ` (${compareLabel.replace(/^vs /, '')})` : '' }}
        </span>
      </div>
      <ClientOnly>
        <div class="h-[220px] w-full">
          <VisXYContainer
            :data="points"
            :y-domain="[0, top]"
            :margin="{ top: 8, right: 8 }"
            :style="{ height: isMounted ? '100%' : 'auto' }"
          >
            <ChartCrosshair :colors="[COLOR, COMPARE_COLOR]" :items="legend" index="label" :categories="tooltipKeys" :custom-tooltip="tooltip" />
            <VisLine
              v-if="hasComparison"
              :x="(_: Datum, i: number) => i"
              :y="(d: Datum) => d.previous ?? undefined"
              :color="COMPARE_COLOR"
              :line-width="1.5"
              :line-dash-array="[4, 4]"
              :curve-type="CurveType.Linear"
            />
            <VisLine
              :x="(_: Datum, i: number) => i"
              :y="(d: Datum) => d.value ?? undefined"
              :color="COLOR"
              :line-width="2"
              :curve-type="CurveType.Linear"
            />
            <VisScatter
              :x="(_: Datum, i: number) => i"
              :y="(d: Datum) => d.value ?? undefined"
              :size="7"
              color="var(--card)"
              :stroke-color="COLOR"
              :stroke-width="2"
            />
            <VisAxis
              type="x"
              :tick-values="xTicks"
              :tick-format="(v: number) => points[v]?.label ?? ''"
              :grid-line="false"
              :tick-line="false"
              tick-text-color="var(--vis-text-color)"
            />
            <VisAxis
              type="y"
              :tick-values="ticks"
              :tick-format="(v: number) => formatAxis(v)"
              :tick-line="false"
              :domain-line="false"
              :attributes="{ [Axis.selectors.grid]: { class: 'text-muted' } }"
              tick-text-color="var(--vis-text-color)"
            />
          </VisXYContainer>
        </div>
      </ClientOnly>
      <p v-if="note" class="text-xs text-muted-foreground" data-testid="analytics-metric-note">
        {{ note }}
      </p>
    </CardContent>
  </Card>
</template>
