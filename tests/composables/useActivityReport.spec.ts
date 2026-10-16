import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { CLEANING_LOG_TYPES, cleaningLogTitle, formatDuration, listingRooms, logPlace, toLocalDateKey } from '~/components/activities/data/activities'
import { listings } from '~/components/listings/data/listings'
import { rangeForPreset, useActivityReport } from '~/composables/useActivityReport'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useTaskStore } from '~/composables/useTaskStore'
import { useUsers } from '~/composables/useUsers'
import { ACTIVITY_STORAGE_KEY, loadActivityReport, saveActivityReport } from '~/lib/activity-store'

const wide = { from: '2000-01-01', to: '2999-12-31' }
const todayKey = () => toLocalDateKey(new Date())

// The report saves itself to localStorage, so every test starts from an empty one.
beforeEach(() => localStorage.clear())

describe('rangeForPreset', () => {
  const today = new Date(2026, 9, 16)

  it('builds local day keys for each preset', () => {
    expect(rangeForPreset('today', today)).toEqual({ from: '2026-10-16', to: '2026-10-16' })
    expect(rangeForPreset('last7', today)).toEqual({ from: '2026-10-10', to: '2026-10-16' })
    expect(rangeForPreset('last14', today)).toEqual({ from: '2026-10-03', to: '2026-10-16' })
    expect(rangeForPreset('thisMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-16' })
    expect(rangeForPreset('lastMonth', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })
})

describe('formatDuration', () => {
  it('drops empty hours and minutes', () => {
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(20)).toBe('20m')
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(65)).toBe('1h 05m')
    expect(formatDuration(600)).toBe('10h')
  })
})

describe('useActivityReport', () => {
  it('spreads a multi-tenant person over their tenants and leaves everyone else without one', () => {
    const { logs, tenantsFor } = useActivityReport()
    expect(tenantsFor('user-1').map(t => t.id)).toEqual(['t-1', 't-2', 't-3'])
    expect(tenantsFor('user-1').every(t => t.name.length > 0)).toBe(true)
    expect(tenantsFor('user-7')).toEqual([])
    expect(new Set(logs.value.filter(l => l.userId === 'user-1').map(l => l.tenantId)).size).toBeGreaterThan(1)
    expect(logs.value.filter(l => l.userId !== 'user-1').every(l => l.tenantId === undefined)).toBe(true)
  })

  it('counts only the active tenant until the other tenants are included', () => {
    const { logs, staffRows, dayGroups, dailySeries, listingSummary, byTypeFor, otherTenantCount, activeTenantId } = useActivityReport()
    const all = logs.value.filter(l => l.userId === 'user-1')
    const own = all.filter(l => l.tenantId === activeTenantId.value)
    expect(own.length).toBeGreaterThan(0)
    expect(own.length).toBeLessThan(all.length)

    const row = (include: boolean) => staffRows(wide, { includeOtherTenants: include }).find(r => r.userId === 'user-1')!
    expect(row(false).count).toBe(own.length)
    expect(row(true).count).toBe(all.length)
    expect(otherTenantCount('user-1', wide)).toBe(all.length - own.length)

    const sum = (include: boolean) => dayGroups('user-1', wide, { includeOtherTenants: include }).reduce((s, g) => s + g.minutes, 0)
    expect(sum(false)).toBe(own.reduce((s, l) => s + l.durationMinutes, 0))
    expect(sum(true)).toBe(all.reduce((s, l) => s + l.durationMinutes, 0))

    const series = (include: boolean) => dailySeries('user-1', { from: '2026-01-01', to: toLocalDateKey(new Date()) }, include).reduce((s, p) => s + p.minutes, 0)
    expect(series(false)).toBeLessThan(series(true))
    expect(listingSummary('user-1', wide, true).reduce((s, l) => s + l.minutes, 0)).toBe(sum(true))
    const typed = byTypeFor('user-1', wide, true)
    expect(typed.cleaning + typed.task + typed.tracker).toBe(sum(true))
  })

  it('does not compare part of a day with the target', () => {
    const { staffRows } = useActivityReport()
    const range = { from: '2026-10-05', to: '2026-10-10' }
    const find = (include: boolean) => staffRows(range, { includeOtherTenants: include }).find(r => r.userId === 'user-1')!
    expect(find(false).targetMinutes).toBe(0)
    expect(find(true).targetMinutes).toBeGreaterThan(0)
    // Someone with one tenant keeps their target either way.
    expect(staffRows(range).find(r => r.userId === 'user-7')!.targetMinutes).toBeGreaterThan(0)
  })

  it('files a manager-added log under the active tenant for a multi-tenant person only', () => {
    const { addLog, activeTenantId } = useActivityReport()
    const input = { listingId: 'lst-1', type: 'task' as const, title: 'Check', date: todayKey(), durationMinutes: 20 }
    expect(addLog({ ...input, userId: 'user-1' })!.tenantId).toBe(activeTenantId.value)
    expect(addLog({ ...input, userId: 'user-7' })!.tenantId).toBeUndefined()
  })

  it('names a room only for multi-unit listings, and only one that belongs to the listing', () => {
    const { logs } = useActivityReport()
    const withRoom = logs.value.filter(l => l.unitId)
    expect(withRoom.length).toBeGreaterThan(0)
    for (const l of withRoom) {
      const room = listingRooms(l.listingId).find(r => r.id === l.unitId)
      expect(room?.name).toBe(l.unitName)
    }
    expect(logs.value.filter(l => listingRooms(l.listingId).length === 0).every(l => !l.unitId)).toBe(true)
    // Some logs at a multi-unit listing have no room: the whole property.
    expect(logs.value.some(l => listingRooms(l.listingId).length > 0 && !l.unitId)).toBe(true)
    expect(logPlace({ listingName: 'Villa', unitName: 'Master Suite' })).toBe('Villa · Master Suite')
    expect(logPlace({ listingName: 'Villa' })).toBe('Villa')
  })

  it('filters by listing, narrowing to one room when a room is picked', () => {
    const { staffRows, logs } = useActivityReport()
    const sample = logs.value.find(l => l.unitId)!
    const wholeListing = staffRows(wide, { listingId: sample.listingId, includeOtherTenants: true })
    const oneRoom = staffRows(wide, { listingId: sample.listingId, unitId: sample.unitId, includeOtherTenants: true })
    const count = (rows: typeof wholeListing) => rows.reduce((s, r) => s + r.count, 0)
    expect(count(wholeListing)).toBe(logs.value.filter(l => l.listingId === sample.listingId).length)
    expect(count(oneRoom)).toBe(logs.value.filter(l => l.listingId === sample.listingId && l.unitId === sample.unitId).length)
    expect(count(oneRoom)).toBeLessThan(count(wholeListing))
  })

  it('adds time in a room of the listing, and refuses a room from another listing', () => {
    const { addLog } = useActivityReport()
    const rooms = listingRooms('lst-1')
    expect(rooms.length).toBeGreaterThan(0)
    const base = { userId: 'user-7', type: 'task' as const, title: 'Check', date: todayKey(), durationMinutes: 20 }
    expect(addLog({ ...base, listingId: 'lst-1', unitId: rooms[0]!.id })).toMatchObject({ unitId: rooms[0]!.id, unitName: rooms[0]!.name })
    expect(addLog({ ...base, listingId: 'lst-1', unitId: null })!.unitId).toBeUndefined()
    expect(addLog({ ...base, listingId: 'lst-2', unitId: rooms[0]!.id })).toBeUndefined()
  })

  it('files every cleaning under a kind of cleaning, named after it', () => {
    const { logs, addLog } = useActivityReport()
    const cleanings = logs.value.filter(l => l.type === 'cleaning')
    expect(cleanings.length).toBeGreaterThan(0)
    for (const l of cleanings) {
      expect(CLEANING_LOG_TYPES).toContain(l.cleaningType)
      expect(l.title).toBe(cleaningLogTitle(l.cleaningType!))
    }
    // The titles are the Operations Calendar's labels, so reports line up with the cleaning checklists.
    expect(new Set(cleanings.map(l => l.title))).toEqual(new Set(['Daily cleaning', 'Check-out cleaning', 'Mid-stay cleaning', 'Custom cleaning', 'Vacant upkeep'].filter(t => cleanings.some(c => c.title === t))))
    expect(new Set(cleanings.map(l => l.cleaningType)).size).toBeGreaterThan(1)
    expect(logs.value.filter(l => l.type !== 'cleaning').every(l => l.cleaningType === undefined)).toBe(true)

    // A check-out takes longer than a daily tidy.
    const avg = (kind: string) => {
      const own = cleanings.filter(l => l.cleaningType === kind)
      return own.reduce((s, l) => s + l.durationMinutes, 0) / own.length
    }
    expect(avg('check_out')).toBeGreaterThan(avg('daily'))

    const base = { userId: 'user-7', listingId: 'lst-1', date: todayKey(), durationMinutes: 40 }
    expect(addLog({ ...base, type: 'cleaning', title: 'typed title', cleaningType: 'mid_stay' })).toMatchObject({ title: 'Mid-stay cleaning', cleaningType: 'mid_stay' })
    expect(addLog({ ...base, type: 'cleaning', title: 'no kind' })).toBeUndefined()
    expect(addLog({ ...base, type: 'task', title: '   ' })).toBeUndefined()
    expect(addLog({ ...base, type: 'task', title: 'Check', cleaningType: 'daily' })!.cleaningType).toBeUndefined()
  })

  it('filters cleaning by kind without touching other types', () => {
    const { logs, dayGroups, cleaningKindCounts } = useActivityReport()
    const flat = (g: ReturnType<typeof dayGroups>) => g.flatMap(d => d.rows.flatMap(r => r.logs))
    const all = flat(dayGroups('user-7', wide))

    const counts = cleaningKindCounts('user-7', wide)
    expect(Object.keys(counts).length).toBeGreaterThan(1)
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(all.filter(l => l.type === 'cleaning').length)

    const kind = (Object.keys(counts) as (keyof typeof counts)[])[0]!
    const onlyKind = flat(dayGroups('user-7', wide, { cleaningTypes: [kind] }))
    // Cleanings of other kinds drop out. Tasks and trackers stay, since the kind only narrows cleaning.
    expect(onlyKind.filter(l => l.type === 'cleaning').every(l => l.cleaningType === kind)).toBe(true)
    expect(onlyKind.filter(l => l.type === 'cleaning')).toHaveLength(counts[kind]!)
    expect(onlyKind.filter(l => l.type !== 'cleaning')).toHaveLength(all.filter(l => l.type !== 'cleaning').length)

    // With the Cleaning type on, the list is just that kind.
    const both = flat(dayGroups('user-7', wide, { types: ['cleaning'], cleaningTypes: [kind] }))
    expect(both.length).toBe(counts[kind])

    // Two kinds add up, and no kinds means no narrowing.
    const kinds = Object.keys(counts) as (keyof typeof counts)[]
    const two = flat(dayGroups('user-7', wide, { types: ['cleaning'], cleaningTypes: kinds.slice(0, 2) }))
    expect(two.length).toBe(kinds.slice(0, 2).reduce((n, k) => n + counts[k]!, 0))
    expect(flat(dayGroups('user-7', wide, { cleaningTypes: [] }))).toHaveLength(all.length)

    // An old cleaning log with no kind is hidden once a kind is picked.
    logs.value = [...logs.value, { ...all.find(l => l.type === 'cleaning')!, id: 'no-kind', cleaningType: undefined }]
    expect(flat(dayGroups('user-7', wide, { types: ['cleaning'], cleaningTypes: [kind] })).some(l => l.id === 'no-kind')).toBe(false)
    expect(cleaningKindCounts('user-7', wide)).toEqual(counts)

    // Another person's cleaning kinds are counted separately.
    expect(cleaningKindCounts('user-2', wide)).toEqual({})
  })

  it('saves every manager change, and opens from the saved copy', () => {
    const { logs, addLog, updateLog, removeLog } = useActivityReport()
    // First open: a demo report is created and saved.
    const saved = loadActivityReport()!
    expect(saved.logs).toHaveLength(logs.value.length)
    expect(saved.throughDay).toBe(todayKey())

    const added = addLog({ userId: 'user-7', listingId: 'lst-1', type: 'task', title: 'Restock', date: todayKey(), durationMinutes: 20 })!
    expect(loadActivityReport()!.logs.some(l => l.id === added.id)).toBe(true)
    expect(loadActivityReport()!.audit[0]).toMatchObject({ action: 'added', title: 'Restock' })

    updateLog(added.id, { durationMinutes: 45, notes: 'Two rooms' })
    expect(loadActivityReport()!.logs.find(l => l.id === added.id)).toMatchObject({ durationMinutes: 45, notes: 'Two rooms' })

    removeLog(added.id)
    const after = loadActivityReport()!
    expect(after.logs.some(l => l.id === added.id)).toBe(false)
    expect(after.audit.map(a => a.action)).toEqual(['deleted', 'edited', 'added'])
  })

  it('opens from a saved copy instead of making new demo data', () => {
    const mine = { id: 'kept', userId: 'user-7', listingId: 'lst-1', listingName: 'Villa', type: 'task' as const, title: 'Only mine', date: todayKey(), durationMinutes: 15 }
    saveActivityReport({ throughDay: todayKey(), logs: [mine], audit: [] })
    const { logs, staffRows } = useActivityReport()
    expect(logs.value).toEqual([mine])
    expect(staffRows({ from: todayKey(), to: todayKey() }, { includeOtherTenants: true }).find(r => r.userId === 'user-7')?.count).toBe(1)
  })

  it('in a component, shows the demo first and opens the saved copy after mount, never overwriting it before', async () => {
    // Nuxt hands the browser the server's state and does not re-run initialisers, so a component must read the
    // saved copy after it mounts. Until then the saved copy has to stay exactly as it was.
    const mine = { id: 'kept', userId: 'user-7', listingId: 'lst-1', listingName: 'Villa', type: 'task' as const, title: 'Only mine', date: todayKey(), durationMinutes: 15 }
    saveActivityReport({ throughDay: todayKey(), logs: [mine], audit: [] })
    const rawBefore = localStorage.getItem(ACTIVITY_STORAGE_KEY)

    let seenInSetup = -1
    let rawInSetup: string | null = null
    const Probe = defineComponent({
      setup() {
        const { logs } = useActivityReport()
        seenInSetup = logs.value.length
        rawInSetup = localStorage.getItem(ACTIVITY_STORAGE_KEY)
        return { logs }
      },
      template: '<div>{{ logs.length }}</div>',
    })
    const wrapper = mount(Probe)
    expect(seenInSetup).toBeGreaterThan(100) // the demo report, as the server sent it
    expect(rawInSetup).toBe(rawBefore) // not overwritten while hydrating
    await nextTick()
    expect(wrapper.text()).toBe('1') // the saved copy, once mounted
    expect(localStorage.getItem(ACTIVITY_STORAGE_KEY)).toBe(rawBefore)
  })

  it('tops a saved copy up on a new day without touching what is saved', () => {
    const old = { id: 'old', userId: 'user-7', listingId: 'lst-1', listingName: 'Villa', type: 'task' as const, title: 'Saved', date: '2020-01-01', durationMinutes: 15, manual: true }
    saveActivityReport({ throughDay: '2020-01-01', logs: [old], audit: [] })
    const { logs } = useActivityReport()
    expect(logs.value[0]).toEqual(old)
    expect(logs.value.length).toBeGreaterThan(1)
    expect(logs.value.slice(1).every(l => l.date > '2020-01-01' && l.id.endsWith(`-${todayKey()}`))).toBe(true)
    expect(loadActivityReport()!.throughDay).toBe(todayKey())
    expect(localStorage.getItem(ACTIVITY_STORAGE_KEY)).toContain('"id":"old"')
  })

  it('offers a person the cleaning jobs they finished that no log covers yet', () => {
    const { finishedWorkFor, staffRows } = useActivityReport()
    const { jobs } = useCleaningJobs()
    const done = jobs.value.filter(j => j.status === 'done')
    expect(done.length).toBeGreaterThan(0)

    // The demo cleanings are done by housekeeping users, matched by user id (no name guessing).
    const ketut = finishedWorkFor('user-7')
    expect(ketut.length).toBeGreaterThan(0)
    for (const w of ketut) {
      const job = jobs.value.find(j => j.id === w.id)!
      expect(job.status).toBe('done')
      expect(job.cleanerIds).toContain('user-7')
      expect(w).toMatchObject({ kind: 'cleaning_job', type: 'cleaning', listingId: job.listingId, date: job.scheduledAt.slice(0, 10) })
      expect(w.minutes).toBe(job.feedback?.cleaningDurationMinutes ?? job.durationMinutes)
      expect(CLEANING_LOG_TYPES).toContain(w.cleaningType)
      expect(w.title).toBe(cleaningLogTitle(w.cleaningType!))
    }
    expect(ketut.map(w => w.date)).toEqual([...ketut.map(w => w.date)].sort().reverse())

    // Someone who cannot log cleaning, or has no finished job, is offered nothing.
    expect(finishedWorkFor('user-2')).toEqual([])
    expect(finishedWorkFor('user-nobody')).toEqual([])

    // A range narrows it, and the count reaches the staff row.
    const wide = { from: '2000-01-01', to: '2999-12-31' }
    expect(finishedWorkFor('user-7', { from: '2000-01-01', to: '2000-01-02' })).toEqual([])
    expect(staffRows(wide, { includeOtherTenants: true }).find(r => r.userId === 'user-7')!.unloggedWork).toBe(ketut.length)
  })

  it('links a log to finished work once, and gives the work back when the log is deleted', () => {
    const { finishedWorkFor, addLog, removeLog, logs } = useActivityReport()
    const { jobs } = useCleaningJobs()
    const [first] = finishedWorkFor('user-7')
    expect(first).toBeDefined()
    const before = finishedWorkFor('user-7').length

    const log = addLog({ userId: 'user-7', listingId: first!.listingId, unitId: first!.unitId, type: 'cleaning', cleaningType: first!.cleaningType, cleaningJobId: first!.id, title: '', date: first!.date, durationMinutes: first!.minutes! })!
    expect(log).toMatchObject({ cleaningJobId: first!.id, type: 'cleaning', title: first!.title })
    expect(finishedWorkFor('user-7')).toHaveLength(before - 1)
    expect(finishedWorkFor('user-7').some(w => w.id === first!.id)).toBe(false)

    // The same job cannot be logged twice by the same person.
    expect(addLog({ userId: 'user-7', listingId: first!.listingId, type: 'cleaning', cleaningType: first!.cleaningType, cleaningJobId: first!.id, title: '', date: first!.date, durationMinutes: 30 })).toBeUndefined()
    // Nor a task link on a cleaning log, or a link to nothing.
    expect(addLog({ userId: 'user-7', listingId: first!.listingId, type: 'task', taskId: first!.id, title: 'x', date: first!.date, durationMinutes: 30 })).toBeUndefined()
    expect(addLog({ userId: 'user-7', listingId: 'lst-1', type: 'cleaning', cleaningType: 'daily', cleaningJobId: 'no-such-job', title: '', date: first!.date, durationMinutes: 30 })).toBeUndefined()
    // Someone else's job: a job only Ketut did cannot be logged by Ni Putu.
    const ketutOnly = finishedWorkFor('user-7').find(w => !jobs.value.find(j => j.id === w.id)!.cleanerIds.includes('user-6'))
    expect(ketutOnly).toBeDefined()
    expect(addLog({ userId: 'user-6', listingId: ketutOnly!.listingId, type: 'cleaning', cleaningType: ketutOnly!.cleaningType, cleaningJobId: ketutOnly!.id, title: '', date: ketutOnly!.date, durationMinutes: 30 })).toBeUndefined()

    removeLog(log.id)
    expect(logs.value.some(l => l.id === log.id)).toBe(false)
    expect(finishedWorkFor('user-7').some(w => w.id === first!.id)).toBe(true)
  })

  it('offers a person the tasks they completed, with no time, and needs the task\'s listing', () => {
    const { finishedWorkFor, addLog } = useActivityReport()
    const { addTask } = useTaskStore()
    const listingName = listings.value.find(l => l.id === 'lst-2')!.name
    const base = { title: 'Fix gate latch', status: 'completed' as const, priority: 'medium', assignee: 'Made Surya', assigneeType: 'person' as const, listing: listingName }
    const done = addTask({ ...base, statusUpdates: [{ date: '2026-10-14T09:30:00Z', kind: 'completed' }] })
    addTask({ ...base, title: 'Still open', status: 'in progress' })
    addTask({ ...base, title: 'For a role', assigneeType: 'role', assignee: 'maintenance' })
    addTask({ ...base, title: 'Unknown listing', listing: 'Nowhere Villa' })
    addTask({ ...base, title: 'Someone else', assignee: 'Wayan Adi' })

    const work = finishedWorkFor('user-2')
    expect(work.map(w => w.title)).toEqual(['Fix gate latch'])
    expect(work[0]).toMatchObject({ kind: 'task', id: done.id, type: 'task', listingId: 'lst-2', date: toLocalDateKey(new Date('2026-10-14T09:30:00Z')) })
    expect(work[0]!.minutes).toBeUndefined()

    const log = addLog({ userId: 'user-2', listingId: 'lst-2', type: 'task', taskId: done.id, title: 'Fix gate latch', date: work[0]!.date, durationMinutes: 40 })!
    expect(log.taskId).toBe(done.id)
    expect(finishedWorkFor('user-2')).toEqual([])
  })

  it('keeps cleaning to housekeeping roles', () => {
    const { logs, loggableTypesFor, shownTypesFor, addLog } = useActivityReport()
    const { getUser } = useUsers()

    const cleaners = new Set(logs.value.filter(l => l.type === 'cleaning').map(l => l.userId))
    expect(cleaners.size).toBeGreaterThan(0)
    for (const id of cleaners)
      expect(['role-housekeeping', 'role-housekeeping-manager']).toContain(getUser(id)!.roleId)

    expect(loggableTypesFor('user-7')).toEqual(['cleaning', 'task', 'tracker']) // Housekeeping
    expect(loggableTypesFor('user-6')).toEqual(['cleaning', 'task', 'tracker']) // Housekeeping Manager
    expect(loggableTypesFor('user-1')).toEqual(['task', 'tracker']) // Guest Experience Manager
    expect(shownTypesFor('user-2')).toEqual(['task', 'tracker'])
    expect(shownTypesFor('user-7')).toContain('cleaning')

    const input = { listingId: 'lst-1', title: 'Clean', date: todayKey(), durationMinutes: 30 }
    expect(addLog({ ...input, userId: 'user-2', type: 'cleaning', cleaningType: 'daily' })).toBeUndefined()
    expect(addLog({ ...input, userId: 'user-7', type: 'cleaning', cleaningType: 'daily' })).toMatchObject({ type: 'cleaning', manual: true })
  })

  it('still shows a type someone already has logs for, even if their role no longer allows it', () => {
    const { logs, shownTypesFor, loggableTypesFor } = useActivityReport()
    const sample = logs.value.find(l => l.userId === 'user-2')!
    logs.value = [...logs.value, { ...sample, id: 'legacy-cleaning', type: 'cleaning' }]
    expect(loggableTypesFor('user-2')).not.toContain('cleaning')
    expect(shownTypesFor('user-2')).toContain('cleaning')
  })

  it('seeds logs only for days up to today', () => {
    const { logs } = useActivityReport()
    expect(logs.value.length).toBeGreaterThan(0)
    expect(logs.value.every(l => l.date <= todayKey())).toBe(true)
  })

  it('totals each staff row from its own logs, busiest first', () => {
    const { staffRows, logs } = useActivityReport()
    const rows = staffRows(wide, { includeOtherTenants: true })
    expect(rows.length).toBeGreaterThan(1)
    for (const row of rows) {
      const own = logs.value.filter(l => l.userId === row.userId)
      expect(row.count).toBe(own.length)
      expect(row.minutes).toBe(own.reduce((s, l) => s + l.durationMinutes, 0))
      expect(row.daily.reduce((a, b) => a + b, 0)).toBe(row.minutes)
    }
    expect(rows.map(r => r.minutes)).toEqual([...rows.map(r => r.minutes)].sort((a, b) => b - a))
  })

  it('keeps active people with nothing logged, and counts the working days they missed', () => {
    const { staffRows } = useActivityReport()
    const range = { from: '2000-01-03', to: '2000-01-08' } // Monday to Saturday, long before the data
    const rows = staffRows(range)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(r => r.count === 0 && r.minutes === 0)).toBe(true)
    expect(rows.every(r => r.missingDays === 6)).toBe(true)
  })

  it('leaves out a person who is inactive and logged nothing in the range', () => {
    const { staffRows } = useActivityReport()
    const inactive = staffRows({ from: '2000-01-03', to: '2000-01-08' }).find(r => r.name === 'Gede Pratama')
    expect(inactive).toBeUndefined()
  })

  it('targets hours per day times working days, never counting Sundays', () => {
    const { targetMinutes } = useActivityReport()
    // user-1 works 8h a day. 2000-01-03 (Mon) to 2000-01-09 (Sun) has six working days.
    expect(targetMinutes('user-1', { from: '2000-01-03', to: '2000-01-09' })).toBe(8 * 60 * 6)
  })

  it('filters by name, role and listing', () => {
    const { staffRows, logs } = useActivityReport()
    const all = staffRows(wide)
    const byName = staffRows(wide, { query: 'ketut' })
    expect(byName.map(r => r.name)).toEqual(['Ketut Antara'])

    const role = all[0]!.roleId
    expect(staffRows(wide, { roleId: role }).every(r => r.roleId === role)).toBe(true)

    const listingId = logs.value.find(l => l.userId === 'user-7')!.listingId
    const atListing = staffRows(wide, { listingId, includeOtherTenants: true })
    expect(atListing.length).toBeGreaterThan(0)
    for (const row of atListing) {
      const own = logs.value.filter(l => l.userId === row.userId && l.listingId === listingId)
      expect(row.count).toBe(own.length)
      expect(row.targetMinutes).toBe(0)
    }
  })

  it('splits the total by type and compares with the period before', () => {
    const { totals, staffRows, earliestDate } = useActivityReport()
    const range = { from: toLocalDateKey(new Date(Date.now() - 6 * 864e5)), to: todayKey() }
    const t = totals(range)
    expect(t.byType.cleaning + t.byType.task + t.byType.tracker).toBe(t.minutes)
    expect(t.count).toBe(staffRows(range).reduce((s, r) => s + r.count, 0))
    expect(t.previous).toBeDefined()
    // Starting at the first logged day, the history does not reach back far enough to compare.
    expect(totals({ from: earliestDate.value!, to: todayKey() }).previous).toBeUndefined()
  })

  it('groups a person by day, newest first, and folds the same work into one row', () => {
    const { dayGroups, listingSummary, staffRows } = useActivityReport()
    const userId = staffRows(wide)[0]!.userId
    const groups = dayGroups(userId, wide)
    expect(groups.map(g => g.date)).toEqual([...groups.map(g => g.date)].sort().reverse())
    for (const g of groups) {
      expect(g.rows.reduce((s, r) => s + r.logs.length, 0)).toBe(g.count)
      expect(g.rows.reduce((s, r) => s + r.minutes, 0)).toBe(g.minutes)
      for (const r of g.rows)
        expect(new Set(r.logs.map(l => `${l.type}|${l.title}|${l.listingId}`)).size).toBe(1)
    }
    const total = groups.reduce((s, g) => s + g.minutes, 0)
    expect(listingSummary(userId, wide).reduce((s, l) => s + l.minutes, 0)).toBe(total)
  })

  it('filters a person\'s logs by type and search text', () => {
    const { dayGroups } = useActivityReport()
    const cleaning = dayGroups('user-7', wide, { types: ['cleaning'] })
    expect(cleaning.flatMap(g => g.rows.flatMap(r => r.logs)).every(l => l.type === 'cleaning')).toBe(true)
    const none = dayGroups('user-7', wide, { query: 'zzz-no-such-work' })
    expect(none).toEqual([])
  })

  it('returns a value for every day of the range, empty days included', () => {
    const { dailySeries } = useActivityReport()
    const series = dailySeries('user-7', { from: '2000-01-01', to: '2000-01-07' })
    expect(series).toHaveLength(7)
    expect(series.every(p => p.minutes === 0)).toBe(true)
    expect(series.find(p => p.date === '2000-01-02')!.workDay).toBe(false) // a Sunday
  })

  it('edits, deletes and adds one log, keeping the others and writing the history', () => {
    const { logs, updateLog, removeLog, addLog, auditFor } = useActivityReport()
    const [first, second] = logs.value
    const userId = first!.userId

    updateLog(first!.id, { durationMinutes: 95, notes: '  Extra linen  ' })
    const edited = logs.value.find(l => l.id === first!.id)!
    expect(edited).toMatchObject({ durationMinutes: 95, notes: 'Extra linen' })
    expect(edited.editedAt).toBeTruthy()
    expect(edited.editedBy).toBeTruthy()
    expect(logs.value.find(l => l.id === second!.id)).toEqual(second)

    // An edit that changes nothing writes nothing.
    const before = auditFor(userId).length
    updateLog(first!.id, { durationMinutes: 95, notes: 'Extra linen' })
    expect(auditFor(userId)).toHaveLength(before)

    const count = logs.value.length
    removeLog(first!.id)
    expect(logs.value).toHaveLength(count - 1)

    const added = addLog({ userId, listingId: first!.listingId, type: 'task', title: ' Restock ', date: todayKey(), durationMinutes: 45 })!
    expect(added).toMatchObject({ title: 'Restock', manual: true, durationMinutes: 45 })
    expect(logs.value.some(l => l.id === added.id)).toBe(true)

    const actions = auditFor(userId).map(a => a.action)
    expect(actions).toEqual(expect.arrayContaining(['added', 'deleted', 'edited']))
    expect(auditFor(userId)[0]!.action).toBe('added') // newest first
    expect(auditFor('user-nobody')).toEqual([])
  })

  it('refuses to add time to a listing that does not exist', () => {
    const { addLog, logs } = useActivityReport()
    const count = logs.value.length
    expect(addLog({ userId: 'user-1', listingId: 'lst-missing', type: 'task', title: 'x', date: todayKey(), durationMinutes: 10 })).toBeUndefined()
    expect(logs.value).toHaveLength(count)
  })

  it('flags a log that took clearly longer than usual for the same work', () => {
    const { logs, isLong, addLog } = useActivityReport()
    const sample = logs.value.find(l => logs.value.filter(o => o.type === l.type && o.title === l.title).length >= 5)!
    const long = addLog({ userId: sample.userId, listingId: sample.listingId, type: sample.type, cleaningType: sample.cleaningType, title: sample.title, date: todayKey(), durationMinutes: 600 })!
    expect(isLong(long)).toBe(true)
    expect(isLong({ ...sample, durationMinutes: 1 })).toBe(false)
  })
})
