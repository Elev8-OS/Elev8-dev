/**
 * Tenant-level revenue engine settings (spec §15.7): objective basis default,
 * graduated autonomy per room or tag, blackout dates, channel markups,
 * substitution groups, cost defaults and the events-and-season calendar.
 *
 * Pure functions, types and the seed. State lives in `useRevenueSettings`.
 * Provider connect and room mapping stay with the PriceLabs integration.
 */
import type { ObjectiveBasis } from '~/components/revenue/data/health'
import type { RevenueRoom } from '~/components/revenue/data/revenue-policy'

// ── Autonomy (§23.3) ────────────────────────────────────────────────────

/**
 * `graduated`: auto-apply within the band the room has earned.
 * `review`: never auto-apply, every finding waits for a person.
 */
export type AutonomyMode = 'graduated' | 'review'

export const autonomyModeLabels: Record<AutonomyMode, string> = {
  graduated: 'Graduated auto-apply',
  review: 'Review every change',
}

export type AutonomyScope = { kind: 'tag', tag: string } | { kind: 'room', roomKey: string }

export interface AutonomyRule {
  id: string
  scope: AutonomyScope
  mode: AutonomyMode
  /** The widest band this scope may ever earn, percent. Null ⇒ the default ceiling. */
  maxBandPct: number | null
}

export interface AutonomySettings {
  mode: AutonomyMode
  /** Where a new room starts, percent either side of the current price. */
  startBandPct: number
  /** The widest band any room may earn. */
  maxBandPct: number
  rules: AutonomyRule[]
}

export interface EffectiveAutonomy {
  mode: AutonomyMode
  maxBandPct: number
  /** The rule that decided it, null when the default did. */
  rule: AutonomyRule | null
}

/** A room rule beats a tag rule beats the default. Among tag rules the stricter one wins. */
export function effectiveAutonomy(settings: AutonomySettings, room: Pick<RevenueRoom, 'key' | 'tags'>): EffectiveAutonomy {
  const roomRule = settings.rules.find(r => r.scope.kind === 'room' && r.scope.roomKey === room.key)
  const tagRules = settings.rules.filter(r => r.scope.kind === 'tag' && room.tags.includes(r.scope.tag))
  const strictest = [...tagRules].sort((a, b) => strictness(b, settings) - strictness(a, settings))[0]
  const rule = roomRule ?? strictest ?? null
  if (!rule)
    return { mode: settings.mode, maxBandPct: settings.maxBandPct, rule: null }
  return { mode: rule.mode, maxBandPct: Math.min(rule.maxBandPct ?? settings.maxBandPct, settings.maxBandPct), rule }
}

function strictness(rule: AutonomyRule, settings: AutonomySettings): number {
  if (rule.mode === 'review')
    return 1000
  return 100 - (rule.maxBandPct ?? settings.maxBandPct)
}

// ── Blackout dates ──────────────────────────────────────────────────────

/** Dates the engine never auto-applies on. Findings still show; a person decides. */
export interface Blackout {
  id: string
  label: string
  from: string
  to: string
  /** Empty ⇒ every room. */
  tags: string[]
}

// ── Channel markups (§12 step 8) ────────────────────────────────────────

export interface ChannelMarkup {
  id: string
  channel: string
  /** Null ⇒ every room on this channel. A room markup replaces the channel one. */
  roomKey: string | null
  adjustPct: number
  active: boolean
}

export const DIRECT_CHANNEL = 'Direct'

/** The markup a room gets on a channel: its own, else the channel's, else none. */
export function effectiveMarkup(markups: ChannelMarkup[], channel: string, roomKey: string): ChannelMarkup | null {
  const live = markups.filter(m => m.active && m.channel === channel)
  return live.find(m => m.roomKey === roomKey) ?? live.find(m => m.roomKey === null) ?? null
}

// ── Cost defaults (§22.1) ───────────────────────────────────────────────

/** Money defaults are kept per currency: a cost is never converted into another one. */
export interface CurrencyCostDefaults {
  housekeepingRatePerHour: number
  consumablesPerStay: number
}

export interface CostDefaults {
  byCurrency: Record<string, CurrencyCostDefaults>
  /** Used when a listing has no measured cleanings yet. */
  defaultCleaningMinutes: number
  paymentPct: number
  commissionByChannel: Record<string, number>
}

// ── Events and season calendar ──────────────────────────────────────────

export type CalendarEventKind = 'event' | 'holiday' | 'season'
export type DemandImpact = 'high' | 'medium' | 'low'

export const eventKindLabels: Record<CalendarEventKind, string> = {
  event: 'Event',
  holiday: 'Holiday',
  season: 'Season',
}

export const impactLabels: Record<DemandImpact, string> = {
  high: 'High demand',
  medium: 'Medium demand',
  low: 'Low demand',
}

export interface CalendarEvent {
  id: string
  name: string
  kind: CalendarEventKind
  from: string
  to: string
  impact: DemandImpact
  /** A location from the listings, or null for every area. */
  area: string | null
  /** Elev8 curates a shared calendar; a tenant adds its own on top. */
  source: 'elev8' | 'tenant'
  /** Curated rows a tenant chose not to use. */
  hidden: boolean
}

export type ReviewCadence = 'monthly' | 'quarterly'

export const cadenceLabels: Record<ReviewCadence, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

export interface CalendarReview {
  cadence: ReviewCadence
  ownerId: string | null
  lastReviewedAt: string | null
}

/** The date the next review is due, `YYYY-MM-DD`. Never reviewed ⇒ due now. */
export function nextReviewDue(review: CalendarReview, today: string): string {
  if (!review.lastReviewedAt)
    return today
  const [y, m, d] = review.lastReviewedAt.slice(0, 10).split('-').map(Number)
  const due = new Date(y!, (m! - 1) + (review.cadence === 'monthly' ? 1 : 3), d!)
  const mm = String(due.getMonth() + 1).padStart(2, '0')
  const dd = String(due.getDate()).padStart(2, '0')
  return `${due.getFullYear()}-${mm}-${dd}`
}

// ── Substitution groups (§22.3) ─────────────────────────────────────────

export interface SubstitutionGroup {
  key: string
  name: string
  roomKeys: string[]
  /** True when the tenant moved a room in or out, or renamed it. */
  adjusted: boolean
}

export interface SubstitutionAdjustments {
  /** Room → group key, or `none` to keep it out of every group. */
  moves: Record<string, string>
  names: Record<string, string>
}

/** Bedrooms in bands, so a 2BR and a 3BR villa in the same area compete. */
function bedroomBand(bedrooms: number): string {
  if (bedrooms <= 1)
    return 'Studio and 1BR'
  if (bedrooms <= 3)
    return '2 to 3BR'
  return '4BR and up'
}

function groupKeyFor(room: RevenueRoom): string {
  return `${room.location}|${bedroomBand(room.bedrooms)}`
}

/**
 * Rooms that compete for the same guest: same area, same bedroom band. Only
 * groups of two or more are kept; a room alone competes with nobody. The
 * tenant's moves and names are laid over the derived result.
 */
export function substitutionGroups(rooms: RevenueRoom[], adjustments: SubstitutionAdjustments): SubstitutionGroup[] {
  const groups = new Map<string, SubstitutionGroup>()
  const touched = new Set<string>(Object.keys(adjustments.names))
  for (const room of rooms) {
    const derived = groupKeyFor(room)
    const key = adjustments.moves[room.key] ?? derived
    if (key !== derived) {
      touched.add(derived)
      touched.add(key)
    }
    if (key === 'none')
      continue
    const group = groups.get(key) ?? { key, name: groupName(key, adjustments), roomKeys: [], adjusted: false }
    groups.set(key, { ...group, roomKeys: [...group.roomKeys, room.key] })
  }
  return [...groups.values()]
    .map(g => ({ ...g, adjusted: touched.has(g.key) }))
    .filter(g => g.roomKeys.length >= 2 || (g.adjusted && g.roomKeys.length > 0))
}

function groupName(key: string, adjustments: SubstitutionAdjustments): string {
  if (adjustments.names[key])
    return adjustments.names[key]!
  const [location, band] = key.split('|')
  return band ? `${location} · ${band}` : 'Custom group'
}

// ── The whole settings object ───────────────────────────────────────────

export interface RevenueSettings {
  defaultBasis: ObjectiveBasis
  autonomy: AutonomySettings
  blackouts: Blackout[]
  markups: ChannelMarkup[]
  substitution: SubstitutionAdjustments
  costs: CostDefaults
  events: CalendarEvent[]
  review: CalendarReview
}

/** Dates relative to today, so the seed never sits in the past. */
function seedDate(today: Date, monthOffset: number, day: number): string {
  const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function seedRevenueSettings(today = new Date()): RevenueSettings {
  return {
    defaultBasis: 'revenue',
    autonomy: {
      mode: 'graduated',
      startBandPct: 3,
      maxBandPct: 12,
      rules: [],
    },
    blackouts: [
      { id: 'bo-nye', label: 'Christmas and New Year', from: seedDate(today, 2, 20), to: seedDate(today, 3, 5), tags: [] },
    ],
    markups: [
      { id: 'mk-airbnb', channel: 'Airbnb', roomKey: null, adjustPct: 3, active: true },
      { id: 'mk-booking', channel: 'Booking.com', roomKey: null, adjustPct: 15, active: true },
    ],
    substitution: { moves: {}, names: {} },
    costs: {
      byCurrency: {
        USD: { housekeepingRatePerHour: 6, consumablesPerStay: 12 },
        IDR: { housekeepingRatePerHour: 75000, consumablesPerStay: 150000 },
      },
      defaultCleaningMinutes: 120,
      paymentPct: 2.9,
      commissionByChannel: { 'Airbnb': 15, 'Booking.com': 18, 'Vrbo': 8, [DIRECT_CHANNEL]: 0 },
    },
    events: [
      { id: 'ev-ubud-writers', name: 'Ubud Writers and Readers Festival', kind: 'event', from: seedDate(today, 0, 28), to: seedDate(today, 1, 1), impact: 'medium', area: null, source: 'elev8', hidden: false },
      { id: 'ev-peak', name: 'Christmas and New Year peak', kind: 'season', from: seedDate(today, 2, 18), to: seedDate(today, 3, 6), impact: 'high', area: null, source: 'elev8', hidden: false },
      { id: 'ev-au-summer', name: 'Australian summer school holidays', kind: 'season', from: seedDate(today, 2, 18), to: seedDate(today, 3, 27), impact: 'high', area: null, source: 'elev8', hidden: false },
      { id: 'ev-galungan', name: 'Galungan to Kuningan', kind: 'holiday', from: seedDate(today, 3, 13), to: seedDate(today, 3, 23), impact: 'medium', area: null, source: 'elev8', hidden: false },
      { id: 'ev-cny', name: 'Chinese New Year', kind: 'holiday', from: seedDate(today, 4, 5), to: seedDate(today, 4, 11), impact: 'high', area: null, source: 'elev8', hidden: false },
      { id: 'ev-nyepi', name: 'Nyepi (island closed)', kind: 'holiday', from: seedDate(today, 5, 8), to: seedDate(today, 5, 9), impact: 'low', area: null, source: 'elev8', hidden: false },
      { id: 'ev-wet', name: 'Wet season shoulder', kind: 'season', from: seedDate(today, 4, 12), to: seedDate(today, 6, 15), impact: 'low', area: null, source: 'elev8', hidden: false },
    ],
    review: { cadence: 'quarterly', ownerId: 'staff-2', lastReviewedAt: seedDate(today, -2, 3) },
  }
}

/** Every location, tag and channel a setting can point at. */
export function channelOptions(rooms: RevenueRoom[]): string[] {
  return [...new Set([...rooms.flatMap(r => r.channels), DIRECT_CHANNEL])].sort((a, b) =>
    a === DIRECT_CHANNEL ? 1 : b === DIRECT_CHANNEL ? -1 : a.localeCompare(b))
}
