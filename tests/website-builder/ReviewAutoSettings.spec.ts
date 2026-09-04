// The Auto rules form. Its job is to render one row per channel in that channel's own
// scale and to emit a patched config without ever mutating the prop.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import ReviewAutoSettings from '~/components/website-builder/steps/ReviewAutoSettings.vue'

const global = {
  components: { Checkbox, Input, Label, Switch },
  // The reka-ui Select renders through teleports the shallow mount does not need.
  stubs: {
    Select: { template: '<div class="select-stub"><slot /></div>' },
    SelectTrigger: { template: '<button class="select-trigger"><slot /></button>' },
    SelectValue: { template: '<span />' },
    SelectContent: { template: '<div><slot /></div>' },
    SelectItem: { template: '<div class="select-item"><slot /></div>' },
    Icon: { template: '<i />' },
  },
  config: { warnHandler: () => {} },
}

const stats = { total: 34, byChannel: { airbnb: 18, booking_com: 11, direct: 5 } }

function mountSettings(overrides = {}) {
  return mount(ReviewAutoSettings, {
    props: { modelValue: createDefaultReviewConfig(), stats, ...overrides },
    global,
  })
}

describe('reviewAutoSettings', () => {
  it('renders one row per channel', () => {
    const text = mountSettings().text()
    expect(text).toContain('Airbnb')
    expect(text).toContain('Booking.com')
    expect(text).toContain('Direct')
  })

  it('labels each channel with its own scale', () => {
    const text = mountSettings().text()
    expect(text).toContain('of 5')
    expect(text).toContain('of 10')
  })

  it('shows the live match count with a per-channel breakdown', () => {
    const text = mountSettings().text()
    expect(text).toContain('34 reviews match')
    expect(text).toContain('Airbnb 18')
    expect(text).toContain('Booking.com 11')
    expect(text).toContain('Direct 5')
  })

  it('says one review matches without pluralising', () => {
    const wrapper = mountSettings({
      stats: { total: 1, byChannel: { airbnb: 1, booking_com: 0, direct: 0 } },
    })
    expect(wrapper.text()).toContain('1 review matches')
  })

  it('warns when nothing matches', () => {
    const wrapper = mountSettings({
      stats: { total: 0, byChannel: { airbnb: 0, booking_com: 0, direct: 0 } },
    })
    expect(wrapper.text()).toContain('No reviews match')
  })

  it('emits a config with the channel disabled when its switch is turned off', async () => {
    const wrapper = mountSettings()
    await wrapper.findAll('button[role="switch"]')[0]!.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    const next = emitted![0]![0] as ReturnType<typeof createDefaultReviewConfig>
    expect(next.channels.airbnb.enabled).toBe(false)
    expect(next.channels.booking_com.enabled).toBe(true)
  })

  it('never mutates the config it was given', async () => {
    const modelValue = createDefaultReviewConfig()
    const wrapper = mount(ReviewAutoSettings, { props: { modelValue, stats }, global })
    await wrapper.findAll('button[role="switch"]')[0]!.trigger('click')
    expect(modelValue.channels.airbnb.enabled).toBe(true)
  })

  // The reka-ui Checkbox renders a button carrying role="checkbox". If that selector
  // finds nothing in your reka-ui version, target `#review-require-text` instead.
  it('emits requireText off when its checkbox is cleared', async () => {
    const wrapper = mountSettings()
    await wrapper.find('button[role="checkbox"]').trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    const next = emitted![0]![0] as ReturnType<typeof createDefaultReviewConfig>
    expect(next.requireText).toBe(false)
  })

  it('clamps a batch size below 1 up to 1', async () => {
    const wrapper = mountSettings()
    const batchInput = wrapper.find('input#review-batch-size')
    await batchInput.setValue('0')

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as ReturnType<typeof createDefaultReviewConfig>
    expect(last.batchSize).toBe(1)
  })

  it('clamps a negative minimum count up to 0', async () => {
    const wrapper = mountSettings()
    await wrapper.find('input#review-min-count').setValue('-5')

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as ReturnType<typeof createDefaultReviewConfig>
    expect(last.minCountToShow).toBe(0)
  })
})
