<script setup lang="ts">
import { formatSpan } from '~/components/analytics/data/analytics'
import { formatSignedPercent, formatSignedPoints, relativeDelta } from '~/components/gm/data/gm-dashboard'
import SavedViewsDropdown from '~/components/listings/SavedViewsDropdown.vue'
import { formatOwnerMoneyRounded } from '~/components/owners/data/owner-money'

definePageMeta({ layout: 'default' })
useHead({ title: 'Analytics' })

const {
  units,
  currency,
  span,
  previousSpan,
  compareLabel,
  grain,
  current,
  previous,
  trend,
  arrivals,
  channels,
  leadTimes,
  stayLengths,
  origins,
  pace,
  listingRows,
  activeChips,
  periodLabel,
  clearFilters,
} = useAnalytics()

const views = useAnalyticsSavedViews()
// Stored views live in this browser, so they are read after hydration.
onMounted(() => views.restore())

/*
 * Filters live in a right-hand sidebar: pinned beside the charts on wide
 * screens (and collapsible there), a Sheet below that. The button decides at
 * click time, so nothing about the layout depends on a media query during SSR.
 */
const panelOpen = useState('analytics-filter-panel-open', () => true)
const sheetOpen = ref(false)
const isWide = useMediaQuery('(min-width: 1280px)')
function toggleFilters() {
  if (isWide.value)
    panelOpen.value = !panelOpen.value
  else sheetOpen.value = true
}
watch(isWide, (wide) => {
  if (wide)
    sheetOpen.value = false
})

type Trend = 'up' | 'down' | 'flat'
/** Whether a change is good news: `higherIsBetter` false flips the colour. */
function trendOf(delta: number, higherIsBetter = true): Trend {
  if (Math.abs(delta) < 0.0005)
    return 'flat'
  return (delta > 0) === higherIsBetter ? 'up' : 'down'
}

const money = (v: number) => formatOwnerMoneyRounded(v, currency.value)
const days = (v: number | null) => v === null ? 'n/a' : `${v.toFixed(1)} days`
const nights = (v: number | null) => v === null ? 'n/a' : `${v.toFixed(1)} nights`
const pct = (v: number | null, digits = 1) => v === null ? 'n/a' : `${(v * 100).toFixed(digits)}%`

interface Kpi {
  label: string
  icon: string
  value: string
  hint: string
  deltaText?: string
  trend?: Trend
}

const kpis = computed<Kpi[]>(() => {
  const c = current.value
  const p = previous.value
  const vs = compareLabel.value
  /** A badge only with a comparison period; `better: false` for "lower is good". */
  const badge = (delta: number | null, fmt: (n: number) => string, better = true) =>
    delta === null ? {} : { deltaText: fmt(delta), trend: trendOf(delta, better) }
  return [
    { label: 'Revenue', icon: 'lucide:banknote', value: money(c.revenue), hint: p ? `${money(p.revenue)} ${vs}` : `${c.stays.toLocaleString('en-US')} arriving stays`, ...badge(p && relativeDelta(c.revenue, p.revenue), formatSignedPercent) },
    { label: 'Occupancy', icon: 'lucide:bed-double', value: pct(c.occupancy), hint: `${c.occupiedNights.toLocaleString('en-US')} of ${c.availableNights.toLocaleString('en-US')} nights sold`, ...badge(p && c.occupancy - p.occupancy, formatSignedPoints) },
    { label: 'ADR', icon: 'lucide:receipt', value: money(c.adr), hint: 'Average rate per night sold', ...badge(p && relativeDelta(c.adr, p.adr), formatSignedPercent) },
    { label: 'RevPAR', icon: 'lucide:chart-column', value: money(c.revpar), hint: 'Revenue per night available', ...badge(p && relativeDelta(c.revpar, p.revpar), formatSignedPercent) },
    { label: 'Stays', icon: 'lucide:calendar-check', value: c.stays.toLocaleString('en-US'), hint: p ? `${p.stays.toLocaleString('en-US')} ${vs}` : 'Arrivals in the period', ...badge(p && relativeDelta(c.stays, p.stays), formatSignedPercent) },
    // A longer booking window or stay is neither good nor bad news, so no badge.
    { label: 'Avg. booking window', icon: 'lucide:calendar-clock', value: days(c.avgLeadDays), hint: p ? `${days(p.avgLeadDays)} ${vs}` : 'Booking to arrival' },
    { label: 'Avg. length of stay', icon: 'lucide:moon', value: nights(c.avgStayLength), hint: p ? `${nights(p.avgStayLength)} ${vs}` : 'Nights per arriving stay' },
    { label: 'Cancellation rate', icon: 'lucide:calendar-x', value: pct(c.cancellationRate), hint: 'Of bookings made in the period', ...badge(p && (c.cancellationRate ?? 0) - (p.cancellationRate ?? 0), formatSignedPoints, false) },
  ]
})

const avgLead = computed(() => current.value.avgLeadDays)
const avgStay = computed(() => current.value.avgStayLength)

const subtitle = computed(() => {
  const what = `${units.value.length} ${units.value.length === 1 ? 'listing' : 'listings'}`
  const when = formatSpan(span.value)
  const against = previousSpan.value ? `, compared with ${formatSpan(previousSpan.value)}` : ''
  return `${what}, ${periodLabel.value.toLowerCase()} (${when})${against}`
})
</script>

<template>
  <div class="flex w-full items-start gap-4">
    <div class="@container/analytics flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="text-2xl font-bold tracking-tight">
            Analytics
          </h2>
          <p class="text-sm text-muted-foreground" data-testid="analytics-subtitle">
            {{ subtitle }}
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <ClientOnly>
            <SavedViewsDropdown
              :saved-views="views.savedViews.value"
              :active-view="views.activeView.value"
              :is-dirty="views.isDirty.value"
              :is-loading="false"
              :can-update-active-view="views.canUpdateActiveView.value"
              :pending-view-id="views.pendingViewId.value"
              data-testid="analytics-saved-views"
              @load-view="views.loadView"
              @save-as="views.saveAs"
              @update="views.updateActiveView"
              @delete="views.deleteView"
              @rename="views.renameView"
              @reset="views.resetToDefault"
              @confirm-load="views.confirmLoadView"
              @cancel-load="views.cancelLoadView"
            />
          </ClientOnly>
          <Button
            variant="outline"
            size="sm"
            class="h-9 shrink-0 gap-1.5"
            :class="activeChips.length ? 'border-primary' : ''"
            :aria-expanded="panelOpen"
            data-testid="analytics-filters-toggle"
            @click="toggleFilters"
          >
            <Icon name="lucide:sliders-horizontal" class="size-4" />
            Filters
            <Badge v-if="activeChips.length" variant="default" class="h-4 min-w-4 rounded-full px-1 text-[9px]">
              {{ activeChips.length }}
            </Badge>
          </Button>
        </div>
      </div>

      <Empty v-if="!units.length" class="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon name="lucide:chart-no-axes-column" />
          </EmptyMedia>
          <EmptyTitle>No listings match these filters</EmptyTitle>
          <EmptyDescription>Region, listing and tag filters combine, and tags need every one. Remove one to widen the portfolio.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" @click="clearFilters">
            Reset filters
          </Button>
        </EmptyContent>
      </Empty>

      <!-- KPI row and body share one 4-column grid so the right column lines up under the last tile.
           Container queries, not viewport ones: the filter sidebar takes width when open. -->
      <div v-else class="grid grid-cols-1 gap-4 @2xl/analytics:grid-cols-2 @5xl/analytics:grid-cols-4">
        <GmKpiCard
          v-for="k in kpis"
          :key="k.label"
          :label="k.label"
          :icon="k.icon"
          :value="k.value"
          :delta="k.deltaText"
          :trend="k.trend"
          :hint="k.hint"
          compact
          data-testid="analytics-kpi"
        />

        <AnalyticsTrendChart
          class="@2xl/analytics:col-span-2 @5xl/analytics:col-span-3"
          :points="trend"
          :currency="currency"
          :grain="grain"
          :compare-label="compareLabel"
        />
        <AnalyticsChannelMix class="@2xl/analytics:col-span-2 @5xl/analytics:col-span-1" :shares="channels" :currency="currency" />

        <AnalyticsPaceChart class="@2xl/analytics:col-span-2" :points="pace" />
        <AnalyticsDistributionChart
          title="Booking window"
          description="Days between booking and arrival"
          :buckets="leadTimes"
          :summary="avgLead === null ? undefined : `${avgLead.toFixed(0)} days avg.`"
        />
        <AnalyticsDistributionChart
          title="Length of stay"
          description="Nights per stay"
          :buckets="stayLengths"
          :summary="avgStay === null ? undefined : `${avgStay.toFixed(1)} nights avg.`"
        />

        <AnalyticsListingTable class="@2xl/analytics:col-span-2 @5xl/analytics:col-span-3" :rows="listingRows" />
        <AnalyticsGuestOrigins class="@2xl/analytics:col-span-2 @5xl/analytics:col-span-1" :origins="origins" />
      </div>

      <p class="text-xs text-muted-foreground">
        Demo data: {{ arrivals.length.toLocaleString('en-US') }} arriving stays generated from your listings. Figures count nights inside the period; stays, booking window and length of stay count arrivals.
      </p>
    </div>

    <!-- Wide screens: pinned beside the charts, scrolling on its own. -->
    <aside
      v-if="panelOpen"
      class="sticky top-0 hidden max-h-[calc(100svh-7rem)] w-72 shrink-0 flex-col overflow-hidden rounded-xl border bg-card xl:flex"
      data-testid="analytics-filter-sidebar"
    >
      <AnalyticsFilterPanel @close="panelOpen = false" />
    </aside>

    <!-- Narrower screens: the same panel, sliding in from the right. -->
    <Sheet v-model:open="sheetOpen">
      <SheetContent side="right" class="w-80 gap-0 p-0 sm:max-w-80 [&>button:last-child]:hidden">
        <SheetHeader class="sr-only">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Narrow the analytics by period, listing, channel and guest market.</SheetDescription>
        </SheetHeader>
        <AnalyticsFilterPanel @close="sheetOpen = false" />
      </SheetContent>
    </Sheet>
  </div>
</template>
