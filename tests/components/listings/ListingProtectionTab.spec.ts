import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { ternPitchFor } from '~/components/damage-protection/data/tern-pitch'
import { listings } from '~/components/listings/data/listings'
import ListingProtectionTab from '~/components/listings/ListingProtectionTab.vue'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import { payoutAccounts } from '~/components/settings/data/payouts'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { useDamageProtection } from '~/composables/useDamageProtection'
import { useReservationsModule } from '~/composables/useReservationsModule'
import { useTernActivation } from '~/composables/useTernActivation'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  Sheet: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  // Honours `open`, so a closed dialog renders nothing.
  Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  DialogContent: passthrough,
  DialogHeader: passthrough,
  DialogTitle: passthrough,
  DialogDescription: passthrough,
  DialogFooter: passthrough,
  SheetContent: passthrough,
  SheetHeader: passthrough,
  SheetTitle: passthrough,
  SheetDescription: passthrough,
  Select: { name: 'SelectStub', props: ['modelValue'], emits: ['update:modelValue'], template: '<div :data-value="modelValue"><slot /></div>' },
  SelectTrigger: passthrough,
  SelectValue: true,
  SelectContent: passthrough,
  SelectItem: { props: ['value', 'disabled'], template: '<div :data-disabled="disabled"><slot /></div>' },
  Switch: { props: ['modelValue', 'id', 'disabled'], emits: ['update:modelValue'], template: '<input type="checkbox" :id="id" :checked="modelValue" :disabled="disabled">' },
}
const COMPONENTS = { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Textarea }

function mountTab(listingId: string) {
  const listing = listings.value.find(l => l.id === listingId)!
  return mount(ListingProtectionTab, { props: { listing }, global: { components: COMPONENTS, stubs: STUBS } })
}

function slotValue(wrapper: ReturnType<typeof mountTab>, slot: 'short' | 'long') {
  return wrapper.find(`[data-testid="protection-slot-${slot}"]`).element.parentElement!.getAttribute('data-value')
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('listing protection tab', () => {
  it('shows who pays and the policy for short and long stays', () => {
    const wrapper = mountTab('lst-1')
    expect(wrapper.find('[data-testid="protection-mode-guest_paid"]').attributes('aria-checked')).toBe('true')
    expect(slotValue(wrapper, 'short')).toBe('dp-standard')
    expect(slotValue(wrapper, 'long')).toBe('dp-long-stay')
    const policies = wrapper.findAll('[data-testid="protection-policy"]')
    expect(policies.map(p => p.find('p.font-medium').text())).toEqual(['Standard stay', 'Long stay (28 nights and over)'])
    expect(policies[0]!.text()).toContain('Waiver: Tern Bronze')
    expect(policies[0]!.text()).toContain('Deposit: Card on file, charged up to USD 500.00')
  })

  it('flags a Tern tier too small for the property', () => {
    // lst-1 sleeps 10 and its short-stay policy is Bronze, sized for up to 4.
    expect(mountTab('lst-1').find('[data-testid="protection-undersized"]').text()).toContain('Gold is recommended')
  })

  it('lists only this listing\'s protected stays, each linked to its reservation', async () => {
    const wrapper = mountTab('lst-1')
    // All on one page, so every row can be compared.
    const size = wrapper.findAllComponents({ name: 'SelectStub' }).find(c => c.find('[data-testid="protection-stays-page-size"]').exists())!
    size.vm.$emit('update:modelValue', '50')
    await nextTick()
    const stays = wrapper.findAll('[data-testid="protection-stay"]')
    const ids = useDamageProtection().rows.value.filter(r => r.reservation.listingId === 'lst-1').map(r => r.reservation.id)
    expect(stays.length).toBe(ids.length)
    expect(stays.length).toBeGreaterThan(0)
    expect(stays.map(s => s.find('a').attributes('href')).sort())
      .toEqual(ids.map(id => `/reservations?reservation=${id}`).sort())
  })

  it('turns protection off and hides the policies', async () => {
    const wrapper = mountTab('lst-1')
    await wrapper.find('[data-testid="protection-mode-off"]').trigger('click')
    await nextTick()
    expect(useDamageProtection().listingMode('lst-1')).toBe('off')
    expect(wrapper.find('[data-testid="protection-policies"]').exists()).toBe(false)
  })

  it('turns a listing on with the standard policies', async () => {
    const wrapper = mountTab('lst-6')
    expect(wrapper.find('[data-testid="protection-mode-off"]').attributes('aria-checked')).toBe('true')
    await wrapper.find('[data-testid="protection-mode-guest_paid"]').trigger('click')
    await nextTick()
    expect(useDamageProtection().listingMode('lst-6')).toBe('guest_paid')
    expect(wrapper.find('[data-testid="protection-policies"]').exists()).toBe(true)
  })

  it('says the deposit is not asked where the host pays, and blocks a deposit-only policy', async () => {
    const wrapper = mountTab('lst-1')
    await wrapper.find('[data-testid="protection-mode-host_paid"]').trigger('click')
    await nextTick()
    expect(useDamageProtection().listingMode('lst-1')).toBe('host_paid')
    expect(wrapper.find('[data-testid="protection-policy"]').text()).toContain('Deposit: not asked, you pay for the waiver here')
    expect(wrapper.text()).toContain('(no waiver for you to pay for)')
  })

  it('changes a slot through the same write as the settings page', async () => {
    const wrapper = mountTab('lst-1')
    const select = wrapper.findAllComponents({ name: 'SelectStub' }).find(c => c.find('[data-testid="protection-slot-long"]').exists())!
    select.vm.$emit('update:modelValue', 'none')
    await nextTick()
    expect(slotValue(wrapper, 'long')).toBe('none')
    expect(useDamageProtection().assignments.value.some(a => a.listingId === 'lst-1' && a.minNights === 28)).toBe(false)
  })

  it('disables "Host pays" until the damage waiver is activated', async () => {
    useTernActivation().replayActivation()
    const wrapper = mountTab('lst-1')
    await nextTick()
    expect(wrapper.find('[data-testid="protection-not-activated"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="protection-mode-host_paid"]').attributes('disabled')).toBeDefined()
  })

  it('pages the protected stays, ten to a page', async () => {
    // Enough lst-1 stays for three pages, cloned from one the listing already protects.
    const { reservations } = useReservationsModule()
    const base = useDamageProtection().rows.value.find(r => r.reservation.listingId === 'lst-1')!.reservation
    const existing = useDamageProtection().rows.value.filter(r => r.reservation.listingId === 'lst-1').length
    const extra = Array.from({ length: 25 - existing }, (_, i) => ({ ...base, id: `res-page-${i}` }))
    reservations.value = [...reservations.value, ...extra]

    const wrapper = mountTab('lst-1')
    const page = () => wrapper.find('[data-testid="protection-stays-page"]').text()
    expect(wrapper.findAll('[data-testid="protection-stay"]').length).toBe(10)
    expect(page()).toBe('Page 1 of 3')
    expect(wrapper.find('[data-testid="protection-stays-pagination"]').text()).toContain('25 stays')

    await wrapper.find('[aria-label="Last page"]').trigger('click')
    expect(page()).toBe('Page 3 of 3')
    expect(wrapper.findAll('[data-testid="protection-stay"]').length).toBe(5)
    expect(wrapper.find('[aria-label="Next page"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[aria-label="Previous page"]').trigger('click')
    expect(page()).toBe('Page 2 of 3')

    // A bigger page size starts over on page one.
    const size = wrapper.findAllComponents({ name: 'SelectStub' }).find(c => c.find('[data-testid="protection-stays-page-size"]').exists())!
    size.vm.$emit('update:modelValue', '50')
    await nextTick()
    expect(page()).toBe('Page 1 of 1')
    expect(wrapper.findAll('[data-testid="protection-stay"]').length).toBe(25)
  })
})

describe('listing protection tab: VACATERN pitch', () => {
  it('does not pitch a tenant that has already activated', async () => {
    const wrapper = mountTab('lst-1')
    await nextTick()
    expect(wrapper.find('[data-testid="tern-promo"]').exists()).toBe(false)
  })

  it('pitches VACATERN on opening the tab before the waiver is activated', async () => {
    useTernActivation().replayActivation()
    const wrapper = mountTab('lst-1')
    await nextTick()
    const promo = wrapper.find('[data-testid="tern-promo"]')
    expect(promo.exists()).toBe(true)
    for (const pillar of ['Guest damage', 'Host liability', 'Bed bugs'])
      expect(promo.text()).toContain(pillar)
    // lst-1 sleeps 10: Gold is the tier sized for it.
    expect(promo.text()).toContain(`Cover every stay here up to ${formatProtectionAmount(10000, 'USD')}`)
    expect(promo.text()).toContain('so it takes Tern Gold')
  })

  it('starts the receipt from the listing\'s own waiver price, and works out a year', async () => {
    useTernActivation().replayActivation()
    const wrapper = mountTab('lst-1')
    await nextTick()
    const receipt = wrapper.find('[data-testid="tern-promo-receipt"]')
    // Standard stay charges guests USD 39.00; Gold costs USD 25.00.
    expect((receipt.find('[data-testid="tern-promo-price"]').element as HTMLInputElement).value).toBe('39')
    expect(receipt.find('[data-testid="tern-promo-margin"]').text()).toBe('USD 14.00')
    const listing = listings.value.find(l => l.id === 'lst-1')!
    const stays = ternPitchFor(listing, 'USD')!.staysPerYear
    expect(receipt.find('[data-testid="tern-promo-year"]').text()).toBe(formatProtectionAmount(14 * stays, 'USD'))
    expect(receipt.text()).toContain(`From about ${stays} stays a year: ${listing.stats.occupancyRate}% occupancy`)
  })

  it('recomputes as a price is tried, and says so when the host would pay the difference', async () => {
    useTernActivation().replayActivation()
    const wrapper = mountTab('lst-1')
    await nextTick()
    const price = wrapper.find('[data-testid="tern-promo-price"]')
    await price.setValue('60')
    expect(wrapper.find('[data-testid="tern-promo-margin"]').text()).toBe('USD 35.00')
    await price.setValue('10')
    const receipt = wrapper.find('[data-testid="tern-promo-receipt"]')
    expect(receipt.text()).toContain('You pay, per stay')
    expect(receipt.find('[data-testid="tern-promo-margin"]').text()).toBe('USD 15.00')
    expect(receipt.text()).toContain('It costs you about')
  })

  it('opens the activation wizard from the pitch, in place', async () => {
    useTernActivation().replayActivation()
    const wrapper = mountTab('lst-1')
    await nextTick()
    await wrapper.find('[data-testid="tern-promo-activate"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="tern-promo"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tern-activation"]').exists()).toBe(true)
  })

  it('closes on "Not now", and the banner still offers activation', async () => {
    useTernActivation().replayActivation()
    const wrapper = mountTab('lst-1')
    await nextTick()
    await wrapper.find('[data-testid="tern-promo-dismiss"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="tern-promo"]').exists()).toBe(false)
    await wrapper.find('[data-testid="protection-activate"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="tern-activation"]').exists()).toBe(true)
  })
})

describe('listing protection tab: no Stripe payout yet', () => {
  it('points the pitch and the banner at Payouts instead of activation', async () => {
    useTernActivation().replayActivation()
    const saved = payoutAccounts.value
    payoutAccounts.value = saved.filter(a => a.provider !== 'stripe')
    const wrapper = mountTab('lst-1')
    await nextTick()
    expect(wrapper.find('[data-testid="tern-promo-no-stripe"]').text()).toContain('connect a Stripe payout account')
    expect(wrapper.find('[data-testid="tern-promo-activate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tern-promo-connect-stripe"]').element.closest('a')!.getAttribute('href')).toBe('/settings/payouts')
    expect(wrapper.find('[data-testid="protection-activate"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="protection-connect-stripe"]').exists()).toBe(true)
    payoutAccounts.value = saved
  })
})
