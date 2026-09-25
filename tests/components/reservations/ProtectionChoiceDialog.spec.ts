import type { ProtectionOptionView } from '~/components/reservations/data/damage-protection'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProtectionChoiceDialog from '~/components/reservations/ProtectionChoiceDialog.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

const OPTIONS: ProtectionOptionView[] = [
  { option: 'waiver', amount: 39, currency: 'USD', coverageCap: 2000, exclusions: [], isDefault: true },
  { option: 'deposit', amount: 500, currency: 'USD', settleWithinDays: 7, isDefault: false },
]

const NEXT_YEAR = `12/${String((new Date().getFullYear() + 1) % 100).padStart(2, '0')}`

async function mountDialog() {
  const wrapper = mount(ProtectionChoiceDialog, {
    props: { open: false, options: OPTIONS, termsText: 'Terms' },
    global: {
      components: { Button, Input, Label },
      stubs: {
        Icon: true,
        Dialog: { props: ['open'], template: '<div v-if="open !== false"><slot /></div>' },
        DialogContent: { template: '<div><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        DialogDescription: { template: '<div><slot /></div>' },
        DialogFooter: { template: '<div><slot /></div>' },
        // Plain controls standing in for reka-ui, driven through model-value.
        Checkbox: { props: ['modelValue', 'id'], emits: ['update:modelValue'], template: '<input type="checkbox" :id="id" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)">' },
        Switch: { props: ['modelValue', 'id'], emits: ['update:modelValue'], template: '<input type="checkbox" :id="id" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)">' },
      },
    },
  })
  await wrapper.setProps({ open: true })
  return wrapper
}

function pick(wrapper: Awaited<ReturnType<typeof mountDialog>>, label: string) {
  return wrapper.findAll('[role="radio"]').find(r => r.text().includes(label))!.trigger('click')
}

function submit(wrapper: Awaited<ReturnType<typeof mountDialog>>) {
  return wrapper.findAll('button').find(b => /Record choice|Save card and record/.test(b.text()))!.trigger('click')
}

describe('protectionChoiceDialog', () => {
  it('pre-selects the waiver and lists it first', async () => {
    const wrapper = await mountDialog()
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios[0]!.text()).toContain('Damage waiver')
    expect(radios[0]!.attributes('aria-checked')).toBe('true')
    expect(wrapper.find('[data-testid="choice-card-form"]').exists()).toBe(false)
  })

  it('records a waiver with the terms alone', async () => {
    const wrapper = await mountDialog()
    await wrapper.find('#choice-terms').setValue(true)
    await submit(wrapper)
    expect(wrapper.emitted('submit')![0]).toEqual([{ option: 'waiver', termsAccepted: true }])
  })

  it('asks a deposit for a card and consent to a charge after check-out, in the exact words frozen onto it', async () => {
    const wrapper = await mountDialog()
    await pick(wrapper, 'Security deposit')
    expect(wrapper.find('[data-testid="choice-card-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="choice-mandate"]').text()).toContain('up to USD 500.00, only for damage recorded during my stay')
  })

  it('refuses a bad card, then a missing consent, and records nothing', async () => {
    const wrapper = await mountDialog()
    await pick(wrapper, 'Security deposit')
    await wrapper.find('#choice-terms').setValue(true)
    await wrapper.find('#choice-card-number').setValue('4242 4242 4242 4241')
    await wrapper.find('#choice-card-expiry').setValue(NEXT_YEAR)
    await wrapper.find('#choice-card-cvc').setValue('123')
    await submit(wrapper)
    expect(wrapper.text()).toContain('Check the card number.')

    await wrapper.find('#choice-card-number').setValue('4242 4242 4242 4242')
    await submit(wrapper)
    expect(wrapper.text()).toContain('The guest has to agree to the card being charged after check-out.')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('hands back the card as typed, the consent and the decline switch for the caller to save', async () => {
    const wrapper = await mountDialog()
    await pick(wrapper, 'Security deposit')
    await wrapper.find('#choice-terms').setValue(true)
    await wrapper.find('#choice-card-number').setValue('4242 4242 4242 4242')
    await wrapper.find('#choice-card-expiry').setValue(NEXT_YEAR)
    await wrapper.find('#choice-card-cvc').setValue('123')
    await wrapper.find('#choice-charge-consent').setValue(true)
    await wrapper.find('#choice-simulate-decline').setValue(true)
    await submit(wrapper)
    expect(wrapper.emitted('submit')![0]).toEqual([{
      option: 'deposit',
      termsAccepted: true,
      chargeConsent: true,
      cardInput: { number: '4242 4242 4242 4242', expiry: NEXT_YEAR, cvc: '123' },
      simulateDecline: true,
    }])
  })
})
