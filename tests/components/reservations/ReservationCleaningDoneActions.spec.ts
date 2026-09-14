import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { normalizeCleaningType } from '~/components/operations-calendar/data/operations-calendar'

describe('reservation cleaning actions for done/scheduled jobs', () => {
  const detailSheetSource = readFileSync(
    join(process.cwd(), 'app/components/reservations/ReservationDetailSheet.vue'),
    'utf8',
  )
  const housekeepingSource = readFileSync(
    join(process.cwd(), 'app/components/reservations/ReservationHousekeepingSection.vue'),
    'utf8',
  )

  it('embeds ReservationHousekeepingSection in ReservationDetailSheet', () => {
    expect(detailSheetSource).toContain('<ReservationHousekeepingSection')
    expect(detailSheetSource).toContain(':reservation="reservation"')
  })

  it('imports CalendarEventDetailDialog from operations-calendar in housekeeping section', () => {
    expect(housekeepingSource).toContain('import CalendarEventDetailDialog from \'~/components/operations-calendar/CalendarEventDetailDialog.vue\'')
  })

  it('renders CalendarEventDetailDialog in template', () => {
    expect(housekeepingSource).toContain('<CalendarEventDetailDialog')
    expect(housekeepingSource).toContain(':open="detailCleaningOpen"')
    expect(housekeepingSource).toContain(':event="detailCleaningEvent"')
  })

  it('switches button icon to lucide:eye and title to View cleaning when done', () => {
    expect(housekeepingSource).toContain('job.status === \'done\' ? \'View cleaning\' : \'Edit cleaning\'')
    expect(housekeepingSource).toContain('job.status === \'done\' ? \'lucide:eye\' : \'lucide:pencil\'')
  })

  it('does not hide delete button when status is done', () => {
    // Delete button in housekeepingJobs must not be gated by status !== 'done'
    expect(housekeepingSource).not.toMatch(/v-if="job\.status\s*!==\s*'done'"\s+variant="ghost"[^>]*title="Delete cleaning"/)
    expect(housekeepingSource).toMatch(/title="Delete cleaning"\s+@click="removeCleaning\(job\.id\)"/)
  })

  it('handles action routing between viewCleaningDetail and openEditCleaning', () => {
    expect(housekeepingSource).toContain('function handleCleaningAction(job: CleaningJob)')
    expect(housekeepingSource).toContain('if (job.status === \'done\')')
    expect(housekeepingSource).toContain('viewCleaningDetail(job)')
  })

  it('normalizes cleaning types properly for CalendarEvent', () => {
    expect(normalizeCleaningType('checkout')).toBe('check_out')
    expect(normalizeCleaningType('check_out')).toBe('check_out')
    expect(normalizeCleaningType('daily')).toBe('daily')
    expect(normalizeCleaningType('mid_stay')).toBe('mid_stay')
    expect(normalizeCleaningType('custom')).toBe('custom')
  })
})
