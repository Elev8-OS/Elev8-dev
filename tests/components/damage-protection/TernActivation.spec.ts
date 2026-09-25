import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import TernActivationCard from '~/components/damage-protection/TernActivationCard.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useOnboarding } from '~/composables/useOnboarding'
import { useTernActivation } from '~/composables/useTernActivation'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  // Honours `open`, so a closed dialog renders nothing.
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  DialogContent: passthrough,
  DialogHeader: passthrough,
  DialogTitle: passthrough,
  DialogDescription: passthrough,
  DialogFooter: passthrough,
  Select: { name: 'SelectStub', props: ['modelValue'], emits: ['update:modelValue'], template: '<div :data-value="modelValue"><slot /></div>' },
  SelectTrigger: passthrough,
  SelectValue: true,
  SelectContent: passthrough,
  SelectItem: { props: ['value'], template: '<div><slot /></div>' },
  Switch: { props: ['modelValue', 'id'], emits: ['update:modelValue'], template: '<input type="checkbox" :id="id" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)">' },
}

function mountCard() {
  return mount(TernActivationCard, { global: { components: { Button, Input, Label }, stubs: STUBS } })
}

/** The mocks wait 1.5s. Fake timers BEFORE the click, then drain them. */
async function clickAndSettle(wrapper: ReturnType<typeof mountCard>, testid: string) {
  vi.useFakeTimers()
  await wrapper.find(`[data-testid="${testid}"]`).trigger('click')
  await vi.runAllTimersAsync()
  vi.useRealTimers()
  await nextTick()
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('the damage waiver activation', () => {
  it('shows an active tenant where Tern pays, and offers to change the bank account', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="tern-activation-card"]').attributes('data-status')).toBe('active')
    expect(wrapper.find('[data-testid="tern-card-bank"]').text()).toContain('Bank Central Asia (BCA) •••• 3456')
    expect(wrapper.find('[data-testid="tern-change-bank"]').exists()).toBe(true)
  })

  it('walks the tenant through terms and bank, and registers the organization on Tern', async () => {
    useTernActivation().replayActivation()
    const wrapper = mountCard()
    await wrapper.find('[data-testid="tern-activate-open"]').trigger('click')
    expect(wrapper.find('[data-testid="tern-step-terms"]').exists()).toBe(true)

    // Terms: cannot move on without accepting them.
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    expect(wrapper.find('[data-testid="tern-step-terms"]').text()).toContain('Accept the terms')
    await wrapper.find('[data-testid="tern-accept-terms"]').trigger('click')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')

    // Bank: copied from the invoice settings, the country still to give.
    expect(wrapper.find('[data-testid="tern-step-bank"]').exists()).toBe(true)
    const source = wrapper.findAllComponents({ name: 'SelectStub' }).find(c => c.find('[data-testid="tern-bank-source"]').exists())!
    source.vm.$emit('update:modelValue', 'tmpl-bali-local')
    await nextTick()
    expect((wrapper.find('#tern-bank-holder').element as HTMLInputElement).value).toBe('PT Elev8 Bali Mandiri')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    expect(wrapper.find('[data-testid="tern-step-bank"]').text()).toContain('two-letter code')
    await wrapper.find('#tern-bank-country').setValue('ID')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')

    // Review, then activate. No card was asked for: the subscription card is used.
    expect(wrapper.find('[data-testid="tern-review-bank"]').text()).toContain('Bank Central Asia (BCA) •••• 3456')
    expect(wrapper.find('[data-testid="tern-review-card"]').text()).toBe('The card on your Elev8 subscription')
    expect(wrapper.find('[data-testid="tern-step-card"]').exists()).toBe(false)
    await clickAndSettle(wrapper, 'tern-activate')
    expect(wrapper.find('[data-testid="tern-activation-done"]').text()).toContain('Damage waiver active')
    expect(useTernActivation().activation.value.ternOrganizationId).toMatch(/^tern_org_/)
    expect(wrapper.find('[data-testid="tern-activation-card"]').attributes('data-status')).toBe('active')
  })

  it('says so when Tern refuses, and keeps the details for the retry', async () => {
    useTernActivation().replayActivation()
    const wrapper = mountCard()
    await wrapper.find('[data-testid="tern-activate-open"]').trigger('click')
    await wrapper.find('[data-testid="tern-accept-terms"]').trigger('click')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    await wrapper.find('#tern-bank-holder').setValue('Elevate Schweiz GmbH')
    await wrapper.find('#tern-bank-name').setValue('AKB')
    await wrapper.find('#tern-bank-iban').setValue('CH93 0076 2011 6238 5295 7')
    await wrapper.find('#tern-bank-country').setValue('CH')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    await wrapper.find('#tern-simulate-failure').setValue(true)
    await clickAndSettle(wrapper, 'tern-activate')

    expect(wrapper.find('[data-testid="tern-registration-failed"]').text()).toContain('could not register')
    expect(wrapper.find('[data-testid="tern-activate"]').text()).toBe('Try again')
    expect(useTernActivation().activation.value).toMatchObject({ status: 'registration_failed', payoutBank: { bankName: 'AKB' } })
  })

  it('cannot activate without a card on the Elev8 subscription, and says why', async () => {
    useTernActivation().replayActivation()
    const onboarding = useOnboarding()
    onboarding.state.value = { ...onboarding.state.value, subscription: { ...onboarding.state.value.subscription, stripePaymentMethodId: null } }
    const wrapper = mountCard()
    await wrapper.find('[data-testid="tern-activate-open"]').trigger('click')
    await wrapper.find('[data-testid="tern-accept-terms"]').trigger('click')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    await wrapper.find('#tern-bank-holder').setValue('Elevate Schweiz GmbH')
    await wrapper.find('#tern-bank-name').setValue('AKB')
    await wrapper.find('#tern-bank-iban').setValue('CH93 0076 2011 6238 5295 7')
    await wrapper.find('#tern-bank-country').setValue('CH')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    expect(wrapper.find('[data-testid="tern-no-subscription-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tern-activate"]').attributes('disabled')).toBeDefined()
  })
})
