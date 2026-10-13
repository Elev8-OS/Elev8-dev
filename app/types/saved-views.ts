/**
 * Who can see a saved view. `personal` views are visible to their creator only;
 * `public` views are visible to everyone in the tenant, but only the creator
 * can update, rename, delete or un-share them.
 */
export type SavedViewVisibility = 'personal' | 'public'

export interface SavedView {
  id: string
  name: string
  searchValue: string
  activeTagFilter: string[]
  activeAiFilter: string | null
  columnVisibility: Record<string, boolean>
  pageSize: number
  visibility: SavedViewVisibility
  /** User id of the creator (`user-1` etc.), `system` for the Default View. */
  createdBy: string
  /** Creator name snapshot, shown on public views from teammates. */
  createdByName: string
  createdAt: string
  updatedAt: string
  isDefault?: boolean // Marks Default view as immutable
}

export interface ViewState {
  searchValue: string
  activeTagFilter: string[]
  activeAiFilter: string | null
  columnVisibility: Record<string, boolean>
  pageSize: number
}

export const DEFAULT_VIEW: SavedView = {
  id: 'default',
  name: 'Default View',
  searchValue: '',
  activeTagFilter: [],
  activeAiFilter: null,
  columnVisibility: {
    amenities: false,
    room: false,
  },
  pageSize: 15,
  visibility: 'public',
  createdBy: 'system',
  createdByName: 'System',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isDefault: true,
}

/**
 * Public views teammates already shared, written to storage the first time
 * the store is empty so the "Shared by team" group has something in it.
 */
export const SEED_PUBLIC_VIEWS: SavedView[] = [
  {
    id: 'seed-canggu-pool',
    name: 'Canggu pool villas',
    searchValue: '',
    activeTagFilter: ['Canggu', 'Pool'],
    activeAiFilter: null,
    columnVisibility: { amenities: false, room: false },
    pageSize: 15,
    visibility: 'public',
    createdBy: 'user-2',
    createdByName: 'Made Surya',
    createdAt: '2026-09-02T02:00:00.000Z',
    updatedAt: '2026-09-02T02:00:00.000Z',
  },
  {
    id: 'seed-ai-paused',
    name: 'ElevAI paused',
    searchValue: '',
    activeTagFilter: [],
    activeAiFilter: 'paused',
    columnVisibility: { amenities: false, room: false },
    pageSize: 15,
    visibility: 'public',
    createdBy: 'user-5',
    createdByName: 'Made Wirawan',
    createdAt: '2026-08-20T03:30:00.000Z',
    updatedAt: '2026-08-20T03:30:00.000Z',
  },
]
