// Review Hub - Type Definitions (Channex-aligned)

// --- Review Source (Channel) ---
export type ReviewSource = 'airbnb' | 'booking_com' | 'direct'

// --- Reply Status (for ReviewRecord) ---
export type ReplyStatus = 'host_review_pending' | 'needs_reply' | 'replied'

// --- Unified Score Category (Channex: {category, score} array, 0-10 scale) ---
export interface ScoreCategory {
  category: string
  score: number
}

// --- Review Tags (Channex: ~80+ predefined tags) ---
export type ReviewTagCategory = 'cleanliness' | 'respect_house_rules' | 'communication' | 'accuracy' | 'checkin' | 'location'

// --- ReviewRecord (guest reviews from all channels, Channex-aligned) ---
export interface ReviewRecord {
  id: string
  reservation_id: string
  source: ReviewSource
  listing_id: string
  listing_name: string
  listing_location: string
  unit_id: string | null
  guest_name: string
  num_guests: number
  nights: number
  guest_rating_overall: number | null // Channex: 0-10 scale, all channels normalized
  scores: ScoreCategory[] // Channex: [{category: "clean", score: 9.5}, ...]
  tags: string[] // Channex: review tag codes (Airbnb only, ~80+)
  guest_review_text: string | null
  is_hidden: boolean // Channex: Airbnb double-blind flag
  is_replied: boolean // Channex: host has replied
  private_feedback: string | null
  review_received_at: string | null
  language_detected: string | null
  translated_content: string | null
  translation_language: string | null
  reply_status: ReplyStatus // Elev8 computed: host_review_pending | needs_reply | replied
  reply_text: string | null
  reply_posted_at: string | null
  host_review_id: string | null
  host_review_text: string | null
  host_review_ratings: { cleanliness: number, communication: number, respect_house_rules: number } | null // Channex: 1-5 ratings
  is_reviewee_recommended: boolean | null // Channex: host review flag
  host_review_tags: string[] // Channex: host review tags
  sor_id: string | null
  checkout_date: string
  created_at: string
  updated_at: string
}

// --- Stay Operational Record ---
export type BadgeLevel = 'green' | 'amber' | 'red'

export interface StayOperationalRecord {
  id: string
  reservation_id: string
  listing_id: string
  cleaning_score: number | null
  cleaning_notes: string | null
  cleaning_duration_delta: number | null
  house_rule_flags: HouseRuleFlag[]
  communication_score: number | null
  communication_summary: string | null
  computed_at: string
}

export interface HouseRuleFlag {
  id: string
  reservation_id: string
  type: 'extra_guest' | 'unregistered_pet' | 'smoking' | 'noise' | 'damage' | 'early_late_unapproved' | 'other'
  severity: 'low' | 'medium' | 'high'
  evidence_url: string | null
  reported_by: 'housekeeping' | 'pm' | 'smart_lock_log' | 'guest_inbox'
  reported_at: string
  resolution_status: 'open' | 'resolved_onsite' | 'disputed'
}

// --- Unified Feed Item ---
export interface ReviewFeedItem {
  id: string
  review_record: ReviewRecord
  sor: StayOperationalRecord | null
  host_review: any | null
}

// --- Score Display Helper ---
// Channex normalizes all scores to 0-10. Display in channel-native scale.
export function getDisplayMax(source: ReviewSource): number {
  return source === 'booking_com' ? 10 : 5
}

export function getDisplayScore(overallScore: number | null, source: ReviewSource): string {
  if (overallScore === null) return '-'
  // Every channel whose display max is 5 needs halving; only Booking.com is a 10-point scale.
  if (getDisplayMax(source) === 5) return (overallScore / 2).toFixed(1)
  return overallScore.toFixed(1)
}

export function getCategoryDisplayLabel(category: string): string {
  const labels: Record<string, string> = {
    accuracy: 'Accuracy',
    checkin: 'Check-in',
    clean: 'Cleanliness',
    comfort: 'Comfort',
    communication: 'Communication',
    facilities: 'Facilities',
    location: 'Location',
    staff: 'Staff',
    value: 'Value',
    respect_house_rules: 'House Rules',
    cleanliness: 'Cleanliness',
    wifi: 'WiFi',
  }
  return labels[category] ?? category
}

// --- Badge Level Helpers ---
export function getCleaningBadgeLevel(score: number | null): BadgeLevel | null {
  if (score === null) return null
  if (score >= 4) return 'green'
  if (score >= 3) return 'amber'
  return 'red'
}

export function getHouseRulesBadgeLevel(flags: HouseRuleFlag[]): BadgeLevel {
  if (flags.length === 0) return 'green'
  const hasHigh = flags.some(f => f.severity === 'high')
  if (hasHigh) return 'red'
  const hasMedium = flags.some(f => f.severity === 'medium')
  if (hasMedium) return 'amber'
  return 'amber'
}

export function getCommunicationBadgeLevel(score: number | null): BadgeLevel | null {
  if (score === null) return null
  if (score >= 4) return 'green'
  if (score >= 3) return 'amber'
  return 'red'
}

// --- Badge Level Colors ---
export const badgeLevelColors: Record<BadgeLevel, { bg: string, text: string, border: string }> = {
  green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

// --- Reply Status Labels ---
export const replyStatusLabels: Record<ReplyStatus, string> = {
  host_review_pending: 'Host Review Due',
  needs_reply: 'Needs Reply',
  replied: 'Replied',
}

// --- Reply Status Icons ---
export const replyStatusIcons: Record<ReplyStatus, string> = {
  host_review_pending: 'lucide:user-check',
  needs_reply: 'lucide:message-circle',
  replied: 'lucide:check-circle-2',
}

// --- Reply Status Colors ---
export const replyStatusColors: Record<ReplyStatus, { bg: string, text: string }> = {
  host_review_pending: { bg: 'bg-blue-50', text: 'text-blue-700' },
  needs_reply: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  replied: { bg: 'bg-green-50', text: 'text-green-700' },
}

// --- Channel Labels ---
export const channelLabels: Record<ReviewSource, string> = {
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  direct: 'Direct',
}

// --- Channel Icons ---
export const channelIcons: Record<ReviewSource, string> = {
  airbnb: 'logos:airbnb',
  booking_com: 'simple-icons:bookingdotcom',
  direct: 'lucide:globe',
}

// --- Review Tag Labels (Channex: ~80+ tags mapped to human-readable) ---
export function getTagLabel(tagCode: string): string {
  const labels: Record<string, string> = {
    // Guest review — cleanliness
    guest_review_host_positive_spotless_furniture_and_linens: 'Spotless furniture & linens',
    guest_review_host_positive_free_of_clutter: 'Free of clutter',
    guest_review_host_positive_squeaky_clean_bathroom: 'Clean bathroom',
    guest_review_host_positive_pristine_kitchen: 'Pristine kitchen',
    guest_review_host_negative_dirty_or_dusty: 'Dirty/dusty',
    guest_review_host_negative_noticeable_smell: 'Noticeable smell',
    guest_review_host_negative_stains: 'Stains',
    guest_review_host_negative_hair_or_pet_hair: 'Hair/pet hair',
    guest_review_host_negative_dirty_bathroom: 'Dirty bathroom',
    guest_review_host_negative_messy_kitchen: 'Messy kitchen',
    guest_review_host_negative_trash_left_behind: 'Trash left behind',
    // Guest review — accuracy
    guest_review_host_positive_looked_like_photos: 'Looked like photos',
    guest_review_host_positive_matched_description: 'Matched description',
    guest_review_host_positive_had_listed_amenities_and_services: 'Amenities as listed',
    guest_review_host_negative_smaller_than_expected: 'Smaller than expected',
    guest_review_host_negative_did_not_match_photos: 'Didn\'t match photos',
    guest_review_host_negative_needs_maintenance: 'Needs maintenance',
    guest_review_host_negative_missing_amenity: 'Missing amenity',
    guest_review_host_negative_broken_or_missing_lock: 'Broken lock',
    guest_review_host_negative_incorrect_bathroom: 'Wrong bathroom type',
    // Guest review — checkin
    guest_review_host_positive_responsive_host: 'Responsive host',
    guest_review_host_positive_clear_instructions: 'Clear instructions',
    guest_review_host_positive_easy_to_find: 'Easy to find',
    guest_review_host_positive_flexible_check_in: 'Flexible check-in',
    guest_review_host_positive_felt_at_home: 'Felt at home',
    guest_review_host_negative_hard_to_locate: 'Hard to locate',
    guest_review_host_negative_unclear_instructions: 'Unclear instructions',
    guest_review_host_negative_trouble_with_lock: 'Lock trouble',
    guest_review_host_negative_unresponsive_host: 'Unresponsive host',
    // Guest review — communication
    guest_review_host_positive_always_responsive: 'Always responsive',
    guest_review_host_positive_local_recommendations: 'Local tips',
    guest_review_host_positive_proactive: 'Proactive',
    guest_review_host_positive_helpful_instructions: 'Helpful instructions',
    guest_review_host_positive_considerate: 'Considerate',
    guest_review_host_negative_slow_to_respond: 'Slow to respond',
    guest_review_host_negative_not_helpful: 'Not helpful',
    guest_review_host_negative_missing_house_instructions: 'Missing instructions',
    guest_review_host_negative_inconsiderate: 'Inconsiderate',
    // Guest review — location
    guest_review_host_positive_peaceful: 'Peaceful',
    guest_review_host_positive_beautiful_surroundings: 'Beautiful area',
    guest_review_host_positive_private: 'Private',
    guest_review_host_positive_great_restaurants: 'Great restaurants',
    guest_review_host_positive_lots_to_do: 'Lots to do',
    guest_review_host_positive_walkable: 'Walkable',
    guest_review_host_negative_noisy: 'Noisy',
    guest_review_host_negative_not_much_to_do: 'Not much to do',
    guest_review_host_negative_inconvenient_location: 'Bad location',
    // Host review — cleanliness
    host_review_guest_positive_neat_and_tidy: 'Neat & tidy',
    host_review_guest_positive_kept_in_good_condition: 'Good condition',
    host_review_guest_positive_took_care_of_garbage: 'Took care of garbage',
    host_review_guest_negative_ignored_checkout_directions: 'Ignored checkout',
    host_review_guest_negative_excessive_garbage: 'Excessive garbage',
    host_review_guest_negative_messy_kitchen: 'Messy kitchen',
    host_review_guest_negative_damage: 'Damaged property',
    host_review_guest_negative_ruined_bed_linens: 'Ruined linens',
    // Host review — house rules
    host_review_guest_negative_arrived_early: 'Arrived early',
    host_review_guest_negative_stayed_past_checkout: 'Stayed late',
    host_review_guest_negative_unapproved_guests: 'Unapproved guests',
    host_review_guest_negative_unapproved_pet: 'Unapproved pet',
    host_review_guest_negative_did_not_respect_quiet_hours: 'Noise violation',
    host_review_guest_negative_unapproved_event: 'Unapproved event',
    host_review_guest_negative_smoking: 'Smoking',
    // Host review — communication
    host_review_guest_positive_helpful_messages: 'Helpful messages',
    host_review_guest_positive_respectful: 'Respectful',
    host_review_guest_positive_always_responded: 'Always responded',
    host_review_guest_negative_unhelpful_messages: 'Unhelpful',
    host_review_guest_negative_disrespectful: 'Disrespectful',
    host_review_guest_negative_unreachable: 'Unreachable',
    host_review_guest_negative_slow_responses: 'Slow responses',
  }
  return labels[tagCode] ?? tagCode
}

export function getTagSentiment(tagCode: string): 'positive' | 'negative' {
  return tagCode.includes('_negative_') ? 'negative' : 'positive'
}

// --- Host Review Tag Options (for selector) ---
export const hostReviewTagOptions: { code: string, label: string, category: 'cleanliness' | 'respect_house_rules' | 'communication' }[] = [
  { code: 'host_review_guest_positive_neat_and_tidy', label: 'Neat & tidy', category: 'cleanliness' },
  { code: 'host_review_guest_positive_kept_in_good_condition', label: 'Good condition', category: 'cleanliness' },
  { code: 'host_review_guest_positive_took_care_of_garbage', label: 'Took care of garbage', category: 'cleanliness' },
  { code: 'host_review_guest_negative_ignored_checkout_directions', label: 'Ignored checkout', category: 'cleanliness' },
  { code: 'host_review_guest_negative_excessive_garbage', label: 'Excessive garbage', category: 'cleanliness' },
  { code: 'host_review_guest_negative_messy_kitchen', label: 'Messy kitchen', category: 'cleanliness' },
  { code: 'host_review_guest_negative_damage', label: 'Damaged property', category: 'cleanliness' },
  { code: 'host_review_guest_negative_ruined_bed_linens', label: 'Ruined linens', category: 'cleanliness' },
  { code: 'host_review_guest_negative_arrived_early', label: 'Arrived early', category: 'respect_house_rules' },
  { code: 'host_review_guest_negative_stayed_past_checkout', label: 'Stayed late', category: 'respect_house_rules' },
  { code: 'host_review_guest_negative_unapproved_guests', label: 'Unapproved guests', category: 'respect_house_rules' },
  { code: 'host_review_guest_negative_unapproved_pet', label: 'Unapproved pet', category: 'respect_house_rules' },
  { code: 'host_review_guest_negative_did_not_respect_quiet_hours', label: 'Noise violation', category: 'respect_house_rules' },
  { code: 'host_review_guest_negative_unapproved_event', label: 'Unapproved event', category: 'respect_house_rules' },
  { code: 'host_review_guest_negative_smoking', label: 'Smoking', category: 'respect_house_rules' },
  { code: 'host_review_guest_positive_helpful_messages', label: 'Helpful messages', category: 'communication' },
  { code: 'host_review_guest_positive_respectful', label: 'Respectful', category: 'communication' },
  { code: 'host_review_guest_positive_always_responded', label: 'Always responded', category: 'communication' },
  { code: 'host_review_guest_negative_unhelpful_messages', label: 'Unhelpful', category: 'communication' },
  { code: 'host_review_guest_negative_disrespectful', label: 'Disrespectful', category: 'communication' },
  { code: 'host_review_guest_negative_unreachable', label: 'Unreachable', category: 'communication' },
  { code: 'host_review_guest_negative_slow_responses', label: 'Slow responses', category: 'communication' },
]
