import type { TernApiClient } from '~/lib/tern/client'
import type { TernMockControls } from '~/lib/tern/mock-client'
import type { TernBooking } from '~/lib/tern/types'
import { listings } from '~/components/listings/data/listings'
import { elev8CoverPartner } from '~/components/reservations/data/damage-protection-seed'
import { useInvoiceTemplates } from '~/composables/useInvoiceTemplates'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useTenantBillTo } from '~/composables/useTenantBillTo'
import { useTernActivation } from '~/composables/useTernActivation'
import { TernApiError } from '~/lib/tern/client'
import { ternBookingChanged, toTernBooking } from '~/lib/tern/mappers'
import { createTernMockClient } from '~/lib/tern/mock-client'

/**
 * The one place the app gets its Tern client.
 *
 * ⚠️ INTEGRATION POINT. The demo talks to an in-memory mock. For the real API,
 * replace `client` with a client that calls OUR server routes (for example
 * `/api/tern/claim`), and implement those routes with `createTernHttpClient({
 * baseUrl, apiKey: useRuntimeConfig().ternApiKey })`. The API key must never
 * reach the browser. Nothing else in the app needs to change: every caller goes
 * through the `TernApiClient` interface, and every shape is Tern's own
 * (`~/lib/tern/types`). `controls` is demo-only (it plays Tern's staff).
 */
const mock = createTernMockClient({ deductible: elev8CoverPartner.deductiblePerClaim })
const client: TernApiClient = mock.client

/** Tests start from an empty Tern. */
export function resetTernMock() {
  mock.controls.reset()
}

export type TernSyncResult = { ok: true, bookingId?: number } | { ok: false, reason: string }

export function useTernApi() {
  const { reservations } = useReservationsModule()
  const tern = useTernActivation()
  const { billTo } = useTenantBillTo()
  const { getDefaultTemplate } = useInvoiceTemplates()

  /**
   * Our reservation id → Tern's `bookingId`. Kept here rather than on the
   * protection, so `useDamageProtection` stays the only writer of that record.
   * In production this map belongs in the database next to the reservation.
   */
  const bookingIds = useState<Record<string, number>>('tern-booking-ids', () => ({}))

  /** The property manager: Tern's `manager*` fields and a claim's claimant. */
  function manager() {
    const to = billTo()
    const email = getDefaultTemplate().company.email || undefined
    return { name: to.companyName, email, addressLines: to.addressLines }
  }

  function bookingFor(reservationId: string): TernBooking | null {
    const reservation = reservations.value.find(r => r.id === reservationId)
    const protection = reservation?.damageProtection
    const organizationId = tern.activation.value.ternOrganizationId
    if (!reservation || !protection || protection.option !== 'waiver' || organizationId === undefined)
      return null
    const listing = listings.value.find(l => l.id === reservation.listingId)
    return toTernBooking({
      organizationId,
      reservation,
      protection,
      listing: { id: reservation.listingId, name: listing?.name ?? reservation.listingName, location: listing?.location },
      manager: manager(),
    })
  }

  function remember(reservationId: string, bookingId: number) {
    bookingIds.value = { ...bookingIds.value, [reservationId]: bookingId }
  }

  /**
   * Bring the stay's Tern booking in line with the stay: create it when the
   * cover starts (guest-paid or host-paid), PUT when something Tern cares about
   * changed (dates on an extension, the fee and packages, a cancellation), mark
   * it inactive when the cover is gone. Idempotent: call it after any change.
   *
   * ⚠️ Open with Tern: whether a booking can still be updated once
   * `startDatePassed` is true (an extension mid-stay).
   */
  async function syncBooking(reservationId: string): Promise<TernSyncResult> {
    const existingId = bookingIds.value[reservationId]
    const reservation = reservations.value.find(r => r.id === reservationId)
    const protection = reservation?.damageProtection
    const covered = protection?.option === 'waiver' && (protection.state === 'waiver_active' || protection.state === 'cancelled')
    try {
      if (!covered) {
        if (existingId === undefined)
          return { ok: true }
        const current = await client.getBooking(existingId)
        if (current.active)
          await client.updateBooking(existingId, { ...current, active: false, cancelledDate: new Date().toISOString().slice(0, 10) })
        return { ok: true, bookingId: existingId }
      }
      const desired = bookingFor(reservationId)
      if (!desired)
        return { ok: false, reason: 'waiver_not_activated' }
      if (existingId === undefined) {
        // A cancelled cover that was never sent has nothing for Tern to bill.
        if (!desired.active)
          return { ok: true }
        const created = await client.createBooking(desired)
        remember(reservationId, created.bookingId!)
        return { ok: true, bookingId: created.bookingId }
      }
      const current = await client.getBooking(existingId)
      if (ternBookingChanged(current, desired))
        await client.updateBooking(existingId, { ...current, ...desired })
      return { ok: true, bookingId: existingId }
    }
    catch (error) {
      // The mock forgets its data on reload; a booking it no longer knows is sent again.
      if (error instanceof TernApiError && error.status === 404 && existingId !== undefined) {
        const next = { ...bookingIds.value }
        delete next[reservationId]
        bookingIds.value = next
        return syncBooking(reservationId)
      }
      return { ok: false, reason: error instanceof Error ? error.message : 'tern_error' }
    }
  }

  /** The Tern booking a claim must hang off, synced first if the stay was never sent. */
  async function ensureBooking(reservationId: string): Promise<number | null> {
    const result = await syncBooking(reservationId)
    return result.ok ? (result.bookingId ?? bookingIds.value[reservationId] ?? null) : null
  }

  return {
    client,
    controls: mock.controls as TernMockControls,
    bookingIds,
    bookingFor,
    manager,
    syncBooking,
    ensureBooking,
  }
}
