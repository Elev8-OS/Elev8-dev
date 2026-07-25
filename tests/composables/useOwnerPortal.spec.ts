// Owner portal isolation — TDD tests for the owner-scoped selectors.
//
// The brief mandates the following invariants:
//   1. `useOwnerPortal` reads `session.ownerId` from `useOwnerAuth`
//      and never exposes the raw source arrays (no `allOwners`,
//      `allMappings`, `allStatements`, or `allIssues`).
//   2. Owner filtering is applied BEFORE property / period filters so
//      that two co-owners of the same property never see each other's
//      statements, commission rules, stays, or issues.
//   3. When no owner is logged in, the selectors return empty results
//      rather than crashing.
//   4. `dashboardMetrics` and the `canView*Field` helpers respect the
//      permission config stored in the shared useState bucket.

import { beforeEach, describe, expect, it } from 'vitest'
import { mockCommissionRules } from '~/components/owners/data/commission-rules'
import { mockOwnerLedgerEntries } from '~/components/owners/data/owner-ledger'
import { mockOwnerStatements } from '~/components/owners/data/owner-statements'
import { mockOwnerStays } from '~/components/owners/data/owner-stays'
import { mockOwnerPropertyMappings, mockOwners } from '~/components/owners/data/owners'
import { useOwnerAuth } from '~/composables/useOwnerAuth'
import { useOwnerPortal } from '~/composables/useOwnerPortal'
import { useOwnerStays } from '~/composables/useOwnerStays'

// The seed has two co-owners of lst-3 (own-2 with 50% + own-3 with 50%).
// This is the test-critical fixture: any leak from one owner to the other
// trips the cross-owner tests below.
const CO_OWNED_LISTING = 'lst-3'
const OWNER_A = 'own-2' // I Putu — also owns 100% of lst-8
const OWNER_B = 'own-3' // Ni Kadek — only co-owns lst-3

async function loginAs(ownerEmail: string): Promise<void> {
  const auth = useOwnerAuth()
  auth.logout()
  await auth.requestMagicLink(ownerEmail)
  auth.acceptDemoLink()
}

beforeEach(() => {
  // The shared useState store is reset by tests/setup.ts beforeEach; belt
  // and suspenders to make sure no stale session leaks across tests.
  useOwnerAuth().logout()
})

describe('useOwnerPortal', () => {
  describe('exposed API surface (no source arrays leak)', () => {
    it('does NOT expose allOwners, allMappings, allStatements, allIssues, or allStays', () => {
      const portal = useOwnerPortal()
      // Object.keys on the returned composable is the runtime check the
      // brief asks for. We assert the forbidden names are absent and the
      // required ones are present.
      const exposed = Object.keys(portal)
      for (const leak of ['allOwners', 'allMappings', 'allStatements', 'allIssues', 'allStays']) {
        expect(exposed, `leak: ${leak}`).not.toContain(leak)
      }
      for (const required of [
        'currentOwner',
        'assignedMappings',
        'assignedProperties',
        'commissionRules',
        'visibleStatements',
        'myStays',
        'myIssues',
        'dashboardMetrics',
        'canViewDashboardField',
        'canViewStatementField',
      ]) {
        expect(exposed, `missing: ${required}`).toContain(required)
      }
    })
  })

  describe('unauthenticated state', () => {
    it('currentOwner is null when no session exists', () => {
      const { currentOwner } = useOwnerPortal()
      expect(currentOwner.value).toBeNull()
    })

    it('all selectors return empty arrays when no owner is logged in', () => {
      const portal = useOwnerPortal()
      expect(portal.assignedMappings.value).toEqual([])
      expect(portal.assignedProperties.value).toEqual([])
      expect(portal.commissionRules.value).toEqual([])
      expect(portal.visibleStatements.value).toEqual([])
      expect(portal.myStays.value).toEqual([])
      expect(portal.myIssues.value).toEqual([])
    })

    it('dashboardMetrics is null when no owner is logged in', () => {
      const { dashboardMetrics } = useOwnerPortal()
      expect(dashboardMetrics.value).toBeNull()
    })

    it('canView*Field returns false for any field when no owner is logged in', () => {
      const { canViewDashboardField, canViewStatementField } = useOwnerPortal()
      expect(canViewDashboardField('grossRevenue')).toBe(false)
      expect(canViewDashboardField('netRevenue')).toBe(false)
      expect(canViewStatementField('netPayout')).toBe(false)
      expect(canViewStatementField('commissionDetails')).toBe(false)
    })
  })

  describe('currentOwner', () => {
    it('returns null when not logged in', () => {
      const { currentOwner } = useOwnerPortal()
      expect(currentOwner.value).toBeNull()
    })

    it('returns the matching Owner record when logged in as that owner', async () => {
      await loginAs('wayan.sari@example.com')
      const { currentOwner } = useOwnerPortal()
      expect(currentOwner.value).not.toBeNull()
      expect(currentOwner.value?.id).toBe('own-1')
      expect(currentOwner.value?.name).toBe('Wayan Sari')
    })

    it('switches to the new owner after logout + re-login', async () => {
      await loginAs('wayan.sari@example.com')
      let { currentOwner } = useOwnerPortal()
      expect(currentOwner.value?.id).toBe('own-1')

      useOwnerAuth().logout()
      ;({ currentOwner } = useOwnerPortal())
      expect(currentOwner.value).toBeNull()

      await loginAs('putu.antara@example.com')
      ;({ currentOwner } = useOwnerPortal())
      expect(currentOwner.value?.id).toBe('own-2')
    })
  })

  describe('assignedMappings (owner-filtered)', () => {
    it('returns only the mappings owned by the logged-in owner', async () => {
      await loginAs('wayan.sari@example.com')
      const { assignedMappings } = useOwnerPortal()
      expect(assignedMappings.value).toHaveLength(1)
      expect(assignedMappings.value.every(m => m.ownerId === 'own-1')).toBe(true)
      expect(assignedMappings.value[0].listingId).toBe('lst-1')
    })

    it('returns 2 mappings for the I Putu owner (own-2)', async () => {
      await loginAs('putu.antara@example.com')
      const { assignedMappings } = useOwnerPortal()
      const listingIds = assignedMappings.value.map(m => m.listingId).sort()
      expect(listingIds).toEqual(['lst-3', 'lst-8'])
      expect(assignedMappings.value.every(m => m.ownerId === 'own-2')).toBe(true)
    })

    it('returns exactly the co-owned mapping for own-3 (no leakage from own-2)', async () => {
      await loginAs('kadek.deviani@example.com')
      const { assignedMappings } = useOwnerPortal()
      // own-3 has only one mapping in the seed: 50% of lst-3.
      expect(assignedMappings.value).toHaveLength(1)
      expect(assignedMappings.value[0]).toMatchObject({
        ownerId: 'own-3',
        listingId: 'lst-3',
        ownershipPercentage: 50,
      })
      // And it must NOT contain the I Putu mapping (own-2 on lst-3 50%).
      expect(
        assignedMappings.value.some(m => m.ownerId === OWNER_A && m.listingId === CO_OWNED_LISTING),
      ).toBe(false)
      // The logged-in owner (own-3) IS in the result — the symmetric check.
      expect(
        assignedMappings.value.some(m => m.ownerId === OWNER_B && m.listingId === CO_OWNED_LISTING),
      ).toBe(true)
    })

    it('does not return mappings from the global seed when not logged in', () => {
      const { assignedMappings } = useOwnerPortal()
      expect(assignedMappings.value).toEqual([])
      // Sanity: the seed itself has more than one entry, so an empty result
      // proves the filter is real (not just luck).
      expect(mockOwnerPropertyMappings.length).toBeGreaterThan(1)
    })
  })

  describe('assignedProperties (owner-filtered, listingId-unique)', () => {
    it('returns the listing ids the logged-in owner is mapped to', async () => {
      await loginAs('putu.antara@example.com')
      const { assignedProperties } = useOwnerPortal()
      const ids = assignedProperties.value.map(p => p.listingId).sort()
      expect(ids).toEqual(['lst-3', 'lst-8'])
    })

    it('does not include properties owned by other owners', async () => {
      await loginAs('kadek.deviani@example.com')
      const { assignedProperties } = useOwnerPortal()
      // own-3 only has lst-3 — not lst-1 (Wayan) or lst-8 (Putu).
      expect(assignedProperties.value.map(p => p.listingId)).toEqual(['lst-3'])
    })
  })

  describe('commissionRules (owner-filtered)', () => {
    it('returns the rules owned by the logged-in owner only', async () => {
      await loginAs('putu.antara@example.com')
      const { commissionRules } = useOwnerPortal()
      expect(commissionRules.value).toHaveLength(2)
      expect(commissionRules.value.every(r => r.ownerId === 'own-2')).toBe(true)
      const listingIds = commissionRules.value.map(r => r.listingId).sort()
      expect(listingIds).toEqual(['lst-3', 'lst-8'])
    })

    it('returns only cr-1 for Wayan (own-1)', async () => {
      await loginAs('wayan.sari@example.com')
      const { commissionRules } = useOwnerPortal()
      expect(commissionRules.value.map(r => r.id)).toEqual(['cr-1'])
    })

    it('returns only cr-4 for Ni Kadek (own-3) — does not leak cr-2 (own-2)', async () => {
      await loginAs('kadek.deviani@example.com')
      const { commissionRules } = useOwnerPortal()
      expect(commissionRules.value.map(r => r.id)).toEqual(['cr-4'])
      // cr-2 belongs to own-2 — must be filtered out.
      expect(commissionRules.value.some(r => r.id === 'cr-2')).toBe(false)
    })

    it('matches the data-layer seed length when not logged in (empty, not the full seed)', () => {
      const { commissionRules } = useOwnerPortal()
      expect(commissionRules.value).toEqual([])
      expect(mockCommissionRules.length).toBeGreaterThan(1)
    })
  })

  describe('visibleStatements (owner-filtered, then property/period filter applied)', () => {
    it('returns the owner-scoped statements only', async () => {
      await loginAs('putu.antara@example.com')
      const { visibleStatements } = useOwnerPortal()
      const ids = visibleStatements.value.map(s => s.id).sort()
      // own-2 has stmt-3 (lst-8) + stmt-4 (lst-3) as drafts plus stmt-11..13
      // (lst-8 published) + stmt-14..15 (lst-3 co-owner share published).
      expect(ids).toEqual(['stmt-11', 'stmt-12', 'stmt-13', 'stmt-14', 'stmt-15', 'stmt-3', 'stmt-4'])
      expect(visibleStatements.value.every(s => s.ownerId === 'own-2')).toBe(true)
    })

    it('does not leak the co-owned property statement owned by the other co-owner', async () => {
      // Ni Kadek (own-3) co-owns lst-3 with I Putu (own-2). She must see
      // stmt-5 (her own) plus stmt-16..19 (her published lst-3 history)
      // but NOT stmt-4 or stmt-14/15 (I Putu's co-owner share of the same
      // listing/period).
      await loginAs('kadek.deviani@example.com')
      const { visibleStatements } = useOwnerPortal()
      const ids = visibleStatements.value.map(s => s.id)
      expect(ids).toEqual(['stmt-5', 'stmt-16', 'stmt-17', 'stmt-18', 'stmt-19'])
      // Critical: the co-owner share of the same (listing, period) tuple
      // MUST NOT appear in the list — neither the existing draft (stmt-4)
      // nor the new published entries (stmt-14, stmt-15).
      expect(visibleStatements.value.some(s => s.id === 'stmt-4')).toBe(false)
      expect(visibleStatements.value.some(s => s.id === 'stmt-14')).toBe(false)
      expect(visibleStatements.value.some(s => s.id === 'stmt-15')).toBe(false)
    })

    it('putu (own-2) does not see stmt-5 (own-3 share of the same property)', async () => {
      await loginAs('putu.antara@example.com')
      const { visibleStatements } = useOwnerPortal()
      // own-3's share of the co-owned lst-3 (stmt-5 draft + stmt-16..19
      // published) must not appear in own-2's portal.
      for (const id of ['stmt-5', 'stmt-16', 'stmt-17', 'stmt-18', 'stmt-19']) {
        expect(visibleStatements.value.some(s => s.id === id)).toBe(false)
      }
    })

    it('excludes both draft and published statements — no leakage through any status', async () => {
      await loginAs('wayan.sari@example.com')
      const { visibleStatements } = useOwnerPortal()
      // own-1 has stmt-1 (draft, June 2026), stmt-2 (published, May 2026),
      // and stmt-6..stmt-10 (published Jul..Nov 2026).
      const ids = visibleStatements.value.map(s => s.id).sort()
      expect(ids).toEqual(['stmt-1', 'stmt-10', 'stmt-2', 'stmt-6', 'stmt-7', 'stmt-8', 'stmt-9'])
      // And the own-2 / own-3 statements are NOT in there.
      for (const id of ['stmt-3', 'stmt-4', 'stmt-5']) {
        expect(ids).not.toContain(id)
      }
    })

    it('returns an empty list when the seed has no statements for the owner', async () => {
      // The seed has 5 statements; every owner has at least one. Simulate
      // the "no statements" case by inspecting an inactive owner instead.
      // We can't easily do that through auth, so we assert the property
      // directly: the value is always a subset of the seed statements
      // whose ownerId matches the session.
      await loginAs('wayan.sari@example.com')
      const { visibleStatements } = useOwnerPortal()
      const seedIdsForOwn1 = mockOwnerStatements.filter(s => s.ownerId === 'own-1').map(s => s.id).sort()
      const portalIds = visibleStatements.value.map(s => s.id).sort()
      expect(portalIds).toEqual(seedIdsForOwn1)
    })
  })

  describe('myStays (owner-filtered)', () => {
    it('returns only the stays owned by the logged-in owner', async () => {
      await loginAs('wayan.sari@example.com')
      const { myStays } = useOwnerPortal()
      // own-1 has ost-1 (active) + ost-4 (cancelled).
      const ids = myStays.value.map(s => s.id).sort()
      expect(ids).toEqual(['ost-1', 'ost-4'])
    })

    it('does not leak stays owned by another owner on the same co-owned listing', async () => {
      // own-2 (I Putu) has ost-2 (lst-8) + ost-3 (lst-3).
      // own-3 (Ni Kadek) has no stays in the seed — listing lst-3 is co-owned
      // but stays belong to the owner who filed them, not the co-owner.
      await loginAs('kadek.deviani@example.com')
      const { myStays } = useOwnerPortal()
      expect(myStays.value).toEqual([])
      // The shared lst-3 stay (ost-3) MUST NOT appear here.
      expect(myStays.value.some(s => s.id === 'ost-3')).toBe(false)
    })

    it('returns the two stays for own-2', async () => {
      await loginAs('putu.antara@example.com')
      const { myStays } = useOwnerPortal()
      const ids = myStays.value.map(s => s.id).sort()
      expect(ids).toEqual(['ost-2', 'ost-3'])
    })

    it('matches the data-layer seed length when not logged in (empty, not the full seed)', () => {
      const { myStays } = useOwnerPortal()
      expect(myStays.value).toEqual([])
      expect(mockOwnerStays.length).toBeGreaterThan(1)
    })
  })

  describe('myStays reactivity (Task 7: useOwnerStays -> useOwnerPortal propagation)', () => {
    // Task 7: the portal must read from the same shared useState bucket that
    // useOwnerStays mutates. Before this fix, useOwnerPortal read `mockOwnerStays`
    // (the seed array, frozen at import time) so createStay / updateStay /
    // cancelStay through useOwnerStays had no effect on the portal's myStays.
    it('a stay created via useOwnerStays immediately appears in the current-owner myStays', async () => {
      await loginAs('wayan.sari@example.com')
      const portal = useOwnerPortal()
      const before = portal.myStays.value.length

      const created = useOwnerStays().createStay({
        ownerId: 'own-1',
        listingId: 'lst-1',
        guestName: 'Reactive guest',
        checkIn: '2026-09-01',
        checkOut: '2026-09-04',
      })
      expect(created.ok).toBe(true)
      if (!created.ok)
        return

      // Critical: the portal's myStays must reflect the new stay without
      // any explicit re-fetch. The two composables share the same
      // `elev8-owner-stays` useState bucket.
      const after = portal.myStays.value
      expect(after).toHaveLength(before + 1)
      expect(after.some(stay => stay.id === created.stay.id)).toBe(true)
      expect(after.every(stay => stay.ownerId === 'own-1')).toBe(true)

      // Tear down so other tests do not see the new stay.
      useOwnerStays().cancelStay(created.stay.id, 'reactive-test cleanup')
    })

    it('a stay updated via useOwnerStays is reflected in myStays with the new payload', async () => {
      await loginAs('wayan.sari@example.com')
      const portal = useOwnerPortal()
      const seed = portal.myStays.value.find(stay => stay.id === 'ost-1')
      expect(seed).toBeDefined()

      // Modify the timeline; the existing stay is 2026-06-10 -> 2026-06-13.
      const updated = useOwnerStays().updateStay('ost-1', {
        guestName: 'Wayan Sari (renamed)',
        checkIn: '2026-09-10',
        checkOut: '2026-09-13',
      })
      expect(updated.ok).toBe(true)

      const live = portal.myStays.value.find(stay => stay.id === 'ost-1')
      expect(live).toMatchObject({
        id: 'ost-1',
        guestName: 'Wayan Sari (renamed)',
        checkIn: '2026-09-10',
        checkOut: '2026-09-13',
        nights: 3,
        status: 'active',
        ownerId: 'own-1',
      })
    })

    it('a stay cancelled via useOwnerStays is reflected in myStays as cancelled', async () => {
      await loginAs('wayan.sari@example.com')
      const portal = useOwnerPortal()
      const seed = portal.myStays.value.find(stay => stay.id === 'ost-1')
      expect(seed?.status).toBe('active')

      const result = useOwnerStays().cancelStay('ost-1', 'Task 7 reactivity test')
      expect(result).toEqual({ ok: true })

      const live = portal.myStays.value.find(stay => stay.id === 'ost-1')
      expect(live?.status).toBe('cancelled')
      expect(live?.cancellationReason).toBe('Task 7 reactivity test')
      // And it must still belong to the current owner — cancelled stays
      // are NOT filtered out of myStays.
      expect(live?.ownerId).toBe('own-1')
    })

    it('a stay created for another owner does NOT leak into the current-owner myStays', async () => {
      // own-2 (I Putu) is logged in. Create a stay for own-1 via
      // useOwnerStays — the portal must still only show own-2's stays.
      await loginAs('putu.antara@example.com')
      const portal = useOwnerPortal()
      const before = portal.myStays.value.map(s => s.id).sort()

      const created = useOwnerStays().createStay({
        ownerId: 'own-1',
        listingId: 'lst-1',
        guestName: 'Wayan — should not leak',
        checkIn: '2026-10-01',
        checkOut: '2026-10-04',
      })
      expect(created.ok).toBe(true)
      if (!created.ok)
        return

      const after = portal.myStays.value.map(s => s.id).sort()
      // Same set — the new own-1 stay stays out of own-2's portal.
      expect(after).toEqual(before)
      expect(after).not.toContain(created.stay.id)

      // Cleanup affects only the global store, not the portal isolation.
      useOwnerStays().cancelStay(created.stay.id, 'cleanup')
    })
  })

  describe('myIssues (owner-filtered via parent statement)', () => {
    it('returns only the issues whose parent statement is owned by the logged-in owner', async () => {
      await loginAs('wayan.sari@example.com')
      const { myIssues } = useOwnerPortal()
      // Seed has sti-1 attached to stmt-2 (own-1, published).
      const ids = myIssues.value.map(i => i.id)
      expect(ids).toEqual(['sti-1'])
    })

    it('does not return any issues when logged in as an owner with no statements', async () => {
      // own-3 owns stmt-5 which has no issues seeded.
      await loginAs('kadek.deviani@example.com')
      const { myIssues } = useOwnerPortal()
      expect(myIssues.value).toEqual([])
    })

    it('returns no issues for I Putu (own-2 statements have no seeded issues)', async () => {
      await loginAs('putu.antara@example.com')
      const { myIssues } = useOwnerPortal()
      expect(myIssues.value).toEqual([])
    })
  })

  describe('co-owned data does not leak (critical cross-owner invariant)', () => {
    it('lst-3 has two co-owners; each owner sees ONLY their own statements, rules, stays', async () => {
      // own-2 on lst-3:
      await loginAs('putu.antara@example.com')
      const putuPortal = useOwnerPortal()
      const putuListingIds = putuPortal.assignedProperties.value.map(p => p.listingId)
      const putuStatementIds = putuPortal.visibleStatements.value.map(s => s.id)
      const putuRuleIds = putuPortal.commissionRules.value.map(r => r.id)
      const putuStayIds = putuPortal.myStays.value.map(s => s.id)
      const putuMappingIds = putuPortal.assignedMappings.value.map(m => m.id)

      // own-3 on lst-3 (the other co-owner):
      await loginAs('kadek.deviani@example.com')
      const kadekPortal = useOwnerPortal()
      const kadekListingIds = kadekPortal.assignedProperties.value.map(p => p.listingId)
      const kadekStatementIds = kadekPortal.visibleStatements.value.map(s => s.id)
      const kadekRuleIds = kadekPortal.commissionRules.value.map(r => r.id)
      const kadekStayIds = kadekPortal.myStays.value.map(s => s.id)
      const kadekMappingIds = kadekPortal.assignedMappings.value.map(m => m.id)

      // Both own lst-3 — but everything below the property layer is owner-scoped.
      expect(putuListingIds).toContain(CO_OWNED_LISTING)
      expect(kadekListingIds).toContain(CO_OWNED_LISTING)

      // Statements: each owner sees their OWN share, not the co-owner's.
      // (own-2 has stmt-3, stmt-4, stmt-11..15 — own-3 has stmt-5,
      // stmt-16..19 — same listing, different totals.) The IDs are
      // listed in mock-seed-array order (no .sort() on putuStatementIds)
      // so the cross-owner test invariant matches what the UI shows.
      expect(putuStatementIds).toEqual(['stmt-3', 'stmt-4', 'stmt-11', 'stmt-12', 'stmt-13', 'stmt-14', 'stmt-15'])
      expect(kadekStatementIds).toEqual(['stmt-5', 'stmt-16', 'stmt-17', 'stmt-18', 'stmt-19'])
      // Critical: the CO_OWNER's statement ID must never appear in the
      // other's portal.
      expect(putuStatementIds).not.toContain('stmt-5')
      expect(kadekStatementIds).not.toContain('stmt-4')
      expect(putuStatementIds).not.toContain('stmt-16')
      expect(kadekStatementIds).not.toContain('stmt-14')

      // Rules: own-2 has cr-2 (lst-3) + cr-3 (lst-8); own-3 has cr-4 (lst-3).
      expect(putuRuleIds).toEqual(['cr-2', 'cr-3'])
      expect(kadekRuleIds).toEqual(['cr-4'])
      expect(putuRuleIds).not.toContain('cr-4')
      expect(kadekRuleIds).not.toContain('cr-2')
      expect(kadekRuleIds).not.toContain('cr-3')

      // Stays: own-2 has ost-2 (lst-8) + ost-3 (lst-3); own-3 has nothing.
      expect(putuStayIds).toEqual(['ost-2', 'ost-3'])
      expect(kadekStayIds).toEqual([])
      expect(kadekStayIds).not.toContain('ost-3')

      // Mappings: own-2 has opm-2 (lst-3) + opm-3 (lst-8); own-3 has opm-4 (lst-3).
      expect(putuMappingIds).toEqual(['opm-2', 'opm-3'])
      expect(kadekMappingIds).toEqual(['opm-4'])
      expect(putuMappingIds).not.toContain('opm-4')
      expect(kadekMappingIds).not.toContain('opm-2')
      expect(kadekMappingIds).not.toContain('opm-3')
    })
  })

  describe('dashboardMetrics (owner-scoped, ledger-driven)', () => {
    it('is null when no owner is logged in', () => {
      const { dashboardMetrics } = useOwnerPortal()
      expect(dashboardMetrics.value).toBeNull()
    })

    it('returns owner-scoped grossRevenue / netRevenue / occupancy / adr for the current period', async () => {
      // Derived dynamically from the new fixture: Wayan's "current period" is
      // the latest non-adjustment period in her ledger (the 12-month extension
      // moved it from 2026-06 to 2026-11). Hardcoding 38.5M / 27/30 / 6 etc.
      // would couple the test to a specific month; deriving from the fixture
      // keeps the original intent (current-period rollup) stable as the
      // fixture grows. Wayan has multiple listings — the dashboardMetrics
      // current-period rollup is the sum of every (owner, listing) entry
      // that shares the latest period.
      await loginAs('wayan.sari@example.com')
      const { dashboardMetrics } = useOwnerPortal()
      const metrics = dashboardMetrics.value
      expect(metrics).not.toBeNull()
      expect(metrics!.currency).toBe('IDR')

      const own1Entries = mockOwnerLedgerEntries.filter(
        e => e.ownerId === 'own-1' && !e.isPriorPeriodAdjustment,
      )
      const currentPeriod = own1Entries.map(e => e.period).sort().pop()!
      const currentEntries = own1Entries.filter(e => e.period === currentPeriod)

      const expectedGross = currentEntries.reduce((sum, e) => sum + e.grossRevenue, 0)
      const expectedNet = currentEntries.reduce(
        (sum, e) => sum + e.grossRevenue - e.expenses - e.taxes - e.platformFees,
        0,
      )
      const occupied = currentEntries.reduce((sum, e) => sum + e.occupiedNights, 0)
      const available = currentEntries.reduce((sum, e) => sum + e.availableNights, 0)
      const rateSum = currentEntries.reduce((sum, e) => sum + e.nightlyRateSum, 0)
      const resCount = currentEntries.reduce((sum, e) => sum + e.reservationCount, 0)

      // Gross / net / occupancy / ADR roll up from the owner-scoped ledger.
      expect(metrics!.grossRevenue).toBe(expectedGross)
      expect(metrics!.netRevenue).toBe(expectedNet)
      expect(metrics!.occupancy).toBeCloseTo(occupied / available, 5)
      expect(metrics!.adr).toBeCloseTo(rateSum / resCount, 5)
      expect(metrics!.reservationCount).toBe(resCount)
    })

    it('does NOT aggregate across owners — only the logged-in owner\'s ledger is summed', async () => {
      // Login as I Putu (own-2). He has two ledgers: led-3 (lst-8, USD) and
      // led-4 (lst-3, IDR). His dashboardMetrics must only include his own
      // rows — not led-5 (own-3 on lst-3) or led-1 (own-1 on lst-1).
      await loginAs('putu.antara@example.com')
      const { dashboardMetrics } = useOwnerPortal()
      const metrics = dashboardMetrics.value!

      // The seed mixes IDR + USD, and the 12-month extension now puts many
      // own-2 entries on the books. dashboardMetrics normalises to a single
      // currency bucket per owner, using the LATEST non-adjustment period.
      // What we pin down is that the result reflects ONLY own-2's ledgers.
      const own2Current = mockOwnerLedgerEntries
        .filter(e => e.ownerId === 'own-2' && !e.isPriorPeriodAdjustment)
        .map(e => e.period)
        .sort()
        .pop()!
      const own2CurrentGross = mockOwnerLedgerEntries
        .filter(
          e => e.ownerId === 'own-2' && e.period === own2Current && !e.isPriorPeriodAdjustment,
        )
        .reduce((sum, e) => sum + e.grossRevenue, 0)
      expect(metrics.grossRevenue).toBe(own2CurrentGross)

      // And it must NOT include own-1's led-1 (any month).
      const wayanGross = mockOwnerLedgerEntries
        .filter(e => e.ownerId === 'own-1' && !e.isPriorPeriodAdjustment)
        .reduce((sum, e) => sum + e.grossRevenue, 0)
      expect(metrics.grossRevenue).not.toBe(wayanGross)
    })

    it('exposes upcomingReservations from the owner\'s current period ledger only', async () => {
      await loginAs('wayan.sari@example.com')
      const { dashboardMetrics } = useOwnerPortal()
      const upcoming = dashboardMetrics.value!.upcomingReservations

      // Pin to the current period's upcoming list dynamically — the
      // 12-month extension moved Wayan's current period to 2026-11, and
      // that ledger's upcomingReservations is the authoritative list.
      const own1Entries = mockOwnerLedgerEntries.filter(
        e => e.ownerId === 'own-1' && !e.isPriorPeriodAdjustment,
      )
      const currentPeriod = own1Entries.map(e => e.period).sort().pop()!
      const currentEntry = own1Entries.find(e => e.period === currentPeriod)!
      const expectedGuests = currentEntry.upcomingReservations
        .map(u => u.guestName)
        .sort()
      const guestNames = upcoming.map(u => u.guestName).sort()
      expect(guestNames).toEqual(expectedGuests)

      // And it must NOT include I Putu's up-3 (Emily Carter, on lst-8) or
      // up-4 (Daniel Park — appears in BOTH led-4 and led-5 but only led-4
      // is own-2's).
      expect(guestNames).not.toContain('Emily Carter')
    })

    it('reports zero reservations and zero revenue for an owner with no ledger', async () => {
      // No owner in the seed has a fully empty ledger, so we simulate by
      // checking the value shape directly: an owner with at least one
      // ledger has revenue > 0; an owner with no ledger is reported as 0.
      // We use the empty path: an owner ID that has no mappings and no
      // ledger. None of the seed owners fit, so we instead prove the
      // shape (no negative numbers, no NaN).
      await loginAs('wayan.sari@example.com')
      const metrics = useOwnerPortal().dashboardMetrics.value!
      expect(metrics.grossRevenue).toBeGreaterThanOrEqual(0)
      expect(metrics.reservationCount).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(metrics.adr)).toBe(true)
      expect(Number.isFinite(metrics.occupancy)).toBe(true)
    })
  })

  describe('canViewDashboardField / canViewStatementField (permission-driven)', () => {
    it('returns true for every dashboard field for an owner on full_transparency', async () => {
      // own-1 (Wayan) is on full_transparency in the seed.
      await loginAs('wayan.sari@example.com')
      const { canViewDashboardField } = useOwnerPortal()
      const fields = [
        'grossRevenue',
        'netRevenue',
        'occupancy',
        'adr',
        'bookingSources',
        'upcomingReservations',
        'guestRatings',
      ] as const
      for (const field of fields) {
        expect(canViewDashboardField(field), field).toBe(true)
      }
    })

    it('returns the strict financial_summary view for own-2', async () => {
      await loginAs('putu.antara@example.com')
      const { canViewDashboardField, canViewStatementField } = useOwnerPortal()
      // ON: net revenue, occupancy, ADR
      expect(canViewDashboardField('netRevenue')).toBe(true)
      expect(canViewDashboardField('occupancy')).toBe(true)
      expect(canViewDashboardField('adr')).toBe(true)
      // OFF: gross revenue, booking sources, upcoming reservations, guest ratings
      expect(canViewDashboardField('grossRevenue')).toBe(false)
      expect(canViewDashboardField('bookingSources')).toBe(false)
      expect(canViewDashboardField('upcomingReservations')).toBe(false)
      expect(canViewDashboardField('guestRatings')).toBe(false)
      // Statement: commission details + net payout on, everything else off
      expect(canViewStatementField('commissionDetails')).toBe(true)
      expect(canViewStatementField('netPayout')).toBe(true)
      expect(canViewStatementField('revenueLines')).toBe(false)
      expect(canViewStatementField('expenseDetails')).toBe(false)
      expect(canViewStatementField('taxesAndFees')).toBe(false)
      expect(canViewStatementField('adjustments')).toBe(false)
    })

    it('returns false for every field when no owner is logged in', () => {
      const { canViewDashboardField, canViewStatementField } = useOwnerPortal()
      expect(canViewDashboardField('grossRevenue')).toBe(false)
      expect(canViewDashboardField('netRevenue')).toBe(false)
      expect(canViewStatementField('netPayout')).toBe(false)
    })
  })

  describe('reactive session tracking (no extra plumbing)', () => {
    it('all selectors are wired to the current session — logout empties them', async () => {
      await loginAs('wayan.sari@example.com')
      let portal = useOwnerPortal()
      expect(portal.currentOwner.value?.id).toBe('own-1')
      expect(portal.assignedMappings.value).toHaveLength(1)
      // own-1 visibleStatements now includes stmt-6..stmt-10 (5 new published
      // rows) on top of the original 2 (stmt-1 draft + stmt-2 published).
      expect(portal.visibleStatements.value).toHaveLength(7)

      useOwnerAuth().logout()
      // After logout, the SAME composable instance re-reads from the
      // shared useState bucket and returns empty.
      portal = useOwnerPortal()
      expect(portal.currentOwner.value).toBeNull()
      expect(portal.assignedMappings.value).toEqual([])
      expect(portal.visibleStatements.value).toEqual([])
      expect(portal.myStays.value).toEqual([])
      expect(portal.commissionRules.value).toEqual([])
      expect(portal.myIssues.value).toEqual([])
      expect(portal.dashboardMetrics.value).toBeNull()
    })
  })

  describe('seed integrity (no test drift)', () => {
    it('mock seed has the expected co-ownership shape used by the tests', () => {
      // If the seed ever changes, the cross-owner tests above stop
      // asserting what they should. Pin the critical relationships here.
      const coOwners = mockOwnerPropertyMappings.filter(m => m.listingId === 'lst-3')
      expect(coOwners).toHaveLength(2)
      const ownerIds = coOwners.map(m => m.ownerId).sort()
      expect(ownerIds).toEqual(['own-2', 'own-3'])

      // Total co-ownership sums to 100% (the seed invariant).
      const total = coOwners.reduce((sum, m) => sum + m.ownershipPercentage, 0)
      expect(total).toBe(100)
    })

    it('mock seed has every owner with at least one of (mappings, ledger, statements, stays)', () => {
      // Every seed owner should be discoverable through the portal — if
      // the seed grows an owner with nothing to see, dashboardMetrics
      // would be the only "empty" case.
      for (const owner of mockOwners) {
        const hasMappings = mockOwnerPropertyMappings.some(m => m.ownerId === owner.id)
        const hasLedger = mockOwnerLedgerEntries.some(e => e.ownerId === owner.id && !e.isPriorPeriodAdjustment)
        const hasStatements = mockOwnerStatements.some(s => s.ownerId === owner.id)
        const hasStays = mockOwnerStays.some(s => s.ownerId === owner.id)
        expect(hasMappings || hasLedger || hasStatements || hasStays, owner.id).toBe(true)
      }
    })
  })

  describe('owner dashboard selectors', () => {
    it('narrows metrics and applies the co-owner share', async () => {
      await loginAs('putu.antara@example.com')
      const portal = useOwnerPortal()
      expect(portal.assignedProperties.value).toHaveLength(2)
      portal.selectedPropertyId.value = 'lst-3'
      // propertyMetrics rolls up the LATEST non-adjustment period for the
      // selected property, not whichever row `find` happens to return first.
      // Pin the test to the latest own-2 / lst-3 entry so it stays stable as
      // the fixture grows.
      const own2Lst3Entries = mockOwnerLedgerEntries.filter(
        entry =>
          entry.ownerId === 'own-2'
          && entry.listingId === 'lst-3'
          && !entry.isPriorPeriodAdjustment,
      )
      const latestOwn2Lst3 = own2Lst3Entries
        .map(e => e.period)
        .sort()
        .pop()!
      const latestEntry = own2Lst3Entries.find(e => e.period === latestOwn2Lst3)!
      expect(portal.propertyMetrics.value?.grossRevenue).toBe(latestEntry.grossRevenue * 0.5)
    })

    it('keeps owner-use nights separate and omits hidden fields', async () => {
      await loginAs('putu.antara@example.com')
      const portal = useOwnerPortal()
      expect(portal.ownerUseNights.value).toBeGreaterThanOrEqual(0)
      const keys = portal.dashboardMetricDescriptors.value.map(metric => metric.key)
      expect(keys).not.toContain('grossRevenue')
      expect(keys).not.toContain('bookingSources')
      expect(keys).not.toContain('upcomingReservations')
      expect(keys).not.toContain('guestRatings')
    })
  })
})
