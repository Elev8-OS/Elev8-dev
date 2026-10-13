// Saved views snapshot every Analytics filter. Pinned here: snapshots are
// copies (editing filters never edits a view), the dirty check ignores pick
// order, the unsaved-changes prompt, persistence and its restore.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAnalyticsFilters, useAnalytics } from '~/composables/useAnalytics'
import { DEFAULT_VIEW_ID, sameFilters, useAnalyticsSavedViews } from '~/composables/useAnalyticsSavedViews'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

beforeEach(() => {
  localStorage.clear()
  useCurrentDashboardUser().setCurrentUserId('user-1')
})

describe('sameFilters', () => {
  it('ignores the order values were picked in, and a stale custom range under a preset', () => {
    const a = { ...defaultAnalyticsFilters(), tags: ['Pool', 'Ubud'], customRange: { start: '2026-01-01', end: '2026-01-31' } }
    const b = { ...defaultAnalyticsFilters(), tags: ['Ubud', 'Pool'] }
    expect(sameFilters(a, b)).toBe(true)
    expect(sameFilters(a, { ...b, channels: ['Direct'] })).toBe(false)
  })
})

describe('useAnalyticsSavedViews', () => {
  it('saves a copy of the filters and makes it the active view', () => {
    const { filters, setScope } = useAnalytics()
    const views = useAnalyticsSavedViews()
    setScope('regions', ['Bali'])
    views.saveAs('Bali only')

    expect(views.activeView.value.name).toBe('Bali only')
    expect(views.isDirty.value).toBe(false)

    setScope('channels', ['Direct'])
    expect(views.activeView.value.filters.channels).toEqual([]) // the view did not move with the filters
    expect(views.isDirty.value).toBe(true)
    expect(filters.value.channels).toEqual(['Direct'])
  })

  it('rejects a duplicate name, case-insensitively', () => {
    const views = useAnalyticsSavedViews()
    views.saveAs('Bali only')
    views.saveAs('bali ONLY')
    views.saveAs('default view')
    expect(views.savedViews.value).toHaveLength(2)
  })

  it('asks before leaving a view with unsaved changes, and can be cancelled or confirmed', () => {
    const { filters, setScope } = useAnalytics()
    const views = useAnalyticsSavedViews()
    setScope('regions', ['Germany'])
    views.saveAs('Germany')
    setScope('regions', ['Bali'])
    views.saveAs('Bali')
    setScope('channels', ['Airbnb']) // Bali is now dirty

    const germany = views.savedViews.value.find(v => v.name === 'Germany')!
    views.loadView(germany.id)
    expect(views.pendingViewId.value).toBe(germany.id)
    expect(filters.value.regions).toEqual(['Bali'])

    views.cancelLoadView()
    expect(views.pendingViewId.value).toBeNull()
    expect(views.activeView.value.name).toBe('Bali')

    views.loadView(germany.id)
    views.confirmLoadView()
    expect(views.activeView.value.name).toBe('Germany')
    expect(filters.value).toMatchObject({ regions: ['Germany'], channels: [] })
  })

  it('updates, renames and deletes; deleting the active view falls back to Default with the filters kept', () => {
    const { filters, setScope } = useAnalytics()
    const views = useAnalyticsSavedViews()
    setScope('tags', ['Pool'])
    views.saveAs('Pools')
    setScope('tags', ['Pool', 'Ubud'])
    views.updateActiveView()
    expect(views.isDirty.value).toBe(false)
    expect(views.activeView.value.filters.tags).toEqual(['Pool', 'Ubud'])

    views.renameView(views.activeView.value.id, 'Ubud pools')
    expect(views.activeView.value.name).toBe('Ubud pools')

    views.deleteView(views.activeView.value.id)
    expect(views.activeView.value.id).toBe(DEFAULT_VIEW_ID)
    expect(filters.value.tags).toEqual(['Pool', 'Ubud'])
  })

  it('persists views and restores the last active one in a new session', () => {
    const { setPeriod, setScope } = useAnalytics()
    const views = useAnalyticsSavedViews()
    setPeriod('12m')
    setScope('countries', ['AU'])
    views.saveAs('Aussies, 12 months')

    // A fresh session: in-memory state gone, storage kept.
    const { filters } = useAnalytics()
    filters.value = defaultAnalyticsFilters()
    const fresh = useAnalyticsSavedViews()
    useState('analytics-views-restored').value = false
    useState<unknown[]>('analytics-saved-views').value = []
    fresh.restore()

    expect(fresh.activeView.value.name).toBe('Aussies, 12 months')
    expect(filters.value).toMatchObject({ period: '12m', compare: 'last_year', countries: ['AU'] })
  })

  it('loads a view saved before the inactive / deleted filter existed', () => {
    const { filters } = useAnalytics()
    const legacy = { ...defaultAnalyticsFilters(), regions: ['Bali'] } as Partial<ReturnType<typeof defaultAnalyticsFilters>>
    delete legacy.includeRetired
    localStorage.setItem('elev8-analytics-saved-views', JSON.stringify([{ id: 'old', name: 'Old', filters: legacy, createdAt: '2026-01-01', updatedAt: '2026-01-01' }]))
    localStorage.setItem('elev8-analytics-active-view', JSON.stringify('old'))
    const views = useAnalyticsSavedViews()
    views.restore()
    expect(filters.value.includeRetired).toEqual([])
    expect(filters.value.regions).toEqual(['Bali'])
    expect(views.isDirty.value).toBe(false)
  })

  it('drops picked listings of a kind when that kind is switched off', () => {
    const { filters, setIncludeRetired, setScope } = useAnalytics()
    setIncludeRetired('deleted', true)
    setScope('listingIds', ['retired-villa-bukit-sari', 'retired-canggu-loft'])
    setIncludeRetired('deleted', false)
    expect(filters.value.includeRetired).toEqual([])
    expect(filters.value.listingIds).toEqual(['retired-canggu-loft'])
  })

  it('resets to the Default View and its filters', () => {
    const { filters, setScope } = useAnalytics()
    const views = useAnalyticsSavedViews()
    setScope('regions', ['Bali'])
    views.saveAs('Bali')
    views.resetToDefault()
    expect(views.activeView.value.id).toBe(DEFAULT_VIEW_ID)
    expect(filters.value).toEqual(defaultAnalyticsFilters())
  })

  describe('personal and public views', () => {
    /** Switches user and starts a fresh session on the same browser storage. */
    function sessionAs(userId: string) {
      useCurrentDashboardUser().setCurrentUserId(userId)
      useState('analytics-views-restored').value = false
      useState<unknown[]>('analytics-saved-views').value = []
      useState('analytics-active-view').value = DEFAULT_VIEW_ID
      const views = useAnalyticsSavedViews()
      views.restore()
      return views
    }

    it('stamps a new view with its creator, personal unless Public is picked', () => {
      const views = useAnalyticsSavedViews()
      views.saveAs('Mine')
      views.saveAs('Team', 'public')
      const byName = Object.fromEntries(views.savedViews.value.map(v => [v.name, v]))
      expect(byName.Mine).toMatchObject({ visibility: 'personal', createdBy: 'user-1', createdByName: 'Komang Juliantara' })
      expect(byName.Team!.visibility).toBe('public')
    })

    it('shows a teammate only the public views', () => {
      const views = useAnalyticsSavedViews()
      views.saveAs('Mine')
      views.saveAs('Team', 'public')
      const made = sessionAs('user-2')
      expect(made.savedViews.value.map(v => v.name)).toEqual(['Default View', 'Team'])
    })

    it('lets a teammate use a public view but not change it', () => {
      const { setScope } = useAnalytics()
      const views = useAnalyticsSavedViews()
      setScope('regions', ['Bali'])
      views.saveAs('Team', 'public')
      const team = views.activeView.value

      const made = sessionAs('user-2')
      made.loadView(team.id)
      setScope('channels', ['Direct'])
      expect(made.isDirty.value).toBe(true)
      expect(made.canUpdateActiveView.value).toBe(false)
      made.updateActiveView()
      made.renameView(team.id, 'Hijacked')
      made.setViewVisibility(team.id, 'personal')
      made.deleteView(team.id)
      expect(made.savedViews.value.find(v => v.id === team.id)).toMatchObject({ name: 'Team', visibility: 'public', filters: { channels: [] } })
    })

    it('un-sharing hides the view from teammates, and their remembered active view falls back to Default', () => {
      const views = useAnalyticsSavedViews()
      views.saveAs('Team', 'public')
      const id = views.activeView.value.id
      localStorage.setItem('elev8-analytics-active-view', JSON.stringify(id))
      views.setViewVisibility(id, 'personal')

      const made = sessionAs('user-2')
      expect(made.savedViews.value.map(v => v.id)).toEqual([DEFAULT_VIEW_ID])
      expect(made.activeView.value.id).toBe(DEFAULT_VIEW_ID)
    })

    it('treats a view saved before visibility existed as a personal view of the loader', () => {
      localStorage.setItem('elev8-analytics-saved-views', JSON.stringify([{ id: 'old', name: 'Old', filters: defaultAnalyticsFilters(), createdAt: '2026-01-01', updatedAt: '2026-01-01' }]))
      const views = sessionAs('user-1')
      expect(views.savedViews.value.find(v => v.id === 'old')).toMatchObject({ visibility: 'personal', createdBy: 'user-1' })
    })
  })
})
