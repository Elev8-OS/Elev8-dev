/**
 * A task has no Title field of its own: the title (what the table, the
 * detail sheet and a room's "task created" line show) is the first line of
 * its Instructions, trimmed to fit a table row.
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
