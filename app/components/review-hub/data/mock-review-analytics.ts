import type { ReviewRecord } from '~/components/review-hub/data/types'

/**
 * Historical review seed for Review Hub Analytics.
 * Deterministic ~13 months (Jun 2025 – Aug 2026) across the 3 mock listings.
 * All scores normalized to the Channex 0-10 scale (max 10).
 * This is the single source of truth for KPIs, trends, and categories.
 */

export interface AnalyticsSeedRecord {
  id: string
  reservation_id: string
  source: 'airbnb' | 'booking_com' | 'direct'
  listing_id: string
  listing_name: string
  listing_location: string
  guest_name: string
  num_guests: number
  nights: number
  /** 0-10 overall */
  guest_rating_overall: number | null
  /** category scores: value, location, checkin, accuracy, communication, cleanliness (0-10) */
  categoryScores: { value: number, location: number, checkin: number, accuracy: number, communication: number, cleanliness: number }
  /** positive/negative tag codes (subset of Channex tags) */
  positiveTags: string[]
  negativeTags: string[]
  checkout_date: string
  review_received_at: string | null
}

const LISTINGS = [
  { id: 'lst-1', name: '5BR Pool the R Villa Luwa', location: 'Canggu, Bali' },
  { id: 'lst-5', name: 'Nomad Mansion Garden', location: 'Canggu, Bali' },
  { id: 'lst-12', name: 'Surf Shack Canggu', location: 'Canggu, Bali' },
]

const GUEST_FIRST = ['Sarah', 'Thomas', 'James', 'Lisa', 'Elena', 'Marco', 'Anna', 'David', 'Sophie', 'Mike', 'Clara', 'Florian', 'Hana', 'Isabella', 'Nico', 'Emma', 'Lucas', 'Mia', 'Omar', 'Yuki', 'Lena', 'Noah', 'Ava', 'Felix', 'Zoe', 'Ivan', 'Nina', 'Leo', 'Julia', 'Mateo']
const GUEST_LAST = ['Chen', 'Mueller', 'Richardson', 'Wang', 'Kowalski', 'Rossi', 'Schmidt', 'Park', 'Anderson', 'Johnson', 'Fischer', 'Weber', 'Tanaka', 'Laurent', 'Smith', 'Brown', 'Garcia', 'Kim', 'Haddad', 'Sato', 'Meyer', 'Wagner', 'Novak', 'Silva', 'Petrov', 'Costa', 'Muller', 'Bianchi', 'Moreau', 'Reyes']

const POSITIVE_TAGS = [
  'guest_review_host_positive_spotless_furniture_and_linens',
  'guest_review_host_positive_free_of_clutter',
  'guest_review_host_positive_squeaky_clean_bathroom',
  'guest_review_host_positive_pristine_kitchen',
  'guest_review_host_positive_responsive_host',
  'guest_review_host_positive_clear_instructions',
  'guest_review_host_positive_looked_like_photos',
  'guest_review_host_positive_matched_description',
  'guest_review_host_positive_had_listed_amenities_and_services',
  'guest_review_host_positive_easy_to_find',
  'guest_review_host_positive_flexible_check_in',
  'guest_review_host_positive_felt_at_home',
  'guest_review_host_positive_always_responsive',
  'guest_review_host_positive_proactive',
  'guest_review_host_positive_helpful_instructions',
  'guest_review_host_positive_peaceful',
  'guest_review_host_positive_beautiful_surroundings',
  'guest_review_host_positive_private',
  'guest_review_host_positive_walkable',
  'guest_review_host_positive_great_restaurants',
]

const NEGATIVE_TAGS = [
  'guest_review_host_negative_dirty_or_dusty',
  'guest_review_host_negative_noticeable_smell',
  'guest_review_host_negative_stains',
  'guest_review_host_negative_hair_or_pet_hair',
  'guest_review_host_negative_dirty_bathroom',
  'guest_review_host_negative_messy_kitchen',
  'guest_review_host_negative_trash_left_behind',
  'guest_review_host_negative_smaller_than_expected',
  'guest_review_host_negative_did_not_match_photos',
  'guest_review_host_negative_needs_maintenance',
  'guest_review_host_negative_missing_amenity',
  'guest_review_host_negative_hard_to_locate',
  'guest_review_host_negative_unclear_instructions',
  'guest_review_host_negative_trouble_with_lock',
  'guest_review_host_negative_unresponsive_host',
  'guest_review_host_negative_slow_to_respond',
  'guest_review_host_negative_not_helpful',
  'guest_review_host_negative_inconsiderate',
  'guest_review_host_negative_noisy',
  'guest_review_host_negative_inconvenient_location',
]

// Deterministic PRNG (mulberry32) so the seed is stable across reloads
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!
}

function pickN<T>(rng: () => number, arr: T[], n: number): T[] {
  const copy = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length)
    out.push(copy.splice(idx, 1)[0]!)
  }
  return out
}

/**
 * Generate the analytics seed records deterministically.
 * Roughly 5 reviews/week across listings → ~280 records over 58 weeks.
 */
export function generateAnalyticsSeed(): AnalyticsSeedRecord[] {
  const rng = mulberry32(42)
  const records: AnalyticsSeedRecord[] = []

  // Week start: Monday 2025-06-23
  const start = new Date('2025-06-23T00:00:00Z')
  const end = new Date('2026-08-06T00:00:00Z')

  let id = 1
  let resId = 500

  // ~58 weeks from 2025-06-23 to 2026-08-06
  const totalWeeks = Math.ceil((end.getTime() - start.getTime()) / (7 * 86400000))

  for (let w = 0; w < totalWeeks; w++) {
    const d = new Date(start)
    d.setDate(d.getDate() + w * 7)
    // Each week: 1-3 reviews per listing
    for (const listing of LISTINGS) {
      const perWeek = 1 + Math.floor(rng() * 3)
      for (let k = 0; k < perWeek; k++) {
        // Source: 50% airbnb, 30% booking, 20% direct
        const srcRoll = rng()
        const source: AnalyticsSeedRecord['source'] = srcRoll < 0.5 ? 'airbnb' : srcRoll < 0.8 ? 'booking_com' : 'direct'

        // Rating distribution: mostly high, some low (0-10)
        const ratingRoll = rng()
        let rating: number
        if (ratingRoll < 0.55)
          rating = 10
        else if (ratingRoll < 0.75)
          rating = 8
        else if (ratingRoll < 0.9)
          rating = 6
        else if (ratingRoll < 0.97)
          rating = 4
        else rating = 2

        // Category scores correlate with overall (0-10)
        const base = rating
        const jitter = () => Math.max(1, Math.min(10, base + Math.round((rng() - 0.5) * 4)))
        const categoryScores = {
          value: jitter(),
          location: Math.max(1, Math.min(10, base + Math.round((rng() - 0.3) * 3))),
          checkin: jitter(),
          accuracy: jitter(),
          communication: jitter(),
          cleanliness: jitter(),
        }

        // Tags: positive tags for high ratings, negative for low
        const positiveTags = rating >= 8 ? pickN(rng, POSITIVE_TAGS, 2 + Math.floor(rng() * 3)) : rating >= 6 ? pickN(rng, POSITIVE_TAGS, 1 + Math.floor(rng() * 2)) : []
        const negativeTags = rating <= 4 ? pickN(rng, NEGATIVE_TAGS, 2 + Math.floor(rng() * 2)) : rating === 6 ? pickN(rng, NEGATIVE_TAGS, 1 + Math.floor(rng() * 1)) : []

        // Checkout date = a random day within the week (Mon-Sun)
        const checkoutOffset = Math.floor(rng() * 7)
        const checkout = new Date(d)
        checkout.setDate(checkout.getDate() + checkoutOffset)

        const guestName = `${pickWeighted(rng, GUEST_FIRST)} ${pickWeighted(rng, GUEST_LAST)}`
        const nights = 2 + Math.floor(rng() * 7)
        const numGuests = 1 + Math.floor(rng() * 6)

        records.push({
          id: `r-${String(id++).padStart(3, '0')}`,
          reservation_id: `res-${resId++}`,
          source,
          listing_id: listing.id,
          listing_name: listing.name,
          listing_location: listing.location,
          guest_name: guestName,
          num_guests: numGuests,
          nights,
          guest_rating_overall: rating,
          categoryScores,
          positiveTags,
          negativeTags,
          checkout_date: checkout.toISOString().slice(0, 10),
          review_received_at: new Date(checkout.getTime() + 86400000 * 3).toISOString(),
        })
      }
    }
  }

  return records
}

/** Convert seed records into ReviewRecord-shaped objects usable by the analytics composable */
export function buildAnalyticsReviewRecords(): ReviewRecord[] {
  return generateAnalyticsSeed().map(r => ({
    id: r.id,
    reservation_id: r.reservation_id,
    source: r.source,
    listing_id: r.listing_id,
    listing_name: r.listing_name,
    listing_location: r.listing_location,
    unit_id: null,
    guest_name: r.guest_name,
    num_guests: r.num_guests,
    nights: r.nights,
    guest_rating_overall: r.guest_rating_overall,
    scores: [
      { category: 'value', score: r.categoryScores.value },
      { category: 'location', score: r.categoryScores.location },
      { category: 'checkin', score: r.categoryScores.checkin },
      { category: 'accuracy', score: r.categoryScores.accuracy },
      { category: 'communication', score: r.categoryScores.communication },
      { category: 'cleanliness', score: r.categoryScores.cleanliness },
    ],
    tags: [...r.positiveTags, ...r.negativeTags],
    guest_review_text: r.guest_rating_overall !== null ? 'Historical review for analytics.' : null,
    is_hidden: false,
    is_replied: false,
    private_feedback: null,
    review_received_at: r.review_received_at,
    language_detected: 'en',
    reply_status: 'replied',
    reply_text: null,
    reply_posted_at: null,
    host_review_id: null,
    host_review_text: null,
    host_review_ratings: null,
    is_reviewee_recommended: null,
    host_review_tags: [],
    sor_id: null,
    checkout_date: r.checkout_date,
    created_at: r.checkout_date,
    updated_at: r.checkout_date,
  }))
}
