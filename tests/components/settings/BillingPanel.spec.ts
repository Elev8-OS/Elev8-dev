import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createHealthySubscriptionBilling } from '~/components/billing/data/subscription-billing'
import BillingPanel from '~/components/settings/BillingPanel.vue'
import { Button } from '~/components/ui/button'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useSubscriptionBilling } from '~/composables/useSubscriptionBilling'
import { useTernActivation } from '~/composables/useTernActivation'

const pdf = vi.hoisted(() => ({ subscription: vi.fn(), waiver: vi.fn() }))
vi.mock('~/lib/subscription-invoice-pdf', () => ({ buildSubscriptionInvoicePdf: pdf.subscription }))
vi.mock('~/lib/waiver-invoice-pdf', () => ({ buildWaiverInvoicePdf: pdf.waiver }))

const STUBS = {
  Icon: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  Progress: { props: ['modelValue'], template: '<div data-testid="units-bar" :data-value="modelValue" />' },
  BillingUpdatePaymentDialog: { props: ['open'], template: '<div v-if="open" data-testid="update-dialog" />' },
}

function mountPanel() {
  return mount(BillingPanel, { global: { components: { Button }, stubs: STUBS } })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  // The demo stays would otherwise land on the damage waiver line.
  useReservationsModule().reservations.value = []
})

describe('settings billing page', () => {
  it('shows the package and the units active against its range', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="billing-plan"]').text()).toBe('Growth')
    expect(wrapper.find('[data-testid="billing-package"]').text()).toContain('ELEV8 as PMS and Channel Manager, billed per unit, monthly')
    expect(wrapper.find('[data-testid="billing-units"]').text().replace(/\s+/g, ' ')).toBe('16 of 19')
    expect(wrapper.find('[data-testid="units-bar"]').attributes('data-value')).toBe('84')
    expect(wrapper.find('[data-testid="billing-package"]').text()).toContain('USD 59.00 per unit per month')
    expect(wrapper.find('[data-testid="billing-waiver-addon"]').text()).toContain('Active, billed on the 1st')
  })

  it('shows the failed charge first, with the card and a way to update it', async () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="billing-failed"]').text()).toContain('USD 944.00 for September 2026 was not collected')
    expect(wrapper.find('[data-testid="billing-card-label"]').text()).toBe('Visa ending 4242')
    expect(wrapper.find('[data-testid="billing-card"]').text()).toContain('Expired 07/2026')
    await wrapper.find('[data-testid="billing-card-update"]').trigger('click')
    expect(wrapper.find('[data-testid="update-dialog"]').exists()).toBe(true)
  })

  it('names the next subscription and damage waiver invoices', () => {
    const wrapper = mountPanel()
    const next = wrapper.find('[data-testid="billing-next-subscription"]').text()
    expect(next).toContain('Growth, 16 units at USD 59.00')
    expect(next).toContain('USD 944.00')
    expect(wrapper.find('[data-testid="billing-next-waiver"]').text()).toContain('Damage waiver')
  })

  it('lists every invoice, newest first, with its type and status apart, each downloadable', async () => {
    const wrapper = mountPanel()
    const rows = wrapper.findAll('[data-testid="billing-history-row"]')
    expect(rows).toHaveLength(4)
    expect(rows[0]!.text()).toContain('INV-2026-09-0142')
    expect(rows[0]!.find('[data-testid="billing-history-status"]').text()).toBe('Payment failed')
    expect(rows[0]!.text()).toContain('Invoice')
    expect(rows.slice(1).map(r => r.find('[data-testid="billing-history-status"]').text())).toEqual(['Paid', 'Paid', 'Paid'])
    await rows[1]!.find('[data-testid="billing-history-pdf"]').trigger('click')
    expect(pdf.subscription).toHaveBeenCalledOnce()
  })

  it('marks the failed invoice paid once the card is updated', async () => {
    const wrapper = mountPanel()
    vi.useFakeTimers()
    const pending = useSubscriptionBilling().retryPayment()
    await vi.runAllTimersAsync()
    await pending
    vi.useRealTimers()
    await nextTick()
    expect(wrapper.find('[data-testid="billing-failed"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="billing-history-status"]').map(s => s.text())).toEqual(['Paid', 'Paid', 'Paid', 'Paid'])
  })

  it('says the damage waiver is not activated, with no waiver invoice to come', () => {
    useTernActivation().replayActivation()
    useSubscriptionBilling().billing.value = createHealthySubscriptionBilling({ brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030, holderName: 'X' })
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="billing-waiver-addon"]').text()).toBe('Not activated')
    expect(wrapper.find('[data-testid="billing-next-waiver"]').exists()).toBe(false)
  })
})
