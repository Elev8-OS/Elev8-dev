/**
 * Smart-lock access granted by an upsell.
 *
 * Framework-free on purpose: the composable (`useUpsellLockAccess`) owns the reactive
 * state and the side effects, this module only holds the rules. Locks arrive as a
 * structural `LockLike`, not the full `SmartLock`, so the rules stay testable without
 * the smart-lock store.
 */

/** The shape this module needs from a paired smart lock. */
export interface LockLike {
  id: string
  name: string
}

export interface LockAccessConfig {
  /** Whether buying this service grants the guest a lock code. */
  enabled: boolean
  /**
   * Lock names this service unlocks, e.g. `['Pool Gate']`.
   *
   * Matched by NAME, not by lock id, because a service is assigned to many listings
   * while a lock is paired to one. A name survives re-pairing and device swaps; a lock
   * id would dangle the moment the host unpairs.
   */
  lockNames: string[]
  /** Free text appended to the guest message, e.g. "The gate is left of the pool deck." */
  instructions?: string
}

export function createDefaultLockAccessConfig(): LockAccessConfig {
  return { enabled: false, lockNames: [], instructions: '' }
}

/** A purchased code is never shorter than this, so a late purchase still works. */
export const MIN_ACCESS_WINDOW_MS = 2 * 60 * 60 * 1000

/** Hour of the check-out day the purchased code expires at. */
export const ACCESS_END_HOUR = 12

function normalizeLockName(name: string): string {
  return name.trim().toLowerCase()
}

export interface ResolvedLockTargets<T extends LockLike> {
  /** Locks paired at this property whose name the service names. Deduped by id. */
  matched: T[]
  /** Names the service asks for that no lock at this property answers to. */
  unmatchedNames: string[]
}

/**
 * Match the service's configured lock names against the locks paired at one property.
 *
 * A name with no lock behind it is reported rather than dropped: "you sold pool access
 * at a villa with no pool gate paired" is something a human has to fix.
 */
export function resolveLockTargets<T extends LockLike>(
  config: LockAccessConfig | undefined,
  locks: readonly T[],
): ResolvedLockTargets<T> {
  if (!config?.enabled)
    return { matched: [], unmatchedNames: [] }

  const matched: T[] = []
  const seen = new Set<string>()
  const unmatchedNames: string[] = []

  for (const wanted of config.lockNames) {
    const key = normalizeLockName(wanted)
    if (!key)
      continue
    const hits = locks.filter(l => normalizeLockName(l.name) === key)
    if (hits.length === 0) {
      unmatchedNames.push(wanted)
      continue
    }
    for (const lock of hits) {
      if (seen.has(lock.id))
        continue
      seen.add(lock.id)
      matched.push(lock)
    }
  }

  return { matched, unmatchedNames }
}

export interface AccessWindow {
  startsAt: string
  endsAt: string
  scheduleType: 'range'
}

/**
 * The window a purchased code is valid for: from the moment of payment until noon on
 * the guest's check-out day.
 *
 * Access bought mid-stay should last the rest of the stay, so the end is pinned to
 * check-out rather than to the service date. A purchase made after that point (a guest
 * buying pool access on their last afternoon) would otherwise produce a code that is
 * dead on arrival, so the window is widened to `MIN_ACCESS_WINDOW_MS` instead of being
 * quietly rolled to the next day.
 */
export function buildAccessWindow(
  order: { checkOutDate?: string },
  now: Date = new Date(),
): AccessWindow {
  const start = now.getTime()
  const checkOut = order.checkOutDate
    ? new Date(`${order.checkOutDate}T${String(ACCESS_END_HOUR).padStart(2, '0')}:00:00`).getTime()
    : Number.NaN

  const end = Number.isNaN(checkOut)
    ? start + 24 * 60 * 60 * 1000
    : Math.max(checkOut, start + MIN_ACCESS_WINDOW_MS)

  return {
    startsAt: new Date(start).toISOString(),
    endsAt: new Date(end).toISOString(),
    scheduleType: 'range',
  }
}

/** The `purpose` label stored on the code, rendered by the listing Codes Dialog. */
export function accessPurposeLabel(order: { serviceName: string }): string {
  return `Upsell · ${order.serviceName}`
}

/** Whether a service is configured to hand out lock codes at all. */
export function serviceGrantsLockAccess(
  service: { lockAccess?: LockAccessConfig } | undefined,
): boolean {
  return Boolean(service?.lockAccess?.enabled && service.lockAccess.lockNames.length > 0)
}

/** One line per lock for the guest message. */
export function formatGuestAccessMessage(
  guestName: string,
  entries: Array<{ lockName: string, code: string }>,
  endsAt: string,
  instructions?: string,
): string {
  const until = new Date(endsAt).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  const lines = [
    `Hi ${guestName}, your access is ready.`,
    '',
    ...entries.map(e => `${e.lockName}: ${e.code}`),
    '',
    `Valid until ${until}.`,
  ]
  if (instructions?.trim())
    lines.push('', instructions.trim())
  return lines.join('\n')
}
