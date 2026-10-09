import type { CockpitRow } from './cockpit'
import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import { cleaningDateKey } from '~/components/cleaning/data/cleaning-link'
import { isLiveStay } from './cockpit'

/**
 * A room's housekeeping state today, for the Cockpit's room column, the way a
 * hotel tape chart shows it. Framework-free; specs in
 * `tests/lib/cockpit-cleaning.spec.ts`.
 *
 * - `cleaning`: a cleaning of the room is in progress today.
 * - `dirty`: a guest has left (today or earlier) and no cleaning has been
 *   completed since, and nobody has moved in after them.
 * - `occupied`: a guest who arrived before today is in the room.
 * - `clean`: none of the above.
 */
export type RoomCleaningState = 'clean' | 'dirty' | 'cleaning' | 'occupied'

export interface RoomCleaningStatus {
  state: RoomCleaningState
  /** The tooltip: what the state rests on and what comes next. */
  detail: string
  /**
   * The cleaning a click on the icon opens: the one in progress; for an
   * occupied or dirty room the next one, else (dirty) the missed one; for a
   * clean room the last one done, else the next. Absent when the room has no
   * cleaning to show (the board then offers to schedule one).
   */
  jobId?: string
}

/**
 * One broom for every state; only the colour changes (the user's pick): red
 * dirty, green clean, blue cleaning in progress, grey while a guest is in.
 */
export const ROOM_CLEANING_ICON = 'lucide:brush-cleaning'

export const roomCleaningMeta: Record<RoomCleaningState, { label: string, classes: string }> = {
  clean: { label: 'Clean', classes: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  dirty: { label: 'Dirty', classes: 'border-destructive/40 bg-destructive/10 text-destructive' },
  cleaning: { label: 'Cleaning', classes: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  occupied: { label: 'Occupied', classes: 'border-border bg-muted text-muted-foreground' },
}

type JobLike = Pick<CleaningJob, 'id' | 'listingId' | 'unitId' | 'scheduledAt' | 'status' | 'cleanerNames' | 'source'>

/** A single-unit row takes every job of its listing; a room row only the jobs naming that room. */
function jobsForRow(row: CockpitRow, listingId: string, jobs: JobLike[]): JobLike[] {
  return jobs
    .filter(j => j.listingId === listingId && (row.kind === 'unit' || j.unitId === row.unitId))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}

function formatDay(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** "9 Oct 11:00", in property time (Bali, UTC+8). */
function formatWhen(scheduledAt: string) {
  const ms = new Date(scheduledAt).getTime() + 8 * 60 * 60 * 1000
  const time = new Date(ms).toISOString().slice(11, 16)
  return `${formatDay(cleaningDateKey(scheduledAt))} ${time}`
}

function who(job: JobLike) {
  return job.cleanerNames.length ? `, ${job.cleanerNames.join(', ')}` : ''
}

const NOT_STARTED = new Set(['draft', 'scheduled', 'confirmed'])

/** The next cleaning not yet started, from today on. */
function nextJob(jobs: JobLike[], todayKey: string): JobLike | undefined {
  return jobs.find(j => cleaningDateKey(j.scheduledAt) >= todayKey && NOT_STARTED.has(j.status))
}

/** The next cleaning not yet done, from today on, as a sentence; else null. */
function nextCleaning(jobs: JobLike[], todayKey: string): string | null {
  const next = nextJob(jobs, todayKey)
  return next ? `Next cleaning ${formatWhen(next.scheduledAt)}${who(next)}.` : null
}

export function roomCleaningStatus(row: CockpitRow, listingId: string, jobs: JobLike[], todayKey: string): RoomCleaningStatus | null {
  if (row.kind === 'unassigned')
    return null
  const rowJobs = jobsForRow(row, listingId, jobs)

  const ongoing = rowJobs.find(j => j.status === 'in_progress' && cleaningDateKey(j.scheduledAt) === todayKey)
  if (ongoing)
    return { state: 'cleaning', detail: `Cleaning in progress, started ${formatWhen(ongoing.scheduledAt)}${who(ongoing)}.`, jobId: ongoing.id }

  // Guests only: a block has nobody in it, and a cancelled stay never happened.
  const guests = row.stays.filter(s => s.type !== 'block' && isLiveStay(s))
  const inHouse = guests.find(s => s.checkIn < todayKey && todayKey < s.checkOut)
  if (inHouse) {
    const next = nextCleaning(rowJobs, todayKey)
    return { state: 'occupied', detail: `Occupied by ${inHouse.guestName} until ${formatDay(inHouse.checkOut)}.${next ? ` ${next}` : ''}`, jobId: nextJob(rowJobs, todayKey)?.id }
  }

  const lastDeparture = guests
    .map(s => s.checkOut)
    .filter(key => key <= todayKey)
    .sort()
    .at(-1)
  const cleanedSince = (from: string) => rowJobs.filter(j => j.status === 'done' && cleaningDateKey(j.scheduledAt) >= from && cleaningDateKey(j.scheduledAt) <= todayKey).at(-1)

  if (lastDeparture && !cleanedSince(lastDeparture)) {
    // A cleaning dated before today that never started was missed, as on the Operations Calendar.
    const missedJob = rowJobs.filter((j) => {
      const key = cleaningDateKey(j.scheduledAt)
      return key >= lastDeparture && (j.status === 'missed' || (key < todayKey && NOT_STARTED.has(j.status)))
    }).at(-1)
    const missed = Boolean(missedJob)
    const next = nextCleaning(rowJobs, todayKey)
    const plan = missed
      ? `The cleaning was missed.${next ? ` ${next}` : ''}`
      : next ?? 'No cleaning scheduled.'
    return { state: 'dirty', detail: `Dirty: the guest left ${formatDay(lastDeparture)}. ${plan}`, jobId: (nextJob(rowJobs, todayKey) ?? missedJob)?.id }
  }

  const last = rowJobs.filter(j => j.status === 'done' && cleaningDateKey(j.scheduledAt) <= todayKey).at(-1)
  return { state: 'clean', detail: last ? `Clean. Last cleaned ${formatWhen(last.scheduledAt)}${who(last)}.` : 'Clean.', jobId: (last ?? nextJob(rowJobs, todayKey))?.id }
}
