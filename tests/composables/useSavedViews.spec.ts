import type { SavedView, ViewState } from '~/types/saved-views'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useSavedViews } from '~/composables/useSavedViews'
import { SEED_PUBLIC_VIEWS } from '~/types/saved-views'

const STORAGE_KEY = 'elev8-saved-views'

const state: ViewState = {
  searchValue: 'villa',
  activeTagFilter: ['Pool'],
  activeAiFilter: null,
  columnVisibility: { amenities: false, room: false },
  pageSize: 15,
}

function stored(): SavedView[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
}

function view(overrides: Partial<SavedView>): SavedView {
  return {
    id: 'v',
    name: 'View',
    ...state,
    visibility: 'personal',
    createdBy: 'user-1',
    createdByName: 'Komang Juliantara',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

function seed(views: SavedView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  localStorage.setItem('elev8-saved-views-seeded', 'true')
}

describe('useSavedViews', () => {
  beforeEach(() => {
    localStorage.clear()
    useCurrentDashboardUser().setCurrentUserId('user-1')
  })

  it('seeds the teammates\' public views into an empty store', async () => {
    const { fetchViews, savedViews } = useSavedViews()
    await fetchViews()
    expect(savedViews.value.map(v => v.id)).toEqual(['default', ...SEED_PUBLIC_VIEWS.map(v => v.id)])
    expect(stored()).toHaveLength(SEED_PUBLIC_VIEWS.length)
  })

  it('seeds once into a store that already holds views, and not again after a seed is deleted', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([view({ id: 'mine' })]))
    const first = useSavedViews()
    await first.fetchViews()
    expect(stored().map(v => v.id)).toEqual(['mine', ...SEED_PUBLIC_VIEWS.map(v => v.id)])

    localStorage.setItem(STORAGE_KEY, JSON.stringify([view({ id: 'mine' })]))
    const second = useSavedViews()
    await second.fetchViews()
    expect(stored().map(v => v.id)).toEqual(['mine'])
  })

  it('shows own personal views and everyone\'s public views, never a teammate\'s personal view', async () => {
    seed([
      view({ id: 'mine', createdBy: 'user-1' }),
      view({ id: 'theirs-personal', createdBy: 'user-2', createdByName: 'Made Surya' }),
      view({ id: 'theirs-public', createdBy: 'user-2', createdByName: 'Made Surya', visibility: 'public' }),
    ])
    const { fetchViews, savedViews } = useSavedViews()
    await fetchViews()
    expect(savedViews.value.map(v => v.id).sort()).toEqual(['default', 'mine', 'theirs-public'])
  })

  it('treats views saved before visibility existed as personal views of the loader', async () => {
    seed([{ id: 'old', name: 'Old', ...state, createdBy: 'current-user' } as unknown as SavedView])
    const { fetchViews, savedViews, isOwnView } = useSavedViews()
    await fetchViews()
    const old = savedViews.value.find(v => v.id === 'old')!
    expect(old.visibility).toBe('personal')
    expect(old.createdBy).toBe('user-1')
    expect(isOwnView(old)).toBe(true)
  })

  it('saves a public view stamped with the current user', async () => {
    seed([])
    const { saveCurrentAs, savedViews, activeView } = useSavedViews()
    await saveCurrentAs('Arrivals', state, 'public')
    expect(activeView.value).toMatchObject({ name: 'Arrivals', visibility: 'public', createdBy: 'user-1', createdByName: 'Komang Juliantara' })
    expect(savedViews.value).toHaveLength(2)
    expect(stored()[0].visibility).toBe('public')
  })

  it('defaults a new view to personal', async () => {
    seed([])
    const { saveCurrentAs, activeView } = useSavedViews()
    await saveCurrentAs('Mine', state)
    expect(activeView.value?.visibility).toBe('personal')
  })

  it('rejects a duplicate name, including a teammate\'s public view', async () => {
    seed([view({ id: 't', name: 'Pool', createdBy: 'user-2', visibility: 'public' })])
    const { saveCurrentAs, savedViews } = useSavedViews()
    await saveCurrentAs('pool', state)
    expect(savedViews.value).toHaveLength(2)
  })

  it('shares and un-shares an own view', async () => {
    seed([view({ id: 'mine' })])
    const { setViewVisibility, savedViews } = useSavedViews()
    await setViewVisibility('mine', 'public')
    expect(savedViews.value.find(v => v.id === 'mine')?.visibility).toBe('public')
    await setViewVisibility('mine', 'personal')
    expect(stored()[0].visibility).toBe('personal')
  })

  it('a personal view disappears for other users once its creator un-shares it', async () => {
    seed([view({ id: 'mine', visibility: 'public' })])
    const komang = useSavedViews()
    await komang.setViewVisibility('mine', 'personal')

    useCurrentDashboardUser().setCurrentUserId('user-2')
    const made = useSavedViews()
    await made.fetchViews()
    expect(made.savedViews.value.map(v => v.id)).toEqual(['default'])
  })

  it('leaves a teammate\'s public view untouched on update, rename, delete or un-share', async () => {
    seed([view({ id: 't', name: 'Team', createdBy: 'user-2', createdByName: 'Made Surya', visibility: 'public' })])
    const views = useSavedViews()
    await views.fetchViews()
    await views.loadView('t')
    await views.updateActiveView({ ...state, searchValue: 'changed' })
    await views.renameView('t', 'Hijacked')
    await views.setViewVisibility('t', 'personal')
    await views.deleteView('t')
    expect(stored()).toEqual([view({ id: 't', name: 'Team', createdBy: 'user-2', createdByName: 'Made Surya', visibility: 'public' })])
  })

  it('never offers "Update current view" on a teammate\'s view, even when changed', async () => {
    seed([view({ id: 't', createdBy: 'user-2', visibility: 'public' })])
    const { fetchViews, loadView, currentState, isDirty, canUpdateActiveView } = useSavedViews()
    await fetchViews()
    await loadView('t')
    currentState.value = { ...state, searchValue: 'changed' }
    expect(isDirty.value).toBe(true)
    expect(canUpdateActiveView.value).toBe(false)
  })

  it('updates an own view', async () => {
    seed([view({ id: 'mine' })])
    const { fetchViews, loadView, updateActiveView } = useSavedViews()
    await fetchViews()
    await loadView('mine')
    await updateActiveView({ ...state, searchValue: 'changed' })
    expect(stored()[0].searchValue).toBe('changed')
  })

  it('deletes an own view and falls back to Default when it was active', async () => {
    seed([view({ id: 'mine' })])
    const { fetchViews, loadView, deleteView, activeView } = useSavedViews()
    await fetchViews()
    await loadView('mine')
    await deleteView('mine')
    expect(stored()).toEqual([])
    expect(activeView.value?.id).toBe('default')
  })

  it('falls back to Default when the remembered active view is no longer visible', async () => {
    seed([view({ id: 'theirs', createdBy: 'user-2' })])
    localStorage.setItem('elev8-active-view', JSON.stringify(view({ id: 'theirs', createdBy: 'user-2' })))
    const { fetchViews, activeView } = useSavedViews()
    await fetchViews()
    expect(activeView.value?.id).toBe('default')
  })
})
