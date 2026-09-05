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
  /**
   * Reviews the host has hidden by hand despite them clearing the rules — the escape hatch
   * Auto mode needs for the one review a rule cannot describe. Optional so a website saved
   * before this existed needs no migration; read it through `excludedIds()`.
   */
  excludedReviewIds?: string[]
}

/** Exclusions of a config that may predate the field. */
export function excludedIds(config: WebsiteReviewConfig): string[] {
  return config.excludedReviewIds ?? []
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
    excludedReviewIds: [],
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
    excludedReviewIds: [...excludedIds(config)],
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

function hasText(record: ReviewRecord): boolean {
  return (record.guest_review_text ?? '').trim() !== ''
}

/**
 * Newest first; a review without a received date sorts last rather than jumping to the
 * top as epoch 0. Shared so Auto's resolved pool and Manual's picked list order the same
 * way in the wizard preview and the published site.
 */
export function compareByReceivedDesc(a: ReviewRecord, b: ReviewRecord): number {
  const left = a.review_received_at ? Date.parse(a.review_received_at) : -Infinity
  const right = b.review_received_at ? Date.parse(b.review_received_at) : -Infinity
  return right - left
}

/**
 * Every review the rules admit, newest first — **before** the host's hand-picked
 * exclusions. This is what the Auto picker lists, so a hidden review stays on screen
 * (unticked) and can be brought back; use `resolveAutoReviews` for what actually publishes.
 *
 * Pure: does not mutate `records`. `batchSize` and `minCountToShow` are display
 * settings and deliberately play no part here.
 */
export function resolveRuleMatches(
  records: ReviewRecord[],
  listingIds: string[],
  config: WebsiteReviewConfig,
): ReviewRecord[] {
  if (listingIds.length === 0)
    return []
  const inScope = new Set(listingIds)

  return records
    .filter((record) => {
      if (!inScope.has(record.listing_id))
        return false
      // Airbnb double-blind reviews are not public yet.
      if (record.is_hidden)
        return false
      const rule = config.channels[record.source]
      if (!rule?.enabled)
        return false
      if (record.guest_rating_overall === null)
        return false
      if (record.guest_rating_overall < nativeToNormalized(rule.minRating, record.source))
        return false
      if (config.requireText && !hasText(record))
        return false
      return true
    })
    .sort(compareByReceivedDesc)
}

/**
 * Every review that should appear on the published site: the rule matches minus anything
 * the host hid by hand.
 */
export function resolveAutoReviews(
  records: ReviewRecord[],
  listingIds: string[],
  config: WebsiteReviewConfig,
): ReviewRecord[] {
  const excluded = new Set(excludedIds(config))
  return resolveRuleMatches(records, listingIds, config).filter(r => !excluded.has(r.id))
}

export interface AutoReviewStats {
  total: number
  byChannel: Record<ReviewSource, number>
}

/** Pool size overall and per channel, for the live match line in the rules form. */
export function autoReviewStats(
  records: ReviewRecord[],
  listingIds: string[],
  config: WebsiteReviewConfig,
): AutoReviewStats {
  const resolved = resolveAutoReviews(records, listingIds, config)
  const byChannel: Record<ReviewSource, number> = { airbnb: 0, booking_com: 0, direct: 0 }
  for (const record of resolved)
    byChannel[record.source] += 1
  return { total: resolved.length, byChannel }
}

/**
 * Whether the published site should render its reviews section at all.
 * Manual testimonials count, so a new property with two host-written reviews and one
 * matching guest review still clears the default gate of 3.
 */
export function meetsMinCount(
  autoTotal: number,
  manualCount: number,
  config: WebsiteReviewConfig,
): boolean {
  return autoTotal + manualCount >= config.minCountToShow
}
