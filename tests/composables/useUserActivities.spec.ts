import { beforeEach, describe, expect, it } from 'vitest'
import { toLocalDateKey } from '~/components/activities/data/activities'
import { seedActivities } from '~/components/users/data/user-activities'
import { useActivityReport } from '~/composables/useActivityReport'
import { useUserActivities } from '~/composables/useUserActivities'

beforeEach(() => localStorage.clear())

describe('user profile feed and the Activities report', () => {
  it('shows the work logged in Activities on the profile of the same person', () => {
    const { logs } = useActivityReport()
    const { getActivitiesForUser } = useUserActivities()
    const own = logs.value.filter(l => l.userId === 'user-7')
    const feed = getActivitiesForUser('user-7')
    const tracked = feed.filter(a => a.source === 'activities')
    expect(tracked).toHaveLength(own.length)
    expect(tracked.every(a => a.userId === 'user-7' && a.dateOnly)).toBe(true)
    // Nothing of another person leaks in.
    expect(getActivitiesForUser('user-2').every(a => a.userId === 'user-2')).toBe(true)
    // Newest first.
    expect(feed.map(a => a.timestamp)).toEqual([...feed.map(a => a.timestamp)].sort().reverse())
  })

  it('has no second copy of cleaning or tasks in the seeded events', () => {
    expect(seedActivities.some(a => a.type === 'cleaning' || a.type === 'task' || a.type === 'tracker')).toBe(false)
  })

  it('follows a log added, edited and deleted in Activities', () => {
    const { addLog, updateLog, removeLog } = useActivityReport()
    const { getActivitiesForUser, activityCountByUser, lastActivityForUser } = useUserActivities()
    const before = activityCountByUser('user-7', 30)

    const added = addLog({ userId: 'user-7', listingId: 'lst-1', type: 'task', title: 'Restock towels', date: toLocalDateKey(new Date()), durationMinutes: 25 })!
    expect(getActivitiesForUser('user-7').some(a => a.id === `tracked-${added.id}`)).toBe(true)
    expect(activityCountByUser('user-7', 30)).toBe(before + 1)
    expect(lastActivityForUser('user-7')?.source).toBe('activities')

    updateLog(added.id, { durationMinutes: 50, notes: 'Counted twice' })
    expect(getActivitiesForUser('user-7').find(a => a.id === `tracked-${added.id}`)).toMatchObject({ durationMinutes: 50, description: 'Counted twice' })

    removeLog(added.id)
    expect(getActivitiesForUser('user-7').some(a => a.id === `tracked-${added.id}`)).toBe(false)
    expect(activityCountByUser('user-7', 30)).toBe(before)
  })

  it('counts the last days from today, not from a fixed date', () => {
    const { activityCountByUser } = useUserActivities()
    const { logs } = useActivityReport()
    const week = logs.value.filter(l => l.userId === 'user-7' && l.date >= toLocalDateKey(new Date(Date.now() - 6 * 864e5))).length
    expect(activityCountByUser('user-7', 7)).toBeGreaterThanOrEqual(week)
    expect(activityCountByUser('user-7', 30)).toBeGreaterThan(0)
  })
})
