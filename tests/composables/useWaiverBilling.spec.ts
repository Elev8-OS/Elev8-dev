import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHealthySubscriptionBilling } from '~/components/billing/data/subscription-billing'
import { useNotifications } from '~/composables/useNotifications'
import { useOnboarding } from '~/composables/useOnboarding'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useSubscriptionBilling } from '~/composables/useSubscriptionBilling'
import { useTernActivation } from '~/composables/useTernActivation'
import { useWaiverBilling } from '~/composables/useWaiverBilling'

/** The charge mock waits 1.5s. Fake timers BEFORE the call. */
async function settle<T>(run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers()
  const pending = run()
  await vi.runAllTimersAsync()
  const result = await pending
  vi.useRealTimers()
  return result
}

const CARD = { brand: 'visa' as const, last4: '4242', expMonth: 12, expYear: 2030, holderName: 'Komang Juliantara' }

function covered(id: string, checkOut: string, fee = 9, paidBy: 'guest' | 'host' = 'guest'): ReservationEntry {
  const base = useReservationsModule().reservations.value[0]!
  return {
    ...base,
    id,
    guestName: `Guest ${id}`,
    listingId: 'lst-1',
    listingName: 'Villa Luwa',
    checkIn: '2026-09-01',
    checkOut,
    status: 'checked_out',
    damageProtection: {
      policyId: 'dp-standard',
      option: 'waiver',
      state: 'waiver_active',
      amount: paidBy === 'host' ? 0 : 39,
      currency: 'USD',
      paidBy,
      tier: 'bronze',
      elev8Fee: fee,
      termsVersion: 'v1',
      termsText: 'Terms',
      acceptedAt: '2026-08-20T10:00:00.000Z',
      acceptedVia: paidBy === 'host' ? 'host_cover' : 'guest_guide',
    },
  }
}

const OCT_1 = new Date(2026, 9, 1, 0, 5)

const sendEmail = vi.fn(async (_url: string, _opts: { body: { kind: string, to: string, subject: string } }) => ({ ok: true }))
const sentKinds = () => sendEmail.mock.calls.map(([, opts]) => opts.body.kind)

beforeEach(() => {
  localStorage.clear()
  // Only the stays this spec builds: the demo seeds would land on the invoice too.
  useReservationsModule().reservations.value = [
    covered('a', '2026-09-10'),
    covered('b', '2026-09-20', 25, 'host'),
    covered('c', '2026-10-03'),
  ]
  useSubscriptionBilling().billing.value = createHealthySubscriptionBilling(CARD)
  sendEmail.mockClear()
  vi.stubGlobal('$fetch', sendEmail)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useWaiverBilling', () => {
  it('bills on the 1st the stays that checked out the month before, and charges the subscription card', async () => {
    const billing = useWaiverBilling()
    const [invoice] = await settle(() => billing.runDueBilling(OCT_1))
    expect(invoice).toMatchObject({ number: 'E8-DW-202609-001', period: '2026-09', total: 34, status: 'paid', cardLabel: 'Visa ending 4242' })
    expect(invoice!.lines.map(l => l.reservationId)).toEqual(['a', 'b'])
  })

  it('bills nothing before the 1st, and a month only once', async () => {
    const billing = useWaiverBilling()
    await expect(settle(() => billing.runDueBilling(new Date(2026, 8, 28)))).resolves.toEqual([])
    await settle(() => billing.runDueBilling(OCT_1))
    await expect(settle(() => billing.runDueBilling(new Date(2026, 9, 15)))).resolves.toEqual([])
    expect(billing.invoices.value).toHaveLength(1)
  })

  it('records a month with nothing to bill, so it is not billed later', async () => {
    useReservationsModule().reservations.value = []
    const billing = useWaiverBilling()
    await settle(() => billing.runDueBilling(OCT_1))
    expect(billing.runs.value).toEqual([expect.objectContaining({ period: '2026-09', invoiceIds: [] })])
    expect(billing.invoices.value).toEqual([])
  })

  it('bills nothing until the damage waiver is activated', async () => {
    useTernActivation().replayActivation()
    await expect(settle(() => useWaiverBilling().runDueBilling(OCT_1))).resolves.toEqual([])
  })

  it('is declined while the subscription card is failing, raises an alert, and goes through on the retry', async () => {
    const subscription = useSubscriptionBilling()
    subscription.simulatePaymentFailure()
    const billing = useWaiverBilling()
    const [invoice] = await settle(() => billing.runDueBilling(OCT_1))
    expect(invoice).toMatchObject({ status: 'payment_failed', failureReason: 'Declined: card expired', attempts: 1 })
    const { alerts } = useNotifications()
    const alert = () => alerts.value.find(a => a.type === 'WAIVER_INVOICE_PAYMENT_FAILED' && a.context?.invoice_id === invoice!.id)
    expect(alert()?.status).toBe('ACTIVE')

    subscription.billing.value = createHealthySubscriptionBilling(CARD)
    await expect(settle(() => billing.retryCharge(invoice!.id))).resolves.toEqual({ ok: true })
    expect(billing.invoices.value[0]).toMatchObject({ status: 'paid', attempts: 2 })
    expect(alert()?.status).toBe('RESOLVED')
  })

  it('shows the month in progress so far, not yet billed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 15, 12))
    const upcoming = useWaiverBilling().upcoming.value
    vi.useRealTimers()
    expect(upcoming).toMatchObject({ period: '2026-09', billsOn: '2026-10-01', totals: [{ currency: 'USD', total: 9, count: 1 }] })
  })

  it('reads a reload mid-charge as unpaid, never as paid', async () => {
    const billing = useWaiverBilling()
    await settle(() => billing.runDueBilling(OCT_1))
    const stored = JSON.parse(localStorage.getItem('elev8-waiver-billing-v1')!)
    stored.invoices[0].status = 'charging'
    localStorage.setItem('elev8-waiver-billing-v1', JSON.stringify(stored))
    billing.hydrate()
    expect(billing.invoices.value[0]!.status).toBe('payment_failed')
  })

  it('moves the next invoice on once the month in progress was billed early', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 15, 12))
    const billing = useWaiverBilling()
    const pending = billing.runDueBilling(OCT_1)
    await vi.runAllTimersAsync()
    await pending
    const upcoming = billing.upcoming.value
    vi.useRealTimers()
    expect(upcoming).toMatchObject({ period: '2026-10', billsOn: '2026-11-01' })
  })

  it('emails the paid invoice on the 1st, to the email the tenant signed up with', async () => {
    useOnboarding().state.value = { ...useOnboarding().state.value, email: 'owner@villa.example' }
    const billing = useWaiverBilling()
    await settle(() => billing.runDueBilling(OCT_1))
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0]![0]).toBe('/api/billing/send-email')
    expect(sendEmail.mock.calls[0]![1].body).toMatchObject({ kind: 'invoice_paid', to: 'owner@villa.example', subject: expect.stringContaining('E8-DW-202609-001') })
    expect(billing.invoices.value[0]!.emailsSent?.invoice_paid).toBeTruthy()
  })

  it('falls back to the invoice template email when there is no signup email', async () => {
    await settle(() => useWaiverBilling().runDueBilling(OCT_1))
    expect(sendEmail.mock.calls[0]![1].body.to).toBe('hello@elevater.ch')
  })

  it('emails a failure once, even when a retry fails again, then the payment received', async () => {
    const subscription = useSubscriptionBilling()
    subscription.simulatePaymentFailure()
    const billing = useWaiverBilling()
    const [invoice] = await settle(() => billing.runDueBilling(OCT_1))
    await settle(() => billing.retryCharge(invoice!.id))
    expect(sentKinds()).toEqual(['payment_failed'])

    subscription.billing.value = createHealthySubscriptionBilling(CARD)
    await settle(() => billing.retryCharge(invoice!.id))
    expect(sentKinds()).toEqual(['payment_failed', 'payment_received'])
  })

  it('never lets a failed email send touch the charge', async () => {
    sendEmail.mockRejectedValueOnce(new Error('provider down'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const [invoice] = await settle(() => useWaiverBilling().runDueBilling(OCT_1))
    warn.mockRestore()
    expect(invoice).toMatchObject({ status: 'paid' })
    expect(invoice!.emailsSent).toBeUndefined()
  })

  it('bills the tenant\'s own billing entity when the onboarding profile is blank', async () => {
    const [invoice] = await settle(() => useWaiverBilling().runDueBilling(OCT_1))
    expect(invoice!.billTo).toMatchObject({ companyName: 'Elevate Schweiz GmbH', vatNumber: 'CHE-163.290.666MWST', ternOrganizationId: 10421 })
  })
})
