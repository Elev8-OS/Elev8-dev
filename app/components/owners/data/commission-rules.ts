// Commission rules — how the management company charges the owner for
// handling their listing. Each rule is scoped to a single (owner, listing)
// pair so it can be edited independently for shared properties.
//
// Two basis models are supported (PRD 5.1):
//   - gross:  the percentage/fixed fee is taken from gross booking revenue
//             (the OTA commission is already absorbed by the manager).
//   - net:    a fixed monthly fee plus a percentage of NET revenue
//             (gross − operating expenses − taxes − platform fees).
//
// Three flavours are supported:
//   - flat:     a single percentage of revenue.
//   - tiered:   a marginal rate (e.g. 20% on the first 1,000 USD, 12% above).
//   - hybrid:   a fixed management fee plus a percentage of revenue.

export type CommissionBasis = 'gross' | 'net'

/**
 * Revenue components that can be subtracted from gross to form the commission
 * base. A rule with no deductions charges on full gross; with the legacy
 * `basis: 'net'` it charges on net (parsed as all three deducted).
 */
export type CommissionBasisDeduction = 'operating_expenses' | 'taxes' | 'platform_fees'

export const COMMISSION_BASIS_DEDUCTION_LABELS: Record<CommissionBasisDeduction, string> = {
  operating_expenses: 'Operating expenses',
  taxes: 'Taxes',
  platform_fees: 'Platform / OTA fees',
}

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
  /** Which base the rate/fixed fee is computed against. Defaults to 'gross' for backward compatibility. */
  basis?: CommissionBasis
  /**
   * Revenue components deducted from gross to compute the commission base.
   * Empty/absent = full gross. `basis: 'net'` is the legacy alias for all
   * three deducted. When both are present, `basisDeductions` wins.
   */
  basisDeductions?: CommissionBasisDeduction[]
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
  = | Pick<Extract<CommissionRule, { type: 'flat' }>, 'type' | 'rate' | 'basis' | 'basisDeductions'>
    | Pick<Extract<CommissionRule, { type: 'tiered' }>, 'type' | 'tiers' | 'basis' | 'basisDeductions'>
    | Pick<Extract<CommissionRule, { type: 'hybrid' }>, 'type' | 'fixedAmount' | 'rate' | 'basis' | 'basisDeductions'>

/** Round a currency amount to two decimals at the domain boundary. */
function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export interface CommissionCalculationOptions {
  /**
   * Net revenue (gross − operating expenses − taxes − platform fees).
   * Used as the base for legacy `basis: 'net'` rules when the individual
   * component amounts below are not supplied.
   */
  netRevenue?: number
  /** Deduced from gross when the rule selects the `operating_expenses` basis component. */
  operatingExpenses?: number
  /** Deduced from gross when the rule selects the `taxes` basis component. */
  taxes?: number
  /** Deduced from gross when the rule selects the `platform_fees` basis component. */
  platformFees?: number
}

/**
 * Resolve the deductions a rule applies to gross to form its commission base.
 * `basisDeductions` wins; otherwise legacy `basis: 'net'` means all three.
 */
function ruleDeductions(rule: Pick<CommissionCalculationRule, 'basis' | 'basisDeductions'>): CommissionBasisDeduction[] {
  if (rule.basisDeductions && rule.basisDeductions.length > 0)
    return rule.basisDeductions
  return rule.basis === 'net'
    ? ['operating_expenses', 'taxes', 'platform_fees']
    : []
}

/**
 * Compute the commission base (gross minus the selected deductions).
 * Falls back to `opts.netRevenue` for legacy `basis: 'net'` rules that came
 * with no itemised amounts, so existing statement math is unchanged.
 */
function commissionBase(
  rule: Pick<CommissionCalculationRule, 'basis' | 'basisDeductions'>,
  revenue: number,
  opts: CommissionCalculationOptions,
): number {
  const deductions = ruleDeductions(rule)
  // Legacy net rules (no itemised components passed) keep using netRevenue.
  if (deductions.length > 0
    && opts.operatingExpenses === undefined
    && opts.taxes === undefined
    && opts.platformFees === undefined) {
    if (opts.netRevenue !== undefined)
      return opts.netRevenue
  }
  let base = revenue
  if (deductions.includes('operating_expenses'))
    base -= opts.operatingExpenses ?? 0
  if (deductions.includes('taxes'))
    base -= opts.taxes ?? 0
  if (deductions.includes('platform_fees'))
    base -= opts.platformFees ?? 0
  return Math.max(0, base)
}

/**
 * Compute the management commission for a given revenue.
 *
 * - flat:   `base * rate%`
 * - hybrid: `fixedAmount + base * rate%`
 * - tiered: progressive (marginal) — each band of revenue is charged at that
 *   tier's rate. Revenue above the top capped tier is not charged.
 *
 * The `base` is `revenue` (gross) default; deductions selected on the rule
 * (or the legacy `basis: 'net'`) shift it down to the net base.
 */
export function calculateCommission(
  rule: CommissionCalculationRule,
  revenue: number,
  opts: CommissionCalculationOptions = {},
): number {
  const base = commissionBase(rule, revenue, opts)

  if (rule.type === 'flat')
    return roundCurrency(base * (rule.rate / 100))

  if (rule.type === 'hybrid')
    return roundCurrency(rule.fixedAmount + base * (rule.rate / 100))

  let remaining = base
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
  // Wayan (lst-1): flat 20% management commission on gross revenue.
  {
    id: 'cr-1',
    ownerId: 'own-1',
    listingId: 'lst-1',
    name: 'Standard 20% management',
    type: 'flat',
    rate: 20,
    basis: 'gross',
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
    basis: 'gross',
    effectiveFrom: '2025-12-01',
  },
  // I Putu (lst-8): hybrid — fixed base fee + 15% on NET revenue (PRD 5.1 model).
  {
    id: 'cr-3',
    ownerId: 'own-2',
    listingId: 'lst-8',
    name: 'Hybrid — 250 USD + 15% of Net',
    type: 'hybrid',
    fixedAmount: 250,
    rate: 15,
    basis: 'net',
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
    basis: 'gross',
    effectiveFrom: '2026-07-01',
  },
]

/**
 * Human-readable basis label for a commission rule, e.g. "20% of Gross"
 * or "250 USD + 15% of Net". Used in statement lines and the editor.
 */
export function commissionBasisLabel(rule: {
  type: 'flat' | 'tiered' | 'hybrid'
  rate?: number
  fixedAmount?: number
  basis?: CommissionBasis
  basisDeductions?: CommissionBasisDeduction[]
}): string {
  const deductions = ruleDeductions(rule)
  const basis = deductions.length > 0 ? 'Net' : 'Gross'
  if (rule.type === 'flat')
    return `${rule.rate}% of ${basis}`
  if (rule.type === 'hybrid')
    return `${rule.fixedAmount} + ${rule.rate}% of ${basis}`
  return `Tiered of ${basis}`
}
