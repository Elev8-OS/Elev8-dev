<script setup lang="ts">
import { computed } from 'vue'
import { useOwnerDashboard } from '~/composables/useOwnerDashboard'
import { useOwnerPortal } from '~/composables/useOwnerPortal'
import PortalAdrChart from './PortalAdrChart.vue'
import PortalKpiCard from './PortalKpiCard.vue'
import PortalOccupancyChart from './PortalOccupancyChart.vue'
import PortalPropertyPicker from './PortalPropertyPicker.vue'
import PortalRatingsChart from './PortalRatingsChart.vue'
import PortalRevenueChart from './PortalRevenueChart.vue'
import PortalSourcesChart from './PortalSourcesChart.vue'
import PortalYoYBadge from './PortalYoYBadge.vue'

const portal = useOwnerPortal()
const dashboard = useOwnerDashboard()

const currency = computed(() => dashboard.timeSeries.value.currency)
const current = computed(() => dashboard.currentPeriod.value)

/** `2026-09-14` -> `14 Sep`, so the list reads like a date and not an id. */
function formatArrival(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const kpis = computed(() => {
  if (!current.value)
    return []
  return [
    { key: 'grossRevenue' as const, label: 'Gross revenue', value: `${currency.value} ${Math.round(current.value.grossRevenue).toLocaleString('id-ID')}` },
    { key: 'netRevenue' as const, label: 'Net revenue', value: `${currency.value} ${Math.round(current.value.netRevenue).toLocaleString('id-ID')}` },
    { key: 'occupancy' as const, label: 'Occupancy', value: `${Math.round(current.value.occupancy * 100)}%` },
    { key: 'adr' as const, label: 'ADR', value: `${currency.value} ${Math.round(current.value.adr).toLocaleString('id-ID')}` },
  ].filter(k => portal.canViewDashboardField(k.key))
})
</script>

<template>
  <section class="space-y-6">
    <div class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">
          Overview
        </h1>
        <p class="text-sm text-muted-foreground">
          How your property has been doing over the last 12 months.
        </p>
      </div>
      <PortalPropertyPicker
        v-model="portal.selectedPropertyId.value"
        :properties="portal.assignedProperties.value"
      />
    </div>

    <!-- Empty state: no metrics visible -->
    <div
      v-if="!dashboard.hasVisibleMetrics.value"
      class="rounded-lg border border-dashed p-8 text-center"
      data-testid="dashboard-no-metrics"
    >
      <Icon name="lucide:eye-off" class="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
      <h2 class="mt-3 font-medium">
        Nothing to show here yet
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Your manager decides which figures appear on this page. Ask them to turn some on.
      </p>
    </div>

    <!-- KPI strip -->
    <div v-if="current" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="kpi in kpis"
        :key="kpi.key"
        class="rounded-lg border bg-card p-4"
      >
        <p class="text-sm text-muted-foreground">
          {{ kpi.label }}
        </p>
        <p class="mt-2 text-xl font-semibold">
          {{ kpi.value }}
        </p>
        <PortalYoYBadge
          v-if="dashboard.hasYearOverYearData.value"
          :change="dashboard.yoyChange(kpi.key === 'occupancy' ? 'occupancy' : kpi.key === 'adr' ? 'adr' : kpi.key === 'grossRevenue' ? 'grossRevenue' : 'netRevenue').value"
          format="percent"
        />
      </div>
      <PortalKpiCard
        v-if="portal.canViewDashboardField('upcomingReservations')"
        label="Owner-use nights"
        :value="String(portal.ownerUseNights.value)"
      />
    </div>

    <!-- Chart grid -->
    <div v-if="current" class="space-y-4">
      <PortalRevenueChart
        v-if="portal.canViewDashboardField('grossRevenue') && dashboard.monthlyRevenueSeries.value.length"
        :series="dashboard.monthlyRevenueSeries.value"
        :prior-year-series="dashboard.timeSeries.value.priorYearMonths.map(m => ({ period: m.period, grossRevenue: m.grossRevenue }))"
        :currency="currency"
      />
      <div class="grid gap-4 lg:grid-cols-2">
        <PortalOccupancyChart
          v-if="portal.canViewDashboardField('occupancy') && dashboard.monthlyOccupancyAdrSeries.value.length"
          :series="dashboard.monthlyOccupancyAdrSeries.value"
        />
        <PortalAdrChart
          v-if="portal.canViewDashboardField('adr') && dashboard.monthlyOccupancyAdrSeries.value.length"
          :series="dashboard.monthlyOccupancyAdrSeries.value"
          :currency="currency"
        />
        <PortalSourcesChart
          v-if="portal.canViewDashboardField('bookingSources') && dashboard.monthlySourcesSeries.value.length"
          :series="dashboard.monthlySourcesSeries.value"
          :currency="currency"
        />
        <PortalRatingsChart
          v-if="portal.canViewDashboardField('guestRatings') && dashboard.monthlyRatingsSeries.value.length"
          :series="dashboard.monthlyRatingsSeries.value"
        />
      </div>
    </div>

    <!-- Upcoming reservations -->
    <div
      v-if="portal.propertyMetrics.value && portal.canViewDashboardField('upcomingReservations')"
      class="rounded-lg border bg-card p-4"
    >
      <h2 class="font-medium">
        Who is coming next
      </h2>
      <div class="mt-3 divide-y">
        <div
          v-for="reservation in portal.propertyMetrics.value.upcomingReservations"
          :key="reservation.id"
          class="flex justify-between py-3 text-sm"
        >
          <span>{{ reservation.guestName }}</span>
          <span class="text-muted-foreground">
            {{ formatArrival(reservation.checkIn) }} · {{ reservation.nights }} night{{ reservation.nights === 1 ? '' : 's' }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
