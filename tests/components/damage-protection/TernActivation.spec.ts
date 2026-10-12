import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import TernActivationCard from '~/components/damage-protection/TernActivationCard.vue'
import { payoutAccounts } from '~/components/settings/data/payouts'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useOnboarding } from '~/composables/useOnboarding'
import { useTernActivation } from '~/composables/useTernActivation'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
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
  CoverageBreakdown: true,
  UpsellDrawer: true,
  Switch: { props: ['modelValue', 'id'], emits: ['update:modelValue'], template: '<input type="checkbox" :id="id" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)">' },
}

function mountCard() {
  return mount(TernActivationCard, { global: { components: { Button, Input, Label }, stubs: STUBS } })
}

/** The mocks wait 1.5s. Fake timers BEFORE the click, then drain them. */
async function clickAndSettle(wrapper: ReturnType<typeof mountCard>, testid: string) {
  // Only setTimeout: a faked clock would date click handlers rendered now in the future, and Vue drops the click.
  vi.useFakeTimers({ toFake: ['setTimeout'] })
  await wrapper.find(`[data-testid="${testid}"]`).trigger('click')
  await vi.runAllTimersAsync()
  vi.useRealTimers()
  await nextTick()
}

const SEEDED_ACCOUNTS = payoutAccounts.value

beforeEach(async () => {
  localStorage.clear()
  vi.clearAllMocks()
  // Activation needs every listing on a payout account: the seed leaves some out, so the Stripe one takes them.
  const { listings } = await import('~/components/listings/data/listings')
  const assigned = new Set(SEEDED_ACCOUNTS.flatMap(a => a.listingIds))
  const rest = listings.value.map(l => l.id).filter(id => !assigned.has(id))
  payoutAccounts.value = SEEDED_ACCOUNTS.map(a => a.provider === 'stripe' ? { ...a, listingIds: [...a.listingIds, ...rest] } : a)
})

afterEach(() => {
  payoutAccounts.value = SEEDED_ACCOUNTS
})

describe('the damage waiver activation', () => {
  it('refuses to activate until every listing has a payout account: Assign in Payouts instead of Activate', async () => {
    useTernActivation().replayActivation()
    payoutAccounts.value = SEEDED_ACCOUNTS
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="tern-activate-open"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tern-card-unassigned"]').text()).toContain('not assigned yet')
    expect(wrapper.find('[data-testid="tern-assign-payouts"]').exists()).toBe(true)
    expect(wrapper.find('a').attributes('href')).toBe('/settings/payouts')
  })

  it('shows an active tenant where Tern pays, and offers to change the bank account', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="tern-activation-card"]').attributes('data-status')).toBe('active')
    expect(wrapper.find('[data-testid="tern-card-bank"]').text()).toContain('Bank Central Asia (BCA) •••• 3456')
    expect(wrapper.find('[data-testid="tern-change-bank"]').exists()).toBe(true)
  })

  it('turns damage protection off on every listing from the card, next to the bank account', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="protection-turn-off"]').trigger('click')
    expect(useDamageProtection().settings.value).toMatchObject({ waiver: false, deposit: false })
    expect(wrapper.find('[data-testid="protection-turn-off"]').exists()).toBe(false)
  })

  it('walks the tenant through terms, the partner package and its price, and bank, then turns the waiver on everywhere', async () => {
    useTernActivation().replayActivation()
    const dp = useDamageProtection()
    dp.setProtectionSettings({ waiver: false, deposit: false })
    const wrapper = mountCard()
    await wrapper.find('[data-testid="tern-activate-open"]').trigger('click')
    expect(wrapper.find('[data-testid="tern-step-terms"]').exists()).toBe(true)

    // Terms: cannot move on without accepting them.
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    expect(wrapper.find('[data-testid="tern-step-terms"]').text()).toContain('Accept the terms')
    await wrapper.find('[data-testid="tern-accept-terms"]').trigger('click')
    // The package step reads the partner's packages (a mocked delay).
    await clickAndSettle(wrapper, 'tern-next')

    // Package: the partner's tiers, not upsells; the current package and its price to start with.
    expect(wrapper.find('[data-testid="tern-step-package"]').exists()).toBe(true)
    expect(wrapper.findAll('[role="radio"]').map(r => r.attributes('data-testid'))).toEqual([
      'tern-package-bronze',
      'tern-package-bronze_plus',
      'tern-package-silver',
      'tern-package-silver_plus',
      'tern-package-gold',
      'tern-package-gold_plus',
    ])
    expect(wrapper.find('[data-testid="tern-package-bronze"]').attributes('aria-checked')).toBe('true')
    expect((wrapper.find('[data-testid="tern-guest-price"]').element as HTMLInputElement).value).toBe('39')
    await wrapper.find('[data-testid="tern-package-gold"]').trigger('click')
    // The price must be set.
    await wrapper.find('[data-testid="tern-guest-price"]').setValue('')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    expect(wrapper.find('[data-testid="tern-step-package"]').text()).toContain('Set what the guest pays')
    await wrapper.find('[data-testid="tern-guest-price"]').setValue('79')
    expect(wrapper.find('[data-testid="tern-package-margin"]').text()).toContain('so you keep USD 54.00')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')

    // Who pays: the guest by default.
    expect(wrapper.find('[data-testid="tern-step-payer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tern-payer-guest"]').attributes('aria-checked')).toBe('true')
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
    expect(wrapper.find('[data-testid="tern-review-package"]').text()).toContain('Elev8 Cover Gold, guest pays USD 79.00')
    expect(wrapper.find('[data-testid="tern-step-card"]').exists()).toBe(false)
    // Guest pays: the review warns that guests cannot skip it.
    expect(wrapper.find('[data-testid="tern-review-payer"]').text()).toContain('The guest')
    expect(wrapper.find('[data-testid="tern-guest-paid-warning"]').text()).toContain('Guests cannot skip this')
    await clickAndSettle(wrapper, 'tern-activate')
    expect(wrapper.find('[data-testid="tern-activation-done"]').text()).toContain('Damage waiver active')
    expect(useTernActivation().activation.value.ternOrganizationId).toEqual(expect.any(Number))
    expect(wrapper.find('[data-testid="tern-activation-card"]').attributes('data-status')).toBe('active')
    // Written onto the waiver's one upsell, on every listing, with the deposit beside it.
    expect(dp.settings.value).toMatchObject({ waiver: true, deposit: true, packageServiceId: 'svc-dp-bronze' })
    expect(dp.currentPackage.value).toMatchObject({ serviceName: 'Elev8 Cover Gold', tier: 'gold', guestPrice: 79 })
    expect(dp.policyFor('lst-1', 5)?.waiver).toEqual({ tier: 'gold', guestPrice: 79 })
  })

  it('says so when Tern refuses, and keeps the details for the retry', async () => {
    useTernActivation().replayActivation()
    const wrapper = mountCard()
    await wrapper.find('[data-testid="tern-activate-open"]').trigger('click')
    await wrapper.find('[data-testid="tern-accept-terms"]').trigger('click')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    await wrapper.find('#tern-bank-holder').setValue('Elevate Schweiz GmbH')
    await wrapper.find('#tern-bank-name').setValue('AKB')
    await wrapper.find('#tern-bank-iban').setValue('CH93 0076 2011 6238 5295 7')
    await wrapper.find('#tern-bank-country').setValue('CH')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    await wrapper.find('#tern-simulate-failure').setValue(true)
    await clickAndSettle(wrapper, 'tern-activate')

    expect(wrapper.find('[data-testid="tern-registration-failed"]').text()).toContain('activation was refused')
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
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
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

describe('who pays at activation', () => {
  it('activates host-paid when the tenant picks it, with no guest warning on the review', async () => {
    useTernActivation().replayActivation()
    const dp = useDamageProtection()
    const wrapper = mountCard()
    await wrapper.find('[data-testid="tern-activate-open"]').trigger('click')
    await wrapper.find('[data-testid="tern-accept-terms"]').trigger('click')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    await wrapper.find('[data-testid="tern-payer-host"]').trigger('click')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    await wrapper.find('#tern-bank-holder').setValue('Elevate Schweiz GmbH')
    await wrapper.find('#tern-bank-name').setValue('AKB')
    await wrapper.find('#tern-bank-iban').setValue('CH93 0076 2011 6238 5295 7')
    await wrapper.find('#tern-bank-country').setValue('CH')
    await wrapper.find('[data-testid="tern-next"]').trigger('click')
    expect(wrapper.find('[data-testid="tern-review-payer"]').text()).toContain('host pays')
    expect(wrapper.find('[data-testid="tern-guest-paid-warning"]').exists()).toBe(false)
    await clickAndSettle(wrapper, 'tern-activate')
    expect(dp.settings.value).toMatchObject({ waiver: true, payer: 'host' })
  })
})

describe('the damage waiver activation without Stripe', () => {
  it('sends the tenant to Payouts instead of the wizard', () => {
    useTernActivation().replayActivation()
    const saved = payoutAccounts.value
    payoutAccounts.value = saved.filter(a => a.provider !== 'stripe')
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="tern-card-no-stripe"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tern-activate-open"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tern-connect-stripe"]').element.closest('a')!.getAttribute('href')).toBe('/settings/payouts')
    payoutAccounts.value = saved
  })
})
