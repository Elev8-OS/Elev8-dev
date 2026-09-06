export type SubscriptionBillingStatus = 'active' | 'payment_failed' | 'suspended'

export type PaymentDeclineReason
  = | 'card_expired'
    | 'insufficient_funds'
    | 'card_declined'
    | 'authentication_required'

export interface BillingPaymentMethod {
  brand: 'visa' | 'mastercard' | 'amex'
  last4: string
  expMonth: number
  expYear: number
  holderName: string
}

export interface FailedInvoice {
  id: string
  number: string
  amountUsd: number
  periodLabel: string
  dueDate: string
  /** Day 1 of the dunning window. */
  firstFailedAt: string
  /** Failed daily attempts so far, 1-7. Day 3 and day 7 are the two e-mail slots (PP-502). */
  attempts: number
  declineReason: PaymentDeclineReason
}

export interface SubscriptionBilling {
  tenantId: string
  status: SubscriptionBillingStatus
  paymentMethod: BillingPaymentMethod | null
  failedInvoice: FailedInvoice | null
  /** Next daily retry by the payment provider. */
  nextRetryAt: string | null
  /**
   * The day-7 attempt date, which is also the suspension date.
   * Mirrors the `{{final_attempt_date}}` merge field in the dunning e-mails (PP-505).
   */
  finalAttemptDate: string | null
  updatedAt: string
}

export const BILLING_STORAGE_KEY = 'elev8-subscription-billing-v2'

/** Billing retries a failed charge once a day for seven days, then suspends (PP-502). */
export const DUNNING_WINDOW_DAYS = 7

export const declineReasonLabels: Record<PaymentDeclineReason, string> = {
  card_expired: 'The card on file has expired',
  insufficient_funds: 'The card was declined for insufficient funds',
  card_declined: 'The bank declined the charge',
  authentication_required: 'The bank asked for extra authentication (3-D Secure)',
}

/** Short form for the header bar, where the line has to stay on one row. */
export const declineReasonShort: Record<PaymentDeclineReason, string> = {
  card_expired: 'card expired',
  insufficient_funds: 'insufficient funds',
  card_declined: 'declined by the bank',
  authentication_required: 'authentication required',
}

export const cardBrandLabels: Record<BillingPaymentMethod['brand'], string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

/**
 * Demo seed: the current tenant (t-1, Bali Villas Co.) has a failed subscription
 * charge, so the header alert bar is visible out of the box.
 */
export function createMockSubscriptionBilling(): SubscriptionBilling {
  return {
    tenantId: 't-1',
    status: 'payment_failed',
    paymentMethod: {
      brand: 'visa',
      last4: '4242',
      expMonth: 7,
      expYear: 2026,
      holderName: 'Bali Villas Co.',
    },
    failedInvoice: {
      id: 'inv-2026-09',
      number: 'INV-2026-09-0142',
      amountUsd: 899,
      periodLabel: 'September 2026',
      dueDate: daysAgo(2),
      firstFailedAt: daysAgo(2),
      attempts: 3,
      declineReason: 'card_expired',
    },
    // Day 3 of 7: the first dunning e-mail has just gone out, suspension is 4 days away.
    nextRetryAt: daysFromNow(1),
    finalAttemptDate: daysFromNow(4),
    updatedAt: new Date().toISOString(),
  }
}

export function createHealthySubscriptionBilling(pm: BillingPaymentMethod): SubscriptionBilling {
  return {
    tenantId: 't-1',
    status: 'active',
    paymentMethod: pm,
    failedInvoice: null,
    nextRetryAt: null,
    finalAttemptDate: null,
    updatedAt: new Date().toISOString(),
  }
}

/** Whole days left before the account is suspended (0 when the window has passed). */
export function daysUntilSuspension(billing: SubscriptionBilling, now = Date.now()): number | null {
  if (!billing.finalAttemptDate)
    return null
  const diff = new Date(billing.finalAttemptDate).getTime() - now
  return diff <= 0 ? 0 : Math.ceil(diff / 86_400_000)
}

/** Billing copy is always USD-prefixed, never a bare `$` and never CHF (PP-504). */
export function formatUsd(amount: number): string {
  return `USD ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(amount)}`
}

/** "12 September", the deadline as the dunning e-mails print it. */
export function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}

export function detectCardBrand(cardNumber: string): BillingPaymentMethod['brand'] {
  const digits = cardNumber.replace(/\D/g, '')
  if (digits.startsWith('34') || digits.startsWith('37'))
    return 'amex'
  if (digits.startsWith('5') || digits.startsWith('2'))
    return 'mastercard'
  return 'visa'
}
