/**
 * Who can see a saved view. `personal` views are visible to their creator only;
 * `public` views are visible to everyone in the tenant, but only the creator
 * can update, rename, delete or un-share them. Shared by every saved-views
 * store (Listings, Analytics, Review Hub analytics, GM dashboard).
 */
export type SavedViewVisibility = 'personal' | 'public'

export interface SavedViewOwnership {
  visibility: SavedViewVisibility
  /** User id of the creator (`user-1` etc.), `system` for a Default View. */
  createdBy: string
  /** Creator name snapshot, shown on public views from teammates. */
  createdByName: string
}

export interface ViewOwner {
  id: string
  name: string
}

export function ownershipFor(owner: ViewOwner, visibility: SavedViewVisibility): SavedViewOwnership {
  return { visibility, createdBy: owner.id, createdByName: owner.name }
}

/**
 * Views saved before visibility existed carry no `visibility` and a `createdBy`
 * that is missing or `current-user`: they become personal views of `owner`,
 * whoever loads them first in this browser.
 */
export function withOwnership<T extends object>(view: T & Partial<SavedViewOwnership>, owner: ViewOwner): T & SavedViewOwnership {
  const legacyOwner = !view.createdBy || view.createdBy === 'current-user'
  return {
    ...view,
    visibility: view.visibility ?? 'personal',
    createdBy: legacyOwner ? owner.id : view.createdBy!,
    createdByName: view.createdByName ?? (legacyOwner ? owner.name : 'Teammate'),
  }
}

export function isOwnView(view: { createdBy?: string, isDefault?: boolean }, userId: string): boolean {
  return !view.isDefault && view.createdBy === userId
}

export function isVisibleTo(view: { createdBy?: string, isDefault?: boolean, visibility?: SavedViewVisibility }, userId: string): boolean {
  return !!view.isDefault || view.visibility === 'public' || isOwnView(view, userId)
}

/** Toast copy for a visibility change, so every page says the same thing. */
export function visibilityToast(visibility: SavedViewVisibility): string {
  return visibility === 'public' ? 'View shared with your team.' : 'View is now personal.'
}
