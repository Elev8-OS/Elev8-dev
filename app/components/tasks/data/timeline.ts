import type { StatusUpdate, Task } from './schema'

/**
 * The sentence a task timeline entry reads as, after the actor's name:
 *
 *   Kadek Dwi Prayoga has created a new task for Apartments Pererenan Public
 *   Kadek Mia Pratiwi is 31% through the task
 *   Kadek Dwi Prayoga has completed the task
 *   Admin changed the title and due date
 *   Komang Juliantara reassigned the task to Made Surya
 *
 * Built from the entry's `kind`, never stored as text, so every entry of a
 * kind reads the same way. What the person typed is the entry's `note`, shown
 * UNDER the sentence. An entry with no kind (a quote sent, an owner's
 * decision) answers `null` and keeps its own note as its sentence.
 */
export function timelineSentence(
  entry: Pick<StatusUpdate, 'kind' | 'progress' | 'changes' | 'assignedTo' | 'actor'>,
  task: { listing?: string },
): string | null {
  switch (entry.kind) {
    case 'edited':
      return entry.changes?.length ? `changed the ${listWords(entry.changes)}` : 'edited the task'
    case 'reassigned':
      if (!entry.assignedTo)
        return 'unassigned the task'
      return entry.assignedTo === entry.actor?.name
        ? 'took over the task'
        : `reassigned the task to ${entry.assignedTo}`
    case 'created':
      return task.listing ? `has created a new task for ${task.listing}` : 'has created a new task'
    case 'progress':
      return `is ${entry.progress ?? 0}% through the task`
    case 'completed':
      return 'has completed the task'
    default:
      return null
  }
}

/** A progress update at 100% is the task being completed, not "100% through". */
export function progressKindFor(progress: number): 'progress' | 'completed' {
  return progress >= 100 ? 'completed' : 'progress'
}

/** "title", "title and due date", "title, priority and due date". */
function listWords(words: string[]): string {
  if (words.length <= 1)
    return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/**
 * When a completed task was completed: its last "completed" timeline entry,
 * else the last entry that reached 100%, else its last entry. Undefined while
 * the task is not completed.
 */
export function taskCompletedAt(task: Pick<Task, 'status' | 'statusUpdates'>): string | undefined {
  if (task.status !== 'completed')
    return undefined
  const updates = task.statusUpdates ?? []
  const done = [...updates].reverse().find(u => u.kind === 'completed')
    ?? [...updates].reverse().find(u => (u.progress ?? 0) >= 100)
    ?? updates[updates.length - 1]
  return done?.date
}
