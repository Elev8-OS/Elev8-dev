// app/composables/useScheduleUndo.ts
import { toast } from 'vue-sonner'
import { useSchedule } from '~/composables/useSchedule'

/** How long the Undo stays on the toast. */
const UNDO_MS = 8000

/**
 * Runs a change to the schedule and tells the person what happened, with an Undo.
 * - If the change is refused (it returns a reason), everything it did is put back, the reason is shown
 *   with "Nothing was saved.", and the reason is returned.
 * - Otherwise a toast says it is done, with an Undo button. Undo puts the schedule back as it was, unless
 *   something else was changed since: then it says so instead of overwriting that change.
 */
export function useScheduleUndo() {
  const { snapshot, restoreSnapshot, changeId, bumpChange } = useSchedule()

  /** `message` can be a function, for a message that needs what the change found out (a count). */
  function run(message: string | (() => string), change: () => string | undefined | void): string | undefined {
    const before = snapshot()
    const problem = change() || undefined
    if (problem) {
      restoreSnapshot(before)
      toast.error(problem, { description: 'Nothing was saved.' })
      return problem
    }
    const mine = bumpChange()
    toast.success(typeof message === 'function' ? message() : message, {
      duration: UNDO_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          if (changeId.value !== mine) {
            toast.info('Something else was changed after this, so it can no longer be undone here.')
            return
          }
          restoreSnapshot(before)
          bumpChange()
          toast.info('Undone')
        },
      },
    })
    return undefined
  }

  return { run }
}
