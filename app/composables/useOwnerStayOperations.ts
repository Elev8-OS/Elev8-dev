// Owner stay operations — the operational side of an approved stay (Flow 5/6).
//
// Once a stay is confirmed (auto-approved or GM/Admin-approved), this helper
// provisions the downstream work:
//   - pre-arrival + post-stay cleaning jobs (wired into the real cleaning module)
//   - a range-bound smart-lock access code for the stay dates (when the
//     listing has a lock)
//   - simulated sync states for cockpit / channex / notifications
//
// Cancelling releases those resources again (revoke code, delete jobs).

import type { AlertType } from '~/components/notifications/data/alerts'
import type { OwnerStay } from '~/components/owners/data/owner-stays'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useNotifications } from '~/composables/useNotifications'
import { useOwnerStays } from '~/composables/useOwnerStays'
import { useSmartLock } from '~/composables/useSmartLock'

function nowIso(): string {
  return new Date().toISOString()
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

type OwnerStayOpsAlertType = 'OWNER_STAY_APPROACHING'

function emitOpsAlert(
  type: OwnerStayOpsAlertType,
  severity: 'INFO',
  context: Record<string, unknown>,
): void {
  useNotifications().createAlert(type as AlertType, severity, context)
}

export function useOwnerStayOperations() {
  const { stays } = useOwnerStays()
  const { createJob, deleteJob, resolveListingName } = useCleaningJobs()
  const { getLocksForListing, generateAccessCode, revokeAccessCode } = useSmartLock()

  /**
   * Promote a pending stay to `active` (approval) or demote to `rejected`,
   * stamping the approval metadata. Used by the approval flow.
   */
  function updateStayStatus(
    stayId: string,
    status: 'active' | 'rejected',
    approval: { decidedBy: string, decidedAt: string, reason?: string },
  ): { ok: boolean, stay: OwnerStay } {
    const current = stays.value.find(s => s.id === stayId)
    if (!current)
      return { ok: false, stay: undefined as unknown as OwnerStay }

    const updated: OwnerStay = {
      ...current,
      status,
      approval: { ...approval },
      updatedAt: nowIso(),
    }
    stays.value = stays.value.map(s => s.id === stayId ? updated : s)

    if (status === 'active') {
      // Provision ops only when the stay actually gets confirmed.
      void provisionOwnerStayOperations(updated)
    }
    return { ok: true, stay: updated }
  }

  /**
   * Create the pre-arrival + post-stay cleaning jobs and a smart-lock code
   * for a confirmed stay, then stamp the stay with the created ids.
   */
  async function provisionOwnerStayOperations(stay: OwnerStay): Promise<void> {
    const listingName = resolveListingName(stay.listingId)

    // Pre-arrival cleaning — the day before check-in.
    const preJob = createJob({
      listingId: stay.listingId,
      listingName,
      unitId: stay.unitId ?? null,
      scheduledAt: `${addDays(stay.checkIn, -1)}T11:00:00+08:00`,
      cleanerIds: [],
      cleanerNames: [],
      teamName: 'Housekeeping',
      status: 'scheduled',
      priority: 'high',
      durationMinutes: 180,
      notes: `Owner stay ${stay.id} — pre-arrival cleaning`,
      source: 'custom',
      reservationId: stay.id,
      recurrence: null,
    })

    // Post-stay cleaning — check-out day.
    const postJob = createJob({
      listingId: stay.listingId,
      listingName,
      unitId: stay.unitId ?? null,
      scheduledAt: `${stay.checkOut}T11:00:00+08:00`,
      cleanerIds: [],
      cleanerNames: [],
      teamName: 'Housekeeping',
      status: 'scheduled',
      priority: 'high',
      durationMinutes: 180,
      notes: `Owner stay ${stay.id} — post-stay cleaning`,
      source: 'check_out',
      reservationId: stay.id,
      recurrence: null,
    })

    // Smart-lock access code for the stay window (when the listing has a lock).
    let accessCodeId: string | undefined
    const locks = getLocksForListing(stay.listingId)
    if (locks.length > 0) {
      const codeResult = await generateAccessCode({
        lockId: locks[0]!.id,
        startsAt: `${stay.checkIn}T14:00:00+08:00`,
        endsAt: `${stay.checkOut}T11:00:00+08:00`,
        guestName: stay.guestName,
        reservationId: stay.id,
        purpose: 'Owner stay',
        scheduleType: 'range',
      })
      if (codeResult.success && codeResult.code)
        accessCodeId = codeResult.code.id
    }

    stays.value = stays.value.map(s => s.id === stay.id
      ? {
          ...s,
          cleaningTaskIds: { pre: [preJob.id], post: [postJob.id] },
          accessCodeId,
          syncState: { cockpit: 'synced', channex: 'synced', notifications: 'synced' },
          updatedAt: nowIso(),
        }
      : s)
  }

  /** Release operational resources when a stay is cancelled/completed. */
  async function releaseStayOperations(stay: OwnerStay): Promise<void> {
    // Revoke the smart-lock code.
    if (stay.accessCodeId) {
      revokeAccessCode(stay.accessCodeId)
      stays.value = stays.value.map(s => s.id === stay.id
        ? { ...s, accessCodeId: undefined, updatedAt: nowIso() }
        : s)
    }
    // Delete pre-arrival cleaning job; post-stay cleaning usually still runs.
    for (const id of stay.cleaningTaskIds?.pre ?? [])
      deleteJob(id)
  }

  /** Scan for confirmed stays whose check-in is within 48h → reminder (H-2 / Flow 5). */
  function checkUpcomingStays(): void {
    const now = Date.now()
    const horizon = 48 * 60 * 60 * 1000
    for (const stay of stays.value) {
      if (stay.status !== 'active')
        continue
      const checkInMs = Date.parse(`${stay.checkIn}T00:00:00Z`)
      if (!Number.isFinite(checkInMs))
        continue
      const delta = checkInMs - now
      if (delta > 0 && delta <= horizon) {
        emitOpsAlert('OWNER_STAY_APPROACHING', 'INFO', {
          stayId: stay.id,
          ownerId: stay.ownerId,
          listingId: stay.listingId,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          guestName: stay.guestName,
        })
      }
    }
  }

  return {
    stays,
    updateStayStatus,
    provisionOwnerStayOperations,
    releaseStayOperations,
    checkUpcomingStays,
  }
}
