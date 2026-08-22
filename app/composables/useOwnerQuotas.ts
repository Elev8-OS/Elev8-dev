// Owner self-booking quotas + booking mode — shared state (PRD 5.2).
//
// Provides:
//   - `getBookingMode(ownerId, listingId)` — per-owner override, falls back to 'direct'.
//   - `checkQuota(...)` — computes window usage for a candidate date range.
//   - `getRemainingQuota(...)` — remaining nights in the active window.
//   - Admin config: `setBookingMode`, `upsertQuota`, `removeQuota`.

import type {
  OwnerBookingMode,
  OwnerBookingModeConfig,
  OwnerSeasonalQuota,
  QuotaCheckResult,
  QuotaWindowUsage,
} from '~/components/owners/data/owner-quotas'
import { mockOwnerBookingModes, mockOwnerSeasonalQuotas } from '~/components/owners/data/owner-quotas'
import { useOwners } from '~/composables/useOwners'
import { useOwnerStays } from '~/composables/useOwnerStays'

const DAY_MS = 86_400_000

function dateRangeOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

/** Nights of [aStart, aEnd) that fall inside [bStart, bEnd). */
function overlapNights(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = aStart > bStart ? aStart : bStart
  const end = aEnd < bEnd ? aEnd : bEnd
  if (start >= end)
    return 0
  return Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS))
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

export function useOwnerQuotas() {
  const quotas = useState<OwnerSeasonalQuota[]>(
    'elev8-owner-seasonal-quotas',
    () => clone(mockOwnerSeasonalQuotas),
  )
  const bookingModes = useState<OwnerBookingModeConfig[]>(
    'elev8-owner-booking-modes',
    () => clone(mockOwnerBookingModes),
  )
  const { stays } = useOwnerStays()
  const { byId } = useOwners()

  function getBookingMode(ownerId: string, listingId: string): OwnerBookingMode {
    return bookingModes.value.find(
      config => config.ownerId === ownerId && config.listingId === listingId,
    )?.mode ?? 'direct'
  }

  function setBookingMode(ownerId: string, listingId: string, mode: OwnerBookingMode): void {
    const existing = bookingModes.value.find(
      config => config.ownerId === ownerId && config.listingId === listingId,
    )
    if (existing) {
      bookingModes.value = bookingModes.value.map(config =>
        config === existing ? { ...config, mode } : config)
    }
    else {
      bookingModes.value = [...bookingModes.value, { ownerId, listingId, mode }]
    }
  }

  function quotasForOwnerListing(ownerId: string, listingId: string): OwnerSeasonalQuota[] {
    return quotas.value
      .filter(q => q.ownerId === ownerId && q.listingId === listingId)
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }

  /** Nights the owner already has active stays within a window. */
  function usedNightsInWindow(ownerId: string, listingId: string, startDate: string, endDate: string): number {
    return stays.value
      .filter(stay =>
        stay.ownerId === ownerId
        && stay.listingId === listingId
        && stay.status === 'active'
        && dateRangeOverlap(stay.checkIn, stay.checkOut, startDate, endDate))
      .reduce((sum, stay) => sum + overlapNights(stay.checkIn, stay.checkOut, startDate, endDate), 0)
  }

  /**
   * Check a candidate self-booking range against every seasonal quota window.
   * Returns per-window usage + whether any window would be exceeded.
   */
  function checkQuota(ownerId: string, listingId: string, checkIn: string, checkOut: string, excludeStayId?: string): QuotaCheckResult {
    const windows: QuotaWindowUsage[] = []
    for (const quota of quotasForOwnerListing(ownerId, listingId)) {
      if (!dateRangeOverlap(checkIn, checkOut, quota.startDate, quota.endDate))
        continue
      // Exclude the stay being edited when computing used nights.
      const usedExcluding = excludeStayId
        ? stays.value
            .filter(stay =>
              stay.ownerId === ownerId
              && stay.listingId === listingId
              && stay.status === 'active'
              && stay.id !== excludeStayId
              && dateRangeOverlap(stay.checkIn, stay.checkOut, quota.startDate, quota.endDate))
            .reduce((sum, stay) => sum + overlapNights(stay.checkIn, stay.checkOut, quota.startDate, quota.endDate), 0)
        : usedNightsInWindow(ownerId, listingId, quota.startDate, quota.endDate)

      const requestedNights = overlapNights(checkIn, checkOut, quota.startDate, quota.endDate)
      windows.push({
        startDate: quota.startDate,
        endDate: quota.endDate,
        maxNights: quota.maxNights,
        usedNights: usedExcluding,
        requestedNights,
        remaining: quota.maxNights - usedExcluding,
      })
    }
    const exceeded = windows.some(w => w.usedNights + w.requestedNights > w.maxNights)
    return { ok: !exceeded, windows, exceeded }
  }

  /** Remaining nights available in the window containing `date` (0 when none). */
  function getRemainingQuota(ownerId: string, listingId: string, date: string): number {
    const window = quotasForOwnerListing(ownerId, listingId).find(
      q => q.startDate <= date && date <= q.endDate,
    )
    if (!window)
      return Number.POSITIVE_INFINITY
    const used = usedNightsInWindow(ownerId, listingId, window.startDate, window.endDate)
    return Math.max(0, window.maxNights - used)
  }

  function upsertQuota(input: Omit<OwnerSeasonalQuota, 'id'> & { id?: string }): { success: boolean, error?: string, quota?: OwnerSeasonalQuota } {
    if (!input.startDate || !input.endDate || input.startDate > input.endDate)
      return { success: false, error: 'Invalid date range.' }
    if (input.maxNights < 0)
      return { success: false, error: 'Max nights cannot be negative.' }

    // A seasonal window can't ask for more nights than the owner's annual
    // use cap allows. 0 / absent cap = no limit, so the check only applies
    // to owners with a finite cap.
    const annualCap = byId(input.ownerId)?.annualOwnerUseNightCap
    if (annualCap && annualCap > 0 && input.maxNights > annualCap)
      return { success: false, error: `Max nights cannot exceed the owner's ${annualCap}-night annual cap.` }

    if (input.id) {
      const updated = { ...input as OwnerSeasonalQuota }
      quotas.value = quotas.value.map(q => q.id === input.id ? updated : q)
      return { success: true, quota: updated }
    }

    const quota: OwnerSeasonalQuota = {
      id: `oq-${globalThis.crypto.randomUUID()}`,
      ownerId: input.ownerId,
      listingId: input.listingId,
      startDate: input.startDate,
      endDate: input.endDate,
      maxNights: input.maxNights,
    }
    quotas.value = [...quotas.value, quota]
    return { success: true, quota }
  }

  function removeQuota(quotaId: string): void {
    quotas.value = quotas.value.filter(q => q.id !== quotaId)
  }

  return {
    quotas,
    bookingModes,
    getBookingMode,
    setBookingMode,
    checkQuota,
    getRemainingQuota,
    quotasForOwnerListing,
    upsertQuota,
    removeQuota,
  }
}
