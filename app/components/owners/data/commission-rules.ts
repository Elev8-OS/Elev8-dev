// Commission rules — how the management company charges the owner for
// handling their listing. Each rule is scoped to a single (owner, listing)
// pair so it can be edited independently for shared properties.
//
// Three flavours are supported:
//   - flat:     a single percentage of revenue.
//   - tiered:   a marginal rate (e.g. 20% on the first 1,000 USD, 12% above).
//   - hybrid:   a fixed management fee plus a percentage of revenue.

export interface CommissionTier {
  /** Inclusive upper bound of this tier in the listing's statement currency. `null` = open-ended top tier. */
  upTo: number | null
  /** Percentage applied to revenue within this tier (0–100). */
  rate: number
}

interface CommissionRuleBase {
  id: string
  ownerId: string
  listingId: string
  name: string
  effectiveFrom: string
  effectiveTo?: string
}

export type CommissionRule
  = | (CommissionRuleBase & { type: 'flat', rate: number })
    | (CommissionRuleBase & { type: 'tiered', tiers: CommissionTier[] })
    | (CommissionRuleBase & { type: 'hybrid', fixedAmount: number, rate: number })

export type CommissionRuleDraft
  = CommissionRule extends infer Rule
    ? Rule extends CommissionRule
      ? Omit<Rule, 'id' | 'ownerId'>
      : never
    : never

// --- Pure calculation helpers ----------------------------------------------
//
// `rate` is a percentage (0–100) throughout the domain — see the fixtures
// below (cr-1 `rate: 20` = 20%) and the statement fixtures they feed. The
// helpers divide by 100 internally so callers pass rules straight from the
// stored `CommissionRule` shape.

/**
 * The minimal shape needed to compute a commission, derived from `CommissionRule`
 * so callers can pass a live rule or a lightweight literal (e.g. a draft in a form).
 */
export type CommissionCalculationRule
  = | Pick<Extract<CommissionRule, { type: 'flat' }>, 'type' | 'rate'>
    | Pick<Extract<CommissionRule, { type: 'tiered' }>, 'type' | 'tiers'>
    | Pick<Extract<CommissionRule, { type: 'hybrid' }>, 'type' | 'fixedAmount' | 'rate'>

/** Round a currency amount to two decimals at the domain boundary. */
function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Compute the management commission for a given revenue.
 *
 * - flat:   `revenue * rate%`
 * - hybrid: `fixedAmount + revenue * rate%`
 * - tiered: progressive (marginal) — each band of revenue is charged at that
 *   tier's rate. Revenue above the top capped tier is not charged.
 */
export function calculateCommission(rule: CommissionCalculationRule, revenue: number): number {
  if (rule.type === 'flat')
    return roundCurrency(revenue * (rule.rate / 100))

  if (rule.type === 'hybrid')
    return roundCurrency(rule.fixedAmount + revenue * (rule.rate / 100))

  let remaining = revenue
  let lowerBound = 0
  let total = 0

  for (const tier of rule.tiers) {
    const band = tier.upTo === null ? remaining : Math.min(remaining, tier.upTo - lowerBound)
    const charged = Math.max(0, band)
    total += charged * (tier.rate / 100)
    remaining -= charged
    if (tier.upTo !== null)
      lowerBound = tier.upTo
    if (remaining <= 0)
      break
  }

  return roundCurrency(total)
}

/**
 * Find the commission rule in effect for an (owner, listing) pair during a
 * `YYYY-MM` period. A rule is effective when its interval contains the last day
 * of the period. When several rules overlap, the one with the latest
 * `effectiveFrom` wins.
 */
export function findEffectiveCommissionRule(
  rules: CommissionRule[],
  ownerId: string,
  listingId: string,
  period: string,
): CommissionRule | undefined {
  const periodEnd = endOfPeriod(period)

  return rules
    .filter(rule =>
      rule.ownerId === ownerId
      && rule.listingId === listingId
      && rule.effectiveFrom <= periodEnd
      && (rule.effectiveTo === undefined || rule.effectiveTo >= periodEnd))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
}

/** Last calendar day of a `YYYY-MM` period as a `YYYY-MM-DD` string. */
function endOfPeriod(period: string): string {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  // Day 0 of the next month = last day of `month` (month is 1-based here).
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

// --- Seed fixtures ----------------------------------------------------------

export const mockCommissionRules: CommissionRule[] = [
  // Wayan (lst-1): flat 20% management commission.
  {
    id: 'cr-1',
    ownerId: 'own-1',
    listingId: 'lst-1',
    name: 'Standard 20% management',
    type: 'flat',
    rate: 20,
    effectiveFrom: '2026-01-15',
  },
  // I Putu (lst-3): tiered — cheaper on the first 50M IDR, then standard.
  {
    id: 'cr-2',
    ownerId: 'own-2',
    listingId: 'lst-3',
    name: 'Tiered — 18% / 22%',
    type: 'tiered',
    tiers: [
      { upTo: 50_000_000, rate: 18 },
      { upTo: null, rate: 22 },
    ],
    effectiveFrom: '2025-12-01',
  },
  // I Putu (lst-8): hybrid — fixed base fee + 15% on revenue above.
  {
    id: 'cr-3',
    ownerId: 'own-2',
    listingId: 'lst-8',
    name: 'Hybrid — 250 USD + 15%',
    type: 'hybrid',
    fixedAmount: 250,
    rate: 15,
    effectiveFrom: '2025-12-01',
  },
  // Ni Kadek (lst-3): flat 18% (slightly lower than I Putu because of higher projected volume).
  {
    id: 'cr-4',
    ownerId: 'own-3',
    listingId: 'lst-3',
    name: 'Standard 18% management',
    type: 'flat',
    rate: 18,
    effectiveFrom: '2026-07-01',
  },
]
