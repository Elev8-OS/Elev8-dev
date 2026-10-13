/**
 * A task's Title is typed in the New Task form (at most `TASK_TITLE_MAX`
 * characters). When the form opens prefilled with instructions only (a task
 * raised from inbox messages), it suggests their first line as the title.
 */
export const TASK_TITLE_MAX = 80

export function taskTitleFromInstructions(instructions: string): string {
  const firstLine = instructions
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .find(line => line.length > 0) ?? ''
  return firstLine.length > TASK_TITLE_MAX
    ? `${firstLine.slice(0, TASK_TITLE_MAX - 1)}…`
    : firstLine
}
