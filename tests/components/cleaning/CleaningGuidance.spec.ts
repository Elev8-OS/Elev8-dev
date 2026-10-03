import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import CleaningJobChecklist from '~/components/cleaning/CleaningJobChecklist.vue'
import CleaningStepsEditor from '~/components/cleaning/CleaningStepsEditor.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

const passthrough = { template: '<div><slot /></div>' }

describe('guidance in the steps editor', () => {
  it('attaches guidance to a step and counts it on the step\'s button', async () => {
    const wrapper = mount(CleaningStepsEditor, {
      props: {
        'modelValue': [{ id: 's', title: 'Beds', steps: [{ id: '1', label: 'Make beds' }] }],
        'onUpdate:modelValue': (v: unknown) => wrapper.setProps({ modelValue: v as never }),
      },
      global: {
        components: { Button, Input },
        stubs: { Icon: true, Popover: passthrough, PopoverTrigger: passthrough, PopoverContent: passthrough, NuxtLink: { template: '<a><slot /></a>' } },
      },
    })
    const option = wrapper.findAll('[data-testid="step-guidance-option"]').find(o => o.text().includes('Making a bed'))!
    await option.trigger('click')
    await nextTick()
    expect((wrapper.props('modelValue') as Array<{ steps: Array<{ guidanceIds?: string[] }> }>)[0]!.steps[0]!.guidanceIds).toEqual(['gd-bed'])
    expect(wrapper.get('[data-testid="step-guidance-trigger"]').attributes('aria-label')).toContain('1 guidance attached')
  })
})

describe('guidance on the job checklist', () => {
  it('shows the step\'s guidance and opens it', async () => {
    const wrapper = mount(CleaningJobChecklist, {
      props: { steps: [{ id: 's', title: 'Beds', steps: [{ id: '1', label: 'Make beds', guidanceIds: ['gd-bed', 'gone'] }] }] },
      global: {
        stubs: {
          Icon: true,
          Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
          DialogContent: passthrough,
          DialogHeader: passthrough,
          DialogTitle: passthrough,
          DialogDescription: passthrough,
        },
      },
    })
    const chips = wrapper.get('[data-testid="checklist-item-guidance"]').findAll('button')
    expect(chips).toHaveLength(1)
    await chips[0]!.trigger('click')
    expect(wrapper.get('[data-testid="guidance-dialog"]').text()).toContain('Fitted sheet tight')
  })
})
