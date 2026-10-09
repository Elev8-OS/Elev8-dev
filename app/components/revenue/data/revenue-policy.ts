/**
 * Revenue settings per room: the pricing policy (spec §6.2), the cost model
 * (§22.1) and the 90-day preview (§15.5).
 *
 * Pure functions and types only. State lives in `useRevenuePolicy`. A room is
 * a listing's unit, or the listing itself when it has no units.
 *
 * The policy is immutable and versioned: a save appends a new version, never
 * edits the last one, so the reconciler can diff versions and Apply can revert.
 */
import type { Listing } from '~/components/listings/data/listings'
import { getUnits, getUnitTypeForUnit, ratePlanNightlyRate } from '~/components/listings/data/listings'

export type Dow = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const DOWS: Dow[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const dowLabels: Record<Dow, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

export type RoundingMode = 'none' | 'nearest' | 'up' | 'psychological'

export const roundingLabels: Record<RoundingMode, string> = {
  none: 'No rounding',
  nearest: 'Round to nearest',
  up: 'Round up',
  psychological: 'Charm price (ends in 9)',
}

export interface OccupancyRule {
  id: string
  /** Look this many days ahead. */
  horizonDays: number
  occupancyFrom: number
  occupancyTo: number
  adjustPct: number
}

export interface LastMinuteRule {
  id: string
  daysFrom: number
  daysTo: number
  adjustPct: number
  minStay: number | null
}

export interface OrphanGapRule {
  enabled: boolean
  maxGapNights: number
  adjustPct: number
  minStay: number
}

export interface Season {
  id: string
  label: string
  from: string
  to: string
  adjustPct: number
  minStay: number | null
  minPrice: number | null
}

export interface LosTier {
  id: string
  nights: number
  adjustPct: number
}

export interface PricingPolicy {
  currency: string
  base: { price: number, minPrice: number, maxPrice: number }
  minStay: { default: number, byDow: Partial<Record<Dow, number>> }
  occupancy: OccupancyRule[]
  lastMinute: LastMinuteRule[]
  orphanGap: OrphanGapRule
  seasons: Season[]
  /** Multipliers, 1.0 = neutral. The UI edits them as a percentage. */
  dow: Partial<Record<Dow, number>>
  los: LosTier[]
  lengthDiscounts: { weeklyPct: number, monthlyPct: number }
  extraPerson: { enabled: boolean, threshold: number, feePerNight: number }
  checkInOut: { closedToArrival: Dow[], closedToDeparture: Dow[] }
  rounding: { mode: RoundingMode, step: number }
}

export interface PolicyVersion {
  version: number
  savedAt: string
  savedBy: string
  /** What caused it: a manual save, a restore, or a copy from another room. */
  note: string
  policy: PricingPolicy
}

/** One field of the cost model. `override` null ⇒ the derived value is used. */
export interface CostField {
  override: number | null
  confirmed: boolean
}

export type CostFieldKey = 'cleaningPerTurnover' | 'consumablesPerStay' | 'paymentPct' | 'fixedPerNight'

export interface RoomCostModel {
  fields: Record<CostFieldKey, CostField>
  /** Commission per channel, percent. */
  commission: Record<string, CostField>
}

/** A room the revenue settings can be set for. */
export interface RevenueRoom {
  /** `<listingId>` for a listing without units, else `<listingId>:<unitId>`. */
  key: string
  listingId: string
  unitId: string | null
  name: string
  /** The unit's own name, null for a listing without units. */
  unitName: string | null
  listingName: string
  location: string
  tags: string[]
  bedrooms: number
  capacity: number
  currency: string
  channels: string[]
  /** Starting base price, from the room's base rate plan. */
  seedRate: number
}

export function roomKey(listingId: string, unitId: string | null): string {
  return unitId ? `${listingId}:${unitId}` : listingId
}

/** Every room of every listing, in listing order. */
export function revenueRooms(all: Listing[]): RevenueRoom[] {
  return all.flatMap((listing): RevenueRoom[] => {
    const units = getUnits(listing)
    const base = {
      listingId: listing.id,
      listingName: listing.name,
      location: listing.location,
      tags: listing.tags,
      channels: listing.otaConnected,
    }
    if (units.length === 0) {
      return [{
        ...base,
        key: roomKey(listing.id, null),
        unitId: null,
        name: listing.name,
        unitName: null,
        bedrooms: 1,
        capacity: listing.capacity,
        currency: 'USD',
        seedRate: listing.pricing.nightlyRate,
      }]
    }
    return units.map((unit) => {
      const type = getUnitTypeForUnit(listing, unit.id)
      const plan = type?.pricing.ratePlans.find(p => p.isBase) ?? type?.pricing.ratePlans[0]
      return {
        ...base,
        key: roomKey(listing.id, unit.id),
        unitId: unit.id,
        name: units.length === 1 ? listing.name : `${listing.name} · ${unit.name}`,
        unitName: unit.name,
        bedrooms: type?.bedrooms ?? 1,
        capacity: type ? type.maxAdults + type.maxChildren : listing.capacity,
        currency: type?.pricing.currency ?? 'USD',
        channels: unit.otaConnected?.length ? unit.otaConnected : listing.otaConnected,
        seedRate: (plan ? ratePlanNightlyRate(plan) : 0) || listing.pricing.nightlyRate,
      }
    })
  })
}

let idCounter = 0
export function newId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

/** Round a money value for a currency: whole units for IDR, cents elsewhere. */
function roundMoney(value: number, currency: string): number {
  return currency === 'IDR' ? Math.round(value) : Math.round(value * 100) / 100
}

/**
 * A starting policy for a room nobody has set up yet: the base rate plan's
 * price, a floor at 70% and a ceiling at 200%, and nothing else switched on.
 */
export function defaultPolicy(room: Pick<RevenueRoom, 'currency' | 'seedRate'>): PricingPolicy {
  const base = room.seedRate > 0 ? room.seedRate : 100
  return {
    currency: room.currency,
    base: {
      price: base,
      minPrice: roundMoney(base * 0.7, room.currency),
      maxPrice: roundMoney(base * 2, room.currency),
    },
    minStay: { default: 2, byDow: {} },
    occupancy: [],
    lastMinute: [],
    orphanGap: { enabled: false, maxGapNights: 2, adjustPct: -10, minStay: 1 },
    seasons: [],
    dow: {},
    los: [],
    lengthDiscounts: { weeklyPct: 0, monthlyPct: 0 },
    extraPerson: { enabled: false, threshold: 2, feePerNight: 0 },
    checkInOut: { closedToArrival: [], closedToDeparture: [] },
    rounding: { mode: room.currency === 'IDR' ? 'nearest' : 'none', step: room.currency === 'IDR' ? 10000 : 1 },
  }
}

export function clonePolicy(policy: PricingPolicy): PricingPolicy {
  return JSON.parse(JSON.stringify(policy)) as PricingPolicy
}

export function policiesEqual(a: PricingPolicy, b: PricingPolicy): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export interface PolicyIssue {
  field: string
  message: string
}

/** Errors block saving. Overlapping seasons are a warning, see `seasonOverlaps`. */
export function validatePolicy(policy: PricingPolicy): PolicyIssue[] {
  const issues: PolicyIssue[] = []
  const { price, minPrice, maxPrice } = policy.base
  if (!(price > 0))
    issues.push({ field: 'base', message: 'Base price must be above 0.' })
  if (!(minPrice > 0))
    issues.push({ field: 'minPrice', message: 'Minimum price must be above 0.' })
  if (maxPrice <= minPrice)
    issues.push({ field: 'maxPrice', message: 'Maximum price must be above the minimum price.' })
  if (price < minPrice || price > maxPrice)
    issues.push({ field: 'base', message: 'Base price must sit between the minimum and maximum price.' })
  if (!Number.isInteger(policy.minStay.default) || policy.minStay.default < 1)
    issues.push({ field: 'minStay', message: 'Minimum stay must be at least 1 night.' })
  for (const season of policy.seasons) {
    if (!season.label.trim())
      issues.push({ field: `season-${season.id}`, message: 'Every season needs a name.' })
    if (!season.from || !season.to || season.from > season.to)
      issues.push({ field: `season-${season.id}`, message: `"${season.label || 'Season'}" ends before it starts.` })
  }
  for (const rule of policy.occupancy) {
    if (rule.occupancyFrom > rule.occupancyTo)
      issues.push({ field: `occupancy-${rule.id}`, message: 'An occupancy range runs backwards.' })
  }
  for (const rule of policy.lastMinute) {
    if (rule.daysFrom > rule.daysTo)
      issues.push({ field: `lastminute-${rule.id}`, message: 'A last-minute range runs backwards.' })
  }
  if (policy.extraPerson.enabled && policy.extraPerson.feePerNight < 0)
    issues.push({ field: 'extraPerson', message: 'Extra-person fee cannot be negative.' })
  return issues
}

/** Pairs of seasons whose dates overlap. Allowed, but the later one in the list wins. */
export function seasonOverlaps(seasons: Season[]): [Season, Season][] {
  const pairs: [Season, Season][] = []
  for (let i = 0; i < seasons.length; i++) {
    for (let j = i + 1; j < seasons.length; j++) {
      const a = seasons[i]!
      const b = seasons[j]!
      if (a.from && a.to && b.from && b.to && a.from <= b.to && b.from <= a.to)
        pairs.push([a, b])
    }
  }
  return pairs
}

// ── Dates ────────────────────────────────────────────────────────────────

/** Local `YYYY-MM-DD`; `toISOString()` would shift a UTC+8 midnight. */
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  next.setDate(next.getDate() + days)
  return next
}

export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, d ?? 1)
}

export function dowOf(d: Date): Dow {
  return DOWS[(d.getDay() + 6) % 7]!
}

// ── Preview ──────────────────────────────────────────────────────────────

export interface PreviewNight {
  date: string
  dow: Dow
  price: number
  minStay: number
  season: string | null
  /** Which bound the price was held at, if any. */
  clamped: 'floor' | 'ceiling' | null
  closedToArrival: boolean
  /** Rules that moved the price, in the order they fired. */
  steps: string[]
}

function applyRounding(value: number, rounding: PricingPolicy['rounding']): number {
  const step = rounding.step > 0 ? rounding.step : 1
  switch (rounding.mode) {
    case 'nearest':
      return Math.round(value / step) * step
    case 'up':
      return Math.ceil(value / step) * step
    case 'psychological': {
      const up = Math.ceil(value / 10) * 10
      return up - 1
    }
    default:
      return value
  }
}

function signedPct(pct: number): string {
  return `${pct > 0 ? '+' : ''}${pct}%`
}

/**
 * What these settings would charge, night by night, before the pricing engine
 * adds its market curve. This is the policy-derived fallback of the resolver
 * (§12 step 5): base × season × day of week × last minute, then floor and
 * ceiling, then rounding. Occupancy rules need live occupancy, so the preview
 * leaves them out and says so.
 */
export function previewPolicy(policy: PricingPolicy, from: Date, days = 90): PreviewNight[] {
  const nights: PreviewNight[] = []
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i)
    const date = isoDate(day)
    const dow = dowOf(day)
    const steps: string[] = []
    let price = policy.base.price
    let minStay = policy.minStay.byDow[dow] ?? policy.minStay.default

    // Later seasons in the list win an overlap.
    const season = [...policy.seasons].reverse().find(s => s.from && s.to && s.from <= date && date <= s.to) ?? null
    if (season) {
      if (season.adjustPct) {
        price *= 1 + season.adjustPct / 100
        steps.push(`${season.label} ${signedPct(season.adjustPct)}`)
      }
      if (season.minStay)
        minStay = season.minStay
    }

    const multiplier = policy.dow[dow]
    if (multiplier && multiplier !== 1) {
      price *= multiplier
      steps.push(`${dowLabels[dow]} ${signedPct(Math.round((multiplier - 1) * 100))}`)
    }

    const lastMinute = policy.lastMinute.find(r => i >= r.daysFrom && i <= r.daysTo)
    if (lastMinute) {
      if (lastMinute.adjustPct) {
        price *= 1 + lastMinute.adjustPct / 100
        steps.push(`Last minute ${signedPct(lastMinute.adjustPct)}`)
      }
      if (lastMinute.minStay)
        minStay = lastMinute.minStay
    }

    const floor = Math.max(policy.base.minPrice, season?.minPrice ?? 0)
    let clamped: PreviewNight['clamped'] = null
    if (price < floor) {
      price = floor
      clamped = 'floor'
    }
    else if (price > policy.base.maxPrice) {
      price = policy.base.maxPrice
      clamped = 'ceiling'
    }

    price = applyRounding(price, policy.rounding)
    nights.push({
      date,
      dow,
      price: roundMoney(price, policy.currency),
      minStay,
      season: season?.label ?? null,
      clamped,
      closedToArrival: policy.checkInOut.closedToArrival.includes(dow),
      steps,
    })
  }
  return nights
}

export interface PreviewSummary {
  average: number
  low: number
  high: number
  atFloor: number
  atCeiling: number
}

export function summarisePreview(nights: PreviewNight[]): PreviewSummary {
  if (nights.length === 0)
    return { average: 0, low: 0, high: 0, atFloor: 0, atCeiling: 0 }
  const prices = nights.map(n => n.price)
  return {
    average: prices.reduce((a, b) => a + b, 0) / prices.length,
    low: Math.min(...prices),
    high: Math.max(...prices),
    atFloor: nights.filter(n => n.clamped === 'floor').length,
    atCeiling: nights.filter(n => n.clamped === 'ceiling').length,
  }
}

// ── Provider capability ─────────────────────────────────────────────────

/** Policy sections and the provider capability that would carry them. */
export const SECTION_CAPABILITY: Record<string, string> = {
  basePrice: 'base_price',
  minPrice: 'min_price',
  maxPrice: 'max_price',
  minStay: 'min_stay',
  seasons: 'seasons',
  occupancy: 'occupancy_rules',
  los: 'los_discounts',
  extraPerson: 'extra_person_fee',
}

// ── Cost model ───────────────────────────────────────────────────────────

export const costFieldLabels: Record<CostFieldKey, string> = {
  cleaningPerTurnover: 'Cleaning per turnover',
  consumablesPerStay: 'Linen and consumables per stay',
  paymentPct: 'Payment processing',
  fixedPerNight: 'Fixed cost per night',
}

export function emptyCostModel(): RoomCostModel {
  const field = (): CostField => ({ override: null, confirmed: false })
  return {
    fields: {
      cleaningPerTurnover: field(),
      consumablesPerStay: field(),
      paymentPct: field(),
      fixedPerNight: field(),
    },
    commission: {},
  }
}

/** A cost value with where it came from, ready to render. */
export interface ResolvedCost {
  value: number | null
  unit: 'money' | 'pct'
  source: string
  state: 'confirmed' | 'estimated' | 'missing'
}

export function resolveCost(field: CostField | undefined, derived: { value: number | null, source: string }, unit: ResolvedCost['unit']): ResolvedCost {
  if (field?.override != null)
    return { value: field.override, unit, source: 'Set for this room', state: field.confirmed ? 'confirmed' : 'estimated' }
  if (derived.value == null)
    return { value: null, unit, source: derived.source, state: 'missing' }
  return { value: derived.value, unit, source: derived.source, state: field?.confirmed ? 'confirmed' : 'estimated' }
}
