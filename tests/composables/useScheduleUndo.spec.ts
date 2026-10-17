import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSchedule } from '~/composables/useSchedule'
import { useScheduleUndo } from '~/composables/useScheduleUndo'

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: toasts }))

beforeEach(() => {
  localStorage.clear()
  toasts.success.mockClear()
  toasts.error.mockClear()
  toasts.info.mockClear()
})

const undoOf = () => toasts.success.mock.calls.at(-1)![1].action.onClick as () => void

describe('useScheduleUndo', () => {
  it('says what was done with an Undo that puts the schedule back', () => {
    const { run } = useScheduleUndo()
    const { setDayOff, overrides, isWorkDay } = useSchedule()
    overrides.value = []
    expect(run('Made Surya: 1 day updated', () => setDayOff('user-8', ['2026-10-14'], { type: 'leave' }))).toBeUndefined()
    expect(isWorkDay('user-8', '2026-10-14')).toBe(false)
    expect(toasts.success).toHaveBeenCalledWith('Made Surya: 1 day updated', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }))
    undoOf()()
    expect(isWorkDay('user-8', '2026-10-14')).toBe(true)
    expect(toasts.info).toHaveBeenCalledWith('Undone')
  })

  it('puts everything back and says nothing was saved when the change is refused', () => {
    const { run } = useScheduleUndo()
    const { setWorking, overrides } = useSchedule()
    overrides.value = []
    const problem = run('Saved', () => {
      setWorking('user-8', ['2026-10-14'], { shiftId: 'shift-night' })
      // A second change in the same run is refused: the first one goes too.
      return setWorking('user-8', ['2026-10-15'], { startTime: '05:00', endTime: '09:00' })
    })
    expect(problem).toMatch(/overnight shift runs until 06:00/)
    expect(overrides.value).toEqual([])
    expect(toasts.error).toHaveBeenCalledWith(expect.stringMatching(/Start .* or later/), { description: 'Nothing was saved.' })
    expect(toasts.success).not.toHaveBeenCalled()
  })

  it('will not undo over a change made after it', () => {
    const { run } = useScheduleUndo()
    const { setDayOff, isWorkDay, overrides } = useSchedule()
    overrides.value = []
    run('First', () => setDayOff('user-8', ['2026-10-14'], { type: 'leave' }))
    const firstUndo = undoOf()
    run('Second', () => setDayOff('user-8', ['2026-10-15'], { type: 'sick' }))
    firstUndo()
    expect(isWorkDay('user-8', '2026-10-14')).toBe(false)
    expect(toasts.info).toHaveBeenCalledWith(expect.stringMatching(/no longer be undone/))
    undoOf()()
    expect(isWorkDay('user-8', '2026-10-15')).toBe(true)
  })

  it('undoes a change to a role\'s hours and to the shift list as well', async () => {
    const { useRoles } = await import('~/composables/useRoles')
    const { run } = useScheduleUndo()
    const { setRoleHours, removeShift, shifts } = useSchedule()
    const { getRole } = useRoles()
    const before = JSON.stringify(getRole('role-pool')!.workingHours)
    run('Pool updated', () => setRoleHours('role-pool', { ...getRole('role-pool')!.workingHours, days: ['Mon'] }))
    undoOf()()
    expect(JSON.stringify(getRole('role-pool')!.workingHours)).toBe(before)
    const count = shifts.value.length
    run('Office deleted', () => { removeShift('shift-office') })
    expect(getRole('role-pool')!.workingHours.shiftIds).toBeUndefined()
    undoOf()()
    expect(shifts.value).toHaveLength(count)
    expect(getRole('role-pool')!.workingHours.shiftIds).toEqual(['shift-office'])
  })

  it('takes a message that needs what the change found out', () => {
    const { run } = useScheduleUndo()
    let n = 0
    run(() => `Copied ${n} changes`, () => { n = 3 })
    expect(toasts.success).toHaveBeenCalledWith('Copied 3 changes', expect.anything())
  })
})
