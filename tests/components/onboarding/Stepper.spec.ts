import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Stepper from '~/components/onboarding/Stepper.vue'

describe('onboarding Stepper component', () => {
  it('renders a full-width top progress line instead of dots', () => {
    const wrapper = mount(Stepper, {
      props: {
        stepIndex: 0,
        totalSteps: 5,
      },
    })

    // Assert that dots are NOT rendered
    expect(wrapper.findAll('.rounded-full')).toHaveLength(0)

    // Assert that the container is fixed to the top and spans the full screen width with height 2.5
    const container = wrapper.find('[role="progressbar"]')
    expect(container.exists()).toBe(true)
    expect(container.classes()).toContain('fixed')
    expect(container.classes()).toContain('inset-x-0')
    expect(container.classes()).toContain('top-0')
    expect(container.classes()).toContain('h-2.5')
    expect(container.classes()).toContain('w-full')
  })

  it('renders the progress fill in primary yellow', () => {
    const wrapper = mount(Stepper, {
      props: {
        progress: 40,
      },
    })

    const fill = wrapper.find('.bg-\\[\\#F6BB12\\]')
    expect(fill.exists()).toBe(true)
    expect(fill.attributes('style')).toContain('width: 40%')
  })

  it('updates percentage correctly when stepIndex changes', async () => {
    const wrapper = mount(Stepper, {
      props: {
        stepIndex: 1,
        totalSteps: 5,
      },
    })

    expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('40')
    const fill = wrapper.find('.bg-\\[\\#F6BB12\\]')
    expect(fill.attributes('style')).toContain('width: 40%')

    await wrapper.setProps({ stepIndex: 3 })
    expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('80')
    expect(fill.attributes('style')).toContain('width: 80%')
  })

  it('uses direct progress percentage prop when provided', () => {
    const wrapper = mount(Stepper, {
      props: {
        progress: 65,
      },
    })

    expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('65')
    const fill = wrapper.find('.bg-\\[\\#F6BB12\\]')
    expect(fill.attributes('style')).toContain('width: 65%')
  })
})
