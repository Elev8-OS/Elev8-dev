<script setup lang="ts">
import { toast } from 'vue-sonner'
import {
  formatCompactMoney,
  formatMoney,
  formatPercent,
  formatSignedPercent,
  formatSignedPoints,
} from '~/components/gm/data/gm-dashboard'

const gm = useGmDashboard()
const { currentUser } = useCurrentDashboardUser()

const regionLabel = computed(() =>
  gm.regionOptions.find(option => option.value === gm.region.value)?.label ?? 'All regions')

function handleSentimentHandled(conversationId: string) {
  const conversation = gm.negativeConversations.value.find(c => c.id === conversationId)
  gm.markHandled(conversationId)
  toast.success(`Marked ${conversation?.guestName ?? 'conversation'} as handled`)
}

const kpiCards = computed(() => {
  const kpi = gm.kpis.value
  return [
    {
      key: 'occupancy',
      label: 'Occupancy tonight',
      icon: 'lucide:bed-double',
      value: formatPercent(kpi.occupancyTonight),
      delta: formatSignedPoints(kpi.occupancyDelta),
      trend: kpi.occupancyDelta >= 0 ? 'up' as const : 'down' as const,
      hint: `${kpi.inHouseUnits} of ${kpi.unitCount} properties · ${kpi.inHouseGuests} guests in house`,
    },
    {
      key: 'adr',
      label: 'ADR',
      icon: 'lucide:tag',
      value: formatMoney(kpi.adr),
      delta: formatSignedPercent(kpi.adrDelta),
      trend: kpi.adrDelta >= 0 ? 'up' as const : 'down' as const,
      hint: 'Average nightly rate, last 30 nights',
    },
    {
      key: 'revpar',
      label: 'RevPAR',
      icon: 'lucide:gauge',
      value: formatMoney(kpi.revpar),
      delta: formatSignedPercent(kpi.revparDelta),
      trend: kpi.revparDelta >= 0 ? 'up' as const : 'down' as const,
      hint: 'Revenue per available night',
    },
    {
      key: 'revenue',
      label: 'Room revenue',
      icon: 'lucide:wallet',
      value: formatCompactMoney(kpi.revenue30d),
      delta: formatSignedPercent(kpi.revenue30dDelta),
      trend: kpi.revenue30dDelta >= 0 ? 'up' as const : 'down' as const,
      hint: 'Nights sold in the last 30 days',
    },
  ]
})
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Portfolio overview
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ currentUser?.name }} · General Manager · {{ gm.unitCount.value }} properties
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Badge
          v-if="gm.kpis.value.unassignedArrivals"
          variant="outline"
          class="border-amber-500/30 text-amber-700 dark:text-amber-400"
        >
          <Icon name="lucide:shield-alert" class="size-3.5" />
          {{ gm.kpis.value.unassignedArrivals }} unverified arrivals
        </Badge>
        <Select v-model="gm.region.value">
          <SelectTrigger class="w-[150px]" size="sm">
            <SelectValue placeholder="All regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in gm.regionOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/operations-calendar">
            <Icon name="lucide:calendar-days" class="size-4" />
            Operations calendar
          </NuxtLink>
        </Button>
      </div>
    </div>

    <main class="@container/main flex flex-1 flex-col gap-4">
      <div class="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <GmKpiCard
          v-for="card in kpiCards"
          :key="card.key"
          :label="card.label"
          :icon="card.icon"
          :value="card.value"
          :delta="card.delta"
          :trend="card.trend"
          :hint="card.hint"
        />
      </div>

      <div class="grid grid-cols-1 gap-4 @5xl/main:grid-cols-3">
        <div class="flex flex-col gap-4 @5xl/main:col-span-2">
          <GmOccupancyChart :days="gm.dayFlow.value" :anchor-date="gm.anchorDate.value" />
          <GmRevenueChart
            v-model:range="gm.revenueRange.value"
            :series="gm.revenueSeries.value"
            :metrics="gm.revenueRangeMetrics.value"
          />
        </div>

        <!-- The right column is the "who needs me" column: unhappy guests
             first, then the day's bookings. Both are lists of people, and the
             charts keep the wide half to themselves. -->
        <div class="flex flex-col gap-4 @5xl/main:self-start">
          <GmSentimentPanel
            :rows="gm.visibleNegative.value"
            :hidden-count="gm.hiddenNegativeCount.value"
            :summary="gm.sentimentSummary.value"
            :region-label="regionLabel"
            @open="gm.openConversation"
            @handled="handleSentimentHandled"
          />
          <GmBookingsPanel
            class="h-[30rem]"
            :strip-days="gm.stripDays.value"
            :strip-occupancy="gm.stripOccupancy.value"
            :selected-date="gm.selectedDate.value"
            :anchor-date="gm.anchorDate.value"
            :bookings="gm.selectedBookings.value"
            @select="gm.setSelectedDate"
            @shift="gm.shiftStrip"
            @today="gm.goToToday"
          />
        </div>
      </div>
    </main>
  </div>
</template>
