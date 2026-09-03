import { describe, expect, it } from 'vitest'
import type { ReviewRecord } from '~/components/review-hub/data/types'
import { mockReviewRecords } from '~/components/review-hub/data/mock-review-records'
import {
  cloneReviewConfig,
  createDefaultReviewConfig,
  nativeToNormalized,
  resolveAutoReviews,
  thresholdOptions,
} from '~/components/website-builder/data/review-config'

describe('createDefaultReviewConfig', () => {
  it('starts in auto mode with every channel enabled', () => {
    const config = createDefaultReviewConfig()
    expect(config.mode).toBe('auto')
    expect(config.channels.airbnb).toEqual({ enabled: true, minRating: 4.5 })
    expect(config.channels.booking_com).toEqual({ enabled: true, minRating: 9 })
    expect(config.channels.direct).toEqual({ enabled: true, minRating: 4.5 })
  })

  it('requires a written comment, gates at 3 matches and batches 12', () => {
    const config = createDefaultReviewConfig()
    expect(config.requireText).toBe(true)
    expect(config.minCountToShow).toBe(3)
    expect(config.batchSize).toBe(12)
  })

  it('returns a fresh object each call so two websites cannot share one', () => {
    const a = createDefaultReviewConfig()
    const b = createDefaultReviewConfig()
    a.channels.airbnb.minRating = 3
    expect(b.channels.airbnb.minRating).toBe(4.5)
  })
})

describe('cloneReviewConfig', () => {
  it('deep-copies the channel map', () => {
    const original = createDefaultReviewConfig()
    const copy = cloneReviewConfig(original)
    copy.channels.booking_com.enabled = false
    expect(original.channels.booking_com.enabled).toBe(true)
  })
})

describe('nativeToNormalized', () => {
  it('doubles a 5-point channel rating onto the 0-10 store scale', () => {
    expect(nativeToNormalized(4.5, 'airbnb')).toBe(9)
    expect(nativeToNormalized(4.5, 'direct')).toBe(9)
    expect(nativeToNormalized(5, 'airbnb')).toBe(10)
  })

  it('passes a 10-point channel rating through unchanged', () => {
    expect(nativeToNormalized(9, 'booking_com')).toBe(9)
  })
})

describe('thresholdOptions', () => {
  it('offers 5 down to 3 in half steps for a 5-point channel', () => {
    expect(thresholdOptions('airbnb')).toEqual([5, 4.5, 4, 3.5, 3])
    expect(thresholdOptions('direct')).toEqual([5, 4.5, 4, 3.5, 3])
  })

  it('offers 10 down to 8 in half steps for a 10-point channel', () => {
    expect(thresholdOptions('booking_com')).toEqual([10, 9.5, 9, 8.5, 8])
  })

  it('includes each channel default in its own option list', () => {
    const config = createDefaultReviewConfig()
    for (const source of ['airbnb', 'booking_com', 'direct'] as const) {
      expect(thresholdOptions(source)).toContain(config.channels[source].minRating)
    }
  })
})

const PROP_1_LISTINGS = ['lst-1', 'lst-5']

/** A record with only the fields the resolver reads, for cases the mock data cannot express. */
function makeRecord(over: Partial<ReviewRecord> & { id: string }): ReviewRecord {
  return {
    reservation_id: 'res-x',
    source: 'airbnb',
    listing_id: 'lst-1',
    listing_name: 'Test',
    listing_location: 'Bali',
    unit_id: null,
    guest_name: 'Test Guest',
    num_guests: 2,
    nights: 3,
    guest_rating_overall: 10,
    scores: [],
    tags: [],
    guest_review_text: 'Lovely stay',
    is_hidden: false,
    is_replied: false,
    private_feedback: null,
    review_received_at: '2026-06-01T00:00:00Z',
    language_detected: 'en',
    translated_content: null,
    translation_language: null,
    reply_status: 'needs_reply',
    reply_text: null,
    reply_posted_at: null,
    host_review_id: null,
    host_review_text: null,
    host_review_ratings: null,
    is_reviewee_recommended: null,
    host_review_tags: [],
    sor_id: null,
    checkout_date: '2026-05-30',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...over,
  } as ReviewRecord
}

describe('resolveAutoReviews', () => {
  it('returns the five default-passing reviews for prop-1', () => {
    const config = createDefaultReviewConfig()
    const ids = resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, config).map(r => r.id)
    expect(ids.sort()).toEqual(['rr-001', 'rr-005', 'rr-007', 'rr-011', 'rr-014'])
  })

  it('orders the pool newest first', () => {
    const config = createDefaultReviewConfig()
    const ids = resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, config).map(r => r.id)
    expect(ids).toEqual(['rr-014', 'rr-011', 'rr-005', 'rr-001', 'rr-007'])
  })

  it('sorts a review with no received date last', () => {
    const records = [
      makeRecord({ id: 'undated', review_received_at: null }),
      makeRecord({ id: 'dated', review_received_at: '2026-01-01T00:00:00Z' }),
    ]
    const ids = resolveAutoReviews(records, ['lst-1'], createDefaultReviewConfig()).map(r => r.id)
    expect(ids).toEqual(['dated', 'undated'])
  })

  it('excludes listings outside the selected properties', () => {
    const config = createDefaultReviewConfig()
    const ids = resolveAutoReviews(mockReviewRecords, ['lst-12'], config).map(r => r.id)
    expect(ids).toEqual(['rr-012'])
  })

  it('returns nothing when no listing is in scope', () => {
    expect(resolveAutoReviews(mockReviewRecords, [], createDefaultReviewConfig())).toEqual([])
  })

  it('treats the threshold as inclusive', () => {
    // rr-012 is a Booking.com 9 and the default Booking.com rule is exactly 9+.
    const ids = resolveAutoReviews(mockReviewRecords, ['lst-12'], createDefaultReviewConfig())
      .map(r => r.id)
    expect(ids).toContain('rr-012')
  })

  it('applies each channel threshold in its own native scale', () => {
    // A normalized 9 clears Airbnb 4.5 and Booking.com 9, but not Airbnb 5.
    const records = [
      makeRecord({ id: 'ab', source: 'airbnb', guest_rating_overall: 9 }),
      makeRecord({ id: 'bc', source: 'booking_com', guest_rating_overall: 9 }),
    ]
    const config = createDefaultReviewConfig()
    expect(resolveAutoReviews(records, ['lst-1'], config).map(r => r.id).sort())
      .toEqual(['ab', 'bc'])

    config.channels.airbnb.minRating = 5
    expect(resolveAutoReviews(records, ['lst-1'], config).map(r => r.id)).toEqual(['bc'])
  })

  it('drops every review from a disabled channel, however high its rating', () => {
    const config = createDefaultReviewConfig()
    config.channels.direct.enabled = false
    const ids = resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, config).map(r => r.id)
    expect(ids).not.toContain('rr-007') // a Direct 10
    expect(ids).not.toContain('rr-014')
    expect(ids).toContain('rr-001')
  })

  it('returns nothing when every channel is disabled', () => {
    const config = createDefaultReviewConfig()
    for (const rule of Object.values(config.channels)) rule.enabled = false
    expect(resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, config)).toEqual([])
  })

  it('never returns a hidden double-blind review', () => {
    const config = createDefaultReviewConfig()
    config.channels.airbnb.minRating = 3 // low enough that rr-003 would otherwise qualify
    const ids = resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, config).map(r => r.id)
    expect(ids).not.toContain('rr-003')
  })

  it('never returns a review with no rating', () => {
    const ids = resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, createDefaultReviewConfig())
      .map(r => r.id)
    expect(ids).not.toContain('rr-008')
  })

  it('drops untexted reviews when requireText is on and keeps them when off', () => {
    const records = [
      makeRecord({ id: 'null-text', guest_review_text: null }),
      makeRecord({ id: 'blank-text', guest_review_text: '   ' }),
      makeRecord({ id: 'has-text', guest_review_text: 'Wonderful villa' }),
    ]
    const config = createDefaultReviewConfig()
    expect(resolveAutoReviews(records, ['lst-1'], config).map(r => r.id)).toEqual(['has-text'])

    config.requireText = false
    expect(resolveAutoReviews(records, ['lst-1'], config).map(r => r.id).sort())
      .toEqual(['blank-text', 'has-text', 'null-text'])
  })

  it('applies no cap to the pool', () => {
    const records = Array.from({ length: 200 }, (_, i) => makeRecord({
      id: `bulk-${i}`,
      review_received_at: new Date(2026, 0, 1 + i).toISOString(),
    }))
    expect(resolveAutoReviews(records, ['lst-1'], createDefaultReviewConfig())).toHaveLength(200)
  })

  it('ignores batchSize and minCountToShow, which are display concerns', () => {
    const config = createDefaultReviewConfig()
    config.batchSize = 2
    config.minCountToShow = 99
    expect(resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, config)).toHaveLength(5)
  })

  it('does not mutate the records it was given', () => {
    const snapshot = mockReviewRecords.map(r => r.id)
    resolveAutoReviews(mockReviewRecords, PROP_1_LISTINGS, createDefaultReviewConfig())
    expect(mockReviewRecords.map(r => r.id)).toEqual(snapshot)
  })
})
