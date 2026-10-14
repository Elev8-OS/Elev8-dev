import type { CleaningJobInput } from '~/components/cleaning/data/cleaning-jobs'
import { beforeEach, describe, expect, it } from 'vitest'
import { LISTING_CUSTOM_STEPS } from '~/components/cleaning/data/cleaning-step-templates'
import { cleanCleaningSteps, countCleaningSteps, hasCleaningSteps } from '~/components/cleaning/data/cleaning-steps'
import { listings } from '~/components/listings/data/listings'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'

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

// Templates and defaults persist to localStorage; start every test from the seed.
beforeEach(() => {
  localStorage.clear()
})

const withSteps = () => listings.value.find(l => hasCleaningSteps(l))!
const withoutSteps = () => listings.value.find(l => !hasCleaningSteps(l))!

/** Runs `run` with the listing's maintenance patched, then restores it. */
function withMaintenance(listingId: string, patch: Partial<typeof listings.value[number]['maintenance']>, run: () => void) {
  const index = listings.value.findIndex(l => l.id === listingId)
  const original = listings.value[index]!
  listings.value[index] = { ...original, maintenance: { ...original.maintenance, ...patch } }
  try {
    run()
  }
  finally {
    listings.value[index] = original
  }
}

/** No company default for any type, so only a listing's own overrides count. */
function withoutCompanyDefaults(run: () => void) {
  const { typeDefaults } = useCleaningStepTemplates()
  const saved = typeDefaults.value
  typeDefaults.value = {}
  try {
    run()
  }
  finally {
    typeDefaults.value = saved
  }
}

const template = (id: string) => useCleaningStepTemplates().getTemplate(id)!

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
})

describe('checklists come from the company default unless the listing overrides the type', () => {
  it('cleans a listing with no own steps from the company defaults, from day one', () => {
    const { createJob, listingHasCleaningSteps } = useCleaningJobs()
    const id = withoutSteps().id
    expect(listingHasCleaningSteps(id)).toBe(true)
    const job = createJob({ ...input(id), source: 'daily' })!
    expect(job.steps).toEqual(template('cst-daily').sections)
    expect(job.checklistName).toBe('Daily refresh')
  })

  it('uses the listing\'s override for that type, and the default for the others', () => {
    // lst-1 overrides check-out with Deep clean (seed).
    const { createJob } = useCleaningJobs()
    expect(createJob({ ...input('lst-1'), source: 'check_out' })!.checklistName).toBe('Deep clean')
    // Legacy `checkout` counts as check-out.
    expect(createJob({ ...input('lst-1'), source: 'checkout' })!.checklistName).toBe('Deep clean')
    expect(createJob({ ...input('lst-1'), source: 'daily' })!.checklistName).toBe('Daily refresh')
  })

  it('uses the listing\'s custom steps for a type set to custom', () => {
    const listing = withSteps()
    const own = [{ id: 's', title: 'Own', steps: [{ id: '1', label: 'Our own step' }] }]
    withMaintenance(listing.id, { cleaningSteps: own, cleaningTemplates: { daily: LISTING_CUSTOM_STEPS } }, () => {
      const job = useCleaningJobs().createJob({ ...input(listing.id), source: 'daily' })!
      expect(job.steps).toEqual(own)
      expect(job.steps).not.toBe(own)
      expect(job.checklistName).toBe('Custom steps')
    })
  })

  it('falls back to the default when the overriding template is gone', () => {
    withMaintenance('lst-2', { cleaningTemplates: { daily: 'cst-missing' } }, () => {
      expect(useCleaningJobs().createJob({ ...input('lst-2'), source: 'daily' })!.checklistName).toBe('Daily refresh')
    })
  })

  it('keeps a listing saved before checklists per type on its own steps when they differ from every template', () => {
    const own = [{ id: 's', title: 'Legacy', steps: [{ id: '1', label: 'Legacy step' }] }]
    withMaintenance('lst-2', { cleaningSteps: own, cleaningTemplates: undefined }, () => {
      const { createJob } = useCleaningJobs()
      expect(createJob({ ...input('lst-2'), source: 'check_out' })!.steps).toEqual(own)
      expect(createJob({ ...input('lst-2'), source: 'daily' })!.steps).toEqual(own)
    })
  })

  it('moves a listing whose own steps match a template onto the defaults', () => {
    // lst-2 carries the villa template's steps (seed) and no overrides.
    expect(listings.value.find(l => l.id === 'lst-2')!.maintenance.cleaningTemplates).toBeUndefined()
    expect(useCleaningJobs().createJob({ ...input('lst-2'), source: 'daily' })!.checklistName).toBe('Daily refresh')
  })
})

describe('the checklist gate in useCleaningJobs', () => {
  it('refuses a job when its type has no checklist, creating nothing', () => {
    withoutCompanyDefaults(() => {
      const { createJob, jobsForListing, listingHasCleaningSteps } = useCleaningJobs()
      const id = withoutSteps().id
      const before = jobsForListing(id).length
      expect(listingHasCleaningSteps(id)).toBe(false)
      expect(createJob(input(id))).toBeNull()
      expect(jobsForListing(id)).toHaveLength(before)
    })
  })

  it('opens the gate per type', () => {
    withoutCompanyDefaults(() => {
      const listing = withoutSteps()
      withMaintenance(listing.id, { cleaningTemplates: { check_out: 'cst-villa' } }, () => {
        const { createJob, listingHasCleaningSteps, applyReservationSchedule } = useCleaningJobs()
        expect(listingHasCleaningSteps(listing.id)).toBe(true)
        expect(listingHasCleaningSteps(listing.id, 'check_out')).toBe(true)
        expect(listingHasCleaningSteps(listing.id, 'daily')).toBe(false)
        expect(createJob({ ...input(listing.id), source: 'daily' })).toBeNull()
        const added = applyReservationSchedule('res-types', [
          { ...input(listing.id), source: 'daily' },
          { ...input(listing.id), source: 'check_out' },
        ])
        expect(added.map(j => j.source)).toEqual(['check_out'])
      })
    })
  })

  it('lets a job that brings its own steps through', () => {
    withoutCompanyDefaults(() => {
      const steps = [{ id: 's', title: 'All', steps: [{ id: '1', label: 'Mop' }] }]
      const job = useCleaningJobs().createJob({ ...input(withoutSteps().id), steps, checklistName: 'Studio / apartment' })!
      expect(job.steps).toEqual(steps)
      expect(job.checklistName).toBe('Studio / apartment')
    })
  })
})

describe('a job\'s checklist is a snapshot', () => {
  it('keeps the copy when the template changes later', () => {
    const { createJob, jobs } = useCleaningJobs()
    const { updateTemplate } = useCleaningStepTemplates()
    const job = createJob({ ...input('lst-2'), source: 'daily' })!
    const before = JSON.parse(JSON.stringify(job.steps))
    updateTemplate('cst-daily', { name: 'Renamed', sections: [{ id: 'x', title: 'Changed', steps: [{ id: '1', label: 'New step' }] }] })
    const stored = jobs.value.find(j => j.id === job.id)!
    expect(stored.steps).toEqual(before)
    expect(stored.checklistName).toBe('Daily refresh')
  })

  it('copies onto a reservation\'s generated jobs too', () => {
    const [job] = useCleaningJobs().applyReservationSchedule('res-steps', [{ ...input('lst-1'), source: 'check_out' }])
    expect(job!.steps).toEqual(template('cst-deep').sections)
    expect(job!.checklistName).toBe('Deep clean')
  })

  it('re-copies when a job not yet started moves to another listing', () => {
    const { createJob, updateJob, jobs } = useCleaningJobs()
    const job = createJob({ ...input('lst-2'), source: 'check_out' })!
    expect(job.checklistName).toBe('Villa standard')
    updateJob(job.id, { listingId: 'lst-1' })
    const moved = jobs.value.find(j => j.id === job.id)!
    expect(moved.checklistName).toBe('Deep clean')
    expect(moved.steps).toEqual(template('cst-deep').sections)
  })

  it('gives seeded jobs not yet done a checklist, and leaves done ones to their report', () => {
    const { jobs } = useCleaningJobs()
    const open = jobs.value.filter(j => j.status !== 'done' && listings.value.some(l => l.id === j.listingId))
    expect(open.length).toBeGreaterThan(0)
    expect(open.every(j => (j.steps?.length ?? 0) > 0 && Boolean(j.checklistName))).toBe(true)
    expect(jobs.value.filter(j => j.status === 'done').every(j => !j.steps)).toBe(true)
  })
})
