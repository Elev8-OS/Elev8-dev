import type { AnalyticsFilters } from '~/composables/useAnalytics'
import type { SavedViewOwnership, SavedViewVisibility } from '~/lib/saved-view-ownership'
import { toast } from 'vue-sonner'
import { defaultAnalyticsFilters, useAnalytics } from '~/composables/useAnalytics'
import { useSavedViewOwner } from '~/composables/useSavedViewOwner'
import { isOwnView, isVisibleTo, ownershipFor, visibilityToast, withOwnership } from '~/lib/saved-view-ownership'

/**
 * A named snapshot of every Analytics filter. Presets are stored as presets,
 * so "Last 30 days" keeps rolling; only a custom range is stored as dates.
 */
export interface AnalyticsSavedView extends SavedViewOwnership {
  id: string
  name: string
  filters: AnalyticsFilters
  isDefault?: boolean
  createdAt: string
  updatedAt: string
}

const VIEWS_KEY = 'elev8-analytics-saved-views'
const ACTIVE_KEY = 'elev8-analytics-active-view'
export const DEFAULT_VIEW_ID = 'default'

export const DEFAULT_ANALYTICS_VIEW: AnalyticsSavedView = {
  id: DEFAULT_VIEW_ID,
  name: 'Default View',
  filters: defaultAnalyticsFilters(),
  isDefault: true,
  visibility: 'public',
  createdBy: 'system',
  createdByName: 'System',
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
}

/** Same filters regardless of the order values were picked in. */
export function sameFilters(a: AnalyticsFilters, b: AnalyticsFilters): boolean {
  const norm = (raw: AnalyticsFilters) => {
    const f = { ...defaultAnalyticsFilters(), ...raw }
    return JSON.stringify({
      ...f,
      includeRetired: [...f.includeRetired].sort(),
      regions: [...f.regions].sort(),
      listingIds: [...f.listingIds].sort(),
      tags: [...f.tags].sort(),
      channels: [...f.channels].sort(),
      countries: [...f.countries].sort(),
      customRange: f.period === 'custom' ? f.customRange : null,
    })
  }
  return norm(a) === norm(b)
}

/**
 * Deep copy, so editing the live filters never edits a stored view. Laid over
 * the defaults, so a view saved before a filter existed still loads.
 */
function snapshot(f: AnalyticsFilters): AnalyticsFilters {
  return { ...defaultAnalyticsFilters(), ...JSON.parse(JSON.stringify(f)) }
}

// Guard on `localStorage`, not `import.meta.client`: Vitest leaves the latter undefined.
function readStorage<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined')
    return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  }
  catch {
    return fallback
  }
}

function writeStorage(key: string, value: unknown) {
  if (typeof localStorage === 'undefined')
    return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  }
  catch {
    toast.error('Could not save the view in this browser.')
  }
}

export function useAnalyticsSavedViews() {
  const { filters } = useAnalytics()
  const { owner, currentUserId } = useSavedViewOwner()

  /**
   * Custom views of every user in this browser (it stands in for the server);
   * the Default View is never stored. `savedViews` is what this user may see.
   */
  const customViews = useState<AnalyticsSavedView[]>('analytics-saved-views', () => [])
  const activeViewId = useState<string>('analytics-active-view', () => DEFAULT_VIEW_ID)
  const pendingViewId = useState<string | null>('analytics-pending-view', () => null)
  const restored = useState('analytics-views-restored', () => false)

  const savedViews = computed(() => [
    DEFAULT_ANALYTICS_VIEW,
    ...customViews.value
      .filter(v => isVisibleTo(v, currentUserId.value))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  ])
  const activeView = computed(() => savedViews.value.find(v => v.id === activeViewId.value) ?? DEFAULT_ANALYTICS_VIEW)

  /** Only a custom view can be dirty; the Default View is a starting point, not a promise. */
  const isDirty = computed(() => !activeView.value.isDefault && !sameFilters(activeView.value.filters, filters.value))
  // A teammate's public view can be used and tweaked, but changes go into a new view.
  const canUpdateActiveView = computed(() => isDirty.value && isOwnView(activeView.value, currentUserId.value))

  /** The stored view if this user created it, else a toast saying who can change it. */
  function ownViewOrToast(id: string, action: string): AnalyticsSavedView | null {
    const view = customViews.value.find(v => v.id === id)
    if (!view)
      return null
    if (!isOwnView(view, currentUserId.value)) {
      toast.error(`Only ${view.createdByName} can ${action} this view.`)
      return null
    }
    return view
  }

  function persist() {
    writeStorage(VIEWS_KEY, customViews.value)
    writeStorage(ACTIVE_KEY, activeViewId.value)
  }

  /** Reads the stored views once per session and re-applies the last active one. */
  function restore() {
    if (restored.value)
      return
    restored.value = true
    customViews.value = readStorage<AnalyticsSavedView[]>(VIEWS_KEY, []).map(v => withOwnership(v, owner.value))
    const id = readStorage<string>(ACTIVE_KEY, DEFAULT_VIEW_ID)
    // A view since deleted, un-shared or owned by another user of this browser is skipped.
    const view = savedViews.value.find(v => v.id === id && !v.isDefault)
    if (view) {
      activeViewId.value = view.id
      filters.value = snapshot(view.filters)
    }
  }

  function nameTaken(name: string, exceptId?: string) {
    const key = name.trim().toLowerCase()
    return savedViews.value.some(v => v.id !== exceptId && v.name.toLowerCase() === key)
  }

  function apply(view: AnalyticsSavedView) {
    activeViewId.value = view.id
    filters.value = snapshot(view.filters)
    pendingViewId.value = null
    persist()
  }

  /** With unsaved edits on a custom view, asks first (the dropdown shows the prompt). */
  function loadView(id: string) {
    const view = savedViews.value.find(v => v.id === id)
    if (!view)
      return
    if (isDirty.value && id !== activeViewId.value) {
      pendingViewId.value = id
      return
    }
    apply(view)
  }

  function confirmLoadView() {
    const view = savedViews.value.find(v => v.id === pendingViewId.value)
    if (view)
      apply(view)
  }

  function cancelLoadView() {
    pendingViewId.value = null
  }

  function saveAs(name: string, visibility: SavedViewVisibility = 'personal') {
    if (nameTaken(name)) {
      toast.error('A view with this name already exists.')
      return
    }
    const now = new Date().toISOString()
    const view: AnalyticsSavedView = {
      id: `aview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      filters: snapshot(filters.value),
      ...ownershipFor(owner.value, visibility),
      createdAt: now,
      updatedAt: now,
    }
    customViews.value = [...customViews.value, view]
    activeViewId.value = view.id
    persist()
    toast.success(visibility === 'public' ? `View "${view.name}" saved and shared with your team` : `View "${view.name}" saved`)
  }

  function updateActiveView() {
    const id = activeViewId.value
    if (activeView.value.isDefault || !ownViewOrToast(id, 'update'))
      return
    customViews.value = customViews.value.map(v =>
      v.id === id ? { ...v, filters: snapshot(filters.value), updatedAt: new Date().toISOString() } : v)
    persist()
    toast.success(`View "${activeView.value.name}" updated`)
  }

  function renameView(id: string, name: string) {
    if (!ownViewOrToast(id, 'rename'))
      return
    if (nameTaken(name, id)) {
      toast.error('A view with this name already exists.')
      return
    }
    customViews.value = customViews.value.map(v =>
      v.id === id ? { ...v, name: name.trim(), updatedAt: new Date().toISOString() } : v)
    persist()
  }

  /** Deleting the active view keeps the filters on screen, now under the Default View. */
  function deleteView(id: string) {
    const view = ownViewOrToast(id, 'delete')
    if (!view)
      return
    customViews.value = customViews.value.filter(v => v.id !== id)
    if (activeViewId.value === id)
      activeViewId.value = DEFAULT_VIEW_ID
    persist()
    toast.info(`View "${view.name}" deleted`)
  }

  function setViewVisibility(id: string, visibility: SavedViewVisibility) {
    const view = ownViewOrToast(id, 'change who can see')
    if (!view || view.visibility === visibility)
      return
    customViews.value = customViews.value.map(v =>
      v.id === id ? { ...v, visibility, updatedAt: new Date().toISOString() } : v)
    persist()
    toast.success(visibilityToast(visibility))
  }

  function resetToDefault() {
    apply(DEFAULT_ANALYTICS_VIEW)
  }

  return {
    savedViews,
    activeView,
    isDirty,
    canUpdateActiveView,
    pendingViewId,
    restore,
    loadView,
    confirmLoadView,
    cancelLoadView,
    saveAs,
    updateActiveView,
    renameView,
    deleteView,
    setViewVisibility,
    resetToDefault,
    currentUserId,
  }
}
