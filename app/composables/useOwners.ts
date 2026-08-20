import type { CommissionRule, CommissionRuleDraft } from '~/components/owners/data/commission-rules'
import type { OwnerPermissionConfig } from '~/components/owners/data/owner-permissions'
import type {
  Owner,
  OwnerPropertyMapping,
  OwnerStatus,
} from '~/components/owners/data/owners'
import { computed } from 'vue'
import { mockCommissionRules } from '~/components/owners/data/commission-rules'
import { mockOwnerPermissions, normalizePermissionsSeed } from '~/components/owners/data/owner-permissions'
import { mockOwnerPropertyMappings, mockOwners } from '~/components/owners/data/owners'

// Re-export the value namespaces so consumers can `import { mockOwners } from
// '~/composables/useOwners'` without reaching into the data layer directly.
export { mockCommissionRules } from '~/components/owners/data/commission-rules'
export type { CommissionRule, CommissionRuleDraft, CommissionTier } from '~/components/owners/data/commission-rules'
export type {
  OwnerDashboardField,
  OwnerPermissionConfig,
  OwnerPermissionTemplateId,
  OwnerStatementField,
} from '~/components/owners/data/owner-permissions'
export { mockOwnerPermissions } from '~/components/owners/data/owner-permissions'
export type {
  Owner,
  OwnerLanguage,
  OwnerMagicLinkStatus,
  OwnerPropertyMapping,
  OwnerStatus,
  StatementCurrency,
} from '~/components/owners/data/owners'
export { mockOwnerPropertyMappings, mockOwners } from '~/components/owners/data/owners'

export type {
  OwnerStay,
  OwnerStayApproval,
  OwnerStayCancelRequest,
  OwnerStayCleaningTaskIds,
  OwnerStaySource,
  OwnerStayStatus,
} from '~/components/owners/data/owner-stays'
export {
  CANCEL_CUTOFF_HOURS,
  mockOwnerStays,
  ownerStayStatusLabels,
} from '~/components/owners/data/owner-stays'

/**
 * Input shape for the owner onboarding save form.
 *
 * `owner` carries the editable owner fields; `mappings`, `commissionRules`,
 * and `permissions` are the join rows that are paired with the new owner in
 * one transaction. `inviteNow` decides whether the owner is created in `draft`
 * or immediately transitioned to `invited`.
 */
export interface SaveOwnerInput {
  owner: Omit<Owner, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  mappings: Omit<OwnerPropertyMapping, 'id' | 'ownerId' | 'commissionRuleId'>[]
  commissionRules: CommissionRuleDraft[]
  permissions: OwnerPermissionConfig
  inviteNow: boolean
}

let ownerIdCounter = 0
function generateOwnerId(): string {
  ownerIdCounter += 1
  return `own-${Date.now().toString(36)}-${ownerIdCounter.toString(36)}`
}

let mappingIdCounter = 0
function generateMappingId(): string {
  mappingIdCounter += 1
  return `opm-new-${mappingIdCounter.toString(36)}`
}

let ruleIdCounter = 0
function generateRuleId(): string {
  ruleIdCounter += 1
  return `cr-new-${ruleIdCounter.toString(36)}`
}

export function useOwners() {
  const owners = useState<Owner[]>('elev8-tenant-owners', () => structuredClone(mockOwners))
  const mappings = useState<OwnerPropertyMapping[]>(
    'elev8-owner-property-mappings',
    () => structuredClone(mockOwnerPropertyMappings),
  )
  const commissionRules = useState<CommissionRule[]>(
    'elev8-owner-commission-rules',
    () => structuredClone(mockCommissionRules),
  )
  const permissions = useState<OwnerPermissionConfig[]>(
    'elev8-owner-permissions',
    () => normalizePermissionsSeed(mockOwnerPermissions),
  )

  const search = useState<string>('elev8-owner-search', () => '')
  const statusFilter = useState<OwnerStatus | 'all'>('elev8-owner-status-filter', () => 'all')
  const propertyFilter = useState<string>('elev8-owner-property-filter', () => 'all')

  /**
   * Check whether adding (or updating) a mapping would keep total ownership
   * for the (listingId, unitId) scope at or below 100%.
   *
   * @param mapping Draft mapping without an `id`.
   * @param excludeMappingId Optional existing mapping id to skip (used when editing).
   */
  function validateOwnership(
    mapping: Omit<OwnerPropertyMapping, 'id'>,
    excludeMappingId?: string,
  ): { valid: boolean, allocated: number } {
    const allocated = mappings.value
      .filter(item =>
        item.listingId === mapping.listingId
        && item.unitId === mapping.unitId
        && item.id !== excludeMappingId,
      )
      .reduce((sum, item) => sum + item.ownershipPercentage, 0)
    return {
      valid: allocated + mapping.ownershipPercentage <= 100,
      allocated,
    }
  }

  function nowIso(): string {
    return new Date().toISOString()
  }

  /**
   * Create a new owner along with their mappings, commission rules, and
   * permission config. Rejects case-insensitive email duplicates.
   *
   * Status is set to `invited` when `inviteNow` is true, otherwise `draft`.
   *
   * Ownership is validated in two passes:
   *  1. The batch must not cumulatively exceed 100% on any single (listingId,
   *     unitId) scope on its own (two 60% rows for the same scope = 120%).
   *  2. The batch + every existing mapping on the same scope must also stay
   *     ≤ 100% (existing 100% + new 1% = 101%).
   */
  function createOwner(input: SaveOwnerInput): { success: boolean, error?: string, ownerId?: string } {
    const normalizedEmail = input.owner.email.trim().toLowerCase()
    if (!normalizedEmail) {
      return { success: false, error: 'Email is required.' }
    }
    const emailTaken = owners.value.some(
      owner => owner.email.trim().toLowerCase() === normalizedEmail,
    )
    if (emailTaken) {
      return { success: false, error: 'An owner with this email already exists.' }
    }

    // Pass 1 — batch itself must not cumulatively exceed 100% on a single scope.
    const batchTotals = new Map<string, number>()
    for (const draft of input.mappings) {
      const key = `${draft.listingId}::${draft.unitId ?? ''}`
      const next = (batchTotals.get(key) ?? 0) + draft.ownershipPercentage
      if (next > 100) {
        const scopeLabel = draft.unitId
          ? `listing ${draft.listingId} unit ${draft.unitId}`
          : `listing ${draft.listingId}`
        return {
          success: false,
          error: `Ownership for ${scopeLabel} would exceed 100% in the same batch (cumulative ${next}%).`,
        }
      }
      batchTotals.set(key, next)
    }

    // Pass 2 — combined with existing stored mappings on the same scope.
    for (const [key, batchTotal] of batchTotals) {
      const [listingId, unitId] = key.split('::') as [string, string]
      const existingTotal = mappings.value
        .filter(item => item.listingId === listingId && (item.unitId ?? '') === unitId)
        .reduce((sum, item) => sum + item.ownershipPercentage, 0)
      if (existingTotal + batchTotal > 100) {
        const scopeLabel = unitId
          ? `listing ${listingId} unit ${unitId}`
          : `listing ${listingId}`
        return {
          success: false,
          error: `Ownership for ${scopeLabel} would exceed 100% (existing ${existingTotal}% + batch ${batchTotal}%).`,
        }
      }
    }

    const ownerId = generateOwnerId()
    const timestamp = nowIso()
    const status: OwnerStatus = input.inviteNow ? 'invited' : 'draft'
    const newOwner: Owner = {
      ...input.owner,
      id: ownerId,
      status,
      invitedAt: input.inviteNow ? timestamp : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    owners.value = [...owners.value, newOwner]

    const newRules: CommissionRule[] = input.mappings.map((draft, index) => {
      const configured = input.commissionRules[index]
      if (!configured) {
        return {
          id: generateRuleId(),
          ownerId,
          name: 'Custom management rule',
          type: 'flat' as const,
          rate: 0,
          listingId: draft.listingId,
          effectiveFrom: new Date().toISOString().slice(0, 10),
        } satisfies CommissionRule
      }
      return {
        ...configured,
        id: generateRuleId(),
        ownerId,
      } satisfies CommissionRule
    })
    if (newRules.length > 0)
      commissionRules.value = [...commissionRules.value, ...newRules]

    if (input.mappings.length > 0) {
      const newMappings: OwnerPropertyMapping[] = input.mappings.map((draft, index) => ({
        ...draft,
        id: generateMappingId(),
        ownerId,
        commissionRuleId: newRules[index]!.id,
      }))
      mappings.value = [...mappings.value, ...newMappings]
    }

    // Permissions are keyed by ownerId; replace the placeholder draft that
    // came in from the dialog so it points at the freshly minted ownerId.
    const newPermissions = permissions.value.filter(p => p.ownerId !== input.permissions.ownerId)
    newPermissions.push({ ...input.permissions, ownerId })
    permissions.value = newPermissions

    return { success: true, ownerId }
  }

  /**
   * Editable owner fields — lifecycle fields (`status`, `invitedAt`,
   * `activatedAt`) and immutable fields (`id`, `createdAt`, `updatedAt`)
   * are deliberately excluded so the lifecycle helpers
   * (`inviteOwner`/`activateOwner`/`deactivateOwner`/`reactivateOwner`)
   * cannot be bypassed by a stray `updateOwner` call.
   */
  type EditableOwnerFields = Omit<Owner, 'id' | 'status' | 'invitedAt' | 'activatedAt' | 'createdAt' | 'updatedAt'>

  function updateOwner(ownerId: string, patch: Partial<EditableOwnerFields>): { success: boolean, error?: string } {
    const owner = owners.value.find(o => o.id === ownerId)
    if (!owner) {
      return { success: false, error: 'Owner not found.' }
    }
    // Re-validate email uniqueness if it changed.
    if (patch.email && patch.email.trim().toLowerCase() !== owner.email.trim().toLowerCase()) {
      const normalizedEmail = patch.email.trim().toLowerCase()
      const emailTaken = owners.value.some(
        o => o.id !== ownerId && o.email.trim().toLowerCase() === normalizedEmail,
      )
      if (emailTaken) {
        return { success: false, error: 'An owner with this email already exists.' }
      }
    }
    const updated: Owner = {
      ...owner,
      ...patch,
      updatedAt: nowIso(),
    }
    owners.value = owners.value.map(o => o.id === ownerId ? updated : o)
    return { success: true }
  }

  /**
   * Transition helper — stamps status + the matching timestamp, refuses
   * transitions that aren't allowed from the current status.
   */
  function transitionStatus(
    ownerId: string,
    nextStatus: OwnerStatus,
    allowedFrom: OwnerStatus[],
    timestampField: 'invitedAt' | 'activatedAt',
  ): { success: boolean, error?: string } {
    const owner = owners.value.find(o => o.id === ownerId)
    if (!owner) {
      return { success: false, error: 'Owner not found.' }
    }
    if (!allowedFrom.includes(owner.status)) {
      return {
        success: false,
        error: `Cannot transition owner from ${owner.status} to ${nextStatus}.`,
      }
    }
    const timestamp = nowIso()
    const patched: Owner = {
      ...owner,
      status: nextStatus,
      [timestampField]: timestamp,
      updatedAt: timestamp,
    }
    owners.value = owners.value.map(o => o.id === ownerId ? patched : o)
    return { success: true }
  }

  function inviteOwner(ownerId: string) {
    return transitionStatus(ownerId, 'invited', ['draft'], 'invitedAt')
  }

  function activateOwner(ownerId: string) {
    return transitionStatus(ownerId, 'active', ['invited'], 'activatedAt')
  }

  /**
   * Deactivation intentionally does NOT touch `activatedAt` — the timestamp
   * records when the owner became active, and deactivating them does not
   * erase their history. The `Owner` domain does not carry a separate
   * `deactivatedAt` field, so we only flip `status` and refresh `updatedAt`.
   */
  function deactivateOwner(ownerId: string): { success: boolean, error?: string } {
    const owner = owners.value.find(o => o.id === ownerId)
    if (!owner) {
      return { success: false, error: 'Owner not found.' }
    }
    if (owner.status !== 'active') {
      return {
        success: false,
        error: `Cannot transition owner from ${owner.status} to inactive.`,
      }
    }
    const patched: Owner = {
      ...owner,
      status: 'inactive',
      updatedAt: nowIso(),
    }
    owners.value = owners.value.map(o => o.id === ownerId ? patched : o)
    return { success: true }
  }

  function reactivateOwner(ownerId: string): { success: boolean, error?: string } {
    return transitionStatus(ownerId, 'active', ['inactive'], 'activatedAt')
  }

  function addMapping(input: Omit<OwnerPropertyMapping, 'id'>): { success: boolean, error?: string, mappingId?: string } {
    const check = validateOwnership(input)
    if (!check.valid) {
      return {
        success: false,
        error: `Ownership for listing ${input.listingId} would exceed 100% (already ${check.allocated}%).`,
      }
    }
    const mappingId = generateMappingId()
    const newMapping: OwnerPropertyMapping = { ...input, id: mappingId }
    mappings.value = [...mappings.value, newMapping]
    return { success: true, mappingId }
  }

  function updateMapping(mappingId: string, patch: Partial<Omit<OwnerPropertyMapping, 'id' | 'ownerId'>>): { success: boolean, error?: string } {
    const mapping = mappings.value.find(m => m.id === mappingId)
    if (!mapping) {
      return { success: false, error: 'Mapping not found.' }
    }
    const next: OwnerPropertyMapping = { ...mapping, ...patch }
    // Revalidate whenever the (listingId, unitId) scope moves or the
    // ownership percentage changes. Moving a saturated mapping into an
    // already-100% scope would otherwise sneak past the guard.
    const scopeChanged = (patch.listingId !== undefined && patch.listingId !== mapping.listingId)
      || (patch.unitId !== undefined && patch.unitId !== mapping.unitId)
    if (patch.ownershipPercentage !== undefined || scopeChanged) {
      const check = validateOwnership(next, mappingId)
      if (!check.valid) {
        const scopeLabel = mapping.unitId
          ? `listing ${mapping.listingId} unit ${mapping.unitId}`
          : `listing ${mapping.listingId}`
        return {
          success: false,
          error: `Ownership for ${scopeLabel} would exceed 100% (already ${check.allocated}%).`,
        }
      }
    }
    mappings.value = mappings.value.map(m => m.id === mappingId ? next : m)
    return { success: true }
  }

  function removeMapping(mappingId: string): { success: boolean, error?: string } {
    const mapping = mappings.value.find(m => m.id === mappingId)
    if (!mapping) {
      return { success: false, error: 'Mapping not found.' }
    }
    mappings.value = mappings.value.filter(m => m.id !== mappingId)
    return { success: true }
  }

  // Lookups ----------------------------------------------------------------

  const listingsForOwner = computed(() => {
    return (ownerId: string) =>
      mappings.value.filter(m => m.ownerId === ownerId)
  })

  const ownersForListing = computed(() => {
    return (listingId: string) =>
      mappings.value.filter(m => m.listingId === listingId)
  })

  function byId(ownerId: string): Owner | undefined {
    return owners.value.find(o => o.id === ownerId)
  }

  function findPermissions(ownerId: string): OwnerPermissionConfig | undefined {
    return permissions.value.find(p => p.ownerId === ownerId)
  }

  /**
   * Patch shape for `updatePermissions`. `templateId` is deliberately NOT
   * patchable here — switching between built-in templates must go through
   * `applyTemplate` (the one path that re-derives `dashboard` and
   * `statement` from the canonical source). Patching `templateId` here
   * would let a caller mark an owner as `'full_transparency'` while the
   * stored fields still reflect `'financial_summary'` (or vice-versa),
   * creating an unsafe mismatch the UI would then render literally.
   */
  function updatePermissions(
    ownerId: string,
    patch: {
      dashboard?: Partial<Record<OwnerDashboardField, boolean>>
      statement?: Partial<Record<OwnerStatementField, boolean>>
    },
  ): { success: boolean, error?: string } {
    const existing = findPermissions(ownerId)
    if (!existing) {
      return { success: false, error: 'Permission config not found for owner.' }
    }
    const touchedDashboard = patch.dashboard !== undefined
    const touchedStatement = patch.statement !== undefined
    // Copy nested records into a fresh object so post-call mutation of
    // `patch.dashboard` cannot leak into storage.
    const dashboard = touchedDashboard
      ? { ...existing.dashboard, ...patch.dashboard }
      : existing.dashboard
    const statement = touchedStatement
      ? { ...existing.statement, ...patch.statement }
      : existing.statement
    // Field-level edits always flip the owner to `'custom'`. Even when a
    // hostile caller smuggles in a `templateId` field via `as any`, we
    // ignore it here: storage's templateId either stays at the previous
    // built-in id (no field edit) or moves to `'custom'` (one or more
    // fields were touched). Built-in ids are never re-applied through
    // this entry point.
    const templateId: OwnerPermissionTemplateId = (touchedDashboard || touchedStatement)
      ? 'custom'
      : existing.templateId
    const updated: OwnerPermissionConfig = {
      ...existing,
      ownerId,
      templateId,
      dashboard,
      statement,
      updatedAt: nowIso(),
    }
    permissions.value = permissions.value.map(p => p.ownerId === ownerId ? updated : p)
    return { success: true }
  }

  function rulesForOwner(ownerId: string): CommissionRule[] {
    return commissionRules.value.filter(r => r.ownerId === ownerId)
  }

  // Filters ----------------------------------------------------------------

  const filteredOwners = computed(() => {
    const searchNeedle = search.value.trim().toLowerCase()
    const listingIdsForOwner = new Map<string, Set<string>>()
    for (const m of mappings.value) {
      if (!listingIdsForOwner.has(m.ownerId))
        listingIdsForOwner.set(m.ownerId, new Set())
      listingIdsForOwner.get(m.ownerId)!.add(m.listingId)
    }

    return owners.value.filter((owner) => {
      if (statusFilter.value !== 'all' && owner.status !== statusFilter.value) {
        return false
      }
      if (propertyFilter.value !== 'all') {
        const listings = listingIdsForOwner.get(owner.id)
        if (!listings || !listings.has(propertyFilter.value)) {
          return false
        }
      }
      if (searchNeedle) {
        const haystack = `${owner.name} ${owner.email}`.toLowerCase()
        if (!haystack.includes(searchNeedle)) {
          return false
        }
      }
      return true
    })
  })

  return {
    owners,
    mappings,
    commissionRules,
    permissions,
    search,
    statusFilter,
    propertyFilter,
    validateOwnership,
    createOwner,
    updateOwner,
    inviteOwner,
    activateOwner,
    deactivateOwner,
    reactivateOwner,
    addMapping,
    updateMapping,
    removeMapping,
    updatePermissions,
    findPermissions,
    rulesForOwner,
    listingsForOwner,
    ownersForListing,
    byId,
    filteredOwners,
  }
}
