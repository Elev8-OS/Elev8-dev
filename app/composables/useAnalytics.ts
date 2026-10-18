import type { AnalyticsCompareMode, AnalyticsPeriodPreset, AnalyticsScope, DateSpan, RetiredLifecycle } from '~/components/analytics/data/analytics'
import type { RevenueBasis } from '~/components/analytics/data/revenue-basis'
import {
  ANALYTICS_CHANNELS,
  ANALYTICS_COMPARE_MODES,
  ANALYTICS_PERIODS,
  arrivalsIn,
  bookingPace,
  buildAnalyticsBookings,
  channelIcons,
  channelMix,
  comparisonLabel,
  comparisonPeriod,
  countryName,
  currenciesOf,
  defaultCompareMode,
  EMPTY_SCOPE,
  guestOrigins,
  leadTimeDistribution,
  LIFECYCLE_LABELS,
  lifecycleIncluded,
  listingPerformance,
  periodPerformance,
  resolvePeriod,
  scopeBookings,
  scopeUnits,
  toAnalyticsUnits,
  trendGrain,
  trendSeries,
} from '~/components/analytics/data/analytics'
import { extensionRevenueSeries, extensionSummary } from '~/components/analytics/data/extension-insights'
import { movementSeries, partySummary, pickupSeries, stayAverages, stayAverageSeries } from '~/components/analytics/data/reservation-insights'
import { paymentLinkSummary } from '~/components/analytics/data/payment-link-insights'
import { buildUpsellOrders, upsellRevenueSeries, upsellSummary } from '~/components/analytics/data/upsell-insights'
import { retiredUnits } from '~/components/analytics/data/retired-listings'
import { buildCommissionRates, makeValuer, REVENUE_BASES, revenueBreakdown } from '~/components/analytics/data/revenue-basis'
import { adrByWeekday, breakdownSeries, channelRevenueSeries, rankListingsByRevenue } from '~/components/analytics/data/revenue-insights'
import { toIsoDate } from '~/components/gm/data/gm-dashboard'
import { stayLengthDistribution } from '~/components/listings/data/listing-overview-charts'
import { listings } from '~/components/listings/data/listings'
import { getListingIdsForWebsite } from '~/components/website-builder/data/property-listings'
import { websites } from '~/components/website-builder/data/websites'
import { useOwners } from '~/composables/useOwners'
import { usePaymentRequests } from '~/composables/usePaymentRequests'

export interface AnalyticsFilters extends AnalyticsScope {
  period: AnalyticsPeriodPreset
  /** Only read when `period` is `custom`. */
  customRange: DateSpan | null
  compare: AnalyticsCompareMode
  /** null = the currency most listings in scope earn in. */
  currency: string | null
  /** What a sold night is worth: gross, net of channel fees, or net of the management commission too. */
  revenueBasis: RevenueBasis
}

export type ScopeKey = keyof AnalyticsScope

export interface FilterOption {
  value: string
  label: string
  icon?: string
  /** Overrides the muted icon colour, e.g. a priority flag. */
  iconClass?: string
  /** Secondary text on the option row, e.g. a listing's location. */
  hint?: string
}

/** One removable chip per active scope value. */
export interface ActiveFilterChip {
  key: ScopeKey
  value: string
  label: string
}

const SCOPE_LABELS: Record<ScopeKey, string> = {
  regions: 'Region',
  listingIds: 'Listing',
  tags: 'Tag',
  channels: 'Channel',
  countries: 'Market',
  includeRetired: 'Including',
}

export function defaultAnalyticsFilters(): AnalyticsFilters {
  return {
    ...EMPTY_SCOPE,
    period: '30d',
    customRange: null,
    compare: defaultCompareMode('30d'),
    currency: null,
    revenueBasis: 'gross',
  }
}

export function useAnalytics() {
  // Resolved once so server and client agree on "today".
  const anchorDate = useState<string>('analytics-anchor-date', () => toIsoDate(new Date()))
  const filters = useState<AnalyticsFilters>('analytics-filters', defaultAnalyticsFilters)

  // Retired demo listings go last; each listing's stays are seeded from its own id.
  const allUnits = computed(() => [...toAnalyticsUnits(listings.value), ...retiredUnits(anchorDate.value)])
  // Generated for the whole portfolio once, then filtered, so a filter change
  // never reshuffles a listing's bookings.
  // The sites direct bookings can come from. A site with no properties set has
  // no known coverage and takes no booking (they land in "Other direct").
  const websiteCoverage = computed(() => websites.value.map(w => ({ id: w.id, name: w.name, listingIds: getListingIdsForWebsite(w) })))
  const allBookings = computed(() => buildAnalyticsBookings(allUnits.value, anchorDate.value, undefined, websiteCoverage.value))

  /* ------------------------------------------------------------- options */

  const regionOptions = computed<FilterOption[]>(() =>
    [...new Set(allUnits.value.map(u => u.region))].sort().map(r => ({ value: r, label: r, icon: 'lucide:map-pin' })))
  /** Only listings the status switches let in, retired ones marked as such. */
  const listingOptions = computed<FilterOption[]>(() =>
    allUnits.value
      .filter(u => lifecycleIncluded(u, filters.value.includeRetired))
      .sort((a, b) => a.listingName.localeCompare(b.listingName))
      .map(u => ({
        value: u.listingId,
        label: u.listingName,
        hint: u.lifecycle === 'active' ? u.location : `${LIFECYCLE_LABELS[u.lifecycle]} · ${u.location}`,
      })))
  /** How many retired listings each switch would add. */
  const retiredCounts = computed<Record<RetiredLifecycle, number>>(() => ({
    inactive: allUnits.value.filter(u => u.lifecycle === 'inactive').length,
    deleted: allUnits.value.filter(u => u.lifecycle === 'deleted').length,
  }))
  const tagOptions = computed<FilterOption[]>(() =>
    [...new Set(allUnits.value.flatMap(u => u.tags))].sort((a, b) => a.localeCompare(b)).map(t => ({ value: t, label: t })))
  const channelOptions: FilterOption[] = ANALYTICS_CHANNELS.map(c => ({ value: c, label: c, icon: channelIcons[c] }))
  const countryOptions = computed<FilterOption[]>(() =>
    [...new Set(allBookings.value.map(b => b.country))]
      .map(c => ({ value: c, label: countryName(c) }))
      .sort((a, b) => a.label.localeCompare(b.label)))

  const optionsByKey = computed<Record<ScopeKey, FilterOption[]>>(() => ({
    regions: regionOptions.value,
    listingIds: listingOptions.value,
    tags: tagOptions.value,
    channels: channelOptions,
    countries: countryOptions.value,
    includeRetired: (['inactive', 'deleted'] as const).map(k => ({ value: k, label: `${LIFECYCLE_LABELS[k].toLowerCase()} listings` })),
  }))

  /* --------------------------------------------------------------- scope */

  const units = computed(() => scopeUnits(allUnits.value, filters.value))
  const bookings = computed(() => scopeBookings(allBookings.value, units.value, filters.value))

  const currencyOptions = computed(() => currenciesOf(units.value))
  const currency = computed(() => {
    const picked = filters.value.currency
    return picked && currencyOptions.value.includes(picked) ? picked : (currencyOptions.value[0] ?? 'USD')
  })

  const span = computed(() => resolvePeriod(filters.value.period, anchorDate.value, filters.value.customRange))
  const previousSpan = computed(() => comparisonPeriod(filters.value.compare, span.value))
  const compareLabel = computed(() => comparisonLabel(filters.value.compare))
  const grain = computed(() => trendGrain(span.value))

  /* ------------------------------------------------------------- figures */

  /* ------------------------------------------------------ revenue basis */

  const { mappings, commissionRules } = useOwners()
  // From every booking, not the filtered ones: a contract's rate depends on the
  // listing's whole month, whatever channel or market is on screen.
  const commissionRates = computed(() => buildCommissionRates(allBookings.value, mappings.value, commissionRules.value))
  const value = computed(() => makeValuer(filters.value.revenueBasis, commissionRates.value))
  const basisMeta = computed(() => REVENUE_BASES.find(b => b.value === filters.value.revenueBasis)!)
  /** Listings in scope with an owner contract; the rest have no commission, so their owner net equals net. */
  const contractedListings = computed(() => {
    const ids = new Set(mappings.value.map(m => m.listingId))
    return units.value.filter(u => ids.has(u.listingId)).length
  })
  const breakdown = computed(() => revenueBreakdown(bookings.value, span.value, currency.value, commissionRates.value))

  const current = computed(() => periodPerformance(bookings.value, units.value, span.value, currency.value, value.value))
  const previous = computed(() => previousSpan.value
    ? periodPerformance(bookings.value, units.value, previousSpan.value, currency.value, value.value)
    : null)
  const trend = computed(() => trendSeries(bookings.value, units.value, span.value, previousSpan.value, currency.value, value.value))

  const arrivals = computed(() => arrivalsIn(bookings.value, span.value))
  const channels = computed(() => channelMix(arrivals.value, currency.value, value.value, websiteCoverage.value))
  const leadTimes = computed(() => leadTimeDistribution(arrivals.value))
  const stayLengths = computed(() => stayLengthDistribution(arrivals.value))
  const origins = computed(() => guestOrigins(arrivals.value))
  const pace = computed(() => bookingPace(bookings.value, units.value, anchorDate.value))
  const listingRows = computed(() => listingPerformance(bookings.value, units.value, span.value, previousSpan.value, value.value))

  /* ------------------------------------------- Revenue and Reservations tabs */
  // Computeds are lazy, so a tab's figures are only worked out while it is open.

  const channelRevenue = computed(() => channelRevenueSeries(bookings.value, span.value, currency.value, value.value))
  const breakdownPoints = computed(() => breakdownSeries(bookings.value, span.value, currency.value, commissionRates.value))
  const listingRanking = computed(() => rankListingsByRevenue(listingRows.value, currency.value))
  const weekdayRates = computed(() => adrByWeekday(bookings.value, span.value, currency.value, value.value))

  const pickup = computed(() => pickupSeries(bookings.value, span.value))
  const movements = computed(() => movementSeries(bookings.value, span.value))
  const party = computed(() => partySummary(arrivals.value))
  const stayAvgNow = computed(() => stayAverages(bookings.value, span.value, currency.value, value.value))
  const stayAvgBefore = computed(() => previousSpan.value ? stayAverages(bookings.value, previousSpan.value, currency.value, value.value) : null)
  const stayAvgTrend = computed(() => stayAverageSeries(bookings.value, span.value, previousSpan.value, currency.value, value.value))
  const extensionsNow = computed(() => extensionSummary(bookings.value, span.value, currency.value, value.value))
  const extensionsBefore = computed(() => previousSpan.value ? extensionSummary(bookings.value, previousSpan.value, currency.value, value.value) : null)
  const extensionRevenue = computed(() => extensionRevenueSeries(bookings.value, span.value, currency.value, value.value))

  // Upsell orders hang off the scoped stays, so every scope filter narrows them too.
  const upsellOrders = computed(() => buildUpsellOrders(bookings.value, anchorDate.value))
  const upsellsNow = computed(() => upsellSummary(bookings.value, upsellOrders.value, span.value, currency.value))
  const upsellsBefore = computed(() => previousSpan.value ? upsellSummary(bookings.value, upsellOrders.value, previousSpan.value, currency.value) : null)
  const upsellRevenue = computed(() => upsellRevenueSeries(upsellOrders.value, span.value, currency.value))

  // The real payment links, narrowed to the listings in scope.
  const { requests: paymentRequests } = usePaymentRequests()
  const scopedListingIds = computed(() => new Set(units.value.map(u => u.listingId)))
  const paymentLinksNow = computed(() => paymentLinkSummary(paymentRequests.value, scopedListingIds.value, span.value, currency.value))
  const paymentLinksBefore = computed(() => previousSpan.value ? paymentLinkSummary(paymentRequests.value, scopedListingIds.value, previousSpan.value, currency.value) : null)

  /* -------------------------------------------------------------- chips */

  const activeChips = computed<ActiveFilterChip[]>(() =>
    (Object.keys(SCOPE_LABELS) as ScopeKey[]).flatMap(key =>
      (filters.value[key] as string[]).map(value => ({
        key,
        value,
        label: `${SCOPE_LABELS[key]}: ${optionsByKey.value[key].find(o => o.value === value)?.label ?? value}`,
      }))))

  const hasFilters = computed(() => activeChips.value.length > 0)

  const periodLabel = computed(() => ANALYTICS_PERIODS.find(p => p.value === filters.value.period)!.label)
  const compareModeLabel = computed(() => ANALYTICS_COMPARE_MODES.find(m => m.value === filters.value.compare)!.label)

  /* ------------------------------------------------------------ setters */

  /** A preset brings its natural comparison along; a custom range keeps the current one. */
  function setPeriod(period: AnalyticsPeriodPreset) {
    filters.value = {
      ...filters.value,
      period,
      compare: period === 'custom' ? filters.value.compare : defaultCompareMode(period),
      customRange: period === 'custom' ? (filters.value.customRange ?? span.value) : filters.value.customRange,
    }
  }
  function setCustomRange(range: DateSpan) {
    filters.value = { ...filters.value, period: 'custom', customRange: range }
  }
  function setCompare(compare: AnalyticsCompareMode) {
    filters.value = { ...filters.value, compare }
  }
  function setRevenueBasis(revenueBasis: RevenueBasis) {
    filters.value = { ...filters.value, revenueBasis }
  }
  function setCurrency(code: string) {
    filters.value = { ...filters.value, currency: code }
  }
  function setScope(key: ScopeKey, values: string[]) {
    filters.value = { ...filters.value, [key]: values }
  }
  function toggleScope(key: ScopeKey, value: string) {
    const list = filters.value[key] as string[]
    setScope(key, list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }
  /**
   * Turning a kind off also drops any listing of that kind picked in the
   * Listings filter, which would otherwise narrow the scope to nothing.
   */
  function setIncludeRetired(kind: RetiredLifecycle, on: boolean) {
    const includeRetired = on
      ? [...new Set([...filters.value.includeRetired, kind])]
      : filters.value.includeRetired.filter(k => k !== kind)
    const dropped = new Set(allUnits.value.filter(u => u.lifecycle === kind).map(u => u.listingId))
    filters.value = {
      ...filters.value,
      includeRetired,
      listingIds: on ? filters.value.listingIds : filters.value.listingIds.filter(id => !dropped.has(id)),
    }
  }
  /** Clears what narrows the portfolio; period, comparison and currency stay. */
  function clearFilters() {
    filters.value = { ...filters.value, ...EMPTY_SCOPE }
  }
  function resetAll() {
    filters.value = defaultAnalyticsFilters()
  }

  return {
    anchorDate,
    filters,
    regionOptions,
    listingOptions,
    tagOptions,
    channelOptions,
    countryOptions,
    units,
    bookings,
    currency,
    currencyOptions,
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
    hasFilters,
    periodLabel,
    compareModeLabel,
    setPeriod,
    setCustomRange,
    setCompare,
    setCurrency,
    setRevenueBasis,
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
    extensionsNow,
    extensionsBefore,
    extensionRevenue,
    upsellsNow,
    upsellsBefore,
    upsellRevenue,
    paymentLinksNow,
    paymentLinksBefore,
    basisMeta,
    breakdown,
    contractedListings,
    setScope,
    toggleScope,
    setIncludeRetired,
    retiredCounts,
    clearFilters,
    resetAll,
  }
}
