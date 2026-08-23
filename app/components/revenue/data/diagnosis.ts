/**
 * Diagnosis payload — the evidence a finding rests on, per room.
 *
 * Sibling to `health.ts` on purpose: findings and their diagnosis arrive from
 * different services, so they swap independently when the engine is wired up.
 *
 * Two rules this file encodes, both of which are easy to lose later:
 *
 * 1. VISIBILITY BEFORE PRICE. The funnel is a gate, not a metric. The first
 *    stage that fails decides which finding may be raised; everything
 *    downstream is held. A listing that is shown and not clicked does not have
 *    a price problem, and a price recommendation for it would be wrong.
 *
 * 2. THE COHORT IS THE YARDSTICK, NOT THE MARKET. No provider sells competitor
 *    funnel data — that would be someone else's extranet. So "healthy" is
 *    measured against our own cohort (same location type, same bedroom band)
 *    and, once enough history is archived, against the room's own past. The UI
 *    says "cohort" and never "market", because the difference is real.
 *
 * Funnel and comp-set figures below are shaped exactly like the observed API
 * payloads, and the Bali rooms carry values measured on the live account.
 */

import type { HealthDomain, ObjectiveBasis } from './health'

/* ------------------------------------------------------------------ contract */

/**
 * The owner contract decides what the engine optimises. This is NOT a tenant
 * preference: on a guaranteed-rent room every margin gain belongs to us, on a
 * gross-share room optimising margin works against our own fee. Same field
 * also decides whether the owner may see the cost side — only a net-share
 * owner has a contractual claim to verify a deduction.
 */
export type ContractType = 'guaranteed_rent' | 'net_share' | 'fixed_fee' | 'gross_share'

export const contractLabels: Record<ContractType, string> = {
  guaranteed_rent: 'Guaranteed rent',
  net_share: '% of net',
  fixed_fee: 'Fixed fee',
  gross_share: '% of gross',
}

/** Objective is derived, never chosen. */
export function objectiveForContract(contract: ContractType): ObjectiveBasis {
  return contract === 'gross_share' ? 'revenue' : 'margin'
}

/** True only where the owner can be asked to verify a cost deduction. */
export function ownerSeesCost(contract: ContractType): boolean {
  return contract === 'net_share'
}

/** Shown on the card when the contract and the better objective disagree. */
export function objectiveConflict(contract: ContractType): string | undefined {
  if (contract !== 'gross_share')
    return undefined
  return 'This contract pays on gross revenue, so the engine ranks on revenue here. Optimised on contribution margin the recommendation would differ.'
}

/* ---------------------------------------------------------------------- gate */

export type GateStage = 'impressions' | 'ctr' | 'conversion' | 'price'

export const gateStageLabels: Record<GateStage, string> = {
  impressions: 'Impressions',
  ctr: 'Click rate',
  conversion: 'Conversion',
  price: 'Price position',
}

/**
 * Which domain owns a failing stage. The portfolio table's "worst domain"
 * is derived from this rather than set by hand — the first gate to fail *is*
 * the worst domain, which turns a label into a statement.
 */
export const gateStageDomain: Record<GateStage, HealthDomain> = {
  impressions: 'restrictions',
  ctr: 'visibility',
  conversion: 'visibility',
  price: 'pricing',
}

export type GateVerdict = 'healthy' | 'failing' | 'unknown'

export interface GateState {
  /** Verdict per stage, in funnel order. */
  stages: { stage: GateStage, verdict: GateVerdict, note?: string }[]
  /** First stage that fails, if any. Decides what may be raised. */
  firstFailing?: GateStage
  /** Plain sentence for the operator: what is released and what waits. */
  releasedNote: string
  /** Which yardstick the verdicts used. */
  benchmark: 'cohort' | 'own_history'
  cohortSize: number
}

/* -------------------------------------------------------------------- funnel */

export type FunnelChannel = 'booking' | 'airbnb'

export const funnelChannelLabels: Record<FunnelChannel, string> = {
  booking: 'Booking.com',
  airbnb: 'Airbnb',
}

export interface FunnelStageValue {
  /** Rate as a fraction, or null when the stage cannot be measured yet. */
  rate: number | null
  cohortRate: number | null
  /** Absolute count behind the rate — small denominators are marked, not hidden. */
  count: number
}

export interface ChannelFunnel {
  channel: FunnelChannel
  /**
   * Booking counts backwards over a trailing window; Airbnb reports forward
   * per stay date. The two are never compared — only each against its cohort.
   */
  direction: 'trailing' | 'forward'
  windowLabel: string
  impressions: number
  view: FunnelStageValue
  booking: FunnelStageValue
  /**
   * False where the forward window is shorter than the booking window, which
   * is the normal case in a 0–9 day market. A zero there is not a red flag,
   * it is an unmeasurable stage — and it renders as such.
   */
  bookingMeasurable: boolean
  unmeasurableReason?: string
  /** Below this the rate is greyed and labelled thin. */
  thinData: boolean
  observedAt: string
}

/* ------------------------------------------------------------------- compset */

/** Named competitors: answers "against whom", with the match reasoning. */
export interface CompsetCompetitor {
  name: string
  distanceKm: number
  score: number
  adrDeltaPercent: number
  reviewScore: number | null
  reviewCount: number
}

export interface MdvCompset {
  tracked: number
  competitors: CompsetCompetitor[]
  /** How the match is weighted, in percent. Shown because it explains the set. */
  weights: { label: string, weight: number }[]
  ourReviewScore: number | null
  ourReviewCount: number
  observedAt: string
}

/** Panel view: answers "how the market stands", per date. */
export interface MarketPosition {
  percentile: number
  windowLabel: string
  marketOccupancy: number
  occupancyStly: number | null
  availableListings: number
  supplyDeltaPercent: number
  panelSize: number
  bandLabel: string
  observedAt: string
}

/* ------------------------------------------------------------------- posture */

export interface Programme {
  label: string
  detail?: string
  active: boolean
}

export interface Posture {
  /**
   * The stack multiplies rather than adds: discounts cut what the guest pays,
   * commissions take a share of what is left. Nobody computes this today
   * because every position lives in a different screen.
   */
  effectiveTakeRate: number
  commissionPct: number
  contributors: string[]
  programmes: Programme[]
  /** No comparison to the set: competitor programme settings are not sold. */
  cohortTakeRate: number | null
  observedAt: string
}

/* -------------------------------------------------------------------- margin */

export interface ChannelFee {
  channel: FunnelChannel
  cleaningFee: number
  /** Positive when the fee does not cover the turnover cost on that channel. */
  shortfall: number
}

export interface MarginBlock {
  currency: string
  costPerTurnover: number
  costState: 'measured' | 'estimated'
  /** Share of cleanings in the window with recorded time. */
  trackedCleanings: number
  totalCleanings: number
  fees: ChannelFee[]
  /** Accounting components arrive with month-end, so they lag by design. */
  accountingAsOf: string
  observedAt: string
}

/* ---------------------------------------------------------------- freshness */

/** One stamp per element, because a single "last check" hides real spread. */
export interface FreshnessItem {
  label: string
  observedAt: string
}

/* --------------------------------------------------------------- diagnosis */

export interface RoomDiagnosis {
  roomId: string
  contract: ContractType
  gate: GateState
  funnels: ChannelFunnel[]
  compset: MdvCompset
  market: MarketPosition
  posture: Posture
  margin: MarginBlock
  freshness: FreshnessItem[]
}

/** Rejection is a first-class outcome, and the reason is what makes it useful. */
export type RejectionReason
  = | 'too_aggressive' | 'diagnosis_wrong' | 'not_now'
    | 'owner_forbids' | 'not_operable' | 'wrong_lever'

export const rejectionLabels: Record<RejectionReason, string> = {
  too_aggressive: 'Too aggressive',
  diagnosis_wrong: 'Diagnosis is wrong',
  not_now: 'Not now — ask again later',
  owner_forbids: 'Owner does not allow this',
  not_operable: 'Not operationally possible',
  wrong_lever: 'A different lever would be right',
}

/** What each reason changes. Shown so the operator knows a reason is not a bin. */
export const rejectionEffects: Record<RejectionReason, string> = {
  too_aggressive: 'Lowers the ceiling for this lever on this room.',
  diagnosis_wrong: 'Flags the evidence for review — the most useful answer.',
  not_now: 'Cooldown only. Not counted against the finding.',
  owner_forbids: 'Belongs on the contract as a limit; we will suggest recording it.',
  not_operable: 'Points at a capacity limit the optimiser did not know.',
  wrong_lever: 'Feeds straight back into how the lever is chosen.',
}

const COMPSET_WEIGHTS = [
  { label: 'Availability', weight: 31 },
  { label: 'ADR', weight: 24 },
  { label: 'Rating', weight: 18 },
  { label: 'Rank', weight: 13 },
  { label: 'Distance', weight: 11 },
  { label: 'Review count', weight: 3 },
]

function rate(count: number, of: number): number {
  return of === 0 ? 0 : count / of
}

/**
 * Fixtures. Funnel and comp-set values on the Canggu and Ubud rooms are the
 * figures observed on the live account: Booking click rates spread 0.35–0.75%
 * while conversion barely moves, and Airbnb click rates spread 1.53–8.52%.
 * The listing with the MOST impressions has the WORST click rate — which is
 * exactly the case a price recommendation would get wrong.
 */
export const roomDiagnoses: RoomDiagnosis[] = [
  {
    roomId: 'room-suryas-2',
    contract: 'guaranteed_rent',
    gate: {
      stages: [
        { stage: 'impressions', verdict: 'healthy' },
        { stage: 'ctr', verdict: 'healthy', note: '23% above cohort' },
        { stage: 'conversion', verdict: 'failing', note: '14% below cohort' },
        { stage: 'price', verdict: 'failing', note: '12% under the set' },
      ],
      firstFailing: 'conversion',
      releasedNote: 'Visibility holds, so the price finding is released. One fee finding is queued behind the conversion gap.',
      benchmark: 'cohort',
      cohortSize: 7,
    },
    funnels: [
      {
        channel: 'booking',
        direction: 'trailing',
        windowLabel: 'Trailing window',
        impressions: 99014,
        view: { rate: rate(743, 99014), cohortRate: 0.0061, count: 743 },
        booking: { rate: rate(5, 743), cohortRate: 0.0078, count: 5 },
        bookingMeasurable: true,
        thinData: false,
        observedAt: '7h ago',
      },
      {
        channel: 'airbnb',
        direction: 'forward',
        windowLabel: 'Forward 28 days',
        impressions: 2560,
        view: { rate: rate(218, 2560), cohortRate: 0.069, count: 218 },
        booking: { rate: null, cohortRate: null, count: 0 },
        bookingMeasurable: false,
        unmeasurableReason: 'Booking window here is 0–9 days, so a forward window cannot show conversion yet.',
        thinData: false,
        observedAt: '7h ago',
      },
    ],
    compset: {
      tracked: 10,
      competitors: [
        { name: 'Villa Balika 1', distanceKm: 0.32, score: 82, adrDeltaPercent: 6, reviewScore: null, reviewCount: 0 },
        { name: 'Villa Kayu Canggu', distanceKm: 0.51, score: 79, adrDeltaPercent: 14, reviewScore: 8.9, reviewCount: 62 },
        { name: 'Casa Pererenan', distanceKm: 0.88, score: 74, adrDeltaPercent: -3, reviewScore: 9.2, reviewCount: 114 },
      ],
      weights: COMPSET_WEIGHTS,
      ourReviewScore: 10,
      ourReviewCount: 1,
      observedAt: '1d ago',
    },
    market: {
      percentile: 38,
      windowLabel: '8 Sep – 15 Oct',
      marketOccupancy: 0.63,
      occupancyStly: 0.87,
      availableListings: 164,
      supplyDeltaPercent: 11,
      panelSize: 350,
      bandLabel: '2-bedroom band',
      observedAt: '4h ago',
    },
    posture: {
      effectiveTakeRate: 0.234,
      commissionPct: 0.15,
      contributors: ['commission 15%', 'Genius', 'Visibility Booster 4%', 'mobile discount 10%'],
      programmes: [
        { label: 'Genius', active: true },
        { label: 'Visibility Booster', detail: '4%', active: true },
        { label: 'Mobile discount', detail: '10%', active: true },
        { label: 'Preferred', active: false },
        { label: 'Loyalty', active: false },
      ],
      cohortTakeRate: 0.208,
      observedAt: '7h ago',
    },
    margin: {
      currency: 'IDR',
      costPerTurnover: 412000,
      costState: 'measured',
      trackedCleanings: 14,
      totalCleanings: 16,
      fees: [
        { channel: 'airbnb', cleaningFee: 350000, shortfall: 62000 },
        { channel: 'booking', cleaningFee: 250000, shortfall: 162000 },
      ],
      accountingAsOf: 'last closed month',
      observedAt: 'live',
    },
    freshness: [
      { label: 'Funnel', observedAt: '7h ago' },
      { label: 'Comp-set', observedAt: '1d ago' },
      { label: 'Market panel', observedAt: '4h ago' },
      { label: 'Cost basis', observedAt: 'last closed month' },
    ],
  },

  {
    roomId: 'room-bakti-2',
    contract: 'net_share',
    gate: {
      stages: [
        { stage: 'impressions', verdict: 'healthy' },
        { stage: 'ctr', verdict: 'failing', note: '78% below cohort' },
        { stage: 'conversion', verdict: 'unknown', note: 'held behind the click rate' },
        { stage: 'price', verdict: 'unknown', note: 'held behind the click rate' },
      ],
      firstFailing: 'ctr',
      releasedNote: 'Shown often and clicked rarely — the price finding is held. One review-depth finding is released instead.',
      benchmark: 'cohort',
      cohortSize: 6,
    },
    funnels: [
      {
        channel: 'booking',
        direction: 'trailing',
        windowLabel: 'Trailing window',
        impressions: 67777,
        view: { rate: rate(237, 67777), cohortRate: 0.0061, count: 237 },
        booking: { rate: rate(2, 237), cohortRate: 0.0078, count: 2 },
        bookingMeasurable: true,
        thinData: true,
        observedAt: '7h ago',
      },
      {
        channel: 'airbnb',
        direction: 'forward',
        windowLabel: 'Forward 28 days',
        impressions: 4260,
        view: { rate: rate(65, 4260), cohortRate: 0.069, count: 65 },
        booking: { rate: null, cohortRate: null, count: 0 },
        bookingMeasurable: false,
        unmeasurableReason: 'Booking window here is 0–9 days, so a forward window cannot show conversion yet.',
        thinData: false,
        observedAt: '7h ago',
      },
    ],
    compset: {
      tracked: 10,
      competitors: [
        { name: 'Ubud Rice Terrace Villa', distanceKm: 0.41, score: 84, adrDeltaPercent: -2, reviewScore: 9.4, reviewCount: 208 },
        { name: 'Green Valley Retreat', distanceKm: 0.62, score: 77, adrDeltaPercent: 9, reviewScore: 9.1, reviewCount: 96 },
        { name: 'Sawah House', distanceKm: 1.10, score: 71, adrDeltaPercent: -8, reviewScore: 8.6, reviewCount: 41 },
      ],
      weights: COMPSET_WEIGHTS,
      ourReviewScore: 9.6,
      ourReviewCount: 3,
      observedAt: '1d ago',
    },
    market: {
      percentile: 54,
      windowLabel: 'Next 28 days',
      marketOccupancy: 0.71,
      occupancyStly: 0.74,
      availableListings: 118,
      supplyDeltaPercent: 4,
      panelSize: 350,
      bandLabel: '1-bedroom band',
      observedAt: '4h ago',
    },
    posture: {
      effectiveTakeRate: 0.176,
      commissionPct: 0.12,
      contributors: ['commission 12%', 'mobile discount 10%'],
      programmes: [
        { label: 'Genius', active: false },
        { label: 'Visibility Booster', active: false },
        { label: 'Mobile discount', detail: '10%', active: true },
        { label: 'Preferred', active: false },
        { label: 'Loyalty', active: false },
      ],
      cohortTakeRate: 0.208,
      observedAt: '7h ago',
    },
    margin: {
      currency: 'IDR',
      costPerTurnover: 268000,
      costState: 'measured',
      trackedCleanings: 11,
      totalCleanings: 12,
      fees: [
        { channel: 'airbnb', cleaningFee: 300000, shortfall: 0 },
        { channel: 'booking', cleaningFee: 300000, shortfall: 0 },
      ],
      accountingAsOf: 'last closed month',
      observedAt: 'live',
    },
    freshness: [
      { label: 'Funnel', observedAt: '7h ago' },
      { label: 'Comp-set', observedAt: '1d ago' },
      { label: 'Market panel', observedAt: '4h ago' },
      { label: 'Cost basis', observedAt: 'last closed month' },
    ],
  },

  {
    roomId: 'room-canggu-loft-1',
    contract: 'gross_share',
    gate: {
      stages: [
        { stage: 'impressions', verdict: 'healthy' },
        { stage: 'ctr', verdict: 'healthy', note: '20% above cohort' },
        { stage: 'conversion', verdict: 'healthy' },
        { stage: 'price', verdict: 'failing', note: '7% under the set' },
      ],
      firstFailing: 'price',
      releasedNote: 'All three visibility gates hold, so this is a genuine price and restriction case.',
      benchmark: 'cohort',
      cohortSize: 7,
    },
    funnels: [
      {
        channel: 'booking',
        direction: 'trailing',
        windowLabel: 'Trailing window',
        impressions: 87809,
        view: { rate: rate(612, 87809), cohortRate: 0.0061, count: 612 },
        booking: { rate: rate(5, 612), cohortRate: 0.0078, count: 5 },
        bookingMeasurable: true,
        thinData: false,
        observedAt: '7h ago',
      },
      {
        channel: 'airbnb',
        direction: 'forward',
        windowLabel: 'Forward 28 days',
        impressions: 810,
        view: { rate: rate(67, 810), cohortRate: 0.069, count: 67 },
        booking: { rate: null, cohortRate: null, count: 0 },
        bookingMeasurable: false,
        unmeasurableReason: 'Booking window here is 0–9 days, so a forward window cannot show conversion yet.',
        thinData: true,
        observedAt: '7h ago',
      },
    ],
    compset: {
      tracked: 9,
      competitors: [
        { name: 'Batu Bolong Studio', distanceKm: 0.28, score: 80, adrDeltaPercent: 5, reviewScore: 8.8, reviewCount: 74 },
        { name: 'Loft Pantai', distanceKm: 0.44, score: 76, adrDeltaPercent: 11, reviewScore: 9.0, reviewCount: 51 },
        { name: 'Studio Berawa', distanceKm: 0.95, score: 69, adrDeltaPercent: -6, reviewScore: 8.4, reviewCount: 133 },
      ],
      weights: COMPSET_WEIGHTS,
      ourReviewScore: 9.1,
      ourReviewCount: 27,
      observedAt: '1d ago',
    },
    market: {
      percentile: 44,
      windowLabel: 'Next 45 days',
      marketOccupancy: 0.66,
      occupancyStly: 0.79,
      availableListings: 201,
      supplyDeltaPercent: 14,
      panelSize: 350,
      bandLabel: 'Studio band',
      observedAt: '4h ago',
    },
    posture: {
      effectiveTakeRate: 0.219,
      commissionPct: 0.15,
      contributors: ['commission 15%', 'Genius', 'weekly discount'],
      programmes: [
        { label: 'Genius', active: true },
        { label: 'Visibility Booster', active: false },
        { label: 'Mobile discount', active: false },
        { label: 'Preferred', active: false },
        { label: 'Weekly discount', detail: '−8%', active: true },
      ],
      cohortTakeRate: 0.208,
      observedAt: '7h ago',
    },
    margin: {
      currency: 'IDR',
      costPerTurnover: 196000,
      costState: 'estimated',
      trackedCleanings: 4,
      totalCleanings: 13,
      fees: [
        { channel: 'airbnb', cleaningFee: 180000, shortfall: 16000 },
        { channel: 'booking', cleaningFee: 200000, shortfall: 0 },
      ],
      accountingAsOf: 'last closed month',
      observedAt: 'live',
    },
    freshness: [
      { label: 'Funnel', observedAt: '7h ago' },
      { label: 'Comp-set', observedAt: '1d ago' },
      { label: 'Market panel', observedAt: '4h ago' },
      { label: 'Cost basis', observedAt: 'estimated · 4 of 13 tracked' },
    ],
  },
]

/**
 * Rooms a check could not reach. Without this, a portfolio with eight findings
 * reads as healthy while a dozen rooms were never assessed. The live ranking
 * feed returns 47 rows against 62 connected listings, so this is not
 * hypothetical.
 */
export const notAssessableRooms: { roomId: string, name: string, missing: string }[] = [
  { roomId: 'room-uluwatu-2', name: 'Uluwatu Cliff House · Room 2', missing: 'no ranking data on either channel' },
  { roomId: 'room-padma-1', name: 'Villa Padma · Room 1', missing: 'comp-set not resolved' },
  { roomId: 'room-sanur-3', name: 'Sanur Beach House · Room 3', missing: 'location not resolved to official codes' },
  { roomId: 'room-tabanan-1', name: 'Tabanan Villa · Room 1', missing: 'no ranking data on either channel' },
]

export function diagnosisFor(roomId: string): RoomDiagnosis | undefined {
  return roomDiagnoses.find(entry => entry.roomId === roomId)
}
