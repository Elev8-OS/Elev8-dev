import type { Listing } from './listings'
import { listings } from './listings'

/**
 * Managing the tags that already exist (the hero's Manage tags dialog). A tag
 * is a plain string on `Listing.tags`, shared by every listing that carries
 * it, so renaming or deleting one writes every listing that has it.
 * ⚠️ Other places keep tag names too (saved views, calendar filters, EUR on
 * the Lexware listings): they are not rewritten, and the dialog says so.
 */

/** How many listings carry the tag. */
export function tagUsage(tag: string): number {
  return listings.value.filter(l => l.tags.includes(tag)).length
}

/** Why `next` cannot replace `from`, or null. A different-case spelling of another tag counts as taken. */
export function tagRenameError(from: string, next: string): string | null {
  const name = next.trim()
  if (!name)
    return 'Enter a name.'
  if (name.length > 30)
    return 'Use 30 characters or fewer.'
  const clash = listings.value.flatMap(l => l.tags).some(t => t !== from && t.toLowerCase() === name.toLowerCase())
  return clash ? 'A tag with this name already exists.' : null
}

/** Why `name` cannot be a new tag, or null. A tag lives only on listings, so a new one is added to a listing. */
export function tagCreateError(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed)
    return 'Enter a name.'
  if (trimmed.length > 30)
    return 'Use 30 characters or fewer.'
  return listings.value.flatMap(l => l.tags).some(t => t.toLowerCase() === trimmed.toLowerCase())
    ? 'This tag already exists. Add it from the Add tag list.'
    : null
}

export function renameTagOn(listing: Listing, from: string, to: string): Listing {
  return listing.tags.includes(from) ? { ...listing, tags: listing.tags.map(t => t === from ? to : t) } : listing
}

export function deleteTagOn(listing: Listing, tag: string): Listing {
  return listing.tags.includes(tag) ? { ...listing, tags: listing.tags.filter(t => t !== tag) } : listing
}

/** Renames the tag on every listing. Returns how many listings changed, or 0 when the name is not allowed. */
export function renameTag(from: string, to: string): number {
  const name = to.trim()
  if (tagRenameError(from, name) || name === from)
    return 0
  const count = tagUsage(from)
  listings.value = listings.value.map(l => renameTagOn(l, from, name))
  return count
}

/** Removes the tag from every listing. Returns how many listings changed. */
export function deleteTag(tag: string): number {
  const count = tagUsage(tag)
  listings.value = listings.value.map(l => deleteTagOn(l, tag))
  return count
}
