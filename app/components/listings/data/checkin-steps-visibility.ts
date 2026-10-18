/**
 * When guests of a listing can see the check-in steps in their guest guide,
 * set in the listing's Guest Guide tab. Read through
 * `listingCheckinStepsVisibility`, which fills the default (24 hours before
 * check-in) for a listing that never set it. ⚠️ Setting only: the guest guide
 * does not read it yet.
 */
export type CheckinStepsMode = 'always' | 'hours_before'

export interface CheckinStepsVisibility {
  mode: CheckinStepsMode
  /** `hours_before` only: how many hours before check-in the steps appear. */
  hoursBefore: number
}

export const DEFAULT_CHECKIN_STEPS_VISIBILITY: CheckinStepsVisibility = { mode: 'hours_before', hoursBefore: 24 }

export const CHECKIN_STEPS_MODES: Array<{ value: CheckinStepsMode, label: string }> = [
  { value: 'hours_before', label: 'Hours before check-in' },
  { value: 'always', label: 'Always' },
]

export const MAX_CHECKIN_STEPS_HOURS = 720

export function listingCheckinStepsVisibility(listing: { checkinStepsVisibility?: Partial<CheckinStepsVisibility> } | null | undefined): CheckinStepsVisibility {
  return { ...DEFAULT_CHECKIN_STEPS_VISIBILITY, ...listing?.checkinStepsVisibility }
}

/** One sentence for the card, e.g. "Guests see the steps 24 hours before check-in." */
export function describeCheckinStepsVisibility(v: CheckinStepsVisibility): string {
  if (v.mode === 'always')
    return 'Guests see the check-in steps as soon as they open the guide.'
  return `Guests see the check-in steps ${v.hoursBefore} ${v.hoursBefore === 1 ? 'hour' : 'hours'} before check-in.`
}

/** Short label for the section list, e.g. "24 h before". */
export function checkinStepsShortLabel(v: CheckinStepsVisibility): string {
  return v.mode === 'always' ? 'Always shown' : `${v.hoursBefore} h before`
}

/** Hours before check-in the steps appear, or null when always shown. */
export function checkinStepsLeadHours(v: CheckinStepsVisibility): number | null {
  return v.mode === 'always' ? null : v.hoursBefore
}

export function clampCheckinStepsHours(value: number): number {
  if (!Number.isFinite(value))
    return DEFAULT_CHECKIN_STEPS_VISIBILITY.hoursBefore
  return Math.min(MAX_CHECKIN_STEPS_HOURS, Math.max(1, Math.round(value)))
}
