<script setup lang="ts">
import type { PeriodPerformance } from '~/components/analytics/data/analytics'
import { formatCompactMoney, formatSpan, spanDays } from '~/components/analytics/data/analytics'
import { formatSignedPercent, formatSignedPoints, relativeDelta } from '~/components/gm/data/gm-dashboard'
import SavedViewsDropdown from '~/components/listings/SavedViewsDropdown.vue'
import { formatOwnerMoney } from '~/components/owners/data/owner-money'

definePageMeta({ layout: 'default' })
useHead({ title: 'Analytics' })

const {
  units,
  currency,
  span,
  previousSpan,
  compareLabel,
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
  filters,
  basisMeta,
  breakdown,
  channelRevenue,
  breakdownPoints,
  listingRanking,
  weekdayRates,
  pickup,
  movements,
  party,
  stayAvgNow,
  stayAvgBefore,
  stayAvgTrend,
} = useAnalytics()

/* Tabs: kept in the URL, so a refresh or a shared link opens the same one. */
const TABS = [
  { value: 'overview', label: 'Overview', icon: 'lucide:layout-dashboard' },
  { value: 'revenue', label: 'Revenue', icon: 'lucide:banknote' },
  { value: 'reservations', label: 'Reservations', icon: 'lucide:calendar-check' },
] as const
type TabValue = typeof TABS[number]['value']
const route = useRoute()
const router = useRouter()
const tab = computed<TabValue>({
  get: () => TABS.some(t => t.value === route.query.tab) ? route.query.tab as TabValue : 'overview',
  set: v => router.replace({ query: { ...route.query, tab: v === 'overview' ? undefined : v } }),
})

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

/** A badge only with a comparison period; `better: false` for "lower is good". */
function badge(delta: number | null, fmt: (n: number) => string, better = true) {
  return delta === null ? {} : { deltaText: fmt(delta), trend: trendOf(delta, better) }
}

// Revenue, occupancy, ADR and RevPAR get a chart card each (below); the
// tiles carry the figures that have no trend line.
const kpis = computed<Kpi[]>(() => {
  const c = current.value
  const p = previous.value
  const vs = compareLabel.value
  return [
    { label: 'Stays', icon: 'lucide:calendar-check', value: c.stays.toLocaleString('en-US'), hint: p ? `${p.stays.toLocaleString('en-US')} ${vs}` : 'Arrivals in the period', ...badge(p && relativeDelta(c.stays, p.stays), formatSignedPercent) },
    // A longer booking window or stay is neither good nor bad news, so no badge.
    { label: 'Avg. booking window', icon: 'lucide:calendar-clock', value: days(c.avgLeadDays), hint: p ? `${days(p.avgLeadDays)} ${vs}` : 'Booking to arrival' },
    { label: 'Avg. length of stay', icon: 'lucide:moon', value: nights(c.avgStayLength), hint: p ? `${nights(p.avgStayLength)} ${vs}` : 'Nights per arriving stay' },
    { label: 'Cancellation rate', icon: 'lucide:calendar-x', value: pct(c.cancellationRate), hint: 'Of bookings made in the period', ...badge(p && (c.cancellationRate ?? 0) - (p.cancellationRate ?? 0), formatSignedPoints, false) },
  ]
})

/** Revenue in a cut-off week or month looks like a collapse, so its card says so. */
const partialNote = computed(() => {
  const cut = trend.value.filter(t => t.partial)
  if (!cut.length)
    return null
  const parts = cut.map(t => `${t.label} (${spanDays(t.span)} ${spanDays(t.span) === 1 ? 'day' : 'days'})`)
  return `${parts.join(' and ')} ${cut.length === 1 ? 'is' : 'are'} only partly inside the period, so revenue there is lower.`
})

const compactMoney = (v: number) => formatCompactMoney(v, currency.value)
const fullMoney = (v: number) => formatOwnerMoney(v, currency.value)
const percent = (v: number) => `${Math.round(v)}%`

/** Gross down to the chosen basis, under the Revenue figure. Nothing to explain on gross. */
const revenueSteps = computed(() => {
  const basis = filters.value.revenueBasis
  if (basis === 'gross')
    return undefined
  const b = breakdown.value
  const minus = (v: number) => `- ${fullMoney(v)}`
  const rows = [
    { label: 'Gross', value: fullMoney(b.gross) },
    { label: 'OTA commission', value: minus(b.otaCommission) },
    { label: 'Payment fees', value: minus(b.paymentFees) },
  ]
  if (basis === 'net')
    return [...rows, { label: 'Net', value: fullMoney(b.net), total: true }]
  return [...rows, { label: 'Management commission', value: minus(b.managementCommission) }, { label: 'Owner net', value: fullMoney(b.ownerNet), total: true }]
})

const metricCards = computed(() => {
  const c = current.value
  const p = previous.value
  const vs = compareLabel.value
  const delta = (d: number | null, fmt: (n: number) => string) => {
    const b = badge(d, fmt)
    return b.deltaText ? { text: b.deltaText, trend: b.trend!, label: vs } : undefined
  }
  // With a comparison on, each bucket carries the comparison bucket in the same position.
  const series = (read: (x: PeriodPerformance) => number) => trend.value.map(t => ({
    label: t.label,
    value: read(t.current),
    previous: t.previous ? read(t.previous) : null,
  }))
  // Money cards say which basis they show, so a screenshot cannot be misread.
  const basis = filters.value.revenueBasis === 'gross' ? '' : ` (${basisMeta.value.title})`
  return [
    { key: 'revenue', title: `Revenue${basis}`, value: fullMoney(c.revenue), points: series(x => Math.round(x.revenue)), formatAxis: compactMoney, formatTooltip: fullMoney, delta: delta(p && relativeDelta(c.revenue, p.revenue), formatSignedPercent), note: partialNote.value, breakdown: revenueSteps.value },
    { key: 'occupancy', title: 'Occupancy', value: pct(c.occupancy), points: series(x => Math.round(x.occupancy * 1000) / 10), formatAxis: percent, formatTooltip: (v: number) => `${v}%`, max: 100, delta: delta(p && c.occupancy - p.occupancy, formatSignedPoints) },
    { key: 'adr', title: `Average Daily Rate${basis}`, value: fullMoney(c.adr), points: series(x => Math.round(x.adr)), formatAxis: compactMoney, formatTooltip: fullMoney, delta: delta(p && relativeDelta(c.adr, p.adr), formatSignedPercent) },
    { key: 'revpar', title: `RevPAR${basis}`, value: fullMoney(c.revpar), points: series(x => Math.round(x.revpar)), formatAxis: compactMoney, formatTooltip: fullMoney, delta: delta(p && relativeDelta(c.revpar, p.revpar), formatSignedPercent) },
  ]
})

/* ------------------------------------------------------------ Revenue tab */

const basisSuffix = computed(() => filters.value.revenueBasis === 'gross' ? '' : ` (${basisMeta.value.title})`)
const basisLabel = computed(() => `${basisMeta.value.label} revenue`)

const CHANNEL_SERIES = [
  { key: 'Airbnb', label: 'Airbnb', color: 'var(--viz-2)' },
  { key: 'Booking.com', label: 'Booking.com', color: 'var(--viz-1)' },
  { key: 'Direct', label: 'Direct', color: 'var(--viz-3)' },
]
const channelRows = computed(() => channelRevenue.value.map(p => ({ label: p.label, ...p.byChannel })))
const channelTotal = computed(() => channelRevenue.value.reduce((s, p) => s + p.total, 0))

// The stack adds up to gross: what the owner keeps at the bottom, each cost above it.
const BREAKDOWN_SERIES = [
  { key: 'ownerNet', label: 'Owner net', color: 'var(--viz-1)' },
  { key: 'managementCommission', label: 'Management commission', color: 'var(--viz-3)' },
  { key: 'paymentFees', label: 'Payment fees', color: 'var(--muted-foreground)' },
  { key: 'otaCommission', label: 'OTA commission', color: 'var(--viz-2)' },
]
const breakdownRows = computed(() => breakdownPoints.value.map(p => ({
  label: p.label,
  ownerNet: p.ownerNet,
  managementCommission: p.managementCommission,
  paymentFees: p.paymentFees,
  otaCommission: p.otaCommission,
})))

const weekdayRows = computed(() => weekdayRates.value.map(w => ({ label: w.day, adr: Math.round(w.adr ?? 0) })))
const weekdaySpread = computed(() => {
  const sold = weekdayRates.value.filter(w => w.adr !== null)
  if (sold.length < 2)
    return undefined
  const hi = sold.reduce((a, b) => (b.adr! > a.adr! ? b : a))
  const lo = sold.reduce((a, b) => (b.adr! < a.adr! ? b : a))
  return [{ label: `highest (${hi.day})`, value: fullMoney(hi.adr!) }, { label: `lowest (${lo.day})`, value: fullMoney(lo.adr!) }]
})

/* ------------------------------------------------------- Reservations tab */

const stayCards = computed(() => {
  const now = stayAvgNow.value
  const before = stayAvgBefore.value
  const vs = compareLabel.value
  const delta = (d: number | null, fmt: (n: number) => string) => {
    const b = badge(d, fmt)
    return b.deltaText ? { text: b.deltaText, trend: b.trend!, label: vs } : undefined
  }
  const arv = (x: { avgReservationValue: number | null }) => x.avgReservationValue === null ? null : Math.round(x.avgReservationValue)
  const alos = (x: { avgLengthOfStay: number | null }) => x.avgLengthOfStay === null ? null : Math.round(x.avgLengthOfStay * 10) / 10
  const signedNights = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)} nights`
  return [
    {
      key: 'arv',
      title: `Average reservation value${basisSuffix.value}`,
      value: now.avgReservationValue === null ? 'n/a' : fullMoney(now.avgReservationValue),
      points: stayAvgTrend.value.map(t => ({ label: t.label, value: arv(t.current), previous: t.previous ? arv(t.previous) : null })),
      formatAxis: compactMoney,
      formatTooltip: fullMoney,
      delta: delta(before && now.avgReservationValue !== null && before.avgReservationValue !== null ? relativeDelta(now.avgReservationValue, before.avgReservationValue) : null, formatSignedPercent),
    },
    {
      key: 'alos',
      title: 'Average length of stay',
      value: nights(now.avgLengthOfStay),
      points: stayAvgTrend.value.map(t => ({ label: t.label, value: alos(t.current), previous: t.previous ? alos(t.previous) : null })),
      formatAxis: (v: number) => `${v}`,
      formatTooltip: (v: number) => `${v} nights`,
      // Longer or shorter stays are neither good nor bad news: a neutral badge.
      delta: before && now.avgLengthOfStay !== null && before.avgLengthOfStay !== null
        ? { text: signedNights(now.avgLengthOfStay - before.avgLengthOfStay), trend: 'flat' as const, label: vs }
        : undefined,
    },
  ]
})

const PICKUP_SERIES = [
  { key: 'booked', label: 'Bookings made', color: 'var(--viz-1)' },
  { key: 'cancelled', label: 'Cancellations', color: 'var(--viz-2)' },
]
const MOVEMENT_SERIES = [
  { key: 'arrivals', label: 'Arrivals', color: 'var(--viz-1)' },
  { key: 'departures', label: 'Departures', color: 'var(--viz-3)' },
]
function sumOf<T>(rows: T[], key: keyof T): string {
  return rows.reduce((s, r) => s + Number(r[key]), 0).toLocaleString('en-US')
}

const partyNote = computed(() => {
  const p = party.value
  if (p.avgGuests === null)
    return 'Guests per arriving stay'
  return `${p.adults.toLocaleString('en-US')} adults, ${p.children.toLocaleString('en-US')} children; ${Math.round(p.withChildren * 100)}% of stays bring children`
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

      <Tabs v-model="tab" class="gap-4">
        <TabsList class="w-fit">
          <TabsTrigger v-for="t in TABS" :key="t.value" :value="t.value" :data-testid="`analytics-tab-${t.value}`">
            <Icon :name="t.icon" class="size-4" />
            {{ t.label }}
          </TabsTrigger>
        </TabsList>

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

        <template v-else>
          <TabsContent value="overview">
            <!-- KPI row and body share one 4-column grid so the right column lines up under the last tile.
                 Container queries, not viewport ones: the filter sidebar takes width when open. -->
            <div class="grid grid-cols-1 gap-4 @2xl/analytics:grid-cols-2 @5xl/analytics:grid-cols-4">
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

              <AnalyticsMetricCard
                v-for="m in metricCards"
                :key="m.key"
                class="@5xl/analytics:col-span-2"
                :title="m.title"
                :value="m.value"
                :period-label="formatSpan(span)"
                :points="m.points"
                :format-axis="m.formatAxis"
                :format-tooltip="m.formatTooltip"
                :max="m.max"
                :delta="m.delta"
                :note="m.note"
                :breakdown="m.breakdown"
                :compare-label="compareLabel"
              />

              <AnalyticsPaceChart class="@2xl/analytics:col-span-2" :points="pace" />
              <AnalyticsChannelMix :shares="channels" :currency="currency" />
              <AnalyticsGuestOrigins :origins="origins" />

              <!-- Full width: the length-of-stay chart that sat beside it lives on the
                   Reservations tab only ("Confirmed reservations by nights booked"). -->
              <AnalyticsDistributionChart
                class="@2xl/analytics:col-span-2 @5xl/analytics:col-span-4"
                title="Booking window"
                description="Days between booking and arrival"
                :buckets="leadTimes"
                :summary="avgLead === null ? undefined : `${avgLead.toFixed(0)} days avg.`"
              />

              <AnalyticsListingTable class="@2xl/analytics:col-span-2 @5xl/analytics:col-span-4" :rows="listingRows" />
            </div>
          </TabsContent>

          <TabsContent value="revenue">
            <div class="grid grid-cols-1 gap-4 @2xl/analytics:grid-cols-2 @5xl/analytics:grid-cols-4">
              <AnalyticsSeriesBarChart
                class="@2xl/analytics:col-span-2"
                :title="`Revenue by channel${basisSuffix}`"
                :description="`Earned on nights in each bucket, ${currency}`"
                :rows="channelRows"
                :series="CHANNEL_SERIES"
                type="stacked"
                :format-value="fullMoney"
                :format-axis="compactMoney"
                :totals="[{ label: 'total', value: fullMoney(channelTotal) }]"
                test-id="analytics-channel-revenue"
              />
              <AnalyticsSeriesBarChart
                class="@2xl/analytics:col-span-2"
                title="Where gross revenue goes"
                :description="`Each bar is gross: what the owner keeps, then each cost above it, ${currency}`"
                :rows="breakdownRows"
                :series="BREAKDOWN_SERIES"
                type="stacked"
                :format-value="fullMoney"
                :format-axis="compactMoney"
                test-id="analytics-breakdown-chart"
              />
              <AnalyticsSeriesBarChart
                class="@2xl/analytics:col-span-2"
                :title="`ADR by day of week${basisSuffix}`"
                description="Average rate per night sold, by the night's own weekday"
                :rows="weekdayRows"
                :series="[{ key: 'adr', label: 'ADR', color: 'var(--viz-1)' }]"
                :format-value="fullMoney"
                :format-axis="compactMoney"
                :totals="weekdaySpread"
                test-id="analytics-weekday-adr"
              />
              <AnalyticsBreakdownTable class="@2xl/analytics:col-span-2" :totals="breakdown" :currency="currency" />
              <AnalyticsListingRevenueBars
                class="@2xl/analytics:col-span-2 @5xl/analytics:col-span-4"
                :ranked="listingRanking.ranked"
                :other-currency="listingRanking.otherCurrency"
                :currency="currency"
                :basis-label="basisLabel"
              />
            </div>
          </TabsContent>

          <TabsContent value="reservations">
            <div class="grid grid-cols-1 gap-4 @2xl/analytics:grid-cols-2 @5xl/analytics:grid-cols-4">
              <AnalyticsMetricCard
                v-for="m in stayCards"
                :key="m.key"
                class="@5xl/analytics:col-span-2"
                :title="m.title"
                :value="m.value"
                :period-label="formatSpan(span)"
                :points="m.points"
                :format-axis="m.formatAxis"
                :format-tooltip="m.formatTooltip"
                :delta="m.delta"
                :compare-label="compareLabel"
              />
              <AnalyticsSeriesBarChart
                class="@2xl/analytics:col-span-2"
                title="Bookings made over time"
                description="By the day each booking was made or cancelled"
                :rows="pickup"
                :series="PICKUP_SERIES"
                :totals="[{ label: 'booked', value: sumOf(pickup, 'booked') }, { label: 'cancelled', value: sumOf(pickup, 'cancelled') }]"
                test-id="analytics-pickup"
              />
              <AnalyticsSeriesBarChart
                class="@2xl/analytics:col-span-2"
                title="Arrivals and departures"
                description="Check-ins and check-outs of confirmed stays"
                :rows="movements"
                :series="MOVEMENT_SERIES"
                :totals="[{ label: 'arrivals', value: sumOf(movements, 'arrivals') }, { label: 'departures', value: sumOf(movements, 'departures') }]"
                test-id="analytics-movements"
              />
              <AnalyticsDistributionChart
                class="@5xl/analytics:col-span-2"
                title="Confirmed reservations by nights booked"
                description="Stays arriving in the period, by length"
                :buckets="stayLengths"
                :summary="avgStay === null ? undefined : `${avgStay.toFixed(1)} nights avg.`"
              />
              <AnalyticsDistributionChart
                class="@5xl/analytics:col-span-2"
                title="Guests and party size"
                :description="partyNote"
                :buckets="party.buckets"
                :summary="party.avgGuests === null ? undefined : `${party.avgGuests.toFixed(1)} guests avg.`"
              />
            </div>
          </TabsContent>
        </template>
      </Tabs>

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
