import type { ActivityEvent } from '~/components/inbox/data/conversations'
import type { AlertType } from '~/components/notifications/data/alerts'
import type { CityTaxAlertStage, CityTaxAssessment } from '~/components/reservations/data/city-tax'
import type { CityTaxPaymentMethod, CityTaxSettlement, CityTaxTotal, ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import {
  cityTaxActivityEvent,
  cityTaxAlertStage,
  cityTaxTotals,
  formatCityTaxTotal,
  formatCityTaxTotals,
  resolveCityTax,
} from '~/components/reservations/data/city-tax'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useFeesTaxes } from '~/composables/useFeesTaxes'
import { useNotifications } from '~/composables/useNotifications'
import { useReservationsModule } from '~/composables/useReservationsModule'

const EMPTY_ASSESSMENT: CityTaxAssessment = {
  status: 'not_required',
  collector: 'not_applicable',
  totals: [],
  lines: [],
  settlement: null,
}

export interface CityTaxWorklistRow {
  reservation: ReservationEntry
  assessment: CityTaxAssessment
  stage: CityTaxAlertStage | null
}

const CITY_TAX_ALERT_TYPE: Record<CityTaxAlertStage, AlertType> = {
  upcoming: 'CITY_TAX_COLLECTION_UPCOMING',
  due_today: 'CITY_TAX_COLLECTION_DUE',
  overdue: 'CITY_TAX_COLLECTION_MISSED',
}

const CITY_TAX_ALERT_TYPES: AlertType[] = Object.values(CITY_TAX_ALERT_TYPE)

/** Local calendar day, matching how checkIn / checkOut are written. */
function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
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

  const { alerts, createCityTaxAlert } = useNotifications()
  const notifyOnBooking = useState<boolean>('city-tax-notify-on-booking', () => false)

  const rows = computed<CityTaxWorklistRow[]>(() => {
    const today = todayIso()
    return reservations.value.map((reservation) => {
      const assessment = assess(reservation)
      return { reservation, assessment, stage: cityTaxAlertStage(assessment, reservation, today) }
    })
  })

  const overdue = computed(() => rows.value.filter(row => row.stage === 'overdue'))
  const dueToday = computed(() => rows.value.filter(row => row.stage === 'due_today'))
  const upcoming = computed(() => rows.value.filter(row => row.stage === 'upcoming'))
  const settled = computed(() => rows.value.filter(row => row.assessment.settlement !== null))

  /** Per currency, never blended: this app invents no exchange rates. */
  function sumRows(source: CityTaxWorklistRow[]): CityTaxTotal[] {
    return cityTaxTotals(source.flatMap(row => row.assessment.lines))
  }

  const outstandingTotal = computed(() => sumRows([...overdue.value, ...dueToday.value]))
  // Reads the FROZEN settlement totals, never the live rules: this is what was
  // actually taken, which is the whole point of freezing them.
  const collectedTotal = computed(() => cityTaxTotals(
    settled.value
      .filter(row => row.assessment.settlement?.state === 'collected')
      .flatMap(row => row.assessment.settlement!.totals),
  ))

  function hasActiveAlert(type: AlertType, reservationId: string): boolean {
    return alerts.value.some(alert =>
      alert.type === type
      && alert.status === 'ACTIVE'
      && alert.context?.reservation_id === reservationId)
  }

  /**
   * Raises what is missing and nothing else. There is no scheduler in this app,
   * so the worklist page calls this on mount and from its "Check for alerts"
   * button, the same way Smart Lock and Minut surface their mock events.
   */
  function emitCityTaxAlerts() {
    for (const row of rows.value) {
      if (!row.stage)
        continue
      if (row.stage === 'upcoming' && !notifyOnBooking.value)
        continue

      const type = CITY_TAX_ALERT_TYPE[row.stage]
      if (hasActiveAlert(type, row.reservation.id))
        continue

      createCityTaxAlert(type as 'CITY_TAX_COLLECTION_UPCOMING' | 'CITY_TAX_COLLECTION_DUE' | 'CITY_TAX_COLLECTION_MISSED', {
        reservation_id: row.reservation.id,
        guest_name: row.reservation.guestName,
        listing_name: row.reservation.listingName,
        listing_id: row.reservation.listingId,
        amount_label: row.assessment.totals.map(formatCityTaxTotal).join(' + '),
      })
    }
  }

  /**
   * Resolves the alert directly rather than through `dismiss()`, which only
   * acts on alerts visible to the current user. Whether this user can see the
   * alert must not decide whether a settled obligation keeps nagging everyone
   * else.
   */
  function dismissAlertsFor(reservationId: string) {
    const now = new Date().toISOString()
    alerts.value = alerts.value.map(alert =>
      CITY_TAX_ALERT_TYPES.includes(alert.type)
      && alert.status === 'ACTIVE'
      && alert.context?.reservation_id === reservationId
        ? { ...alert, status: 'RESOLVED' as const, resolved_at: now }
        : alert)
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

    // An alert is a prompt, not a log. Once the money is in, it leaves the bell.
    if (settlement)
      dismissAlertsFor(reservation.id)
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
    rows,
    overdue,
    dueToday,
    upcoming,
    settled,
    outstandingTotal,
    collectedTotal,
    notifyOnBooking,
    emitCityTaxAlerts,
  }
}
