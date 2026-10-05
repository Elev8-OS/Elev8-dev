/**
 * Custom tabs on the listing detail page: a name and a web address, opened
 * inside the page as a frame (a Google Sheet, a Notion page, an owner's
 * dashboard). Stored per listing on `Listing.customTabs`, read through
 * `listingCustomTabs`.
 */
export interface ListingCustomTab {
  id: string
  name: string
  /** Absolute http(s) address, normalised by `normalizeTabUrl`. */
  url: string
}

export const CUSTOM_TAB_NAME_MAX = 30
/** Tab values on the page are `custom:<id>`, so `?tab=custom:<id>` opens one. */
export const CUSTOM_TAB_PREFIX = 'custom:'

export function listingCustomTabs(listing: { customTabs?: ListingCustomTab[] } | null | undefined): ListingCustomTab[] {
  return [...(listing?.customTabs ?? [])]
}

export function customTabValue(tab: Pick<ListingCustomTab, 'id'>): string {
  return `${CUSTOM_TAB_PREFIX}${tab.id}`
}

/**
 * The address as typed, made absolute: "docs.google.com/x" becomes
 * "https://docs.google.com/x". Returns null for anything that is not an
 * http(s) address with a host, so `javascript:` and the like never reach the frame.
 */
export function normalizeTabUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw)
    return null
  const withScheme = /^[a-z][a-z\d+.-]*:(?!\d)/i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      return null
    if (!url.hostname || (!url.hostname.includes('.') && url.hostname !== 'localhost'))
      return null
    return url.toString()
  }
  catch {
    return null
  }
}

/** The host shown under a tab's name, e.g. "docs.google.com". */
export function customTabHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  }
  catch {
    return url
  }
}

/** Adds a tab, or replaces the one with the same id. Returns a new list. */
export function saveCustomTab(tabs: ListingCustomTab[], tab: ListingCustomTab): ListingCustomTab[] {
  return tabs.some(t => t.id === tab.id)
    ? tabs.map(t => t.id === tab.id ? { ...tab } : t)
    : [...tabs, { ...tab }]
}

export function removeCustomTab(tabs: ListingCustomTab[], id: string): ListingCustomTab[] {
  return tabs.filter(t => t.id !== id)
}

/** Moves a tab one place left (-1) or right (1). Returns a new list. */
export function moveCustomTab(tabs: ListingCustomTab[], id: string, direction: -1 | 1): ListingCustomTab[] {
  const from = tabs.findIndex(t => t.id === id)
  const to = from + direction
  if (from === -1 || to < 0 || to >= tabs.length)
    return tabs
  const next = [...tabs]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  return next
}
