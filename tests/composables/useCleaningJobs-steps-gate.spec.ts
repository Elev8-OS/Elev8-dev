import type { CleaningJobInput } from '~/components/cleaning/data/cleaning-jobs'
import { describe, expect, it } from 'vitest'
import { cleanCleaningSteps, countCleaningSteps, hasCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import { listings } from '~/components/listings/data/listings'
import { useCleaningJobs } from '~/composables/useCleaningJobs'

function input(listingId: string): CleaningJobInput {
  return {
    listingId,
    listingName: listingId,
    scheduledAt: '2026-11-02T11:00:00+08:00',
    cleanerIds: [],
    cleanerNames: [],
    teamName: null,
    status: 'scheduled',
    priority: 'normal',
    durationMinutes: 120,
    notes: '',
    source: 'custom',
    recurrence: null,
  } as CleaningJobInput
}

const withSteps = () => listings.value.find(l => hasCleaningSteps(l))!
const withoutSteps = () => listings.value.find(l => !hasCleaningSteps(l))!

describe('cleaning steps helpers', () => {
  it('counts only named steps', () => {
    expect(countCleaningSteps([{ id: 'a', title: 'A', steps: [{ id: '1', label: 'Mop' }, { id: '2', label: '  ' }] }])).toBe(1)
    expect(countCleaningSteps(undefined)).toBe(0)
  })

  it('drops blank steps and empty sections on save', () => {
    expect(cleanCleaningSteps([
      { id: 'a', title: ' Kitchen ', steps: [{ id: '1', label: ' Fridge ' }, { id: '2', label: '' }] },
      { id: 'b', title: 'Empty', steps: [{ id: '3', label: ' ' }] },
    ])).toEqual([{ id: 'a', title: 'Kitchen', steps: [{ id: '1', label: 'Fridge' }] }])
  })

  it('seeds some listings with steps and leaves others without, so the gate shows', () => {
    expect(withSteps()).toBeTruthy()
    expect(withoutSteps()).toBeTruthy()
  })
})

describe('the cleaning-steps gate in useCleaningJobs', () => {
  it('creates a job for a listing with steps', () => {
    const { createJob, jobsForListing } = useCleaningJobs()
    const before = jobsForListing(withSteps().id).length
    expect(createJob(input(withSteps().id))).not.toBeNull()
    expect(jobsForListing(withSteps().id)).toHaveLength(before + 1)
  })

  it('refuses a job for a listing without steps, creating nothing', () => {
    const { createJob, jobsForListing, listingHasCleaningSteps } = useCleaningJobs()
    const id = withoutSteps().id
    const before = jobsForListing(id).length
    expect(listingHasCleaningSteps(id)).toBe(false)
    expect(createJob(input(id))).toBeNull()
    expect(jobsForListing(id)).toHaveLength(before)
  })

  it('drops a reservation\'s generated jobs for a listing without steps', () => {
    const { applyReservationSchedule } = useCleaningJobs()
    const added = applyReservationSchedule('res-gate', [input(withSteps().id), input(withoutSteps().id)])
    expect(added.map(j => j.listingId)).toEqual([withSteps().id])
  })

  it('opens the gate once steps are added', () => {
    const { createJob } = useCleaningJobs()
    const listing = withoutSteps()
    const index = listings.value.findIndex(l => l.id === listing.id)
    const original = listings.value[index]!
    listings.value[index] = { ...original, maintenance: { ...original.maintenance, cleaningSteps: [{ id: 's', title: 'All', steps: [{ id: '1', label: 'Mop' }] }] } }
    try {
      expect(createJob(input(listing.id))).not.toBeNull()
    }
    finally {
      listings.value[index] = original
    }
  })
})

describe('a job\'s checklist is a copy of the listing\'s steps', () => {
  it('copies the steps when the job is created', () => {
    const { createJob } = useCleaningJobs()
    const listing = withSteps()
    const job = createJob(input(listing.id))!
    expect(job.steps).toEqual(listing.maintenance.cleaningSteps)
    expect(job.steps).not.toBe(listing.maintenance.cleaningSteps)
  })

  it('keeps the copy when the listing\'s steps change later', () => {
    const { createJob, jobs } = useCleaningJobs()
    const listing = withSteps()
    const job = createJob(input(listing.id))!
    const before = JSON.parse(JSON.stringify(job.steps))
    const index = listings.value.findIndex(l => l.id === listing.id)
    const original = listings.value[index]!
    listings.value[index] = { ...original, maintenance: { ...original.maintenance, cleaningSteps: [{ id: 'x', title: 'Changed', steps: [{ id: '1', label: 'New step' }] }] } }
    try {
      expect(jobs.value.find(j => j.id === job.id)!.steps).toEqual(before)
    }
    finally {
      listings.value[index] = original
    }
  })

  it('copies onto a reservation\'s generated jobs too', () => {
    const { applyReservationSchedule } = useCleaningJobs()
    const [job] = applyReservationSchedule('res-steps', [input(withSteps().id)])
    expect(job!.steps).toEqual(withSteps().maintenance.cleaningSteps)
  })

  it('re-copies when a job not yet started moves to another listing', () => {
    const { createJob, updateJob, jobs } = useCleaningJobs()
    const [a, b] = listings.value.filter(l => hasCleaningSteps(l))
    const index = listings.value.findIndex(l => l.id === b!.id)
    const original = listings.value[index]!
    const otherSteps = [{ id: 'y', title: 'Other', steps: [{ id: '1', label: 'Other step' }] }]
    listings.value[index] = { ...original, maintenance: { ...original.maintenance, cleaningSteps: otherSteps } }
    try {
      const job = createJob(input(a!.id))!
      updateJob(job.id, { listingId: b!.id })
      expect(jobs.value.find(j => j.id === job.id)!.steps).toEqual(otherSteps)
    }
    finally {
      listings.value[index] = original
    }
  })

  it('gives seeded jobs not yet done a checklist, and leaves done ones to their report', () => {
    const { jobs } = useCleaningJobs()
    const open = jobs.value.filter(j => j.status !== 'done' && hasCleaningSteps(listings.value.find(l => l.id === j.listingId)))
    expect(open.length).toBeGreaterThan(0)
    expect(open.every(j => (j.steps?.length ?? 0) > 0)).toBe(true)
    expect(jobs.value.filter(j => j.status === 'done').every(j => !j.steps)).toBe(true)
  })
})

