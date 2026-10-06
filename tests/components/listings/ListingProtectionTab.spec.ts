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
import { useUpsellServices } from '~/composables/useUpsellServices'

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
  UpsellDrawer: { name: 'UpsellDrawerStub', props: ['open', 'service', 'initialCategory', 'initialListings'], emits: ['saved', 'update:open'], template: '<div data-testid="upsell-drawer" />' },
  Switch: { name: 'SwitchStub', props: ['modelValue', 'id', 'disabled'], emits: ['update:modelValue'], template: '<input type="checkbox" :id="id" :checked="modelValue" :disabled="disabled">' },
}
const COMPONENTS = { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Textarea }

function mountTab(listingId: string) {
  const listing = listings.value.find(l => l.id === listingId)!
  return mount(ListingProtectionTab, { props: { listing }, global: { components: COMPONENTS, stubs: STUBS } })
}

/** No Damage Protection upsell at all: the tab's "no package yet" state. */
function removeAllPackages() {
  const { services, deleteService } = useUpsellServices()
  for (const s of services.value.filter(s => s.category === 'Damage Protection'))
    deleteService(s.id)
}

function flip(wrapper: ReturnType<typeof mountTab>, testid: string, value: boolean) {
  const control = wrapper.findAllComponents({ name: 'SwitchStub' }).find(c => c.attributes('data-testid') === testid)!
  control.vm.$emit('update:modelValue', value)
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('listing protection tab', () => {
  it('shows who pays, both options on, and the package from the protection upsell', () => {
    const wrapper = mountTab('lst-1')
    expect(wrapper.find('[data-testid="protection-mode-guest_paid"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[data-testid="protection-waiver-switch"]').attributes('checked')).toBeDefined()
    expect(wrapper.find('[data-testid="protection-deposit-switch"]').attributes('checked')).toBeDefined()
    expect(wrapper.find('[data-testid="protection-package"]').element.parentElement!.getAttribute('data-value')).toBe('svc-dp-bronze')
    expect(wrapper.find('[data-testid="protection-package-summary"]').text()).toContain('Elev8 Cover Bronze')
    expect(wrapper.find('[data-testid="protection-options"]').text()).toContain('Card on file, charged up to USD 500.00')
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

  it('turns protection off by taking the listing out of the protection upsell', async () => {
    const wrapper = mountTab('lst-1')
    await wrapper.find('[data-testid="protection-remove"]').trigger('click')
    await nextTick()
    expect(useDamageProtection().listingMode('lst-1')).toBe('off')
    expect(useUpsellServices().services.value.find(s => s.id === 'svc-dp-bronze')!.assignedListings).not.toContain(listings.value.find(l => l.id === 'lst-1')!.name)
    expect(wrapper.find('[data-testid="protection-status"]').text()).toContain('Off.')
    expect(wrapper.find('[data-testid="protection-payer"]').exists()).toBe(false)
  })

  it('turns the waiver on through the Elev8 Cover benefits, adding the listing to the first package\'s upsell', async () => {
    const wrapper = mountTab('lst-17')
    expect(wrapper.find('[data-testid="protection-status"]').text()).toContain('Off.')
    flip(wrapper, 'protection-waiver-switch', true)
    await nextTick()
    // The benefits come first; nothing changes until the host says yes.
    expect(wrapper.find('[data-testid="tern-promo"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tern-promo-activate"]').text()).toContain('Turn on damage waiver')
    expect(useDamageProtection().listingMode('lst-17')).toBe('off')
    await wrapper.find('[data-testid="tern-promo-activate"]').trigger('click')
    await nextTick()
    expect(useUpsellServices().services.value.find(s => s.id === 'svc-dp-bronze')!.assignedListings).toContain('Apartments Pool - Room 2')
    expect(useDamageProtection().listingMode('lst-17')).toBe('guest_paid')
    expect(wrapper.find('[data-testid="protection-package"]').exists()).toBe(true)
  })

  it('leaves the waiver off on "Not now"', async () => {
    const wrapper = mountTab('lst-17')
    flip(wrapper, 'protection-waiver-switch', true)
    await nextTick()
    await wrapper.find('[data-testid="tern-promo-dismiss"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="tern-promo"]').exists()).toBe(false)
    expect(useDamageProtection().listingMode('lst-17')).toBe('off')
  })

  it('takes a deposit only with the deposit switch, no upsell needed', async () => {
    // lst-18 is on Stripe; out of the Silver upsell, it is off.
    const { services, updateService } = useUpsellServices()
    updateService('svc-dp-silver', { assignedListings: services.value.find(s => s.id === 'svc-dp-silver')!.assignedListings.filter(n => n !== 'Apartments Pool - Room 3') })
    const wrapper = mountTab('lst-18')
    flip(wrapper, 'protection-deposit-switch', true)
    await nextTick()
    expect(useDamageProtection().policyFor('lst-18', 5)?.offers).toEqual(['deposit'])
    expect(wrapper.find('[data-testid="protection-status"]').text()).toContain('Deposit only.')
  })

  it('switches the waiver off by taking the listing out of the upsell, keeping the deposit', async () => {
    const wrapper = mountTab('lst-1')
    flip(wrapper, 'protection-waiver-switch', false)
    await nextTick()
    expect(useUpsellServices().services.value.find(s => s.id === 'svc-dp-bronze')!.assignedListings).not.toContain(listings.value.find(l => l.id === 'lst-1')!.name)
    expect(useDamageProtection().policyFor('lst-1', 5)?.offers).toEqual(['deposit'])
    flip(wrapper, 'protection-deposit-switch', false)
    await nextTick()
    expect(useDamageProtection().listingMode('lst-1')).toBe('off')
  })

  it('offers to create a package when there is no protection upsell to switch on', async () => {
    removeAllPackages()
    const wrapper = mountTab('lst-17')
    expect(wrapper.find('[data-testid="protection-waiver-switch"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="protection-waiver-missing"]').text()).toContain('Create a package')
  })

  it('creates a package from the listing, opening the upsell form on Damage Protection with this listing ticked', async () => {
    const { addService } = useUpsellServices()
    removeAllPackages()
    const wrapper = mountTab('lst-17')
    expect(wrapper.find('[data-testid="upsell-drawer"]').exists()).toBe(false)
    await wrapper.find('[data-testid="protection-new-package"]').trigger('click')
    await nextTick()
    const drawer = wrapper.findComponent({ name: 'UpsellDrawerStub' })
    expect(drawer.props('initialCategory')).toBe('Damage Protection')
    expect(drawer.props('initialListings')).toEqual(['Apartments Pool - Room 2'])
    // What the drawer does on save: the new upsell, with this listing in it.
    const created = addService({
      ...useUpsellServices().services.value[0]!,
      name: 'Elev8 Cover Gold',
      category: 'Damage Protection',
      currency: 'USD',
      items: [{ id: 'itm-gold', name: 'Gold', price: 99, coverTier: 'gold' }],
      assignedListings: ['Apartments Pool - Room 2'],
      status: 'active',
    })
    drawer.vm.$emit('saved', created)
    await nextTick()
    expect(useDamageProtection().policyFor('lst-17', 5)?.waiver).toEqual({ tier: 'gold', guestPrice: 99 })
  })

  it('picks the booking channels a deposit on its own is asked on', async () => {
    // lst-2 offers the deposit only, Direct.
    const wrapper = mountTab('lst-2')
    await wrapper.find('[data-testid="protection-deposit-channel-Airbnb"]').trigger('click')
    await nextTick()
    expect(useDamageProtection().policyFor('lst-2', 5)?.channelPolicy).toEqual({ Airbnb: 'offer', Direct: 'offer' })
    await wrapper.find('[data-testid="protection-deposit-channel-Direct"]').trigger('click')
    await wrapper.find('[data-testid="protection-deposit-channel-Airbnb"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="protection-block"]').text()).toContain('Pick at least one booking channel')
  })

  it('shows every channel on and locked while the waiver is on', async () => {
    const wrapper = mountTab('lst-1')
    const airbnb = wrapper.find('[data-testid="protection-deposit-channel-Airbnb"]')
    expect(airbnb.attributes('aria-checked')).toBe('true')
    await airbnb.trigger('click')
    expect(useDamageProtection().setupFor('lst-1').depositChannels).toBeUndefined()
  })

  it('changes the package by moving the listing to the other upsell', async () => {
    const wrapper = mountTab('lst-1')
    const select = wrapper.findAllComponents({ name: 'SelectStub' }).find(c => c.find('[data-testid="protection-package"]').exists())!
    select.vm.$emit('update:modelValue', 'svc-dp-silver')
    await nextTick()
    expect(useDamageProtection().policyFor('lst-1', 5)?.waiver).toEqual({ tier: 'silver', guestPrice: 59 })
    const luwa = listings.value.find(l => l.id === 'lst-1')!.name
    expect(useUpsellServices().services.value.find(s => s.id === 'svc-dp-bronze')!.assignedListings).not.toContain(luwa)
  })

  it('does not ask for a deposit where the host pays', async () => {
    const wrapper = mountTab('lst-1')
    await wrapper.find('[data-testid="protection-mode-host_paid"]').trigger('click')
    await nextTick()
    expect(useDamageProtection().listingMode('lst-1')).toBe('host_paid')
    expect(wrapper.find('[data-testid="protection-deposit"]').text()).toContain('Not asked where you pay for the cover')
    expect(wrapper.find('[data-testid="protection-deposit-switch"]').attributes('disabled')).toBeDefined()
  })

  it('refuses "Host pays" on a deposit-only listing', () => {
    const wrapper = mountTab('lst-2')
    expect(wrapper.find('[data-testid="protection-mode-host_paid"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="protection-mode-host_paid"]').text()).toContain('Turn on the damage waiver first')
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
    expect(promo.text()).toContain('so it takes Elev8 Cover Gold')
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
    expect(receipt.text()).toContain('You pay, per 30 nights')
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
