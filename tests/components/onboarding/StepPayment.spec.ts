// Card fields format as the tenant types. They run through the real shadcn Input,
// since the bug they guard against (digits jumping and doubling) came from binding
// `:value` + `@input` next to the Input's own internal v-model.

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StepPayment from '~/components/onboarding/StepPayment.vue'
import Input from '~/components/ui/input/Input.vue'
import { useOnboarding } from '~/composables/useOnboarding'

const passthrough = (tag: string) => ({ template: `<${tag}><slot /></${tag}>` })

const globalOptions = {
  components: { Input },
  stubs: {
    Label: passthrough('label'),
    Switch: true,
    Button: { template: '<button><slot /></button>' },
    Icon: { props: ['name'], template: '<i :data-icon="name" />' },
  },
}

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

function mountPayment() {
  const ob = useOnboarding()
  ob.selectModel('PMS_CM')
  ob.selectPlan({ pricingModel: 'per_unit', planCode: 'PER_UNIT_GROWTH', billingCycle: 'monthly', unitCount: 8 })
  return mount(StepPayment, { global: globalOptions })
}

/** Types one character at a time, the way a keyboard does. */
async function typeInto(el: HTMLInputElement, chars: string): Promise<void> {
  for (const ch of chars) {
    el.value += ch
    el.dispatchEvent(new Event('input'))
    await new Promise(r => setTimeout(r, 0))
  }
}

describe('stepPayment card fields', () => {
  it('groups the card number in fours without dropping or doubling digits', async () => {
    const wrapper = mountPayment()
    const el = wrapper.find<HTMLInputElement>('#ob-cc-number').element
    await typeInto(el, '42424242')
    expect(el.value).toBe('4242 4242')
    await typeInto(el, '424242424242')
    // Capped at sixteen digits.
    expect(el.value).toBe('4242 4242 4242 4242')
  })

  it('drops letters even when the formatted text does not change', async () => {
    const wrapper = mountPayment()
    const el = wrapper.find<HTMLInputElement>('#ob-cc-number').element
    await typeInto(el, '4242a')
    expect(el.value).toBe('4242')
  })

  it('formats the expiry as MM / YY and lets backspace past the slash', async () => {
    const wrapper = mountPayment()
    const el = wrapper.find<HTMLInputElement>('#ob-cc-expiry').element
    await typeInto(el, '1228')
    expect(el.value).toBe('12 / 28')

    for (const _ of [1, 2]) {
      el.value = el.value.slice(0, -1)
      el.dispatchEvent(new Event('input'))
      await new Promise(r => setTimeout(r, 0))
    }
    expect(el.value).toBe('12')
  })
})
