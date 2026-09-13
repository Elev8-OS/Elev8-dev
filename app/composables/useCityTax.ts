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

  function settle(reservationId: string, build: (assessment: CityTaxAssessment) => CityTaxSettlement | null) {
    const reservation = reservationById(reservationId)
    if (!reservation)
      return
    const assessment = assess(reservation)
    if (assessment.status !== 'due')
      return
    const settlement = build(assessment)
    if (!settlement)
      return
    const kind = settlement.state === 'collected' ? 'collected' : 'waived'
    commit(reservation, settlement, cityTaxActivityEvent(kind, settlement, actor.value))
  }

  function markCollected(reservationId: string, options: { method: CityTaxPaymentMethod, note?: string }) {
    settle(reservationId, assessment => ({
      state: 'collected',
      totals: assessment.totals.map(total => ({ ...total })),
      settledAt: new Date().toISOString(),
      settledBy: actor.value,
      method: options.method,
      note: options.note?.trim() || undefined,
    }))

    const assessment = assessmentFor(reservationId)
    if (assessment.settlement?.state === 'collected')
      toast.success(`City tax collected: ${formatCityTaxTotals(assessment.settlement.totals)}`)
  }

  function waive(reservationId: string, reason: string) {
    const trimmed = reason.trim()
    if (!trimmed) {
      toast.error('A waive needs a reason')
      return
    }
    settle(reservationId, assessment => ({
      state: 'waived',
      totals: assessment.totals.map(total => ({ ...total })),
      settledAt: new Date().toISOString(),
      settledBy: actor.value,
      reason: trimmed,
    }))
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
