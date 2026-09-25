import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import type { ProtectionClaim } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import {
  CLAIM_LABEL_MAX,
  claimedFindingIds,
  claimFromFinding,
  cleaningReportsForReservation,
  findingsOf,
} from '~/components/reservations/data/claim-cleaning'

function job(patch: Partial<CleaningJob> = {}): CleaningJob {
  return {
    id: 'cln-a',
    listingId: 'lst-1',
    listingName: 'The R Villa Merapi',
    scheduledAt: '2026-09-20T03:00:00.000Z',
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'normal',
    durationMinutes: 120,
    notes: '',
    source: 'check_out',
    reservationId: 'res-1',
    feedback: {
      confirmedAt: '2026-09-20T05:30:00.000Z',
      checklist: [
        {
          id: 'bath',
          title: 'Bathroom',
          items: [
            { id: 'b-1', label: 'Clean shower', status: 'ok' },
            { id: 'b-2', label: 'Check furniture', status: 'problem', notes: 'Sofa cover torn', photoUrls: ['/p/sofa.jpg'] },
            { id: 'b-3', label: 'Check lamps', status: 'problem', photoUrls: ['/p/lamp-1.jpg', '/p/lamp-2.jpg'] },
            { id: 'b-4', label: 'Check balcony', status: 'ok' },
          ],
        },
      ],
      cleanlinessRating: 3,
      conditionNotes: '',
      damages: ['Cracked shower screen', '  ', 'Wine stain on the rug'],
      itemsLeft: ['Phone charger'],
      cleaningDurationMinutes: 120,
      housekeeperNotes: '',
    },
    ...patch,
  }
}

/** The stay the fixture jobs belong to; every job is dated after its check-in. */
const STAY = { id: 'res-1', checkIn: '2026-09-15' }

describe('findingsOf', () => {
  it('lists only the checklist problems, in checklist order, skipping OK lines', () => {
    expect(findingsOf(job()).map(f => [f.id, f.text, f.checklistItem])).toEqual([
      ['cln-a:problem:b-2', 'Sofa cover torn', 'Check furniture'],
      // No note: the checklist line itself says what was wrong.
      ['cln-a:problem:b-3', 'Check lamps', 'Check lamps'],
    ])
  })

  it('never offers the free-text damages list, which carries no photo', () => {
    const texts = findingsOf(job()).map(f => f.text)
    expect(texts).not.toContain('Cracked shower screen')
    expect(texts).not.toContain('Wine stain on the rug')
  })

  it('carries each problem\'s photos', () => {
    expect(findingsOf(job()).map(f => f.photoUrls)).toEqual([['/p/sofa.jpg'], ['/p/lamp-1.jpg', '/p/lamp-2.jpg']])
  })

  it('does not treat items left behind as a finding', () => {
    expect(findingsOf(job()).some(f => f.text === 'Phone charger')).toBe(false)
  })

  it('returns nothing for a job with no report', () => {
    expect(findingsOf(job({ feedback: null }))).toEqual([])
  })
})

describe('cleaningReportsForReservation', () => {
  it('matches on reservationId only, never on listing and dates', () => {
    const unlinked = job({ id: 'cln-b', reservationId: null })
    const otherStay = job({ id: 'cln-c', reservationId: 'res-2' })
    const reports = cleaningReportsForReservation(STAY, [job(), unlinked, otherStay])
    expect(reports.map(r => r.jobId)).toEqual(['cln-a'])
  })

  it('skips a cleaning that is not done or has no report', () => {
    const scheduled = job({ id: 'cln-b', status: 'scheduled' })
    const noReport = job({ id: 'cln-c', feedback: null })
    expect(cleaningReportsForReservation(STAY, [scheduled, noReport])).toEqual([])
  })

  it('drops a cleaning on or before check-in day, which prepared for the guest rather than followed them', () => {
    const onArrival = job({ id: 'cln-prep', scheduledAt: '2026-09-15T03:00:00.000Z' })
    const before = job({ id: 'cln-before', scheduledAt: '2026-09-14T03:00:00.000Z' })
    const dayAfter = job({ id: 'cln-mid', scheduledAt: '2026-09-16T03:00:00.000Z' })
    expect(cleaningReportsForReservation(STAY, [onArrival, before, dayAfter]).map(r => r.jobId)).toEqual(['cln-mid'])
  })

  it('keeps a report that flagged nothing, so the dialog can say so', () => {
    // A damages entry alone is not a finding, so this report flagged nothing claimable.
    const clean = job({ feedback: { ...job().feedback!, damages: ['Scuff on the wall'], checklist: [] } })
    const [report] = cleaningReportsForReservation(STAY, [clean])
    expect(report!.findings).toEqual([])
  })

  it('sorts newest first and names who reported it and which cleaning it was', () => {
    const midStay = job({
      id: 'cln-mid',
      source: 'mid_stay',
      cleanerNames: ['Wayan Adi', 'Made Surya'],
      feedback: { ...job().feedback!, confirmedAt: '2026-09-17T05:00:00.000Z' },
    })
    const reports = cleaningReportsForReservation(STAY, [midStay, job()])
    expect(reports.map(r => [r.jobId, r.cleaningLabel, r.reportedBy])).toEqual([
      ['cln-a', 'Check-out cleaning', 'Made Surya'],
      ['cln-mid', 'Mid-stay cleaning', 'Wayan Adi, Made Surya'],
    ])
  })

  it('prefers the supervisor over the cleaner list', () => {
    const supervised = job({ feedback: { ...job().feedback!, supervisorName: 'Ketut Rai' } })
    expect(cleaningReportsForReservation(STAY, [supervised])[0]!.reportedBy).toBe('Ketut Rai')
  })
})

describe('claimFromFinding', () => {
  const [group] = cleaningReportsForReservation(STAY, [job()])

  it('fills the label and a reason that names who found it and when', () => {
    const filled = claimFromFinding(group!, group!.findings[0]!)
    expect(filled.label).toBe('Sofa cover torn')
    expect(filled.reason).toMatch(/^Reported by Made Surya in the check-out cleaning on .+ 2026: Sofa cover torn$/)
  })

  it('snapshots the finding with its provenance', () => {
    const filled = claimFromFinding(group!, group!.findings[0]!)
    expect(filled.cleaningReport).toEqual({
      cleaningJobId: 'cln-a',
      findingId: 'cln-a:problem:b-2',
      finding: 'Sofa cover torn',
      checklistItem: 'Check furniture',
      photoUrls: ['/p/sofa.jpg'],
      cleaningLabel: 'Check-out cleaning',
      reportedBy: 'Made Surya',
      reportedAt: '2026-09-20T05:30:00.000Z',
    })
  })

  it('copies the photos, so a later edit to the report cannot change the claim', () => {
    const finding = { ...group!.findings[0]!, photoUrls: ['/p/sofa.jpg'] }
    const filled = claimFromFinding(group!, finding)
    finding.photoUrls.push('/p/added-later.jpg')
    expect(filled.cleaningReport.photoUrls).toEqual(['/p/sofa.jpg'])
  })

  it('never proposes an amount', () => {
    expect(claimFromFinding(group!, group!.findings[0]!)).not.toHaveProperty('amount')
  })

  it('cuts a long finding at a word for the label but keeps it whole in the reason', () => {
    const long = 'large '.repeat(30).trim()
    const filled = claimFromFinding(group!, { id: 'x', text: long, checklistItem: 'Check', photoUrls: ['/p/x.jpg'] })
    expect(filled.label.length).toBeLessThanOrEqual(CLAIM_LABEL_MAX)
    expect(filled.label.endsWith('…')).toBe(true)
    expect(filled.label.startsWith('Large large')).toBe(true)
    expect(filled.reason.endsWith(long)).toBe(true)
  })
})

describe('claimedFindingIds', () => {
  it('collects the finding ids claims already carry, ignoring manual claims', () => {
    const [group] = cleaningReportsForReservation(STAY, [job()])
    const fromCleaning = { cleaningReport: claimFromFinding(group!, group!.findings[1]!).cleaningReport } as ProtectionClaim
    const manual = { evidenceUrls: ['/a.jpg'] } as ProtectionClaim
    expect([...claimedFindingIds([fromCleaning, manual])]).toEqual(['cln-a:problem:b-3'])
  })
})
