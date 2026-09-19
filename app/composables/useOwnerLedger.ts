// useOwnerLedger — the one place the owner ledger is read from.
//
// The ledger used to be read straight off `mockOwnerLedgerEntries` in three
// places (`useOwnerStatements`, `useOwnerDashboard`, `useOwnerPortal`), which
// meant an owner created through the UI had no ledger anywhere: statement
// generation found nothing and drew nothing, without saying so.
//
// `entries` is the fixture plus every row the app's own reservations imply for
// a mapped listing that the fixture does not already cover. Seeded rows always
// win, so the demo figures the portal is built around do not move.

import type { OwnerLedgerEntry } from '~/components/owners/data/owner-ledger'
import type { LedgerSourceReservation } from '~/components/owners/data/owner-ledger-derive'
import { computed } from 'vue'
import { mockOwnerLedgerEntries } from '~/components/owners/data/owner-ledger'
import { deriveMissingLedgerEntries } from '~/components/owners/data/owner-ledger-derive'
import { useOwners } from '~/composables/useOwners'
import { useReservationsModule } from '~/composables/useReservationsModule'

/**
 * One timestamp for every derived row in a session.
 *
 * Derived rows are recomputed on demand rather than stored, so stamping
 * `new Date()` per evaluation would make `updatedAt` churn on every render and
 * defeat any downstream "changed since" comparison.
 */
const DERIVED_STAMP = new Date().toISOString()

export function useOwnerLedger(): {
  entries: import('vue').ComputedRef<OwnerLedgerEntry[]>
  derivedEntries: import('vue').ComputedRef<OwnerLedgerEntry[]>
  entriesForOwner: (ownerId: string) => OwnerLedgerEntry[]
  hasLedgerFor: (ownerId: string) => boolean
} {
  const { mappings } = useOwners()
  const { reservations } = useReservationsModule()

  const sourceReservations = computed<LedgerSourceReservation[]>(
    () => reservations.value as unknown as LedgerSourceReservation[],
  )

  const derivedEntries = computed<OwnerLedgerEntry[]>(() => deriveMissingLedgerEntries({
    mappings: mappings.value,
    reservations: sourceReservations.value,
    seeded: mockOwnerLedgerEntries,
    // Stable within a pass. A row derived from unchanged inputs must not look
    // freshly written every time a computed re-evaluates.
    now: DERIVED_STAMP,
  }))

  const entries = computed<OwnerLedgerEntry[]>(
    () => [...mockOwnerLedgerEntries, ...derivedEntries.value],
  )

  function entriesForOwner(ownerId: string): OwnerLedgerEntry[] {
    return entries.value.filter(e => e.ownerId === ownerId)
  }

  function hasLedgerFor(ownerId: string): boolean {
    return entries.value.some(e => e.ownerId === ownerId)
  }

  return { entries, derivedEntries, entriesForOwner, hasLedgerFor }
}
