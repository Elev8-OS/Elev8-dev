import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type { CityTaxAssessment } from '~/components/reservations/data/city-tax'
import type { CityTaxPaymentMethod, CityTaxSettlement, ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import {
  cityTaxActivityEvent,
  formatCityTaxTotals,
  resolveCityTax,
} from '~/components/reservations/data/city-tax'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useFeesTaxes } from '~/composables/useFeesTaxes'
import { useReservationsModule } from '~/composables/useReservationsModule'

const EMPTY_ASSESSMENT: CityTaxAssessment = {
  status: 'not_required',
  collector: 'not_applicable',
  totals: [],
  lines: [],
  settlement: null,
}

/**
 * City tax on a stay. The ONLY writer of `ReservationEntry.cityTaxSettlement`.
 *
 * It never writes `priceDetails`, `guestPaid`, `payout`, `commission` or the
 * folio. A tourist levy is money held for a municipality, not owner revenue,
 * and `useReservationFolio.commit()` moves extras, guestPaid and payout in
 * lockstep, so routing a city tax through the folio would inflate every owner
 * payout by the tax.
 */
export function useCityTax() {
  const { reservations, updateReservation } = useReservationsModule()
  const { getFeesTaxesForListing } = useFeesTaxes()
  const { currentUser } = useCurrentDashboardUser()

  const actor = computed(() => currentUser.value?.name ?? 'Staff')

  function reservationById(id: string): ReservationEntry | null {
    return reservations.value.find(r => r.id === id) ?? null
  }

  function assess(reservation: ReservationEntry): CityTaxAssessment {
    return resolveCityTax(reservation, getFeesTaxesForListing(reservation.listingId))
  }

  function assessmentFor(reservationId: string): CityTaxAssessment {
    const reservation = reservationById(reservationId)
    return reservation ? assess(reservation) : EMPTY_ASSESSMENT
  }

  /**
   * One patch, so the settlement and its audit line can never land apart. The
   * same rule `useReservationFolio.commit()` follows.
   */
  function commit(reservation: ReservationEntry, settlement: CityTaxSettlement | undefined, event: ActivityEvent) {
    updateReservation(reservation.id, {
      cityTaxSettlement: settlement,
      // Oldest first, matching every seeded activity array and the timeline
      // that renders it.
      activity: [...reservation.activity, event],
    })
  }

  /**
   * Returns the settlement it wrote, or `null` when it declined to write one
   * (unknown reservation, not currently `'due'`, or already settled). Callers
   * gate their toasts on this so staff are only told a settlement happened
   * when one actually did.
   */
  function settle(reservationId: string, build: (assessment: CityTaxAssessment) => CityTaxSettlement | null): CityTaxSettlement | null {
    const reservation = reservationById(reservationId)
    if (!reservation)
      return null
    const assessment = assess(reservation)
    if (assessment.status !== 'due')
      return null
    const settlement = build(assessment)
    // Both current callers always build a full settlement, so this never
    // fires today — but `build`'s type promises `| null`, and this is what
    // keeps that promise meaningful for whatever calls settle() next.
    if (!settlement)
      return null
    const kind = settlement.state === 'collected' ? 'collected' : 'waived'
    commit(reservation, settlement, cityTaxActivityEvent(kind, settlement, actor.value))
    return settlement
  }

  function markCollected(reservationId: string, options: { method: CityTaxPaymentMethod, note?: string }) {
    const settlement = settle(reservationId, assessment => ({
      state: 'collected',
      totals: assessment.totals.map(total => ({ ...total })),
      settledAt: new Date().toISOString(),
      settledBy: actor.value,
      method: options.method,
      note: options.note?.trim() || undefined,
    }))

    if (settlement)
      toast.success(`City tax collected: ${formatCityTaxTotals(settlement.totals)}`)
  }

  function waive(reservationId: string, reason: string) {
    const trimmed = reason.trim()
    if (!trimmed) {
      toast.error('A waive needs a reason')
      return
    }
    const settlement = settle(reservationId, assessment => ({
      state: 'waived',
      totals: assessment.totals.map(total => ({ ...total })),
      settledAt: new Date().toISOString(),
      settledBy: actor.value,
      reason: trimmed,
    }))
    if (settlement)
      toast.success('City tax waived')
  }

  function undoSettlement(reservationId: string) {
    const reservation = reservationById(reservationId)
    if (!reservation?.cityTaxSettlement)
      return
    commit(reservation, undefined, cityTaxActivityEvent('reopened', null, actor.value))
    toast.info('City tax marked outstanding again')
  }

  return {
    assessmentFor,
    markCollected,
    waive,
    undoSettlement,
  }
}
