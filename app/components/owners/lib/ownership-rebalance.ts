// Pure ownership rebalancing helpers for the owner onboarding flow.
//
// Ownership is validated per (listingId, unitId) scope: existing stored
// mappings keep their share, and the draft rows for a scope share the
// remaining budget (`100 - existing total`). Editing one draft row
// redistributes the leftover proportionally across its sibling rows so the
// scope total stays at 100%.

export interface OwnershipMappingLike {
  listingId: string
  unitId?: string
  ownershipPercentage: number
}

export interface RebalanceRow {
  mapping: OwnershipMappingLike
}

function scopeKey(listingId: string, unitId: string | undefined): string {
  return `${listingId}::${unitId ?? ''}`
}

/**
 * Remaining ownership share for a (listingId, unitId) scope after existing
 * mappings and the other rows in the current draft. Returns null when the
 * scope is already fully allocated (or over-allocated), meaning nothing left
 * to auto-fill.
 */
export function remainingShare(
  existingMappings: OwnershipMappingLike[],
  rows: RebalanceRow[],
  listingId: string,
  unitId: string | undefined,
  excludeIndex?: number,
): number | null {
  const key = scopeKey(listingId, unitId)
  const existingTotal = existingMappings
    .filter(m => scopeKey(m.listingId, m.unitId) === key)
    .reduce((sum, m) => sum + m.ownershipPercentage, 0)
  const draftTotal = rows.reduce((sum, m, i) => {
    if (i === excludeIndex || scopeKey(m.mapping.listingId, m.mapping.unitId) !== key)
      return sum
    return sum + (m.mapping.ownershipPercentage ?? 0)
  }, 0)
  const remaining = 100 - existingTotal - draftTotal
  return remaining > 0 ? remaining : null
}

/**
 * Rebalance the sibling draft rows that share the same (listingId, unitId)
 * scope so the scope's total stays at 100% after the row at `changedIndex`
 * was edited.
 *
 * The scope budget is `100 - existingTotal` (existing owners keep their
 * share). The edited row takes `newValue` of that budget; the remainder is
 * redistributed proportionally across the other draft rows in the same scope
 * based on their previous values. When the changed row over-allocates (e.g.
 * 100 on an already-100% scope), siblings fall to 0.
 */
export function rebalanceSiblings<T extends RebalanceRow>(
  existingMappings: OwnershipMappingLike[],
  rows: T[],
  changedIndex: number,
  newValue: number,
): T[] {
  const changed = rows[changedIndex]
  if (!changed)
    return rows
  const { listingId, unitId } = changed.mapping
  const key = scopeKey(listingId, unitId)

  const existingTotal = existingMappings
    .filter(m => scopeKey(m.listingId, m.unitId) === key)
    .reduce((sum, m) => sum + m.ownershipPercentage, 0)
  const budget = 100 - existingTotal

  const siblings = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row, i }) =>
      i !== changedIndex
      && scopeKey(row.mapping.listingId, row.mapping.unitId) === key)

  const previousSum = siblings.reduce((sum, { row }) => sum + (row.mapping.ownershipPercentage ?? 0), 0)
  const remaining = Math.max(0, budget - newValue)

  return rows.map((row, i) => {
    if (i === changedIndex)
      return row
    const sibling = siblings.find(s => s.i === i)
    if (!sibling)
      return row
    const previous = sibling.row.mapping.ownershipPercentage ?? 0
    const share = previousSum > 0 ? (previous / previousSum) * remaining : 0
    const rounded = Math.min(100, Math.max(0, Math.round(share * 2) / 2))
    return {
      ...row,
      mapping: {
        ...row.mapping,
        ownershipPercentage: rounded,
      },
    } as T
  })
}
