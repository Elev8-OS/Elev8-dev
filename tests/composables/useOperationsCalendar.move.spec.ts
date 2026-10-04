import { describe, expect, it } from 'vitest'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { useOperationsCalendar } from '~/composables/useOperationsCalendar'

describe('moving a cleaning on the operations calendar', () => {
  it('dropping on a room row sets the room; dropping on the listing row clears it', () => {
    const { jobs: cleaningJobs } = useCleaningJobs()
    const job = cleaningJobs.value.find(j => j.listingId === 'lst-1')!
    const { moveCleaning } = useOperationsCalendar()
    moveCleaning({ id: job.id, listingId: 'lst-1', unitId: 'un-3', scheduledAt: '2030-01-05T11:00:00+08:00' })
    expect(cleaningJobs.value.find(j => j.id === job.id)).toMatchObject({ unitId: 'un-3', unitName: 'Pool Unit' })
    moveCleaning({ id: job.id, listingId: 'lst-1', unitId: null, scheduledAt: '2030-01-05T11:00:00+08:00' })
    expect(cleaningJobs.value.find(j => j.id === job.id)).toMatchObject({ unitId: null, unitName: null })
  })
})
