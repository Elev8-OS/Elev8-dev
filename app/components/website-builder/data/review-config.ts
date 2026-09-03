// Auto-show rules for guest reviews on a generated website.
//
// The review store is normalized to 0-10 (Channex `guest_rating_overall`), but a host
// thinks in the scale their channel shows them: 4.5 of 5 on Airbnb is the same bar as
// 9 of 10 on Booking.com. Thresholds are therefore stored NATIVE and converted here,
// so the number in the form always matches the number on the channel.
//
// Framework-free on purpose: the wizard owns the reactive state and calls these.

import type { ReviewRecord, ReviewSource } from '~/components/review-hub/data/types'
import { getDisplayMax } from '~/components/review-hub/data/types'

export type WebsiteReviewMode = 'auto' | 'manual'

export interface ReviewChannelRule {
  enabled: boolean
  minRating: number // native scale: airbnb/direct 0-5, booking_com 0-10
}

export interface WebsiteReviewConfig {
  mode: WebsiteReviewMode
  channels: Record<ReviewSource, ReviewChannelRule>
  requireText: boolean
  minCountToShow: number // hide the whole section below this many matches
  batchSize: number // Load more batch; there is no cap on the total
}

export function createDefaultReviewConfig(): WebsiteReviewConfig {
  return {
    mode: 'auto',
    channels: {
      airbnb: { enabled: true, minRating: 4.5 },
      booking_com: { enabled: true, minRating: 9 },
      direct: { enabled: true, minRating: 4.5 },
    },
    requireText: true,
    minCountToShow: 3,
    batchSize: 12,
  }
}

export function cloneReviewConfig(config: WebsiteReviewConfig): WebsiteReviewConfig {
  return {
    ...config,
    channels: {
      airbnb: { ...config.channels.airbnb },
      booking_com: { ...config.channels.booking_com },
      direct: { ...config.channels.direct },
    },
  }
}

/** Converts a host-facing native rating to the 0-10 scale the store uses. */
export function nativeToNormalized(rating: number, source: ReviewSource): number {
  return getDisplayMax(source) === 5 ? rating * 2 : rating
}

/** The five selectable thresholds for a channel, highest first, in native scale. */
export function thresholdOptions(source: ReviewSource): number[] {
  const max = getDisplayMax(source)
  return [0, 1, 2, 3, 4].map(step => max - step * 0.5)
}
