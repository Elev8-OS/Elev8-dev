import type { GmWidgetItem } from '~/composables/useGmDashboardWidgets'
import type { SavedViewOwnership, SavedViewVisibility } from '~/lib/saved-view-ownership'
import { computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { DEFAULT_GM_WIDGETS, useGmDashboardWidgets } from '~/composables/useGmDashboardWidgets'
import { useSavedViewOwner } from '~/composables/useSavedViewOwner'
import { isOwnView, isVisibleTo, ownershipFor, visibilityToast, withOwnership } from '~/lib/saved-view-ownership'

export interface GmSavedView extends SavedViewOwnership {
  id: string
  name: string
  isDefault?: boolean
  widgets: GmWidgetItem[]
  createdAt: string
  updatedAt: string
}

export const STORAGE_KEY_GM_SAVED_VIEWS = 'elev8-gm-saved-views'
export const STORAGE_KEY_GM_ACTIVE_VIEW_ID = 'elev8-gm-active-view-id'

export const DEFAULT_GM_VIEW: GmSavedView = {
  id: 'default',
  name: 'Default Overview',
  isDefault: true,
  widgets: DEFAULT_GM_WIDGETS.map(w => ({ ...w })),
  visibility: 'public',
  createdBy: 'system',
  createdByName: 'System',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined')
    return defaultValue
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : defaultValue
  }
  catch {
    return defaultValue
  }
}

function saveToLocalStorage<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined')
    return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  }
  catch {
    // Ignore storage errors
  }
}

export function useGmSavedViews() {
  const { widgets, resetToDefaults: resetWidgetsToDefaults } = useGmDashboardWidgets()
  const { owner, currentUserId } = useSavedViewOwner()

  // Every user's custom views in this browser (it stands in for the server).
  const storedViews = useState<GmSavedView[]>('gm-saved-views-state', () =>
    loadFromLocalStorage<GmSavedView[]>(STORAGE_KEY_GM_SAVED_VIEWS, [])
      .filter(v => !v.isDefault)
      .map(v => withOwnership(v, owner.value)))

  /** The Default Overview plus what this user may see: own views and everyone's public ones. */
  const savedViews = computed<GmSavedView[]>(() => [
    DEFAULT_GM_VIEW,
    ...storedViews.value.filter(v => isVisibleTo(v, currentUserId.value)),
  ])

  // Active view ID
  const activeViewId = useState<string>('gm-active-view-id-state', () => {
    return loadFromLocalStorage<string>(STORAGE_KEY_GM_ACTIVE_VIEW_ID, 'default')
  })

  // Persist active view ID
  watch(activeViewId, (val) => {
    saveToLocalStorage(STORAGE_KEY_GM_ACTIVE_VIEW_ID, val)
  })

  // Active view object; a view since deleted or un-shared, or another user's, reads as Default
  const activeView = computed<GmSavedView>(() => {
    return savedViews.value.find(v => v.id === activeViewId.value) ?? DEFAULT_GM_VIEW
  })

  // Check if current widgets differ from active view widgets
  const isDirty = computed<boolean>(() => {
    const currentList = widgets.value
    const savedList = activeView.value.widgets

    if (currentList.length !== savedList.length)
      return true

    return currentList.some((cw, idx) => {
      const sw = savedList[idx]
      if (!sw)
        return true
      return (
        cw.id !== sw.id
        || cw.enabled !== sw.enabled
        || cw.colSpan !== sw.colSpan
        || (cw.height ?? 360) !== (sw.height ?? 360)
      )
    })
  })

  // Only the creator's own views can be updated; a teammate's public view is saved as a new one
  const canUpdateActiveView = computed<boolean>(() => {
    return isOwnView(activeView.value, currentUserId.value) && isDirty.value
  })

  function isOwn(view: GmSavedView): boolean {
    return isOwnView(view, currentUserId.value)
  }

  function commitViews(views: GmSavedView[]) {
    storedViews.value = views
    saveToLocalStorage(STORAGE_KEY_GM_SAVED_VIEWS, views)
  }

  /** The stored view if this user created it, else a toast saying who can change it. */
  function ownViewOrToast(viewId: string, action: string): GmSavedView | null {
    const view = storedViews.value.find(v => v.id === viewId)
    if (!view)
      return null
    if (!isOwn(view)) {
      toast.error(`Only ${view.createdByName} can ${action} this view.`)
      return null
    }
    return view
  }

  // Switch to a saved view
  function loadView(viewId: string) {
    const targetView = savedViews.value.find(v => v.id === viewId)
    if (!targetView)
      return

    widgets.value = targetView.widgets.map(w => ({ ...w }))
    activeViewId.value = viewId
    saveToLocalStorage(STORAGE_KEY_GM_ACTIVE_VIEW_ID, viewId)
    toast.success(`Switched to "${targetView.name}" view`)
  }

  // Save current dashboard layout as a new custom view
  function saveCurrentAs(name: string, visibility: SavedViewVisibility = 'personal'): GmSavedView {
    const trimmed = name.trim()
    const finalName = trimmed || `Custom View ${savedViews.value.filter(v => !v.isDefault).length + 1}`
    const newId = `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()

    const newView: GmSavedView = {
      id: newId,
      name: finalName,
      isDefault: false,
      widgets: widgets.value.map(w => ({ ...w })),
      ...ownershipFor(owner.value, visibility),
      createdAt: now,
      updatedAt: now,
    }

    commitViews([...storedViews.value, newView])
    activeViewId.value = newId
    saveToLocalStorage(STORAGE_KEY_GM_ACTIVE_VIEW_ID, newId)
    toast.success(visibility === 'public' ? `Saved and shared "${finalName}" with your team` : `Saved new view "${finalName}"`)
    return newView
  }

  // Update existing custom view with current widget layout
  function updateActiveView() {
    if (activeView.value.isDefault || !ownViewOrToast(activeViewId.value, 'update'))
      return

    const now = new Date().toISOString()
    const updatedViews = storedViews.value.map((v) => {
      if (v.id === activeViewId.value) {
        return {
          ...v,
          widgets: widgets.value.map(w => ({ ...w })),
          updatedAt: now,
        }
      }
      return v
    })

    commitViews(updatedViews)
    toast.success(`Updated "${activeView.value.name}" view`)
  }

  // Rename custom view
  function renameView(viewId: string, newName: string) {
    if (!ownViewOrToast(viewId, 'rename'))
      return

    const trimmed = newName.trim()
    if (!trimmed)
      return

    commitViews(storedViews.value.map((v) => {
      if (v.id === viewId) {
        return { ...v, name: trimmed, updatedAt: new Date().toISOString() }
      }
      return v
    }))

    toast.success(`Renamed view to "${trimmed}"`)
  }

  // Delete custom view
  function deleteView(viewId: string) {
    const target = ownViewOrToast(viewId, 'delete')
    if (!target)
      return

    const viewName = target.name
    const previousViews = [...storedViews.value]

    // Remove view
    commitViews(storedViews.value.filter(v => v.id !== viewId))

    // If active view was deleted, fallback to default
    if (activeViewId.value === viewId) {
      loadView('default')
    }

    toast.info(`Deleted view "${viewName}"`, {
      action: {
        label: 'Undo',
        onClick: () => {
          commitViews(previousViews)
          activeViewId.value = viewId
          loadView(viewId)
        },
      },
    })
  }

  function setViewVisibility(viewId: string, visibility: SavedViewVisibility) {
    const view = ownViewOrToast(viewId, 'change who can see')
    if (!view || view.visibility === visibility)
      return
    commitViews(storedViews.value.map(v => v.id === viewId ? { ...v, visibility, updatedAt: new Date().toISOString() } : v))
    toast.success(visibilityToast(visibility))
  }

  // Reset to default overview
  function resetToDefaultView() {
    resetWidgetsToDefaults()
    activeViewId.value = 'default'
    toast.success('Reset to default overview')
  }

  return {
    savedViews,
    activeViewId,
    activeView,
    isDirty,
    canUpdateActiveView,
    loadView,
    saveCurrentAs,
    updateActiveView,
    renameView,
    deleteView,
    setViewVisibility,
    isOwn,
    resetToDefaultView,
  }
}
