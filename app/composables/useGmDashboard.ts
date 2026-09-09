import type { GmRegion, GmStay } from '~/components/gm/data/gm-dashboard'
import type { Conversation } from '~/components/inbox/data/conversations'
import {
  addIsoDays,
  bookingsOn,
  buildDayFlow,
  buildGmStays,
  buildKpis,
  buildRegionByListingName,
  buildRevenueSeries,
  isoRange,
  periodMetrics,
  scopeToRegion,
  sortByAttention,
  summariseSentiment,
  toGmUnits,
  toIsoDate,
} from '~/components/gm/data/gm-dashboard'
import { listings } from '~/components/listings/data/listings'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useInbox } from '~/composables/useInbox'

/** Negative-sentiment rows shown before the panel defers to the inbox. */
const SENTIMENT_ROW_LIMIT = 4

/** Days shown in the occupancy flow chart: three behind, today, then ahead. */
const FLOW_DAYS = 14
const FLOW_LOOKBACK = 3
/** Dates offered by the bookings panel's date strip. */
const STRIP_DAYS = 7

export type GmRevenueRange = '14d' | '30d'

export function useGmDashboard() {
  const { currentUser } = useCurrentDashboardUser()
  const inbox = useInbox()
  const isGeneralManager = computed(() => currentUser.value?.roleId === 'role-general-manager')

  // Resolved once and shared through `useState`, so the server and the client
  // agree on "today" even if their clocks or timezones do not.
  const anchorDate = useState<string>('gm-anchor-date', () => toIsoDate(new Date()))
  const region = useState<GmRegion>('gm-region', () => 'all')
  const revenueRange = useState<GmRevenueRange>('gm-revenue-range', () => '30d')
  const selectedDate = useState<string>('gm-selected-date', () => anchorDate.value)
  const stripStart = useState<string>('gm-strip-start', () => addIsoDays(anchorDate.value, -1))

  const allUnits = computed(() => toGmUnits(listings.value))

  // Stays are generated for the whole portfolio and then filtered, so a stay
  // keeps its id (and the panel keeps its selection) when the region changes.
  const allStays = computed<GmStay[]>(() => buildGmStays(allUnits.value, anchorDate.value))

  const units = computed(() =>
    region.value === 'all'
      ? allUnits.value
      : allUnits.value.filter(unit => unit.region === region.value))

  const stays = computed<GmStay[]>(() =>
    region.value === 'all'
      ? allStays.value
      : allStays.value.filter(stay => stay.region === region.value))

  const unitCount = computed(() => units.value.length)

  const kpis = computed(() => buildKpis(stays.value, anchorDate.value, unitCount.value))

  const flowDays = computed(() =>
    isoRange(addIsoDays(anchorDate.value, -FLOW_LOOKBACK), FLOW_DAYS))

  const dayFlow = computed(() => buildDayFlow(stays.value, flowDays.value, unitCount.value))

  const revenueDayCount = computed(() => (revenueRange.value === '14d' ? 14 : 30))

  const revenueSeries = computed(() =>
    buildRevenueSeries(
      stays.value,
      isoRange(addIsoDays(anchorDate.value, -(revenueDayCount.value - 1)), revenueDayCount.value),
    ))

  /** Totals for the revenue card's own header, matching its visible range. */
  const revenueRangeMetrics = computed(() =>
    periodMetrics(
      stays.value,
      addIsoDays(anchorDate.value, -(revenueDayCount.value - 1)),
      revenueDayCount.value,
      unitCount.value,
    ))

  const selectedBookings = computed(() => bookingsOn(stays.value, selectedDate.value))

  const stripDays = computed(() => isoRange(stripStart.value, STRIP_DAYS))

  /** Occupancy per strip date, for the density dot under each day button. */
  const stripOccupancy = computed(() => {
    const flow = buildDayFlow(stays.value, stripDays.value, unitCount.value)
    return new Map(flow.map(day => [day.date, day.occupancy]))
  })

  // Guest sentiment comes from the inbox, which keys conversations by listing
  // NAME, so the region filter can only reach the ones whose name resolves to
  // a known listing. `excluded` reports the rest instead of hiding them.
  const regionByListingName = computed(() => buildRegionByListingName(allUnits.value))

  const negativeScope = computed(() => {
    const negative = inbox.conversations.value.filter(c => c.sentiment === 'negative')
    return scopeToRegion(negative, region.value, regionByListingName.value)
  })

  const negativeConversations = computed<Conversation[]>(() =>
    sortByAttention(negativeScope.value.rows))

  const sentimentSummary = computed(() =>
    summariseSentiment(negativeScope.value.rows, negativeScope.value.excluded))

  /** What the panel renders; the rest is a link into the inbox. */
  const visibleNegative = computed(() => negativeConversations.value.slice(0, SENTIMENT_ROW_LIMIT))

  const hiddenNegativeCount = computed(() =>
    Math.max(0, negativeConversations.value.length - visibleNegative.value.length))

  /** Opens the conversation in the inbox, the same way the GRO dashboard does. */
  function openConversation(conversationId: string) {
    inbox.selectedConversationId.value = conversationId
    inbox.inboxView.value = 'conversations'
    return navigateTo('/inbox')
  }

  function markHandled(conversationId: string) {
    inbox.markAsHandled(conversationId)
  }

  function setSelectedDate(iso: string) {
    selectedDate.value = iso
  }

  function shiftStrip(days: number) {
    stripStart.value = addIsoDays(stripStart.value, days)
  }

  function goToToday() {
    stripStart.value = addIsoDays(anchorDate.value, -1)
    selectedDate.value = anchorDate.value
  }

  const regionOptions: { value: GmRegion, label: string }[] = [
    { value: 'all', label: 'All regions' },
    { value: 'Bali', label: 'Bali' },
    { value: 'Germany', label: 'Germany' },
  ]

  return {
    isGeneralManager,
    anchorDate,
    region,
    regionOptions,
    revenueRange,
    revenueDayCount,
    selectedDate,
    units,
    unitCount,
    stays,
    kpis,
    dayFlow,
    revenueSeries,
    revenueRangeMetrics,
    selectedBookings,
    stripDays,
    stripOccupancy,
    negativeConversations,
    visibleNegative,
    hiddenNegativeCount,
    sentimentSummary,
    openConversation,
    markHandled,
    setSelectedDate,
    shiftStrip,
    goToToday,
  }
}
