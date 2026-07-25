// Owner Portal permission composable.
//
// Owners see a portal that exposes two surfaces — a dashboard (live numbers
// for the properties they own) and a monthly statement (per-booking revenue
// and expense breakdown). This composable decides *which* of those surfaces
// each owner can see by storing a per-owner `OwnerPermissionConfig` snapshot.
//
// Two built-in templates cover most cases:
//   - `full_transparency`  → every field visible
//   - `financial_summary` → only net revenue, occupancy, ADR (dashboard) and
//                            commission summary, net payout (statement)
//
// Staff can flip individual fields afterwards — that marks the owner as
// templateId='custom' so future template edits don't trample the override.
//
// ⚠️  Cross-composable invariant: this composable shares the
//     `'elev8-owner-permissions'` `useState` key with `useOwners`. Both
//     initializers call the same `normalizePermissionsSeed(...)` from the
//     data layer (`~/components/owners/data/owner-permissions`), so whichever
//     composable runs first seeds storage with strict canonical configs.
//     Init-order drift is impossible.
//
// ⚠️  Single canonical template source: `ownerPermissionTemplates` in the
//     data layer. `applyTemplate` resolves templates from THIS array via
//     `buildOwnerPermissionConfig`. Any drift between normalization and
//     `applyTemplate` is impossible because they share the same helper.
//
// ⚠️  Snapshot semantics: `structuredClone` is used wherever we copy a
//     template's dashboard/statement records. Mutating the source template
//     array later has no effect on already-saved owner configs.

import type {
  OwnerDashboardField,
  OwnerPermissionConfig,
  OwnerPermissionTemplateId,
  OwnerStatementField,
} from '~/components/owners/data/owner-permissions'
import {
  buildOwnerPermissionConfig,
  mockOwnerPermissions,
  normalizePermissionsSeed,
} from '~/components/owners/data/owner-permissions'

// Re-export the domain types + seed so downstream consumers (UI tables,
// settings sheets) don't have to reach into `~/components/owners/data/...`.
export type {
  OwnerDashboardField,
  OwnerPermissionConfig,
  OwnerPermissionTemplateId,
  OwnerStatementField,
} from '~/components/owners/data/owner-permissions'
export { mockOwnerPermissions, normalizePermissionsSeed } from '~/components/owners/data/owner-permissions'

// --- Patch types -----------------------------------------------------------

/**
 * Patch shape for field-level updates. `templateId` is deliberately NOT
 * patchable here — switching between built-in templates must go through
 * `applyTemplate`, which is the one path that re-derives `dashboard` and
 * `statement` from the canonical source. Patching `templateId` here would
 * let a caller mark an owner as `'full_transparency'` while the stored
 * fields still reflect `'financial_summary'` (or `'custom'`), creating an
 * unsafe mismatch the UI would then render literally.
 */
export interface UpdatePermissionsPatch {
  dashboard?: Partial<Record<OwnerDashboardField, boolean>>
  statement?: Partial<Record<OwnerStatementField, boolean>>
}

export interface MutationResult {
  success: boolean
  error?: string
}

// --- Composable ------------------------------------------------------------

export function useOwnerPermissions() {
  /**
   * Shared state key — intentionally matches `useOwners` so the two
   * composables read from the same backing store. Either one can read,
   * either one can write, and a config update done here surfaces in
   * `useOwners().permissions.value` immediately.
   *
   * The initializer feeds `mockOwnerPermissions` through the data-layer
   * `normalizePermissionsSeed`, so even if `useOwners` ran first and
   * won the init race, storage already reflects the strict canonical
   * templates — NOT the looser data-layer seed.
   */
  const configs = useState<OwnerPermissionConfig[]>(
    'elev8-owner-permissions',
    () => normalizePermissionsSeed(mockOwnerPermissions),
  )

  function nowIso(): string {
    return new Date().toISOString()
  }

  function findPermission(ownerId: string): OwnerPermissionConfig | undefined {
    return configs.value.find((item: OwnerPermissionConfig) => item.ownerId === ownerId)
  }

  /**
   * Apply a built-in template to an owner. Delegates to the data-layer
   * `buildOwnerPermissionConfig`, so the dashboard/statement records are
   * produced by exactly the same code path the seed normalizer uses.
   * `structuredClone` inside the helper guarantees storage is
   * independent of the source template.
   *
   * `templateId === 'custom'` is rejected: there is no "custom" template
   * to apply. To create an owner that diverges from a built-in template,
   * start from `full_transparency` (or `financial_summary`) and call
   * `updateDashboardField` / `updateStatementField` afterwards.
   */
  function applyTemplate(
    ownerId: string,
    templateId: OwnerPermissionTemplateId,
  ): OwnerPermissionConfig {
    if (templateId === 'custom') {
      throw new Error(
        'Cannot apply the "custom" template — start from full_transparency or financial_summary and customize via updateDashboardField / updateStatementField.',
      )
    }
    const next = buildOwnerPermissionConfig(templateId, ownerId, nowIso())
    configs.value = [
      ...configs.value.filter((item: OwnerPermissionConfig) => item.ownerId !== ownerId),
      next,
    ]
    // Return a fresh clone so the caller can read/mutate the result without
    // leaking writes back into storage (storage now owns `next`).
    return structuredClone(next)
  }

  function canViewDashboardField(ownerId: string, field: OwnerDashboardField): boolean {
    return findPermission(ownerId)?.dashboard[field] ?? false
  }

  function canViewStatementField(ownerId: string, field: OwnerStatementField): boolean {
    return findPermission(ownerId)?.statement[field] ?? false
  }

  /**
   * Internal writer — looks the existing config up, asks the caller to
   * produce the next record, and replaces the row in `configs` via spread
   * (no in-place mutation, so Vue refs stay reactive).
   */
  function writeConfig(
    ownerId: string,
    next: (existing: OwnerPermissionConfig) => OwnerPermissionConfig,
  ): MutationResult {
    const existing = findPermission(ownerId)
    if (!existing) {
      return { success: false, error: 'Permission config not found for owner.' }
    }
    const updated = next(existing)
    configs.value = configs.value.map((item: OwnerPermissionConfig) =>
      (item.ownerId === ownerId ? updated : item),
    )
    return { success: true }
  }

  /**
   * Flip a single dashboard visibility bit. Marks `templateId` as `custom`
   * so future UI can show "this owner diverged from a built-in".
   */
  function updateDashboardField(
    ownerId: string,
    field: OwnerDashboardField,
    visible: boolean,
  ): MutationResult {
    return writeConfig(ownerId, existing => ({
      ...existing,
      dashboard: { ...existing.dashboard, [field]: visible },
      templateId: 'custom',
      updatedAt: nowIso(),
    }))
  }

  function updateStatementField(
    ownerId: string,
    field: OwnerStatementField,
    visible: boolean,
  ): MutationResult {
    return writeConfig(ownerId, existing => ({
      ...existing,
      statement: { ...existing.statement, [field]: visible },
      templateId: 'custom',
      updatedAt: nowIso(),
    }))
  }

  /**
   * Patch the whole config at once. Nested dashboard/statement records are
   * spread into a new object* so the caller's patch is never aliased into
   * storage — mutating `patch.dashboard` after the call returns will NOT
   * change the persisted visibility bits.
   *
   * Deliberately does NOT accept `templateId` — see `UpdatePermissionsPatch`.
   * Any field flip moves the owner to `'custom'` because the field set no
   * longer matches a built-in template.
   */
  function updatePermissions(ownerId: string, patch: UpdatePermissionsPatch): MutationResult {
    return writeConfig(ownerId, (existing) => {
      const dashboard = patch.dashboard
        ? { ...existing.dashboard, ...patch.dashboard }
        : existing.dashboard
      const statement = patch.statement
        ? { ...existing.statement, ...patch.statement }
        : existing.statement
      const touchedFields = patch.dashboard !== undefined || patch.statement !== undefined
      const templateId: OwnerPermissionTemplateId = touchedFields ? 'custom' : existing.templateId
      return {
        ...existing,
        templateId,
        dashboard,
        statement,
        updatedAt: nowIso(),
      }
    })
  }

  return {
    configs,
    applyTemplate,
    canViewDashboardField,
    canViewStatementField,
    updateDashboardField,
    updateStatementField,
    updatePermissions,
    findPermission,
  }
}
