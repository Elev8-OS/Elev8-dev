import type { SavedView, SavedViewVisibility, ViewState } from '~/types/saved-views'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { DEFAULT_VIEW, SEED_PUBLIC_VIEWS } from '~/types/saved-views'

// Every user's custom views live under one key: it stands in for the server,
// and each user only sees their own personal views plus everyone's public ones.
const STORAGE_KEY = 'elev8-saved-views'
const ACTIVE_VIEW_KEY = 'elev8-active-view'
const CURRENT_STATE_KEY = 'elev8-current-state'
const PENDING_VIEW_ID_KEY = 'elev8-pending-view-id'
const SEEDED_KEY = 'elev8-saved-views-seeded'

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
    toast.error(`Could not save ${key} to storage.`)
  }
}

function sortByUpdatedDesc(views: SavedView[]): SavedView[] {
  return [...views].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

function stateOf(view: SavedView): ViewState {
  return {
    searchValue: view.searchValue,
    activeTagFilter: view.activeTagFilter,
    activeAiFilter: view.activeAiFilter,
    columnVisibility: view.columnVisibility,
    pageSize: view.pageSize,
  }
}

export function useSavedViews() {
  const { currentUser, currentUserId } = useCurrentDashboardUser()
  const currentUserName = computed(() => currentUser.value?.name ?? 'Komang Juliantara')

  /**
   * Views saved before visibility existed carry no `visibility` and a
   * `createdBy` of `current-user`: they become personal views of whoever loads them.
   */
  function normalize(view: Partial<SavedView> & { id: string, name: string }): SavedView {
    const legacyOwner = !view.createdBy || view.createdBy === 'current-user'
    return {
      ...DEFAULT_VIEW,
      ...view,
      isDefault: undefined,
      visibility: view.visibility ?? 'personal',
      createdBy: legacyOwner ? currentUserId.value : view.createdBy!,
      createdByName: view.createdByName ?? (legacyOwner ? currentUserName.value : 'Teammate'),
    } as SavedView
  }

  function readStoredViews(): SavedView[] {
    const stored = loadFromLocalStorage<SavedView[]>(STORAGE_KEY, []).filter(v => !v.isDefault).map(normalize)
    // Seed once per browser, also into a store that already holds views,
    // so a seed view its creator deleted does not come back.
    if (loadFromLocalStorage<boolean>(SEEDED_KEY, false))
      return stored
    const seeded = [...stored, ...SEED_PUBLIC_VIEWS.filter(s => !stored.some(v => v.id === s.id))]
    saveToLocalStorage(STORAGE_KEY, seeded)
    saveToLocalStorage(SEEDED_KEY, true)
    return seeded
  }

  const allViews = ref<SavedView[]>(readStoredViews())
  const activeView = ref<SavedView | null>(loadFromLocalStorage(ACTIVE_VIEW_KEY, DEFAULT_VIEW))
  const currentState = ref<ViewState | null>(loadFromLocalStorage(CURRENT_STATE_KEY, null))
  const pendingViewId = ref<string | null>(loadFromLocalStorage(PENDING_VIEW_ID_KEY, null))
  const isLoading = ref(false)

  function isOwnView(view: Pick<SavedView, 'createdBy' | 'isDefault'>): boolean {
    return !view.isDefault && view.createdBy === currentUserId.value
  }

  function isVisible(view: SavedView): boolean {
    return view.visibility === 'public' || isOwnView(view)
  }

  /** Default View first, then what this user can see, newest first. */
  const savedViews = computed<SavedView[]>(() => [
    DEFAULT_VIEW,
    ...sortByUpdatedDesc(allViews.value.filter(isVisible)),
  ])

  watch(activeView, (newVal) => {
    saveToLocalStorage(ACTIVE_VIEW_KEY, newVal)
  }, { deep: true })

  watch(currentState, (newVal) => {
    saveToLocalStorage(CURRENT_STATE_KEY, newVal)
  }, { deep: true })

  watch(pendingViewId, (newVal) => {
    saveToLocalStorage(PENDING_VIEW_ID_KEY, newVal)
  })

  const isDirty = computed(() => {
    if (!activeView.value || !currentState.value || activeView.value.isDefault)
      return false
    const av = activeView.value
    const cs = currentState.value

    return (
      av.searchValue !== cs.searchValue
      || JSON.stringify([...av.activeTagFilter].sort()) !== JSON.stringify([...cs.activeTagFilter].sort())
      || av.activeAiFilter !== cs.activeAiFilter
      || JSON.stringify(av.columnVisibility) !== JSON.stringify(cs.columnVisibility)
      || av.pageSize !== cs.pageSize
    )
  })

  // A teammate's public view can be used and tweaked, but changes go into a new view.
  const canUpdateActiveView = computed(() => {
    return activeView.value !== null && isOwnView(activeView.value) && isDirty.value
  })

  function commit(views: SavedView[]): void {
    allViews.value = views
    saveToLocalStorage(STORAGE_KEY, views)
  }

  function generateId(): string {
    return `view_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  function activateDefault(): void {
    activeView.value = DEFAULT_VIEW
    currentState.value = stateOf(DEFAULT_VIEW)
  }

  function resetToDefault(): void {
    activateDefault()
    toast.info('Reset to default view')
  }

  /** Finds a view this user may change, or explains why not. */
  function ownViewOrToast(viewId: string, action: string): SavedView | null {
    const view = allViews.value.find(v => v.id === viewId)
    if (!view) {
      toast.error(`Cannot ${action} this view.`)
      return null
    }
    if (!isOwnView(view)) {
      toast.error(`Only ${view.createdByName} can ${action} this view.`)
      return null
    }
    return view
  }

  async function fetchViews() {
    isLoading.value = true
    try {
      allViews.value = readStoredViews()
      // The stored active view may since have been deleted or un-shared by its creator,
      // or belong to another user of this browser: fall back to Default.
      const active = activeView.value && savedViews.value.find(v => v.id === activeView.value!.id)
      if (!active)
        activateDefault()
      else
        activeView.value = active
    }
    catch {
      toast.error('Could not load saved views.')
    }
    finally {
      isLoading.value = false
    }
  }

  async function saveCurrentAs(name: string, state: ViewState, visibility: SavedViewVisibility = 'personal') {
    const exists = savedViews.value.find(v =>
      !v.isDefault && v.name.toLowerCase() === name.toLowerCase(),
    )
    if (exists) {
      toast.error('A view with this name already exists.')
      return
    }

    const now = new Date().toISOString()
    const newView: SavedView = {
      id: generateId(),
      name,
      ...state,
      visibility,
      createdBy: currentUserId.value,
      createdByName: currentUserName.value,
      createdAt: now,
      updatedAt: now,
    }
    commit([...allViews.value, newView])
    activeView.value = newView
    currentState.value = state
    toast.success(visibility === 'public' ? 'View saved and shared with your team.' : 'View saved.')
  }

  async function loadView(viewId: string) {
    const view = savedViews.value.find(v => v.id === viewId)
    if (!view) {
      toast.error('Could not load view.')
      return
    }

    if (isDirty.value && activeView.value && !activeView.value.isDefault) {
      pendingViewId.value = viewId
      return view // Return view for confirmation dialog
    }

    activeView.value = view
    currentState.value = stateOf(view)
    pendingViewId.value = null
    return view
  }

  async function confirmLoadView(viewId: string) {
    const view = savedViews.value.find(v => v.id === viewId)
    if (!view)
      return
    activeView.value = view
    currentState.value = stateOf(view)
    pendingViewId.value = null
  }

  async function updateActiveView(state: ViewState) {
    if (!activeView.value || activeView.value.isDefault)
      return
    const view = ownViewOrToast(activeView.value.id, 'update')
    if (!view)
      return

    const updatedView: SavedView = { ...view, ...state, updatedAt: new Date().toISOString() }
    commit(allViews.value.map(v => v.id === updatedView.id ? updatedView : v))
    activeView.value = updatedView
    currentState.value = state
    toast.success('View updated.')
  }

  async function deleteView(viewId: string) {
    if (viewId === DEFAULT_VIEW.id) {
      toast.error('Cannot delete Default view.')
      return
    }
    if (!ownViewOrToast(viewId, 'delete'))
      return

    commit(allViews.value.filter(v => v.id !== viewId))
    if (activeView.value?.id === viewId)
      activateDefault()
    toast.success('View deleted.')
  }

  async function renameView(viewId: string, newName: string) {
    if (viewId === DEFAULT_VIEW.id) {
      toast.error('Cannot rename Default view.')
      return
    }
    const view = ownViewOrToast(viewId, 'rename')
    if (!view)
      return

    const exists = savedViews.value.find(v =>
      !v.isDefault && v.id !== viewId && v.name.toLowerCase() === newName.toLowerCase(),
    )
    if (exists) {
      toast.error('A view with this name already exists.')
      return
    }

    const updatedView: SavedView = { ...view, name: newName, updatedAt: new Date().toISOString() }
    commit(allViews.value.map(v => v.id === viewId ? updatedView : v))
    if (activeView.value?.id === viewId)
      activeView.value = updatedView
    toast.success('View renamed.')
  }

  async function setViewVisibility(viewId: string, visibility: SavedViewVisibility) {
    const view = ownViewOrToast(viewId, 'change who can see')
    if (!view || view.visibility === visibility)
      return

    const updatedView: SavedView = { ...view, visibility, updatedAt: new Date().toISOString() }
    commit(allViews.value.map(v => v.id === viewId ? updatedView : v))
    if (activeView.value?.id === viewId)
      activeView.value = updatedView
    toast.success(visibility === 'public' ? 'View shared with your team.' : 'View is now personal.')
  }

  return {
    savedViews,
    activeView,
    currentState,
    currentUserId,
    isDirty,
    canUpdateActiveView,
    pendingViewId,
    isLoading,
    isOwnView,
    fetchViews,
    saveCurrentAs,
    loadView,
    confirmLoadView,
    updateActiveView,
    deleteView,
    renameView,
    setViewVisibility,
    resetToDefault,
  }
}
