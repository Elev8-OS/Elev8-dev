import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import type { ClaimCleaningReport, ProtectionClaim } from '~/components/reservations/data/reservations'
import { CLEANING_SOURCE_LABELS } from '~/components/cleaning/data/cleaning-jobs'
import { cleaningFollowsStay } from '~/components/cleaning/data/cleaning-link'

/**
 * Turning what housekeeping found into a damage claim.
 *
 * A finding is a checklist line marked Problem, and only that. A Problem always
 * carries the photo the checklist requires, and the photo travels into the
 * claim as evidence. ⚠️ The report's free-text `damages` list is deliberately
 * NOT offered: it carries no photo, so a claim raised from it would show the
 * guest a sentence and nothing to look at. Whether a problem is something the
 * guest pays for (towels on the floor is not, a cracked screen is) stays a
 * staff call.
 */

export interface CleaningFinding {
  id: string
  text: string
  checklistItem: string
  photoUrls: string[]
}

export interface CleaningReportGroup {
  jobId: string
  cleaningLabel: string
  reportedBy: string
  reportedAt: string
  findings: CleaningFinding[]
}

/** Longest label a finding is cut to. The full text always lands in the reason. */
export const CLAIM_LABEL_MAX = 80

/** Every checklist Problem in one report, in checklist order. */
export function findingsOf(job: CleaningJob): CleaningFinding[] {
  return (job.feedback?.checklist ?? [])
    .flatMap(group => group.items)
    .filter(item => item.status === 'problem')
    .map(item => ({
      id: `${job.id}:problem:${item.id}`,
      // The note says what was wrong; the item label only says what was checked.
      text: item.notes?.trim() || item.label,
      checklistItem: item.label,
      photoUrls: [...(item.photoUrls ?? [])],
    }))
}

function reportedAtOf(job: CleaningJob): string {
  return job.feedback?.confirmedAt ?? job.feedback?.startedAt ?? job.scheduledAt
}

function reportedByOf(job: CleaningJob): string {
  return job.feedback?.supervisorName
    || job.cleanerNames.join(', ')
    || job.teamName
    || 'Housekeeping'
}

/**
 * The finished cleaning reports on a stay, newest first.
 *
 * ⚠️ Matched on the job's `reservationId`, never re-derived here from listing
 * and dates. The link is set once, by `resolveStayForCleaning` when the job is
 * created, and this reads it; guessing again at claim time is how the previous
 * guest's breakage lands on this guest's bill.
 *
 * ⚠️ A cleaning on or before check-in day is dropped even though it is linked:
 * it is the preparation for this guest's arrival, so whatever it found was
 * there before they were. A report that flagged nothing is still returned, so
 * the dialog can say "flagged nothing" rather than "no report".
 */
export function cleaningReportsForReservation(
  reservation: { id: string, checkIn: string },
  jobs: CleaningJob[],
): CleaningReportGroup[] {
  return jobs
    .filter(j => j.reservationId === reservation.id && j.status === 'done' && j.feedback)
    .filter(j => cleaningFollowsStay(j, reservation))
    .map(job => ({
      jobId: job.id,
      cleaningLabel: CLEANING_SOURCE_LABELS[job.source] ?? 'Cleaning',
      reportedBy: reportedByOf(job),
      reportedAt: reportedAtOf(job),
      findings: findingsOf(job),
    }))
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
}

/** Finding ids already carried by a claim on this stay. */
export function claimedFindingIds(claims: ProtectionClaim[]): Set<string> {
  return new Set(claims.flatMap(c => (c.cleaningReport ? [c.cleaningReport.findingId] : [])))
}

function capLabel(text: string): string {
  const firstLetterUp = text.charAt(0).toUpperCase() + text.slice(1)
  if (firstLetterUp.length <= CLAIM_LABEL_MAX)
    return firstLetterUp
  const cut = firstLetterUp.slice(0, CLAIM_LABEL_MAX - 1)
  const atWord = cut.slice(0, cut.lastIndexOf(' ')).trimEnd()
  return `${atWord || cut}…`
}

/**
 * The claim fields a finding fills in. The amount is deliberately absent: a
 * housekeeper reports what broke, never what it costs.
 */
export function claimFromFinding(
  group: CleaningReportGroup,
  finding: CleaningFinding,
): { label: string, reason: string, cleaningReport: ClaimCleaningReport } {
  const date = new Date(group.reportedAt)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return {
    label: capLabel(finding.text),
    // The guest reads this, so it names who found it and when.
    reason: `Reported by ${group.reportedBy} in the ${group.cleaningLabel.toLowerCase()} on ${date}: ${finding.text}`,
    cleaningReport: {
      cleaningJobId: group.jobId,
      findingId: finding.id,
      finding: finding.text,
      checklistItem: finding.checklistItem,
      // Copied, so the claim keeps the photos the guest was shown.
      photoUrls: [...finding.photoUrls],
      cleaningLabel: group.cleaningLabel,
      reportedBy: group.reportedBy,
      reportedAt: group.reportedAt,
    },
  }
}
