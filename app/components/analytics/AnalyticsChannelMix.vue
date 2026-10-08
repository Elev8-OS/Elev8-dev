<script setup lang="ts">
import type { ChannelShare } from '~/components/analytics/data/analytics'
import { channelColors, channelIcons } from '~/components/analytics/data/analytics'
import { formatOwnerMoneyRounded } from '~/components/owners/data/owner-money'
import { DonutChart } from '~/components/ui/chart-donut'

const props = defineProps<{
  shares: ChannelShare[]
  currency: string
}>()

const chartData = computed(() => props.shares.map(s => ({ name: s.channel, stays: s.stays })))
</script>

<template>
  <Card class="flex h-full flex-col" data-testid="analytics-channel-mix">
    <CardHeader>
      <CardTitle>Channel mix</CardTitle>
      <CardDescription>Stays arriving in the period, by channel</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-1 flex-col items-center gap-6">
      <template v-if="shares.length">
        <ClientOnly>
          <DonutChart
            :data="chartData"
            category="stays"
            index="name"
            :colors="shares.map(s => channelColors[s.channel])"
            :show-legend="false"
            class="size-40 shrink-0"
          />
        </ClientOnly>
        <ul class="flex w-full flex-col gap-3">
          <li v-for="share in shares" :key="share.channel" class="flex items-center gap-3" data-testid="analytics-channel-row">
            <span class="size-2.5 shrink-0 rounded-full" :style="{ background: channelColors[share.channel] }" />
            <Icon :name="channelIcons[share.channel]" class="size-4 shrink-0" />
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-medium">{{ share.channel }}</span>
              <span class="text-xs text-muted-foreground tabular-nums">
                {{ share.stays }} {{ share.stays === 1 ? 'stay' : 'stays' }} · {{ formatOwnerMoneyRounded(share.revenue, currency) }}
              </span>
            </div>
            <span class="text-sm font-semibold tabular-nums">{{ share.percent }}%</span>
          </li>
        </ul>
      </template>
      <p v-else class="py-10 text-center text-sm text-muted-foreground">
        No stays in this period
      </p>
    </CardContent>
  </Card>
</template>
