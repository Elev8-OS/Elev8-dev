<script setup lang="ts">
import type { Booking } from '~/components/listings/data/listings'
import { bookingSources } from '~/components/listings/data/listing-overview-charts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { DonutChart } from '~/components/ui/chart-donut'

const props = defineProps<{
  stays: Pick<Booking, 'source'>[]
  periodLabel: string
}>()

const SOURCE_META: Record<string, { label: string, icon: string, color: string }> = {
  'Airbnb': { label: 'Airbnb', icon: 'logos:airbnb', color: 'var(--viz-2)' },
  'Booking.com': { label: 'Booking.com', icon: 'simple-icons:bookingdotcom', color: 'var(--viz-1)' },
  'Direct': { label: 'Direct', icon: 'lucide:globe', color: 'var(--viz-3)' },
}
/** Any other channel is grey, never a generated hue. */
const OTHER_COLOR = 'var(--muted-foreground)'

const shares = computed(() => bookingSources(props.stays).map(share => ({
  ...share,
  label: SOURCE_META[share.source]?.label ?? share.source,
  icon: SOURCE_META[share.source]?.icon ?? 'lucide:circle-help',
  color: SOURCE_META[share.source]?.color ?? OTHER_COLOR,
})))

const chartData = computed(() => shares.value.map(s => ({ name: s.label, bookings: s.bookings })))
</script>

<template>
  <Card data-testid="overview-sources-chart">
    <CardHeader>
      <CardTitle>Booking Sources</CardTitle>
      <CardDescription>Distribution of bookings by platform, {{ periodLabel }}</CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="shares.length" class="flex flex-col items-center gap-6 sm:flex-row">
        <ClientOnly>
          <DonutChart
            :data="chartData"
            category="bookings"
            index="name"
            :colors="shares.map(s => s.color)"
            :show-legend="false"
            class="size-40 shrink-0"
          />
        </ClientOnly>
        <ul class="flex w-full flex-col gap-3">
          <li v-for="share in shares" :key="share.source" class="flex items-center gap-3" data-testid="overview-source-row">
            <span class="size-2.5 shrink-0 rounded-full" :style="{ background: share.color }" />
            <Icon :name="share.icon" class="size-4 shrink-0 text-muted-foreground" />
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-medium">{{ share.label }}</span>
              <span class="text-xs text-muted-foreground">{{ share.bookings }} {{ share.bookings === 1 ? 'booking' : 'bookings' }}</span>
            </div>
            <span class="text-sm font-semibold tabular-nums">{{ share.percent }}%</span>
          </li>
        </ul>
      </div>
      <p v-else class="py-10 text-center text-sm text-muted-foreground">
        No bookings in this period
      </p>
    </CardContent>
  </Card>
</template>
