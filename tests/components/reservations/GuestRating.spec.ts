import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { GUEST_CLEANLINESS_LABELS, GUEST_HOUSE_RULES_LABELS, guestRatingForReservation } from '~/components/reservations/data/guest-rating'

function job(overrides: Partial<CleaningJob> = {}): CleaningJob {
  return {
    id: 'cln-x',
    listingId: 'lst-1',
    listingName: 'Villa',
    scheduledAt: '2026-09-20T11:00:00+08:00',
    cleanerIds: ['staff-3'],
    cleanerNames: ['Made Surya'],
    teamName: 'Housekeeping',
    status: 'done',
    priority: 'high',
    durationMinutes: 120,
    notes: '',
    source: 'checkout',
    reservationId: 'res-1',
    recurrence: null,
    feedback: {
      supervisorName: 'Made Surya',
      confirmedAt: '2026-09-20T13:00:00+08:00',
      cleanlinessRating: 5,
      houseRulesRating: 4,
      conditionNotes: 'The apartment is in good condition.',
      guestRatingPhotoUrls: ['https://example.com/a.jpg'],
      damages: [],
      itemsLeft: [],
      cleaningDurationMinutes: 120,
      housekeeperNotes: '',
    },
    ...overrides,
  }
}

const checkedOut = { id: 'res-1', status: 'checked_out' as const }

describe('guestRatingForReservation', () => {
  it('reads the rating, comment and photos from the completed cleaning', () => {
    const rating = guestRatingForReservation(checkedOut, [job()])
    expect(rating).toMatchObject({
      cleanliness: 5,
      houseRules: 4,
      overall: 4.5,
      comment: 'The apartment is in good condition.',
      photoUrls: ['https://example.com/a.jpg'],
      ratedBy: 'Made Surya',
    })
  })

  it('has none before check-out', () => {
    expect(guestRatingForReservation({ id: 'res-1', status: 'checked_in' }, [job()])).toBeNull()
  })

  it('has none until the cleaning is completed', () => {
    expect(guestRatingForReservation(checkedOut, [job({ status: 'in_progress' })])).toBeNull()
  })

  it('ignores cleanings of other reservations', () => {
    expect(guestRatingForReservation(checkedOut, [job({ reservationId: 'res-2' })])).toBeNull()
  })

  it('has none until both questions are rated', () => {
    const base = job()
    expect(guestRatingForReservation(checkedOut, [job({ feedback: { ...base.feedback!, houseRulesRating: undefined } })])).toBeNull()
  })

  it('has no photos when housekeeping attached none', () => {
    const base = job()
    const rating = guestRatingForReservation(checkedOut, [job({ feedback: { ...base.feedback!, guestRatingPhotoUrls: undefined } })])
    expect(rating?.photoUrls).toEqual([])
  })

  it('takes the latest completed cleaning', () => {
    const base = job()
    const older = job({ id: 'old', scheduledAt: '2026-09-18T11:00:00+08:00', feedback: { ...base.feedback!, cleanlinessRating: 2 } })
    expect(guestRatingForReservation(checkedOut, [older, job()])?.jobId).toBe('cln-x')
  })
})

describe('guest rating star labels', () => {
  it('names every star of both questions', () => {
    expect(Object.values(GUEST_CLEANLINESS_LABELS)).toEqual(['Not at all clean', 'Not very clean', 'Fairly clean', 'Very clean', 'Extremely clean'])
    expect(Object.values(GUEST_HOUSE_RULES_LABELS)).toEqual(['Didn\'t follow any rules', 'Didn\'t follow most rules', 'Followed some rules', 'Followed most rules', 'Followed all rules'])
  })
})

describe('reservation detail guest rating tab', () => {
  const source = readFileSync(join(process.cwd(), 'app/components/reservations/ReservationDetailSheet.vue'), 'utf8')

  it('shows the tab only when there is a guest rating', () => {
    expect(source).toContain('<Tooltip v-if="guestRating">')
    expect(source).toContain('v-else-if="activeTab === \'guest_rating\' && guestRating"')
  })
})
