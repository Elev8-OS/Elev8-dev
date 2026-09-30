// A house rule is a title with an optional description (Property > Guest Guides
// > House Rules). Older guides stored plain strings; those read as a title only.

export interface HouseRule {
  title: string
  description?: string
}

/** Accepts one-line rules (`'No smoking'`) and titled rules (`{ title, description }`). */
export function normalizeHouseRules(value: unknown): HouseRule[] {
  if (!Array.isArray(value))
    return []
  return value.flatMap((entry): HouseRule[] => {
    if (typeof entry === 'string')
      return entry.trim() ? [{ title: entry.trim() }] : []
    if (entry && typeof entry === 'object') {
      const title = String((entry as HouseRule).title ?? '').trim()
      const description = String((entry as HouseRule).description ?? '').trim()
      return title ? [description ? { title, description } : { title }] : []
    }
    return []
  })
}
