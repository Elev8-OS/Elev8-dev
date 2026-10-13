import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useGmDashboardWidgets } from '~/composables/useGmDashboardWidgets'
import {
  STORAGE_KEY_GM_SAVED_VIEWS,
  useGmSavedViews,
} from '~/composables/useGmSavedViews'

describe('useGmSavedViews', () => {
  beforeEach(() => {
    localStorage.clear()
    useCurrentDashboardUser().setCurrentUserId('user-1')
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

  describe('personal and public views', () => {
    it('stamps a new view with its creator, personal unless Public is picked', () => {
      const { saveCurrentAs } = useGmSavedViews()
      expect(saveCurrentAs('Mine')).toMatchObject({ visibility: 'personal', createdBy: 'user-1', createdByName: 'Komang Juliantara' })
      expect(saveCurrentAs('Team', 'public').visibility).toBe('public')
    })

    it('shows a teammate only the public views, and their active view falls back to Default', () => {
      const { saveCurrentAs } = useGmSavedViews()
      saveCurrentAs('Team', 'public')
      const mine = saveCurrentAs('Mine')

      useCurrentDashboardUser().setCurrentUserId('user-2')
      const made = useGmSavedViews()
      expect(made.savedViews.value.map(v => v.name)).toEqual(['Default Overview', 'Team'])
      expect(made.activeViewId.value).toBe(mine.id)
      expect(made.activeView.value.id).toBe('default')
    })

    it('lets a teammate use a public view but not change it', () => {
      const { setWidgetSpan } = useGmDashboardWidgets()
      const team = useGmSavedViews().saveCurrentAs('Team', 'public')

      useCurrentDashboardUser().setCurrentUserId('user-2')
      const made = useGmSavedViews()
      made.loadView(team.id)
      setWidgetSpan('occupancy_flow', 12)
      expect(made.isDirty.value).toBe(true)
      expect(made.canUpdateActiveView.value).toBe(false)
      made.updateActiveView()
      made.renameView(team.id, 'Hijacked')
      made.setViewVisibility(team.id, 'personal')
      made.deleteView(team.id)

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_GM_SAVED_VIEWS) ?? '[]')
      expect(stored).toHaveLength(1)
      expect(stored[0]).toMatchObject({ name: 'Team', visibility: 'public' })
      expect(stored[0].widgets).toEqual(team.widgets)
    })

    it('shares and un-shares an own view', () => {
      const { saveCurrentAs, setViewVisibility, savedViews } = useGmSavedViews()
      const mine = saveCurrentAs('Mine')
      setViewVisibility(mine.id, 'public')
      expect(savedViews.value.find(v => v.id === mine.id)?.visibility).toBe('public')
      setViewVisibility(mine.id, 'personal')
      expect(savedViews.value.find(v => v.id === mine.id)?.visibility).toBe('personal')
    })
  })
})
