import { describe, expect, it } from 'vitest'
import {
  cloneReviewConfig,
  createDefaultReviewConfig,
  nativeToNormalized,
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
