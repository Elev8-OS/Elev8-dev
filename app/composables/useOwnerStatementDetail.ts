// useOwnerStatementDetail — owner-scoped single-statement enrichment.
//
// Owns: per-statement reservation list, channel breakdown, prior-period
// comparison, and adjustments detail for the current owner.
// Reads: useOwnerPortal (visibleStatements, currentOwnerId, canViewStatementField),
//        useOwnerStatements (staff-recorded post-publication corrections),
//        listings, mockOwnerLedgerEntries, mockOwnerReservationsForPeriod.

import type { ComputedRef, Ref } from 'vue'
import type { Listing } from '~/components/listings/data/listings'
import type { OwnerLedgerSource } from '~/components/owners/data/owner-ledger'
import type { OwnerReservationForStatement } from '~/components/owners/data/owner-statement-reservations'
import type { OwnerStatement } from '~/components/owners/data/owner-statements'
import { computed } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { mockOwnerLedgerEntries } from '~/components/owners/data/owner-ledger'
import { mockOwnerReservationsForPeriod } from '~/components/owners/data/owner-statement-reservations'
import { useOwnerPortal } from '~/composables/useOwnerPortal'
import { useOwnerStatements } from '~/composables/useOwnerStatements'

export interface OwnerChannelBreakdownRow {
  source: OwnerLedgerSource
  revenue: number
  reservations: number
  share: number
}

export interface OwnerStatementPeriodComparison {
  grossRevenue: { absolute: number, percent: number | null }
  netRevenue: { absolute: number, percent: number | null }
  occupancy: { absolute: number, percent: number | null }
  adr: { absolute: number, percent: number | null }
}

export interface OwnerStatementAdjustment {
  id: string
  /** Set when the row came from a prior-period ledger entry. */
  sourceLedgerEntryId?: string
  label: string
  amount: number
  /** Period the correction refers to. */
  adjustsPeriod: string
  reason: string
  /**
   * Period of the statement that carries (or will carry) the money. Set for
   * staff-recorded corrections; undefined for ledger-derived rows, whose
   * money is already inside the statement being read.
   */
  appliesInPeriod?: string
  /** False while the correction is still waiting for its next statement. */
  applied?: boolean
}

export interface OwnerStatementDetail {
  statement: OwnerStatement | null
  listing: Listing | null
  reservations: OwnerReservationForStatement[]
  channelBreakdown: OwnerChannelBreakdownRow[]
  priorPeriod: OwnerStatement | null
  priorPeriodComparison: OwnerStatementPeriodComparison | null
  /** Corrections whose money is inside THIS statement's total. */
  adjustments: OwnerStatementAdjustment[]
  /**
   * Corrections filed against this statement after it was published. Their
   * money lands in a later statement, never in this one, so they are listed
   * separately and excluded from the adjustment total.
   */
  relatedAdjustments: OwnerStatementAdjustment[]
}

function previousPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number)
  const prev = new Date(Date.UTC(year, month - 2, 1))
  const y = prev.getUTCFullYear()
  const m = String(prev.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function statementTotal(stmt: OwnerStatement | null, key: 'grossRevenue' | 'netRevenue' | 'occupancy' | 'adr'): number {
  if (!stmt)
    return 0
  const lines = stmt.publishedSnapshot?.lines ?? stmt.lines
  if (key === 'grossRevenue') {
    return lines.filter(l => l.category === 'revenue').reduce((s, l) => s + l.amount, 0)
  }
  if (key === 'netRevenue') {
    return stmt.publishedSnapshot?.totalAmount ?? stmt.totalAmount
  }
  // occupancy and adr are not stored in statement lines; we read from the
  // matching ledger entry instead. Caller should have passed a statement
  // whose ownerId+listingId+period matches a ledger entry.
  return 0
}

export function useOwnerStatementDetail(statementId: Ref<string | null>): {
  detail: ComputedRef<OwnerStatementDetail>
  isNotFound: ComputedRef<boolean>
} {
  const { visibleStatements, canViewStatementField, currentOwner } = useOwnerPortal()
  // Staff-recorded post-publication corrections. Read from the shared bucket
  // rather than the seed array so a correction recorded in this session shows
  // up in the portal without a reload.
  const { adjustments: recordedAdjustments } = useOwnerStatements()

  const isNotFound = computed(() => {
    const id = statementId.value
    if (!id)
      return false
    // When no owner is logged in, visibleStatements is empty for every id.
    // We return false here so callers can distinguish "no session yet" from
    // "session exists but the requested statement is not theirs".
    if (!currentOwner.value)
      return false
    const stmt = visibleStatements.value.find(s => s.id === id && s.status === 'published')
    return !stmt
  })

  const detail = computed<OwnerStatementDetail>(() => {
    const id = statementId.value
    if (!id || !currentOwner.value) {
      return {
        statement: null,
        listing: null,
        reservations: [],
        channelBreakdown: [],
        priorPeriod: null,
        priorPeriodComparison: null,
        adjustments: [],
        relatedAdjustments: [],
      }
    }

    const statement = visibleStatements.value.find(s => s.id === id && s.status === 'published') ?? null
    if (!statement) {
      return {
        statement: null,
        listing: null,
        reservations: [],
        channelBreakdown: [],
        priorPeriod: null,
        priorPeriodComparison: null,
        adjustments: [],
        relatedAdjustments: [],
      }
    }

    const listing = listings.value.find(l => l.id === statement.listingId) ?? null

    const reservations = canViewStatementField('revenueLines')
      ? mockOwnerReservationsForPeriod.filter(r => r.statementId === statement.id)
      : []

    const channelBreakdown = (() => {
      if (!canViewStatementField('revenueLines') || reservations.length === 0)
        return []
      const bySource = new Map<OwnerLedgerSource, { revenue: number, reservations: number }>()
      for (const r of reservations) {
        const existing = bySource.get(r.source)
        if (existing) {
          existing.revenue += r.grossAmount
          existing.reservations += 1
        }
        else {
          bySource.set(r.source, { revenue: r.grossAmount, reservations: 1 })
        }
      }
      const totalRevenue = Array.from(bySource.values()).reduce((s, v) => s + v.revenue, 0)
      return Array.from(bySource.entries()).map(([source, v]) => ({
        source,
        revenue: v.revenue,
        reservations: v.reservations,
        share: totalRevenue > 0 ? v.revenue / totalRevenue : 0,
      }))
    })()

    const priorPeriod = (() => {
      const prev = previousPeriod(statement.period)
      return visibleStatements.value.find(
        s => s.listingId === statement.listingId && s.period === prev && s.status === 'published',
      ) ?? null
    })()

    const priorPeriodComparison = (() => {
      if (!priorPeriod)
        return null
      // Find ledger entries for the current and prior periods
      const curLedger = mockOwnerLedgerEntries.find(
        e => e.ownerId === statement.ownerId && e.listingId === statement.listingId && e.period === statement.period && !e.isPriorPeriodAdjustment,
      )
      const priorLedger = mockOwnerLedgerEntries.find(
        e => e.ownerId === statement.ownerId && e.listingId === statement.listingId && e.period === priorPeriod.period && !e.isPriorPeriodAdjustment,
      )
      const curGross = curLedger?.grossRevenue ?? statementTotal(statement, 'grossRevenue')
      const priorGross = priorLedger?.grossRevenue ?? statementTotal(priorPeriod, 'grossRevenue')
      const curNet = curLedger ? curLedger.grossRevenue - curLedger.expenses - curLedger.taxes - curLedger.platformFees : statementTotal(statement, 'netRevenue')
      const priorNet = priorLedger ? priorLedger.grossRevenue - priorLedger.expenses - priorLedger.taxes - priorLedger.platformFees : statementTotal(priorPeriod, 'netRevenue')
      const curOcc = curLedger && curLedger.availableNights > 0 ? curLedger.occupiedNights / curLedger.availableNights : 0
      const priorOcc = priorLedger && priorLedger.availableNights > 0 ? priorLedger.occupiedNights / priorLedger.availableNights : 0
      const curAdr = curLedger && curLedger.reservationCount > 0 ? curLedger.nightlyRateSum / curLedger.reservationCount : 0
      const priorAdr = priorLedger && priorLedger.reservationCount > 0 ? priorLedger.nightlyRateSum / priorLedger.reservationCount : 0

      function delta(cur: number, prior: number) {
        const absolute = cur - prior
        const percent = prior !== 0 ? absolute / prior : null
        return { absolute, percent }
      }

      return {
        grossRevenue: delta(curGross, priorGross),
        netRevenue: delta(curNet, priorNet),
        occupancy: delta(curOcc, priorOcc),
        adr: delta(curAdr, priorAdr),
      }
    })()

    // Two sources feed the owner's adjustment view, and they answer two
    // different questions:
    //   * ledger entries flagged `isPriorPeriodAdjustment` — the seeded
    //     reconciliation corrections, already reflected in this statement;
    //   * `useOwnerStatements().adjustments` — corrections staff recorded
    //     against a published statement, which are folded into a later
    //     statement by `generateForPeriod` (never into the frozen one).
    // A recorded correction therefore shows up twice across the archive: once
    // on the statement it corrects (as a related row, "will appear in July"),
    // and once on the statement that carried the money (as an applied row).
    const recorded = canViewStatementField('adjustments')
      ? recordedAdjustments.value.filter(a => a.ownerId === statement.ownerId
        && a.listingId === statement.listingId)
      : []

    const adjustments = (() => {
      if (!canViewStatementField('adjustments'))
        return []
      const fromLedger = mockOwnerLedgerEntries
        .filter(e => e.ownerId === statement.ownerId
          && e.listingId === statement.listingId
          && e.isPriorPeriodAdjustment
          && e.adjustsPeriod === statement.period)
        .map<OwnerStatementAdjustment>(e => ({
          id: e.id,
          sourceLedgerEntryId: e.id,
          label: e.adjustmentReason ?? 'Prior period adjustment',
          amount: -(e.platformFees + e.taxes + e.expenses), // signed net effect
          adjustsPeriod: e.adjustsPeriod ?? e.period,
          reason: e.adjustmentReason ?? '',
        }))
      // Corrections folded into this statement's lines by `generateForPeriod`.
      const applied = recorded
        .filter(a => a.appliedToStatementId === statement.id)
        .map<OwnerStatementAdjustment>(a => ({
          id: a.id,
          label: `Correction for ${a.period}`,
          amount: a.amount,
          adjustsPeriod: a.period,
          reason: a.reason,
          appliesInPeriod: a.appliedInPeriod ?? statement.period,
          applied: true,
        }))
      return [...fromLedger, ...applied]
    })()

    // Filed against this statement, paid out elsewhere. Kept out of
    // `adjustments` so the card's total stays the impact on THIS statement.
    const relatedAdjustments = recorded
      .filter(a => a.period === statement.period && a.appliedToStatementId !== statement.id)
      .map<OwnerStatementAdjustment>(a => ({
        id: a.id,
        label: `Correction for ${a.period}`,
        amount: a.amount,
        adjustsPeriod: a.period,
        reason: a.reason,
        appliesInPeriod: a.appliedInPeriod ?? a.nextPeriod,
        applied: Boolean(a.appliedToStatementId),
      }))

    return {
      statement,
      listing,
      reservations,
      channelBreakdown,
      priorPeriod,
      priorPeriodComparison,
      adjustments,
      relatedAdjustments,
    }
  })

  return { detail, isNotFound }
}
