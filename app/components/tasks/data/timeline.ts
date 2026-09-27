import type { StatusUpdate } from './schema'

/**
 * The sentence a task timeline entry reads as, after the actor's name:
 *
 *   Kadek Dwi Prayoga has created a new task for Apartments Pererenan Public
 *   Kadek Mia Pratiwi is 31% through the task
 *   Kadek Dwi Prayoga has completed the task
 *
 * Built from the entry's `kind`, never stored as text, so every entry of a
 * kind reads the same way. What the person typed is the entry's `note`, shown
 * UNDER the sentence. An entry with no kind (a quote sent, an owner's
 * decision) answers `null` and keeps its own note as its sentence.
 */
export function timelineSentence(
  entry: Pick<StatusUpdate, 'kind' | 'progress'>,
  task: { listing?: string },
): string | null {
  switch (entry.kind) {
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
