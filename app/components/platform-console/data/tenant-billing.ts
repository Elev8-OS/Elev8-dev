import type { Tenant } from './tenants'
import { TENANT_PLAN_LABEL, TIER_LABEL } from './tenants'

export type BillingHealth = 'paid' | 'dunning' | 'pending' | 'suspended'
export type BillingCycle = 'monthly' | 'yearly'
export type InvoiceStatus = 'paid' | 'pending'

export interface NextChargeOverride {
  amount: number
  recurring: boolean
  note: string
  by: string
  /** Local YYYY-MM-DD the adjustment was saved. */
  at: string
}

export interface Dunning {
  /** `property`: retry ladder then suspend. `booking`: consecutive failed auto top-ups (strikes). */
  kind: 'property' | 'booking'
  attempt: number
  maxAttempts: number
  firstFailedAt: string | null
  intervalDays: number
  suspendOn: string | null
  amount: number
}

export interface BillingInvoice {
  id: string
  date: string
  type: 'property' | 'booking'
  description: string
  invoiceNumber: string | null
  amount: number
  status: InvoiceStatus
}

export interface TenantBilling {
  tenantId: string
  currency: string
  cycle: BillingCycle
  health: BillingHealth
  hasPaymentMethod: boolean
  /** Local YYYY-MM-DD. Null when nothing is scheduled (per booking top-ups, churned). */
  nextChargeAt: string | null
  override: NextChargeOverride | null
  dunning: Dunning | null
  invoices: BillingInvoice[]
}

export const BILLING_CURRENCY = 'USD'
export const BOOKING_STRIKE_LIMIT = 7
export const PROPERTY_RETRY_LIMIT = 3

/** Local `YYYY-MM-DD`. `toISOString()` shifts a UTC+8 midnight to the day before. */
export function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseYmd(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function addDays(value: string, days: number): string {
  const d = parseYmd(value)
  if (!d) return value
  d.setDate(d.getDate() + days)
  return ymd(d)
}

/** Adds calendar months and clamps to the last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(value: string, months: number): string {
  const d = parseYmd(value)
  if (!d) return value
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return ymd(d)
}

/** `USD 1,299.00`. Code first, never a symbol, never converted. */
export function formatMoney(amount: number, currency: string = BILLING_CURRENCY): string {
  const n = Number.isFinite(amount) ? amount : 0
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const HEALTH_LABEL: Record<BillingHealth, string> = {
  paid: 'Paid',
  dunning: 'In dunning',
  pending: 'Pending',
  suspended: 'Suspended',
}

/** Badge colours per health, theme tokens only. Shared by the tenant list and the Billing tab. */
export const HEALTH_BADGE_CLASS: Record<BillingHealth, string> = {
  paid: 'border-transparent bg-primary/10 text-primary',
  dunning: 'border-transparent bg-warning/25 text-warning-foreground',
  pending: 'border-transparent bg-muted text-muted-foreground',
  suspended: 'border-transparent bg-destructive/10 text-destructive',
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: 'Paid',
  pending: 'Pending',
}

export function typeLabel(plan: Tenant['plan'], cycle: BillingCycle): string {
  return plan === 'per_property' ? `Property · ${cycle}` : 'Booking · per-use'
}

/** What the next automatic charge is without an override. Yearly is the annual total. */
export function defaultChargeAmount(tenant: Pick<Tenant, 'mrrUsd'>, cycle: BillingCycle): number {
  const monthly = tenant.mrrUsd ?? 0
  return cycle === 'yearly' ? monthly * 12 : monthly
}

export function planTitle(tenant: Pick<Tenant, 'plan' | 'packageTier'>): string {
  return `${TIER_LABEL[tenant.packageTier]} · ${TENANT_PLAN_LABEL[tenant.plan]}`
}

export type DunningStepState = 'done' | 'current' | 'upcoming' | 'suspend'

export interface DunningStep {
  label: string
  date: string
  email: string
  state: DunningStepState
}

const RETRY_MAIL: Record<number, string> = {
  1: 'subscription_property_failed',
  2: 'subscription_property_retry_2',
  3: 'subscription_property_retry_3',
}

/** The retry ladder of a property subscription, closed by the suspension step. */
export function dunningSteps(d: Dunning): DunningStep[] {
  const steps: DunningStep[] = []
  for (let i = 1; i <= d.maxAttempts; i++) {
    steps.push({
      label: `Attempt ${i} / ${d.maxAttempts}`,
      date: d.firstFailedAt ? addDays(d.firstFailedAt, (i - 1) * d.intervalDays) : '',
      email: i < d.maxAttempts ? (RETRY_MAIL[i] ?? `subscription_property_retry_${i}`) : 'subscription_property_suspended',
      state: i < d.attempt ? 'done' : i === d.attempt ? 'current' : 'upcoming',
    })
  }
  steps.push({ label: 'Suspend account', date: d.suspendOn ?? '', email: '', state: 'suspend' })
  return steps
}

/** Red once the next failure suspends the account. */
export function isCriticalDunning(d: Dunning): boolean {
  return d.attempt >= d.maxAttempts - 1
}

function nextOccurrence(day: number, from: Date): string {
  const d = new Date(from.getFullYear(), from.getMonth(), 1)
  const clamp = (y: number, m: number) => Math.min(day, new Date(y, m + 1, 0).getDate())
  d.setDate(clamp(d.getFullYear(), d.getMonth()))
  if (d <= from) {
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    d.setDate(clamp(d.getFullYear(), d.getMonth()))
  }
  return ymd(d)
}

interface Seed {
  cycle?: BillingCycle
  health: BillingHealth
  noCard?: boolean
  /** `{ attempt }` of the failing retry ladder or top-up strikes. */
  dunningAttempt?: number
  /** Days since the first failed charge. */
  failedDaysAgo?: number
  override?: { amount: number, recurring: boolean, note: string }
  noInvoices?: boolean
}

// Hand-picked so every state of the reference page shows up in the demo data.
const SEEDS: Record<string, Seed> = {
  't-1': { health: 'paid' },
  't-2': { health: 'paid', cycle: 'yearly' },
  't-3': { health: 'dunning', dunningAttempt: 3, failedDaysAgo: 5 },
  't-4': { health: 'pending', noCard: true },
  't-5': { health: 'suspended', dunningAttempt: 3, failedDaysAgo: 8 },
  't-6': { health: 'dunning', dunningAttempt: 2, failedDaysAgo: 3 },
  't-7': { health: 'paid' },
  't-8': { health: 'suspended', noCard: true, noInvoices: true },
  't-9': { health: 'paid', noInvoices: true },
  't-10': { health: 'paid', override: { amount: 449, recurring: false, note: 'Loyalty discount agreed with the account manager, next charge only.' } },
}

function buildInvoices(tenant: Tenant, cycle: BillingCycle, now: Date, health: BillingHealth): BillingInvoice[] {
  const isProperty = tenant.plan === 'per_property'
  const amount = isProperty
    ? defaultChargeAmount(tenant, cycle)
    : Math.round((tenant.quotaTotal ?? 0) * 0.8)
  const count = cycle === 'yearly' ? 2 : 3
  const out: BillingInvoice[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (cycle === 'yearly' ? i * 12 : i), 1)
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(tenant.billingCycleDay, last))
    if (d > now) d.setMonth(d.getMonth() - (cycle === 'yearly' ? 12 : 1))
    const date = ymd(d)
    const latestFailing = i === 0 && (health === 'dunning' || health === 'suspended')
    out.push({
      id: `${tenant.id}-inv-${i + 1}`,
      date,
      type: isProperty ? 'property' : 'booking',
      description: isProperty
        ? `${TIER_LABEL[tenant.packageTier]} subscription, ${tenant.activeUnits} units (${cycle})`
        : `Booking credits top-up, ${tenant.quotaTotal ?? 0} credits`,
      invoiceNumber: latestFailing || (i === 0 && health === 'pending') ? null : `INV-${tenant.id.replace('t-', '')}${date.replace(/-/g, '').slice(2, 6)}-${String(i + 1).padStart(2, '0')}`,
      amount,
      status: latestFailing || (i === 0 && health === 'pending') ? 'pending' : 'paid',
    })
  }
  return out
}

export function deriveTenantBilling(tenant: Tenant, now: Date = new Date()): TenantBilling {
  const seed: Seed = SEEDS[tenant.id] ?? { health: tenant.status === 'suspended' || tenant.status === 'churned' ? 'suspended' : 'paid' }
  const cycle: BillingCycle = seed.cycle ?? 'monthly'
  const isProperty = tenant.plan === 'per_property'
  const live = tenant.status === 'active' || tenant.status === 'switching'
  const today = ymd(now)

  let dunning: Dunning | null = null
  if (seed.dunningAttempt) {
    const first = addDays(today, -(seed.failedDaysAgo ?? 3))
    dunning = isProperty
      ? {
          kind: 'property',
          attempt: seed.dunningAttempt,
          maxAttempts: PROPERTY_RETRY_LIMIT,
          firstFailedAt: first,
          intervalDays: 3,
          suspendOn: addDays(first, PROPERTY_RETRY_LIMIT * 3),
          amount: defaultChargeAmount(tenant, cycle),
        }
      : {
          kind: 'booking',
          attempt: seed.dunningAttempt,
          maxAttempts: BOOKING_STRIKE_LIMIT,
          firstFailedAt: first,
          intervalDays: 1,
          suspendOn: null,
          amount: Math.round((tenant.quotaTotal ?? 0) * 0.8),
        }
  }

  const override: NextChargeOverride | null = seed.override
    ? { ...seed.override, by: 'Made Wirawan', at: addDays(today, -2) }
    : null

  return {
    tenantId: tenant.id,
    currency: BILLING_CURRENCY,
    cycle,
    health: seed.health,
    hasPaymentMethod: !seed.noCard,
    nextChargeAt: isProperty && live && !tenant.isInternal
      ? (cycle === 'yearly' ? addMonths(today, 4) : nextOccurrence(tenant.billingCycleDay, now))
      : null,
    override,
    dunning,
    invoices: seed.noInvoices ? [] : buildInvoices(tenant, cycle, now, seed.health),
  }
}

export function seedTenantBilling(tenants: Tenant[], now: Date = new Date()): Record<string, TenantBilling> {
  const out: Record<string, TenantBilling> = {}
  for (const t of tenants) out[t.id] = deriveTenantBilling(t, now)
  return out
}
