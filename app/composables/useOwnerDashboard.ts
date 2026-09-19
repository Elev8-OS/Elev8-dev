// useOwnerDashboard — owner-scoped 12-month performance dataset.
//
// Owns: time series aggregation for the current owner + selected property.
// Reads: useOwnerPortal (currentOwnerId, selectedPropertyId, assignedProperties,
//        canViewDashboardField), useOwnerPermissions, mockOwnerLedgerEntries.
//
// Isolation invariant: currentOwnerId is the outer filter. The cross-owner
// test in useOwnerPortal.spec.ts is the model; tests in this file enforce
// the same property for the dashboard view.

import type { ComputedRef, Ref } from 'vue'
import type { OwnerLedgerEntry, OwnerLedgerSource, OwnerLedgerSourceBreakdown } from '~/components/owners/data/owner-ledger'
import { computed, ref as vueRef } from 'vue'
/** Internal: re-export the raw fixture so the composable can read it. */
import { mockOwnerLedgerEntries } from '~/components/owners/data/owner-ledger'
import { useOwnerAuth } from '~/composables/useOwnerAuth'

import { useOwnerPortal } from '~/composables/useOwnerPortal'
import { useOwners } from '~/composables/useOwners'

/** One month of revenue split by channel. `period` stays a `YYYY-MM` label. */
export interface OwnerSourcesRow {
  period: string
  [channel: string]: string | number
}

export interface OwnerDashboardMonth {
  period: string
  /** The ledger currency these figures are in. Never blended across currencies. */
  currency: string
  grossRevenue: number
  netRevenue: number
  occupancy: number
  adr: number
  reservationCount: number
  sources: OwnerLedgerSourceBreakdown[]
  averageRating: number | null
  ratingsCount: number
  topSource: OwnerLedgerSource | null
}

export interface OwnerDashboardTimeSeries {
  months: OwnerDashboardMonth[]
  priorYearMonths: OwnerDashboardMonth[]
  currency: string
}

export interface OwnerYoYChange {
  absolute: number
  percent: number | null
}

function previousPeriod(period: string): string {
  // period = YYYY-MM
  const [year, month] = period.split('-').map(Number)
  const prev = new Date(Date.UTC(year, month - 2, 1))
  const y = prev.getUTCFullYear()
  const m = String(prev.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function aggregateMonth(entries: OwnerLedgerEntry[]): OwnerDashboardMonth | null {
  const head = entries[0]
  if (!head)
    return null
  // Callers must hand this a single-currency slice. Money fields below are
  // summed as raw numbers, so a mixed slice would silently add IDR to USD.
  // There is no FX rate anywhere in this app by design (see the "no currency
  // conversion, ever" rule the folio, city tax and statement modules share),
  // so the only safe response is to refuse rather than blend.
  const currency = head.currency
  if (entries.some(e => e.currency !== currency))
    return null
  const period = head.period
  const grossRevenue = entries.reduce((s, e) => s + e.grossRevenue, 0)
  const expenses = entries.reduce((s, e) => s + e.expenses, 0)
  const taxes = entries.reduce((s, e) => s + e.taxes, 0)
  const platformFees = entries.reduce((s, e) => s + e.platformFees, 0)
  const occupiedNights = entries.reduce((s, e) => s + e.occupiedNights, 0)
  const availableNights = entries.reduce((s, e) => s + e.availableNights, 0)
  const nightlyRateSum = entries.reduce((s, e) => s + e.nightlyRateSum, 0)
  const reservationCount = entries.reduce((s, e) => s + e.reservationCount, 0)
  const ratingsCount = entries.reduce((s, e) => s + e.ratingsCount, 0)
  const ratingSum = entries.reduce((s, e) => s + e.averageRating * e.ratingsCount, 0)
  const averageRating = ratingsCount > 0 ? ratingSum / ratingsCount : null

  // Merge sources across listings
  const sourceMap = new Map<OwnerLedgerSource, OwnerLedgerSourceBreakdown>()
  for (const entry of entries) {
    for (const src of entry.sources) {
      const existing = sourceMap.get(src.source)
      if (existing) {
        existing.revenue += src.revenue
        existing.reservations += src.reservations
        existing.nights += src.nights
      }
      else {
        sourceMap.set(src.source, { ...src })
      }
    }
  }
  const sources = Array.from(sourceMap.values())
  const topSource = sources.length > 0
    ? sources.reduce((top, s) => (s.revenue > (top?.revenue ?? 0) ? s : top), sources[0]).source
    : null

  return {
    period,
    currency,
    grossRevenue,
    netRevenue: grossRevenue - expenses - taxes - platformFees,
    occupancy: availableNights > 0 ? occupiedNights / availableNights : 0,
    adr: reservationCount > 0 ? nightlyRateSum / reservationCount : 0,
    reservationCount,
    sources,
    averageRating,
    ratingsCount,
    topSource,
  }
}

export function useOwnerDashboard(): {
  timeSeries: ComputedRef<OwnerDashboardTimeSeries>
  currentPeriod: ComputedRef<OwnerDashboardMonth | null>
  monthlyRevenueSeries: ComputedRef<{ period: string, grossRevenue: number, netRevenue: number }[]>
  monthlyOccupancyAdrSeries: ComputedRef<{ period: string, occupancy: number, adr: number }[]>
  monthlySourcesSeries: ComputedRef<OwnerSourcesRow[]>
  monthlyRatingsSeries: ComputedRef<{ period: string, averageRating: number | null, ratingsCount: number }[]>
  yoyChange: (field: 'grossRevenue' | 'netRevenue' | 'occupancy' | 'adr') => ComputedRef<OwnerYoYChange | null>
  hasYearOverYearData: ComputedRef<boolean>
  hasVisibleMetrics: ComputedRef<boolean>
  selectedPropertyId: Ref<string | null>
  /** Currencies this owner earns in, busiest first. Empty when there is no ledger. */
  availableCurrencies: ComputedRef<string[]>
  /** Explicit viewer choice; `null` follows the busiest currency. */
  selectedCurrency: Ref<string | null>
  /** The currency every figure on the dashboard is currently expressed in. */
  activeCurrency: ComputedRef<string>
} {
  const { session } = useOwnerAuth()
  const { mappings } = useOwners()
  const { currentOwner, selectedPropertyId, canViewDashboardField } = useOwnerPortal()

  const ownerId = computed(() => session.value?.ownerId ?? null)

  /** Apply ownership share: multiply each magnitude by mapping.ownershipPercentage / 100. */
  const shareByListing = computed<Map<string, number>>(() => {
    const id = ownerId.value
    if (!id)
      return new Map()
    const map = new Map<string, number>()
    for (const m of mappings.value.filter(mp => mp.ownerId === id)) {
      map.set(m.listingId, m.ownershipPercentage / 100)
    }
    return map
  })

  /**
   * Owner- and property-scoped ledger, before the currency filter.
   *
   * An owner can legitimately hold properties that earn in different
   * currencies (own-2 owns an IDR villa and a USD one), so this list is the
   * honest superset and `activeCurrency` picks one slice of it to display.
   */
  const ownerScopedEntries = computed<OwnerLedgerEntry[]>(() => {
    const id = ownerId.value
    if (!id)
      return []
    const shares = shareByListing.value
    return (useOwnerEntries().value ?? [])
      .filter(e => e.ownerId === id && !e.isPriorPeriodAdjustment)
      .filter(e => selectedPropertyId.value === null || e.listingId === selectedPropertyId.value)
      .map((e) => {
        const share = shares.get(e.listingId) ?? 1
        if (share === 1)
          return e
        return {
          ...e,
          grossRevenue: e.grossRevenue * share,
          expenses: e.expenses * share,
          taxes: e.taxes * share,
          platformFees: e.platformFees * share,
          nightlyRateSum: e.nightlyRateSum * share,
        }
      })
  })

  /**
   * Currencies this owner actually earns in, busiest first.
   *
   * Derived from the ledger rather than from `owner.statementCurrency`: the
   * owner record's preference has no bearing on what the money actually is,
   * and labelling CHF figures "IDR" because someone picked IDR on the create
   * form is the bug this ordering exists to prevent.
   */
  const availableCurrencies = computed<string[]>(() => {
    const rowsByCurrency = new Map<string, number>()
    for (const entry of ownerScopedEntries.value)
      rowsByCurrency.set(entry.currency, (rowsByCurrency.get(entry.currency) ?? 0) + 1)
    // Ordered by how many ledger rows each currency has, NOT by revenue.
    // Ranking on revenue would compare 148,000,000 IDR against 20,900 USD as
    // raw numbers and put IDR first purely because its unit is smaller, which
    // is the same category error this whole change exists to remove. A row
    // count is unitless, so it can be compared honestly.
    return Array.from(rowsByCurrency.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([currency]) => currency)
  })

  /** Explicit viewer choice. `null` = follow the busiest currency. */
  const selectedCurrency = vueRef<string | null>(null)

  /**
   * The currency every figure on the dashboard is in. Falls back to the
   * busiest one whenever the explicit choice is unset or no longer earns
   * anything (e.g. after switching the property filter).
   */
  const activeCurrency = computed<string>(() => {
    const available = availableCurrencies.value
    const chosen = selectedCurrency.value
    if (chosen !== null && available.includes(chosen))
      return chosen
    // This is the one job `owner.statementCurrency` can safely do: choose
    // which of the owner's currencies to open on. It only ever SELECTS a
    // slice that is already in that currency, so unlike the old behaviour it
    // cannot put its label on figures that are in something else.
    const preferred = currentOwner.value?.statementCurrency
    if (preferred && available.includes(preferred))
      return preferred
    return available[0] ?? ''
  })

  const ownerEntries = computed<OwnerLedgerEntry[]>(
    () => ownerScopedEntries.value.filter(e => e.currency === activeCurrency.value),
  )

  const allEntries = useOwnerEntries()

  const months = computed<OwnerDashboardMonth[]>(() => {
    // Note: we do NOT gate `months` itself on `canViewDashboardField('grossRevenue')`.
    // The permission check belongs at the display layer (the `monthlyRevenueSeries`
    // and chart components), not on the underlying time series — otherwise a strict
    // owner like I Putu (financial_summary) cannot run ownership-share tests, period
    // filters, or YoY computation at all. Downstream series gate themselves.
    const byPeriod = new Map<string, OwnerLedgerEntry[]>()
    for (const entry of ownerEntries.value) {
      const arr = byPeriod.get(entry.period) ?? []
      arr.push(entry)
      byPeriod.set(entry.period, arr)
    }
    return Array.from(byPeriod.keys())
      .sort()
      .map(period => aggregateMonth(byPeriod.get(period)!))
      .filter((m): m is OwnerDashboardMonth => m !== null)
  })

  const priorYearEntries = computed<OwnerLedgerEntry[]>(() => {
    const id = ownerId.value
    if (!id)
      return []
    const shares = shareByListing.value
    const currentMonths = new Set(ownerEntries.value.map(e => e.period))
    const priorPeriods = new Set(Array.from(currentMonths).map(previousPeriod))
    return (allEntries.value)
      .filter(e => e.ownerId === id && !e.isPriorPeriodAdjustment)
      .filter(e => priorPeriods.has(e.period))
      .filter(e => selectedPropertyId.value === null || e.listingId === selectedPropertyId.value)
      // Same currency as the months being compared against, or the YoY badge
      // reports a change between two different currencies as a percentage.
      .filter(e => e.currency === activeCurrency.value)
      .map((e) => {
        const share = shares.get(e.listingId) ?? 1
        if (share === 1)
          return e
        return {
          ...e,
          grossRevenue: e.grossRevenue * share,
          expenses: e.expenses * share,
          taxes: e.taxes * share,
          platformFees: e.platformFees * share,
          nightlyRateSum: e.nightlyRateSum * share,
        }
      })
  })

  const priorYearMonths = computed<OwnerDashboardMonth[]>(() => {
    // Same rationale as `months` — see comment above.
    const byPeriod = new Map<string, OwnerLedgerEntry[]>()
    for (const entry of priorYearEntries.value) {
      const arr = byPeriod.get(entry.period) ?? []
      arr.push(entry)
      byPeriod.set(entry.period, arr)
    }
    return Array.from(byPeriod.keys())
      .sort()
      .map(period => aggregateMonth(byPeriod.get(period)!))
      .filter((m): m is OwnerDashboardMonth => m !== null)
  })

  const timeSeries = computed<OwnerDashboardTimeSeries>(() => ({
    months: months.value,
    priorYearMonths: priorYearMonths.value,
    // The ledger's own currency, so the label and the figures beside it can
    // never disagree. `owner.statementCurrency` is a stated preference and is
    // deliberately not consulted here.
    currency: activeCurrency.value,
  }))

  const currentPeriod = computed<OwnerDashboardMonth | null>(() => {
    const m = months.value
    return m.length > 0 ? m[m.length - 1] : null
  })

  const monthlyRevenueSeries = computed(() => {
    if (!canViewDashboardField('grossRevenue'))
      return []
    return months.value.map(m => ({
      period: m.period,
      grossRevenue: m.grossRevenue,
      netRevenue: m.netRevenue,
    }))
  })

  const monthlyOccupancyAdrSeries = computed(() => {
    if (!canViewDashboardField('occupancy') || !canViewDashboardField('adr'))
      return []
    return months.value.map(m => ({
      period: m.period,
      occupancy: m.occupancy,
      adr: m.adr,
    }))
  })

  const monthlySourcesSeries = computed(() => {
    if (!canViewDashboardField('bookingSources'))
      return []
    return months.value.map((m) => {
      const row: OwnerSourcesRow = { period: m.period }
      for (const src of m.sources) row[src.source] = src.revenue
      return row
    })
  })

  const monthlyRatingsSeries = computed(() => {
    if (!canViewDashboardField('guestRatings'))
      return []
    return months.value.map(m => ({
      period: m.period,
      averageRating: m.averageRating,
      ratingsCount: m.ratingsCount,
    }))
  })

  function yoyChange(field: 'grossRevenue' | 'netRevenue' | 'occupancy' | 'adr'): ComputedRef<OwnerYoYChange | null> {
    return computed(() => {
      const cur = currentPeriod.value
      if (!cur)
        return null
      const priorPeriodStr = previousPeriod(cur.period)
      const prior = priorYearMonths.value.find(m => m.period === priorPeriodStr)
      if (!prior)
        return null
      const curVal = cur[field]
      const priorVal = prior[field]
      const absolute = curVal - priorVal
      const percent = priorVal !== 0 ? absolute / priorVal : null
      return { absolute, percent }
    })
  }

  const hasYearOverYearData = computed(() => priorYearMonths.value.length > 0)

  const hasVisibleMetrics = computed(() => {
    return monthlyRevenueSeries.value.length > 0
      || monthlyOccupancyAdrSeries.value.length > 0
      || monthlySourcesSeries.value.length > 0
      || monthlyRatingsSeries.value.length > 0
  })

  return {
    timeSeries,
    currentPeriod,
    monthlyRevenueSeries,
    monthlyOccupancyAdrSeries,
    monthlySourcesSeries,
    monthlyRatingsSeries,
    yoyChange,
    hasYearOverYearData,
    hasVisibleMetrics,
    selectedPropertyId,
    availableCurrencies,
    selectedCurrency,
    activeCurrency,
  }
}

function useOwnerEntries(): Ref<OwnerLedgerEntry[]> {
  return vueRef(mockOwnerLedgerEntries) as Ref<OwnerLedgerEntry[]>
}
