/**
 * Date overrides set from the Cockpit: per night, what is sold and how,
 * Channex-style (availability, restrictions, rate). Framework-free; the store
 * is `useCockpitOverrides`, specs in `tests/lib/cockpit-overrides.spec.ts`.
 *
 * ⚠️ Scope is the room type (a multi-unit listing) or the listing (a
 * single-unit one, which has no room types), not a single room and not a rate
 * plan: Channex keeps availability per room type, so an override set from a
 * room row applies to every room of its type. Rate and restrictions apply to
 * every rate plan of that type. Mock only: nothing is sent to a channel.
 */

export type OverrideField
  = | 'availability'
    | 'closedToArrival'
    | 'closedToDeparture'
    | 'maxAvailability'
    | 'maxStay'
    | 'minStay'
    | 'rate'
    | 'stopSell'

export interface OverrideValues {
  /** Rooms of the type open to sell that night (0 closes it). */
  availability: number
  closedToArrival: boolean
  closedToDeparture: boolean
  /** A cap on the rooms sold that night, whatever is free. */
  maxAvailability: number
  /** Nights, from an arrival on that night. */
  maxStay: number
  minStay: number
  /** Nightly rate, in the type's (or listing's) currency. */
  rate: number
  stopSell: boolean
}

export interface CockpitOverride {
  id: string
  listingId: string
  /** The room type; null for a single-unit listing (the whole property). */
  unitTypeId: string | null
  /** First and last night it covers, both included (`YYYY-MM-DD`). */
  from: string
  to: string
  values: Partial<OverrideValues>
  createdAt: string
}

export interface OverrideFieldMeta {
  key: OverrideField
  label: string
  kind: 'count' | 'nights' | 'money' | 'toggle'
  icon: string
  hint: string
}

/** The settings, in the order the user listed them. */
export const OVERRIDE_FIELDS: OverrideFieldMeta[] = [
  { key: 'availability', label: 'Only Availability', kind: 'count', icon: 'lucide:door-open', hint: 'Rooms open to sell each night. 0 closes the nights.' },
  { key: 'closedToArrival', label: 'Closed To Arrival', kind: 'toggle', icon: 'lucide:log-in', hint: 'No check-in on these nights.' },
  { key: 'closedToDeparture', label: 'Closed To Departure', kind: 'toggle', icon: 'lucide:log-out', hint: 'No check-out on these days.' },
  { key: 'maxAvailability', label: 'Max Availability', kind: 'count', icon: 'lucide:gauge', hint: 'Sell at most this many rooms a night.' },
  { key: 'maxStay', label: 'Max Stay', kind: 'nights', icon: 'lucide:calendar-minus', hint: 'Longest stay arriving on these nights.' },
  { key: 'minStay', label: 'Min Stay', kind: 'nights', icon: 'lucide:calendar-plus', hint: 'Shortest stay arriving on these nights.' },
  { key: 'rate', label: 'Rate', kind: 'money', icon: 'lucide:banknote', hint: 'Nightly rate for these nights.' },
  { key: 'stopSell', label: 'Stop Sell', kind: 'toggle', icon: 'lucide:octagon-x', hint: 'Not sold on any channel.' },
]

export const OVERRIDE_FIELD_META = Object.fromEntries(OVERRIDE_FIELDS.map(f => [f.key, f])) as Record<OverrideField, OverrideFieldMeta>

function sameScope(o: Pick<CockpitOverride, 'listingId' | 'unitTypeId'>, listingId: string, unitTypeId: string | null) {
  return o.listingId === listingId && o.unitTypeId === unitTypeId
}

/** What is overridden on one night: every override covering it, a later one winning field by field. */
export function overridesOn(overrides: CockpitOverride[], listingId: string, unitTypeId: string | null, key: string): Partial<OverrideValues> {
  const out: Partial<OverrideValues> = {}
  for (const o of overrides) {
    if (sameScope(o, listingId, unitTypeId) && o.from <= key && key <= o.to)
      Object.assign(out, o.values)
  }
  return out
}

/** The overrides that touch any night from `from` to `to` (both included), oldest first. */
export function overridesIn(overrides: CockpitOverride[], listingId: string, unitTypeId: string | null, from: string, to: string): CockpitOverride[] {
  return overrides.filter(o => sameScope(o, listingId, unitTypeId) && o.from <= to && from <= o.to)
}

/**
 * Rooms open to sell on a night once the overrides apply, from `free` of
 * `units`: Stop Sell sells none, Only Availability opens at most that many,
 * Max Availability caps the rooms sold that night (the ones already taken
 * count against it). Never more than is really free.
 */
export function sellableUnits(free: number, units: number, values: Partial<OverrideValues>): number {
  if (values.stopSell)
    return 0
  let open = free
  if (values.availability !== undefined)
    open = Math.min(open, values.availability)
  if (values.maxAvailability !== undefined)
    open = Math.min(open, Math.max(0, values.maxAvailability - (units - free)))
  return Math.max(0, open)
}

function formatAmount(amount: number, currency: string) {
  const decimals = currency === 'IDR' ? 0 : 2
  return `${currency} ${amount.toLocaleString(currency === 'CHF' ? 'de-CH' : 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

/** One short phrase per overridden field, in the fields' order ("Min Stay 3 nights", "Stop Sell"). */
export function describeOverrides(values: Partial<OverrideValues>, currency: string): string[] {
  const out: string[] = []
  for (const field of OVERRIDE_FIELDS) {
    const value = values[field.key]
    if (value === undefined)
      continue
    if (field.kind === 'toggle')
      out.push(value ? field.label : `${field.label} off`)
    else if (field.kind === 'nights')
      out.push(`${field.label} ${value} ${value === 1 ? 'night' : 'nights'}`)
    else if (field.kind === 'money')
      out.push(`${field.label} ${formatAmount(value as number, currency)}`)
    else
      out.push(`${field.label} ${value}`)
  }
  return out
}

/**
 * Why the values cannot be saved, or null. `units` is the rooms of the type
 * (1 for a single-unit listing): availability and the cap cannot exceed it.
 */
export function validateOverride(values: Partial<OverrideValues>, units: number): string | null {
  if (!Object.keys(values).length)
    return 'Pick at least one setting to override.'
  const whole = (n: number | undefined) => n === undefined || (Number.isInteger(n) && n >= 0)
  if (!whole(values.availability) || (values.availability ?? 0) > units)
    return `Only Availability must be a whole number from 0 to ${units}.`
  if (!whole(values.maxAvailability) || (values.maxAvailability ?? 0) > units)
    return `Max Availability must be a whole number from 0 to ${units}.`
  if (values.minStay !== undefined && (!Number.isInteger(values.minStay) || values.minStay < 1))
    return 'Min Stay must be at least 1 night.'
  if (values.maxStay !== undefined && (!Number.isInteger(values.maxStay) || values.maxStay < 1))
    return 'Max Stay must be at least 1 night.'
  if (values.minStay !== undefined && values.maxStay !== undefined && values.maxStay < values.minStay)
    return 'Max Stay cannot be shorter than Min Stay.'
  if (values.rate !== undefined && !(values.rate > 0))
    return 'Rate must be more than 0.'
  return null
}
