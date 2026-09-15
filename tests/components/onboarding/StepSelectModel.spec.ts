import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import StepSelectModel from '~/components/onboarding/StepSelectModel.vue'
import { useOnboarding } from '~/composables/useOnboarding'

const passthrough = (tag: string) => ({ template: `<${tag}><slot /></${tag}>` })

const globalOptions = {
  stubs: {
    Card: passthrough('div'),
    CardHeader: passthrough('header'),
    CardTitle: passthrough('h4'),
    CardDescription: passthrough('p'),
    CardContent: passthrough('div'),
    CardFooter: passthrough('footer'),
    Badge: passthrough('span'),
    Button: {
      props: ['variant', 'disabled'],
      emits: ['click'],
      template: '<button :class="variant" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    Icon: { props: ['name'], template: '<i :data-icon="name" />' },
  },
}

beforeEach(() => {
  localStorage.clear()
  const ob = useOnboarding()
  ob.startTenant('owner@example.com')
})

describe('stepSelectModel component', () => {
  it('renders three setup cards with icons at top and no radiobox', () => {
    const wrapper = mount(StepSelectModel, { global: globalOptions })

    // Check that icons exist at top of cards
    const icons = wrapper.findAll('i[data-icon]')
    const iconNames = icons.map(i => i.attributes('data-icon'))
    expect(iconNames).toContain('lucide:layers')
    expect(iconNames).toContain('lucide:plug')
    expect(iconNames).toContain('lucide:arrow-right-left')

    // Ensure no circular radiobox checkmark spans exist in header
    expect(wrapper.findAll('.rounded-full.border-input')).toHaveLength(0)
  })

  it('renders action buttons at the bottom of each card', () => {
    const wrapper = mount(StepSelectModel, { global: globalOptions })
    const buttons = wrapper.findAll('footer button')
    expect(buttons).toHaveLength(3)
  })

  it('selecting a model via card button updates onboarding state and emits next', async () => {
    const wrapper = mount(StepSelectModel, { global: globalOptions })
    const ob = useOnboarding()

    // Click the button in the second card (PMS_ONLY)
    const buttons = wrapper.findAll('footer button')
    await buttons[1].trigger('click')

    expect(ob.state.value.pmsModel).toBe('PMS_ONLY')
    expect(wrapper.emitted('next')).toBeTruthy()
  })

  it('clicking the first card button chooses PMS_CM and emits next', async () => {
    const wrapper = mount(StepSelectModel, { global: globalOptions })
    const ob = useOnboarding()

    const buttons = wrapper.findAll('footer button')
    await buttons[0].trigger('click')

    expect(ob.state.value.pmsModel).toBe('PMS_CM')
    expect(wrapper.emitted('next')).toBeTruthy()
  })

  it('uses high contrast icon colors on light backgrounds (not yellow on light)', () => {
    const wrapper = mount(StepSelectModel, { global: globalOptions })
    const iconBoxes = wrapper.findAll('.size-11')
    expect(iconBoxes).toHaveLength(3)

    // Unselected cards should use text-foreground, not text-primary
    const unselectedBoxes = iconBoxes.filter(box => !box.classes().includes('bg-primary'))
    for (const box of unselectedBoxes) {
      expect(box.classes()).toContain('text-foreground')
      expect(box.classes()).not.toContain('text-primary')
    }
  })

  it('highlights the recommended option (PMS_CM) by default', () => {
    const wrapper = mount(StepSelectModel, { global: globalOptions })
    const buttons = wrapper.findAll('footer button')

    // Recommended is first card (PMS_CM), should have default variant by default
    expect(buttons[0].classes()).toContain('default')
    expect(buttons[1].classes()).toContain('outline')
    expect(buttons[2].classes()).toContain('outline')
  })

  it('shows Continue with this setup only when hovering the button', async () => {
    const wrapper = mount(StepSelectModel, { global: globalOptions })
    const buttons = wrapper.findAll('footer button')

    // Before hover: shows default labels
    expect(buttons[0].text()).toBe('Select Full Platform')
    expect(buttons[1].text()).toBe('Connect Current PMS')
    expect(buttons[2].text()).toBe('Start Migration')

    // Hover button 0 (PMS_CM)
    await buttons[0].trigger('mouseenter')
    expect(buttons[0].text()).toBe('Continue with this setup')

    // Mouse leave button 0
    await buttons[0].trigger('mouseleave')
    expect(buttons[0].text()).toBe('Select Full Platform')

    // Hover button 1 (PMS_ONLY)
    await buttons[1].trigger('mouseenter')
    expect(buttons[1].text()).toBe('Continue with this setup')
  })

  it('does not trigger selection or next when clicking on the card itself', async () => {
    const wrapper = mount(StepSelectModel, { global: globalOptions })
    const ob = useOnboarding()

    // Find card header or card body (outside footer button)
    const headers = wrapper.findAll('header')
    await headers[1].trigger('click')

    // State should remain unchanged (not PMS_ONLY) and no 'next' event emitted
    expect(ob.state.value.pmsModel).toBeNull()
    expect(wrapper.emitted('next')).toBeUndefined()
  })

  it('does not highlight the card container on hover, only changes the button', async () => {
    const wrapper = mount(StepSelectModel, { global: globalOptions })
    const buttons = wrapper.findAll('footer button')
    const cards = wrapper.findAll('.grid.items-stretch > *')

    // Initial state: Card 0 (PMS_CM) has primary highlight
    expect(cards[0].classes()).toContain('border-primary')
    expect(cards[1].classes()).not.toContain('border-primary')

    // Hover button on Card 1 (PMS_ONLY)
    await buttons[1].trigger('mouseenter')

    // Button 1 changes text and variant
    expect(buttons[1].text()).toBe('Continue with this setup')
    expect(buttons[1].classes()).toContain('default')

    // But Card 1 does NOT get highlighted with primary border
    expect(cards[1].classes()).not.toContain('border-primary')
    expect(cards[1].classes()).toContain('border-border/80')

    // Card 0 remains the highlighted choice
    expect(cards[0].classes()).toContain('border-primary')
  })
})
