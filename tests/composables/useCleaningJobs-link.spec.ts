import type { CleaningJobInput } from '~/components/cleaning/data/cleaning-jobs'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useReservationsModule } from '~/composables/useReservationsModule'

function stay(id: string, checkIn: string, checkOut: string, listingId = 'lst-1'): ReservationEntry {
  return { id, listingId, listingName: 'Villa', checkIn, checkOut, status: 'verified', guestName: id } as ReservationEntry
}

function input(day: string, patch: Partial<CleaningJobInput> = {}): CleaningJobInput {
  return {
    listingId: 'lst-1',
    listingName: 'Villa',
    scheduledAt: `${day}T11:00:00+08:00`,
    cleanerIds: [],
    cleanerNames: [],
    teamName: null,
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 60,
    notes: '',
    source: 'custom',
    ...patch,
  }
}

beforeEach(() => {
  useReservationsModule().reservations.value = [
    stay('res-a', '2026-11-01', '2026-11-05'),
    stay('res-b', '2026-11-05', '2026-11-09'),
  ]
})

describe('createJob links automatically', () => {
  it('links a new cleaning to the stay on its date', () => {
    const { createJob } = useCleaningJobs()
    expect(createJob(input('2026-11-03')).reservationId).toBe('res-a')
    expect(createJob(input('2026-11-05')).reservationId).toBe('res-a')
    expect(createJob(input('2026-11-07')).reservationId).toBe('res-b')
  })

  it('still creates a cleaning on a date with no stay, unlinked', () => {
    const { createJob, jobs } = useCleaningJobs()
    const job = createJob(input('2026-11-20'))
    expect(job.reservationId).toBeNull()
    expect(jobs.value.some(j => j.id === job.id)).toBe(true)
  })

  it('trusts a caller that already knows the stay', () => {
    const { createJob } = useCleaningJobs()
    expect(createJob(input('2026-11-20', { reservationId: 'res-a' })).reservationId).toBe('res-a')
  })
})

describe('updateJob keeps the link honest', () => {
  it('relinks a cleaning moved to a date inside another stay', () => {
    const { createJob, updateJob, jobs } = useCleaningJobs()
    const job = createJob(input('2026-11-03'))
    updateJob(job.id, { scheduledAt: '2026-11-07T11:00:00+08:00' })
    expect(jobs.value.find(j => j.id === job.id)!.reservationId).toBe('res-b')
  })

  it('keeps the link when a turnover clean is pushed to a date with no stay', () => {
    useReservationsModule().reservations.value = [stay('res-a', '2026-11-01', '2026-11-05')]
    const { createJob, updateJob, jobs } = useCleaningJobs()
    const job = createJob(input('2026-11-05', { source: 'check_out' }))
    updateJob(job.id, { scheduledAt: '2026-11-06T09:00:00+08:00' })
    expect(jobs.value.find(j => j.id === job.id)!.reservationId).toBe('res-a')
  })

  it('relinks from scratch when a cleaning moves to another listing', () => {
    const { createJob, updateJob, jobs } = useCleaningJobs()
    const job = createJob(input('2026-11-03'))
    updateJob(job.id, { listingId: 'lst-2' })
    expect(jobs.value.find(j => j.id === job.id)!.reservationId).toBeNull()
  })

  it('leaves the link alone on an edit that moves nothing', () => {
    const { createJob, updateJob, jobs } = useCleaningJobs()
    const job = createJob(input('2026-11-03'))
    updateJob(job.id, { priority: 'high' })
    expect(jobs.value.find(j => j.id === job.id)!.reservationId).toBe('res-a')
  })

  it('takes an explicit reservationId in the patch as given', () => {
    const { createJob, updateJob, jobs } = useCleaningJobs()
    const job = createJob(input('2026-11-03'))
    updateJob(job.id, { scheduledAt: '2026-11-07T11:00:00+08:00', reservationId: 'res-a' })
    expect(jobs.value.find(j => j.id === job.id)!.reservationId).toBe('res-a')
  })
})
