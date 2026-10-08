<script setup lang="ts">
import { makeChartTooltip } from '~/components/owner-portal/chart-format'
import { BarChart } from '~/components/ui/chart-bar'

// One-series bar chart for a count per bucket (lead time, stay length).
const props = defineProps<{
  title: string
  description: string
  buckets: { label: string, stays: number }[]
  /** Headline beside the title, e.g. "4.2 nights on average". */
  summary?: string
}>()

// The key doubles as the tooltip label.
const STAYS = 'Stays'
const chartData = computed(() => props.buckets.map(b => ({ label: b.label, [STAYS]: b.stays })))
const total = computed(() => props.buckets.reduce((s, b) => s + b.stays, 0))
const tooltip = makeChartTooltip(value => `${value}`)
</script>

<template>
  <Card class="flex h-full flex-col">
    <CardHeader>
      <CardTitle>{{ title }}</CardTitle>
      <CardDescription>{{ description }}</CardDescription>
      <CardAction v-if="summary" class="text-right text-sm font-medium tabular-nums">
        {{ summary }}
      </CardAction>
    </CardHeader>
    <CardContent class="flex-1">
      <ClientOnly v-if="total">
        <BarChart
          :data="chartData"
          :categories="[STAYS]"
          index="label"
          :colors="['var(--viz-1)']"
          :rounded-corners="4"
          :custom-tooltip="tooltip"
          :y-formatter="(tick: number | Date) => Number.isInteger(Number(tick)) ? `${tick}` : ''"
          :show-legend="false"
          class="h-[220px]"
        />
      </ClientOnly>
      <p v-else class="py-10 text-center text-sm text-muted-foreground">
        No stays in this period
      </p>
    </CardContent>
  </Card>
</template>
