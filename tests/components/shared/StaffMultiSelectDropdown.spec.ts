import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import StaffMultiSelectDropdown from '~/components/shared/StaffMultiSelectDropdown.vue'

const mockStaff = [
  { id: 'staff-1', name: 'Komang Juliantara', role: 'Guest Relations' },
  { id: 'staff-2', name: 'Made Surya', role: 'Housekeeping' },
  { id: 'staff-3', name: 'Wayan Adi', role: 'Maintenance' },
  { id: 'staff-4', name: 'Ketut Sari', role: 'Housekeeping' },
]

function body() {
  return new DOMWrapper(document.body)
}

describe('staffMultiSelectDropdown', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders default placeholder when no staff are selected', () => {
    const wrapper = mount(StaffMultiSelectDropdown, {
      props: {
        modelValue: [],
        options: mockStaff,
        placeholder: 'Select cleaning staff',
      },
      global: { stubs: { Icon: true } },
    })

    expect(wrapper.text()).toContain('Select cleaning staff')
  })

  it('displays single staff name when 1 staff is selected', () => {
    const wrapper = mount(StaffMultiSelectDropdown, {
      props: {
        modelValue: ['staff-2'],
        options: mockStaff,
      },
      global: { stubs: { Icon: true } },
    })

    expect(wrapper.text()).toContain('Made Surya')
  })

  it('displays both staff names when 2 staff are selected', () => {
    const wrapper = mount(StaffMultiSelectDropdown, {
      props: {
        modelValue: ['staff-2', 'staff-4'],
        options: mockStaff,
      },
      global: { stubs: { Icon: true } },
    })

    expect(wrapper.text()).toContain('Made Surya, Ketut Sari')
  })

  it('displays count when more than 2 staff are selected', () => {
    const wrapper = mount(StaffMultiSelectDropdown, {
      props: {
        modelValue: ['staff-1', 'staff-2', 'staff-3'],
        options: mockStaff,
      },
      global: { stubs: { Icon: true } },
    })

    expect(wrapper.text()).toContain('3 staff selected')
  })

  it('renders removable tags when showTags is true and items are selected', async () => {
    const wrapper = mount(StaffMultiSelectDropdown, {
      props: {
        modelValue: ['staff-2', 'staff-3'],
        options: mockStaff,
        showTags: true,
      },
      global: { stubs: { Icon: true } },
    })

    const tags = wrapper.findAll('.staff-chip')
    expect(tags.length).toBe(2)
    expect(tags[0]?.text()).toContain('Made Surya')
    expect(tags[1]?.text()).toContain('Wayan Adi')

    // Click remove button on first tag
    const removeBtn = tags[0]?.find('button')
    await removeBtn?.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toEqual(['staff-3'])
  })

  it('does not render tags when showTags is false', () => {
    const wrapper = mount(StaffMultiSelectDropdown, {
      props: {
        modelValue: ['staff-2'],
        options: mockStaff,
        showTags: false,
      },
      global: { stubs: { Icon: true } },
    })

    expect(wrapper.find('.staff-chip').exists()).toBe(false)
  })

  it('filters staff by search query inside popover', async () => {
    const wrapper = mount(StaffMultiSelectDropdown, {
      props: {
        modelValue: [],
        options: mockStaff,
      },
      attachTo: document.body,
      global: { stubs: { Icon: true } },
    })

    // Open popover by clicking trigger
    const trigger = wrapper.find('button')
    await trigger.trigger('click')
    await nextTick()
    await nextTick()

    // Find search input inside document.body (portalled)
    const searchInput = body().find('input[placeholder*="Search"]')
    expect(searchInput.exists()).toBe(true)

    // Type query "housekeeping"
    await searchInput.setValue('housekeeping')
    await nextTick()

    // Expect to see Made Surya and Ketut Sari in body, but not Wayan Adi
    expect(body().text()).toContain('Made Surya')
    expect(body().text()).toContain('Ketut Sari')
    expect(body().text()).not.toContain('Wayan Adi')

    wrapper.unmount()
  })

  it('toggles selection and emits update:modelValue', async () => {
    const wrapper = mount(StaffMultiSelectDropdown, {
      props: {
        modelValue: ['staff-2'],
        options: mockStaff,
      },
      attachTo: document.body,
      global: { stubs: { Icon: true } },
    })

    const trigger = wrapper.find('button')
    await trigger.trigger('click')
    await nextTick()
    await nextTick()

    // Click on Wayan Adi button inside body
    const staffButtons = body().findAll('button').filter(b => b.text().includes('Wayan Adi'))
    expect(staffButtons.length).toBeGreaterThan(0)
    await staffButtons[0]?.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toEqual(['staff-2', 'staff-3'])

    wrapper.unmount()
  })

  it('selects all and clears all via footer buttons', async () => {
    const wrapper = mount(StaffMultiSelectDropdown, {
      props: {
        modelValue: ['staff-2'],
        options: mockStaff,
      },
      attachTo: document.body,
      global: { stubs: { Icon: true } },
    })

    const trigger = wrapper.find('button')
    await trigger.trigger('click')
    await nextTick()
    await nextTick()

    // Click "Select all" inside body
    const selectAllBtn = body().findAll('button').find(b => b.text() === 'Select all')
    expect(selectAllBtn).toBeTruthy()
    await selectAllBtn?.trigger('click')

    let emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.[0]?.[0]).toEqual(['staff-1', 'staff-2', 'staff-3', 'staff-4'])

    // Click "Clear" inside body
    const clearBtn = body().findAll('button').find(b => b.text() === 'Clear')
    expect(clearBtn).toBeTruthy()
    await clearBtn?.trigger('click')

    emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.[1]?.[0]).toEqual([])

    wrapper.unmount()
  })

  it('renders popover with elevated z-index (z-[100]) so it appears in front of dialogs', async () => {
    const wrapper = mount(StaffMultiSelectDropdown, {
      props: {
        modelValue: [],
        options: mockStaff,
      },
      attachTo: document.body,
      global: { stubs: { Icon: true } },
    })

    const trigger = wrapper.find('button')
    await trigger.trigger('click')
    await nextTick()
    await nextTick()

    const popoverContent = document.body.querySelector('[data-slot="popover-content"]')
    expect(popoverContent).toBeTruthy()
    expect(popoverContent?.className).toContain('z-[100]')

    wrapper.unmount()
  })
})
