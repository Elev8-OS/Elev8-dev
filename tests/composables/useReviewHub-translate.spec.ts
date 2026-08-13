import { beforeEach, describe, expect, it } from 'vitest'
import { useAirbnbReviews } from '~/composables/useAirbnbReviews'
import { useReviewHub } from '~/composables/useReviewHub'
import { mockReviewRecords } from '~/components/review-hub/data/mock-review-records'

describe('useReviewHub translateReview', () => {
  beforeEach(() => {
    // Fresh deep-clone state per test so assertions are deterministic
    const { reviewRecords } = useReviewHub()
    reviewRecords.value = JSON.parse(JSON.stringify(mockReviewRecords))
  })

  it('translates a non-English review into the configured target language', async () => {
    const { translateReview } = useReviewHub()
    const { config } = useAirbnbReviews()
    config.value = { ...config.value, host_language: 'en' }

    const original = mockReviewRecords.find(r => r.id === 'rr-012')!
    await translateReview('rr-012')

    const { reviewRecords } = useReviewHub()
    const record = reviewRecords.value.find(r => r.id === 'rr-012')!
    expect(record.translated_content).toBeTruthy()
    expect(record.translation_language).toBe('en')
    expect(record.translated_content).not.toBe(original.guest_review_text)
  })

  it('persists the translation so a second call is a no-op', async () => {
    const { translateReview, reviewRecords } = useReviewHub()
    await translateReview('rr-012')
    const first = reviewRecords.value.find(r => r.id === 'rr-012')!.translated_content

    await translateReview('rr-012')
    const second = reviewRecords.value.find(r => r.id === 'rr-012')!.translated_content
    expect(second).toBe(first)
  })

  it('does nothing when the review is already in the target language', async () => {
    const { translateReview, reviewRecords } = useReviewHub()
    const { config } = useAirbnbReviews()
    config.value = { ...config.value, host_language: 'en' }

    // rr-001 is already English
    await translateReview('rr-001')
    const record = reviewRecords.value.find(r => r.id === 'rr-001')!
    expect(record.translated_content).toBeNull()
  })

  it('does nothing for a review with no guest review text', async () => {
    const { translateReview, reviewRecords } = useReviewHub()
    const record = reviewRecords.value.find(r => r.id === 'rr-001')!
    const original = record.guest_review_text
    ;(record as any).guest_review_text = null

    await translateReview('rr-001')
    expect(reviewRecords.value.find(r => r.id === 'rr-001')!.translated_content).toBeNull()
    expect(reviewRecords.value.find(r => r.id === 'rr-001')!.guest_review_text).toBeNull()
  })
})
