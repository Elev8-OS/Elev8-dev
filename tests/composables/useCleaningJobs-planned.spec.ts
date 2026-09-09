import type { CleaningJobInput } from '~/components/cleaning/data/cleaning-jobs'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCleaningJobs } from '~/composables/useCleaningJobs'

beforeEach(() => {
  window.localStorage.clear()
})

/** What the reservation sheet's "Plan only" path writes. */
function plannedJobInput(date: string, overrides: Partial<CleaningJobInput> = {}): CleaningJobInput {
  return {
    listingId: 'lst-1',
    listingName: 'Villa Bidadari',
    scheduledAt: `${date}T11:00:00+08:00`,
    cleanerIds: [],
    cleanerNames: [],
    teamName: 'Housekeeping',
    status: 'draft',
    priority: 'normal',
    durationMinutes: 180,
    notes: 'Cleaning for reservation res-1',
    source: 'custom',
    reservationId: 'res-1',
    recurrence: null,
    releaseAt: `${date}T00:00:00+08:00`,
    ...overrides,
  }
}

describe('planned-ahead cleanings', () => {
  it('treats a draft with a release date as planned, not as housekeeping work', () => {
    const { createJob, isPlanned } = useCleaningJobs()

    const job = createJob(plannedJobInput('2026-09-11'))

    expect(job.status).toBe('draft')
    expect(isPlanned(job)).toBe(true)
  })

  it('does not count an ordinary draft as planned', () => {
    const { createJob, isPlanned } = useCleaningJobs()

    // What createFromCheckout writes: draft, but no release date.
    const job = createJob(plannedJobInput('2026-09-11', { releaseAt: null }))

    expect(isPlanned(job)).toBe(false)
  })

  it('leaves a plan alone while its release moment is still ahead', () => {
    const { jobs, createJob, releaseDueDrafts } = useCleaningJobs()

    const job = createJob(plannedJobInput('2026-09-11'))
    const released = releaseDueDrafts(new Date('2026-09-08T10:00:00+08:00'))

    expect(released).toBe(0)
    expect(jobs.value.find(j => j.id === job.id)?.status).toBe('draft')
  })

  it('releases the plan into housekeeping once the date arrives', () => {
    const { jobs, createJob, releaseDueDrafts, isPlanned } = useCleaningJobs()

    const job = createJob(plannedJobInput('2026-09-11'))
    const released = releaseDueDrafts(new Date('2026-09-11T00:00:00+08:00'))

    expect(released).toBe(1)
    const after = jobs.value.find(j => j.id === job.id)!
    expect(after.status).toBe('scheduled')
    expect(after.releaseAt).toBeNull()
    expect(isPlanned(after)).toBe(false)
  })

  it('is idempotent — a second sweep releases nothing more', () => {
    const { createJob, releaseDueDrafts } = useCleaningJobs()

    createJob(plannedJobInput('2026-09-11'))
    releaseDueDrafts(new Date('2026-09-12T00:00:00+08:00'))

    expect(releaseDueDrafts(new Date('2026-09-13T00:00:00+08:00'))).toBe(0)
  })

  it('never touches jobs that were scheduled directly', () => {
    const { jobs, createJob, releaseDueDrafts } = useCleaningJobs()

    const job = createJob(plannedJobInput('2026-09-11', { status: 'scheduled', releaseAt: null }))
    releaseDueDrafts(new Date('2026-12-01T00:00:00+08:00'))

    expect(jobs.value.find(j => j.id === job.id)?.status).toBe('scheduled')
  })
})
