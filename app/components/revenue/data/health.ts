/**
 * Listing Health Engine — types and fixture data.
 *
 * Fixtures only. The real engine (signal store, check registry, money model,
 * reconciler) is specified but not built — see PP-456…PP-459. Every value here
 * is shaped exactly like the eventual API payload so that wiring it up later is
 * a swap of this file, not a rewrite of the UI.
 */

/** Domains the engine audits. Pricing and restrictions are deep in V1. */
export type HealthDomain
  = | 'pricing' | 'restrictions' | 'market'
    | 'visibility' | 'commercial' | 'guest_experience' | 'operations'

export type HealthSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

/** The tenant chooses which basis ranks the portfolio. Both are always computed. */
export type ObjectiveBasis = 'revenue' | 'margin'

/**
 * Tenant-facing signal families. Deliberately NOT one per source — `market`
 * draws on the pricing provider and the market-data source, `demand` on the
 * market-data source and our own booking pace. A vendor is never named on a
 * data surface, because a claim usually spans several sources.
 */
export type SignalFamily
  = | 'market' | 'demand' | 'performance'
    | 'operations' | 'calendar' | 'benchmark'

export type SyncState = 'live' | 'partial' | 'paused' | 'degraded'

/**
 * Where a finding sits in the apply pipeline.
 *
 * `snapshot` comes first and is not bookkeeping: it captures the full prior
 * state of every field the write touches, which makes it both the undo and the
 * baseline the effect is later measured against. Nothing is written before it
 * exists.
 */
export type ApplyState
  = | 'idle' | 'snapshot' | 'saved' | 'written' | 'verified' | 'recomputed' | 'live'
    | 'recompute_unavailable' | 'push_failed' | 'stale'

export const domainLabels: Record<HealthDomain, string> = {
  pricing: 'Pricing & revenue',
  restrictions: 'Restrictions & stay mix',
  market: 'Market position',
  visibility: 'Visibility & conversion',
  commercial: 'Commercial posture',
  guest_experience: 'Guest experience',
  operations: 'Operations',
}

export const severityLabels: Record<HealthSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
}

export const familyLabels: Record<SignalFamily, string> = {
  market: 'Market',
  demand: 'Demand',
  performance: 'Performance',
  operations: 'Operations',
  calendar: 'Calendar',
  benchmark: 'Benchmark',
}

export const basisLabels: Record<ObjectiveBasis, string> = {
  revenue: 'Revenue',
  margin: 'Contribution margin',
}

/**
 * A banded estimate. The band is not decoration: a point estimate without one
 * invites false precision, and the ranking is only as good as its inputs.
 */
export interface MoneyEstimate {
  amount: number
  low: number
  high: number
  currency: string
  /** Margin basis only. False ⇒ the estimate rests on derived costs. */
  costInputsConfirmed?: boolean
}

export interface EvidenceItem {
  claim: string
  family: SignalFamily
  metric: string
  /** Human-readable age. Freshness is credibility, so it is always shown. */
  observedAt: string
}

export interface FieldChange {
  label: string
  from: string
  to: string
  /** Rendered as context rather than a change, so nothing surprises after apply. */
  unchanged?: boolean
}

export interface ConstraintNote {
  title: string
  body: string
  /** 0–100. Soft warning above 85, hard block at 100. */
  utilisation?: number
}

export interface HealthFinding {
  id: string
  roomId: string
  domain: HealthDomain
  severity: HealthSeverity
  headline: string
  windowLabel: string
  money: Record<ObjectiveBasis, MoneyEstimate>
  /** 0–1. Decays with horizon and with signal staleness. */
  confidence: number
  changes: FieldChange[]
  /** Required. A check that cannot argue its own counter-case is not ready. */
  supporting: EvidenceItem[]
  against: EvidenceItem[]
  unknowns: string[]
  constraint?: ConstraintNote
  agreement?: EvidenceItem
  checkKey: string
  checkVersion: number
  horizonBand: string
  expiresInDays: number
  autonomyBand: string
  acceptedCount: number
}

export interface HealthRoom {
  id: string
  name: string
  location: string
  syncState: SyncState
  /** Margin basis is de-confidenced while this is false. */
  costInputsConfirmed: boolean
  /** Excluded from auto-apply so realised uplift can be measured. */
  inHoldout: boolean
  /** Our realised ADR against the comparable-set median, in percent. */
  adrVsSet: number
  /** Realised ADR, 30 days — normalised 0–1 for the sparkline. */
  trend: number[]
  /** Comp-set median on the same scale, drawn as a reference line. */
  trendReference: number
}

export const healthRooms: HealthRoom[] = [
  { id: 'room-suryas-2', name: 'Villa Suryas · Room 2', location: 'Canggu · Pool View', syncState: 'live', costInputsConfirmed: true, inHoldout: false, adrVsSet: -12, trend: [0.18, 0.22, 0.2, 0.34, 0.42, 0.56, 0.72], trendReference: 0.62 },
  { id: 'room-uluwatu-1', name: 'Uluwatu Cliff House · Room 1', location: 'Uluwatu · Ocean Front', syncState: 'paused', costInputsConfirmed: true, inHoldout: false, adrVsSet: 4, trend: [0.72, 0.68, 0.74, 0.58, 0.44, 0.4, 0.3], trendReference: 0.55 },
  { id: 'room-padma-3', name: 'Villa Padma · Room 3', location: 'Seminyak · Garden', syncState: 'degraded', costInputsConfirmed: true, inHoldout: false, adrVsSet: 0, trend: [], trendReference: 0.5 },
  { id: 'room-canggu-loft-1', name: 'Canggu Loft · Room 1', location: 'Canggu · Studio', syncState: 'partial', costInputsConfirmed: false, inHoldout: false, adrVsSet: -7, trend: [0.3, 0.34, 0.32, 0.44, 0.46, 0.58, 0.64], trendReference: 0.7 },
  { id: 'room-bakti-2', name: 'Villa Bakti · Room 2', location: 'Ubud · Rice Field', syncState: 'live', costInputsConfirmed: true, inHoldout: true, adrVsSet: -1, trend: [0.44, 0.48, 0.46, 0.54, 0.5, 0.56, 0.58], trendReference: 0.57 },
  { id: 'room-seminyak-4', name: 'Seminyak Garden · Room 4', location: 'Seminyak · Twin', syncState: 'live', costInputsConfirmed: true, inHoldout: false, adrVsSet: 0, trend: [0.5, 0.48, 0.52, 0.5, 0.52, 0.5, 0.52], trendReference: 0.51 },
]

function usd(amount: number, low: number, high: number, confirmed?: boolean): MoneyEstimate {
  return { amount, low, high, currency: 'USD', costInputsConfirmed: confirmed }
}

export const healthFindings: HealthFinding[] = [
  {
    id: 'finding-1',
    roomId: 'room-suryas-2',
    domain: 'pricing',
    severity: 'high',
    headline: 'Base price sits 12% below your comparable set while pace runs ahead of last year',
    windowLabel: '8 Sep – 15 Oct',
    money: { revenue: usd(1640, 900, 2400), margin: usd(1180, 640, 1720, true) },
    confidence: 0.74,
    changes: [
      { label: 'Base price', from: '$182', to: '$205' },
      { label: 'Minimum stay · this window', from: '3 nights', to: '2 nights' },
      { label: 'Min price floor', from: '$150', to: '$150', unchanged: true },
    ],
    supporting: [
      { claim: 'Eight matched comparables sit at a $207 median for this window; we are at $182 with a review score 0.3 higher than the set.', family: 'market', metric: 'comp-set', observedAt: '14h ago' },
      { claim: '43% of September is on the books at 38 days out, against 31% at the same point last year, with ADR flat. Demand is ahead; price has not followed.', family: 'performance', metric: 'booking pace', observedAt: 'live' },
      { claim: 'Neighbourhood ADR is up 9% year on year for this window, and market occupancy is 68% against our 74% — we are outperforming on occupancy and underpricing to do it.', family: 'market', metric: 'neighbourhood', observedAt: '6h ago' },
      { claim: 'Forward visibility improved three positions for September stay-dates, and conversion is 4.1% against a 2.8% band for the set. High conversion at this price is headroom.', family: 'demand', metric: 'forward visibility', observedAt: '14h ago' },
    ],
    against: [
      { claim: 'Two of the eight comparables added free-cancellation promotions this week. At $205 with our stricter policy, conversion may fall further than the price gap alone suggests.', family: 'market', metric: 'promotions', observedAt: '14h ago' },
      { claim: 'Australian school holidays end 6 October. The last nine days of this window carry structurally weaker demand than the first twenty-eight, and a flat increase treats them alike.', family: 'calendar', metric: 'season', observedAt: 'curated' },
    ],
    unknowns: ['Search-view data for this property is five days stale, so the visibility conclusion rests on one channel alone.'],
    constraint: {
      title: 'Operations check — passed with a note',
      body: 'Minimum stay 3 → 2 adds four same-day turnovers in this window. Housekeeping capacity on those Saturdays reaches 82% of assigned hours. Within limits, but a fifth turnover would exceed it.',
      utilisation: 82,
    },
    agreement: { claim: 'Our market model, computed independently of the pace and position signals above, lands at $198. Both point up and the two are within 4%.', family: 'market', metric: 'market model', observedAt: 'independent of the signals above' },
    checkKey: 'pricing.base_below_compset',
    checkVersion: 3,
    horizonBand: '31–180 days · review-biased',
    expiresInDays: 4,
    autonomyBand: '±9%',
    acceptedCount: 14,
  },
  {
    id: 'finding-2',
    roomId: 'room-suryas-2',
    domain: 'restrictions',
    severity: 'high',
    headline: 'Two-night stays are margin-negative after turnover cost',
    windowLabel: 'Trailing 90 days',
    money: { revenue: usd(640, 300, 980), margin: usd(940, 520, 1360, true) },
    confidence: 0.81,
    changes: [
      { label: 'Minimum stay · default', from: '2 nights', to: '3 nights' },
      { label: 'Length-of-stay tier · 2 nights', from: '−0%', to: '+8%' },
    ],
    supporting: [
      { claim: 'Across 90 days, 14 two-night stays produced $2,380 revenue and $2,516 in turnover cost, commission and consumables — a negative contribution of $136.', family: 'operations', metric: 'contribution by stay length', observedAt: 'live' },
      { claim: 'Measured cleaning duration for this room is 2.4 hours, well above the 1.8h portfolio median for its size.', family: 'operations', metric: 'cleaning duration', observedAt: 'live' },
      { claim: 'Requests for three nights and longer outnumber two-night requests 4:1 in this window, so the demand exists to absorb the restriction.', family: 'demand', metric: 'request length mix', observedAt: '14h ago' },
    ],
    against: [
      { claim: 'Two-night stays fill 6 orphan gaps a quarter that would otherwise go unsold. Raising the minimum removes that filler unless the gap rule compensates.', family: 'performance', metric: 'orphan gaps', observedAt: 'live' },
    ],
    unknowns: ['Housekeeping hourly rate is a portfolio default, not a confirmed figure for this room — the cost side of this finding could move.'],
    constraint: {
      title: 'Operations check — capacity freed',
      body: 'Minimum stay 2 → 3 removes an estimated six turnovers a quarter, releasing roughly 14 housekeeping hours. No capacity risk.',
      utilisation: 54,
    },
    checkKey: 'restrictions.minstay_below_margin_floor',
    checkVersion: 2,
    horizonBand: '0–30 days · auto-apply eligible',
    expiresInDays: 6,
    autonomyBand: '±9%',
    acceptedCount: 14,
  },
  {
    id: 'finding-3',
    roomId: 'room-uluwatu-1',
    domain: 'pricing',
    severity: 'critical',
    headline: 'Base price has been changed outside Elev8 three times in seven days',
    windowLabel: 'Ongoing',
    money: { revenue: usd(0, 0, 0), margin: usd(0, 0, 0, true) },
    confidence: 0.95,
    changes: [
      { label: 'Base price · Elev8', from: '$340', to: '$340', unchanged: true },
      { label: 'Base price · pricing engine', from: '$340', to: '$312' },
    ],
    supporting: [
      { claim: 'Elev8 restored this value on 16, 19 and 21 September. Each time it was changed back within a day.', family: 'operations', metric: 'drift events', observedAt: 'live' },
      { claim: 'Automatic restoration has been suspended for this field to avoid fighting the change in a loop.', family: 'operations', metric: 'reconciler state', observedAt: 'live' },
    ],
    against: [
      { claim: 'The external value is 8% lower and this room is currently pacing ahead — the person making the change may be reacting to something the engine cannot see.', family: 'performance', metric: 'booking pace', observedAt: 'live' },
    ],
    unknowns: ['We cannot tell from here who is making the change. The provider activity log would name them.'],
    checkKey: 'ops.repeated_drift',
    checkVersion: 1,
    horizonBand: 'n/a',
    expiresInDays: 14,
    autonomyBand: 'suspended',
    acceptedCount: 6,
  },
  {
    id: 'finding-4',
    roomId: 'room-uluwatu-1',
    domain: 'market',
    severity: 'high',
    headline: 'Ceiling is truncating three demonstrable peak dates',
    windowLabel: '12 – 14 Sep',
    money: { revenue: usd(540, 280, 810), margin: usd(470, 240, 700, true) },
    confidence: 0.69,
    changes: [{ label: 'Max price', from: '$420', to: '$480' }],
    supporting: [
      { claim: 'Three dates in this window resolve at the ceiling. Comparable peak rates for the same dates sit between $455 and $510.', family: 'market', metric: 'comp-set peak', observedAt: '14h ago' },
      { claim: 'All three dates are inside a local event window already flagged in the season calendar.', family: 'calendar', metric: 'event pressure', observedAt: 'curated' },
    ],
    against: [
      { claim: 'The room is already 91% booked for the window. The remaining nights may not convert at a higher rate this close in.', family: 'performance', metric: 'occupancy on the books', observedAt: 'live' },
    ],
    unknowns: ['Comp-set coverage for these specific dates is four properties, not eight — a thinner basis than usual.'],
    checkKey: 'pricing.ceiling_suppressing_peak',
    checkVersion: 2,
    horizonBand: '0–30 days · auto-apply eligible',
    expiresInDays: 2,
    autonomyBand: '±6%',
    acceptedCount: 6,
  },
  {
    id: 'finding-5',
    roomId: 'room-padma-3',
    domain: 'operations',
    severity: 'critical',
    headline: 'Guests are seeing prices that are two days out of date',
    windowLabel: 'Next 60 days',
    money: { revenue: usd(0, 0, 0), margin: usd(0, 0, 0, true) },
    confidence: 1,
    changes: [{ label: 'Integration credentials', from: 'Rejected', to: 'Reconnect required' }],
    supporting: [
      { claim: 'The pricing engine rejected our credentials 51 hours ago. Prices are being held at their last known values.', family: 'operations', metric: 'sync state', observedAt: 'live' },
      { claim: 'Fifty-one of the next sixty nights are unsold at a rate the market has since moved away from.', family: 'market', metric: 'market ADR drift', observedAt: '6h ago' },
    ],
    against: [],
    unknowns: ['Whether the key was revoked deliberately or expired. Reconnecting will tell us.'],
    checkKey: 'ops.provider_prices_stale',
    checkVersion: 1,
    horizonBand: 'n/a',
    expiresInDays: 30,
    autonomyBand: 'n/a',
    acceptedCount: 0,
  },
  {
    id: 'finding-6',
    roomId: 'room-canggu-loft-1',
    domain: 'restrictions',
    severity: 'high',
    headline: 'Orphan gaps are being left at the standard rate',
    windowLabel: 'Next 45 days',
    money: { revenue: usd(820, 420, 1240), margin: usd(610, 300, 940, false) },
    confidence: 0.66,
    changes: [
      { label: 'Orphan gap rule', from: 'Off', to: 'Gaps ≤ 2 nights · −18%' },
      { label: 'Minimum stay on gap nights', from: '2 nights', to: '1 night' },
    ],
    supporting: [
      { claim: 'Seven single-night and two-night gaps sit in the next 45 days, all priced at the standard rate and all currently unsold.', family: 'performance', metric: 'orphan gaps', observedAt: 'live' },
      { claim: 'Comparable studios in the area clear equivalent gaps at 15–22% below their standard rate.', family: 'market', metric: 'comp-set gap pricing', observedAt: '14h ago' },
    ],
    against: [
      { claim: 'Gap discounts on a studio at this price point move the room close to the floor, which leaves little room for a last-minute adjustment on top.', family: 'market', metric: 'price band', observedAt: '14h ago' },
    ],
    unknowns: ['Cleaning cost for this room is derived, not confirmed, so the margin figure is an estimate.'],
    constraint: {
      title: 'Operations check — passed',
      body: 'Filling seven gap nights adds up to seven turnovers spread across six weeks. Housekeeping utilisation stays at 61%.',
      utilisation: 61,
    },
    checkKey: 'restrictions.orphan_gaps_unpriced',
    checkVersion: 3,
    horizonBand: '0–30 days · auto-apply eligible',
    expiresInDays: 5,
    autonomyBand: '±4%',
    acceptedCount: 3,
  },
  {
    id: 'finding-7',
    roomId: 'room-bakti-2',
    domain: 'visibility',
    severity: 'high',
    headline: 'Forward visibility is falling for dates that are still unsold',
    windowLabel: 'Next 28 days',
    money: { revenue: usd(610, 290, 940), margin: usd(520, 240, 810, true) },
    confidence: 0.58,
    changes: [{ label: 'Recommended action', from: '—', to: 'Review content and rate together' }],
    supporting: [
      { claim: 'Forward ranking for this listing dropped five positions over eleven days across the next four weeks of stay-dates.', family: 'demand', metric: 'forward visibility', observedAt: '14h ago' },
      { claim: 'Nineteen of the next twenty-eight nights are unsold — the decline is hitting inventory we still need to move.', family: 'performance', metric: 'occupancy on the books', observedAt: 'live' },
    ],
    against: [
      { claim: 'This room is in the measurement holdout, so no automatic change has been applied and the decline is not a consequence of our own pricing.', family: 'performance', metric: 'holdout membership', observedAt: 'live' },
    ],
    unknowns: [
      'Whether the drop is content, rate or a channel-side ranking change. The forward series shows the effect, not the cause.',
      'Search-view data for the equivalent channel is not available for this listing.',
    ],
    checkKey: 'visibility.forward_ranking_collapse',
    checkVersion: 1,
    horizonBand: '0–30 days · review always',
    expiresInDays: 3,
    autonomyBand: 'holdout',
    acceptedCount: 0,
  },
  {
    id: 'finding-8',
    roomId: 'room-seminyak-4',
    domain: 'commercial',
    severity: 'low',
    headline: 'Comparable listings are running promotions and this room is not',
    windowLabel: 'Next 30 days',
    money: { revenue: usd(240, 90, 420), margin: usd(180, 60, 320, true) },
    confidence: 0.52,
    changes: [{ label: 'Recommended action', from: '—', to: 'Consider a limited promotion' }],
    supporting: [
      { claim: 'Five of nine comparables have an active promotion; this room has had none for 60 days.', family: 'market', metric: 'promotions', observedAt: '14h ago' },
    ],
    against: [
      { claim: 'Conversion is within the comp-set band despite no promotion, so the absence is not visibly costing bookings yet.', family: 'demand', metric: 'conversion', observedAt: '14h ago' },
      { claim: 'The policy already carries a weekly discount. A promotion on top would stack below the intended net rate.', family: 'market', metric: 'net rate', observedAt: 'live' },
    ],
    unknowns: ['Promotion performance for the comparables is not available — we can see that they run one, not whether it works.'],
    checkKey: 'commercial.no_promo_while_market_promotes',
    checkVersion: 1,
    horizonBand: '0–30 days · review-biased',
    expiresInDays: 9,
    autonomyBand: '±3%',
    acceptedCount: 1,
  },
]

/** Portfolio-level measurement, shown on the dashboard. */
export const healthSummary = {
  roomsTotal: 46,
  roomsInSync: 45,
  appliedThisWeek: 14,
  appliedAutomatically: 9,
  upliftPercent: 3.1,
  upliftRoomsMeasured: 42,
  lastCheckLabel: 'Today 04:12',
}
