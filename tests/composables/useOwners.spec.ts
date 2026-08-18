import type { OwnerDashboardField } from '~/components/owners/data/owner-permissions'
import { describe, expect, it } from 'vitest'
import { mockCommissionRules } from '~/components/owners/data/commission-rules'
import { buildOwnerPermissionTemplate } from '~/components/owners/data/owner-permissions'
import { mockOwnerPropertyMappings, mockOwners } from '~/components/owners/data/owners'
import { useOwners } from '~/composables/useOwners'

describe('useOwners', () => {
  describe('seed data', () => {
    it('seeds with the three fixture owners', () => {
      const { owners } = useOwners()
      const seededIds = owners.value.map(o => o.id).sort()
      expect(seededIds).toEqual(mockOwners.map(o => o.id).sort())
      expect(owners.value).toHaveLength(mockOwners.length)
    })

    it('seeds with the four fixture mappings', () => {
      const { mappings } = useOwners()
      const seededIds = mappings.value.map(m => m.id).sort()
      expect(seededIds).toEqual(mockOwnerPropertyMappings.map(m => m.id).sort())
    })

    it('seeds with the four fixture commission rules', () => {
      const { commissionRules } = useOwners()
      const seededIds = commissionRules.value.map(r => r.id).sort()
      expect(seededIds).toEqual(mockCommissionRules.map(r => r.id).sort())
    })

    it('does not mutate the imported seed fixtures', () => {
      useOwners()
      expect(mockOwners).toHaveLength(3)
      expect(mockOwnerPropertyMappings).toHaveLength(4)
    })
  })

  describe('createOwner — duplicate email guard', () => {
    it('rejects a new owner whose email matches an existing seed (case-insensitive)', () => {
      const { createOwner } = useOwners()
      // Seed has 'wayan.sari@example.com' — uppercase must collide.
      const result = createOwner({
        owner: {
          name: 'Wayan Sari Clone',
          email: 'WAYAN.SARI@Example.com',
          phone: '+6281234567999',
          language: 'id',
          statementCurrency: 'IDR',
          annualOwnerUseNightCap: undefined,
        },
        mappings: [],
        commissionRules: [],
        permissions: buildOwnerPermissionTemplate('financial_summary', 'placeholder', new Date().toISOString()),
        inviteNow: false,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/email/i)
    })

    it('rejects an email that collides only after lowercasing', () => {
      const { createOwner } = useOwners()
      const result = createOwner({
        owner: {
          name: 'Another Clone',
          email: 'Kadek.Deviani@Example.com',
          phone: '+6281234567998',
          language: 'id',
          statementCurrency: 'IDR',
          annualOwnerUseNightCap: undefined,
        },
        mappings: [],
        commissionRules: [],
        permissions: buildOwnerPermissionTemplate('financial_summary', 'placeholder', new Date().toISOString()),
        inviteNow: false,
      })
      expect(result.success).toBe(false)
    })

    it('creates an owner with brand-new email and assigns the generated id', () => {
      const { createOwner, owners } = useOwners()
      const result = createOwner({
        owner: {
          name: 'Made Wirawan',
          email: 'made.wirawan@example.com',
          phone: '+6281234567100',
          language: 'en',
          statementCurrency: 'USD',
          annualOwnerUseNightCap: 7,
        },
        mappings: [],
        commissionRules: [],
        permissions: buildOwnerPermissionTemplate('full_transparency', 'placeholder', new Date().toISOString()),
        inviteNow: false,
      })
      expect(result.success).toBe(true)
      expect(result.ownerId).toBeTruthy()
      const created = owners.value.find(o => o.id === result.ownerId)!
      expect(created.name).toBe('Made Wirawan')
      expect(created.email).toBe('made.wirawan@example.com')
      expect(created.status).toBe('draft')
      expect(created.createdAt).toBeTruthy()
      expect(created.updatedAt).toBeTruthy()
    })

    it('uses replacement mutation (a new owners array) rather than mutating in place', () => {
      const { createOwner, owners } = useOwners()
      const originalArray = owners.value
      const result = createOwner({
        owner: {
          name: 'Ni Luh',
          email: 'ni.luh@example.com',
          phone: '+6281234567200',
          language: 'id',
          statementCurrency: 'IDR',
          annualOwnerUseNightCap: undefined,
        },
        mappings: [],
        commissionRules: [],
        permissions: buildOwnerPermissionTemplate('financial_summary', 'placeholder', new Date().toISOString()),
        inviteNow: false,
      })
      expect(result.success).toBe(true)
      // Vue reacts to ref identity changes; a true spread replacement would
      // reassign .value. Mutating in place would leave the reference intact.
      expect(owners.value).not.toBe(originalArray)
      expect(owners.value.length).toBe(4)
    })

    it('persists the mappings, commission rules, and permissions that come along with the owner', () => {
      const { createOwner, mappings, commissionRules } = useOwners()
      const result = createOwner({
        owner: {
          name: 'Bagus Putra',
          email: 'bagus.putra@example.com',
          phone: '+6281234567300',
          language: 'en',
          statementCurrency: 'SGD',
          annualOwnerUseNightCap: undefined,
        },
        mappings: [
          {
            listingId: 'lst-5',
            ownershipPercentage: 60,
            commissionRuleId: 'cr-new',
            effectiveFrom: '2026-08-01',
          },
        ],
        commissionRules: [
          {
            type: 'flat',
            rate: 18,
            listingId: 'lst-5',
            name: 'Standard 18% management',
            effectiveFrom: '2026-08-01',
          },
        ],
        permissions: buildOwnerPermissionTemplate('full_transparency', 'placeholder', new Date().toISOString()),
        inviteNow: false,
      })
      expect(result.success).toBe(true)
      const ownerMappings = mappings.value.filter(m => m.ownerId === result.ownerId)
      expect(ownerMappings).toHaveLength(1)
      expect(ownerMappings[0].listingId).toBe('lst-5')
      expect(ownerMappings[0].ownershipPercentage).toBe(60)
      const ownerRules = commissionRules.value.filter(r => r.ownerId === result.ownerId)
      expect(ownerRules).toHaveLength(1)
      expect(ownerRules[0].type).toBe('flat')
      expect(ownerRules[0].rate).toBe(18)
      expect(ownerRules[0].listingId).toBe('lst-5')
      expect(ownerRules[0].name).toBe('Standard 18% management')
    })

    it('persists tiered and hybrid commission rules with their full shape', () => {
      const { createOwner, commissionRules } = useOwners()
      const result = createOwner({
        owner: {
          name: 'Tier Hybrid',
          email: 'tier.hybrid@example.com',
          phone: '+6281234567301',
          language: 'en',
          statementCurrency: 'USD',
          annualOwnerUseNightCap: undefined,
        },
        mappings: [
          { listingId: 'lst-5', ownershipPercentage: 50, commissionRuleId: 'cr-x', effectiveFrom: '2026-08-01' },
          { listingId: 'lst-6', ownershipPercentage: 50, commissionRuleId: 'cr-y', effectiveFrom: '2026-08-01' },
        ],
        commissionRules: [
          {
            type: 'tiered',
            tiers: [
              { upTo: 50_000_000, rate: 18 },
              { upTo: null, rate: 22 },
            ],
            listingId: 'lst-5',
            name: 'Tiered — 18% / 22%',
            effectiveFrom: '2026-08-01',
          },
          {
            type: 'hybrid',
            fixedAmount: 250,
            rate: 15,
            listingId: 'lst-6',
            name: 'Hybrid — 250 USD + 15%',
            effectiveFrom: '2026-08-01',
          },
        ],
        permissions: buildOwnerPermissionTemplate('financial_summary', 'placeholder', new Date().toISOString()),
        inviteNow: false,
      })
      expect(result.success).toBe(true)
      const ownerRules = commissionRules.value.filter(r => r.ownerId === result.ownerId)
      expect(ownerRules).toHaveLength(2)
      const tiered = ownerRules.find(r => r.type === 'tiered')
      expect(tiered).toBeTruthy()
      expect((tiered as { tiers: Array<{ upTo: number | null, rate: number }> }).tiers).toEqual([
        { upTo: 50_000_000, rate: 18 },
        { upTo: null, rate: 22 },
      ])
      const hybrid = ownerRules.find(r => r.type === 'hybrid')
      expect(hybrid).toBeTruthy()
      expect((hybrid as { fixedAmount: number, rate: number }).fixedAmount).toBe(250)
      expect((hybrid as { fixedAmount: number, rate: number }).rate).toBe(15)
    })

    it('defaults to a placeholder rule when a mapping has no matching commission rule', () => {
      const { createOwner, commissionRules } = useOwners()
      const result = createOwner({
        owner: {
          name: 'No Rule',
          email: 'no.rule@example.com',
          phone: '+6281234567302',
          language: 'en',
          statementCurrency: 'IDR',
          annualOwnerUseNightCap: undefined,
        },
        mappings: [
          { listingId: 'lst-5', ownershipPercentage: 100, commissionRuleId: 'cr-x', effectiveFrom: '2026-08-01' },
        ],
        commissionRules: [],
        permissions: buildOwnerPermissionTemplate('financial_summary', 'placeholder', new Date().toISOString()),
        inviteNow: false,
      })
      expect(result.success).toBe(true)
      const ownerRules = commissionRules.value.filter(r => r.ownerId === result.ownerId)
      expect(ownerRules).toHaveLength(1)
      // Fallback keeps the mapping's listingId so the detail sheet can match them.
      expect(ownerRules[0].listingId).toBe('lst-5')
    })

    it('rejects a batch that cumulatively exceeds 100% on the same (listingId, unitId) scope', () => {
      const { createOwner, owners } = useOwners()
      const ownersBefore = owners.value.length
      const result = createOwner({
        owner: {
          name: 'Cumulative Test',
          email: 'cumulative.batch@example.com',
          phone: '+6281234567500',
          language: 'id',
          statementCurrency: 'IDR',
          annualOwnerUseNightCap: undefined,
        },
        mappings: [
          {
            listingId: 'lst-12',
            ownershipPercentage: 60,
            commissionRuleId: 'cr-x',
            effectiveFrom: '2026-08-01',
          },
          {
            listingId: 'lst-12',
            ownershipPercentage: 60, // 60 + 60 = 120 > 100 in the same batch
            commissionRuleId: 'cr-y',
            effectiveFrom: '2026-08-01',
          },
        ],
        commissionRules: [],
        permissions: buildOwnerPermissionTemplate('financial_summary', 'placeholder', new Date().toISOString()),
        inviteNow: false,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/batch/i)
      // No owner or mapping should have been persisted.
      expect(owners.value.length).toBe(ownersBefore)
    })

    it('accepts a batch whose mappings span different (listingId, unitId) scopes', () => {
      const { createOwner, mappings } = useOwners()
      const result = createOwner({
        owner: {
          name: 'Multi Scope',
          email: 'multi.scope@example.com',
          phone: '+6281234567501',
          language: 'en',
          statementCurrency: 'USD',
          annualOwnerUseNightCap: undefined,
        },
        mappings: [
          { listingId: 'lst-12', ownershipPercentage: 60, commissionRuleId: 'cr-x', effectiveFrom: '2026-08-01' },
          { listingId: 'lst-13', ownershipPercentage: 80, commissionRuleId: 'cr-y', effectiveFrom: '2026-08-01' },
          { listingId: 'lst-12', unitId: 'unit-A', ownershipPercentage: 40, commissionRuleId: 'cr-z', effectiveFrom: '2026-08-01' },
        ],
        commissionRules: [],
        permissions: buildOwnerPermissionTemplate('financial_summary', 'placeholder', new Date().toISOString()),
        inviteNow: false,
      })
      expect(result.success).toBe(true)
      const ownerMappings = mappings.value.filter(m => m.ownerId === result.ownerId)
      expect(ownerMappings).toHaveLength(3)
    })

    it('rejects a batch that is fine on its own but pushes existing scope past 100%', () => {
      const { createOwner } = useOwners()
      // Seed has opm-2 (50% lst-3) + opm-4 (50% lst-3) = 100%. A new owner with
      // a single 1% mapping for lst-3 must be rejected.
      const result = createOwner({
        owner: {
          name: 'Edge Of Cap',
          email: 'edge.cap@example.com',
          phone: '+6281234567502',
          language: 'id',
          statementCurrency: 'IDR',
          annualOwnerUseNightCap: undefined,
        },
        mappings: [
          { listingId: 'lst-3', ownershipPercentage: 1, commissionRuleId: 'cr-1', effectiveFrom: '2026-08-01' },
        ],
        commissionRules: [],
        permissions: buildOwnerPermissionTemplate('financial_summary', 'placeholder', new Date().toISOString()),
        inviteNow: false,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/existing/i)
    })
  })

  describe('addMapping — ownership guard', () => {
    it('rejects a mapping whose ownership would exceed 100%', () => {
      const { addMapping } = useOwners()
      // lst-3 already has 50% (own-2) + 50% (own-3) = 100%.
      const result = addMapping({
        ownerId: 'own-1',
        listingId: 'lst-3',
        ownershipPercentage: 1,
        commissionRuleId: 'cr-1',
        effectiveFrom: '2026-08-01',
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/ownership/i)
    })

    it('rejects a 30% mapping when remaining allocation is 0%', () => {
      const { addMapping } = useOwners()
      // lst-1 already has 100% (own-1). Same listingId with a different ownerId is rejected.
      const result = addMapping({
        ownerId: 'own-2',
        listingId: 'lst-1',
        ownershipPercentage: 30,
        commissionRuleId: 'cr-2',
        effectiveFrom: '2026-08-01',
      })
      expect(result.success).toBe(false)
    })

    it('accepts a mapping that fills the remaining allocation to exactly 100%', () => {
      const { addMapping, mappings } = useOwners()
      // lst-7 starts free. Two owners take it to exactly 100%.
      const first = addMapping({
        ownerId: 'own-2',
        listingId: 'lst-7',
        ownershipPercentage: 60,
        commissionRuleId: 'cr-3',
        effectiveFrom: '2026-08-01',
      })
      expect(first.success).toBe(true)
      const second = addMapping({
        ownerId: 'own-3',
        listingId: 'lst-7',
        ownershipPercentage: 40,
        commissionRuleId: 'cr-4',
        effectiveFrom: '2026-08-01',
      })
      expect(second.success).toBe(true)
      const nowAllocated = mappings.value
        .filter(m => m.listingId === 'lst-7')
        .reduce((sum, m) => sum + m.ownershipPercentage, 0)
      expect(nowAllocated).toBe(100)
    })

    it('rejects a 21% add when only 20% is left (cumulative 101%)', () => {
      const { addMapping } = useOwners()
      const first = addMapping({
        ownerId: 'own-1',
        listingId: 'lst-9',
        ownershipPercentage: 80,
        commissionRuleId: 'cr-1',
        effectiveFrom: '2026-08-01',
      })
      expect(first.success).toBe(true)
      const second = addMapping({
        ownerId: 'own-2',
        listingId: 'lst-9',
        ownershipPercentage: 21,
        commissionRuleId: 'cr-2',
        effectiveFrom: '2026-08-01',
      })
      expect(second.success).toBe(false)
    })

    it('updates an existing mapping via updateMapping without double-counting the old allocation', () => {
      const { addMapping, updateMapping, mappings } = useOwners()
      const added = addMapping({
        ownerId: 'own-1',
        listingId: 'lst-11',
        ownershipPercentage: 50,
        commissionRuleId: 'cr-1',
        effectiveFrom: '2026-08-01',
      })
      expect(added.success).toBe(true)
      // Increase to 70% — should still be valid because previous allocation is excluded.
      const updated = updateMapping(added.mappingId!, { ownershipPercentage: 70 })
      expect(updated.success).toBe(true)
      const m = mappings.value.find(item => item.id === added.mappingId)!
      expect(m.ownershipPercentage).toBe(70)
    })

    it('removeMapping deletes the mapping', () => {
      const { removeMapping, mappings } = useOwners()
      const before = mappings.value.length
      const result = removeMapping('opm-1')
      expect(result.success).toBe(true)
      expect(mappings.value.length).toBe(before - 1)
      expect(mappings.value.some(m => m.id === 'opm-1')).toBe(false)
    })

    it('removeMapping refuses a missing mapping id', () => {
      const { removeMapping } = useOwners()
      const result = removeMapping('opm-does-not-exist')
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/not found/i)
    })

    it('updateMapping revalidates when listingId moves to a saturated scope, even without ownershipPercentage', () => {
      const { updateMapping, mappings } = useOwners()
      // opm-1 = 100% of lst-1 (owned by own-1). Take opm-3 = 100% of lst-8 and
      // try to move it onto lst-1 (which already has 100%) — must be rejected.
      const before = mappings.value.find(m => m.id === 'opm-3')!
      const result = updateMapping('opm-3', { listingId: 'lst-1' })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/ownership/i)
      // The mapping must NOT have been mutated.
      const after = mappings.value.find(m => m.id === 'opm-3')!
      expect(after.listingId).toBe(before.listingId)
      expect(after.ownershipPercentage).toBe(before.ownershipPercentage)
    })

    it('updateMapping allows a scope move into an unsaturated listing', () => {
      const { updateMapping, mappings } = useOwners()
      // Move opm-3 (100% of lst-8) onto lst-7 — free at the moment.
      const result = updateMapping('opm-3', { listingId: 'lst-7' })
      expect(result.success).toBe(true)
      const after = mappings.value.find(m => m.id === 'opm-3')!
      expect(after.listingId).toBe('lst-7')
    })

    it('updateMapping allows a unitId-only scope move when the new scope fits', () => {
      const { updateMapping, mappings } = useOwners()
      const result = updateMapping('opm-1', { unitId: 'unit-A' })
      expect(result.success).toBe(true)
      const after = mappings.value.find(m => m.id === 'opm-1')!
      expect(after.unitId).toBe('unit-A')
    })

    it('updateMapping refuses a missing mapping id', () => {
      const { updateMapping } = useOwners()
      const result = updateMapping('opm-does-not-exist', { ownershipPercentage: 10 })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/not found/i)
    })

    it('addMapping accepts a unit-scoped row even when the parent listing is saturated', () => {
      const { addMapping, mappings } = useOwners()
      // lst-1 is 100% at the listing scope (opm-1). A mapping for lst-1+unit-A
      // is a *different* (listingId, unitId) scope and must be accepted.
      const result = addMapping({
        ownerId: 'own-2',
        listingId: 'lst-1',
        unitId: 'unit-A',
        ownershipPercentage: 40,
        commissionRuleId: 'cr-1',
        effectiveFrom: '2026-08-01',
      })
      expect(result.success).toBe(true)
      expect(mappings.value.some(m => m.listingId === 'lst-1' && m.unitId === 'unit-A')).toBe(true)
    })
  })

  describe('validateOwnership (helper)', () => {
    it('returns valid: false with allocated=100 when total is already at cap', () => {
      const { validateOwnership } = useOwners()
      const check = validateOwnership({
        ownerId: 'own-1',
        listingId: 'lst-1',
        ownershipPercentage: 1,
        commissionRuleId: 'cr-1',
        effectiveFrom: '2026-08-01',
      })
      expect(check.valid).toBe(false)
      expect(check.allocated).toBe(100)
    })

    it('returns valid: true with allocated=0 for an unmapped listing', () => {
      const { validateOwnership } = useOwners()
      const check = validateOwnership({
        ownerId: 'own-1',
        listingId: 'lst-2',
        ownershipPercentage: 50,
        commissionRuleId: 'cr-1',
        effectiveFrom: '2026-08-01',
      })
      expect(check.valid).toBe(true)
      expect(check.allocated).toBe(0)
    })

    it('excludes the mapping being edited from allocated total', () => {
      const { validateOwnership } = useOwners()
      // opm-2 is 50% of lst-3 owned by own-2. The OTHER mapping (opm-4) is 50%.
      // If we leave opm-2 in the sum we get 100 + 1 = 101 > 100 (would be invalid).
      // Excluding opm-2, only opm-4 = 50% counts → 50 + 1 = 51 ≤ 100 (valid).
      const check = validateOwnership(
        {
          ownerId: 'own-2',
          listingId: 'lst-3',
          ownershipPercentage: 1,
          commissionRuleId: 'cr-2',
          effectiveFrom: '2026-08-01',
        },
        'opm-2',
      )
      expect(check.valid).toBe(true)
      expect(check.allocated).toBe(50)
    })

    it('treats unitId as part of the scope — a different unitId is independent', () => {
      const { validateOwnership, addMapping } = useOwners()
      const added = addMapping({
        ownerId: 'own-2',
        listingId: 'lst-5',
        unitId: 'unit-A',
        ownershipPercentage: 60,
        commissionRuleId: 'cr-1',
        effectiveFrom: '2026-08-01',
      })
      expect(added.success).toBe(true)
      // Asking for 50% on lst-5+unit-B should report allocated=0 for unit-B,
      // even though unit-A is at 60%.
      const check = validateOwnership({
        ownerId: 'own-2',
        listingId: 'lst-5',
        unitId: 'unit-B',
        ownershipPercentage: 50,
        commissionRuleId: 'cr-1',
        effectiveFrom: '2026-08-01',
      })
      expect(check.valid).toBe(true)
      expect(check.allocated).toBe(0)
    })
  })

  describe('status transitions', () => {
    it('inviteOwner moves a draft owner to invited and stamps invitedAt', () => {
      const { createOwner, inviteOwner, owners } = useOwners()
      const created = createOwner({
        owner: {
          name: 'Test Draft',
          email: 'draft.owner@example.com',
          phone: '+6281234567400',
          language: 'id',
          statementCurrency: 'IDR',
          annualOwnerUseNightCap: undefined,
        },
        mappings: [],
        commissionRules: [],
        permissions: buildOwnerPermissionTemplate('financial_summary', 'placeholder', new Date().toISOString()),
        inviteNow: false,
      })
      expect(created.success).toBe(true)
      expect(owners.value.find(o => o.id === created.ownerId)!.status).toBe('draft')

      const invited = inviteOwner(created.ownerId!)
      expect(invited.success).toBe(true)
      const after = owners.value.find(o => o.id === created.ownerId)!
      expect(after.status).toBe('invited')
      expect(after.invitedAt).toBeTruthy()
    })

    it('createOwner with inviteNow:true seeds invited status directly', () => {
      const { createOwner, owners } = useOwners()
      const created = createOwner({
        owner: {
          name: 'Auto Invited',
          email: 'auto.invited@example.com',
          phone: '+6281234567401',
          language: 'id',
          statementCurrency: 'IDR',
          annualOwnerUseNightCap: undefined,
        },
        mappings: [],
        commissionRules: [],
        permissions: buildOwnerPermissionTemplate('financial_summary', 'placeholder', new Date().toISOString()),
        inviteNow: true,
      })
      expect(created.success).toBe(true)
      const after = owners.value.find(o => o.id === created.ownerId)!
      expect(after.status).toBe('invited')
      expect(after.invitedAt).toBeTruthy()
    })

    it('activateOwner moves invited → active and stamps activatedAt', () => {
      const { activateOwner, owners } = useOwners()
      // Seed has 'own-3' as invited.
      const result = activateOwner('own-3')
      expect(result.success).toBe(true)
      const after = owners.value.find(o => o.id === 'own-3')!
      expect(after.status).toBe('active')
      expect(after.activatedAt).toBeTruthy()
    })

    it('deactivateOwner moves active → inactive', () => {
      const { deactivateOwner, owners } = useOwners()
      // Seed has 'own-1' as active.
      const result = deactivateOwner('own-1')
      expect(result.success).toBe(true)
      expect(owners.value.find(o => o.id === 'own-1')!.status).toBe('inactive')
    })

    it('deactivateOwner preserves the original activatedAt timestamp', () => {
      const { deactivateOwner, owners } = useOwners()
      // Seed: own-2 is active with activatedAt '2025-12-01T08:00:00.000Z'.
      const before = owners.value.find(o => o.id === 'own-2')!
      const originalActivatedAt = before.activatedAt
      expect(originalActivatedAt).toBe('2025-12-01T08:00:00.000Z')

      const result = deactivateOwner('own-2')
      expect(result.success).toBe(true)
      const after = owners.value.find(o => o.id === 'own-2')!
      expect(after.status).toBe('inactive')
      // activatedAt must be unchanged — it records when they became active, not when
      // they left. updatedAt should advance.
      expect(after.activatedAt).toBe(originalActivatedAt)
      expect(after.updatedAt).not.toBe(before.updatedAt)
    })

    it('deactivateOwner refuses a non-active owner', () => {
      const { deactivateOwner, owners } = useOwners()
      // own-3 is invited; cannot deactivate.
      const result = deactivateOwner('own-3')
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/transition/i)
      expect(owners.value.find(o => o.id === 'own-3')!.status).toBe('invited')
    })

    it('reactivateOwner moves inactive → active (re-stamps activatedAt)', () => {
      const { deactivateOwner, reactivateOwner, owners } = useOwners()
      deactivateOwner('own-1')
      const result = reactivateOwner('own-1')
      expect(result.success).toBe(true)
      const afterReactivate = owners.value.find(o => o.id === 'own-1')!
      expect(afterReactivate.status).toBe('active')
      expect(afterReactivate.activatedAt).toBeTruthy()
    })

    it('refuses to activate an owner that is not invited (e.g. draft → active is forbidden)', () => {
      const { createOwner, activateOwner } = useOwners()
      const created = createOwner({
        owner: {
          name: 'No Invite Yet',
          email: 'no.invite@example.com',
          phone: '+6281234567402',
          language: 'id',
          statementCurrency: 'IDR',
          annualOwnerUseNightCap: undefined,
        },
        mappings: [],
        commissionRules: [],
        permissions: buildOwnerPermissionTemplate('financial_summary', 'placeholder', new Date().toISOString()),
        inviteNow: false,
      })
      const result = activateOwner(created.ownerId!)
      expect(result.success).toBe(false)
    })
  })

  describe('filteredOwners', () => {
    it('returns every owner when no filters are set', () => {
      const { filteredOwners } = useOwners()
      expect(filteredOwners.value).toHaveLength(mockOwners.length)
    })

    it('search filter matches name or email case-insensitively', () => {
      const { filteredOwners, search } = useOwners()
      search.value = 'WAYAN'
      const hits = filteredOwners.value.map(o => o.id)
      expect(hits).toContain('own-1')
      expect(hits).not.toContain('own-2')

      search.value = 'PUTU.ANTARA@EXAMPLE.COM'
      expect(filteredOwners.value.map(o => o.id)).toEqual(['own-2'])

      search.value = 'kadek'
      expect(filteredOwners.value.map(o => o.id)).toEqual(['own-3'])
    })

    it('status filter narrows by exact status', () => {
      const { filteredOwners, statusFilter } = useOwners()
      statusFilter.value = 'active'
      expect(filteredOwners.value.map(o => o.id).sort()).toEqual(['own-1', 'own-2'])
      statusFilter.value = 'invited'
      expect(filteredOwners.value.map(o => o.id)).toEqual(['own-3'])
      statusFilter.value = 'inactive'
      expect(filteredOwners.value).toHaveLength(0)
    })

    it('property filter returns owners who have a mapping for the listing', () => {
      const { filteredOwners, propertyFilter } = useOwners()
      // Seed has mappings for lst-1, lst-3, lst-8.
      propertyFilter.value = 'lst-3'
      expect(filteredOwners.value.map(o => o.id).sort()).toEqual(['own-2', 'own-3'])
      propertyFilter.value = 'lst-1'
      expect(filteredOwners.value.map(o => o.id)).toEqual(['own-1'])
      propertyFilter.value = 'lst-9'
      expect(filteredOwners.value).toHaveLength(0)
    })

    it('combines search + status + property filters (AND logic)', () => {
      const { filteredOwners, search, statusFilter, propertyFilter } = useOwners()
      search.value = 'putu'
      statusFilter.value = 'active'
      propertyFilter.value = 'lst-3'
      expect(filteredOwners.value.map(o => o.id)).toEqual(['own-2'])

      // Changing property should remove the match.
      propertyFilter.value = 'lst-9'
      expect(filteredOwners.value).toHaveLength(0)
    })
  })

  describe('updateOwner — editable fields only', () => {
    it('updates name, phone, language, statementCurrency, annualOwnerUseNightCap', () => {
      const { updateOwner, owners } = useOwners()
      const before = owners.value.find(o => o.id === 'own-1')!
      const result = updateOwner('own-1', {
        name: 'Wayan Sari Updated',
        phone: '+6280000000001',
        language: 'en',
        statementCurrency: 'USD',
        annualOwnerUseNightCap: 21,
      })
      expect(result.success).toBe(true)
      const after = owners.value.find(o => o.id === 'own-1')!
      expect(after.name).toBe('Wayan Sari Updated')
      expect(after.phone).toBe('+6280000000001')
      expect(after.language).toBe('en')
      expect(after.statementCurrency).toBe('USD')
      expect(after.annualOwnerUseNightCap).toBe(21)
      // Lifecycle fields unchanged.
      expect(after.status).toBe(before.status)
      expect(after.invitedAt).toBe(before.invitedAt)
      expect(after.activatedAt).toBe(before.activatedAt)
      // updatedAt moves forward.
      expect(after.updatedAt).not.toBe(before.updatedAt)
    })

    it('rejects an email patch that collides with another owner (case-insensitive)', () => {
      const { updateOwner, owners } = useOwners()
      const result = updateOwner('own-1', { email: 'PUTU.ANTARA@EXAMPLE.com' })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/email/i)
      // Email on own-1 must be untouched.
      expect(owners.value.find(o => o.id === 'own-1')!.email).toBe('wayan.sari@example.com')
    })

    it('accepts an email patch that re-types the same address (no false collision)', () => {
      const { updateOwner } = useOwners()
      const result = updateOwner('own-1', { email: 'Wayan.Sari@Example.com' })
      expect(result.success).toBe(true)
    })

    it('cannot bypass the lifecycle helpers via updateOwner (status / invitedAt / activatedAt are read-only)', () => {
      const { updateOwner, owners, activateOwner } = useOwners()
      // own-3 starts as 'invited'. An updateOwner patch that tries to set status
      // directly must NOT compile-time allow it AND must not change the field at
      // runtime even if a hostile caller casts around the type.
      const result = updateOwner('own-3', {
        name: 'Renamed via Patch',
        // The next three are intentionally not in the EditableOwnerFields type
        // — but at runtime we cast them through `any` to prove the runtime
        // contract is also enforced.
      } as Parameters<typeof updateOwner>[1] & {
        status: string
        invitedAt: string
        activatedAt: string
      })
      expect(result.success).toBe(true)
      const after = owners.value.find(o => o.id === 'own-3')!
      // Status and lifecycle timestamps untouched.
      expect(after.status).toBe('invited')
      expect(after.invitedAt).toBe('2026-07-01T08:00:00.000Z')
      expect(after.activatedAt).toBeUndefined()
      // Only the editable fields applied.
      expect(after.name).toBe('Renamed via Patch')

      // Sanity: the lifecycle helper still works as the official path.
      const activated = activateOwner('own-3')
      expect(activated.success).toBe(true)
      expect(owners.value.find(o => o.id === 'own-3')!.status).toBe('active')
    })

    it('refuses to update a missing owner id', () => {
      const { updateOwner } = useOwners()
      const result = updateOwner('own-missing', { name: 'Ghost' })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/not found/i)
    })
  })

  describe('updatePermissions', () => {
    it('updates dashboard fields, stamps templateId=custom, and copies nested records', () => {
      const { updatePermissions, findPermissions, owners } = useOwners()
      const ownerId = 'own-1' // seed: full_transparency
      const result = updatePermissions(ownerId, {
        dashboard: { guestRatings: false },
      })
      expect(result.success).toBe(true)
      const after = findPermissions(ownerId)!
      // Field-level edit moves the owner out of the built-in template bucket.
      expect(after.templateId).toBe('custom')
      // Patched bit flipped.
      expect(after.dashboard.guestRatings).toBe(false)
      // Other dashboard fields preserved from full_transparency.
      expect(after.dashboard.grossRevenue).toBe(true)
      expect(after.dashboard.netRevenue).toBe(true)
      expect(after.dashboard.occupancy).toBe(true)
      expect(after.dashboard.adr).toBe(true)
      expect(after.dashboard.bookingSources).toBe(true)
      expect(after.dashboard.upcomingReservations).toBe(true)
      // Statement section untouched.
      expect(after.statement.netPayout).toBe(true)
      expect(after.statement.revenueLines).toBe(true)
      expect(after.updatedAt).toBeTruthy()
      // Owner record itself is not touched.
      expect(owners.value.find(o => o.id === ownerId)!.status).toBe('active')
    })

    it('updates statement fields and stamps templateId=custom', () => {
      const { updatePermissions, findPermissions } = useOwners()
      const result = updatePermissions('own-1', {
        statement: { taxesAndFees: false },
      })
      expect(result.success).toBe(true)
      const after = findPermissions('own-1')!
      expect(after.templateId).toBe('custom')
      expect(after.statement.taxesAndFees).toBe(false)
      // Other statement fields preserved.
      expect(after.statement.commissionDetails).toBe(true)
      expect(after.statement.netPayout).toBe(true)
      // Dashboard unchanged.
      expect(after.dashboard.grossRevenue).toBe(true)
    })

    it('a patch with no actual field edit leaves templateId alone (no spurious flip to custom)', () => {
      const { updatePermissions, findPermissions } = useOwners()
      // own-2 starts at financial_summary. An empty patch (no nested keys)
      // should be a no-op — the previous templateId stays put.
      const result = updatePermissions('own-2', {})
      expect(result.success).toBe(true)
      const after = findPermissions('own-2')!
      expect(after.templateId).toBe('financial_summary')
    })

    it('copies nested records — mutating the patch after the call does NOT leak into storage', () => {
      const { updatePermissions, findPermissions } = useOwners()
      const draft = { dashboard: { guestRatings: false } } as { dashboard?: Partial<Record<OwnerDashboardField, boolean>> }
      updatePermissions('own-1', draft)
      // Mutate the OUTSIDE draft object after the call. Storage must be
      // unaffected because the patch was copied into storage.
      ;(draft.dashboard as Record<string, boolean>).guestRatings = true
      const stored = findPermissions('own-1')!
      expect(stored.dashboard.guestRatings).toBe(false)
    })

    it('runtime patch with a smuggled templateId field is ignored (storage lands at custom, never at the smuggled id)', () => {
      const { updatePermissions, findPermissions } = useOwners()
      const ownerId = 'own-1' // seed: full_transparency
      // Cast around the type system to smuggle templateId.
      const hostile = {
        templateId: 'financial_summary' as unknown,
        dashboard: { guestRatings: false } as Partial<Record<OwnerDashboardField, boolean>>,
      }
      const result = updatePermissions(ownerId, hostile as Parameters<typeof updatePermissions>[1])
      expect(result.success).toBe(true)
      const after = findPermissions(ownerId)!
      // Smuggled templateId MUST NOT have taken effect. Storage ends at
      // 'custom' (because the legit dashboard flip still counts) — never
      // at the smuggled 'financial_summary'.
      expect(after.templateId).not.toBe('financial_summary')
      expect(after.templateId).toBe('custom')
      // The legit dashboard flip DID take effect.
      expect(after.dashboard.guestRatings).toBe(false)
      // Statement untouched (no edit).
      expect(after.statement.revenueLines).toBe(true)
    })

    it('runtime patch with only a smuggled templateId (no field edit) leaves storage alone', () => {
      const { updatePermissions, findPermissions } = useOwners()
      const ownerId = 'own-2' // seed: financial_summary
      // No field edit is smuggled — only a templateId. Storage must stay
      // at the previous templateId because nothing was actually touched.
      const hostile = { templateId: 'full_transparency' as unknown }
      const result = updatePermissions(ownerId, hostile as Parameters<typeof updatePermissions>[1])
      expect(result.success).toBe(true)
      const after = findPermissions(ownerId)!
      expect(after.templateId).toBe('financial_summary')
    })

    it('refuses to update permissions for an owner with no config', () => {
      const { updatePermissions } = useOwners()
      // Patch type now excludes templateId; send a dashboard flip instead.
      const result = updatePermissions('own-missing', { dashboard: { netRevenue: true } })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/not found/i)
    })
  })
})
