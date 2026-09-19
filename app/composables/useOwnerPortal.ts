// Owner portal — owner-scoped selectors with strict isolation.
//
// The Owner Portal surfaces the data that ONE logged-in owner is allowed
// to see: their own property mappings, their own commission rules, their
// own statements, their own stays, and their own open issues. The dashboard
// metrics are rolled up from that same owner-scoped subset.
//
// This composable is a thin presentation layer over the data composables
// (`useOwners`, `useOwnerStatements`, `useOwnerPermissions`) plus the
// stays fixture. It does NOT own any of that state — it only reads from
// it through owner-scoped filters.
//
// ⚠️  Isolation invariant: the public API NEVER exposes the raw source
//     arrays. There is no `allOwners`, `allMappings`, `allStatements`,
//     `allIssues`, or `allStays` getter. Every selector applies the
//     owner filter first; property / period / status filters only run
//     on the owner-filtered subset. This is what makes the data-safe
//     property hold: a co-owner of a property cannot read the other
//     co-owner's statement, commission rule, or stay — even when both
//     rows are stored in the same array.
//
// ⚠️  Filter ordering: where two filters are applied, the OWNER filter
//     is always the outer one. This is the only way a co-owner of
//     `lst-3` (50% / 50% split) cannot see the other co-owner's
//     statement for the same (listing, period) tuple. The cross-owner
//     test in `useOwnerPortal.spec.ts` enforces this invariant.

import type { CommissionRule } from '~/components/owners/data/commission-rules'
import type { OwnerLedgerEntry, OwnerLedgerUpcomingReservation } from '~/components/owners/data/owner-ledger'
import type { OwnerDashboardField, OwnerStatementField } from '~/components/owners/data/owner-permissions'
import type { OwnerStatement, OwnerStatementIssue } from '~/components/owners/data/owner-statements'
import type { OwnerStay } from '~/components/owners/data/owner-stays'
import type { Owner, OwnerPropertyMapping } from '~/components/owners/data/owners'
import { computed, ref } from 'vue'
import { mockOwnerLedgerEntries } from '~/components/owners/data/owner-ledger'
import { useOwnerAuth } from '~/composables/useOwnerAuth'
import { useOwnerPermissions } from '~/composables/useOwnerPermissions'
import { useOwners } from '~/composables/useOwners'
import { useOwnerStatements } from '~/composables/useOwnerStatements'
import { useOwnerStays } from '~/composables/useOwnerStays'

/**
 * Rolled-up dashboard metrics for the current period, scoped to the
 * logged-in owner. Period selection: the latest non-adjustment
 * `YYYY-MM` present in the owner's ledger — the most useful single
 * snapshot to render on the dashboard.
 *
 * Mixed-currency ledgers (own-2 holds one IDR and one USD ledger in the
 * same period) are NOT summed together. The busiest currency wins and the
 * rest are dropped from the roll-up; see `sumMetricsForPeriod`.
 */
export interface OwnerDashboardMetrics {
  /** Latest non-adjustment period used to roll up the numbers. */
  period: string
  /** Sum of `grossRevenue` across the owner's ledgers in the period. */
  grossRevenue: number
  /** grossRevenue − expenses − taxes − platformFees (per ledger, summed). */
  netRevenue: number
  /** occupiedNights / availableNights, summed across the owner's ledgers in the period. */
  occupancy: number
  /** nightlyRateSum / reservationCount, summed across the owner's ledgers in the period. */
  adr: number
  reservationCount: number
  /** Flattened `upcomingReservations` list from the owner's latest period. */
  upcomingReservations: OwnerLedgerUpcomingReservation[]
  /**
   * The ledger currency these figures are in, never the owner record's
   * `statementCurrency` — the label and the numbers must share one source.
   */
  currency: string
}

function latestNonAdjustmentPeriod(entries: OwnerLedgerEntry[]): string | null {
  let latest: string | null = null
  for (const entry of entries) {
    if (entry.isPriorPeriodAdjustment)
      continue
    if (latest === null || entry.period > latest)
      latest = entry.period
  }
  return latest
}

/**
 * Roll up one period for one currency.
 *
 * The currency is picked from the ledger (busiest by gross revenue) and every
 * row in another currency is dropped, rather than summed in. An owner can hold
 * properties earning in different currencies, and there is no FX rate in this
 * app by design, so blending them would produce a number that is not money in
 * any currency at all.
 *
 * `owner.statementCurrency` is deliberately not consulted: it is a stated
 * preference on the owner record and says nothing about what the ledger holds.
 */
/**
 * Which single currency to roll this period up in.
 *
 * Ordered by ledger ROW COUNT, never by revenue: ranking on revenue would
 * compare 148,000,000 IDR against 20,900 USD as raw numbers and pick IDR
 * purely because its unit is smaller. A row count is unitless.
 *
 * The owner's `statementCurrency` wins when they actually earn in it. That is
 * the only safe use of the field: it selects a slice that is already in that
 * currency, so it can never end up labelling figures that are in another one.
 */
function pickDisplayCurrency(entries: OwnerLedgerEntry[], owner: Owner): string {
  const rowsByCurrency = new Map<string, number>()
  for (const entry of entries)
    rowsByCurrency.set(entry.currency, (rowsByCurrency.get(entry.currency) ?? 0) + 1)
  const ranked = Array.from(rowsByCurrency.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code]) => code)
  if (ranked.includes(owner.statementCurrency))
    return owner.statementCurrency
  return ranked[0] ?? ''
}

function sumMetricsForPeriod(
  entries: OwnerLedgerEntry[],
  period: string,
  owner: Owner,
): OwnerDashboardMetrics {
  const allInPeriod = entries.filter(entry => entry.period === period && !entry.isPriorPeriodAdjustment)
  const currency = pickDisplayCurrency(allInPeriod, owner)
  const inPeriod = allInPeriod.filter(entry => entry.currency === currency)
  const grossRevenue = inPeriod.reduce((sum, entry) => sum + entry.grossRevenue, 0)
  const netRevenue = inPeriod.reduce(
    (sum, entry) => sum + entry.grossRevenue - entry.expenses - entry.taxes - entry.platformFees,
    0,
  )
  const occupiedNights = inPeriod.reduce((sum, entry) => sum + entry.occupiedNights, 0)
  const availableNights = inPeriod.reduce((sum, entry) => sum + entry.availableNights, 0)
  const nightlyRateSum = inPeriod.reduce((sum, entry) => sum + entry.nightlyRateSum, 0)
  const reservationCount = inPeriod.reduce((sum, entry) => sum + entry.reservationCount, 0)
  const upcomingReservations: OwnerLedgerUpcomingReservation[] = inPeriod.flatMap(
    entry => entry.upcomingReservations,
  )
  return {
    period,
    grossRevenue,
    netRevenue,
    occupancy: availableNights > 0 ? occupiedNights / availableNights : 0,
    adr: reservationCount > 0 ? nightlyRateSum / reservationCount : 0,
    reservationCount,
    upcomingReservations,
    currency,
  }
}

export function useOwnerPortal() {
  // Wire into the data composables' reactive state buckets. We never
  // import the seed arrays directly. Stays come from `useOwnerStays`
  // (the shared `elev8-owner-stays` useState bucket) so a
  // createStay / updateStay / cancelStay we never see still updates
  // `myStays` reactively.
  const auth = useOwnerAuth()
  const { owners, mappings, commissionRules } = useOwners()
  const { statements, issues } = useOwnerStatements()
  const { stays } = useOwnerStays()
  const { canViewDashboardField: canViewDashboardFieldPermission, canViewStatementField: canViewStatementFieldPermission } = useOwnerPermissions()

  // The session's ownerId is the single source of identity for every
  // selector below. Reading from a computed keeps the data flow one-way
  // (auth change → reactive recompute) and prevents a stray caller from
  // injecting a different ownerId.
  const currentOwnerId = computed<string | null>(() => auth.session.value?.ownerId ?? null)

  const currentOwner = computed<Owner | null>(() => {
    const id = currentOwnerId.value
    if (!id)
      return null
    return owners.value.find(owner => owner.id === id) ?? null
  })

  /**
   * Owner filter applied FIRST. Property / period / status filters
   * operate on this already-narrowed subset.
   */
  const ownerFilteredMappings = computed<OwnerPropertyMapping[]>(() => {
    const id = currentOwnerId.value
    if (!id)
      return []
    return mappings.value.filter(mapping => mapping.ownerId === id)
  })

  const ownerFilteredRules = computed<CommissionRule[]>(() => {
    const id = currentOwnerId.value
    if (!id)
      return []
    return commissionRules.value.filter(rule => rule.ownerId === id)
  })

  const ownerFilteredStatements = computed<OwnerStatement[]>(() => {
    const id = currentOwnerId.value
    if (!id)
      return []
    return statements.value.filter(statement => statement.ownerId === id)
  })

  const ownerFilteredStays = computed<OwnerStay[]>(() => {
    const id = currentOwnerId.value
    if (!id)
      return []
    return stays.value.filter(stay => stay.ownerId === id)
  })

  /**
   * Issue filter is two hops: each issue carries a `statementId`; we
   * only surface issues whose parent statement belongs to the logged-in
   * owner. This is the one filter in the composable that has to join
   * two arrays — but the join is owner-scoped on both sides.
   */
  const ownerFilteredIssues = computed<OwnerStatementIssue[]>(() => {
    const id = currentOwnerId.value
    if (!id)
      return []
    const ownerStatementIds = new Set(
      statements.value.filter(s => s.ownerId === id).map(s => s.id),
    )
    return issues.value.filter(issue => ownerStatementIds.has(issue.statementId))
  })

  /**
   * Property view — unique listingIds the owner is mapped to. Returns
   * one row per (listingId) so the UI can render a property list.
   */
  const assignedProperties = computed<OwnerPropertyMapping[]>(() => {
    const seen = new Set<string>()
    const result: OwnerPropertyMapping[] = []
    for (const mapping of ownerFilteredMappings.value) {
      if (seen.has(mapping.listingId))
        continue
      seen.add(mapping.listingId)
      result.push(mapping)
    }
    return result
  })

  const selectedPropertyId = ref<string | null>(null)

  const propertyMetrics = computed<OwnerDashboardMetrics | null>(() => {
    const owner = currentOwner.value
    if (!owner)
      return null
    const entries = mockOwnerLedgerEntries.filter(entry => entry.ownerId === owner.id && (!selectedPropertyId.value || entry.listingId === selectedPropertyId.value)).map((entry) => {
      const share = (ownerFilteredMappings.value.find(mapping => mapping.listingId === entry.listingId)?.ownershipPercentage ?? 100) / 100
      return { ...entry, grossRevenue: entry.grossRevenue * share, expenses: entry.expenses * share, taxes: entry.taxes * share, platformFees: entry.platformFees * share, nightlyRateSum: entry.nightlyRateSum * share }
    })
    const period = latestNonAdjustmentPeriod(entries)
    return period ? sumMetricsForPeriod(entries, period, owner) : null
  })

  const dashboardMetricDescriptors = computed(() => {
    const metrics = propertyMetrics.value
    if (!metrics)
      return []
    const descriptors = [
      { key: 'grossRevenue' as const, label: 'Gross Revenue', value: `${metrics.currency} ${metrics.grossRevenue.toLocaleString()}` },
      { key: 'netRevenue' as const, label: 'Net Revenue', value: `${metrics.currency} ${metrics.netRevenue.toLocaleString()}` },
      { key: 'occupancy' as const, label: 'Occupancy', value: `${Math.round(metrics.occupancy * 100)}%` },
      { key: 'adr' as const, label: 'ADR', value: `${metrics.currency} ${Math.round(metrics.adr).toLocaleString()}` },
      { key: 'bookingSources' as const, label: 'Booking Sources', value: 'Available' },
      { key: 'upcomingReservations' as const, label: 'Upcoming Reservations', value: `${metrics.upcomingReservations.length}` },
      { key: 'guestRatings' as const, label: 'Guest Ratings', value: 'Available' },
    ]
    return descriptors.filter(metric => canViewDashboardField(metric.key))
  })

  const ownerUseNights = computed(() => ownerFilteredStays.value.filter(stay => stay.status !== 'cancelled' && stay.countsAgainstOwnerUseCap).reduce((sum, stay) => sum + stay.nights, 0))

  /**
   * The
   * ledger module is a pure fixture; we read it directly. (A real
   * implementation would route through a `useOwnerLedger` composable
   * that owns its own useState — until then, the seed is the source of
   * truth and isolation is preserved because the owner filter is the
   * outer one.)
   */
  const dashboardMetrics = computed<OwnerDashboardMetrics | null>(() => {
    const owner = currentOwner.value
    if (!owner)
      return null

    const ownerEntries = mockOwnerLedgerEntries.filter(entry => entry.ownerId === owner.id)
    const period = latestNonAdjustmentPeriod(ownerEntries)
    if (!period)
      return null
    return sumMetricsForPeriod(ownerEntries, period, owner)
  })

  /**
   * Field visibility helpers — forward to the permission composable
   * using the current session's ownerId. When no session exists the
   * permission lookup returns `false`, so the helpers are safe to call
   * in unauthenticated contexts.
   */
  function canViewDashboardField(field: OwnerDashboardField): boolean {
    const id = currentOwnerId.value
    if (!id)
      return false
    return canViewDashboardFieldPermission(id, field)
  }

  function canViewStatementField(field: OwnerStatementField): boolean {
    const id = currentOwnerId.value
    if (!id)
      return false
    return canViewStatementFieldPermission(id, field)
  }

  return {
    currentOwner,
    assignedMappings: ownerFilteredMappings,
    assignedProperties,
    commissionRules: ownerFilteredRules,
    visibleStatements: ownerFilteredStatements,
    myStays: ownerFilteredStays,
    myIssues: ownerFilteredIssues,
    dashboardMetrics,
    propertyMetrics,
    selectedPropertyId,
    dashboardMetricDescriptors,
    ownerUseNights,
    canViewDashboardField,
    canViewStatementField,
  }
}
