import type { Task } from './schema'
import type { RoleId } from '~/components/users/data/roles'
import { assigneeOptions } from './data'

/**
 * Who may change a task after it is created.
 *
 * - **Edit** (title, instructions, listing, priority, due date, images): the
 *   person who created it, and admins / general managers.
 * - **Reassign**: the same people plus whoever holds the task now, so the
 *   assignee can hand it on without asking. A task assigned to a role (or to
 *   nobody) is anyone's to take or pass on. A reason is always required.
 * - A **completed** task is locked: neither applies.
 *
 * The creator is the actor on the task's "created" timeline entry; tasks store
 * names, not user ids, so people are matched by name.
 */
export const TASK_MANAGER_ROLES: RoleId[] = ['role-admin', 'role-general-manager']

export type AssigneeOption = typeof assigneeOptions[number]

export interface TaskActor {
  name: string
  roleId?: RoleId
}

export function taskCreatorName(task: Pick<Task, 'statusUpdates'>): string | undefined {
  return task.statusUpdates?.find(u => u.kind === 'created')?.actor?.name
}

export function assigneeLabel(value: string | undefined): string {
  if (!value)
    return 'Unassigned'
  return assigneeOptions.find(a => a.value === value)?.label ?? value
}

function isManagerOrCreator(task: Task, actor: TaskActor): boolean {
  if (actor.roleId && TASK_MANAGER_ROLES.includes(actor.roleId))
    return true
  return taskCreatorName(task) === actor.name
}

/** The task is assigned to this person (not to a role they may hold). */
export function isAssignedTo(task: Pick<Task, 'assignee' | 'assigneeType'>, actor: TaskActor): boolean {
  return task.assigneeType === 'person' && assigneeLabel(task.assignee) === actor.name
}

export function canEditTask(task: Task, actor: TaskActor | null | undefined): boolean {
  if (!actor || task.status === 'completed')
    return false
  return isManagerOrCreator(task, actor)
}

export function canReassignTask(task: Task, actor: TaskActor | null | undefined): boolean {
  if (!actor || task.status === 'completed')
    return false
  if (isManagerOrCreator(task, actor) || isAssignedTo(task, actor))
    return true
  // A role's (or nobody's) task belongs to no one person yet.
  return task.assigneeType !== 'person' || !task.assignee
}

/**
 * Where a task can be reassigned: every role, and every person who can work
 * on its listing. A person with a user record must have the listing in their
 * `listingIds`, unless they are a manager; a person without one (the
 * property owner's "You") is not limited. The current assignee is left out.
 */
export function reassignTargets(
  task: Pick<Task, 'assignee' | 'listing'>,
  ctx: {
    users: Array<{ name: string, roleId: RoleId, listingIds: string[] }>
    listings: Array<{ id: string, name: string }>
  },
): AssigneeOption[] {
  const listingId = task.listing ? ctx.listings.find(l => l.name === task.listing)?.id : undefined
  return assigneeOptions.filter((opt) => {
    if (opt.value === task.assignee)
      return false
    if (opt.type === 'role' || !listingId)
      return true
    const user = ctx.users.find(u => u.name === opt.label)
    if (!user || TASK_MANAGER_ROLES.includes(user.roleId))
      return true
    return user.listingIds.includes(listingId)
  })
}

/** The assignee option that is this person, for "Take this task". */
export function personOptionFor(actor: TaskActor | null | undefined): AssigneeOption | undefined {
  if (!actor)
    return undefined
  return assigneeOptions.find(o => o.type === 'person' && o.label === actor.name)
}
