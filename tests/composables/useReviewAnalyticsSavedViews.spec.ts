// Review Hub analytics saved views: personal views stay with their creator,
// public views are shared, and only the creator can change one.

import type { ReviewAnalyticsSavedView, ReviewAnalyticsViewState } from '~/types/review-analytics'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useReviewAnalytics } from '~/composables/useReviewAnalytics'

vi.mock('vue-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const VIEWS_KEY = 'elev8-review-analytics-views'

const state: ReviewAnalyticsViewState = {
  channel: 'airbnb',
  listings: [],
  dateFrom: null,
  dateTo: null,
  period: '30d',
  comparison: 'previous_year',
}

function stored(): ReviewAnalyticsSavedView[] {
  return JSON.parse(localStorage.getItem(VIEWS_KEY) ?? '[]')
}

function as(userId: string) {
  useCurrentDashboardUser().setCurrentUserId(userId)
  return useReviewAnalytics()
}

describe('useReviewAnalytics saved views', () => {
  beforeEach(() => {
    localStorage.clear()
    useCurrentDashboardUser().setCurrentUserId('user-1')
  })

  it('stamps a new view with its creator, personal unless Public is picked', async () => {
    const komang = as('user-1')
    await komang.saveCurrentAs('Mine', state)
    await komang.saveCurrentAs('Team', state, 'public')
    expect(stored().map(v => [v.name, v.visibility, v.createdBy])).toEqual([
      ['Mine', 'personal', 'user-1'],
      ['Team', 'public', 'user-1'],
    ])
  })

  it('shows a teammate only the public views', async () => {
    const komang = as('user-1')
    await komang.saveCurrentAs('Mine', state)
    await komang.saveCurrentAs('Team', state, 'public')

    const made = as('user-2')
    await made.fetchViews()
    expect(made.savedViews.value.map(v => v.name)).toEqual(['Default View', 'Team'])
  })

  it('lets a teammate use a public view but not change it', async () => {
    const komang = as('user-1')
    await komang.saveCurrentAs('Team', state, 'public')
    const id = stored()[0]!.id

    const made = as('user-2')
    await made.fetchViews()
    await made.loadView(id)
    made.currentState.value = { ...state, channel: 'booking_com' }
    expect(made.isDirty.value).toBe(true)
    expect(made.canUpdateActiveView.value).toBe(false)
    await made.updateActiveView({ ...state, channel: 'booking_com' })
    await made.renameView(id, 'Hijacked')
    await made.setViewVisibility(id, 'personal')
    await made.deleteView(id)
    expect(stored()).toHaveLength(1)
    expect(stored()[0]).toMatchObject({ name: 'Team', visibility: 'public', channel: 'airbnb' })
  })

  it('un-sharing hides the view, and a teammate on it falls back to Default', async () => {
    const komang = as('user-1')
    await komang.saveCurrentAs('Team', state, 'public')
    const id = stored()[0]!.id
    localStorage.setItem('elev8-review-analytics-active-view', JSON.stringify(stored()[0]))
    await komang.setViewVisibility(id, 'personal')

    const made = as('user-2')
    await made.fetchViews()
    expect(made.savedViews.value.map(v => v.id)).toEqual(['default'])
    expect(made.activeView.value?.id).toBe('default')
  })

  it('treats a view saved before visibility existed as a personal view of the loader', async () => {
    localStorage.setItem(VIEWS_KEY, JSON.stringify([{ id: 'old', name: 'Old', ...state, createdBy: 'current-user', createdAt: '2026-01-01', updatedAt: '2026-01-01' }]))
    const komang = as('user-1')
    await komang.fetchViews()
    expect(komang.savedViews.value.find(v => v.id === 'old')).toMatchObject({ visibility: 'personal', createdBy: 'user-1', createdByName: 'Komang Juliantara' })
  })
})
