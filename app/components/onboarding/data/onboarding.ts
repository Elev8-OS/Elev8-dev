/**
 * Tenant onboarding: register through to an activated dashboard.
 *
 * Framework free on purpose. `useOnboarding` owns the reactive state and calls
 * in here, and the promo endpoint under `server/api/onboarding/` reuses the same
 * catalog, so the price a tenant is shown and the price the "server" validates
 * against can never drift.
 */

// ── Models ───────────────────────────────────────────────────────────────────

/** Which shape of Elev8 the tenant is buying. Decides modules, price and routing. */
export type PmsModel = 'PMS_CM' | 'PMS_ONLY' | 'MIGRATION'

export type OnboardingStatus
  = | 'registered'
    | 'email_verified'
    | 'profile_completed'
    | 'branding_completed'
    | 'plan_selected'
    | 'payment_pending'
    | 'payment_failed'
    | 'integration_pending'
    | 'importing'
    | 'completed'

export type OnboardingStep
  = | 'profile'
    | 'branding'
    | 'select_model'
    | 'select_plan'
    | 'payment'
    | 'integration'
    | 'import'
    | 'done'

export type PricingModel = 'per_unit' | 'per_booking'
export type BillingCycle = 'monthly' | 'yearly'
export type SubscriptionStatus = 'pending' | 'active' | 'payment_failed' | 'canceled'
export type ActivationSource = 'stripe_payment' | 'promo_full_discount' | 'manual_internal'

export interface TenantProfile {
  companyName: string
  brandName: string
  phoneNumber: string
  website: string
  operatingCurrency: string
  country: string
  timezone: string
  addressLine: string
  city: string
  zipCode: string
  language?: string
  logoUrl?: string
}

export interface TenantSubscription {
  pmsModel: PmsModel | null
  pricingModel: PricingModel | null
  planCode: string | null
  /** Always USD. Never chosen by the tenant, never derived from their country. */
  billingCurrency: 'USD'
  billingCycle: BillingCycle | null
  unitCount: number
  status: SubscriptionStatus
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripePaymentMethodId: string | null
  paymentMethodSavedAt: string | null
  quotaTotal: number | null
  quotaRemaining: number | null
  promoCode: string | null
  discountType: PromoDiscountType | null
  discountValue: number | null
  amountDue: number | null
  activationSource: ActivationSource | null
}

export type PromoDiscountType = 'percent' | 'fixed'
export type PromoDuration = 'first_invoice' | 'forever'

export interface OnboardingPromoCode {
  code: string
  discountType: PromoDiscountType
  discountValue: number
  /** Null means every model. */
  appliesToPmsModel: PmsModel[] | null
  /** Null means both pricing models. */
  appliesToPricingModel: PricingModel[] | null
  maxRedemptions: number | null
  redemptionCount: number
  validFrom: string
  validUntil: string | null
  duration: PromoDuration
  isActive: boolean
}

export type PmsConnectionStatus = 'pending' | 'connected' | 'auth_failed' | 'disconnected'
export type PmsConnectionPurpose = 'sync' | 'one_time_import'

export interface PmsConnection {
  provider: string
  calryIntegrationId: string
  status: PmsConnectionStatus
  connectedAt: string | null
  purpose: PmsConnectionPurpose
}

export type ImportJobType = 'listings' | 'reservations' | 'guests'
export type ImportJobStatus = 'queued' | 'running' | 'partial' | 'success' | 'failed'

export interface ImportJobFailure {
  ref: string
  reason: string
}

export interface ImportJob {
  type: ImportJobType
  status: ImportJobStatus
  totalCount: number
  processedCount: number
  failedItems: ImportJobFailure[]
}

export type ChecklistItemCode
  = | 'first_listing'
    | 'listing_content'
    | 'create_users'
    | 'setup_cleaning'
    | 'setup_stripe'
    | 'first_upsell'
    | 'download_app'

export type ChecklistItemStatus = 'todo' | 'done' | 'skipped' | 'not_applicable'

export interface ChecklistItem {
  code: ChecklistItemCode
  status: ChecklistItemStatus
  completedAt: string | null
}

export interface ConnectedChannel {
  id: string
  connected: boolean
}

/** Everything onboarding persists for one tenant. */
export interface OnboardingState {
  status: OnboardingStatus
  step: OnboardingStep
  pmsModel: PmsModel | null
  createdAt: string
  activatedAt: string | null
  email: string
  profile: TenantProfile
  brandingSkipped: boolean
  actionColor: string
  subscription: TenantSubscription
  connection: PmsConnection | null
  importJobs: ImportJob[]
  channels: ConnectedChannel[]
  /** Channels seen in imported data that a MIGRATION tenant must reconnect. */
  channelsToReconnect: string[]
  checklist: ChecklistItem[]
  /** Promo attempts that failed, used for the 10 per hour rate limit. */
  promoFailures: string[]
}

export const ONBOARDING_STORAGE_KEY = 'elev8-tenant-onboarding-v1'
export const DEFAULT_ACTION_COLOR = '#F6BB12'

// ── Wizard steps ─────────────────────────────────────────────────────────────

/**
 * The stepper the tenant sees. Select model and select plan both live under
 * "Select plan" (PRD 10) so the indicator stays at three labels.
 */
export const ONBOARDING_WIZARD_STEPS = [
  { id: 'profile', title: 'Profile', description: 'Company details used on invoices and reports.' },
  { id: 'branding', title: 'Branding', description: 'Logo and colour for your Guest Guide and invoices.' },
  { id: 'plan', title: 'Select plan', description: 'How you run ELEV8, and what it costs.' },
] as const

export type OnboardingWizardStepId = (typeof ONBOARDING_WIZARD_STEPS)[number]['id']

// ── Countries ────────────────────────────────────────────────────────────────

export interface CountryOption {
  code: string
  name: string
  currency: string
  timezone: string
  dialCode: string
  language?: string
}

/** Country picks the default operating currency and timezone. Both stay editable. */
export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'ID', name: 'Indonesia', currency: 'IDR', timezone: 'Asia/Makassar', dialCode: '+62', language: 'id' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', timezone: 'Europe/Zurich', dialCode: '+41', language: 'de' },
  { code: 'DE', name: 'Germany', currency: 'EUR', timezone: 'Europe/Berlin', dialCode: '+49', language: 'de' },
  { code: 'AT', name: 'Austria', currency: 'EUR', timezone: 'Europe/Vienna', dialCode: '+43', language: 'de' },
  { code: 'FR', name: 'France', currency: 'EUR', timezone: 'Europe/Paris', dialCode: '+33', language: 'fr' },
  { code: 'ES', name: 'Spain', currency: 'EUR', timezone: 'Europe/Madrid', dialCode: '+34', language: 'es' },
  { code: 'IT', name: 'Italy', currency: 'EUR', timezone: 'Europe/Rome', dialCode: '+39', language: 'it' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', timezone: 'Europe/Amsterdam', dialCode: '+31', language: 'nl' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', timezone: 'Europe/Lisbon', dialCode: '+351', language: 'pt' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', timezone: 'Europe/London', dialCode: '+44', language: 'en' },
  { code: 'US', name: 'United States', currency: 'USD', timezone: 'America/New_York', dialCode: '+1', language: 'en' },
  { code: 'CA', name: 'Canada', currency: 'CAD', timezone: 'America/Toronto', dialCode: '+1', language: 'en' },
  { code: 'AU', name: 'Australia', currency: 'AUD', timezone: 'Australia/Sydney', dialCode: '+61', language: 'en' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD', timezone: 'Pacific/Auckland', dialCode: '+64', language: 'en' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', timezone: 'Asia/Singapore', dialCode: '+65', language: 'en' },
  { code: 'MY', name: 'Malaysia', currency: 'MYR', timezone: 'Asia/Kuala_Lumpur', dialCode: '+60', language: 'en' },
  { code: 'TH', name: 'Thailand', currency: 'THB', timezone: 'Asia/Bangkok', dialCode: '+66', language: 'th' },
  { code: 'JP', name: 'Japan', currency: 'JPY', timezone: 'Asia/Tokyo', dialCode: '+81', language: 'ja' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', timezone: 'Asia/Dubai', dialCode: '+971', language: 'ar' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', timezone: 'Africa/Johannesburg', dialCode: '+27', language: 'en' },
]

export interface LanguageOption {
  code: string
  name: string
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', name: 'English' },
  { code: 'id', name: 'Indonesian (Bahasa Indonesia)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'pt', name: 'Portuguese (Português)' },
  { code: 'nl', name: 'Dutch (Nederlands)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'th', name: 'Thai (ไทย)' },
  { code: 'zh', name: 'Chinese (中文)' },
  { code: 'ar', name: 'Arabic (العربية)' },
]

export const CURRENCY_OPTIONS = [
  'AED',
  'AUD',
  'CAD',
  'CHF',
  'EUR',
  'GBP',
  'IDR',
  'JPY',
  'MYR',
  'NZD',
  'SGD',
  'THB',
  'USD',
  'ZAR',
] as const

/** Timezones offered in the picker. Country sets one, the tenant can change it. */
export const TIMEZONE_OPTIONS = [
  'Africa/Johannesburg',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/New_York',
  'America/Toronto',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Jakarta',
  'Asia/Kuala_Lumpur',
  'Asia/Makassar',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Vienna',
  'Europe/Zurich',
  'Pacific/Auckland',
] as const

export function countryByCode(code: string): CountryOption | undefined {
  return COUNTRY_OPTIONS.find(c => c.code === code)
}

// ── PMS model cards ──────────────────────────────────────────────────────────

export interface PmsModelOption {
  id: PmsModel
  title: string
  summary: string
  included: string[]
  notIncluded: string[]
  /** Needs an account with another PMS. */
  requiresExternalPms: boolean
  /** Plain sentence inside the card, never a tooltip (PRD 10). */
  warning: string | null
}

/** Modules a PMS_ONLY tenant does not get. Hidden from navigation, not disabled. */
export const PMS_ONLY_UNAVAILABLE_MODULES = ['Cockpit', 'Website Builder', 'Review Hub', 'Integrations'] as const

export const PMS_MODEL_OPTIONS: PmsModelOption[] = [
  {
    id: 'PMS_CM',
    title: 'ELEV8 as your PMS and Channel Manager',
    summary: 'Run everything in ELEV8. Your channels connect straight from here.',
    included: [
      'Every ELEV8 module',
      'Channels connect directly from ELEV8',
      'Rates and availability sync from ELEV8',
      'Cockpit, Websites, Review Hub and Integrations',
    ],
    notIncluded: ['Nothing. This is the full product.'],
    requiresExternalPms: false,
    warning: null,
  },
  {
    id: 'PMS_ONLY',
    title: 'ELEV8 as your PMS, connected to your current system',
    summary: 'Keep your existing system for channels. ELEV8 syncs listings and reservations from it.',
    included: [
      'Listings, Reservations, Inbox and Tasks',
      'Cleaning, Upsells and Guest Guides',
      'Listings and reservations sync from your current system',
    ],
    notIncluded: [
      'Cockpit',
      'Websites',
      'Review Hub',
      'Integrations',
      'Channels do not connect from ELEV8',
    ],
    requiresExternalPms: true,
    warning: null,
  },
  {
    id: 'MIGRATION',
    title: 'Move from your current system to ELEV8',
    summary: 'Import your data once, then run everything in ELEV8.',
    included: [
      'Every ELEV8 module, same as the full product',
      'One time import of listings, reservations and guests',
      'Channels connect directly from ELEV8 once you reconnect them',
    ],
    notIncluded: ['Nothing is permanently unavailable.'],
    requiresExternalPms: true,
    warning: 'Your channels do not move across on their own. After the import you reconnect each channel by hand, one at a time. Until you do, rates and availability are not sent to them.',
  },
]

export function pmsModelOption(model: PmsModel): PmsModelOption {
  return PMS_MODEL_OPTIONS.find(o => o.id === model)!
}

/** MIGRATION ends up where PMS_CM does, so it is priced and gated the same way. */
export function hasChannelManager(model: PmsModel): boolean {
  return model === 'PMS_CM' || model === 'MIGRATION'
}

export function isModuleAvailable(model: PmsModel | null, moduleName: string): boolean {
  if (model !== 'PMS_ONLY')
    return true
  return !PMS_ONLY_UNAVAILABLE_MODULES.includes(moduleName as typeof PMS_ONLY_UNAVAILABLE_MODULES[number])
}

// ── Plan catalog ─────────────────────────────────────────────────────────────

export interface PerUnitPlan {
  code: string
  name: string
  minUnits: number
  /** Null on the top tier. */
  maxUnits: number | null
  monthly: number
  yearly: number
  /** Billed for at least this many units, whatever the tenant actually runs. */
  floor: number
}

/** USD per unit per month. Yearly is monthly times 11 divided by 12, pay 11 get 12. */
export const PER_UNIT_PLANS: PerUnitPlan[] = [
  { code: 'PER_UNIT_STARTER', name: 'Starter', minUnits: 1, maxUnits: 4, monthly: 69, yearly: 63.25, floor: 1 },
  { code: 'PER_UNIT_GROWTH', name: 'Growth', minUnits: 5, maxUnits: 19, monthly: 59, yearly: 54.08, floor: 5 },
  { code: 'PER_UNIT_PRO', name: 'Pro', minUnits: 20, maxUnits: 49, monthly: 55, yearly: 50.42, floor: 20 },
  { code: 'PER_UNIT_ENTERPRISE', name: 'Enterprise', minUnits: 50, maxUnits: null, monthly: 49, yearly: 44.92, floor: 50 },
]

export interface PerBookingPlan {
  code: string
  name: string
  quota: number
  /** Price per booking without a Channel Manager, used by PMS_ONLY. */
  perBookingWithoutCm: number
  /** Price per booking with a Channel Manager, used by PMS_CM and MIGRATION. */
  perBookingWithCm: number
  totalWithoutCm: number
  totalWithCm: number
}

export const PER_BOOKING_PLANS: PerBookingPlan[] = [
  { code: 'PER_BOOKING_STARTER', name: 'Starter', quota: 50, perBookingWithoutCm: 9.90, perBookingWithCm: 13.90, totalWithoutCm: 495, totalWithCm: 695 },
  { code: 'PER_BOOKING_GROWTH', name: 'Growth', quota: 250, perBookingWithoutCm: 8.91, perBookingWithCm: 11.90, totalWithoutCm: 2227.50, totalWithCm: 2975 },
  { code: 'PER_BOOKING_ENTERPRISE', name: 'Enterprise', quota: 1000, perBookingWithoutCm: 7.42, perBookingWithCm: 9.90, totalWithoutCm: 7420, totalWithCm: 9900 },
]

/** Auto refill fires here, with a warning email one step earlier. */
export const PER_BOOKING_REFILL_THRESHOLD = 0.10
export const PER_BOOKING_WARNING_THRESHOLD = 0.15

/** Per unit is a one year contract. Stated at select plan, not at confirmation. */
export const PER_UNIT_CONTRACT_MONTHS = 12

export function perUnitPlanForUnits(units: number): PerUnitPlan {
  const found = PER_UNIT_PLANS.find(p => units >= p.minUnits && (p.maxUnits === null || units <= p.maxUnits))
  return found ?? PER_UNIT_PLANS[0]!
}

export function perUnitPlanByCode(code: string): PerUnitPlan | undefined {
  return PER_UNIT_PLANS.find(p => p.code === code)
}

export function perBookingPlanByCode(code: string): PerBookingPlan | undefined {
  return PER_BOOKING_PLANS.find(p => p.code === code)
}

/** The floor means a tenant with 2 units on Growth still pays for 5. */
export function billableUnits(units: number, plan: PerUnitPlan): number {
  return Math.max(units, plan.floor)
}

export function perUnitRate(plan: PerUnitPlan, cycle: BillingCycle): number {
  return cycle === 'yearly' ? plan.yearly : plan.monthly
}

/** What Stripe charges now: one month, or twelve at the yearly rate. */
export function perUnitAmount(units: number, plan: PerUnitPlan, cycle: BillingCycle): number {
  const months = cycle === 'yearly' ? 12 : 1
  return round2(billableUnits(units, plan) * perUnitRate(plan, cycle) * months)
}

export function perBookingRate(plan: PerBookingPlan, model: PmsModel): number {
  return hasChannelManager(model) ? plan.perBookingWithCm : plan.perBookingWithoutCm
}

export function perBookingAmount(plan: PerBookingPlan, model: PmsModel): number {
  return hasChannelManager(model) ? plan.totalWithCm : plan.totalWithoutCm
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// ── Order summary ────────────────────────────────────────────────────────────

export interface OrderSelection {
  pmsModel: PmsModel
  pricingModel: PricingModel
  planCode: string
  billingCycle: BillingCycle | null
  unitCount: number
}

export interface OrderSummary {
  planName: string
  /** Line under the plan name, e.g. "5 units billed monthly". */
  planDetail: string
  subtotal: number
  discount: number
  total: number
  promoCode: string | null
  /**
   * What the next period costs at the normal price. Null for per booking,
   * which is a prepaid quota with no recurring charge.
   */
  nextPeriodAmount: number | null
  nextPeriodLabel: string | null
  /** True when the discount only covers the first invoice (PRD 7.6). */
  discountIsFirstInvoiceOnly: boolean
  contractMonths: number | null
}

export function subtotalFor(selection: OrderSelection): number {
  if (selection.pricingModel === 'per_unit') {
    const plan = perUnitPlanByCode(selection.planCode)
    if (!plan || !selection.billingCycle)
      return 0
    return perUnitAmount(selection.unitCount, plan, selection.billingCycle)
  }
  const plan = perBookingPlanByCode(selection.planCode)
  return plan ? perBookingAmount(plan, selection.pmsModel) : 0
}

export function discountFor(subtotal: number, promo: OnboardingPromoCode | null): number {
  if (!promo)
    return 0
  const raw = promo.discountType === 'percent'
    ? subtotal * (promo.discountValue / 100)
    : promo.discountValue
  // Never discount below zero, and never hand back change.
  return round2(Math.min(Math.max(raw, 0), subtotal))
}

export function buildOrderSummary(
  selection: OrderSelection,
  promo: OnboardingPromoCode | null,
): OrderSummary {
  const subtotal = round2(subtotalFor(selection))
  const discount = discountFor(subtotal, promo)
  const total = round2(subtotal - discount)

  if (selection.pricingModel === 'per_unit') {
    const plan = perUnitPlanByCode(selection.planCode)!
    const cycle = selection.billingCycle ?? 'monthly'
    const billable = billableUnits(selection.unitCount, plan)
    const floorNote = billable > selection.unitCount ? ` (${plan.name} bills a minimum of ${plan.floor})` : ''
    // Recurring charge at normal price. A first invoice discount does not touch it.
    const recurring = subtotal
    const firstInvoiceOnly = promo?.duration === 'first_invoice'
    return {
      planName: `${plan.name}, per unit`,
      planDetail: `${billable} ${billable === 1 ? 'unit' : 'units'} billed ${cycle}${floorNote}`,
      subtotal,
      discount,
      total,
      promoCode: promo?.code ?? null,
      nextPeriodAmount: firstInvoiceOnly || !promo ? recurring : round2(recurring - discountFor(recurring, promo)),
      nextPeriodLabel: cycle === 'yearly' ? 'next year' : 'next month',
      discountIsFirstInvoiceOnly: Boolean(firstInvoiceOnly && discount > 0),
      contractMonths: PER_UNIT_CONTRACT_MONTHS,
    }
  }

  const plan = perBookingPlanByCode(selection.planCode)!
  const rate = perBookingRate(plan, selection.pmsModel)
  return {
    planName: `${plan.name}, per booking`,
    planDetail: `${plan.quota} bookings at ${formatUsd(rate)} each`,
    subtotal,
    discount,
    total,
    promoCode: promo?.code ?? null,
    // Prepaid quota. Nothing recurs, so there is no next period figure.
    nextPeriodAmount: null,
    nextPeriodLabel: null,
    discountIsFirstInvoiceOnly: false,
    contractMonths: null,
  }
}

// ── Promo validation ─────────────────────────────────────────────────────────

export type PromoRejectionReason
  = | 'not_found'
    | 'inactive'
    | 'not_started'
    | 'expired'
    | 'exhausted'
    | 'wrong_pms_model'
    | 'wrong_pricing_model'
    | 'rate_limited'

export interface PromoValidationResult {
  valid: boolean
  reason: PromoRejectionReason | null
  /** Names the actual reason, never a generic "invalid code" (PRD 8). */
  message: string
  promo: OnboardingPromoCode | null
}

const PMS_MODEL_LABELS: Record<PmsModel, string> = {
  PMS_CM: 'ELEV8 as PMS and Channel Manager',
  PMS_ONLY: 'ELEV8 as PMS only',
  MIGRATION: 'Migration to ELEV8',
}

const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  per_unit: 'per unit',
  per_booking: 'per booking',
}

/** Failed attempts allowed per tenant per hour before apply is blocked (PRD 8). */
export const PROMO_ATTEMPT_LIMIT = 10
export const PROMO_ATTEMPT_WINDOW_MS = 60 * 60 * 1000

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase()
}

export function validatePromoCode(
  rawCode: string,
  selection: Pick<OrderSelection, 'pmsModel' | 'pricingModel'>,
  catalog: OnboardingPromoCode[],
  now: Date = new Date(),
): PromoValidationResult {
  const code = normalizePromoCode(rawCode)
  const promo = catalog.find(p => p.code === code)

  if (!promo)
    return reject('not_found', 'We do not recognise that code. Check the spelling and try again.', null)

  if (!promo.isActive)
    return reject('inactive', `${code} is no longer available.`, promo)

  if (new Date(promo.validFrom).getTime() > now.getTime())
    return reject('not_started', `${code} is not valid yet. It starts on ${formatDate(promo.validFrom)}.`, promo)

  if (promo.validUntil && new Date(promo.validUntil).getTime() < now.getTime())
    return reject('expired', `${code} expired on ${formatDate(promo.validUntil)}.`, promo)

  if (promo.maxRedemptions !== null && promo.redemptionCount >= promo.maxRedemptions)
    return reject('exhausted', `${code} has been fully redeemed and is no longer available.`, promo)

  if (promo.appliesToPmsModel && !promo.appliesToPmsModel.includes(selection.pmsModel)) {
    const allowed = promo.appliesToPmsModel.map(m => PMS_MODEL_LABELS[m]).join(' or ')
    return reject('wrong_pms_model', `${code} only applies to ${allowed}. Change your model to use it, or continue without the code.`, promo)
  }

  if (promo.appliesToPricingModel && !promo.appliesToPricingModel.includes(selection.pricingModel)) {
    const allowed = promo.appliesToPricingModel.map(m => PRICING_MODEL_LABELS[m]).join(' or ')
    return reject('wrong_pricing_model', `${code} only applies to ${allowed} plans. Pick a ${allowed} plan to use it, or continue without the code.`, promo)
  }

  return { valid: true, reason: null, message: `${code} applied.`, promo }
}

function reject(reason: PromoRejectionReason, message: string, promo: OnboardingPromoCode | null): PromoValidationResult {
  return { valid: false, reason, message, promo }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Seed catalog. Internal admin owns these; a tenant can never create one. */
export const ONBOARDING_PROMO_CODES: OnboardingPromoCode[] = [
  {
    code: 'LAUNCH50',
    discountType: 'percent',
    discountValue: 50,
    appliesToPmsModel: null,
    appliesToPricingModel: null,
    maxRedemptions: 200,
    redemptionCount: 34,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: '2027-01-01T00:00:00.000Z',
    duration: 'first_invoice',
    isActive: true,
  },
  {
    code: 'PARTNER100',
    discountType: 'percent',
    discountValue: 100,
    appliesToPmsModel: null,
    appliesToPricingModel: null,
    maxRedemptions: 25,
    redemptionCount: 3,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: null,
    duration: 'first_invoice',
    isActive: true,
  },
  {
    code: 'MIGRATE250',
    discountType: 'fixed',
    discountValue: 250,
    appliesToPmsModel: ['MIGRATION'],
    appliesToPricingModel: null,
    maxRedemptions: 100,
    redemptionCount: 12,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: null,
    duration: 'first_invoice',
    isActive: true,
  },
  {
    code: 'UNITS20',
    discountType: 'percent',
    discountValue: 20,
    appliesToPmsModel: null,
    appliesToPricingModel: ['per_unit'],
    maxRedemptions: null,
    redemptionCount: 61,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: null,
    duration: 'first_invoice',
    isActive: true,
  },
  {
    code: 'SUMMER24',
    discountType: 'percent',
    discountValue: 30,
    appliesToPmsModel: null,
    appliesToPricingModel: null,
    maxRedemptions: 500,
    redemptionCount: 500,
    validFrom: '2024-06-01T00:00:00.000Z',
    validUntil: '2024-09-01T00:00:00.000Z',
    duration: 'first_invoice',
    isActive: true,
  },
]

// ── PMS catalog and channels ─────────────────────────────────────────────────

export interface CalryProvider {
  id: string
  name: string
  /** Pinned above the alphabetical list because most tenants come from these. */
  popular: boolean
}

/** The whole Calry catalog, no curation and no status badges (PRD 6.10). */
export const CALRY_PROVIDERS: CalryProvider[] = [
  { id: 'guesty', name: 'Guesty', popular: true },
  { id: 'hostaway', name: 'Hostaway', popular: true },
  { id: 'smoobu', name: 'Smoobu', popular: true },
  { id: 'lodgify', name: 'Lodgify', popular: true },
  { id: 'beds24', name: 'Beds24', popular: true },
  { id: '365villas', name: '365Villas', popular: false },
  { id: 'apaleo', name: 'Apaleo', popular: false },
  { id: 'avantio', name: 'Avantio', popular: false },
  { id: 'bookingsync', name: 'BookingSync', popular: false },
  { id: 'cloudbeds', name: 'Cloudbeds', popular: false },
  { id: 'escapia', name: 'Escapia', popular: false },
  { id: 'hospitable', name: 'Hospitable', popular: false },
  { id: 'hostfully', name: 'Hostfully', popular: false },
  { id: 'kigo', name: 'Kigo', popular: false },
  { id: 'mews', name: 'Mews', popular: false },
  { id: 'ownerrez', name: 'OwnerRez', popular: false },
  { id: 'rentals-united', name: 'Rentals United', popular: false },
  { id: 'streamline', name: 'Streamline', popular: false },
  { id: 'tokeet', name: 'Tokeet', popular: false },
  { id: 'uplisting', name: 'Uplisting', popular: false },
]

export function searchProviders(query: string): { popular: CalryProvider[], all: CalryProvider[] } {
  const q = query.trim().toLowerCase()
  const matches = q
    ? CALRY_PROVIDERS.filter(p => p.name.toLowerCase().includes(q))
    : CALRY_PROVIDERS
  const sorted = [...matches].sort((a, b) => a.name.localeCompare(b.name))
  return {
    popular: q ? [] : sorted.filter(p => p.popular),
    all: sorted,
  }
}

export function providerName(id: string): string {
  return CALRY_PROVIDERS.find(p => p.id === id)?.name ?? id
}

export interface PmsLogoMeta {
  bg: string
  color: string
  svg: string
}

export const PMS_LOGOS: Record<string, PmsLogoMeta> = {
  'guesty': {
    bg: '#1C2A53',
    color: '#FFFFFF',
    svg: '<svg viewBox="0 0 105 105" fill="none" class="size-4"><path d="M47.73 1.61c3.21-2.17 7.43-2.14 10.61.07l42.28 29.47c2.51 1.75 4.01 4.62 4.01 7.68v64.99h-11.27v-62.11c0-1.19-.58-2.3-1.56-2.98L55.01 13.1c-1.23-.86-2.87-.87-4.11-.03L12.86 38.8c-1 .68-1.6 1.8-1.6 3.01v48.03c0 1.51 1.22 2.73 2.73 2.73h52.8c1.51 0 2.73-1.22 2.73-2.73v-36.39c0-1.23-.63-2.38-1.66-3.05l-12.49-8.08c-1.48-.95-3.37-.97-4.86-.05l-13.21 8.2c-1.07.66-1.72 1.83-1.72 3.09v25.06h-11.27v-28.14c0-3.24 1.67-6.25 4.43-7.96l19.29-11.97c3.08-1.91 6.98-1.87 10.03.09l18.45 11.93c2.67 1.73 4.28 4.69 4.28 7.87v44.03c0 5.17-4.19 9.37-9.37 9.37H9.37c-5.17 0-9.37-4.19-9.37-9.37v-55.59c0-3.11 1.54-6.02 4.12-7.76L47.73 1.61Z" fill="currentColor"/></svg>',
  },
  'smoobu': {
    bg: '#FF6C37',
    color: '#FFFFFF',
    svg: '<svg viewBox="0 0 15 20" fill="none" class="size-4"><path d="M9.29 8.28L7.37 7.67C6.01 7.14 5.32 6.64 5.32 5.71C5.32 4.62 6.17 4.04 7.98 4.04C9.62 4.04 11.13 4.53 12.56 5.37C12.91 5.58 13.36 5.33 13.36 4.92V2.47C13.36 2.06 13.13 1.68 12.77 1.48C11.31 0.72 9.58 0.17 7.5 0.17C3.14 0.17 0.58 2.37 0.58 5.87C0.58 8.49 1.96 10.16 5.16 11.24L7.34 11.96C8.91 12.6 9.37 13.1 9.37 14C9.37 15.24 8.52 15.91 6.7 15.91C4.89 15.91 3.06 15.31 1.54 14.39C1.12 14.14 0.58 14.44 0.58 14.93V17.5C0.58 17.73 0.7 17.95 0.9 18.07C2.89 19.28 5.06 19.83 7.21 19.83C11.68 19.83 14.35 17.52 14.35 13.87C14.35 11.11 12.83 9.42 9.29 8.28Z" fill="currentColor"/></svg>',
  },
  'hostaway': {
    bg: '#FD6300',
    color: '#FFFFFF',
    svg: '<svg viewBox="0 0 28 26" fill="none" class="size-4"><path d="M14.08 0.15C9.95 0.51 6.66 2.06 4.31 4.53C3.34 5.54 2.37 6.81 2.2 8.54C2.18 8.73 2.18 8.9 2.18 9.09C2.3 10.26 3.34 11.13 4.5 11.01C4.8 10.98 5.09 10.89 5.35 10.74C6.03 10.36 6.42 9.64 6.42 8.89C6.42 8.73 6.41 8.58 6.37 8.44C6.3 8.01 6.3 7.57 6.39 7.14C6.76 5.11 8.64 3.45 10.12 2.68C10.67 2.38 11.66 1.97 12.15 2.23C12.8 2.56 11.9 4.46 11.69 5.04C10.69 7.91 9.24 13.67 8.37 16.54C7.38 19.1 6.1 21.87 4.31 22.89C3.83 23.16 3.2 23.42 2.64 23.13C2.04 21.89 3.75 20.5 3.42 19.15C3.29 18.6 2.67 18.37 1.91 18.29C0.93 19.4 -0.82 22.41 0.44 24.07C0.87 24.65 1.74 24.95 2.78 24.98C5.35 25.05 7.53 23.62 9.03 22.06C10.65 20.38 11.66 18.08 12.54 15.72C12.65 15.42 12.75 15.13 12.85 14.84H12.87C12.9 14.74 12.92 14.65 12.95 14.55C13.12 14.09 13.28 13.62 13.43 13.16C13.46 13.04 13.52 12.94 13.57 12.82C15.73 12.82 17.9 12.82 20.05 12.8C19.38 14.75 18.87 16.74 18.51 18.79C17.97 21.96 18.41 24.95 21.75 24.86C24.2 24.79 25.69 22.73 26.88 21.09C26.52 19.94 26 19.37 25.53 21.24C24.53 19.69 23.56 16.97 22.89 16.97C24.53 11.37 26.37 6.07 28.07 0.57C26.97 -0.19 25.38 0.08 24.51 0.69C23.56 1.34 23.25 2.57 22.81 3.95C22.07 6.23 21.17 9.23 20.49 11.13C18.36 11.15 16.21 11.17 14.06 11.15C14.4 10.05 14.74 8.97 15.07 7.89C15.58 6.45 16.11 4.99 16.57 3.53C16.82 2.76 17.23 1.49 16.89 0.79C16.47 -0.12 15.08 0.07 14.08 0.15Z" fill="currentColor"/></svg>',
  },
  'lodgify': {
    bg: '#008489',
    color: '#FFFFFF',
    svg: '<svg viewBox="0 20 200 280" fill="none" class="size-4"><path d="M38.07 237.96C35.65 243.71 41.96 249.22 47.33 246.06L197.69 157.42V294.83H48.08C28.13 294.83 11.01 282.59 3.73 265.15C1.3 259.34 -0.03 252.96 0 246.25H0.01L0.63 26.65H126.91L38.07 237.96Z" fill="currentColor"/></svg>',
  },
  'beds24': {
    bg: '#019CDE',
    color: '#FFFFFF',
    svg: '<svg viewBox="0 0 140 70" fill="none" class="size-4"><path d="M10 55V25C10 21 13 18 17 18H50C54 18 57 21 57 25V55H10Z" fill="currentColor" fill-opacity="0.35"/><path d="M8 58H132M8 42H132M8 20V58M132 30V58M22 34C25.3 34 28 31.3 28 28C28 24.7 25.3 22 22 22C18.7 22 16 24.7 16 28C16 31.3 18.7 34 22 34ZM34 42H124V32C124 28.7 121.3 26 118 26H70C66.7 26 64 28.7 64 32V42" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  'cloudbeds': {
    bg: '#1E255E',
    color: '#FFFFFF',
    svg: '<svg viewBox="0 0 35 35" fill="none" class="size-4"><path d="M31.59 10.06C28.39 6.87 23.6 6.24 19.77 8.17C19.62 8.25 19.47 8.05 19.6 7.93L24.04 3.5C24.19 3.35 24.18 3.1 24.02 2.96C20.02 -0.74 13.76 -0.65 9.86 3.23C6.62 6.46 6.02 11.31 8.03 15.15C8.11 15.3 7.92 15.45 7.8 15.33L3.26 10.81C3.11 10.66 2.86 10.67 2.72 10.82C-0.99 14.82 -0.9 21.06 2.99 24.94C6.19 28.13 10.99 28.76 14.82 26.83C14.97 26.75 15.11 26.95 14.99 27.07L10.55 31.5C10.4 31.65 10.41 31.9 10.56 32.04C14.57 35.74 20.83 35.65 24.73 31.77C27.96 28.54 28.57 23.69 26.55 19.85C26.47 19.7 26.67 19.55 26.79 19.67L31.32 24.19C31.47 24.34 31.72 24.33 31.87 24.18C35.58 20.18 35.49 13.94 31.59 10.06ZM24 17.68C21.89 18.53 18.32 22.09 17.48 24.19C17.41 24.35 17.18 24.35 17.11 24.19C16.26 22.08 12.69 18.53 10.59 17.68C10.42 17.62 10.42 17.38 10.59 17.32C12.69 16.47 16.26 12.92 17.11 10.82C17.18 10.65 17.41 10.65 17.48 10.82C18.32 12.92 21.89 16.47 24 17.32C24.16 17.38 24.16 17.62 24 17.68Z" fill="currentColor"/></svg>',
  },
  'mews': {
    bg: '#FF83DA',
    color: '#000000',
    svg: '<svg viewBox="0 0 28 28" fill="none" class="size-4"><path d="M19.2552 6.08594C17.8209 6.08594 16.6107 8.50756 16.2362 11.8132L16.1049 12.8425C16.0249 13.4645 15.1156 13.4645 15.0356 12.8425L14.9043 11.8132C14.5586 9.53051 13.6782 7.90768 12.6505 7.90768C11.6228 7.90768 10.7424 9.53051 10.3966 11.8132L10.2654 12.8425C10.1853 13.4645 9.27612 13.4645 9.19608 12.8425L9.06482 11.8132C8.75108 10.2946 8.12359 9.25583 7.39685 9.25583C6.35957 9.25583 5.51758 11.3712 5.51758 13.9791C5.51758 16.587 6.35957 18.7024 7.39685 18.7024C8.12359 18.7024 8.75428 17.6636 9.06482 16.145L9.19608 15.1157C9.27612 14.4937 10.1853 14.4937 10.2654 15.1157L10.3966 16.145C10.7424 18.4277 11.6228 20.0505 12.6505 20.0505C13.6782 20.0505 14.5586 18.4277 14.9043 16.145L15.0356 15.1157C15.1156 14.4937 16.0249 14.4937 16.1049 15.1157L16.2362 16.145C16.6107 19.4506 17.8209 21.8723 19.2552 21.8723C20.9872 21.8723 22.3926 18.3393 22.3926 13.9791C22.3926 9.61892 20.9904 6.08594 19.2552 6.08594Z" fill="currentColor"/></svg>',
  },
  'ownerrez': {
    bg: '#0F3C6E',
    color: '#7CC242',
    svg: '<svg viewBox="0 0 24 24" fill="none" class="size-4"><path d="M12 2L2 9.5V21a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V9.5L12 2z" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="11.5" r="2.5" stroke="currentColor" stroke-width="2"/><path d="M12 14v4.5M10.5 16.5H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  },
  'hospitable': {
    bg: '#044D80',
    color: '#A4DEF9',
    svg: '<svg viewBox="0 0 19 24" fill="none" class="size-4"><path d="M 13.036 20.308 C 14.066 20.308 14.901 21.134 14.901 22.154 C 14.901 23.174 14.066 24 13.036 24 L 5.59 24 C 4.565 24.005 3.731 23.179 3.725 22.154 C 3.725 21.134 4.56 20.308 5.59 20.308 Z M 9.313 0 C 14.457 0 18.627 4.133 18.627 9.23 C 18.627 14.329 14.457 18.462 9.313 18.462 C 4.169 18.462 0 14.329 0 9.23 C 0 4.131 4.17 0 9.313 0 Z M 9.313 3.692 C 6.227 3.692 3.725 6.172 3.725 9.231 C 3.725 12.29 6.227 14.769 9.313 14.769 C 12.399 14.769 14.901 12.289 14.901 9.231 C 14.901 6.172 12.399 3.692 9.313 3.692 Z" fill="currentColor"/></svg>',
  },
  'hostfully': {
    bg: '#2D2AA5',
    color: '#40CAA1',
    svg: '<svg viewBox="0 20 45 48" fill="none" class="size-4"><path d="M30.1 41.6V23.9L41.1 30.7V64.6H30.1V52.1H15.2V64.6H4.2V30.7L15.2 23.9V41.6H30.1Z" fill="currentColor"/></svg>',
  },
  '365villas': {
    bg: '#0A5C36',
    color: '#FFFFFF',
    svg: '<svg viewBox="0 0 24 24" fill="none" class="size-4"><path d="M12 3L2 11h3v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9h3L12 3z" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 21v-7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7M12 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  },
  'apaleo': {
    bg: '#0B2926',
    color: '#2CE59B',
    svg: '<svg viewBox="0 0 24 24" fill="none" class="size-4"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.2"/><path d="M8.5 13.5C8.5 11.57 10.07 10 12 10C13.93 10 15.5 11.57 15.5 13.5V16.5H8.5V13.5ZM15.5 10V7.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  'avantio': {
    bg: '#EA5436',
    color: '#FFFFFF',
    svg: '<svg viewBox="0 5 110 110" fill="none" class="size-4"><path d="M66 11.46C51.9 6.18 34.45 11.6 20.47 25.59C4.6 41.5 -2.2 63.13 3.19 80.7C5.5 86.4 9.1 91.5 12.11 95.52C25.67 109.61 51.82 116.83 73 112.31C86 109.54 95.41 102.54 99.48 92.61C108.78 69.93 103.48 42.72 86.34 24.88C80.6 18.9 73.6 14.3 66 11.46ZM84.9 93.58H70.73V85H70.23C67.2 90.8 61.9 94.2 55.4 94.86C49.8 95.4 44.2 93.9 39.5 90.8C33.8 87.1 30.94 80.5 30.94 76C30.94 72.8 31.8 69.6 33.4 67.2C36.7 62.4 42.5 59.8 47.9 58.3C52.2 57.1 57.8 56.4 63.6 56V54.8C63.6 50.8 60.5 48.2 55.6 48.2C51.2 48.2 47.8 49.8 45.4 52.8L35.5 45.8C39.8 39.8 47.2 36.2 56.2 36.2C67.5 36.2 74.8 42.5 74.8 53.6V74.8C74.8 78.4 75.8 80.4 79.2 80.4C80.6 80.4 82.2 79.8 83.4 78.8L84.9 93.58Z" fill="currentColor"/></svg>',
  },
  'bookingsync': {
    bg: '#00A3E0',
    color: '#FFFFFF',
    svg: '<svg viewBox="0 0 123 75" fill="none" class="size-4"><path d="M62 75C54.47 75.02 47.09 72.89 40.73 68.86C34.09 64.6 29.18 58.13 26.86 50.59C26.59 49.81 26.95 48.95 27.69 48.59C28.41 48.23 29.28 48.45 29.74 49.11C36.91 59.66 48.84 65.98 61.6 65.98C74.36 65.98 86.29 59.66 93.46 49.11C93.92 48.45 94.79 48.23 95.51 48.59C96.23 48.94 96.59 49.76 96.35 50.53C94.18 58.1 89.38 64.65 82.82 69C76.62 73 69.38 75.09 62 75ZM49 26.7C48.75 26.7 48.5 26.64 48.28 26.53L25.28 15.18L2.28 26.53C1.58 26.85 0.75 26.62 0.3 26C-0.15 25.35 -0.07 24.46 0.49 23.9L24.2 0.48C24.83 -0.15 25.86 -0.15 26.49 0.48L50.19 23.9C50.75 24.46 50.83 25.35 50.38 26C50.07 26.45 49.55 26.71 49 26.7ZM74 26.7C73.45 26.71 72.93 26.45 72.62 26C72.15 25.34 72.23 24.44 72.81 23.88L96.52 0.48C97.15 -0.15 98.18 -0.15 98.81 0.48L122.51 23.9C123.07 24.46 123.15 25.35 122.7 26C122.24 26.63 121.41 26.85 120.7 26.52L97.7 15.17L74.7 26.52C74.48 26.63 74.24 26.69 74 26.7Z" fill="currentColor"/></svg>',
  },
  'escapia': {
    bg: '#172E4E',
    color: '#F5A623',
    svg: '<svg viewBox="0 0 24 24" fill="none" class="size-4"><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.8"/><polygon points="12,4 14.5,10.5 20,12 14.5,13.5 12,20 9.5,13.5 4,12 9.5,10.5" fill="currentColor"/></svg>',
  },
  'kigo': {
    bg: '#E53E3E',
    color: '#FFFFFF',
    svg: '<svg viewBox="0 0 24 24" fill="none" class="size-4"><path d="M5 4v16M5 12l8-8M5 12l8 8M13 8l6-4M13 16l6 4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  'rentals-united': {
    bg: '#181B30',
    color: '#4ADE80',
    svg: '<svg viewBox="0 0 24 24" fill="none" class="size-4"><circle cx="7" cy="7" r="3.5" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="7" r="3.5" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="17" r="3.5" stroke="currentColor" stroke-width="2"/><path d="M10 7h4M8.5 10l2 4M15.5 10l-2 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  },
  'streamline': {
    bg: '#15445A',
    color: '#F79520',
    svg: '<svg viewBox="0 0 57 57" fill="none" class="size-4"><path d="M28.24 56.49C12.67 56.49 0 43.82 0 28.24S12.67 0 28.24 0s28.24 12.67 28.24 28.24-12.67 28.24-28.24 28.24h0ZM28.24 3.39C14.54 3.39 3.39 14.54 3.39 28.24s11.15 24.85 24.85 24.85 24.85-11.15 24.85-24.85S41.95 3.39 28.24 3.39Z M34.91 35.17v-7.58h3.43l-10.02-7.77-10.02,7.77h3.11v7.61c-4.21.55-8.26 1.6-12.09 3.1.32.61.67 1.19 1.05 1.76.35.07.68.14 1.02.21 2.08.43 4.05.84 8.09.84s6.01-.41 8.09-.84c2.15-.44 4.36-.9 8.73-.9s6.58.46 8.73.9c.28.06.55.11.83.17.48-.69.91-1.4 1.31-2.14-3.88-1.51-7.99-2.57-12.26-3.12h0ZM26.18 28.24c0-1.14.92-2.06 2.06-2.06s2.06.92 2.06 2.06c0,.62-.28 1.17-.71 1.54l.63 5c-.66-.02-1.32-.04-1.98-.04s-1.32.02-1.98.04l.63-5c-.43-.38-.71-.93-.71-1.54h0Z" fill="currentColor"/></svg>',
  },
  'tokeet': {
    bg: '#FF6A00',
    color: '#FFFFFF',
    svg: '<svg viewBox="0 0 24 24" fill="none" class="size-4"><path d="M3 5.5L21 2L13.5 21L10 13L3 5.5Z" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M21 2L10 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  },
  'uplisting': {
    bg: '#5C54EC',
    color: '#FFFFFF',
    svg: '<svg viewBox="0 0 50 42" fill="none" class="size-4"><path d="M24.28 0.47C24.68 0.08 25.33 0.09 25.72 0.47L49.43 23.69L45.34 28.18L25.71 8.95C25.32 8.57 24.68 8.57 24.29 8.95L4.64 28.18L0.52 23.77L24.28 0.47Z" fill="currentColor"/><path d="M24.27 27.94C24.66 27.55 25.29 27.56 25.68 27.94L36.04 38.23L33.58 40.92L25.13 32.7C25.04 32.62 24.91 32.62 24.83 32.7L16.42 40.92L13.97 38.23L24.27 27.94Z" fill="currentColor"/><path d="M24.31 15.39C24.71 15 25.34 14.99 25.75 15.39L42.17 31.64L39.08 34.95L25.47 21.71C25.23 21.48 24.83 21.48 24.59 21.71L10.9 34.95L7.82 31.64L24.31 15.39Z" fill="currentColor"/></svg>',
  },
}

export function getPmsLogo(id: string): PmsLogoMeta {
  return PMS_LOGOS[id] ?? {
    bg: '#64748B',
    color: '#FFFFFF',
    svg: `<svg viewBox="0 0 24 24" fill="none" class="size-4"><text x="12" y="16" text-anchor="middle" font-size="12" font-weight="bold" fill="currentColor">${id.slice(0, 2).toUpperCase()}</text></svg>`,
  }
}

export interface ChannelOption {
  id: string
  name: string
  icon: string
}

/** Named as channels, never as the vendor behind the Channel Manager (PRD 10). */
export const CHANNEL_OPTIONS: ChannelOption[] = [
  { id: 'airbnb', name: 'Airbnb', icon: 'logos:airbnb' },
  { id: 'booking', name: 'Booking.com', icon: 'simple-icons:bookingdotcom' },
  { id: 'expedia', name: 'Expedia', icon: 'simple-icons:expedia' },
  { id: 'vrbo', name: 'Vrbo', icon: 'simple-icons:vrbo' },
  { id: 'agoda', name: 'Agoda', icon: 'simple-icons:agoda' },
  { id: 'google-travel', name: 'Google Travel', icon: 'logos:google-icon' },
]

export function channelName(id: string): string {
  return CHANNEL_OPTIONS.find(c => c.id === id)?.name ?? id
}

// ── Checklist ────────────────────────────────────────────────────────────────

export interface ChecklistItemMeta {
  code: ChecklistItemCode
  title: string
  description: string
  icon: string
  link: string
  cta: string
  /** Module this item depends on, matched against PMS_ONLY_UNAVAILABLE_MODULES. */
  requiresModule: string | null
  optional: boolean
}

export const CHECKLIST_ITEMS: ChecklistItemMeta[] = [
  {
    code: 'first_listing',
    title: 'Set up your first listing',
    description: 'Connect one from a channel, or build one from scratch.',
    icon: 'lucide:home',
    link: '/listings',
    cta: 'Go to Listings',
    requiresModule: null,
    optional: false,
  },
  {
    code: 'listing_content',
    title: 'Complete your listing content',
    description: 'Fill in the required fields so the AI has enough to answer guests.',
    icon: 'lucide:file-text',
    link: '/listings',
    cta: 'Open Listing Setup',
    requiresModule: null,
    optional: false,
  },
  {
    code: 'create_users',
    title: 'Add your team',
    description: 'Create a user and assign them to a property.',
    icon: 'lucide:users',
    link: '/users',
    cta: 'Go to Users',
    requiresModule: null,
    optional: false,
  },
  {
    code: 'setup_cleaning',
    title: 'Set up cleaning',
    description: 'Create a cleaning schedule so housekeeping can start on the app.',
    icon: 'lucide:brush-cleaning',
    link: '/cleaning-calendar',
    cta: 'Go to Cleaning',
    requiresModule: null,
    optional: false,
  },
  {
    code: 'setup_stripe',
    title: 'Connect Stripe',
    description: 'Optional, and needed before you can charge for an upsell.',
    icon: 'lucide:credit-card',
    link: '/settings/payouts',
    cta: 'Go to Payouts',
    requiresModule: 'Integrations',
    optional: true,
  },
  {
    code: 'first_upsell',
    title: 'Create your first upsell',
    description: 'Offer something extra to guests during their stay.',
    icon: 'lucide:tag',
    link: '/upsells',
    cta: 'Go to Upsells',
    requiresModule: null,
    optional: false,
  },
  {
    code: 'download_app',
    title: 'Download ELEV8 Go',
    description: 'Your team runs cleaning and tasks from the mobile app.',
    icon: 'lucide:smartphone',
    link: '/users',
    cta: 'Share the link',
    requiresModule: null,
    optional: false,
  },
]

export function checklistItemMeta(code: ChecklistItemCode): ChecklistItemMeta {
  return CHECKLIST_ITEMS.find(i => i.code === code)!
}

/**
 * A fresh checklist for one model. Items that depend on a module the model does
 * not get start as `not_applicable` rather than as work the tenant cannot do.
 */
export function createChecklist(model: PmsModel | null): ChecklistItem[] {
  return CHECKLIST_ITEMS.map(item => ({
    code: item.code,
    status: item.requiresModule && !isModuleAvailable(model, item.requiresModule)
      ? 'not_applicable' as const
      : 'todo' as const,
    completedAt: null,
  }))
}

export interface ChecklistProgress {
  done: number
  total: number
  /** True once nothing is left to do, which hides the card. */
  finished: boolean
}

/** Counts only items that apply to this tenant (PRD 10). */
export function checklistProgress(items: ChecklistItem[]): ChecklistProgress {
  const applicable = items.filter(i => i.status !== 'not_applicable')
  const done = applicable.filter(i => i.status === 'done' || i.status === 'skipped').length
  return { done, total: applicable.length, finished: applicable.length > 0 && done === applicable.length }
}

// ── State machine ────────────────────────────────────────────────────────────

const STATUS_ORDER: OnboardingStatus[] = [
  'registered',
  'email_verified',
  'profile_completed',
  'branding_completed',
  'plan_selected',
  'payment_pending',
  'integration_pending',
  'importing',
  'completed',
]

export function statusRank(status: OnboardingStatus): number {
  // payment_failed sits alongside payment_pending: it is the only backwards move.
  if (status === 'payment_failed')
    return STATUS_ORDER.indexOf('payment_pending')
  return STATUS_ORDER.indexOf(status)
}

/**
 * Status only moves forward, with one exception: payment_failed may return to
 * payment_pending so a tenant can retry.
 */
export function canAdvance(from: OnboardingStatus, to: OnboardingStatus): boolean {
  if (from === 'payment_failed' && to === 'payment_pending')
    return true
  if (from === 'payment_pending' && to === 'payment_failed')
    return true
  return statusRank(to) > statusRank(from)
}

/** Where a returning tenant lands. Never earlier than what they finished. */
export function stepForStatus(status: OnboardingStatus): OnboardingStep {
  switch (status) {
    case 'registered':
    case 'email_verified':
      return 'profile'
    case 'profile_completed':
      return 'branding'
    case 'branding_completed':
      return 'select_model'
    case 'plan_selected':
      return 'payment'
    case 'payment_pending':
    case 'payment_failed':
      return 'payment'
    case 'integration_pending':
      return 'integration'
    case 'importing':
      return 'import'
    case 'completed':
      return 'done'
  }
}

/** PMS_CM connects channels. The other two authenticate a PMS through Calry. */
export function integrationPathFor(model: PmsModel | null): 'channels' | 'pms' {
  return model === 'PMS_CM' ? 'channels' : 'pms'
}

// ── Validation ───────────────────────────────────────────────────────────────

export function createDefaultProfile(): TenantProfile {
  return {
    companyName: '',
    brandName: '',
    phoneNumber: '',
    website: '',
    operatingCurrency: '',
    country: '',
    timezone: '',
    addressLine: '',
    city: '',
    zipCode: '',
    language: 'en',
    logoUrl: '',
  }
}

/** Every field is required except website (PRD 12, decided). */
export function validateProfile(profile: TenantProfile): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!profile.companyName.trim())
    errors.companyName = 'Required. This name appears on your invoices.'
  if (!profile.brandName.trim())
    errors.brandName = 'Required. This name is what guests see.'

  if (!profile.phoneNumber.trim())
    errors.phoneNumber = 'Required.'
  else if (!/^\+[1-9]\d{6,14}$/.test(profile.phoneNumber.replace(/[\s-]/g, '')))
    errors.phoneNumber = 'Enter a full number including the country code, for example +6281234567890.'

  if (profile.website.trim() && !isLikelyUrl(profile.website.trim()))
    errors.website = 'Enter a valid address, for example https://yourcompany.com.'

  if (!profile.country)
    errors.country = 'Required.'
  if (!profile.operatingCurrency)
    errors.operatingCurrency = 'Required.'
  if (!profile.timezone)
    errors.timezone = 'Required.'

  if (!profile.addressLine.trim())
    errors.addressLine = 'Required.'
  if (!profile.city.trim())
    errors.city = 'Required.'
  // Formats differ too much by country to check anything beyond presence.
  if (!profile.zipCode.trim())
    errors.zipCode = 'Required.'

  return errors
}

function isLikelyUrl(value: string): boolean {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)
    return url.hostname.includes('.')
  }
  catch {
    return false
  }
}

export function createDefaultSubscription(): TenantSubscription {
  return {
    pmsModel: null,
    pricingModel: null,
    planCode: null,
    billingCurrency: 'USD',
    billingCycle: null,
    unitCount: 1,
    status: 'pending',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePaymentMethodId: null,
    paymentMethodSavedAt: null,
    quotaTotal: null,
    quotaRemaining: null,
    promoCode: null,
    discountType: null,
    discountValue: null,
    amountDue: null,
    activationSource: null,
  }
}

export function createImportJobs(): ImportJob[] {
  // Order matters: reservations reference listings, guests reference reservations.
  return [
    { type: 'listings', status: 'queued', totalCount: 0, processedCount: 0, failedItems: [] },
    { type: 'reservations', status: 'queued', totalCount: 0, processedCount: 0, failedItems: [] },
    { type: 'guests', status: 'queued', totalCount: 0, processedCount: 0, failedItems: [] },
  ]
}

export const IMPORT_JOB_LABELS: Record<ImportJobType, string> = {
  listings: 'Listings',
  reservations: 'Reservations',
  guests: 'Guests',
}

/**
 * A tenant that has finished, so the existing demo dashboard is unaffected.
 * Its subscription is active: a `pending` one would make `planInactive` true and
 * paint the red banner across every page of the demo.
 */
export function createDefaultOnboardingState(): OnboardingState {
  const now = new Date().toISOString()
  return {
    status: 'completed',
    step: 'done',
    pmsModel: 'PMS_CM',
    createdAt: now,
    activatedAt: now,
    email: '',
    profile: createDefaultProfile(),
    brandingSkipped: false,
    actionColor: DEFAULT_ACTION_COLOR,
    subscription: {
      ...createDefaultSubscription(),
      pmsModel: 'PMS_CM',
      pricingModel: 'per_unit',
      planCode: 'PER_UNIT_GROWTH',
      billingCycle: 'monthly',
      unitCount: 16,
      status: 'active',
      stripeCustomerId: 'cus_demo',
      stripeSubscriptionId: 'sub_demo',
      stripePaymentMethodId: 'pm_demo',
      paymentMethodSavedAt: now,
      amountDue: 16 * 59,
      activationSource: 'stripe_payment',
    },
    connection: null,
    importJobs: [],
    channels: CHANNEL_OPTIONS.map(c => ({ id: c.id, connected: false })),
    channelsToReconnect: [],
    checklist: createChecklist('PMS_CM'),
    promoFailures: [],
  }
}

/** A tenant that has only just registered. */
export function createNewTenantState(email: string): OnboardingState {
  const now = new Date().toISOString()
  return {
    ...createDefaultOnboardingState(),
    status: 'registered',
    step: 'profile',
    pmsModel: null,
    createdAt: now,
    activatedAt: null,
    email,
    // Nothing has been bought yet, so the demo tenant's plan must not carry over.
    subscription: createDefaultSubscription(),
    checklist: createChecklist(null),
  }
}
