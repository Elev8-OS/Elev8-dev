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

// Direct's website split, collapsed until asked for.
const sitesOpen = ref(false)
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
          <template v-for="share in shares" :key="share.channel">
            <li class="flex items-center gap-3" data-testid="analytics-channel-row">
              <span class="size-2.5 shrink-0 rounded-full" :style="{ background: channelColors[share.channel] }" />
              <Icon :name="channelIcons[share.channel]" class="size-4 shrink-0" />
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="flex min-w-0 items-center gap-1">
                  <span class="truncate text-sm font-medium">{{ share.channel }}</span>
                  <Button
                    v-if="share.sites?.length"
                    variant="ghost"
                    size="icon"
                    class="size-6 shrink-0"
                    :aria-label="sitesOpen ? 'Hide direct bookings by website' : 'Show direct bookings by website'"
                    :aria-expanded="sitesOpen"
                    aria-controls="analytics-direct-sites"
                    data-testid="analytics-direct-sites-toggle"
                    @click="sitesOpen = !sitesOpen"
                  >
                    <Icon name="lucide:chevron-down" class="size-4 transition-transform" :class="sitesOpen && 'rotate-180'" />
                  </Button>
                </span>
                <span class="text-xs text-muted-foreground tabular-nums">
                  {{ share.stays }} {{ share.stays === 1 ? 'stay' : 'stays' }} · {{ formatOwnerMoneyRounded(share.revenue, currency) }}
                </span>
              </div>
              <span class="text-sm font-semibold tabular-nums">{{ share.percent }}%</span>
            </li>
            <li v-if="share.sites?.length" v-show="sitesOpen" id="analytics-direct-sites" data-testid="analytics-direct-sites">
              <ul class="ml-1 flex flex-col gap-2 border-l pl-8" aria-label="Direct bookings by website">
                <li v-for="site in share.sites" :key="site.websiteId ?? 'other'" class="flex items-center gap-3" data-testid="analytics-direct-site-row">
                  <Icon :name="site.websiteId ? 'lucide:globe' : 'lucide:circle-ellipsis'" class="size-4 shrink-0 text-muted-foreground" />
                  <div class="flex min-w-0 flex-1 flex-col">
                    <span class="truncate text-sm">{{ site.name }}</span>
                    <span class="text-xs text-muted-foreground tabular-nums">
                      {{ site.stays }} {{ site.stays === 1 ? 'stay' : 'stays' }} · {{ formatOwnerMoneyRounded(site.revenue, currency) }}
                    </span>
                  </div>
                  <span class="text-sm tabular-nums text-muted-foreground">{{ site.percent }}%</span>
                </li>
              </ul>
            </li>
          </template>
        </ul>
      </template>
      <p v-else class="py-10 text-center text-sm text-muted-foreground">
        No stays in this period
      </p>
    </CardContent>
  </Card>
</template>
