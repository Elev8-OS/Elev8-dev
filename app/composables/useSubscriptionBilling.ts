import type { BillingPaymentMethod, SubscriptionBilling } from '~/components/billing/data/subscription-billing'
import { computed } from 'vue'
import {
  BILLING_STORAGE_KEY,
  createHealthySubscriptionBilling,
  createMockSubscriptionBilling,
  daysUntilSuspension,
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

    billing.value = createHealthySubscriptionBilling(pm)
    return { ok: true }
  }

  /** Mock: retries the outstanding invoice on the existing card (always succeeds). */
  async function retryPayment(): Promise<{ ok: boolean, error?: string }> {
    if (!billing.value.paymentMethod)
      return { ok: false, error: 'No payment method on file.' }

    isProcessing.value = true
    await new Promise(resolve => setTimeout(resolve, 1200))
    isProcessing.value = false

    billing.value = createHealthySubscriptionBilling(billing.value.paymentMethod)
    return { ok: true }
  }

  /** Demo helper: puts the tenant back into the failed state. */
  function simulatePaymentFailure() {
    billing.value = createMockSubscriptionBilling()
  }

  return {
    billing,
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
