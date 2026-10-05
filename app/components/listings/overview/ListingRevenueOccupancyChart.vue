<script setup lang="ts">
import type { BulletLegendItemInterface } from '@unovis/ts'
import type { PropType } from 'vue'
import type { OverviewStay } from '~/components/listings/data/listing-overview-charts'
import { Axis, GroupedBar } from '@unovis/ts'
import { VisAxis, VisGroupedBar, VisXYContainer } from '@unovis/vue'
import { useMounted } from '@vueuse/core'
import { monthlyPerformance, stayYears } from '~/components/listings/data/listing-overview-charts'
import { formatPeriod } from '~/components/owner-portal/chart-format'
import { formatOwnerMoneyRounded } from '~/components/owners/data/owner-money'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { ChartCrosshair, ChartLegend } from '~/components/ui/chart'
import ChartTooltip from '~/components/ui/chart/ChartTooltip.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'

const props = defineProps<{
  stays: OverviewStay[]
  /** The listing's own currency, shown first. */
  currency: string
  rooms: number
  today: Date
}>()

// The keys double as the legend and tooltip labels.
const REVENUE = 'Revenue'
const OCCUPANCY = 'Occupancy'
const CATEGORIES = [REVENUE, OCCUPANCY]
const COLORS = ['var(--viz-1)', 'var(--viz-3)']

/** Every currency the stays were paid in. Revenue is never converted, so one is charted at a time. */
const currencies = computed(() => {
  const set = new Set([props.currency, ...props.stays.map(s => s.currency)])
  return [...set]
})
const selectedCurrency = ref(props.currency)
watch(() => props.currency, (c) => {
  selectedCurrency.value = c
})

/** A calendar year, so booked months ahead show next to the ones already stayed. */
const years = computed(() => stayYears(props.stays, props.today.getFullYear()))
const selectedYear = ref(String(props.today.getFullYear()))

const months = computed(() => monthlyPerformance(props.stays, {
  currency: selectedCurrency.value,
  rooms: props.rooms,
  year: Number(selectedYear.value),
}))

/** Months after the current one hold bookings on the books, not stays that happened. */
const currentPeriod = `${props.today.getFullYear()}-${String(props.today.getMonth() + 1).padStart(2, '0')}`

const totalRevenue = computed(() => months.value.reduce((sum, m) => sum + m.revenue, 0))
const averageOccupancy = computed(() => Math.round(months.value.reduce((sum, m) => sum + m.occupancy, 0) / months.value.length))

/**
 * Two measures, two axes: revenue on the left, occupancy (0-100%) on the right.
 * The revenue axis tops out at a round number split into four steps, and
 * occupancy is drawn on that same scale (100% = the top), so every gridline
 * reads on both axes: USD 0 / 0%, ..., top / 100%.
 */
const TICK_STEPS = 4
const revenueStep = computed(() => {
  const max = Math.max(...months.value.map(m => m.revenue), 0)
  if (max === 0)
    return 1
  const raw = max / TICK_STEPS
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const nice = [1, 2, 2.5, 5, 10].find(n => n * magnitude >= raw)!
  return nice * magnitude
})
const revenueTop = computed(() => revenueStep.value * TICK_STEPS)
const tickValues = computed(() => Array.from({ length: TICK_STEPS + 1 }, (_, i) => i * revenueStep.value))

const data = computed(() => months.value.map(m => ({
  period: formatPeriod(m.period),
  upcoming: m.period > currentPeriod,
  [REVENUE]: m.revenue,
  [OCCUPANCY]: (m.occupancy / 100) * revenueTop.value,
})))
type Datum = typeof data.value[number]

function formatCurrency(amount: number) {
  return formatOwnerMoneyRounded(amount, selectedCurrency.value)
}
function toOccupancy(scaled: number) {
  return Math.round((scaled / revenueTop.value) * 100)
}

/** The crosshair hands over the drawn values; occupancy is turned back into a percentage. */
const tooltip = defineComponent({
  name: 'RevenueOccupancyTooltip',
  props: {
    title: { type: String, default: '' },
    data: { type: Array as PropType<{ name: string, color: string, value: unknown }[]>, required: true },
  },
  setup(p) {
    return () => h(ChartTooltip, {
      title: p.title,
      data: p.data.map(item => ({
        ...item,
        value: item.name === OCCUPANCY ? `${toOccupancy(Number(item.value))}%` : formatCurrency(Number(item.value)),
      })),
    })
  },
})

/** Room kept free on the right of the bar chart for the occupancy axis labels. */
const RIGHT_AXIS_WIDTH = 44

const legendItems = ref<BulletLegendItemInterface[]>(CATEGORIES.map((name, i) => ({ name, color: COLORS[i], inactive: false })))
const isMounted = useMounted()
</script>

<template>
  <Card data-testid="overview-revenue-chart">
    <CardHeader>
      <CardTitle>Revenue & Occupancy</CardTitle>
      <CardDescription>Monthly revenue and occupancy in {{ selectedYear }}</CardDescription>
      <CardAction class="flex items-center gap-2">
        <Select v-model="selectedYear">
          <SelectTrigger size="sm" class="w-[90px]" aria-label="Year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="y in years" :key="y" :value="String(y)">
              {{ y }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-if="currencies.length > 1" v-model="selectedCurrency">
          <SelectTrigger size="sm" class="w-[90px]" aria-label="Revenue currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="c in currencies" :key="c" :value="c">
              {{ c }}
            </SelectItem>
          </SelectContent>
        </Select>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-wrap gap-x-8 gap-y-2">
          <div class="flex flex-col">
            <span class="text-xs text-muted-foreground">Total revenue</span>
            <span class="text-lg font-semibold tabular-nums" data-testid="overview-revenue-total">{{ formatCurrency(totalRevenue) }}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-muted-foreground">Average occupancy</span>
            <span class="text-lg font-semibold tabular-nums" data-testid="overview-occupancy-avg">{{ averageOccupancy }}%</span>
          </div>
        </div>
        <ChartLegend v-model:items="legendItems" />
      </div>
      <ClientOnly>
        <!-- Unovis draws one y axis per container, so the occupancy axis is a
             second, see-through container laid over the first on the same
             domain. Its x axis is invisible but keeps the plot heights equal. -->
        <div class="relative h-[280px] w-full">
          <VisXYContainer
            :data="data"
            :y-domain="[0, revenueTop]"
            :margin="{ right: RIGHT_AXIS_WIDTH }"
            :style="{ height: isMounted ? '100%' : 'auto' }"
          >
            <ChartCrosshair :colors="COLORS" :items="legendItems" :custom-tooltip="tooltip" index="period" :categories="CATEGORIES" />
            <VisGroupedBar
              :x="(_: Datum, i: number) => i"
              :y="CATEGORIES.map(category => (d: Datum) => d[category])"
              :color="COLORS"
              :rounded-corners="4"
              :bar-padding="0.2"
              :group-padding="0.08"
              :attributes="{
                [GroupedBar.selectors.bar]: {
                  opacity: (d: Datum, i: number) => legendItems[i % CATEGORIES.length]?.inactive ? 0.2 : d.upcoming ? 0.5 : 1,
                },
              }"
            />
            <VisAxis
              type="x"
              :tick-format="(v: number) => data[v]?.period"
              :grid-line="false"
              :tick-line="false"
              tick-text-color="var(--vis-text-color)"
            />
            <VisAxis
              type="y"
              :tick-values="tickValues"
              :tick-format="(v: number) => formatCurrency(v)"
              :tick-line="false"
              :domain-line="false"
              :attributes="{ [Axis.selectors.grid]: { class: 'text-muted' } }"
              tick-text-color="var(--vis-text-color)"
            />
          </VisXYContainer>
          <div class="pointer-events-none absolute inset-0" aria-hidden="true">
            <VisXYContainer
              :data="data"
              :y-domain="[0, revenueTop]"
              :style="{ height: isMounted ? '100%' : 'auto' }"
            >
              <VisGroupedBar
                :x="(_: Datum, i: number) => i"
                :y="CATEGORIES.map(category => (d: Datum) => d[category])"
                color="transparent"
              />
              <VisAxis
                type="x"
                :tick-format="(v: number) => data[v]?.period"
                :grid-line="false"
                :tick-line="false"
                :domain-line="false"
                tick-text-color="transparent"
              />
              <VisAxis
                type="y"
                position="right"
                :tick-values="tickValues"
                :tick-format="(v: number) => `${toOccupancy(v)}%`"
                :tick-line="false"
                :domain-line="false"
                :grid-line="false"
                tick-text-color="var(--vis-text-color)"
              />
            </VisXYContainer>
          </div>
        </div>
      </ClientOnly>
      <p v-if="data.some(d => d.upcoming)" class="text-xs text-muted-foreground">
        Lighter bars show upcoming months, based on bookings received so far.
      </p>
    </CardContent>
  </Card>
</template>
