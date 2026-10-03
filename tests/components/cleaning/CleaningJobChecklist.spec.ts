import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CleaningJobChecklist from '~/components/cleaning/CleaningJobChecklist.vue'

const STUBS = { Icon: true }

describe('cleaningJobChecklist', () => {
  it('lists the copied steps by section', () => {
    const wrapper = mount(CleaningJobChecklist, {
      props: { steps: [{ id: 'k', title: 'Kitchen', steps: [{ id: '1', label: 'Clean fridge' }, { id: '2', label: 'Mop' }] }] },
      global: { stubs: STUBS },
    })
    expect(wrapper.text()).toContain('Kitchen')
    expect(wrapper.text()).toContain('Clean fridge')
    expect(wrapper.text()).toContain('2 steps')
  })

  it('uses the report\'s item cards, every item not checked yet', () => {
    const wrapper = mount(CleaningJobChecklist, {
      props: { steps: [{ id: 'k', title: 'Kitchen', steps: [{ id: '1', label: 'Clean fridge' }, { id: '2', label: 'Mop' }] }] },
      global: { stubs: STUBS },
    })
    expect(wrapper.find('[data-testid="checklist-group-k"]').exists()).toBe(true)
    const items = wrapper.findAll('[data-testid^="checklist-item-"][data-status]')
    expect(items).toHaveLength(2)
    expect(items.every(i => i.attributes('data-status') === 'pending')).toBe(true)
    expect(wrapper.findAll('[data-testid="checklist-item-pending"]')).toHaveLength(2)
  })

  it('explains a job with no checklist', () => {
    const wrapper = mount(CleaningJobChecklist, { props: { steps: undefined }, global: { stubs: STUBS } })
    expect(wrapper.find('[data-testid="job-checklist-empty"]').exists()).toBe(true)
  })
})
