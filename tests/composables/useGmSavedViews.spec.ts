import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGmDashboardWidgets } from '~/composables/useGmDashboardWidgets'
import {
  DEFAULT_GM_VIEW,
  STORAGE_KEY_GM_ACTIVE_VIEW_ID,
  STORAGE_KEY_GM_SAVED_VIEWS,
  useGmSavedViews,
} from '~/composables/useGmSavedViews'

describe('useGmSavedViews', () => {
  beforeEach(() => {
    localStorage.clear()
    const { resetToDefaults } = useGmDashboardWidgets()
    resetToDefaults()
    const { resetToDefaultView } = useGmSavedViews()
    resetToDefaultView()
  })

  it('initializes with default overview view', () => {
    const { savedViews, activeViewId, activeView, isDirty } = useGmSavedViews()

    expect(savedViews.value.length).toBeGreaterThanOrEqual(1)
    expect(activeViewId.value).toBe('default')
    expect(activeView.value.name).toBe('Default Overview')
    expect(isDirty.value).toBe(false)
  })

  it('can save current layout as a new custom view', () => {
    const { setWidgetSpan } = useGmDashboardWidgets()
    const { savedViews, activeViewId, activeView, saveCurrentAs, isDirty } = useGmSavedViews()

    // Customize layout
    setWidgetSpan('occupancy_flow', 12)

    // Save as new view
    const newView = saveCurrentAs('Operations Layout')

    expect(newView.name).toBe('Operations Layout')
    expect(newView.isDefault).toBe(false)
    expect(savedViews.value.some(v => v.id === newView.id)).toBe(true)
    expect(activeViewId.value).toBe(newView.id)
    expect(activeView.value.name).toBe('Operations Layout')
    expect(isDirty.value).toBe(false)
  })

  it('detects when layout is dirty compared to active custom view', () => {
    const { setWidgetSpan } = useGmDashboardWidgets()
    const { saveCurrentAs, isDirty, canUpdateActiveView } = useGmSavedViews()

    // Create custom view
    saveCurrentAs('Morning Review')
    expect(isDirty.value).toBe(false)
    expect(canUpdateActiveView.value).toBe(false)

    // Modify widget span
    setWidgetSpan('sentiment_panel', 6)
    expect(isDirty.value).toBe(true)
    expect(canUpdateActiveView.value).toBe(true)
  })

  it('can update an existing custom view with current layout', () => {
    const { setWidgetSpan } = useGmDashboardWidgets()
    const { saveCurrentAs, updateActiveView, activeView, isDirty } = useGmSavedViews()

    saveCurrentAs('Executive Summary')
    setWidgetSpan('bookings_panel', 8)
    expect(isDirty.value).toBe(true)

    updateActiveView()
    expect(isDirty.value).toBe(false)

    const updatedBooking = activeView.value.widgets.find(w => w.id === 'bookings_panel')
    expect(updatedBooking?.colSpan).toBe(8)
  })

  it('can switch between saved views', () => {
    const { widgets, setWidgetSpan } = useGmDashboardWidgets()
    const { saveCurrentAs, loadView, activeViewId } = useGmSavedViews()

    // Save View A
    setWidgetSpan('occupancy_flow', 12)
    const viewA = saveCurrentAs('View A')

    // Save View B
    setWidgetSpan('occupancy_flow', 6)
    const viewB = saveCurrentAs('View B')

    expect(activeViewId.value).toBe(viewB.id)

    // Switch to View A
    loadView(viewA.id)
    expect(activeViewId.value).toBe(viewA.id)
    expect(widgets.value.find(w => w.id === 'occupancy_flow')?.colSpan).toBe(12)

    // Switch back to default view
    loadView('default')
    expect(activeViewId.value).toBe('default')
    expect(widgets.value.find(w => w.id === 'occupancy_flow')?.colSpan).toBe(8)
  })

  it('can rename a custom view', () => {
    const { saveCurrentAs, renameView, activeView } = useGmSavedViews()

    const view = saveCurrentAs('Initial Name')
    renameView(view.id, 'Renamed View')

    expect(activeView.value.name).toBe('Renamed View')
  })

  it('can delete a custom view and fall back to default', () => {
    const { savedViews, saveCurrentAs, deleteView, activeViewId } = useGmSavedViews()

    const view = saveCurrentAs('Temporary View')
    expect(savedViews.value.some(v => v.id === view.id)).toBe(true)
    expect(activeViewId.value).toBe(view.id)

    deleteView(view.id)
    expect(savedViews.value.some(v => v.id === view.id)).toBe(false)
    expect(activeViewId.value).toBe('default')
  })

  it('persists saved views to localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const { saveCurrentAs } = useGmSavedViews()

    saveCurrentAs('Persisted View')

    expect(setItemSpy).toHaveBeenCalledWith(
      STORAGE_KEY_GM_SAVED_VIEWS,
      expect.stringContaining('Persisted View'),
    )
    setItemSpy.mockRestore()
  })
})
