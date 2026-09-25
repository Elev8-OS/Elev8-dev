import type { CleaningFeedback } from '~/components/cleaning/data/cleaning-jobs'
import { describe, expect, it } from 'vitest'
import {
  checklistItemError,
  CLEANING_CHECKLIST_STATUS_LABELS,
  cleaningJobs,
  problemsMissingPhotos,
} from '~/components/cleaning/data/cleaning-jobs'

describe('checklist statuses', () => {
  it('are exactly OK and Problem', () => {
    expect(CLEANING_CHECKLIST_STATUS_LABELS).toEqual({ ok: 'OK', problem: 'Problem' })
  })
})

describe('checklistItemError', () => {
  it('refuses a problem with no photo', () => {
    expect(checklistItemError({ status: 'problem' })).toBe('A problem needs at least one photo.')
    expect(checklistItemError({ status: 'problem', photoUrls: [] })).toBe('A problem needs at least one photo.')
  })

  it('accepts a problem with a photo, and an OK line without one', () => {
    expect(checklistItemError({ status: 'problem', photoUrls: ['/p.jpg'] })).toBeNull()
    expect(checklistItemError({ status: 'ok' })).toBeNull()
  })
})

describe('problemsMissingPhotos', () => {
  it('lists only the problems that arrived without a photo', () => {
    const feedback: Pick<CleaningFeedback, 'checklist'> = {
      checklist: [{
        id: 'g',
        title: 'Group',
        items: [
          { id: 'a', label: 'A', status: 'ok' },
          { id: 'b', label: 'B', status: 'problem', photoUrls: ['/b.jpg'] },
          { id: 'c', label: 'C', status: 'problem' },
        ],
      }],
    }
    expect(problemsMissingPhotos(feedback).map(i => i.id)).toEqual(['c'])
    expect(problemsMissingPhotos(null)).toEqual([])
  })
})

describe('the cleaning seed', () => {
  it('uses only OK and Problem, and every problem carries a photo', () => {
    const items = cleaningJobs.value.flatMap(j => j.feedback?.checklist ?? []).flatMap(g => g.items)
    expect(items.length).toBeGreaterThan(0)
    expect(items.every(i => i.status === 'ok' || i.status === 'problem')).toBe(true)
    expect(items.some(i => i.status === 'problem')).toBe(true)
    expect(cleaningJobs.value.flatMap(j => problemsMissingPhotos(j.feedback))).toEqual([])
  })
})
