import type { GmWidgetItem } from '~/composables/useGmDashboardWidgets'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { DEFAULT_GM_WIDGETS, useGmDashboardWidgets } from '~/composables/useGmDashboardWidgets'

export interface GmSavedView {
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
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined')
    return defaultValue
  try {
    const data = window.localStorage.getItem(key)
    return data ? JSON.parse(data) : defaultValue
  }
  catch {
    return defaultValue
  }
}

function saveToLocalStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined')
    return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  }
  catch {
    // Ignore storage errors
  }
}

export function useGmSavedViews() {
  const { widgets, resetToDefaults: resetWidgetsToDefaults } = useGmDashboardWidgets()

  // Initialize saved views from storage
  const savedViews = useState<GmSavedView[]>('gm-saved-views-state', () => {
    const customViews = loadFromLocalStorage<GmSavedView[]>(STORAGE_KEY_GM_SAVED_VIEWS, [])
    return [DEFAULT_GM_VIEW, ...customViews]
  })

  // Active view ID
  const activeViewId = useState<string>('gm-active-view-id-state', () => {
    return loadFromLocalStorage<string>(STORAGE_KEY_GM_ACTIVE_VIEW_ID, 'default')
  })

  // Persist custom views whenever savedViews change
  watch(
    savedViews,
    (val) => {
      const customViews = val.filter(v => !v.isDefault)
      saveToLocalStorage(STORAGE_KEY_GM_SAVED_VIEWS, customViews)
    },
    { deep: true },
  )

  // Persist active view ID
  watch(activeViewId, (val) => {
    saveToLocalStorage(STORAGE_KEY_GM_ACTIVE_VIEW_ID, val)
  })

  // Active view object
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

  // Can update active view (only custom views that are modified)
  const canUpdateActiveView = computed<boolean>(() => {
    return !activeView.value.isDefault && isDirty.value
  })

  function persistCustomViews() {
    const customViews = savedViews.value.filter(v => !v.isDefault)
    saveToLocalStorage(STORAGE_KEY_GM_SAVED_VIEWS, customViews)
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
  function saveCurrentAs(name: string): GmSavedView {
    const trimmed = name.trim()
    const finalName = trimmed || `Custom View ${savedViews.value.filter(v => !v.isDefault).length + 1}`
    const newId = `view-${Date.now()}`
    const now = new Date().toISOString()

    const newView: GmSavedView = {
      id: newId,
      name: finalName,
      isDefault: false,
      widgets: widgets.value.map(w => ({ ...w })),
      createdAt: now,
      updatedAt: now,
    }

    savedViews.value = [...savedViews.value, newView]
    activeViewId.value = newId
    persistCustomViews()
    saveToLocalStorage(STORAGE_KEY_GM_ACTIVE_VIEW_ID, newId)
    toast.success(`Saved new view "${finalName}"`)
    return newView
  }

  // Update existing custom view with current widget layout
  function updateActiveView() {
    if (activeView.value.isDefault)
      return

    const now = new Date().toISOString()
    const updatedViews = savedViews.value.map((v) => {
      if (v.id === activeViewId.value) {
        return {
          ...v,
          widgets: widgets.value.map(w => ({ ...w })),
          updatedAt: now,
        }
      }
      return v
    })

    savedViews.value = updatedViews
    persistCustomViews()
    toast.success(`Updated "${activeView.value.name}" view`)
  }

  // Rename custom view
  function renameView(viewId: string, newName: string) {
    const target = savedViews.value.find(v => v.id === viewId)
    if (!target || target.isDefault)
      return

    const trimmed = newName.trim()
    if (!trimmed)
      return

    savedViews.value = savedViews.value.map((v) => {
      if (v.id === viewId) {
        return { ...v, name: trimmed, updatedAt: new Date().toISOString() }
      }
      return v
    })

    persistCustomViews()
    toast.success(`Renamed view to "${trimmed}"`)
  }

  // Delete custom view
  function deleteView(viewId: string) {
    const target = savedViews.value.find(v => v.id === viewId)
    if (!target || target.isDefault)
      return

    const viewName = target.name
    const previousViews = [...savedViews.value]

    // Remove view
    savedViews.value = savedViews.value.filter(v => v.id !== viewId)
    persistCustomViews()

    // If active view was deleted, fallback to default
    if (activeViewId.value === viewId) {
      loadView('default')
    }

    toast.info(`Deleted view "${viewName}"`, {
      action: {
        label: 'Undo',
        onClick: () => {
          savedViews.value = previousViews
          persistCustomViews()
          activeViewId.value = viewId
          loadView(viewId)
        },
      },
    })
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
    resetToDefaultView,
  }
}
