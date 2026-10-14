import { ref } from 'vue'

/**
 * The Website channel: direct bookings on the tenant's own websites (built in
 * Website Builder) and booking widgets. It has no OTA account, so it lives
 * beside `CHANNELS`, not in it, and never writes `Listing.otaConnected`.
 *
 * The channel holds rule sets, the way an OTA holds accounts. A rule set is
 * assigned to websites, not listings: each website already says which listings
 * it sells. A website is in at most one rule set; a website in none gets no
 * Website discounts or rules.
 *
 * Promo codes are not part of a rule set: Promo Codes owns where a code works
 * (`channelRestriction`), and the rule set only shows the codes valid on its sites.
 *
 * Module-level ref, like `bookingWidgets`, so the widget preview builder can
 * read it outside setup. Imports nothing from Website Builder: rule sets only
 * hold website ids.
 */

export interface WebsiteStayDiscount {
  id: string
  minNights: number
  /** Percent off the stay. Percent only: listings sell in different currencies. */
  pct: number
}

/** Early bird: booked at least `days` before arrival. Last minute: booked within `days` of arrival. */
export interface WebsiteWindowDiscount {
  enabled: boolean
  days: number
  pct: number
}

export interface WebsiteRuleSet {
  id: string
  name: string
  websiteIds: string[]
  lengthOfStayDiscounts: WebsiteStayDiscount[]
  earlyBird: WebsiteWindowDiscount
  lastMinute: WebsiteWindowDiscount
  minNights: number
  /** null means no maximum. */
  maxNights: number | null
  minDaysBeforeArrival: number
  /** Weekdays (0 = Sunday). Empty means any day. */
  arrivalDays: number[]
  departureDays: number[]
  /** Percent of the stay charged at booking. */
  prepaymentPct: number
}

export interface WebsiteChannelState {
  enabled: boolean
  ruleSets: WebsiteRuleSet[]
}

export const WEBSITE_CHANNEL = {
  name: 'Website',
  icon: 'lucide:globe',
  description: 'Direct bookings on your own websites. Set discounts and stay rules per website.',
} as const

export function newRuleSet(name = ''): WebsiteRuleSet {
  return {
    id: `wrs-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    websiteIds: [],
    // A starting point most hosts keep; editable before the first save.
    lengthOfStayDiscounts: [
      { id: 'wlos-1', minNights: 7, pct: 10 },
      { id: 'wlos-2', minNights: 28, pct: 20 },
    ],
    earlyBird: { enabled: false, days: 60, pct: 5 },
    lastMinute: { enabled: false, days: 3, pct: 10 },
    minNights: 1,
    maxNights: null,
    minDaysBeforeArrival: 0,
    arrivalDays: [],
    departureDays: [],
    prepaymentPct: 30,
  }
}

export function cloneRuleSet(s: WebsiteRuleSet): WebsiteRuleSet {
  return {
    ...s,
    websiteIds: [...s.websiteIds],
    lengthOfStayDiscounts: s.lengthOfStayDiscounts.map(t => ({ ...t })),
    earlyBird: { ...s.earlyBird },
    lastMinute: { ...s.lastMinute },
    arrivalDays: [...s.arrivalDays],
    departureDays: [...s.departureDays],
  }
}

export function defaultWebsiteState(): WebsiteChannelState {
  return { enabled: false, ruleSets: [] }
}

export const websiteChannel = ref<WebsiteChannelState>(defaultWebsiteState())

export const WEBSITE_CHANNEL_STORAGE_KEY = 'elev8-website-channel'

/** Reads a saved state, dropping anything that does not look like one. */
export function parseWebsiteState(raw: string | null): WebsiteChannelState | null {
  if (!raw)
    return null
  try {
    const data = JSON.parse(raw) as Partial<WebsiteChannelState>
    if (typeof data.enabled !== 'boolean' || !Array.isArray(data.ruleSets))
      return null
    const fresh = newRuleSet()
    // Older saves may miss newer fields; fill them from a fresh rule set.
    const ruleSets = data.ruleSets
      .filter(r => r && typeof r.id === 'string' && Array.isArray(r.websiteIds))
      .map(({ promoCodeIds: _drop, ...r }: WebsiteRuleSet & { promoCodeIds?: unknown }) => ({ ...fresh, ...r }))
    return { enabled: data.enabled, ruleSets }
  }
  catch {
    return null
  }
}

/** The rule set a website books under, or undefined when it is in none. */
export function ruleSetForWebsite(state: WebsiteChannelState, websiteId: string): WebsiteRuleSet | undefined {
  return state.ruleSets.find(r => r.websiteIds.includes(websiteId))
}

/** The given websites that are in no rule set. */
export function unassignedWebsiteIds(state: WebsiteChannelState, allWebsiteIds: string[]): string[] {
  const taken = new Set(state.ruleSets.flatMap(r => r.websiteIds))
  return allWebsiteIds.filter(id => !taken.has(id))
}

/**
 * Inserts or replaces `set` and moves its websites out of every other rule set,
 * so a website is never in two. Pure: returns the new list.
 */
export function upsertRuleSet(ruleSets: WebsiteRuleSet[], saved: WebsiteRuleSet): WebsiteRuleSet[] {
  const claimed = new Set(saved.websiteIds)
  const others = ruleSets
    .filter(r => r.id !== saved.id)
    .map(r => r.websiteIds.some(id => claimed.has(id)) ? { ...r, websiteIds: r.websiteIds.filter(id => !claimed.has(id)) } : r)
  const index = ruleSets.findIndex(r => r.id === saved.id)
  if (index === -1)
    return [...others, saved]
  // Keep the position the set had.
  const out = [...others]
  out.splice(index, 0, saved)
  return out
}

export interface WebsiteSettingsIssue {
  field: string
  message: string
}

export function ruleSetIssues(s: WebsiteRuleSet, ruleSets: WebsiteRuleSet[]): WebsiteSettingsIssue[] {
  const issues: WebsiteSettingsIssue[] = []
  const name = s.name.trim()
  if (!name)
    issues.push({ field: 'name', message: 'Give the rule set a name.' })
  else if (ruleSets.some(r => r.id !== s.id && r.name.trim().toLowerCase() === name.toLowerCase()))
    issues.push({ field: 'name', message: `A rule set called "${name}" already exists.` })
  if (s.websiteIds.length === 0)
    issues.push({ field: 'websites', message: 'Pick at least one website.' })
  const seen = new Set<number>()
  for (const tier of s.lengthOfStayDiscounts) {
    if (!Number.isInteger(tier.minNights) || tier.minNights < 2)
      issues.push({ field: `los-${tier.id}`, message: 'A length of stay discount needs at least 2 nights.' })
    else if (seen.has(tier.minNights))
      issues.push({ field: `los-${tier.id}`, message: `Two discounts start at ${tier.minNights} nights.` })
    seen.add(tier.minNights)
    if (!(tier.pct > 0 && tier.pct < 100))
      issues.push({ field: `los-${tier.id}`, message: 'A discount must be between 0 and 100%.' })
  }
  for (const [key, rule, label] of [['earlyBird', s.earlyBird, 'Early bird'], ['lastMinute', s.lastMinute, 'Last minute']] as const) {
    if (!rule.enabled)
      continue
    if (!(rule.pct > 0 && rule.pct < 100))
      issues.push({ field: key, message: `${label} discount must be between 0 and 100%.` })
    if (!Number.isInteger(rule.days) || rule.days < 1)
      issues.push({ field: key, message: `${label} needs at least 1 day.` })
  }
  // Otherwise one booking would get both.
  if (s.earlyBird.enabled && s.lastMinute.enabled && s.lastMinute.days >= s.earlyBird.days)
    issues.push({ field: 'lastMinute', message: 'Last minute must end before early bird starts.' })
  if (!Number.isInteger(s.minNights) || s.minNights < 1)
    issues.push({ field: 'minNights', message: 'Minimum stay is at least 1 night.' })
  if (s.maxNights !== null && s.maxNights < s.minNights)
    issues.push({ field: 'maxNights', message: 'Maximum stay is shorter than the minimum.' })
  if (!Number.isInteger(s.minDaysBeforeArrival) || s.minDaysBeforeArrival < 0)
    issues.push({ field: 'minDaysBeforeArrival', message: 'Booking notice cannot be negative.' })
  if (!(s.prepaymentPct >= 0 && s.prepaymentPct <= 100))
    issues.push({ field: 'prepaymentPct', message: 'Prepayment must be between 0 and 100%.' })
  return issues
}

/** One line for cards and pickers, e.g. "2 stay discounts, up to 20%". */
export function ruleSetSummary(s: WebsiteRuleSet): string {
  const tiers = s.lengthOfStayDiscounts
  if (tiers.length === 0)
    return 'No length of stay discounts'
  return `${tiers.length} stay ${tiers.length === 1 ? 'discount' : 'discounts'}, up to ${Math.max(...tiers.map(t => t.pct))}%`
}
