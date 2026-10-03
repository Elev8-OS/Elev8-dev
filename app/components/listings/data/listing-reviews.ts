import type { ReviewFeedItem, ReviewRecord } from '~/components/review-hub/data/types'

/**
 * A listing's reviews come from the Review Hub (`useReviewHub().feedItems`),
 * never from `listing.reviews`, so the listing pages and the hub agree.
 */

/** The hub feed items for one listing, narrowed to a room when one is picked. */
export function listingFeedItems(items: ReviewFeedItem[], listingId: string, unitId?: string | null): ReviewFeedItem[] {
  return items.filter(item =>
    item.review_record.listing_id === listingId
    && (!unitId || item.review_record.unit_id === unitId),
  )
}

/**
 * Average overall score on the Channex 0-10 scale every channel is normalised
 * to, over ratings a host can see (a double-blind hidden review counts once
 * revealed). Null when nothing is rated yet.
 */
export function averageOverallScore(records: ReviewRecord[], isHidden: (r: ReviewRecord) => boolean): number | null {
  const rated = records.filter(r => r.guest_rating_overall !== null && !isHidden(r))
  if (!rated.length)
    return null
  return rated.reduce((sum, r) => sum + (r.guest_rating_overall ?? 0), 0) / rated.length
}
