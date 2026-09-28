import type { BillableStay, WaiverBillingRun, WaiverInvoice } from '~/components/damage-protection/data/waiver-billing'
import { computed } from 'vue'
import { declineReasonShort } from '~/components/billing/data/subscription-billing'
import {
  billableLines,
  billingDateFor,
  buildPeriodInvoices,
  dayKey,
  periodKey,
  periodsDue,
  totalsByCurrency,
} from '~/components/damage-protection/data/waiver-billing'
import { useNotifications } from '~/composables/useNotifications'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useSubscriptionBilling } from '~/composables/useSubscriptionBilling'
import { useTenantBillTo } from '~/composables/useTenantBillTo'
import { useTernActivation } from '~/composables/useTernActivation'

const STORAGE_KEY = 'elev8-waiver-billing-v1'

/** The mock charge to the subscription card. Long enough for the spinner to be seen. */
const CHARGE_MOCK_MS = 1500

const BRAND_LABELS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express' } as const

/**
 * Elev8's monthly damage waiver invoice to the tenant: on the 1st, one
 * invoice per currency for the stays that checked out the month before,
 * charged to the card on the Elev8 subscription. The ONLY writer of the
 * invoices and the billing runs. Rules live in `waiver-billing.ts`.
 *
 * There is no scheduler in this app, so `runDueBilling()` catches up every
 * 1st that has passed since the waiver was activated; it is idempotent (a
 * billed month is recorded as a run, even with nothing to bill).
 *
 * ⚠️ The charge goes to the SAME card as the subscription. While the
 * subscription's card is failing (the header's payment-failed banner), this
 * charge is declined for the same reason; once the card is updated there, a
 * retry here goes through.
 */
export function useWaiverBilling() {
  const invoices = useState<WaiverInvoice[]>('waiver-billing-invoices', () => [])
  const runs = useState<WaiverBillingRun[]>('waiver-billing-runs', () => [])
  const running = useState<boolean>('waiver-billing-running', () => false)
  const charging = useState<string[]>('waiver-billing-charging', () => [])

  const tern = useTernActivation()
  const subscriptionBilling = useSubscriptionBilling()
  const { reservations } = useReservationsModule()
  const { billTo } = useTenantBillTo()
  const { alerts, createProtectionAlert } = useNotifications()

  function persist() {
    if (typeof localStorage === 'undefined')
      return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ invoices: invoices.value, runs: runs.value }))
  }

  function hydrate() {
    if (typeof localStorage === 'undefined')
      return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw)
        return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.invoices)) {
        // A reload mid-charge never reads as paid: the charge is retried.
        invoices.value = parsed.invoices.map((inv: WaiverInvoice) => inv.status === 'charging'
          ? { ...inv, status: 'payment_failed' as const, failureReason: 'The charge was interrupted. Nothing was taken.' }
          : inv)
      }
      if (Array.isArray(parsed.runs))
        runs.value = parsed.runs
    }
    catch { /* corrupt payload, start empty */ }
  }

  /** Billing starts with the month the waiver was activated in. */
  const firstPeriod = computed(() => {
    const at = tern.activation.value.registeredAt
    return at ? periodKey(new Date(at)) : null
  })

  const stays = computed<BillableStay[]>(() => reservations.value.map(reservation => ({ reservation })))
  const billedIds = computed(() => new Set(invoices.value.flatMap(inv => inv.lines.map(l => l.reservationId))))

  const cardLabel = computed(() => {
    const pm = subscriptionBilling.billing.value.paymentMethod
    return pm ? `${BRAND_LABELS[pm.brand]} ending ${pm.last4}` : 'The card on your Elev8 subscription'
  })

  /**
   * What the next 1st will bill, so far. Normally the month in progress; once
   * that month has been billed early (the demo button), the one after it.
   */
  const upcoming = computed(() => {
    const now = new Date()
    const ran = new Set(runs.value.map(r => r.period))
    let period = periodKey(now)
    while (ran.has(period))
      period = periodKey(billingDateFor(period))
    const lines = tern.isActive.value ? billableLines(stays.value, period, billedIds.value, dayKey(now)) : []
    return { period, billsOn: dayKey(billingDateFor(period)), lines, totals: totalsByCurrency(lines) }
  })

  function patchInvoice(id: string, patch: Partial<WaiverInvoice>) {
    invoices.value = invoices.value.map(inv => inv.id === id ? { ...inv, ...patch } : inv)
    persist()
  }

  function resolveFailedAlert(invoiceId: string) {
    alerts.value = alerts.value.map(a =>
      a.status === 'ACTIVE' && a.type === 'WAIVER_INVOICE_PAYMENT_FAILED' && a.context?.invoice_id === invoiceId
        ? { ...a, status: 'RESOLVED' as const, resolved_at: new Date().toISOString() }
        : a)
  }

  /** The mock off-session charge. Declined while the subscription card itself is failing. */
  async function charge(invoiceId: string) {
    charging.value = [...charging.value, invoiceId]
    const invoice = invoices.value.find(inv => inv.id === invoiceId)!
    patchInvoice(invoiceId, { status: 'charging', attempts: invoice.attempts + 1, cardLabel: cardLabel.value })
    await new Promise(resolve => setTimeout(resolve, CHARGE_MOCK_MS))
    charging.value = charging.value.filter(id => id !== invoiceId)

    const sub = subscriptionBilling.billing.value
    if (subscriptionBilling.needsPaymentUpdate.value || !sub.paymentMethod) {
      const reason = sub.failedInvoice ? declineReasonShort[sub.failedInvoice.declineReason] : 'no card on file'
      patchInvoice(invoiceId, { status: 'payment_failed', failureReason: `Declined: ${reason}` })
      const current = invoices.value.find(inv => inv.id === invoiceId)!
      const live = alerts.value.some(a => a.status === 'ACTIVE' && a.type === 'WAIVER_INVOICE_PAYMENT_FAILED' && a.context?.invoice_id === invoiceId)
      if (!live) {
        createProtectionAlert('WAIVER_INVOICE_PAYMENT_FAILED', {
          invoice_id: invoiceId,
          invoice_number: current.number,
          currency: current.currency,
          amount: current.total,
          reason,
        })
      }
      return { ok: false as const, reason: 'declined' }
    }
    patchInvoice(invoiceId, { status: 'paid', chargedAt: new Date().toISOString(), failureReason: undefined })
    resolveFailedAlert(invoiceId)
    return { ok: true as const }
  }

  /**
   * Bill every month that is due by `now`. Pass a later `now` to play the
   * next 1st early (the demo button); a real integration runs this from a job
   * on the 1st.
   */
  async function runDueBilling(now: Date = new Date()): Promise<WaiverInvoice[]> {
    if (running.value || !tern.isActive.value || !firstPeriod.value)
      return []
    running.value = true
    const created: WaiverInvoice[] = []
    try {
      const due = periodsDue(firstPeriod.value, now, new Set(runs.value.map(r => r.period)))
      for (const period of due) {
        const lines = billableLines(stays.value, period, billedIds.value)
        const fresh = buildPeriodInvoices(lines, period, {
          billTo: billTo(),
          paymentMethodId: tern.activation.value.billingPaymentMethodId ?? '',
          cardLabel: cardLabel.value,
          existingInPeriod: invoices.value.filter(inv => inv.period === period).length,
          now,
        })
        invoices.value = [...fresh, ...invoices.value]
        runs.value = [...runs.value, { period, ranAt: now.toISOString(), invoiceIds: fresh.map(inv => inv.id) }]
        persist()
        created.push(...fresh)
      }
      for (const invoice of created)
        await charge(invoice.id)
    }
    finally {
      running.value = false
    }
    return created.map(inv => invoices.value.find(i => i.id === inv.id)!)
  }

  async function retryCharge(invoiceId: string) {
    const invoice = invoices.value.find(inv => inv.id === invoiceId)
    if (!invoice || invoice.status !== 'payment_failed')
      return { ok: false as const, reason: 'not_retryable' }
    return charge(invoiceId)
  }

  /** Newest month first. */
  const history = computed(() =>
    [...invoices.value].sort((a, b) => b.period.localeCompare(a.period) || b.number.localeCompare(a.number)))

  const failedInvoices = computed(() => invoices.value.filter(inv => inv.status === 'payment_failed'))

  return {
    invoices,
    runs,
    running,
    charging,
    history,
    failedInvoices,
    upcoming,
    cardLabel,
    hydrate,
    runDueBilling,
    retryCharge,
  }
}
