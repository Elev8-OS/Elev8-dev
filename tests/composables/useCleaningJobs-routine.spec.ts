import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import { beforeEach, describe, expect, it } from 'vitest'
import { routineDayType } from '~/components/cleaning/data/cleaning-link'
import { listings } from '~/components/listings/data/listings'
import { describeListingCleaning, describeVacantCleaning, vacantCleaningDue } from '~/components/reservations/data/cleaning-schedule'
import { ROUTINE_HORIZON_DAYS, useCleaningJobs } from '~/composables/useCleaningJobs'
import { useCleaningScheduleDefault } from '~/composables/useCleaningScheduleDefault'
import { useCleaningStepTemplates } from '~/composables/useCleaningStepTemplates'
import { useReservationsModule } from '~/composables/useReservationsModule'

// A quiet stretch far from the seed's stays, so every day starts empty.
const TODAY = new Date(2027, 2, 1) // 2027-03-01, local midnight
const LISTING = 'lst-2'
const seededListings = listings.value

function book(checkIn: string, checkOut: string, status = 'verified') {
  const { createReservation } = useReservationsModule()
  const listing = listings.value.find(l => l.id === LISTING)!
  const result = createReservation({
    guestName: 'Routine Guest',
    guestEmail: 'routine@example.com',
    guestPhone: '+62 811 0000',
    guestLanguage: 'en',
    guestNotes: '',
    listingId: LISTING,
    listingName: listing.name,
    channel: 'Direct',
    checkIn,
    checkOut,
    nights: 1,
    guestCount: 2,
    totalPrice: 100,
    currency: 'USD',
    status: status as never,
  })
  return result.id!
}

function routineJobs(): CleaningJob[] {
  return useCleaningJobs().jobs.value.filter(j => j.listingId === LISTING && j.scheduledAt >= '2027-03-01' && j.status !== 'cancelled').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}
const byDay = () => Object.fromEntries(routineJobs().map(j => [j.scheduledAt.slice(0, 10), j]))

beforeEach(() => {
  localStorage.clear()
  listings.value = seededListings
  // lst-2 follows the company schedule, switched to the daily routine here
  // (a new tenant starts on check-out cleaning).
  useCleaningScheduleDefault().setCompanyDefault({ ...useCleaningScheduleDefault().companyDefault.value, type: 'daily' })
  const index = listings.value.findIndex(l => l.id === LISTING)
  const original = listings.value[index]!
  listings.value = listings.value.map((l, i) => i === index ? { ...original, maintenance: { ...original.maintenance, defaultCleaningSchedule: undefined } } : l)
})

describe('vacantCleaningDue', () => {
  it('reads each frequency', () => {
    // 2027-03-01 Monday, 2027-03-02 Tuesday.
    expect(vacantCleaningDue('2027-03-01', null)).toBe(true)
    expect(vacantCleaningDue('2027-03-02', null)).toBe(false)
    expect(vacantCleaningDue('2027-03-02', null, { frequency: 'every_day' })).toBe(true)
    expect(vacantCleaningDue('2027-03-02', null, { frequency: 'never' })).toBe(false)
    expect(vacantCleaningDue('2027-03-03', '2027-03-01', { frequency: 'every_n_days', dayInterval: 2 })).toBe(true)
    expect(vacantCleaningDue('2027-03-02', '2027-03-01', { frequency: 'every_n_days', dayInterval: 2 })).toBe(false)
  })

  it('describes the schedule in one sentence', () => {
    expect(describeListingCleaning({ type: 'daily', time: '11:00' }))
      .toBe('Cleaned at 11:00: daily cleaning with guests in, check-out cleaning when they leave, vacant upkeep every Mon and Thu while empty.')
    expect(describeVacantCleaning({ frequency: 'every_n_days', dayInterval: 3 })).toBe('every 3 days')
  })
})

describe('routineDayType', () => {
  const stays = [{ id: 'r', listingId: 'x', checkIn: '2027-03-03', checkOut: '2027-03-06', status: 'verified' }]
  it('reads in-house, departure and empty days', () => {
    expect(routineDayType('x', '2027-03-02', stays)).toBe('vacant')
    expect(routineDayType('x', '2027-03-03', stays)).toBe('daily')
    expect(routineDayType('x', '2027-03-05', stays)).toBe('daily')
    expect(routineDayType('x', '2027-03-06', stays)).toBe('check_out')
    expect(routineDayType('x', '2027-03-03', stays, 'day_after_check_in')).toBe('vacant')
  })

  it('does not count a block or a cancellation as a stay', () => {
    expect(routineDayType('x', '2027-03-04', [{ ...stays[0]!, status: 'blocked' }])).toBe('vacant')
    expect(routineDayType('x', '2027-03-06', [{ ...stays[0]!, status: 'cancelled' }])).toBe('vacant')
  })
})

describe('the daily routine', () => {
  it('cleans an empty listing on Mondays and Thursdays by default, two weeks ahead', () => {
    useCleaningJobs().syncRoutineCleanings(TODAY)
    const jobs = routineJobs()
    // 2027-03-01 is a Monday.
    expect(jobs.map(j => j.scheduledAt.slice(0, 10))).toEqual(['2027-03-01', '2027-03-04', '2027-03-08', '2027-03-11'])
    expect(jobs.every(j => j.routine && j.source === 'vacant' && j.checklistName === 'Vacant upkeep')).toBe(true)
    expect(jobs[0]!.scheduledAt).toBe('2027-03-01T11:00:00+08:00')
  })

  it('cleans every empty day when set to every day', () => {
    useCleaningScheduleDefault().setCompanyDefault({ type: 'daily', time: '11:00', vacant: { frequency: 'every_day' } })
    useCleaningJobs().syncRoutineCleanings(TODAY)
    expect(routineJobs()).toHaveLength(ROUTINE_HORIZON_DAYS)
  })

  it('counts every N days from the last cleaning, so it restarts after a check-out', () => {
    useCleaningScheduleDefault().setCompanyDefault({ type: 'daily', time: '11:00', vacant: { frequency: 'every_n_days', dayInterval: 3 } })
    book('2027-03-03', '2027-03-06')
    useCleaningJobs().syncRoutineCleanings(TODAY)
    const days = Object.keys(byDay())
    expect(days).toEqual(['2027-03-01', '2027-03-03', '2027-03-04', '2027-03-05', '2027-03-06', '2027-03-09', '2027-03-12'])
  })

  it('never cleans an empty listing when set to never', () => {
    useCleaningScheduleDefault().setCompanyDefault({ type: 'daily', time: '11:00', vacant: { frequency: 'never' } })
    book('2027-03-03', '2027-03-06')
    useCleaningJobs().syncRoutineCleanings(TODAY)
    expect(routineJobs().every(j => j.source !== 'vacant')).toBe(true)
    expect(routineJobs()).toHaveLength(4)
  })

  it('types each day by the bookings: daily with guests in, check-out on departure', () => {
    const id = book('2027-03-03', '2027-03-06')
    useCleaningJobs().syncRoutineCleanings(TODAY)
    const days = byDay()
    expect(days['2027-03-01']!.source).toBe('vacant')
    expect(days['2027-03-02']).toBeUndefined()
    expect(days['2027-03-03']!.source).toBe('daily')
    expect(days['2027-03-03']!.checklistName).toBe('Daily refresh')
    expect(days['2027-03-03']!.reservationId).toBe(id)
    expect(days['2027-03-06']!.source).toBe('check_out')
    expect(days['2027-03-06']!.priority).toBe('high')
    expect(days['2027-03-07']).toBeUndefined()
    expect(days['2027-03-08']!.source).toBe('vacant')
    expect(routineJobs()).toHaveLength(7)
  })

  it('gives a booking on a routine listing no schedule of its own', () => {
    const id = book('2027-03-03', '2027-03-06')
    expect(useReservationsModule().reservations.value.find(r => r.id === id)!.cleaningSchedule).toBeUndefined()
  })

  it('retypes vacant days once a booking arrives, and is idempotent', () => {
    const { syncRoutineCleanings } = useCleaningJobs()
    syncRoutineCleanings(TODAY)
    const before = byDay()['2027-03-04']!
    book('2027-03-03', '2027-03-06')
    syncRoutineCleanings(TODAY)
    syncRoutineCleanings(TODAY)
    const after = byDay()['2027-03-04']!
    expect(after.id).toBe(before.id)
    expect(after.source).toBe('daily')
    expect(after.checklistName).toBe('Daily refresh')
    expect(routineJobs()).toHaveLength(7)
  })

  it('leaves a day with a cleaning made by hand to it', () => {
    const { syncRoutineCleanings, createJob } = useCleaningJobs()
    syncRoutineCleanings(TODAY)
    const listing = listings.value.find(l => l.id === LISTING)!
    createJob({
      listingId: LISTING,
      listingName: listing.name,
      scheduledAt: '2027-03-05T09:00:00+08:00',
      cleanerIds: [],
      cleanerNames: [],
      teamName: 'Housekeeping',
      status: 'scheduled',
      priority: 'normal',
      durationMinutes: 120,
      notes: '',
      source: 'custom',
      recurrence: null,
    })
    syncRoutineCleanings(TODAY)
    const onDay = routineJobs().filter(j => j.scheduledAt.startsWith('2027-03-05'))
    expect(onDay).toHaveLength(1)
    expect(onDay[0]!.routine).toBeFalsy()
  })

  it('does not refill a routine day the user deleted', () => {
    const { syncRoutineCleanings, deleteJob } = useCleaningJobs()
    syncRoutineCleanings(TODAY)
    deleteJob(byDay()['2027-03-08']!.id)
    syncRoutineCleanings(TODAY)
    expect(byDay()['2027-03-08']).toBeUndefined()
  })

  it('removes upcoming routine cleanings when the listing leaves the daily schedule', () => {
    const { syncRoutineCleanings } = useCleaningJobs()
    syncRoutineCleanings(TODAY)
    useCleaningScheduleDefault().setCompanyDefault({ type: 'checkout', time: '11:00' })
    syncRoutineCleanings(TODAY)
    expect(routineJobs().filter(j => j.routine)).toHaveLength(0)
  })

  it('drops an empty day\'s upkeep that is no longer due', () => {
    const { syncRoutineCleanings } = useCleaningJobs()
    useCleaningScheduleDefault().setCompanyDefault({ type: 'daily', time: '11:00', vacant: { frequency: 'every_day' } })
    syncRoutineCleanings(TODAY)
    expect(byDay()['2027-03-02']).toBeDefined()
    useCleaningScheduleDefault().setCompanyDefault({ type: 'daily', time: '11:00' })
    syncRoutineCleanings(TODAY)
    expect(byDay()['2027-03-02']).toBeUndefined()
    expect(byDay()['2027-03-04']).toBeDefined()
  })

  it('runs nothing for a listing on the new tenant\'s check-out schedule', () => {
    localStorage.clear()
    useCleaningScheduleDefault().setCompanyDefault({ type: 'checkout', time: '11:00' })
    useCleaningJobs().syncRoutineCleanings(TODAY)
    expect(routineJobs()).toHaveLength(0)
  })

  it('skips a type with no checklist', () => {
    const { typeDefaults } = useCleaningStepTemplates()
    typeDefaults.value = { ...typeDefaults.value, vacant: undefined }
    useCleaningJobs().syncRoutineCleanings(TODAY)
    expect(routineJobs()).toHaveLength(0)
  })
})
