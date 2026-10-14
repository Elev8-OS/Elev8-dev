import type { CleaningFilters, CleaningJob, CleaningJobInput, CleaningJobSource } from '~/components/cleaning/data/cleaning-jobs'
import type { CleaningStepSection } from '~/components/cleaning/data/cleaning-steps'
import { cleanerOptions, cleaningJobs } from '~/components/cleaning/data/cleaning-jobs'
import { cleaningDateKey, resolveStayForCleaning, routineDayType } from '~/components/cleaning/data/cleaning-link'
import { cleaningTemplateTypeFor, listingCanBeCleaned, resolveListingChecklist } from '~/components/cleaning/data/cleaning-step-templates'
import { listings } from '~/components/listings/data/listings'
import { allStays } from '~/components/operations-calendar/data/calendar-stays'
import { vacantCleaningDue } from '~/components/reservations/data/cleaning-schedule'
import { useCleaningScheduleDefault } from '~/composables/useCleaningScheduleDefault'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'
import { useNotifications } from '~/composables/useNotifications'
// useReservationsModule imports this module too. The cycle is safe because
// neither calls the other at module load, only inside functions.
import { useReservationsModule } from '~/composables/useReservationsModule'

/**
 * The stay a cleaning belongs to, by where and when it happens. Null when none.
 * Read from BOTH stay sources (`calendar-stays.ts`), the same union the
 * calendar draws, so a cleaning never links to a stay the calendar does not
 * show, nor fails to link to one it does.
 */
function stayIdFor(job: Pick<CleaningJob, 'listingId' | 'unitId' | 'scheduledAt'>): string | null {
  const stays = allStays(listings.value, useReservationsModule().reservations.value)
  return resolveStayForCleaning(job, stays)?.id ?? null
}

/**
 * ⚠️ The cleaning-steps gate: a listing with no checklist gets no new cleaning,
 * from any path. With a `source`, whether that cleaning type resolves to a
 * checklist (listing override, else company default; `resolveListingChecklist`);
 * without one, whether any type does. A listing id this app does not hold has
 * nothing to check against and passes.
 */
export function listingHasCleaningSteps(listingId: string, source?: CleaningJobSource): boolean {
  const listing = listings.value.find(l => l.id === listingId)
  if (!listing)
    return true
  const type = source ? cleaningTemplateTypeFor(source) : undefined
  return listingCanBeCleaned(listing.maintenance, useCleaningStepTemplates().library.value, type)
}

/**
 * A fresh copy of the checklist a cleaning of `source` uses on the listing, and
 * its name, for a job (`CleaningJob.steps` / `checklistName`); undefined when
 * there is none. A copy, never the original array: the job's checklist is a
 * snapshot.
 */
export function cleaningChecklistSnapshot(listingId: string, source: CleaningJobSource = 'custom'): { steps: CleaningStepSection[], checklistName: string } | undefined {
  const listing = listings.value.find(l => l.id === listingId)
  if (!listing)
    return undefined
  const resolved = resolveListingChecklist(listing.maintenance, cleaningTemplateTypeFor(source), useCleaningStepTemplates().library.value)
  return resolved ? { steps: JSON.parse(JSON.stringify(resolved.sections)), checklistName: resolved.name } : undefined
}

/** The input's own steps when it brings them, else the listing's checklist for its type. */
function checklistFields(input: Pick<CleaningJob, 'listingId' | 'source' | 'steps' | 'checklistName'>) {
  if (input.steps)
    return { steps: input.steps, checklistName: input.checklistName }
  return cleaningChecklistSnapshot(input.listingId, input.source) ?? { steps: undefined, checklistName: undefined }
}

/**
 * Seeds are linked to their stay on load, by the same rule a new job is. Seeds
 * not yet done also get the listing's steps as their checklist, as if they had
 * been created after the steps were set up; a done seed keeps only its report.
 */
function linkSeed(seed: CleaningJob[]): CleaningJob[] {
  return seed.map((job) => {
    const linked = job.reservationId ? job : { ...job, reservationId: stayIdFor(job) }
    if (linked.steps || linked.status === 'done')
      return linked
    const snapshot = cleaningChecklistSnapshot(linked.listingId, linked.source)
    return snapshot ? { ...linked, ...snapshot } : linked
  })
}

/** How far ahead the daily routine keeps cleanings (`syncRoutineCleanings`). */
export const ROUTINE_HORIZON_DAYS = 14

/** Local YYYY-MM-DD, the same day the property sees for a local midnight. */
function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function useCleaningJobs() {
  // Seeded jobs with no stay recorded are linked on load, by the same rule a
  // new job is: a seed that says null means "not recorded", not "none".
  const jobs = useState<CleaningJob[]>('cleaning-jobs', () => linkSeed(cleaningJobs.value))
  /** Routine days the user deleted or cancelled ("listingId|YYYY-MM-DD"): the routine never refills them. */
  const routineSkips = useState<string[]>('cleaning-routine-skips', () => [])

  const syncedJobs = computed(() => jobs.value)

  function refreshFromSeed() {
    if (!jobs.value.length) {
      jobs.value = linkSeed(cleaningJobs.value)
    }
  }

  function jobsForListing(listingId: string) {
    return syncedJobs.value
      .filter(job => job.listingId === listingId)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  }

  function jobsForFilters(filters: CleaningFilters) {
    return syncedJobs.value.filter((job) => {
      if (filters.listingIds.length && !filters.listingIds.includes(job.listingId))
        return false
      if (filters.cleanerIds.length && !job.cleanerIds.some(id => filters.cleanerIds.includes(id)))
        return false
      if (filters.statuses.length && !filters.statuses.includes(job.status))
        return false
      if (filters.priorities.length && !filters.priorities.includes(job.priority))
        return false
      return true
    })
  }

  /**
   * A planned-ahead job: still a draft, and its release moment has not arrived.
   * These are visible to whoever planned them but are not housekeeping's work yet.
   */
  function isPlanned(job: CleaningJob) {
    return job.status === 'draft' && Boolean(job.releaseAt)
  }

  /**
   * Flip planned drafts whose release moment has passed into `scheduled`, which
   * is what puts them into housekeeping's workload. Idempotent, so it is safe to
   * call on every mount of a surface that shows cleaning jobs.
   */
  function releaseDueDrafts(now: Date = new Date()) {
    const nowMs = now.getTime()
    let released = 0
    jobs.value = jobs.value.map((job) => {
      if (!isPlanned(job))
        return job
      if (new Date(job.releaseAt!).getTime() > nowMs)
        return job
      released += 1
      return { ...job, status: 'scheduled' as const, releaseAt: null }
    })
    return released
  }

  /**
   * Every new cleaning is linked to the stay it belongs to, whoever creates it
   * (the calendar, a listing's maintenance tab, an owner stay). A caller that
   * already knows the stay (a reservation's own schedule) passes it and is
   * trusted. A date with no stay creates the job unlinked.
   *
   * Returns null, creating nothing, for a listing with no cleaning steps
   * (`listingHasCleaningSteps`). Screens disable their buttons first; this is
   * the backstop for the automatic paths.
   */
  function createJob(input: CleaningJobInput): CleaningJob | null {
    if (!input.steps?.length && !listingHasCleaningSteps(input.listingId, input.source))
      return null
    const job: CleaningJob = {
      ...input,
      ...checklistFields(input),
      reservationId: input.reservationId || stayIdFor(input),
      id: `cln-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }
    jobs.value = [...jobs.value, job]
    return job
  }

  /**
   * Moving a cleaning keeps its link honest:
   * - to another listing or room: relinked from scratch, possibly to nothing,
   *   since the old stay was somewhere else entirely;
   * - to another date: relinked when a stay fits the new date, and otherwise
   *   left as it was, so a turnover clean pushed to the next morning still
   *   belongs to the guest who left.
   * A patch that names `reservationId` itself is taken as given.
   */
  function updateJob(id: string, patch: Partial<CleaningJob>) {
    jobs.value = jobs.value.map((job) => {
      if (job.id !== id)
        return job
      const next = { ...job, ...patch }
      if ('reservationId' in patch)
        return next
      const movedPlace = next.listingId !== job.listingId || (next.unitId ?? null) !== (job.unitId ?? null)
      const movedDate = next.scheduledAt !== job.scheduledAt
      if (movedPlace) {
        // A job moved to another listing before it starts takes that listing's steps.
        const notStarted = next.status !== 'in_progress' && next.status !== 'done'
        const recopy = next.listingId !== job.listingId && notStarted && !('steps' in patch)
        const checklist = recopy ? (cleaningChecklistSnapshot(next.listingId, next.source) ?? { steps: undefined, checklistName: undefined }) : {}
        return { ...next, ...checklist, reservationId: stayIdFor(next) }
      }
      if (movedDate)
        return { ...next, reservationId: stayIdFor(next) ?? job.reservationId ?? null }
      return next
    })
  }

  function deleteJob(id: string) {
    const job = jobs.value.find(j => j.id === id)
    if (job?.routine)
      routineSkips.value = [...routineSkips.value, `${job.listingId}|${cleaningDateKey(job.scheduledAt)}`]
    jobs.value = jobs.value.filter(job => job.id !== id)
  }

  function applyReservationSchedule(reservationId: string, newJobs: CleaningJobInput[]) {
    const preserved = jobs.value.filter(j => !(j.reservationId === reservationId && j.status !== 'done'))
    // A listing with no cleaning steps gets no jobs (`listingHasCleaningSteps`).
    const allowed = newJobs.filter(input => listingHasCleaningSteps(input.listingId, input.source))
    const added: CleaningJob[] = allowed.map((input, idx) => ({
      ...input,
      ...checklistFields(input),
      id: `cln-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    }))
    jobs.value = [...preserved, ...added]
    return added
  }

  function clearReservationSchedule(reservationId: string) {
    jobs.value = jobs.value.filter(j => !(j.reservationId === reservationId && j.status !== 'done'))
  }

  /**
   * A stay's check-out moved (an extension): its open check-out cleanings on
   * `fromDate` follow it to `toDate` at the same time of day, re-linked to
   * `toReservationId` (the linked booking of an OTA extension). When that stay
   * already has an open check-out cleaning on the new day they are dropped
   * instead, so one departure is never cleaned twice. Returns how many moved
   * or were dropped.
   */
  function moveCheckoutCleanings(fromReservationId: string, fromDate: string, toDate: string, toReservationId = fromReservationId): number {
    const isOpenCheckout = (j: CleaningJob) => j.source === 'checkout' && j.status !== 'done' && j.status !== 'cancelled'
    const moving = jobs.value.filter(j => j.reservationId === fromReservationId && isOpenCheckout(j) && cleaningDateKey(j.scheduledAt) === fromDate)
    if (!moving.length)
      return 0
    const covered = jobs.value.some(j => j.reservationId === toReservationId && isOpenCheckout(j) && cleaningDateKey(j.scheduledAt) === toDate)
    const ids = new Set(moving.map(j => j.id))
    jobs.value = covered
      ? jobs.value.filter(j => !ids.has(j.id))
      // Stored as `YYYY-MM-DDTHH:MM:SS+08:00`: swap the day, keep time and offset.
      : jobs.value.map(j => ids.has(j.id) ? { ...j, scheduledAt: `${toDate}${j.scheduledAt.slice(10)}`, reservationId: toReservationId } : j)
    return moving.length
  }

  /**
   * Early arrival on a linked booking: it "ends" on the stay's old check-in,
   * but the guest stays on. Its check-out cleaning that day goes, and so does
   * any other job of it the stay already covers that day. Returns how many went.
   */
  function dropArrivalOverlap(linkedReservationId: string, stayReservationId: string, day: string): number {
    const isOpen = (j: CleaningJob) => j.status !== 'done' && j.status !== 'cancelled' && cleaningDateKey(j.scheduledAt) === day
    const stayCovers = jobs.value.some(j => j.reservationId === stayReservationId && isOpen(j))
    const dropping = new Set(jobs.value
      .filter(j => j.reservationId === linkedReservationId && isOpen(j) && (j.source === 'checkout' || j.source === 'check_out' || stayCovers))
      .map(j => j.id))
    if (dropping.size)
      jobs.value = jobs.value.filter(j => !dropping.has(j.id))
    return dropping.size
  }

  /**
   * Cancels a stay's open jobs, all of them or those `which` picks (nights
   * that are no longer booked). Done jobs stay as history. Returns how many.
   */
  function cancelOpenJobs(reservationId: string, which: (j: CleaningJob) => boolean = () => true): number {
    const ids = new Set(jobs.value
      .filter(j => j.reservationId === reservationId && j.status !== 'done' && j.status !== 'cancelled' && which(j))
      .map(j => j.id))
    if (ids.size)
      jobs.value = jobs.value.map(j => ids.has(j.id) ? { ...j, status: 'cancelled' as const } : j)
    return ids.size
  }

  function createFromCheckout(reservation: { id: string, listingId: string, listingName: string, checkOut: string, guestName?: string }) {
    const { createGuestActivityAlert } = useNotifications()
    const scheduledAt = `${reservation.checkOut}T11:00:00+08:00`
    // The daily routine may already have that departure's check-out cleaning.
    const existing = jobs.value.find(j => j.listingId === reservation.listingId && j.status !== 'cancelled' && j.status !== 'done'
      && cleaningDateKey(j.scheduledAt) === reservation.checkOut && (j.source === 'check_out' || j.source === 'checkout'))
    const job = existing ?? createJob({
      listingId: reservation.listingId,
      listingName: reservation.listingName,
      scheduledAt,
      cleanerIds: [],
      cleanerNames: [],
      teamName: 'Housekeeping',
      status: 'draft',
      priority: 'high',
      durationMinutes: 180,
      notes: `Auto-generated from checkout ${reservation.id}.`,
      source: 'checkout',
      reservationId: reservation.id,
      recurrence: null,
    })

    createGuestActivityAlert('GUEST_CHECKED_OUT', {
      listing_id: reservation.listingId,
      listing_name: reservation.listingName,
      guest_name: reservation.guestName ?? 'Guest',
      checkout_at: scheduledAt,
      reservation_id: reservation.id,
    })

    return job
  }

  /**
   * ⚠️ The daily routine: a listing whose cleaning schedule (its own, else the
   * company default; `useCleaningScheduleDefault`) is DAILY is cleaned every
   * day, booked or not. For each such listing and each day from `today` to
   * `ROUTINE_HORIZON_DAYS` ahead it keeps exactly one cleaning, typed by the day
   * (`routineDayType`): daily with a guest in, check-out on departure day, vacant
   * upkeep when empty, but only on the days `schedule.vacant` makes due
   * (default Monday and Thursday). Each takes its type's checklist (`cleaningChecklistSnapshot`);
   * a type with none is skipped, as everywhere.
   * - A day that already has a cleaning not made by the routine (by hand, or a
   *   booking's own customised schedule) is left to it; routine jobs not yet
   *   started that day are removed.
   * - A routine job not yet started is retyped (and its checklist re-copied)
   *   when a booking changes what the day needs, e.g. vacant becomes check-out.
   * - Routine jobs not yet started on a listing that left the daily schedule
   *   are removed. Started and done jobs are never touched.
   * Idempotent, so it is safe on every mount and after every booking change.
   */
  function syncRoutineCleanings(today: Date = new Date()) {
    const { scheduleFor } = useCleaningScheduleDefault()
    const stays = allStays(listings.value, useReservationsModule().reservations.value)
    const notStarted = (j: CleaningJob) => j.status === 'draft' || j.status === 'scheduled' || j.status === 'confirmed'
    const days = Array.from({ length: ROUTINE_HORIZON_DAYS }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      return formatDateKey(d)
    })
    const firstDay = days[0]!
    const routineListings = new Map(listings.value
      .map(l => [l.id, scheduleFor(l)] as const)
      .filter(([, schedule]) => schedule.type === 'daily'))

    let next = jobs.value.filter(j =>
      // A listing that left the routine loses its upcoming routine jobs.
      !(j.routine && notStarted(j) && !routineListings.has(j.listingId) && cleaningDateKey(j.scheduledAt) >= firstDay))

    for (const [listingId, schedule] of routineListings) {
      const listing = listings.value.find(l => l.id === listingId)!
      const time = schedule.time || '11:00'
      const cleanerIds = schedule.assigneeIds?.length ? [...schedule.assigneeIds] : (schedule.assigneeId && schedule.assigneeId !== 'unassigned' ? [schedule.assigneeId] : [])
      // The listing's last cleaning before the window: where "every N days" counts from.
      let lastCleaned: string | null = next
        .filter(j => j.listingId === listingId && j.status !== 'cancelled' && cleaningDateKey(j.scheduledAt) < firstDay)
        .map(j => cleaningDateKey(j.scheduledAt))
        .sort()
        .at(-1) ?? null
      for (const day of days) {
        const hasCleaning = () => next.some(j => j.listingId === listingId && j.status !== 'cancelled' && cleaningDateKey(j.scheduledAt) === day)
        const stepDay = () => {
          if (hasCleaning())
            lastCleaned = day
        }
        if (routineSkips.value.includes(`${listingId}|${day}`)) {
          stepDay()
          continue
        }
        // One day's plan; returns early instead of `continue` so `stepDay` always runs after.
        const planDay = () => {
          const sameDay = next.filter(j => j.listingId === listingId && cleaningDateKey(j.scheduledAt) === day)
          // A routine day the user cancelled stays cancelled.
          if (sameDay.some(j => j.routine && j.status === 'cancelled'))
            return
          const onDay = sameDay.filter(j => j.status !== 'cancelled')
          if (onDay.some(j => !j.routine)) {
            next = next.filter(j => !(j.routine && notStarted(j) && onDay.includes(j)))
            return
          }
          const source: CleaningJobSource = routineDayType(listingId, day, stays, schedule.startOffset)
          const existing = onDay.find(j => j.routine)
          // An empty day is cleaned only when due (`vacantCleaningDue`, default Mon and Thu).
          if (source === 'vacant' && !vacantCleaningDue(day, lastCleaned, schedule.vacant)) {
            if (existing && notStarted(existing))
              next = next.filter(j => j.id !== existing.id)
            return
          }
          if (existing) {
            if (existing.source === source || !notStarted(existing))
              return
            const checklist = cleaningChecklistSnapshot(listingId, source)
            next = checklist
              ? next.map(j => j.id === existing.id ? { ...j, source, ...checklist, priority: source === 'check_out' ? 'high' as const : 'normal' as const, reservationId: stayIdFor(j) } : j)
              : next.filter(j => j.id !== existing.id)
            return
          }
          const checklist = cleaningChecklistSnapshot(listingId, source)
          if (!checklist)
            return
          const draft = { listingId, unitId: null, scheduledAt: `${day}T${time}:00+08:00` }
          next = [...next, {
            ...draft,
            listingName: listing.name,
            cleanerIds,
            cleanerNames: resolveCleanerNames(cleanerIds),
            teamName: 'Housekeeping',
            status: 'scheduled',
            priority: source === 'check_out' ? 'high' : 'normal',
            durationMinutes: source === 'check_out' ? 180 : 90,
            notes: '',
            source,
            recurrence: null,
            routine: true,
            ...checklist,
            reservationId: stayIdFor(draft),
            id: `cln-rt-${listingId}-${day}`,
          }]
        }
        planDay()
        stepDay()
      }
    }
    jobs.value = next
  }

  function resolveCleanerNames(cleanerIds: string[]) {
    return cleanerIds
      .map(id => cleanerOptions.find(option => option.id === id)?.name)
      .filter((name): name is string => Boolean(name))
  }

  function joinCleanerNames(cleanerIds: string[]) {
    return resolveCleanerNames(cleanerIds).join(', ')
  }

  function resolveListingName(listingId: string) {
    return listings.value.find(listing => listing.id === listingId)?.name ?? listingId
  }

  return {
    jobs,
    refreshFromSeed,
    jobsForListing,
    jobsForFilters,
    createJob,
    updateJob,
    isPlanned,
    releaseDueDrafts,
    deleteJob,
    applyReservationSchedule,
    clearReservationSchedule,
    createFromCheckout,
    moveCheckoutCleanings,
    dropArrivalOverlap,
    cancelOpenJobs,
    resolveCleanerNames,
    joinCleanerNames,
    resolveListingName,
    listingHasCleaningSteps,
    syncRoutineCleanings,
  }
}
