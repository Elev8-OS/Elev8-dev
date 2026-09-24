import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { formatProtectionAmount } from '~/components/reservations/data/damage-protection'
import DamageProtectionPolicySheet from '~/components/settings/DamageProtectionPolicySheet.vue'
import DamageProtectionSettingsPanel from '~/components/settings/DamageProtectionSettingsPanel.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { useDamageProtection } from '~/composables/useDamageProtection'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  // Every tab renders, so both can be asserted in one mount.
  Tabs: passthrough,
  TabsList: passthrough,
  TabsTrigger: { template: '<button><slot /></button>' },
  TabsContent: passthrough,
  // Honours `open`, so a closed sheet renders nothing.
  Sheet: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  SheetContent: passthrough,
  SheetHeader: passthrough,
  SheetTitle: passthrough,
  SheetDescription: passthrough,
  Select: { name: 'SelectStub', props: ['modelValue'], emits: ['update:modelValue'], template: '<div :data-value="modelValue"><slot /></div>' },
  SelectTrigger: passthrough,
  SelectValue: true,
  SelectContent: passthrough,
  SelectItem: { props: ['value', 'disabled'], template: '<div :data-disabled="disabled"><slot /></div>' },
  // A checkbox standing in for reka-ui, driven through model-value.
  Switch: { props: ['modelValue', 'id'], emits: ['update:modelValue'], template: '<input type="checkbox" :id="id" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)">' },
}
const COMPONENTS = { Badge, Button, Input, Label, Textarea }

function mountPanel() {
  return mount(DamageProtectionSettingsPanel, { global: { components: COMPONENTS, stubs: STUBS } })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('damage protection settings: policies', () => {
  it('shows each policy as a plain summary with where it is used', () => {
    const cards = mountPanel().findAll('[data-testid="policy-card"]')
    const standard = cards.find(c => c.text().includes('Standard stay'))!
    // Built with the same formatter: ICU groups thousands with a typographic apostrophe.
    expect(standard.text()).toContain(`Waiver: USD 39.00 per stay, covers up to ${formatProtectionAmount(2000, 'USD')}`)
    expect(standard.text()).toContain('Deposit: Card on file, charged up to USD 500.00 only for damage, decided within 7 days')
    expect(standard.find('[data-testid="policy-usage"]').text()).toBe('Used on 1 listing for short stays')
    const longStay = cards.find(c => c.text().includes('Long stay'))!
    expect(longStay.text()).toContain('Deposit: not offered')
  })

  it('will not delete a policy that listings still use', () => {
    const standard = mountPanel().findAll('[data-testid="policy-card"]').find(c => c.text().includes('Standard stay'))!
    expect(standard.find('[aria-label="Delete Standard stay"]').attributes('disabled')).toBeDefined()
  })

  it('says the insurance comes from Elev8, with nothing to configure', () => {
    expect(mountPanel().text()).toContain('insured by Demo Cover Partner through Elev8')
  })

  it('opens the editor for a new policy', async () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="policy-sheet"]').exists()).toBe(false)
    await wrapper.find('[data-testid="policy-new"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="policy-sheet"]').text()).toContain('New policy')
  })
})

describe('damage protection settings: listings', () => {
  it('shows each listing\'s short and long stay policy', () => {
    const rows = mountPanel().findAll('[data-testid="listing-row"]')
    const villa = rows.find(r => r.text().includes('5BR Pool the R Villa Luwa'))!
    expect(villa.find('[data-testid="slot-short"]').element.parentElement!.getAttribute('data-value')).toBe('dp-standard')
    expect(villa.find('[data-testid="slot-long"]').element.parentElement!.getAttribute('data-value')).toBe('dp-long-stay')
    const unset = rows.find(r => r.text().includes('Nomad Mansion Pool'))!
    expect(unset.find('[data-testid="slot-short"]').element.parentElement!.getAttribute('data-value')).toBe('none')
  })

  it('greys out a policy in another currency than the listing\'s payouts', () => {
    const row = mountPanel().findAll('[data-testid="listing-row"]').find(r => r.text().includes('The R Pererenan'))!
    expect(row.text()).toContain('(USD, payouts are IDR)')
  })

  it('offers to switch a listing with custom night ranges to the two standard slots', () => {
    useDamageProtection().assignBand('lst-6', 'dp-standard', 1, 7)
    const row = mountPanel().findAll('[data-testid="listing-row"]').find(r => r.text().includes('Nomad Mansion Pool'))!
    expect(row.text()).toContain('Uses custom night ranges.')
    expect(row.text()).toContain('Switch to short and long stays')
  })

  it('warns about listings with a policy but no choice screen in the guest guide', () => {
    expect(mountPanel().find('[data-testid="listings-attention"]').text()).toContain('never asked')
  })
})

describe('damage protection settings: assigning many listings at once', () => {
  /** Drive a stubbed Select the way reka-ui would: by emitting its new value. */
  function choose(wrapper: ReturnType<typeof mountPanel>, testid: string, value: string) {
    const select = wrapper.findAllComponents({ name: 'SelectStub' }).find(c => c.find(`[data-testid="${testid}"]`).exists())!
    select.vm.$emit('update:modelValue', value)
    return nextTick()
  }

  it('shows the bulk bar only once listings are ticked', async () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="bulk-bar"]').exists()).toBe(false)
    await wrapper.findAll('[data-testid="row-select"]')[0]!.trigger('click')
    expect(wrapper.find('[data-testid="bulk-bar"]').text()).toContain('1 selected')
  })

  it('selects every SHOWN listing, so a filter picks the group', async () => {
    const wrapper = mountPanel()
    await wrapper.find('[data-testid="listings-search"]').setValue('Apartments Pool')
    const shown = wrapper.findAll('[data-testid="listing-row"]').length
    expect(shown).toBeGreaterThan(1)
    await wrapper.find('[data-testid="select-all-shown"]').trigger('click')
    expect(wrapper.find('[data-testid="bulk-bar"]').text()).toContain(`${shown} selected`)
    expect(wrapper.find('[data-testid="select-all-shown"]').attributes('aria-checked')).toBe('true')
  })

  it('narrows to listings not set up yet', async () => {
    const wrapper = mountPanel()
    const all = wrapper.findAll('[data-testid="listing-row"]').length
    await choose(wrapper, 'listings-status', 'unset')
    const rows = wrapper.findAll('[data-testid="listing-row"]')
    expect(rows.length).toBeLessThan(all)
    expect(rows.some(r => r.text().includes('5BR Pool the R Villa Luwa'))).toBe(false)
  })

  it('applies one policy to every ticked listing and reports the skipped ones', async () => {
    const wrapper = mountPanel()
    const tick = (name: string) => wrapper.findAll('[data-testid="listing-row"]').find(r => r.text().includes(name))!.find('[data-testid="row-select"]').trigger('click')
    await tick('Nomad Mansion Pool')
    await tick('Villa Sunset Cliff')
    await tick('The R Pererenan')
    await choose(wrapper, 'bulk-short', 'dp-standard')
    await wrapper.find('[data-testid="bulk-apply"]').trigger('click')

    const slots = (id: string) => useDamageProtection().assignments.value.filter(a => a.listingId === id).map(a => a.policyId)
    expect(slots('lst-6')).toEqual(['dp-standard'])
    expect(slots('lst-8')).toEqual(['dp-standard'])
    expect(slots('lst-3')).toEqual([])
    expect(toast.success).toHaveBeenCalledWith('Applied to 2 listings')
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('1 skipped: The R Pererenan'))
    // The skipped one stays ticked, ready to deal with.
    expect(wrapper.find('[data-testid="bulk-bar"]').text()).toContain('1 selected')
  })

  it('asks for a choice before applying nothing', async () => {
    const wrapper = mountPanel()
    await wrapper.findAll('[data-testid="row-select"]')[0]!.trigger('click')
    await wrapper.find('[data-testid="bulk-apply"]').trigger('click')
    expect(toast.error).toHaveBeenCalledWith('Choose a policy for short stays, long stays, or both.')
  })
})

describe('the policy editor', () => {
  function mountSheet(policyId: string | null) {
    const policy = policyId ? useDamageProtection().policies.value.find(p => p.id === policyId)! : null
    const wrapper = mount(DamageProtectionPolicySheet, {
      props: { open: false, policy },
      global: { components: COMPONENTS, stubs: STUBS },
    })
    return wrapper.setProps({ open: true }).then(() => wrapper)
  }

  it('lists what is missing on a new policy instead of saving it', async () => {
    const wrapper = await mountSheet(null)
    await wrapper.find('[data-testid="policy-save"]').trigger('click')
    expect(wrapper.find('[data-testid="policy-errors"]').text()).toContain('Set the waiver fee.')
    expect(useDamageProtection().policies.value).toHaveLength(3)
  })

  it('hides an option\'s fields when it is turned off', async () => {
    const wrapper = await mountSheet('dp-standard')
    expect(wrapper.find('#policy-deposit-rate').exists()).toBe(true)
    await wrapper.find('#policy-offer-deposit').setValue(false)
    expect(wrapper.find('#policy-deposit-rate').exists()).toBe(false)
  })

  it('edits a draft: nothing changes until Save, and changed terms get a new version', async () => {
    const wrapper = await mountSheet('dp-standard')
    await wrapper.find('#policy-waiver-rate').setValue(45)
    await wrapper.find('#policy-terms').setValue('New wording')
    expect(useDamageProtection().policies.value.find(p => p.id === 'dp-standard')!.waiver.rate).toBe(39)
    expect(wrapper.find('[data-testid="policy-terms-version"]').text()).toContain('Saving will create terms version v2')

    await wrapper.find('[data-testid="policy-save"]').trigger('click')
    const saved = useDamageProtection().policies.value.find(p => p.id === 'dp-standard')!
    expect(saved.waiver.rate).toBe(45)
    expect(saved.termsText).toBe('New wording')
    expect(saved.termsVersion).toBe('v2')
  })

  it('keeps the version when the terms are unchanged', async () => {
    const wrapper = await mountSheet('dp-standard')
    await wrapper.find('#policy-waiver-cap').setValue(2500)
    await wrapper.find('[data-testid="policy-save"]').trigger('click')
    expect(useDamageProtection().policies.value.find(p => p.id === 'dp-standard')!.termsVersion).toBe('v1')
  })

  it('previews what guests see, waiver first', async () => {
    const wrapper = await mountSheet('dp-standard')
    const preview = wrapper.text()
    expect(preview.indexOf('Damage waiver')).toBeLessThan(preview.indexOf('Security deposit (card on file)', preview.indexOf('What guests see')))
  })
})
