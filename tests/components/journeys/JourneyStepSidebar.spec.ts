import type { TriggerStep } from '~/components/journeys/data/journeys'
import { shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import JourneyStepSidebar from '~/components/journeys/JourneyStepSidebar.vue'

const minutConnected = ref(true)

const passthroughStub = { template: '<div><slot /></div>' }
const SelectStub = {
  name: 'SelectStub',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<div><slot /></div>',
}
const SelectItemStub = {
  props: ['value', 'disabled'],
  template: '<button type="button" :data-value="value" :disabled="disabled"><slot /></button>',
}

function mountSidebar() {
  const step: TriggerStep = {
    id: 'trigger-1',
    type: 'trigger',
    name: 'New Booking',
    triggers: [{ type: 'new_booking', settings: {} }],
    properties: ['All Properties'],
  }

  return shallowMount(JourneyStepSidebar, {
    props: {
      step,
      journeyName: 'Test Journey',
    },
    global: {
      stubs: {
        Select: SelectStub,
        SelectContent: passthroughStub,
        SelectGroup: passthroughStub,
        SelectLabel: passthroughStub,
        SelectTrigger: passthroughStub,
        SelectValue: passthroughStub,
        SelectItem: SelectItemStub,
      },
    },
  })
}

describe('journeyStepSidebar Minut trigger picker', () => {
  beforeEach(() => {
    minutConnected.value = true
    vi.stubGlobal('useMinut', () => ({ isConnected: minutConnected }))
    vi.stubGlobal('useEmailIntegration', () => ({ isConnected: ref(false) }))
    vi.stubGlobal('useWhatsApp', () => ({ isConnected: ref(false) }))
    vi.stubGlobal('useWhatsAppTemplates', () => ({
      approvedTemplates: ref([]),
      getTemplateById: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders Minut as a direct trigger item without a provider submenu', () => {
    const wrapper = mountSidebar()

    const minutItem = wrapper.find('[data-value="minut_event"]')
    expect(minutItem.exists()).toBe(true)
    expect(minutItem.text()).toContain('Minut Sensor Event')
    expect((minutItem.element as HTMLButtonElement).disabled).toBe(false)
    expect(wrapper.find('[data-value="__provider__minut"]').exists()).toBe(false)
  })

  it('disables the direct Minut trigger when the integration is disconnected', () => {
    minutConnected.value = false
    const wrapper = mountSidebar()

    const minutItem = wrapper.get('[data-value="minut_event"]')
    expect((minutItem.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps Turno and Tidy placeholders disabled', () => {
    const wrapper = mountSidebar()

    for (const value of ['__placeholder_turno__', '__placeholder_tidy__']) {
      const item = wrapper.get(`[data-value="${value}"]`)
      expect((item.element as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('updates the trigger entry when the Select emits the Minut value', async () => {
    const wrapper = mountSidebar()

    wrapper.getComponent({ name: 'SelectStub' }).vm.$emit('update:modelValue', 'minut_event')
    await nextTick()

    expect(wrapper.emitted('update')?.[0]?.[0]).toMatchObject({
      triggers: [{
        type: 'minut_event',
        settings: { triggerImmediately: true },
      }],
    })
  })
})
