<script setup lang="ts">
import type { Booking } from '~/components/listings/data/listings'
import { averageStayLength, stayLengthDistribution } from '~/components/listings/data/listing-overview-charts'
import { makeChartTooltip } from '~/components/owner-portal/chart-format'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { BarChart } from '~/components/ui/chart-bar'

const props = defineProps<{
  stays: Pick<Booking, 'nights'>[]
  periodLabel: string
}>()

// The key doubles as the tooltip label.
const STAYS = 'Stays'

const chartData = computed(() => stayLengthDistribution(props.stays).map(b => ({ label: b.label, [STAYS]: b.stays })))
const average = computed(() => averageStayLength(props.stays))

const tooltip = makeChartTooltip(value => `${value}`)
</script>

<template>
  <Card data-testid="overview-stay-length-chart">
    <CardHeader>
      <CardTitle>Stay Duration Distribution</CardTitle>
      <CardDescription>Length of guest stays, {{ periodLabel }}</CardDescription>
      <CardAction v-if="average !== null" class="text-right">
        <div class="text-sm font-medium tabular-nums" data-testid="overview-stay-length-avg">
          {{ average.toFixed(1) }} nights on average
        </div>
        <div class="text-xs text-muted-foreground">
          across {{ stays.length }} {{ stays.length === 1 ? 'stay' : 'stays' }}
        </div>
      </CardAction>
    </CardHeader>
    <CardContent>
      <ClientOnly v-if="stays.length">
        <BarChart
          :data="chartData"
          :categories="[STAYS]"
          index="label"
          :colors="['var(--viz-1)']"
          :rounded-corners="4"
          :custom-tooltip="tooltip"
          :y-formatter="(tick: number | Date) => Number.isInteger(Number(tick)) ? `${tick}` : ''"
          :show-legend="false"
          class="h-[200px]"
        />
      </ClientOnly>
      <p v-else class="py-10 text-center text-sm text-muted-foreground">
        No stays in this period
      </p>
    </CardContent>
  </Card>
</template>
