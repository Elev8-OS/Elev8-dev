<script setup lang="ts">
import type { OwnerChannelBreakdownRow } from '~/composables/useOwnerStatementDetail'
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

const props = defineProps<{
  breakdown: OwnerChannelBreakdownRow[]
  currency: string
}>()

const sourceColor: Record<string, string> = {
  airbnb: 'var(--vis-primary-color)',
  booking_com: 'var(--vis-secondary-color)',
  direct: '#10b981',
  agoda: '#f59e0b',
  vrbo: '#8b5cf6',
  expedia: '#ef4444',
}

function colorFor(source: string) {
  return sourceColor[source] ?? '#6b7280'
}

function sourceLabel(source: string) {
  if (source === 'booking_com')
    return 'Booking.com'
  if (source === 'airbnb')
    return 'Airbnb'
  return source.charAt(0).toUpperCase() + source.slice(1)
}

const totalShare = computed(() => props.breakdown.reduce((s, b) => s + b.share, 0))
</script>

<template>
  <Card v-if="breakdown.length > 0">
    <CardHeader>
      <CardTitle class="text-base">
        Channel breakdown
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          v-for="row in breakdown"
          :key="row.source"
          :style="{ width: `${(row.share / totalShare) * 100}%`, backgroundColor: colorFor(row.source) }"
          :title="`${sourceLabel(row.source)}: ${(row.share * 100).toFixed(0)}%`"
        />
      </div>
      <div class="divide-y rounded-md border">
        <div
          v-for="row in breakdown"
          :key="row.source"
          class="flex items-center justify-between px-3 py-2 text-sm"
        >
          <div class="flex items-center gap-2">
            <span class="size-2.5 rounded-full" :style="{ backgroundColor: colorFor(row.source) }" />
            <span>{{ sourceLabel(row.source) }}</span>
          </div>
          <div class="flex items-center gap-4 text-muted-foreground tabular-nums">
            <span>{{ row.reservations }} reservations</span>
            <span class="font-medium text-foreground">{{ currency }} {{ row.revenue.toLocaleString('id-ID') }}</span>
            <span class="w-12 text-right">{{ (row.share * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
