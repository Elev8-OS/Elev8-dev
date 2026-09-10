/**
 * Deterministic per-name avatar colour, so the same person keeps the same colour
 * everywhere they appear and a reader recognises them across a table and a
 * detail panel without reading the name again.
 *
 * This lived as three byte-identical copies (the reservations guest cell, the
 * users table and the owners table) before it was extracted. Keep it here: a
 * fourth copy that drifts would give one person two colours.
 */
export const AVATAR_COLORS = [
  'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  'bg-lime-500/10 text-lime-700 dark:text-lime-300',
]

/** Up to two initials, e.g. "Emily Chen" becomes "EC". */
export function initials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function avatarColorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!
}
