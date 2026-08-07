import type { ReviewSource } from '~/components/review-hub/data/types'

// --- Analytics Filters ---
export type AnalyticsChannelFilter = 'all' | ReviewSource

export type AnalyticsPeriodPreset = '7d' | '30d' | '90d' | '12m' | 'custom'

/** How the trend charts compare the current period */
export type AnalyticsComparisonMode = 'previous_year' | 'previous_period'

export interface ReviewAnalyticsFilters {
  channel: AnalyticsChannelFilter
  /** Listing names; empty = all properties */
  listings: string[]
  /** ISO date strings (YYYY-MM-DD); null = no bound */
  dateFrom: string | null
  dateTo: string | null
  period: AnalyticsPeriodPreset
}

// --- Saved View State (mirrors ViewState pattern from listings) ---
export interface ReviewAnalyticsViewState {
  channel: AnalyticsChannelFilter
  listings: string[]
  dateFrom: string | null
  dateTo: string | null
  period: AnalyticsPeriodPreset
  comparison: AnalyticsComparisonMode
}

export interface ReviewAnalyticsSavedView extends ReviewAnalyticsViewState {
  id: string
  name: string
  createdBy: string
  createdAt: string
  updatedAt: string
  isDefault?: boolean
}

export const DEFAULT_ANALYTICS_VIEW: ReviewAnalyticsSavedView = {
  id: 'default',
  name: 'Default View',
  channel: 'all',
  listings: [],
  dateFrom: null,
  dateTo: null,
  period: '30d',
  comparison: 'previous_year',
  createdBy: 'system',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isDefault: true,
}

// --- Analytics computed shapes ---
export interface AnalyticsTrendPoint {
  period: string
  averageScore: number | null
  averageScoreComparison: number | null
  fiveStarRate: number | null
  fiveStarRateComparison: number | null
}

export interface AnalyticsCategoryScore {
  category: string
  label: string
  score: number // 0-10 scale
  wow: number
  yoy: number
}

export interface AnalyticsCategoryTag {
  tag: string
  label: string
  count: number
  percentage: number
}

export interface AnalyticsCategoryTagGroup {
  category: string
  label: string
  positive: AnalyticsCategoryTag[]
  negative: AnalyticsCategoryTag[]
}

export interface AnalyticsListingStatus {
  label: string
  count: number
  total: number
  viewListings?: boolean
}
