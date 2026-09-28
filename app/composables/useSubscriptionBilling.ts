import type { BillingPaymentMethod, SubscriptionBilling, SubscriptionInvoice } from '~/components/billing/data/subscription-billing'
import { computed } from 'vue'
import {
  BILLING_STORAGE_KEY,
  cardBrandLabels,
  createHealthySubscriptionBilling,
  createMockSubscriptionBilling,
  createSeedInvoiceHistory,
  daysUntilSuspension,
  INVOICE_HISTORY_STORAGE_KEY,
} from '~/components/billing/data/subscription-billing'

function loadFromStorage<T>(key: string, fallback: T): T {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(key)
      if (raw)
        return JSON.parse(raw) as T
    }
    catch { /* ignore */ }
  }
  return fallback
}

function saveToStorage<T>(key: string, value: T) {
  if (import.meta.client) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    }
    catch { /* ignore */ }
  }
}

export interface UpdatePaymentInput {
  cardNumber: string
  expMonth: number
  expYear: number
  cvc: string
  holderName: string
  brand: BillingPaymentMethod['brand']
}

export function useSubscriptionBilling() {
  const billing = useState<SubscriptionBilling>(
    'subscription-billing',
    () => loadFromStorage(BILLING_STORAGE_KEY, createMockSubscriptionBilling()),
  )
  const isProcessing = useState<boolean>('subscription-billing-processing', () => false)
  /** Every subscription invoice so far, newest first. */
  const invoices = useState<SubscriptionInvoice[]>(
    'subscription-invoices',
    () => loadFromStorage(INVOICE_HISTORY_STORAGE_KEY, createSeedInvoiceHistory(billing.value)),
  )
  watch(invoices, value => saveToStorage(INVOICE_HISTORY_STORAGE_KEY, value), { deep: true })

  /** The failed invoice is paid the moment the charge on a working card goes through. */
  function markFailedInvoicePaid(failedId: string | undefined, pm: BillingPaymentMethod) {
    if (!failedId)
      return
    const now = new Date().toISOString()
    invoices.value = invoices.value.map(inv => inv.id === failedId
      ? { ...inv, status: 'paid' as const, paidAt: now, failureReason: undefined, cardLabel: `${cardBrandLabels[pm.brand]} ending ${pm.last4}` }
      : inv)
  }

  watch(billing, (val) => { saveToStorage(BILLING_STORAGE_KEY, val) }, { deep: true })

  const isPaymentFailed = computed(() => billing.value.status === 'payment_failed')
  const isSuspended = computed(() => billing.value.status === 'suspended')
  /** The header bar shows for both states: one warns, the other explains the lockout. */
  const needsPaymentUpdate = computed(() => isPaymentFailed.value || isSuspended.value)
  const daysLeft = computed(() => daysUntilSuspension(billing.value))

  /**
   * Mock: replaces the card and retries the outstanding invoice (1.2s).
   * A card ending in 0002 always declines, so the failure state stays demoable.
   */
  async function updatePaymentMethod(input: UpdatePaymentInput): Promise<{ ok: boolean, error?: string }> {
    isProcessing.value = true
    await new Promise(resolve => setTimeout(resolve, 1200))
    isProcessing.value = false

    const last4 = input.cardNumber.replace(/\D/g, '').slice(-4)
    const pm: BillingPaymentMethod = {
      brand: input.brand,
      last4,
      expMonth: input.expMonth,
      expYear: input.expYear,
      holderName: input.holderName.trim(),
    }

    if (last4 === '0002') {
      billing.value = { ...billing.value, paymentMethod: pm, updatedAt: new Date().toISOString() }
      return { ok: false, error: 'The bank declined this card. Try another card or contact your bank.' }
    }

    const failedId = billing.value.failedInvoice?.id
    billing.value = createHealthySubscriptionBilling(pm)
    markFailedInvoicePaid(failedId, pm)
    return { ok: true }
  }

  /** Mock: retries the outstanding invoice on the existing card (always succeeds). */
  async function retryPayment(): Promise<{ ok: boolean, error?: string }> {
    if (!billing.value.paymentMethod)
      return { ok: false, error: 'No payment method on file.' }

    isProcessing.value = true
    await new Promise(resolve => setTimeout(resolve, 1200))
    isProcessing.value = false

    const failedId = billing.value.failedInvoice?.id
    const pm = billing.value.paymentMethod
    billing.value = createHealthySubscriptionBilling(pm)
    markFailedInvoicePaid(failedId, pm)
    return { ok: true }
  }

  /** Demo helper: puts the tenant back into the failed state. */
  function simulatePaymentFailure() {
    billing.value = createMockSubscriptionBilling()
    invoices.value = createSeedInvoiceHistory(billing.value)
  }

  return {
    billing,
    invoices,
    isProcessing,
    isPaymentFailed,
    isSuspended,
    needsPaymentUpdate,
    daysLeft,
    updatePaymentMethod,
    retryPayment,
    simulatePaymentFailure,
  }
}
