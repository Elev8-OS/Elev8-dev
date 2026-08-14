import type { AutoReview } from '~/components/airbnb-reviews/data/reviews'
import type { ReplyStatus, ReviewFeedItem, ReviewRecord, ReviewSource, StayOperationalRecord } from '~/components/review-hub/data/types'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { listings as allListings, getUnitById, getUnitTypeForUnit } from '~/components/listings/data/listings'
import { mockReviewRecords } from '~/components/review-hub/data/mock-review-records'
import { mockSorRecords } from '~/components/review-hub/data/mock-sor'
import { useAirbnbReviews } from '~/composables/useAirbnbReviews'


// Mock translation lookup: original guest review text -> English translation.
// Mirrors the Inbox module's mockTranslate pattern. V1 ships EN target only;
// extend to per-language maps (Record<HostLanguage, ...>) when multi-target is needed.
const mockReviewTranslations: Record<string, string> = {
  'Perfekter Ort für einen Surf-Trip! Nur wenige Schritte vom Strand, großartiger Board-Stauraum und nachts ruhig. Der Gastgeber hatte tolle lokale Tipps.': 'Perfect spot for a surf trip! Steps from the beach, great board storage, and quiet at night. The host had great local tips.',
  'Leider war unser Aufenthalt enttäuschend. Die Unterkunft hatte einen starken muffigen Geruch, die Bettwäsche war fleckig und ab 7 Uhr morgens begann Baulärm von nebenan. Der Gastgeber gab klare Anweisungen, aber die Unterkunft braucht dringend Instandhaltung.': 'Unfortunately our stay was disappointing. The unit had a strong damp smell, the sheets were stained, and construction noise from next door started at 7am. The host gave clear instructions but the property needs serious upkeep.',
  "Malheureusement, notre séjour a été décevant. Le logement avait une forte odeur d'humidité, les draps étaient tachés et le bruit des travaux du voisin commençait à 7h du matin. L'hôte a donné des instructions claires mais le bien nécessite un sérieux entretien.": 'Unfortunately our stay was disappointing. The unit had a strong damp smell, the sheets were stained, and construction noise from next door started at 7am. The host gave clear instructions but the property needs serious upkeep.',
}

// Fallback label when the text has no map entry (same convention as Inbox).
function mockTranslateFallback(text: string, targetLang: string): string {
  return `[Translated to ${targetLang}] ${text}`
}

export type HubFilterStatus = 'all' | ReplyStatus
export type HubFilterChannel = 'all' | ReviewSource
export type HubSortKey = 'checkout_date' | 'guest_name' | 'rating' | 'source'

export function useReviewHub() {
  const reviewRecords = useState<ReviewRecord[]>('review-hub-records', () => JSON.parse(JSON.stringify(mockReviewRecords)))
  const sorRecords = useState<StayOperationalRecord[]>('review-hub-sor', () => JSON.parse(JSON.stringify(mockSorRecords)))

  const { reviews: hostReviews, generateReview, approveReview: approveHostReview } = useAirbnbReviews()

  // Filters
  const searchQuery = ref('')
  const filterStatus = ref<HubFilterStatus>('all')
  const filterChannel = ref<HubFilterChannel>('all')
  const filterListing = ref<string[]>([])

  // Sorting (useState so all useReviewHub() instances share the same sort state)
  const sortBy = useState<HubSortKey>('review-hub-sort-by', () => 'checkout_date')
  const sortDir = useState<'asc' | 'desc'>('review-hub-sort-dir', () => 'desc')

  function setSort(key: HubSortKey) {
    if (sortBy.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    }
    else {
      sortBy.value = key
      sortDir.value = 'desc'
    }
  }

  // Unique listings from review records
  const uniqueListings = computed(() => {
    const map = new Map<string, string>()
    reviewRecords.value.forEach(r => map.set(r.listing_id, r.listing_name))
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  })

  // Enrich SOR with tag-derived signals when SOR data is sparse or missing
  function enrichSorFromTags(record: ReviewRecord, sor: StayOperationalRecord | null): StayOperationalRecord | null {
    if (!record.tags || record.tags.length === 0) return sor

    const negativeCleanTags = record.tags.filter(t =>
      t.startsWith('guest_review_host_negative_') && (
        t.includes('dirty') || t.includes('hair') || t.includes('stains') ||
        t.includes('smell') || t.includes('trash') || t.includes('messy_kitchen') ||
        t.includes('garbage')
      ),
    )

    const positiveCleanTags = record.tags.filter(t =>
      t.startsWith('guest_review_host_positive_') && (
        t.includes('spotless') || t.includes('pristine') || t.includes('clean') ||
        t.includes('free_of_clutter')
      ),
    )

    const negativeCommsTags = record.tags.filter(t =>
      t.startsWith('guest_review_host_negative_') && (
        t.includes('slow_to_respond') || t.includes('not_helpful') || t.includes('inconsiderate') ||
        t.includes('unresponsive_host')
      ),
    )

    const positiveCommsTags = record.tags.filter(t =>
      t.startsWith('guest_review_host_positive_') && (
        t.includes('always_responsive') || t.includes('responsive_host') || t.includes('proactive') ||
        t.includes('helpful_instructions') || t.includes('considerate')
      ),
    )

    const noiseTags = record.tags.filter(t =>
      t.includes('noisy') || t.includes('noise') || t.includes('quiet_hours'),
    )

    // Don't override existing SOR data, only enrich missing/null values
    const score = sor?.cleaning_score
    const commsScore = sor?.communication_score
    const hasExistingFlags = sor && sor.house_rule_flags.length > 0

    // Derive cleaning score from tags if missing
    let derivedCleaning: number | null = null
    if (negativeCleanTags.length > 0) derivedCleaning = negativeCleanTags.length >= 3 ? 2 : 3
    else if (positiveCleanTags.length > 0) derivedCleaning = positiveCleanTags.length >= 2 ? 5 : 4

    // Derive communication score from tags if missing
    let derivedComms: number | null = null
    if (negativeCommsTags.length > 0) derivedComms = negativeCommsTags.length >= 2 ? 2 : 3
    else if (positiveCommsTags.length > 0) derivedComms = positiveCommsTags.length >= 2 ? 5 : 4

    // Derive noise flag from tags
    const derivedFlags = noiseTags.length > 0 && !hasExistingFlags
      ? [{
          id: `tag-${record.id}`,
          reservation_id: record.reservation_id,
          type: 'noise' as const,
          severity: 'medium' as const,
          evidence_url: null,
          reported_by: 'guest_inbox' as const,
          reported_at: record.review_received_at ?? new Date().toISOString(),
          resolution_status: 'open' as const,
        }]
      : []

    if (score || commsScore || hasExistingFlags) {
      // Existing SOR exists — only fill gaps
      return {
        ...(sor!),
        ...(score ? {} : { cleaning_score: derivedCleaning }),
        ...(commsScore ? {} : { communication_score: derivedComms }),
        house_rule_flags: hasExistingFlags ? sor!.house_rule_flags : derivedFlags,
      }
    }

    // No SOR at all — create minimal enriched SOR
    if (derivedCleaning || derivedComms || derivedFlags.length > 0) {
      return {
        id: `tag-sor-${record.id}`,
        reservation_id: record.reservation_id,
        listing_id: record.listing_id,
        cleaning_score: score ?? derivedCleaning,
        cleaning_notes: null,
        cleaning_duration_delta: null,
        house_rule_flags: hasExistingFlags ? sor!.house_rule_flags : derivedFlags,
        communication_score: commsScore ?? derivedComms,
        communication_summary: null,
        computed_at: new Date().toISOString(),
      }
    }

    return sor
  }
  // Merge into feed items with tag enrichment
  const feedItems = computed<ReviewFeedItem[]>(() => {
    return reviewRecords.value.map((record) => {
      const sor = sorRecords.value.find(s => s.reservation_id === record.reservation_id) ?? null
      const hostReview = hostReviews.value.find((r: AutoReview) => r.reservation_id === record.reservation_id) ?? null
      const enrichedSor = enrichSorFromTags(record, sor)
      return {
        id: record.id,
        review_record: record,
        sor: enrichedSor,
        host_review: hostReview,
      }
    })
  })

  // Filtered feed items
  const filteredFeedItems = computed(() => {
    const result = feedItems.value.filter((item) => {
      const r = item.review_record

      if (filterStatus.value !== 'all' && getComputedStatus(r) !== filterStatus.value)
        return false
      if (filterChannel.value !== 'all' && r.source !== filterChannel.value)
        return false
      if (filterListing.value.length > 0 && !filterListing.value.includes('All Properties') && !filterListing.value.includes(r.listing_name))
        return false
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase()
        if (!r.guest_name.toLowerCase().includes(q) && !r.listing_name.toLowerCase().includes(q))
          return false
      }
      return true
    })

    const dir = sortDir.value === 'asc' ? 1 : -1
    const key = sortBy.value
    return result.sort((a, b) => {
      const ra = a.review_record
      const rb = b.review_record
      let cmp = 0
      if (key === 'checkout_date') {
        cmp = new Date(ra.checkout_date).getTime() - new Date(rb.checkout_date).getTime()
      }
      else if (key === 'guest_name') {
        cmp = ra.guest_name.localeCompare(rb.guest_name)
      }
      else if (key === 'rating') {
        cmp = (ra.guest_rating_overall ?? -1) - (rb.guest_rating_overall ?? -1)
      }
      else if (key === 'source') {
        cmp = ra.source.localeCompare(rb.source)
      }
      return cmp * dir
    })
  })

  // Stats
  function getComputedStatus(record: ReviewRecord): ReplyStatus {
    if (record.is_replied) return 'replied'

    // Host review not yet submitted + window still open = host_review_pending (takes priority)
    const hostReviewPending
      = (record.source === 'airbnb' && !record.host_review_id && getHostReviewCountdown(record.checkout_date, record.source) > 0)
      || (record.source === 'booking_com' && !record.host_review_id && getHostReviewCountdown(record.checkout_date, record.source) > 0)

    if (hostReviewPending) return 'host_review_pending'

    // Guest review visible and has content
    if (isGuestReviewVisible(record) && (record.guest_review_text || record.guest_rating_overall)) {
      return 'needs_reply'
    }

    return 'needs_reply'
  }

  const hubStats = computed(() => ({
    host_review_pending: reviewRecords.value.filter(r => getComputedStatus(r) === 'host_review_pending').length,
    needs_reply: reviewRecords.value.filter(r => getComputedStatus(r) === 'needs_reply').length,
    replied: reviewRecords.value.filter(r => getComputedStatus(r) === 'replied').length,
    total: reviewRecords.value.length,
  }))


  // Resolve the target language for translations from the Review Automation
  // config (same source as AI reply generation). One config point.
  function resolveTargetLang(): string {
    const { config } = useAirbnbReviews()
    return config.value?.host_language ?? 'en'
  }

  // Translate any text (mock) to the target language. Generic version used
  // for AI-generated drafts (reply, host review) which are not persisted on
  // the record — the caller keeps the translated text in local state.
  async function translateText(text: string): Promise<string> {
    if (!text) return ''
    const targetLang = resolveTargetLang()
    await new Promise(resolve => setTimeout(resolve, 700))
    return mockReviewTranslations[text] ?? mockTranslateFallback(text, targetLang)
  }

  // Rephrase any text (mock): swaps common words for synonyms so the draft
  // reads as "rewritten" without changing the meaning.
  async function rephraseText(text: string): Promise<string> {
    if (!text) return ''
    await new Promise(resolve => setTimeout(resolve, 900))

    const synonyms: [RegExp, string][] = [
      [/\bthank you\b/gi, 'many thanks'],
      [/\bwonderful\b/gi, 'marvelous'],
      [/\bdelighted\b/gi, 'thrilled'],
      [/\benjoyed\b/gi, 'loved'],
      [/\bappreciate\b/gi, 'value'],
      [/\bfeedback\b/gi, 'input'],
      [/\bhappy\b/gi, 'pleased'],
      [/\bgreat\b/gi, 'excellent'],
      [/\bsincerely apologize\b/gi, 'offer our sincere apologies'],
      [/\bissues\b/gi, 'concerns'],
      [/\bimproved\b/gi, 'enhanced'],
      [/\bwelcome\b/gi, 'invite'],
      [/\bhosting\b/gi, 'accommodating'],
      [/\bexperience\b/gi, 'stay'],
    ]

    let result = text
    for (const [pattern, replacement] of synonyms) {
      result = result.replace(pattern, replacement)
    }
    return result
  }

  // Translate the guest review text (mock). Persists on the record so a
  // review is only translated once per target language.
  async function translateReview(recordId: string): Promise<void> {
    const record = reviewRecords.value.find(r => r.id === recordId)
    if (!record || !record.guest_review_text) {
      if (record) updateReviewRecord(recordId, { translated_content: null, translation_language: null })
      return
    }

    // Already translated -> keep cached result.
    if (record.translated_content) return

    const targetLang = resolveTargetLang()
    // Nothing to translate when the review is already in the target language.
    if (record.language_detected === targetLang) {
      updateReviewRecord(recordId, { translated_content: null, translation_language: null })
      return
    }

    await new Promise(resolve => setTimeout(resolve, 700))

    const text = record.guest_review_text
    const translated = mockReviewTranslations[text] ?? mockTranslateFallback(text, targetLang)
    updateReviewRecord(recordId, {
      translated_content: translated,
      translation_language: targetLang,
    })
    toast.success('Review translated.')
  }

  // Update a review record
  function updateReviewRecord(id: string, patch: Partial<ReviewRecord>) {
    reviewRecords.value = reviewRecords.value.map(r =>
      r.id === id ? { ...r, ...patch, updated_at: new Date().toISOString() } : r,
    )
  }

  // Generate AI reply draft (mock)
  async function generateReplyDraft(recordId: string): Promise<string> {
    const record = reviewRecords.value.find(r => r.id === recordId)
    if (!record) return ''

    await new Promise(resolve => setTimeout(resolve, 1500))

    const firstName = record.guest_name.split(' ')[0]
    const sor = sorRecords.value.find(s => s.reservation_id === record.reservation_id)

    const positiveReplies = [
      `Thank you so much for your wonderful review, ${firstName}! We are thrilled to hear you enjoyed your stay. Our team works hard to maintain the property, and it means a lot when guests appreciate it. We hope to welcome you back soon!`,
      `${firstName}, thank you for taking the time to leave such a kind review! We are delighted that you had a great experience. Your feedback about our communication and the property condition really made our day. Looking forward to hosting you again!`,
      `We truly appreciate your feedback, ${firstName}! It was a pleasure hosting you. We are glad the property met your expectations and that our team could assist during your stay. Hope to see you again soon!`,
    ]

    const mixedReplies = [
      `Thank you for your honest feedback, ${firstName}. We appreciate you taking the time to share your experience. We have noted your comments and will work on the areas you mentioned. We hope to have the opportunity to host you again with an improved experience.`,
      `${firstName}, thank you for your review. We are glad you enjoyed some aspects of your stay. We take your feedback seriously and will address the concerns you raised. We would love the chance to welcome you back and show you the improvements.`,
    ]

    const negativeReplies = [
      `${firstName}, we sincerely apologize for the issues you experienced during your stay. This is not the standard we aim for. We have already taken steps to address the problems you mentioned. We would appreciate the opportunity to make it right - please don't hesitate to reach out to us directly.`,
      `Thank you for your candid feedback, ${firstName}. We are sorry to hear about the difficulties during your stay. We take all feedback seriously and have implemented corrective measures. We hope you might consider giving us another chance in the future.`,
    ]

    function pickRandom<T>(arr: T[]): T {
      return arr[Math.floor(Math.random() * arr.length)]!
    }

    let draft: string
    if (record.guest_rating_overall && record.guest_rating_overall >= 8) {
      draft = pickRandom(positiveReplies)
    } else if (record.guest_rating_overall && record.guest_rating_overall >= 6) {
      draft = pickRandom(mixedReplies)
    } else {
      draft = pickRandom(negativeReplies)
    }

    return draft
  }

  // Approve reply (post it)
  function approveReply(recordId: string, replyText: string) {
    updateReviewRecord(recordId, {
      reply_status: 'replied',
      reply_text: replyText,
      reply_posted_at: new Date().toISOString(),
      is_replied: true,
    })
    toast.success('Reply posted successfully.')
  }

  // Generate AI host review of guest (mock)
  async function generateHostReviewDraft(recordId: string): Promise<{ text: string, privateFeedback: string, ratings: { cleanliness: number, communication: number, respect_house_rules: number }, tags: string[] }> {
    const record = reviewRecords.value.find(r => r.id === recordId)
    if (!record) return { text: '', privateFeedback: '', ratings: { cleanliness: 5, communication: 5, respect_house_rules: 5 }, tags: [] }

    await new Promise(resolve => setTimeout(resolve, 1500))

    const firstName = record.guest_name.split(' ')[0]
    const sor = sorRecords.value.find(s => s.reservation_id === record.reservation_id)
    const isPublicOnly = record.source === 'booking_com'

    const cleanliness = sor?.cleaning_score ?? 4
    const communication = sor?.communication_score ?? 4
    const hasFlags = sor && sor.house_rule_flags.length > 0

    const positiveReviews = [
      `${firstName} was a wonderful guest! Communicated clearly throughout the stay and left the property in excellent condition. The housekeeping team confirmed everything was well-maintained. Highly recommend to other hosts!`,
      `Had a great experience hosting ${firstName}. Prompt communication, respectful of house rules, and the property was left tidy. Would happily welcome them back anytime.`,
    ]

    const mixedReviews = [
      `${firstName} was generally a good guest. Communication was fine and they followed most house rules. The property was left in acceptable condition, though the housekeeping team noted some minor items that needed extra attention. Would consider hosting again.`,
      `Good communication from ${firstName} throughout the booking. The stay went smoothly overall. Housekeeping noted minor wear but nothing concerning. Would host again with some reservations.`,
    ]

    const negativeReviews = [
      `${firstName}'s stay had some challenges. Communication was inconsistent and the housekeeping team noted several issues during turnover. There were house rule concerns that should be noted for future hosts.`,
    ]

    const positivePrivate = [
      'No concerns at all. Excellent guest in every aspect.',
      'Top-tier guest. Left the property almost as clean as they found it.',
      'Great experience. Would welcome back without hesitation.',
      'Very respectful of the property and neighbors. Zero issues.',
    ]

    const mixedPrivate = [
      'Minor issues noted during turnover. Not dealbreakers but worth noting for future hosts.',
      'Slightly noisier than expected in the evenings. No formal complaints but worth mentioning. Otherwise fine guests.',
      'Left a few personal items behind. Minor cleaning extra needed.',
    ]

    const negativePrivate = [
      'Multiple issues during stay. Housekeeping noted significant extra cleaning required. House rule violations documented.',
      'Challenging guest experience. Recommend caution for future bookings.',
    ]

    function pickRandom<T>(arr: T[]): T {
      return arr[Math.floor(Math.random() * arr.length)]!
    }

    let text: string
    let privateFeedback = ''
    if (cleanliness >= 4 && !hasFlags) {
      text = pickRandom(positiveReviews)
      if (!isPublicOnly) privateFeedback = pickRandom(positivePrivate)
    } else if (cleanliness >= 3) {
      text = pickRandom(mixedReviews)
      if (!isPublicOnly) privateFeedback = pickRandom(mixedPrivate)
    } else {
      text = pickRandom(negativeReviews)
      if (!isPublicOnly) privateFeedback = pickRandom(negativePrivate)
    }

    // Add SOR details to private feedback (Airbnb only)
    if (!isPublicOnly) {
      if (sor?.cleaning_notes) {
        privateFeedback += ` Cleaning notes: ${sor.cleaning_notes}`
      }
      if (hasFlags) {
        privateFeedback += ` House rule flags: ${sor!.house_rule_flags.map(f => f.type).join(', ')}.`
      }
    }

    // Derive host review tags from SOR
    const tags: string[] = []
    if (cleanliness >= 4 && !hasFlags) {
      tags.push('host_review_guest_positive_neat_and_tidy')
      tags.push('host_review_guest_positive_kept_in_good_condition')
      tags.push('host_review_guest_positive_respectful')
      tags.push('host_review_guest_positive_always_responded')
    } else if (cleanliness >= 3) {
      tags.push('host_review_guest_positive_neat_and_tidy')
      tags.push('host_review_guest_positive_always_responded')
      if (hasFlags) {
        tags.push('host_review_guest_negative_ignored_checkout_directions')
      }
    } else {
      if (cleanliness <= 2) {
        tags.push('host_review_guest_negative_messy_kitchen')
        tags.push('host_review_guest_negative_excessive_garbage')
      }
      if (hasFlags) {
        const flagTypes = sor!.house_rule_flags.map(f => f.type)
        if (flagTypes.includes('noise')) tags.push('host_review_guest_negative_did_not_respect_quiet_hours')
        if (flagTypes.includes('smoking')) tags.push('host_review_guest_negative_smoking')
        if (flagTypes.includes('damage')) tags.push('host_review_guest_negative_damage')
        if (flagTypes.includes('extra_guest')) tags.push('host_review_guest_negative_unapproved_guests')
      }
      if (communication <= 2) {
        tags.push('host_review_guest_negative_slow_responses')
      }
    }

    return {
      text,
      privateFeedback,
      ratings: {
        cleanliness: Math.min(5, Math.max(1, cleanliness)),
        communication: Math.min(5, Math.max(1, communication)),
        respect_house_rules: hasFlags ? Math.max(1, 5 - sor!.house_rule_flags.length) : 5,
      },
      tags,
    }
  }

  // Submit host review
  function submitHostReview(recordId: string, reviewText: string, ratings: { cleanliness: number, communication: number, respect_house_rules: number, privateFeedback: string } | null, isRecommended: boolean, tags: string[]) {
    const record = reviewRecords.value.find(r => r.id === recordId)
    if (!record) return
    const isPublicOnly = record.source === 'booking_com'
    updateReviewRecord(recordId, {
      private_feedback: ratings?.privateFeedback ?? null,
      host_review_id: `rev-${recordId.split('-')[1]}`,
      host_review_text: reviewText,
      host_review_ratings: ratings ? { cleanliness: ratings.cleanliness, communication: ratings.communication, respect_house_rules: ratings.respect_house_rules } : null,
      is_reviewee_recommended: isRecommended,
      host_review_tags: tags,
      is_hidden: false,
    })
    toast.success(isPublicOnly ? 'Booking.com review submitted.' : 'Host review submitted successfully.')
  }

  // Clear all filters
  function clearFilters() {
    searchQuery.value = ''
    filterStatus.value = 'all'
    filterChannel.value = 'all'
    filterListing.value = []
  }

  // Get SOR for a reservation
  function getSor(reservationId: string): StayOperationalRecord | null {
    return sorRecords.value.find(s => s.reservation_id === reservationId) ?? null
  }

  // Get unit info for a review record (returns null for single-unit listings or if no unit_id)
  function getUnitInfo(listingId: string, unitId: string | null): { unitName: string, unitTypeName: string } | null {
    if (!unitId) return null
    const listing = allListings.value.find(l => l.id === listingId)
    if (!listing) return null
    const unit = getUnitById(listing, unitId)
    if (!unit) return null
    const unitType = getUnitTypeForUnit(listing, unitId)
    if (!unitType) return null
    return { unitName: unit.name, unitTypeName: unitType.name }
  }

  // Get listing structure info for the property column ('multi' | 'single' | 'unknown')
  function getListingStructure(listingId: string): 'multi' | 'single' | 'unknown' {
    const listing = allListings.value.find(l => l.id === listingId)
    if (!listing) return 'unknown'
    if (listing.unitType === 'multi') {
      // Confirm there are actual unit types defined
      const unitTypes = listing.unitTypes ?? []
      if (unitTypes.length > 0) return 'multi'
    }
    return 'single'
  }

  // Get countdown days for host review window (Airbnb 14d, Booking.com 365d, Direct N/A)
  function getHostReviewCountdown(checkoutDate: string, source?: ReviewSource): number {
    const checkout = new Date(checkoutDate)
    const windowDays = source === 'booking_com' ? 365 : 14
    const deadline = new Date(checkout.getTime() + windowDays * 86400000)
    const now = new Date()
    const remaining = Math.ceil((deadline.getTime() - now.getTime()) / 86400000)
    return Math.max(0, remaining)
  }

  // Airbnb double-blind: Channex sets is_hidden=true until host submits their review
  // OR 14 days have passed since checkout (auto-reveal). We also check daysSinceCheckout
  // since Channex may not update is_hidden immediately after 14d auto-reveal.
  function isGuestReviewHidden(record: ReviewRecord): boolean {
    if (record.source !== 'airbnb') return false
    if (record.host_review_id) return false
    if (!record.is_hidden) return false
    const daysSinceCheckout = Math.ceil((Date.now() - new Date(record.checkout_date).getTime()) / 86400000)
    return daysSinceCheckout < 14
  }

  // Whether the guest review text/rating is currently visible (not double-blind hidden)
  function isGuestReviewVisible(record: ReviewRecord): boolean {
    return !isGuestReviewHidden(record)
  }

  // Reply window countdown: how many days left to reply to a visible guest review
  // Airbnb: ~14d blind + 30d reply = 44d from checkout
  // Booking.com: 30d from checkout
  function getReplyCountdown(checkoutDate: string, source: ReviewSource): number {
    const checkout = new Date(checkoutDate)
    const windowDays = source === 'airbnb' ? 44 : source === 'booking_com' ? 30 : 0
    if (windowDays === 0) return 0
    const deadline = new Date(checkout.getTime() + windowDays * 86400000)
    const now = new Date()
    const remaining = Math.ceil((deadline.getTime() - now.getTime()) / 86400000)
    return Math.max(0, remaining)
  }

  return {
    reviewRecords,
    sorRecords,
    feedItems,
    filteredFeedItems,
    hubStats,
    searchQuery,
    filterStatus,
    filterChannel,
    filterListing,
    sortBy,
    sortDir,
    setSort,
    uniqueListings,
    resolveTargetLang,
    translateText,
    rephraseText,
    translateReview,
    updateReviewRecord,
    generateReplyDraft,
    approveReply,
    generateHostReviewDraft,
    submitHostReview,
    clearFilters,
    getSor,
    getUnitInfo,
    getListingStructure,
    getHostReviewCountdown,
    isGuestReviewHidden,
    isGuestReviewVisible,
    getReplyCountdown,
    getComputedStatus,
  }
}
