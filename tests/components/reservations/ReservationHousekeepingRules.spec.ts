import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'

// Source-level checks, like the other housekeeping specs: the sections are too
// heavy to mount here.
function read(file: string) {
  return readFileSync(join(process.cwd(), 'app/components/reservations', file), 'utf8')
}

describe('reservation housekeeping rules', () => {
  const section = read('ReservationHousekeepingSection.vue')
  const scheduleDialog = read('ReservationCleaningScheduleDialog.vue')
  const jobDialog = read('ReservationCleaningJobDialog.vue')

  it('asks before deleting a cleaning, completed ones included', () => {
    expect(section).toContain('pendingDeleteJob.value = housekeepingJobs.value.find(j => j.id === jobId)')
    expect(section).toContain('<AlertDialog :open="!!pendingDeleteJob"')
    expect(section).toContain('@click="confirmRemoveCleaning"')
    expect(section).not.toMatch(/function removeCleaning[^}]*deleteJob/)
  })

  it('warns that saving a schedule replaces the cleanings that are not completed', () => {
    expect(scheduleDialog).toContain('j.reservationId === id && j.status !== \'done\'')
    expect(scheduleDialog).toContain('data-testid="cleaning-schedule-replace-warning"')
  })

  it('keeps a one-off cleaning inside the stay', () => {
    expect(jobDialog).toContain(':min="reservation?.checkIn"')
    expect(jobDialog).toContain(':max="reservation?.checkOut"')
    expect(jobDialog).toContain('cleaningDate.value >= r.checkIn && cleaningDate.value <= r.checkOut')
    expect(jobDialog).toContain(':disabled="!isDateInStay"')
  })
})
