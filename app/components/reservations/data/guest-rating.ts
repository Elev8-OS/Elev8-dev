import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import type { ReservationEntry } from '~/components/reservations/data/reservations'

/** Housekeeping's rating of a guest, read from the completed cleaning report. */
export interface GuestRating {
  jobId: string
  /** How clean the guest left the property, 1-5. */
  cleanliness: number
  /** How well the guest followed the house rules, 1-5. */
  houseRules: number
  /** Average of the two ratings, one decimal. */
  overall: number
  comment: string
  photoUrls: string[]
  ratedBy: string
  ratedAt: string | null
}

export const GUEST_CLEANLINESS_LABELS: Record<number, string> = {
  1: 'Not at all clean',
  2: 'Not very clean',
  3: 'Fairly clean',
  4: 'Very clean',
  5: 'Extremely clean',
}

export const GUEST_HOUSE_RULES_LABELS: Record<number, string> = {
  1: 'Didn\'t follow any rules',
  2: 'Didn\'t follow most rules',
  3: 'Followed some rules',
  4: 'Followed most rules',
  5: 'Followed all rules',
}

function clampRating(n: number): number {
  return Math.min(5, Math.max(1, Math.round(n)))
}

/**
 * The guest rating for a stay, or null. Only a checked-out stay with a
 * completed cleaning that rates both questions has one; the latest wins.
 */
export function guestRatingForReservation(
  reservation: Pick<ReservationEntry, 'id' | 'status'>,
  jobs: CleaningJob[],
): GuestRating | null {
  if (reservation.status !== 'checked_out')
    return null
  const job = jobs
    .filter(j => j.reservationId === reservation.id && j.status === 'done' && j.feedback?.cleanlinessRating && j.feedback.houseRulesRating)
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0]
  const feedback = job?.feedback
  if (!job || !feedback)
    return null

  const cleanliness = clampRating(feedback.cleanlinessRating)
  const houseRules = clampRating(feedback.houseRulesRating!)
  const overall = Math.round(((cleanliness + houseRules) / 2) * 10) / 10

  return {
    jobId: job.id,
    cleanliness,
    houseRules,
    overall,
    comment: feedback.conditionNotes?.trim() ?? '',
    photoUrls: feedback.guestRatingPhotoUrls ?? [],
    ratedBy: feedback.supervisorName || job.cleanerNames.join(', ') || 'Housekeeping',
    ratedAt: feedback.confirmedAt ?? null,
  }
}
