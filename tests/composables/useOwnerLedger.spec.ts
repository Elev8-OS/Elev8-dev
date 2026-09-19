// The single ledger read. Before it existed, three composables each read
// `mockOwnerLedgerEntries` directly, so an owner created through the UI had no
// ledger anywhere and their statements and dashboard were both permanently
// empty without saying why.

import { describe, expect, it } from 'vitest'
import { mockOwnerLedgerEntries } from '~/components/owners/data/owner-ledger'
import { buildOwnerPermissionTemplate } from '~/components/owners/data/owner-permissions'
import { useOwnerLedger } from '~/composables/useOwnerLedger'
import { useOwners } from '~/composables/useOwners'
import { useReservationsModule } from '~/composables/useReservationsModule'

describe('useOwnerLedger', () => {
  it('keeps every seeded row exactly as written', () => {
    // The portal's demo figures are built on the fixture; a derived row must
    // never shadow or recompute one.
    const { entries } = useOwnerLedger()
    for (const seeded of mockOwnerLedgerEntries) {
      const found = entries.value.find(e => e.id === seeded.id)
      expect(found).toEqual(seeded)
    }
  })

  it('never derives a row for a period the fixture already covers', () => {
    const { derivedEntries } = useOwnerLedger()
    const seededKeys = new Set(
      mockOwnerLedgerEntries.map(e => `${e.ownerId}::${e.listingId}::${e.period}`),
    )
    for (const derived of derivedEntries.value)
      expect(seededKeys.has(`${derived.ownerId}::${derived.listingId}::${derived.period}`)).toBe(false)
  })

  it('gives a newly created owner a ledger drawn from their property\'s bookings', () => {
    const { createOwner, mappings } = useOwners()
    const { reservations } = useReservationsModule()

    const ownedListingIds = new Set(mappings.value.map(m => m.listingId))
    const booking = reservations.value.find(
      r => !ownedListingIds.has(r.listingId)
        && r.blockReason === undefined
        && ['unverified', 'verified', 'checked_in', 'checked_out'].includes(r.status)
        && (r.priceDetails?.guestPaid ?? r.totalPrice) > 0,
    )!
    expect(booking).toBeDefined()

    const created = createOwner({
      owner: {
        name: 'Ledger Test Owner',
        email: 'ledger.test@example.com',
        phone: '+6281234500222',
        language: 'en',
        statementCurrency: 'IDR',
        annualOwnerUseNightCap: undefined,
      },
      mappings: [{
        listingId: booking.listingId,
        ownershipPercentage: 100,
        effectiveFrom: '2026-01-01',
      }],
      commissionRules: [{
        name: 'Standard',
        type: 'flat',
        rate: 20,
        listingId: booking.listingId,
        effectiveFrom: '2026-01-01',
      }] as never,
      permissions: buildOwnerPermissionTemplate('full_transparency', 'placeholder', new Date().toISOString()),
      inviteNow: false,
    })
    expect(created.success).toBe(true)

    const { entriesForOwner, hasLedgerFor } = useOwnerLedger()
    expect(hasLedgerFor(created.ownerId!)).toBe(true)

    const rows = entriesForOwner(created.ownerId!)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.listingId).toBe(booking.listingId)
      // Derived rows carry the listing total; the ownership share is applied
      // downstream by the dashboard.
      expect(row.grossRevenue).toBeGreaterThan(0)
    }
  })

  it('reports no ledger for an owner with no properties', () => {
    const { createOwner } = useOwners()
    const created = createOwner({
      owner: {
        name: 'Unmapped Owner',
        email: 'unmapped.owner@example.com',
        phone: '+6281234500333',
        language: 'en',
        statementCurrency: 'IDR',
        annualOwnerUseNightCap: undefined,
      },
      mappings: [],
      commissionRules: [],
      permissions: buildOwnerPermissionTemplate('financial_summary', 'placeholder', new Date().toISOString()),
      inviteNow: false,
    })
    expect(created.success).toBe(true)
    // An honest empty, not a silent one: the caller can now tell this apart
    // from "we never looked".
    expect(useOwnerLedger().hasLedgerFor(created.ownerId!)).toBe(false)
  })
})
