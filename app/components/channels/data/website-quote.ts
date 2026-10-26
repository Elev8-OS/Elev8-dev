import type { WebsiteRuleSet } from './website-channel'

/**
 * The price of a stay booked on a website. Pure: the caller injects the
 * nightly prices and the listing's own discounts, so this stays free of the
 * listing and revenue stores.
 *
 * Which discount wins:
 * - The website has a rule set: its length of stay tier **replaces** the
 *   listing's unit type tiers and the revenue policy's weekly / monthly %.
 *   Early bird or last minute is added on top. Each discount is taken off the
 *   stay subtotal, never off an already discounted price.
 * - No rule set: the single biggest of the listing tiers and the policy's
 *   weekly / monthly %. They never stack.
 *
 * Money is rounded per currency (IDR whole, others to cents). No conversion:
 * every amount is in the listing's currency.
 */

export interface ListingStayTier {
  minNights: number
  discountType: 'percent' | 'fixed'
  value: number
}

export interface WebsiteQuoteInput {
  currency: string
  /** One price per night, check-in night first. */
  nightly: number[]
  checkIn: string
  checkOut: string
  /** The day the guest books (YYYY-MM-DD). */
  bookedOn: string
  ruleSet: WebsiteRuleSet | null
  listingTiers: ListingStayTier[]
  policyLength: { weeklyPct: number, monthlyPct: number } | null
}

export type QuoteDiscountSource = 'website' | 'listing' | 'policy'

export interface QuoteDiscount {
  label: string
  source: QuoteDiscountSource
  amount: number
}

export interface WebsiteQuote {
  currency: string
  nights: number
  subtotal: number
  discounts: QuoteDiscount[]
  total: number
  /** Charged at booking under the rule set; null without one. */
  prepayment: number | null
  /** Rule set stay rules the stay breaks. Empty means bookable. */
  blockers: string[]
}

const DAY_MS = 86_400_000
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function parse(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS)
}

function formatMoney(value: number, currency: string): string {
  const digits = currency === 'IDR' ? 0 : 2
  return `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export function roundQuoteMoney(value: number, currency: string): number {
  return currency === 'IDR' ? Math.round(value) : Math.round(value * 100) / 100
}

function tierAmount(tier: ListingStayTier, subtotal: number): number {
  return tier.discountType === 'percent' ? subtotal * tier.value / 100 : tier.value
}

/** Sells each night off the listing's base rate under the rule set's rate logic. */
function derivedNightly(nightly: number[], derived: WebsiteRuleSet['derivedRates'], currency: string): number[] {
  if (derived.logic === 'same_as_base')
    return nightly
  return nightly.map((p) => {
    let price = p
    if (derived.logic === 'increase_by_amount')
      price += derived.value
    else if (derived.logic === 'decrease_by_amount')
      price -= derived.value
    else if (derived.logic === 'increase_by_percent')
      price += price * derived.value / 100
    else
      price -= price * derived.value / 100
    return roundQuoteMoney(Math.max(0, price), currency)
  })
}

export function websiteQuote(input: WebsiteQuoteInput): WebsiteQuote {
  const { currency, ruleSet } = input
  const nights = daysBetween(input.checkIn, input.checkOut)
  const base = input.nightly.slice(0, Math.max(nights, 0))
  const nightly = ruleSet ? derivedNightly(base, ruleSet.derivedRates, currency) : base
  const subtotal = roundQuoteMoney(nightly.reduce((s, p) => s + p, 0), currency)
  const leadDays = daysBetween(input.bookedOn, input.checkIn)
  const discounts: QuoteDiscount[] = []
  const blockers: string[] = []

  if (ruleSet) {
    const tier = [...ruleSet.lengthOfStayDiscounts]
      .filter(t => nights >= t.minNights)
      .sort((a, b) => b.minNights - a.minNights)[0]
    if (tier)
      discounts.push({ label: `${tier.minNights}+ nights ${tier.pct}%`, source: 'website', amount: subtotal * tier.pct / 100 })
    if (ruleSet.earlyBird.enabled && leadDays >= ruleSet.earlyBird.days)
      discounts.push({ label: `Early bird ${ruleSet.earlyBird.pct}%`, source: 'website', amount: subtotal * ruleSet.earlyBird.pct / 100 })
    else if (ruleSet.lastMinute.enabled && leadDays <= ruleSet.lastMinute.days)
      discounts.push({ label: `Last minute ${ruleSet.lastMinute.pct}%`, source: 'website', amount: subtotal * ruleSet.lastMinute.pct / 100 })

    if (nights < ruleSet.minNights)
      blockers.push(`Minimum stay is ${ruleSet.minNights} nights.`)
    if (ruleSet.maxNights !== null && nights > ruleSet.maxNights)
      blockers.push(`Maximum stay is ${ruleSet.maxNights} nights.`)
    if (leadDays < ruleSet.minDaysBeforeArrival)
      blockers.push(`Book at least ${ruleSet.minDaysBeforeArrival} days before arrival.`)
    const inDow = parse(input.checkIn).getDay()
    const outDow = parse(input.checkOut).getDay()
    if (ruleSet.arrivalDays.length && !ruleSet.arrivalDays.includes(inDow))
      blockers.push(`No arrivals on ${WEEKDAY[inDow]}.`)
    if (ruleSet.departureDays.length && !ruleSet.departureDays.includes(outDow))
      blockers.push(`No departures on ${WEEKDAY[outDow]}.`)
  }
  else {
    const candidates: QuoteDiscount[] = []
    const tier = [...input.listingTiers]
      .filter(t => nights >= t.minNights)
      .sort((a, b) => tierAmount(b, subtotal) - tierAmount(a, subtotal))[0]
    if (tier)
      candidates.push({ label: `${tier.minNights}+ nights ${tier.discountType === 'percent' ? `${tier.value}%` : formatMoney(tier.value, currency)}`, source: 'listing', amount: tierAmount(tier, subtotal) })
    const policy = input.policyLength
    if (policy?.monthlyPct && nights >= 28)
      candidates.push({ label: `Monthly ${policy.monthlyPct}%`, source: 'policy', amount: subtotal * policy.monthlyPct / 100 })
    else if (policy?.weeklyPct && nights >= 7)
      candidates.push({ label: `Weekly ${policy.weeklyPct}%`, source: 'policy', amount: subtotal * policy.weeklyPct / 100 })
    const best = candidates.sort((a, b) => b.amount - a.amount)[0]
    if (best)
      discounts.push(best)
  }

  const rounded = discounts.map(d => ({ ...d, amount: roundQuoteMoney(d.amount, currency) }))
  const total = roundQuoteMoney(Math.max(0, subtotal - rounded.reduce((s, d) => s + d.amount, 0)), currency)
  return {
    currency,
    nights,
    subtotal,
    discounts: rounded,
    total,
    prepayment: ruleSet ? roundQuoteMoney(total * ruleSet.prepaymentPct / 100, currency) : null,
    blockers,
  }
}
