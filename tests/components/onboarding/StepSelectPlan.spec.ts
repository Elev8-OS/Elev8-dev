import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import StepSelectPlan from '~/components/onboarding/StepSelectPlan.vue'
import { useOnboarding } from '~/composables/useOnboarding'

const passthrough = (tag: string) => ({ template: `<${tag}><slot /></${tag}>` })

const globalOptions = {
  stubs: {
    Tabs: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<div data-tabs :data-model="modelValue"><slot /></div>',
    },
    TabsList: passthrough('div'),
    TabsTrigger: {
      props: ['value'],
      emits: ['click'],
      template: '<button type="button" :data-value="value" @click="$emit(\'click\')"><slot /></button>',
    },
    TabsContent: {
      props: ['value'],
      template: '<div data-tab-content :data-value="value"><slot /></div>',
    },
    Badge: passthrough('span'),
    Button: {
      props: ['variant', 'disabled', 'type'],
      emits: ['click'],
      template: '<button :type="type || \'button\'" :class="variant" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    Input: {
      props: ['modelValue', 'type', 'min', 'id'],
      emits: ['update:modelValue'],
      template: '<input :id="id" :type="type" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
    },
    Label: passthrough('label'),
    Icon: { props: ['name'], template: '<i :data-icon="name" />' },
  },
}

beforeEach(() => {
  localStorage.clear()
  const ob = useOnboarding()
  ob.startTenant('owner@example.com')
  ob.selectModel('PMS_CM')
})

describe('stepSelectPlan component', () => {
  it('formats every price using currency code USD, never with the $ symbol', () => {
    const wrapper = mount(StepSelectPlan, { global: globalOptions })

    // Check that USD code is present in prices
    expect(wrapper.text()).toContain('USD 69')

    // Strictly ensure no $ symbol exists anywhere in the rendered text
    expect(wrapper.text()).not.toContain('$')
  })

  it('renders a centered Monthly / Yearly switch with a discount badge', () => {
    const wrapper = mount(StepSelectPlan, { global: globalOptions })

    expect(wrapper.text()).toContain('Monthly')
    expect(wrapper.text()).toContain('Yearly')
    expect(wrapper.text()).toContain('Save ~8%')

    const switchBtn = wrapper.find('#ob-cycle-switch')
    expect(switchBtn.exists()).toBe(true)
    expect(switchBtn.attributes('aria-checked')).toBe('false') // defaults to monthly
  })

  it('switches billing cycle and updates prices when clicking toggle switch', async () => {
    const wrapper = mount(StepSelectPlan, { global: globalOptions })

    // Initially monthly: Starter rate is USD 69
    expect(wrapper.text()).toContain('USD 69')

    const switchBtn = wrapper.find('#ob-cycle-switch')
    await switchBtn.trigger('click')

    // Now yearly: Starter rate is USD 63.25
    expect(wrapper.text()).toContain('USD 63.25')
    expect(switchBtn.attributes('aria-checked')).toBe('true')

    // Click again to switch back to monthly
    await switchBtn.trigger('click')
    expect(wrapper.text()).toContain('USD 69')
    expect(switchBtn.attributes('aria-checked')).toBe('false')
  })

  it('switches billing cycle when clicking the Yearly text button', async () => {
    const wrapper = mount(StepSelectPlan, { global: globalOptions })

    expect(wrapper.text()).toContain('USD 69')

    const yearlyBtn = wrapper.findAll('button').find(b => b.text() === 'Yearly')
    expect(yearlyBtn).toBeDefined()
    await yearlyBtn!.trigger('click')

    expect(wrapper.text()).toContain('USD 63.25')
  })

  it('does not render continue buttons or plan includes inside the cards', () => {
    const wrapper = mount(StepSelectPlan, { global: globalOptions })

    // No Continue button inside cards
    const continueButtons = wrapper.findAll('button').filter(b => b.text().trim() === 'Continue')
    expect(continueButtons).toHaveLength(0)

    // No "Plan includes" subhead
    expect(wrapper.text()).not.toContain('Plan includes')
  })

  it('renders clean rates breakdown and plan info in each card', () => {
    const wrapper = mount(StepSelectPlan, { global: globalOptions })

    // Check plan titles exist
    expect(wrapper.text()).toContain('Starter')
    expect(wrapper.text()).toContain('Growth')
    expect(wrapper.text()).toContain('Pro')
    expect(wrapper.text()).toContain('Enterprise')

    // Check rates breakdown dt exist
    expect(wrapper.text()).toContain('Monthly rate')
    expect(wrapper.text()).toContain('Yearly rate')
    expect(wrapper.text()).toContain('Package floor')
  })

  it('highlights the user\'s current tier with a Your tier badge based on unit count', async () => {
    const wrapper = mount(StepSelectPlan, { global: globalOptions })

    // Unit count 1 -> Starter has "Your tier" badge
    expect(wrapper.text()).toContain('Your tier')

    // Change unit count to 10 (falls into Growth tier)
    const input = wrapper.find('input#ob-units')
    await input.setValue(10)

    const cards = wrapper.findAll('.rounded-xl')
    const growthCard = cards.find(c => c.text().includes('Growth'))
    expect(growthCard?.text()).toContain('Your tier')
  })

  it('clicking a plan card updates unit count to match that plan floor', async () => {
    const wrapper = mount(StepSelectPlan, { global: globalOptions })

    const cards = wrapper.findAll('.rounded-xl')
    const proCard = cards.find(c => c.text().includes('Pro'))
    expect(proCard).toBeDefined()

    await proCard!.trigger('click')

    // Pro has floor 20, so clicking Pro sets unitCount to 20
    const input = wrapper.find('input#ob-units')
    expect((input.element as HTMLInputElement).value).toBe('20')
    expect(proCard?.text()).toContain('Your tier')
  })
})
