import type { ScoreCategory } from '~/components/review-hub/data/types'
import type {
  AnalyticsCategoryScore,
  AnalyticsCategoryTag,
  AnalyticsCategoryTagGroup,
  AnalyticsChannelFilter,
  AnalyticsComparisonMode,
  AnalyticsListingStatus,
  AnalyticsPeriodPreset,
  AnalyticsTrendPoint,
  ReviewAnalyticsSavedView,
  ReviewAnalyticsViewState,
} from '~/types/review-analytics'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { buildAnalyticsReviewRecords } from '~/components/review-hub/data/mock-review-analytics'
import { getCategoryDisplayLabel, getTagLabel, getTagSentiment } from '~/components/review-hub/data/types'
import { DEFAULT_ANALYTICS_VIEW } from '~/types/review-analytics'

// --- localStorage helpers (same pattern as useSavedViews) ---
function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined')
    return defaultValue
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : defaultValue
  }
  catch {
    return defaultValue
  }
}

function saveToLocalStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined')
    return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  }
  catch {
    toast.error(`Could not save ${key} to storage.`)
  }
}

// Page-scoped keys (kept separate from the listings saved-views keys)
const VIEWS_KEY = 'elev8-review-analytics-views'
const ACTIVE_VIEW_KEY = 'elev8-review-analytics-active-view'
const CURRENT_STATE_KEY = 'elev8-review-analytics-current-state'
const PENDING_VIEW_ID_KEY = 'elev8-review-analytics-pending-view-id'

// Channel-aware category ordering (matches example + Booking.com schema)
const AIRBNB_CATEGORIES = ['value', 'location', 'checkin', 'accuracy', 'communication', 'cleanliness']
const BOOKING_CATEGORIES = ['value', 'clean', 'location', 'comfort', 'facilities', 'staff']

const PERIOD_DAYS: Record<Exclude<AnalyticsPeriodPreset, 'custom'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
}

function generateViewId(): string {
  return `view_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/** Day key as YYYY-MM-DD */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function useReviewAnalytics() {
  // Single source of truth: deterministic historical seed (~280 records, Jun 2025 - Aug 2026)
  const reviewRecords = useState('review-analytics-records', () => buildAnalyticsReviewRecords())

  // --- Filters (shared via useState so all components see the same values) ---
  const channelFilter = useState<AnalyticsChannelFilter>('review-analytics-channel', () => 'all')
  const listingFilter = useState<string[]>('review-analytics-listing', () => [])
  const dateFrom = useState<string | null>('review-analytics-date-from', () => null)
  const dateTo = useState<string | null>('review-analytics-date-to', () => null)
  const periodPreset = useState<AnalyticsPeriodPreset>('review-analytics-period', () => '30d')
  const comparisonMode = useState<AnalyticsComparisonMode>('review-analytics-comparison', () => 'previous_year')

  // --- Saved views (analytics-scoped) ---
  const savedViews = ref<ReviewAnalyticsSavedView[]>(loadFromLocalStorage(VIEWS_KEY, [DEFAULT_ANALYTICS_VIEW]))
  const activeView = ref<ReviewAnalyticsSavedView | null>(loadFromLocalStorage(ACTIVE_VIEW_KEY, DEFAULT_ANALYTICS_VIEW))
  const currentState = ref<ReviewAnalyticsViewState | null>(loadFromLocalStorage(CURRENT_STATE_KEY, null))
  const pendingViewId = ref<string | null>(loadFromLocalStorage(PENDING_VIEW_ID_KEY, null))
  const isLoading = ref(false)

  watch(savedViews, (newVal) => {
    saveToLocalStorage(VIEWS_KEY, newVal.filter(v => !v.isDefault))
  }, { deep: true })

  watch(activeView, (newVal) => {
    saveToLocalStorage(ACTIVE_VIEW_KEY, newVal)
  }, { deep: true })

  watch(currentState, (newVal) => {
    saveToLocalStorage(CURRENT_STATE_KEY, newVal)
  }, { deep: true })

  watch(pendingViewId, (newVal) => {
    saveToLocalStorage(PENDING_VIEW_ID_KEY, newVal)
  })

  // Apply period preset → sets dateFrom/dateTo (relative to today)
  function applyPeriodPreset(preset: AnalyticsPeriodPreset) {
    periodPreset.value = preset
    if (preset === 'custom') {
      return // user controls date range manually
    }
    const today = new Date()
    dateTo.value = dayKey(today)
    dateFrom.value = dayKey(addDays(today, -PERIOD_DAYS[preset] + 1))
  }

  // --- Unique listings (from review records) ---
  const uniqueListings = computed(() => {
    const map = new Map<string, { name: string, city: string, region: string }>()
    reviewRecords.value.forEach((r) => {
      if (!map.has(r.listing_id)) {
        map.set(r.listing_id, {
          name: r.listing_name,
          city: r.listing_location.split(',')[0]?.trim() ?? 'Bali',
          region: 'Bali',
        })
      }
    })
    return Array.from(map.values())
  })

  // --- Filtered records (for KPI cards + categories) ---
  const filteredRecords = computed(() => {
    return reviewRecords.value.filter((r) => {
      if (channelFilter.value !== 'all' && r.source !== channelFilter.value)
        return false
      if (listingFilter.value.length > 0 && !listingFilter.value.includes('All Properties') && !listingFilter.value.includes(r.listing_name))
        return false
      if (dateFrom.value && r.checkout_date < dateFrom.value)
        return false
      if (dateTo.value && r.checkout_date > dateTo.value)
        return false
      return true
    })
  })

  // Records in the previous period (for WoW comparison): same length immediately before dateFrom
  const previousPeriodRecords = computed(() => {
    if (!dateFrom.value || !dateTo.value)
      return []
    const from = new Date(dateFrom.value)
    const to = new Date(dateTo.value)
    const span = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000))
    const prevFrom = dayKey(addDays(from, -span))
    const prevTo = dayKey(addDays(from, -1))
    return reviewRecords.value.filter((r) => {
      if (channelFilter.value !== 'all' && r.source !== channelFilter.value)
        return false
      if (listingFilter.value.length > 0 && !listingFilter.value.includes('All Properties') && !listingFilter.value.includes(r.listing_name))
        return false
      if (r.checkout_date < prevFrom || r.checkout_date > prevTo)
        return false
      return true
    })
  })

  // --- Overall score (0-10 normalized) ---
  const overallScoreRaw = computed(() => {
    const rated = filteredRecords.value.filter(r => r.guest_rating_overall !== null)
    if (rated.length === 0)
      return null
    return rated.reduce((s, r) => s + (r.guest_rating_overall ?? 0), 0) / rated.length
  })

  const overallScoreDisplay = computed(() => overallScoreRaw.value)

  const overallScoreMax = computed(() => 10)

  const ratedCount = computed(() => filteredRecords.value.filter(r => r.guest_rating_overall !== null).length)

  // --- 5-star review rate (0-10 scale: >=8 = 5-star equivalent) ---
  function starRateOf(records: typeof reviewRecords.value): number {
    const rated = records.filter(r => r.guest_rating_overall !== null)
    if (rated.length === 0)
      return 0
    const fiveStar = rated.filter(r => (r.guest_rating_overall ?? 0) >= 8).length
    return (fiveStar / rated.length) * 100
  }

  const starRate = computed(() => starRateOf(filteredRecords.value))
  const previousStarRate = computed(() => starRateOf(previousPeriodRecords.value))

  // --- Top negative tags: % of total reviews in the filtered set ---
  const topNegativeTags = computed(() => {
    const counts = new Map<string, number>()
    filteredRecords.value.forEach((r) => {
      r.tags.forEach((t) => {
        if (getTagSentiment(t) === 'negative') {
          counts.set(t, (counts.get(t) ?? 0) + 1)
        }
      })
    })
    const total = filteredRecords.value.length || 1
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, label: getTagLabel(tag), count, percentage: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
  })

  // --- Listing statuses (per-listing, based on average rating in the filtered period) ---
  const listingStatuses = computed<AnalyticsListingStatus[]>(() => {
    const listings = uniqueListings.value
    const total = listings.length
    // Per-listing average rating from the filtered records
    const listingAvg = new Map<string, number>()
    const buckets = new Map<string, { sum: number, count: number }>()
    filteredRecords.value.forEach((r) => {
      if (r.guest_rating_overall === null)
        return
      const b = buckets.get(r.listing_id) ?? { sum: 0, count: 0 }
      b.sum += r.guest_rating_overall
      b.count += 1
      buckets.set(r.listing_id, b)
    })
    listings.forEach((l) => {
      // listings are keyed by name in uniqueListings; match by listing_name
      const rec = filteredRecords.value.find(r => r.listing_name === l.name)
      if (!rec)
        return
      const b = buckets.get(rec.listing_id)
      if (b && b.count > 0)
        listingAvg.set(rec.listing_id, b.sum / b.count)
    })
    let good = 0
    let warning = 0
    let atRisk = 0
    listingAvg.forEach((avg) => {
      if (avg >= 6)
        good += 1
      else if (avg >= 4)
        warning += 1
      else
        atRisk += 1
    })
    return [
      { label: 'Good or Educational', count: good, total, viewListings: true },
      { label: 'Warning', count: warning, total, viewListings: true },
      { label: 'At risk of Suspension / Removal', count: atRisk, total, viewListings: true },
      { label: 'Removed', count: 0, total, viewListings: true },
    ]
  })

  // --- Channel-aware category performance ---
  const categoryOrder = computed(() => {
    if (channelFilter.value === 'booking_com')
      return BOOKING_CATEGORIES
    return AIRBNB_CATEGORIES
  })

  function categoryAvg(records: typeof reviewRecords.value, order: string[]): Map<string, number> {
    const buckets = new Map<string, { sum: number, count: number }>()
    records.forEach((r) => {
      r.scores.forEach((s: ScoreCategory) => {
        if (!order.includes(s.category))
          return
        const b = buckets.get(s.category) ?? { sum: 0, count: 0 }
        b.sum += s.score
        b.count += 1
        buckets.set(s.category, b)
      })
    })
    const out = new Map<string, number>()
    order.forEach((cat) => {
      const b = buckets.get(cat)
      out.set(cat, b && b.count > 0 ? b.sum / b.count : 0)
    })
    return out
  }

  const categoryPerformance = computed<AnalyticsCategoryScore[]>(() => {
    const order = categoryOrder.value
    const current = categoryAvg(filteredRecords.value, order)
    const prev = categoryAvg(previousPeriodRecords.value, order)
    return order.map((cat) => {
      const score = current.get(cat) ?? 0
      const prevScore = prev.get(cat) ?? 0
      return {
        category: cat,
        label: getCategoryDisplayLabel(cat),
        score: Number(score.toFixed(2)),
        wow: Number((score - prevScore).toFixed(2)),
        yoy: 0, // no prior-year category data in seed (13 months)
      }
    })
  })

  // --- Category tags (positive/negative per category), % of reviews ---
  const categoryTags = computed<AnalyticsCategoryTagGroup[]>(() => {
    const total = filteredRecords.value.length || 1
    return categoryOrder.value.map((cat) => {
      const posCounts = new Map<string, number>()
      const negCounts = new Map<string, number>()
      filteredRecords.value.forEach((r) => {
        r.scores.forEach((s: ScoreCategory) => {
          if (s.category === cat) {
            r.tags.forEach((t) => {
              if (getTagSentiment(t) === 'positive')
                posCounts.set(t, (posCounts.get(t) ?? 0) + 1)
              else if (getTagSentiment(t) === 'negative')
                negCounts.set(t, (negCounts.get(t) ?? 0) + 1)
            })
          }
        })
      })
      const build = (map: Map<string, number>): AnalyticsCategoryTag[] => {
        return Array.from(map.entries())
          .map(([tag, count]) => ({ tag, label: getTagLabel(tag), count, percentage: (count / total) * 100 }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
      }
      return {
        category: cat,
        label: getCategoryDisplayLabel(cat),
        positive: build(posCounts),
        negative: build(negCounts),
      }
    })
  })

  // --- Weekly trend series (current + comparison) from the seed data ---
  const trendPoints = computed<AnalyticsTrendPoint[]>(() => {
    const weekMap = new Map<string, { avgSum: number, avgCount: number, starSum: number, starCount: number, cmpAvgSum: number, cmpAvgCount: number, cmpStarSum: number, cmpStarCount: number }>()
    const getWeek = (dateStr: string) => {
      const d = new Date(dateStr)
      // Monday as week start
      const day = (d.getUTCDay() + 6) % 7
      const monday = addDays(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), -day)
      return dayKey(monday)
    }

    // Comparison offset in days: -364 for previous year, or the current period span for previous period
    const cmpOffsetDays = comparisonMode.value === 'previous_year'
      ? -364
      : (() => {
          if (!dateFrom.value || !dateTo.value)
            return -30
          const from = new Date(dateFrom.value)
          const to = new Date(dateTo.value)
          return -Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000))
        })()

    // Only bucket "current" series for weeks inside the selected date window,
    // and "comparison" series for the offset week (so the comparison line aligns
    // with the current window even when the date filter changes).
    const push = (key: string, isCmp: boolean, rating: number | null) => {
      let w = weekMap.get(key)
      if (!w) {
        w = { avgSum: 0, avgCount: 0, starSum: 0, starCount: 0, cmpAvgSum: 0, cmpAvgCount: 0, cmpStarSum: 0, cmpStarCount: 0 }
        weekMap.set(key, w)
      }
      if (rating !== null) {
        if (isCmp) {
          w.cmpAvgSum += rating
          w.cmpAvgCount += 1
          w.cmpStarSum += rating >= 8 ? 1 : 0
          w.cmpStarCount += 1
        }
        else {
          w.avgSum += rating
          w.avgCount += 1
          w.starSum += rating >= 8 ? 1 : 0
          w.starCount += 1
        }
      }
    }

    reviewRecords.value.forEach((r) => {
      if (channelFilter.value !== 'all' && r.source !== channelFilter.value)
        return
      if (listingFilter.value.length > 0 && !listingFilter.value.includes('All Properties') && !listingFilter.value.includes(r.listing_name))
        return
      const week = getWeek(r.checkout_date)
      // Only include weeks within the selected date window for the current series
      if (dateFrom.value && week < dateFrom.value)
        return
      if (dateTo.value && week > dateTo.value)
        return
      const cmpWeek = dayKey(addDays(new Date(week), cmpOffsetDays))
      push(week, false, r.guest_rating_overall)
      push(cmpWeek, true, r.guest_rating_overall)
    })

    // Fill gaps so the comparison line stays aligned week-by-week across the window
    if (dateFrom.value && dateTo.value) {
      const startWeek = getWeek(dateFrom.value)
      const endWeek = getWeek(dateTo.value)
      const cursor = new Date(startWeek)
      while (cursor.toISOString().slice(0, 10) <= endWeek) {
        const key = dayKey(cursor)
        if (!weekMap.has(key))
          weekMap.set(key, { avgSum: 0, avgCount: 0, starSum: 0, starCount: 0, cmpAvgSum: 0, cmpAvgCount: 0, cmpStarSum: 0, cmpStarCount: 0 })
        cursor.setDate(cursor.getDate() + 7)
      }
    }

    const points: AnalyticsTrendPoint[] = Array.from(weekMap.entries())
      .map(([week, w]) => ({
        period: week,
        averageScore: w.avgCount > 0 ? Number((w.avgSum / w.avgCount).toFixed(2)) : null,
        averageScoreComparison: w.cmpAvgCount > 0 ? Number((w.cmpAvgSum / w.cmpAvgCount).toFixed(2)) : null,
        fiveStarRate: w.starCount > 0 ? Number(((w.starSum / w.starCount) * 100).toFixed(2)) : null,
        fiveStarRateComparison: w.cmpStarCount > 0 ? Number(((w.cmpStarSum / w.cmpStarCount) * 100).toFixed(2)) : null,
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
    return points
  })

  // --- Deltas: vs previous period (WoW) and vs comparison series (year/period) ---
  const wowDelta = computed(() => {
    if (overallScoreRaw.value === null)
      return 0
    const prev = previousPeriodRecords.value.filter(r => r.guest_rating_overall !== null)
    if (prev.length === 0)
      return 0
    const prevAvg = prev.reduce((s, r) => s + (r.guest_rating_overall ?? 0), 0) / prev.length
    return Number((overallScoreRaw.value - prevAvg).toFixed(2))
  })

  const cmpDelta = computed(() => {
    const points = trendPoints.value
    if (points.length === 0)
      return 0
    const last = points[points.length - 1]!
    if (last.averageScore === null || last.averageScoreComparison === null)
      return 0
    return Number((last.averageScore - last.averageScoreComparison).toFixed(2))
  })

  const starWowDelta = computed(() => {
    return Number((starRate.value - previousStarRate.value).toFixed(2))
  })

  const starCmpDelta = computed(() => {
    const points = trendPoints.value
    if (points.length === 0)
      return 0
    const last = points[points.length - 1]!
    if (last.fiveStarRate === null || last.fiveStarRateComparison === null)
      return 0
    return Number((last.fiveStarRate - last.fiveStarRateComparison).toFixed(2))
  })

  // --- Saved-views actions ---
  function getCurrentViewState(): ReviewAnalyticsViewState {
    return {
      channel: channelFilter.value,
      listings: listingFilter.value,
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      period: periodPreset.value,
      comparison: comparisonMode.value,
    }
  }

  function updateCurrentState() {
    currentState.value = getCurrentViewState()
  }

  const isDirty = computed(() => {
    if (!activeView.value || !currentState.value || activeView.value.isDefault)
      return false
    const av = activeView.value
    const cs = currentState.value
    return (
      av.channel !== cs.channel
      || JSON.stringify([...av.listings].sort()) !== JSON.stringify([...cs.listings].sort())
      || av.dateFrom !== cs.dateFrom
      || av.dateTo !== cs.dateTo
      || av.period !== cs.period
      || av.comparison !== cs.comparison
    )
  })

  const canUpdateActiveView = computed(() => activeView.value !== null && !activeView.value.isDefault && isDirty.value)

  function sortViews(views: ReviewAnalyticsSavedView[]): ReviewAnalyticsSavedView[] {
    return [...views].sort((a, b) => {
      if (a.isDefault)
        return -1
      if (b.isDefault)
        return 1
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }

  async function fetchViews() {
    isLoading.value = true
    try {
      const customViews = loadFromLocalStorage<ReviewAnalyticsSavedView[]>(VIEWS_KEY, [])
      savedViews.value = sortViews([DEFAULT_ANALYTICS_VIEW, ...customViews])
      if (!activeView.value) {
        activeView.value = DEFAULT_ANALYTICS_VIEW
        currentState.value = getCurrentViewState()
      }
    }
    catch {
      toast.error('Could not load saved views.')
    }
    finally {
      isLoading.value = false
    }
  }

  async function saveCurrentAs(name: string, state: ReviewAnalyticsViewState) {
    const exists = savedViews.value.find(v => !v.isDefault && v.name.toLowerCase() === name.toLowerCase())
    if (exists) {
      toast.error('A view with this name already exists.')
      throw new Error('Duplicate view name')
    }
    isLoading.value = true
    try {
      const now = new Date().toISOString()
      const newView: ReviewAnalyticsSavedView = {
        id: generateViewId(),
        name,
        ...state,
        createdBy: 'current-user',
        createdAt: now,
        updatedAt: now,
      }
      savedViews.value = sortViews([...savedViews.value, newView])
      saveToLocalStorage(VIEWS_KEY, savedViews.value.filter(v => !v.isDefault))
      activeView.value = newView
      currentState.value = state
      toast.success('View saved!')
    }
    catch (error) {
      if (error instanceof Error && error.message !== 'Duplicate view name') {
        toast.error('Failed to save view. Try again.')
        throw error
      }
    }
    finally {
      isLoading.value = false
    }
  }

  async function loadView(viewId: string): Promise<ReviewAnalyticsSavedView | null> {
    const view = savedViews.value.find(v => v.id === viewId)
    if (!view) {
      toast.error('Could not load view.')
      return null
    }
    if (isDirty.value && activeView.value && !activeView.value.isDefault) {
      pendingViewId.value = viewId
      return view
    }
    activeView.value = view
    currentState.value = {
      channel: view.channel,
      listings: view.listings,
      dateFrom: view.dateFrom,
      dateTo: view.dateTo,
      period: view.period,
      comparison: view.comparison,
    }
    pendingViewId.value = null
    return view
  }

  async function confirmLoadView(viewId: string) {
    const view = savedViews.value.find(v => v.id === viewId)
    if (!view)
      return
    activeView.value = view
    currentState.value = {
      channel: view.channel,
      listings: view.listings,
      dateFrom: view.dateFrom,
      dateTo: view.dateTo,
      period: view.period,
      comparison: view.comparison,
    }
    pendingViewId.value = null
  }

  async function updateActiveView(state: ReviewAnalyticsViewState) {
    if (!activeView.value || activeView.value.isDefault)
      return
    isLoading.value = true
    try {
      const now = new Date().toISOString()
      const updatedView: ReviewAnalyticsSavedView = { ...activeView.value, ...state, updatedAt: now }
      savedViews.value = sortViews(savedViews.value.map(v => v.id === updatedView.id ? updatedView : v))
      saveToLocalStorage(VIEWS_KEY, savedViews.value.filter(v => !v.isDefault))
      activeView.value = updatedView
      currentState.value = state
      toast.success('View updated!')
    }
    catch {
      toast.error('Update failed. Try again.')
      throw new Error('Update failed')
    }
    finally {
      isLoading.value = false
    }
  }

  async function deleteView(viewId: string) {
    const viewToDelete = savedViews.value.find(v => v.id === viewId)
    if (!viewToDelete || viewToDelete.isDefault) {
      toast.error('Cannot delete Default view.')
      return
    }
    isLoading.value = true
    try {
      savedViews.value = savedViews.value.filter(v => v.id !== viewId)
      saveToLocalStorage(VIEWS_KEY, savedViews.value.filter(v => !v.isDefault))
      if (activeView.value?.id === viewId) {
        activeView.value = DEFAULT_ANALYTICS_VIEW
        currentState.value = { channel: 'all', listings: [], dateFrom: null, dateTo: null, period: '30d', comparison: 'previous_year' }
      }
      toast.success('View deleted!')
    }
    catch {
      toast.error('Could not delete view.')
      throw new Error('Delete failed')
    }
    finally {
      isLoading.value = false
    }
  }

  async function renameView(viewId: string, newName: string) {
    const view = savedViews.value.find(v => v.id === viewId)
    if (!view || view.isDefault) {
      toast.error('Cannot rename Default view.')
      return
    }
    const exists = savedViews.value.find(v => !v.isDefault && v.id !== viewId && v.name.toLowerCase() === newName.toLowerCase())
    if (exists) {
      toast.error('A view with this name already exists.')
      throw new Error('Duplicate view name')
    }
    isLoading.value = true
    try {
      const updatedView: ReviewAnalyticsSavedView = { ...view, name: newName, updatedAt: new Date().toISOString() }
      savedViews.value = sortViews(savedViews.value.map(v => v.id === viewId ? updatedView : v))
      saveToLocalStorage(VIEWS_KEY, savedViews.value.filter(v => !v.isDefault))
      if (activeView.value?.id === viewId)
        activeView.value = updatedView
      toast.success('View renamed!')
    }
    catch (error) {
      if (error instanceof Error && error.message !== 'Duplicate view name') {
        toast.error('Rename failed. Try again.')
        throw error
      }
    }
    finally {
      isLoading.value = false
    }
  }

  async function resetToDefault() {
    activeView.value = DEFAULT_ANALYTICS_VIEW
    currentState.value = { channel: 'all', listings: [], dateFrom: null, dateTo: null, period: '30d', comparison: 'previous_year' }
    toast.info('Reset to default view')
  }

  function clearFilters() {
    channelFilter.value = 'all'
    listingFilter.value = []
    applyPeriodPreset('30d')
  }

  // Watch filter changes to keep dirty tracking fresh
  watch([channelFilter, listingFilter, dateFrom, dateTo, periodPreset], () => {
    updateCurrentState()
  }, { deep: true })

  return {
    // filters
    channelFilter,
    listingFilter,
    dateFrom,
    dateTo,
    periodPreset,
    applyPeriodPreset,
    comparisonMode,
    uniqueListings,
    filteredRecords,
    clearFilters,
    // KPIs
    overallScoreRaw,
    overallScoreDisplay,
    overallScoreMax,
    ratedCount,
    starRate,
    topNegativeTags,
    listingStatuses,
    // deltas
    wowDelta,
    cmpDelta,
    starWowDelta,
    starCmpDelta,
    // trends
    trendPoints,
    // categories
    categoryPerformance,
    categoryTags,
    // saved views
    savedViews,
    activeView,
    currentState,
    isDirty,
    canUpdateActiveView,
    pendingViewId,
    isLoading,
    fetchViews,
    saveCurrentAs,
    loadView,
    confirmLoadView,
    updateActiveView,
    deleteView,
    renameView,
    resetToDefault,
  }
}
