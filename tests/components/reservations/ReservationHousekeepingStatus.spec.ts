import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { housekeepingStatus, housekeepingStatusClasses, housekeepingStatusLabels } from '~/components/cleaning/data/cleaning-jobs'

describe('housekeeping tab status', () => {
  const now = new Date('2026-09-28T09:00:00+08:00')
  const upcoming = '2026-10-01T11:00:00+08:00'
  const past = '2026-09-20T11:00:00+08:00'
  const label = (status: string, at: string) => housekeepingStatusLabels[housekeepingStatus(status as never, at, now)]

  it('offers exactly Not started, In progress, Completed and Missed', () => {
    expect(Object.values(housekeepingStatusLabels)).toEqual(['Not started', 'In progress', 'Completed', 'Missed'])
  })

  it('shows an upcoming cleaning that has not started as Not started', () => {
    expect(['draft', 'scheduled', 'confirmed'].map(s => label(s, upcoming))).toEqual(['Not started', 'Not started', 'Not started'])
  })

  it('shows In progress and Completed whatever the date', () => {
    expect(label('in_progress', past)).toBe('In progress')
    expect(label('done', past)).toBe('Completed')
  })

  it('shows Missed when stored as missed or when the date passed unstarted', () => {
    expect(label('missed', upcoming)).toBe('Missed')
    expect(label('scheduled', past)).toBe('Missed')
  })

  it('gives each status its own colour', () => {
    expect(housekeepingStatusClasses.not_started).toContain('text-muted-foreground')
    expect(housekeepingStatusClasses.in_progress).toContain('amber')
    expect(housekeepingStatusClasses.completed).toContain('emerald')
    expect(housekeepingStatusClasses.missed).toContain('destructive')
  })

  it('is what the tab renders, with cancelled jobs left out', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/reservations/ReservationHousekeepingSection.vue'), 'utf8')
    expect(source).toContain('housekeepingStatusLabels[housekeepingStatus(job.status, job.scheduledAt)]')
    expect(source).not.toContain('cleaningJobStatusLabels')
    expect(source).toContain(':class="cleaningStatusClass(job)"')
    expect(source).toContain('j.status !== \'cancelled\'')
  })
})
