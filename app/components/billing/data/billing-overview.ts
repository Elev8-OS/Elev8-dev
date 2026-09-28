import type { SubscriptionInvoice } from '~/components/billing/data/subscription-billing'
import type { TenantSubscription } from '~/components/onboarding/data/onboarding'
import {
  billableUnits,
  PER_UNIT_CONTRACT_MONTHS,
  perBookingPlanByCode,
  perUnitAmount,
  perUnitPlanByCode,
  perUnitRate,
  PMS_MODEL_LABELS,
} from '~/components/onboarding/data/onboarding'

/**
 * What the billing page says about the tenant's Elev8 package and the next
 * subscription invoice. Framework-free; every figure comes from the plan
 * catalog in `onboarding.ts`, never typed here.
 *
 * A unit is a room (Elev8's billing term). On Per Unit the package counts the
 * rooms the tenant has ACTIVATED (`subscription.unitCount`), not every room in
 * the portfolio: activation is the billing event, and activating past the
 * package maximum opens the upgrade paywall.
 */

export interface PerUnitPackageView {
  model: 'per_unit'
  planName: string
  pmsLabel: string
  cycle: 'monthly' | 'yearly'
  unitsActive: number
  unitsMin: number
  /** Null on the top package: no maximum. */
  unitsMax: number | null
  /** The minimum the package bills, whatever is active. */
  floor: number
  billedUnits: number
  unitRateUsd: number
  contractMonths: number
  /** Local `YYYY-MM-DD`, or null before activation. */
  contractEndsOn: string | null
}

export interface PerBookingPackageView {
  model: 'per_booking'
  planName: string
  pmsLabel: string
  quotaTotal: number
  quotaRemaining: number
  rateUsd: number
}

export type PackageView = PerUnitPackageView | PerBookingPackageView

function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addMonths(iso: string, months: number): Date {
  const d = new Date(iso)
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate())
}

export function packageView(subscription: TenantSubscription, activatedAt: string | null): PackageView | null {
  const pmsLabel = subscription.pmsModel ? PMS_MODEL_LABELS[subscription.pmsModel] : 'Elev8'
  if (subscription.pricingModel === 'per_booking') {
    const plan = subscription.planCode ? perBookingPlanByCode(subscription.planCode) : undefined
    if (!plan)
      return null
    const withCm = subscription.pmsModel !== 'PMS_ONLY'
    return {
      model: 'per_booking',
      planName: plan.name,
      pmsLabel,
      quotaTotal: subscription.quotaTotal ?? plan.quota,
      quotaRemaining: subscription.quotaRemaining ?? plan.quota,
      rateUsd: withCm ? plan.perBookingWithCm : plan.perBookingWithoutCm,
    }
  }
  const plan = subscription.planCode ? perUnitPlanByCode(subscription.planCode) : undefined
  if (!plan)
    return null
  const cycle = subscription.billingCycle ?? 'monthly'
  return {
    model: 'per_unit',
    planName: plan.name,
    pmsLabel,
    cycle,
    unitsActive: subscription.unitCount,
    unitsMin: plan.minUnits,
    unitsMax: plan.maxUnits,
    floor: plan.floor,
    billedUnits: billableUnits(subscription.unitCount, plan),
    unitRateUsd: perUnitRate(plan, cycle),
    contractMonths: PER_UNIT_CONTRACT_MONTHS,
    contractEndsOn: activatedAt ? localDay(addMonths(activatedAt, PER_UNIT_CONTRACT_MONTHS)) : null,
  }
}

export interface NextSubscriptionInvoice {
  /** Local `YYYY-MM-DD`. */
  on: string
  amountUsd: number
  units: number
  unitRateUsd: number
  planName: string
}

/**
 * The next Per Unit invoice: one cycle after the last one issued (or after
 * activation, before any), for the units active now at the package rate.
 * Per Booking has no scheduled invoice: it refills its quota instead.
 */
export function nextSubscriptionInvoice(
  subscription: TenantSubscription,
  history: Pick<SubscriptionInvoice, 'issuedOn'>[],
  activatedAt: string | null,
): NextSubscriptionInvoice | null {
  if (subscription.pricingModel !== 'per_unit' || !subscription.planCode)
    return null
  const plan = perUnitPlanByCode(subscription.planCode)
  if (!plan)
    return null
  const cycle = subscription.billingCycle ?? 'monthly'
  const months = cycle === 'yearly' ? 12 : 1
  const latest = [...history].map(h => h.issuedOn).sort().at(-1) ?? activatedAt
  if (!latest)
    return null
  const units = billableUnits(subscription.unitCount, plan)
  return {
    on: localDay(addMonths(latest, months)),
    amountUsd: perUnitAmount(subscription.unitCount, plan, cycle),
    units,
    unitRateUsd: perUnitRate(plan, cycle),
    planName: plan.name,
  }
}
