// getDisplayMax reports 5 for Airbnb and Direct, 10 for Booking.com. getDisplayScore
// must divide by 2 for every channel shown on a 5-point scale, or a Direct review
// renders as "10.0/5".
import { describe, expect, it } from 'vitest'
import { getDisplayMax, getDisplayScore } from '~/components/review-hub/data/types'

describe('getDisplayScore', () => {
  it('halves an Airbnb score for its 5-point scale', () => {
    expect(getDisplayScore(10, 'airbnb')).toBe('5.0')
    expect(getDisplayScore(9, 'airbnb')).toBe('4.5')
  })

  it('halves a Direct score for its 5-point scale', () => {
    expect(getDisplayScore(10, 'direct')).toBe('5.0')
    expect(getDisplayScore(9, 'direct')).toBe('4.5')
  })

  it('leaves a Booking.com score on its 10-point scale', () => {
    expect(getDisplayScore(9, 'booking_com')).toBe('9.0')
  })

  it('renders a dash for a missing score', () => {
    expect(getDisplayScore(null, 'airbnb')).toBe('-')
  })

  it('never reports a score above its own display max', () => {
    for (const source of ['airbnb', 'booking_com', 'direct'] as const) {
      expect(Number(getDisplayScore(10, source))).toBeLessThanOrEqual(getDisplayMax(source))
    }
  })
})
