import { describe, expect, it } from 'vitest'
import {
  computeCleaningDates,
  formatCleaningScheduleSummary,
  formatListingCleaningSummary,
  generateCleaningJobsForReservation,
  resolveDefaultCleaningSchedule,
} from '~/components/reservations/data/cleaning-schedule'
import { useCleaningJobs } from '~/composables/useCleaningJobs'

describe('reservation cleaning schedule helpers', () => {
  describe('compute cleaning dates', () => {
    it('computes checkout cleaning on checkout date', () => {
      const dates = computeCleaningDates({
        type: 'checkout',
        startDate: '2026-09-10',
        checkIn: '2026-09-10',
        checkOut: '2026-09-15',
      })
      expect(dates).toEqual(['2026-09-15'])
    })

    it('computes daily cleanings from startDate to checkOut', () => {
      const dates = computeCleaningDates({
        type: 'daily',
        startDate: '2026-09-11',
        checkIn: '2026-09-10',
        checkOut: '2026-09-14',
      })
      expect(dates).toEqual([
        '2026-09-11',
        '2026-09-12',
        '2026-09-13',
        '2026-09-14',
      ])
    })

    it('computes custom cleaning every 2 days', () => {
      const dates = computeCleaningDates({
        type: 'custom',
        startDate: '2026-09-10',
        checkIn: '2026-09-10',
        checkOut: '2026-09-16',
        custom: {
          frequency: 'day',
          dayInterval: 2,
        },
      })
      expect(dates).toEqual([
        '2026-09-10',
        '2026-09-12',
        '2026-09-14',
        '2026-09-16',
      ])
    })

    it('computes custom cleaning every 3 days starting on day after check-in', () => {
      const dates = computeCleaningDates({
        type: 'custom',
        startDate: '2026-09-11',
        checkIn: '2026-09-10',
        checkOut: '2026-09-17',
        custom: {
          frequency: 'day',
          dayInterval: 3,
        },
      })
      expect(dates).toEqual([
        '2026-09-11',
        '2026-09-14',
        '2026-09-17',
      ])
    })

    it('computes custom cleaning weekly on specific days (Monday, Thursday, Friday)', () => {
      // 2026-09-10 is Thursday, 2026-09-21 is Monday
      const dates = computeCleaningDates({
        type: 'custom',
        startDate: '2026-09-10',
        checkIn: '2026-09-10',
        checkOut: '2026-09-21',
        custom: {
          frequency: 'week',
          weekDays: ['monday', 'thursday', 'friday'],
        },
      })
      expect(dates).toEqual([
        '2026-09-10', // Thursday
        '2026-09-11', // Friday
        '2026-09-14', // Monday
        '2026-09-17', // Thursday
        '2026-09-18', // Friday
        '2026-09-21', // Monday
      ])
    })

    it('respects start date option ("kapan mulai cleaningnya")', () => {
      // Check-in: 2026-09-10 (Thu), but cleaning starts 2026-09-15 (Tue)
      const dates = computeCleaningDates({
        type: 'custom',
        startDate: '2026-09-15',
        checkIn: '2026-09-10',
        checkOut: '2026-09-21',
        custom: {
          frequency: 'week',
          weekDays: ['monday', 'thursday', 'friday'],
        },
      })
      expect(dates).toEqual([
        '2026-09-17', // Thursday
        '2026-09-18', // Friday
        '2026-09-21', // Monday
      ])
    })

    it('returns empty array if start date is after checkOut', () => {
      const dates = computeCleaningDates({
        type: 'daily',
        startDate: '2026-09-20',
        checkIn: '2026-09-10',
        checkOut: '2026-09-15',
      })
      expect(dates).toEqual([])
    })
  })

  describe('format cleaning schedule summary', () => {
    it('formats daily cleaning summary', () => {
      const summary = formatCleaningScheduleSummary({
        type: 'daily',
        startDate: '2026-09-10',
        time: '10:30',
      })
      expect(summary).toBe('Daily cleaning • Starts 10 Sept at 10:30')
    })

    it('formats checkout cleaning summary', () => {
      const summary = formatCleaningScheduleSummary({
        type: 'checkout',
        startDate: '2026-09-15',
        time: '11:00',
      })
      expect(summary).toBe('Check-out cleaning • 15 Sept at 11:00')
    })

    it('formats custom day interval summary', () => {
      const summary = formatCleaningScheduleSummary({
        type: 'custom',
        startDate: '2026-09-10',
        time: '11:00',
        custom: {
          frequency: 'day',
          dayInterval: 2,
        },
      })
      expect(summary).toBe('Every 2 days • Starts 10 Sept at 11:00')
    })

    it('formats custom weekly summary', () => {
      const summary = formatCleaningScheduleSummary({
        type: 'custom',
        startDate: '2026-09-10',
        time: '11:00',
        custom: {
          frequency: 'week',
          weekDays: ['monday', 'thursday', 'friday'],
        },
      })
      expect(summary).toBe('Weekly (Mon, Thu, Fri) • Starts 10 Sept at 11:00')
    })
  })

  describe('generate cleaning jobs for reservation', () => {
    it('creates jobs properly linked to the reservation', () => {
      const reservation = {
        id: 'res-test-1',
        listingId: 'lst-1',
        listingName: 'Villa Test',
        guestName: 'John Doe',
        checkIn: '2026-09-10',
        checkOut: '2026-09-12',
      }
      const cleaners = [{ id: 'cl-1', name: 'Wayan' }]
      const jobs = generateCleaningJobsForReservation({
        reservation,
        schedule: {
          type: 'daily',
          startDate: '2026-09-10',
          time: '11:00',
          assigneeId: 'cl-1',
        },
        cleaners,
      })

      expect(jobs.length).toBe(3)
      expect(jobs[0]?.reservationId).toBe('res-test-1')
      expect(jobs[0]?.listingId).toBe('lst-1')
      expect(jobs[0]?.cleanerIds).toEqual(['cl-1'])
      expect(jobs[0]?.cleanerNames).toEqual(['Wayan'])
      expect(jobs[0]?.status).toBe('scheduled')
      expect(jobs[0]?.releaseAt).toBeNull()
      expect(jobs[0]?.source).toBe('daily')
    })

    it('creates checkout cleaning job with high priority', () => {
      const reservation = {
        id: 'res-test-2',
        listingId: 'lst-2',
        listingName: 'Villa Beach',
        guestName: 'Jane Smith',
        checkIn: '2026-09-10',
        checkOut: '2026-09-15',
      }
      const jobs = generateCleaningJobsForReservation({
        reservation,
        schedule: {
          type: 'checkout',
          startDate: '2026-09-15',
          time: '11:00',
        },
        cleaners: [],
      })

      expect(jobs.length).toBe(1)
      expect(jobs[0]?.source).toBe('checkout')
      expect(jobs[0]?.priority).toBe('high')
      expect(jobs[0]?.scheduledAt).toBe('2026-09-15T11:00:00+08:00')
    })

    it('creates jobs with multiple assignees properly linked', () => {
      const reservation = {
        id: 'res-test-multi',
        listingId: 'lst-1',
        listingName: 'Villa Test',
        guestName: 'Multi Cleaners Guest',
        checkIn: '2026-09-10',
        checkOut: '2026-09-11',
      }
      const cleaners = [
        { id: 'cl-1', name: 'Wayan' },
        { id: 'cl-2', name: 'Made' },
      ]
      const jobs = generateCleaningJobsForReservation({
        reservation,
        schedule: {
          type: 'daily',
          startDate: '2026-09-10',
          time: '11:00',
          assigneeIds: ['cl-1', 'cl-2'],
        },
        cleaners,
      })

      expect(jobs.length).toBe(2)
      expect(jobs[0]?.cleanerIds).toEqual(['cl-1', 'cl-2'])
      expect(jobs[0]?.cleanerNames).toEqual(['Wayan', 'Made'])
    })
  })

  describe('useCleaningJobs schedule integration', () => {
    it('applyReservationSchedule replaces uncompleted jobs for the reservation and keeps done jobs', () => {
      const { jobs, createJob, applyReservationSchedule } = useCleaningJobs()

      // Seed an uncompleted job for res-1
      const job1 = createJob({
        listingId: 'lst-1',
        listingName: 'Villa Luwa',
        scheduledAt: '2026-09-10T11:00:00+08:00',
        cleanerIds: [],
        cleanerNames: [],
        teamName: 'Housekeeping',
        status: 'scheduled',
        priority: 'normal',
        durationMinutes: 180,
        notes: 'Old job for res-1',
        source: 'daily',
        reservationId: 'res-sched-1',
      })

      // Seed a completed job for res-1
      const jobDone = createJob({
        listingId: 'lst-1',
        listingName: 'Villa Luwa',
        scheduledAt: '2026-09-09T11:00:00+08:00',
        cleanerIds: [],
        cleanerNames: [],
        teamName: 'Housekeeping',
        status: 'done',
        priority: 'normal',
        durationMinutes: 180,
        notes: 'Done job for res-1',
        source: 'daily',
        reservationId: 'res-sched-1',
      })

      // Seed a job for another reservation
      const jobOther = createJob({
        listingId: 'lst-1',
        listingName: 'Villa Luwa',
        scheduledAt: '2026-09-11T11:00:00+08:00',
        cleanerIds: [],
        cleanerNames: [],
        teamName: 'Housekeeping',
        status: 'scheduled',
        priority: 'normal',
        durationMinutes: 180,
        notes: 'Job for res-other',
        source: 'daily',
        reservationId: 'res-other',
      })

      // Apply new schedule for res-sched-1
      applyReservationSchedule('res-sched-1', [
        {
          listingId: 'lst-1',
          listingName: 'Villa Luwa',
          scheduledAt: '2026-09-12T11:00:00+08:00',
          cleanerIds: [],
          cleanerNames: [],
          teamName: 'Housekeeping',
          status: 'scheduled',
          priority: 'normal',
          durationMinutes: 180,
          notes: 'New job 1',
          source: 'daily',
          reservationId: 'res-sched-1',
        },
      ])

      // Old uncompleted job1 should be replaced
      expect(jobs.value.some(j => j.id === job1.id)).toBe(false)
      // Done job should be preserved
      expect(jobs.value.some(j => j.id === jobDone.id)).toBe(true)
      // Other reservation job should be preserved
      expect(jobs.value.some(j => j.id === jobOther.id)).toBe(true)
      // New job should exist
      expect(jobs.value.some(j => j.notes === 'New job 1')).toBe(true)
    })

    it('clearReservationSchedule removes uncompleted jobs for that reservation', () => {
      const { jobs, createJob, clearReservationSchedule } = useCleaningJobs()

      const job = createJob({
        listingId: 'lst-1',
        listingName: 'Villa Luwa',
        scheduledAt: '2026-09-10T11:00:00+08:00',
        cleanerIds: [],
        cleanerNames: [],
        teamName: 'Housekeeping',
        status: 'scheduled',
        priority: 'normal',
        durationMinutes: 180,
        notes: 'To be cleared',
        source: 'daily',
        reservationId: 'res-clear-test',
      })

      clearReservationSchedule('res-clear-test')
      expect(jobs.value.some(j => j.id === job.id)).toBe(false)
    })
  })

  describe('listing default cleaning configuration', () => {
    it('resolves daily default starting on check-in', () => {
      const schedule = resolveDefaultCleaningSchedule(
        {
          type: 'daily',
          startOffset: 'check_in',
          time: '10:00',
          assigneeId: 'staff-3',
        },
        '2026-09-12',
      )
      expect(schedule.type).toBe('daily')
      expect(schedule.startDate).toBe('2026-09-12')
      expect(schedule.time).toBe('10:00')
      expect(schedule.assigneeId).toBe('staff-3')
    })

    it('resolves custom day interval default starting day after check-in', () => {
      const schedule = resolveDefaultCleaningSchedule(
        {
          type: 'custom',
          startOffset: 'day_after_check_in',
          time: '11:00',
          assigneeId: 'staff-4',
          custom: {
            frequency: 'day',
            dayInterval: 3,
          },
        },
        '2026-09-12',
      )
      expect(schedule.type).toBe('custom')
      expect(schedule.startDate).toBe('2026-09-13')
      expect(schedule.custom?.frequency).toBe('day')
      expect(schedule.custom?.dayInterval).toBe(3)
      expect(schedule.assigneeId).toBe('staff-4')
    })

    it('resolves weekly custom default with days of week', () => {
      const schedule = resolveDefaultCleaningSchedule(
        {
          type: 'custom',
          startOffset: 'check_in',
          time: '11:00',
          custom: {
            frequency: 'week',
            weekDays: ['monday', 'thursday', 'friday'],
          },
        },
        '2026-09-12',
      )
      expect(schedule.type).toBe('custom')
      expect(schedule.custom?.frequency).toBe('week')
      expect(schedule.custom?.weekDays).toEqual(['monday', 'thursday', 'friday'])
    })

    it('resolves default cleaning with multiple assigneeIds', () => {
      const schedule = resolveDefaultCleaningSchedule(
        {
          type: 'daily',
          startOffset: 'check_in',
          time: '10:00',
          assigneeIds: ['staff-2', 'staff-3'],
        },
        '2026-09-12',
      )
      expect(schedule.assigneeIds).toEqual(['staff-2', 'staff-3'])
      expect(schedule.assigneeId).toBe('staff-2')
    })

    it('formats listing cleaning summary labels properly', () => {
      expect(formatListingCleaningSummary(null)).toBe('Not configured')
      expect(formatListingCleaningSummary({ type: 'daily', startOffset: 'check_in', time: '11:00' }))
        .toBe('Daily cleaning • Starts on check-in at 11:00')
      expect(formatListingCleaningSummary({ type: 'checkout', time: '11:00' }))
        .toBe('Checkout cleaning • On departure at 11:00')
      expect(formatListingCleaningSummary({
        type: 'custom',
        startOffset: 'day_after_check_in',
        time: '11:00',
        custom: { frequency: 'day', dayInterval: 2 },
      })).toBe('Every 2 days • Starts day after check-in at 11:00')
      expect(formatListingCleaningSummary({
        type: 'custom',
        startOffset: 'check_in',
        time: '11:00',
        custom: { frequency: 'week', weekDays: ['monday', 'thursday', 'friday'] },
      })).toBe('Weekly (Mon, Thu, Fri) • Starts on check-in at 11:00')
    })
  })

  describe('scheduled cleaning assignee editing', () => {
    it('updates cleaner assignee on an existing scheduled job', () => {
      const { createJob, updateJob, jobs } = useCleaningJobs()
      const job = createJob({
        listingId: 'lst-1',
        listingName: 'Villa Luwih',
        scheduledAt: '2026-09-12T11:00:00+08:00',
        cleanerIds: [],
        cleanerNames: [],
        teamName: 'Housekeeping',
        status: 'scheduled',
        priority: 'normal',
        durationMinutes: 180,
        notes: 'Test job',
        source: 'daily',
        reservationId: 'res-test-assignee',
        recurrence: null,
        releaseAt: null,
      })

      expect(jobs.value.find(j => j.id === job.id)?.cleanerNames).toEqual([])

      // Assign cleaner
      updateJob(job.id, {
        cleanerIds: ['staff-2'],
        cleanerNames: ['Made Surya'],
      })

      const updated = jobs.value.find(j => j.id === job.id)
      expect(updated?.cleanerIds).toEqual(['staff-2'])
      expect(updated?.cleanerNames).toEqual(['Made Surya'])

      // Reassign to another cleaner
      updateJob(job.id, {
        cleanerIds: ['staff-3'],
        cleanerNames: ['Wayan Adi'],
      })
      const reassigned = jobs.value.find(j => j.id === job.id)
      expect(reassigned?.cleanerIds).toEqual(['staff-3'])
      expect(reassigned?.cleanerNames).toEqual(['Wayan Adi'])

      // Clear assignee back to unassigned
      updateJob(job.id, {
        cleanerIds: [],
        cleanerNames: [],
      })
      const cleared = jobs.value.find(j => j.id === job.id)
      expect(cleared?.cleanerIds).toEqual([])
      expect(cleared?.cleanerNames).toEqual([])
    })

    it('supports assigning and toggling multiple cleaners on an existing job', () => {
      const { createJob, updateJob, jobs } = useCleaningJobs()
      const job = createJob({
        listingId: 'lst-1',
        listingName: 'Villa Luwih',
        scheduledAt: '2026-09-12T11:00:00+08:00',
        cleanerIds: ['staff-2'],
        cleanerNames: ['Made Surya'],
        teamName: 'Housekeeping',
        status: 'scheduled',
        priority: 'normal',
        durationMinutes: 180,
        notes: 'Multi-cleaner test',
        source: 'daily',
        reservationId: 'res-test-multi-assign',
        recurrence: null,
        releaseAt: null,
      })

      // Add a second cleaner
      updateJob(job.id, {
        cleanerIds: ['staff-2', 'staff-3'],
        cleanerNames: ['Made Surya', 'Wayan Adi'],
      })
      let current = jobs.value.find(j => j.id === job.id)
      expect(current?.cleanerIds).toEqual(['staff-2', 'staff-3'])
      expect(current?.cleanerNames).toEqual(['Made Surya', 'Wayan Adi'])

      // Remove the first cleaner
      updateJob(job.id, {
        cleanerIds: ['staff-3'],
        cleanerNames: ['Wayan Adi'],
      })
      current = jobs.value.find(j => j.id === job.id)
      expect(current?.cleanerIds).toEqual(['staff-3'])
      expect(current?.cleanerNames).toEqual(['Wayan Adi'])
    })
  })

  describe('select item safety', () => {
    it('leaves no empty-valued SelectItem in ReservationCleaningScheduleDialog.vue', async () => {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { default: process } = await import('node:process')

      const source = readFileSync(
        join(process.cwd(), 'app/components/reservations/ReservationCleaningScheduleDialog.vue'),
        'utf8',
      )

      expect(source).not.toMatch(/<SelectItem\s+value=""/)
    })

    it('leaves no empty-valued SelectItem in ReservationDetailSheet.vue', async () => {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { default: process } = await import('node:process')

      const source = readFileSync(
        join(process.cwd(), 'app/components/reservations/ReservationDetailSheet.vue'),
        'utf8',
      )

      expect(source).not.toMatch(/<SelectItem\s+value=""/)
    })

    it('leaves no empty-valued SelectItem in ListingMaintenanceTab.vue', async () => {
      const { readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { default: process } = await import('node:process')

      const source = readFileSync(
        join(process.cwd(), 'app/components/listings/ListingMaintenanceTab.vue'),
        'utf8',
      )

      expect(source).not.toMatch(/<SelectItem\s+value=""/)
    })
  })
})
