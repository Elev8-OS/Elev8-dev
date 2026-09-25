/**
 * Which stay a cleaning belongs to, worked out from where and when it happens.
 *
 * Framework-free and structural (`StayLike`, `CleaningLike`), so the rule is
 * testable without the reservation or cleaning stores. `useCleaningJobs` calls
 * it on every create, which is what makes the link automatic.
 *
 * The link matters because it is the ONLY thing that lets a cleaning's Problems
 * become a damage claim against a guest (`cleaningReportsForReservation`). So it
 * never guesses: two stays that fit equally well link to neither.
 */

export interface StayLike {
  id: string
  listingId: string
  /** YYYY-MM-DD */
  checkIn: string
  /** YYYY-MM-DD */
  checkOut: string
  status: string
  rooms?: { unitId: string }[]
}

export interface CleaningLike {
  listingId: string
  unitId?: string | null
  scheduledAt: string
}

/**
 * Statuses that are not a stay. A maintenance block has nobody in it, an
 * inquiry was never booked, a cancellation never happened.
 */
const NOT_A_STAY = new Set(['cancelled', 'blocked', 'inquiry'])

/** Bali is UTC+8 with no daylight saving, and every cleaning is scheduled in it. */
const PROPERTY_UTC_OFFSET_MS = 8 * 60 * 60 * 1000

/**
 * The property-local day a cleaning falls on. Read through the offset rather
 * than sliced off the string, because a job stored as `…Z` (UTC) would
 * otherwise land on the previous day for anything before 08:00 local.
 */
export function cleaningDateKey(scheduledAt: string): string {
  const ms = new Date(scheduledAt).getTime()
  if (Number.isNaN(ms))
    return scheduledAt.slice(0, 10)
  return new Date(ms + PROPERTY_UTC_OFFSET_MS).toISOString().slice(0, 10)
}

function sameUnit(cleaning: CleaningLike, stay: StayLike): boolean {
  // A cleaning with no room, or a stay with no room assignment, is matched on
  // the listing alone.
  if (!cleaning.unitId || !stay.rooms?.length)
    return true
  return stay.rooms.some(r => r.unitId === cleaning.unitId)
}

/** Exactly one, or nothing: a tie is a guess, and a guess can put a bill on the wrong guest. */
function only(stays: StayLike[]): StayLike | null {
  return stays.length === 1 ? stays[0]! : null
}

/**
 * The stay a cleaning belongs to, or null when there is none.
 *
 * In order, stopping at the first step that finds anything:
 * 1. a guest in the house that day (check-in before, check-out after): mid-stay
 *    and daily housekeeping;
 * 2. a guest checking out that day: the turnover clean after they leave, which
 *    wins over an arrival on the same day because it happens first;
 * 3. a guest checking in that day: the preparation before they arrive.
 *
 * A date with no stay returns null, and the cleaning is created unlinked. One
 * stay can own any number of cleanings.
 */
export function resolveStayForCleaning<S extends StayLike>(cleaning: CleaningLike, stays: S[]): S | null {
  const day = cleaningDateKey(cleaning.scheduledAt)
  const candidates = stays.filter(s =>
    s.listingId === cleaning.listingId
    && !NOT_A_STAY.has(s.status)
    && sameUnit(cleaning, s),
  )
  const inHouse = candidates.filter(s => s.checkIn < day && day < s.checkOut)
  if (inHouse.length)
    return only(inHouse) as S | null
  const departing = candidates.filter(s => s.checkOut === day)
  if (departing.length)
    return only(departing) as S | null
  return only(candidates.filter(s => s.checkIn === day)) as S | null
}

/**
 * Whether a cleaning happened while, or after, the guest stayed, so what it
 * found can be put to them. A cleaning on or before check-in day is the
 * preparation for their arrival: whatever it found was there before they were.
 */
export function cleaningFollowsStay(cleaning: Pick<CleaningLike, 'scheduledAt'>, stay: Pick<StayLike, 'checkIn'>): boolean {
  return cleaningDateKey(cleaning.scheduledAt) > stay.checkIn
}
