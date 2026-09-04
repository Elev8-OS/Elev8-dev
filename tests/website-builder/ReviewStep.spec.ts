// The Reviews step in both modes. Auto resolves a pool from the rules; Manual keeps the
// hand-picked list. The step owns validity, so the wizard can trust its `next` event.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import ReviewAutoSettings from '~/components/website-builder/steps/ReviewAutoSettings.vue'
import ReviewStep from '~/components/website-builder/steps/ReviewStep.vue'

const global = {
  components: {
    WebsiteBuilderStepsReviewAutoSettings: ReviewAutoSettings,
  },
  stubs: {
    Button: { template: '<button><slot /></button>' },
    Badge: { template: '<span><slot /></span>' },
    Label: { template: '<label><slot /></label>' },
    Input: { template: '<input>' },
    Textarea: { template: '<textarea />' },
    Checkbox: { template: '<button role="checkbox" />' },
    Switch: { template: '<button role="switch" />' },
    Select: { template: '<div><slot /></div>' },
    SelectTrigger: { template: '<button><slot /></button>' },
    SelectValue: { template: '<span />' },
    SelectContent: { template: '<div><slot /></div>' },
    SelectItem: { template: '<div><slot /></div>' },
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogHeader: { template: '<div><slot /></div>' },
    DialogTitle: { template: '<div><slot /></div>' },
    DialogDescription: { template: '<div><slot /></div>' },
    DialogFooter: { template: '<div><slot /></div>' },
    Icon: { template: '<i />' },
  },
  config: { warnHandler: () => {} },
}

function baseSelection(configOverrides = {}) {
  return {
    selectedReviewIds: [],
    featuredReviewIds: [],
    manualReviews: [],
    featuredManualReviewIds: [],
    config: { ...createDefaultReviewConfig(), ...configOverrides },
  }
}

function mountStep(selection = baseSelection(), propertyIds = ['prop-1']) {
  return mount(ReviewStep, { props: { modelValue: selection, propertyIds }, global })
}

describe('reviewStep mode toggle', () => {
  it('renders the auto rules form in auto mode', () => {
    const wrapper = mountStep()
    expect(wrapper.findComponent(ReviewAutoSettings).exists()).toBe(true)
  })

  it('renders the hand-picked list instead in manual mode', () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    expect(wrapper.findComponent(ReviewAutoSettings).exists()).toBe(false)
  })

  it('emits the new mode when the toggle is clicked', async () => {
    const wrapper = mountStep()
    const manualButton = wrapper.findAll('button').find(b => b.text().trim() === 'Manual')
    await manualButton!.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as ReturnType<typeof baseSelection>
    expect(last.config.mode).toBe('manual')
  })

  it('shows the manual review add button in both modes', () => {
    // Auto mode
    const wrapperAuto = mountStep()
    const buttonAuto = wrapperAuto.findAll('button').find(b => b.text().trim() === 'Manual Review')
    expect(buttonAuto).toBeTruthy()

    // Manual mode
    const wrapperManual = mountStep(baseSelection({ mode: 'manual' }))
    const buttonManual = wrapperManual.findAll('button').find(b => b.text().trim() === 'Manual Review')
    expect(buttonManual).toBeTruthy()
  })
})

describe('reviewStep auto pool', () => {
  it('reports the resolved count for the selected property', () => {
    const wrapper = mountStep()
    // prop-1 maps to lst-1 + lst-5; five mock reviews clear the default rules.
    expect(wrapper.findComponent(ReviewAutoSettings).props('stats').total).toBe(5)
  })

  it('recomputes the pool when a rule tightens', async () => {
    const wrapper = mountStep()
    const config = createDefaultReviewConfig()
    config.channels.direct.enabled = false
    await wrapper.findComponent(ReviewAutoSettings).vm.$emit('update:modelValue', config)

    expect(wrapper.findComponent(ReviewAutoSettings).props('stats').total).toBe(3)
  })

  it('prunes a featured id that falls out of the pool, but keeps a surviving one', async () => {
    const selection = baseSelection()
    // rr-007 is Direct (falls out when Direct is disabled); rr-001 is Airbnb (survives).
    selection.featuredReviewIds = ['rr-007', 'rr-001']
    const wrapper = mountStep(selection)

    const config = createDefaultReviewConfig()
    config.channels.direct.enabled = false
    await wrapper.findComponent(ReviewAutoSettings).vm.$emit('update:modelValue', config)
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as ReturnType<typeof baseSelection>
    expect(last.featuredReviewIds).not.toContain('rr-007')
    expect(last.featuredReviewIds).toContain('rr-001')
  })
})

describe('reviewStep featured ids across modes', () => {
  it('prunes a featured id when switching from Auto to Manual with nothing selected', async () => {
    // rr-014 is one of the five reviews the default rules resolve for prop-1.
    const selection = baseSelection()
    selection.featuredReviewIds = ['rr-014']
    const wrapper = mountStep(selection)

    const manualButton = wrapper.findAll('button').find(b => b.text().trim() === 'Manual')
    await manualButton!.trigger('click')
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as ReturnType<typeof baseSelection>
    expect(last.featuredReviewIds).not.toContain('rr-014')
  })

  it('still prunes a featured id that falls out of the Auto pool (mode unchanged)', async () => {
    // Same scenario as the existing threshold-change test above, kept here to make the
    // Auto-direction guarantee explicit alongside the new Manual-direction test.
    const selection = baseSelection()
    selection.featuredReviewIds = ['rr-007', 'rr-001']
    const wrapper = mountStep(selection)

    const config = createDefaultReviewConfig()
    config.channels.direct.enabled = false
    await wrapper.findComponent(ReviewAutoSettings).vm.$emit('update:modelValue', config)
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as ReturnType<typeof baseSelection>
    expect(last.featuredReviewIds).not.toContain('rr-007')
    expect(last.featuredReviewIds).toContain('rr-001')
  })
})

describe('reviewStep validity', () => {
  function nextButton(wrapper: ReturnType<typeof mountStep>) {
    return wrapper.findAll('button').find(b => b.text().trim().startsWith('Next'))!
  }

  it('allows Next in auto mode when the pool has reviews', async () => {
    const wrapper = mountStep()
    await nextButton(wrapper).trigger('click')
    expect(wrapper.emitted('next')).toBeTruthy()
  })

  it('blocks Next in auto mode when every channel is disabled', async () => {
    const config = createDefaultReviewConfig()
    for (const rule of Object.values(config.channels)) rule.enabled = false
    const wrapper = mountStep(baseSelection(config))

    await nextButton(wrapper).trigger('click')
    expect(wrapper.emitted('next')).toBeFalsy()
  })

  it('blocks Next in manual mode with nothing picked', async () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    await nextButton(wrapper).trigger('click')
    expect(wrapper.emitted('next')).toBeFalsy()
  })

  it('allows Next in manual mode once a review is picked', async () => {
    const selection = baseSelection({ mode: 'manual' })
    selection.selectedReviewIds = ['rr-001']
    const wrapper = mountStep(selection)

    await nextButton(wrapper).trigger('click')
    expect(wrapper.emitted('next')).toBeTruthy()
  })
})

describe('reviewStep manual candidates', () => {
  it('offers every in-scope review, with no hidden rating floor', () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    // lst-1 holds 6 records (rr-003 hidden) and lst-5 holds 4, so 9 are pickable.
    // Under the old 8+ floor this list would have shown 6.
    expect(wrapper.text()).toContain('/9 selected')
  })
})

describe('reviewStep manual UI stays out of auto mode', () => {
  it('hides the manual toolbar and grouped list in auto mode', () => {
    const wrapper = mountStep()
    // "Property" only appears in the manual-mode filter toolbar; the grouped list rows
    // and the "No reviews match" empty state are also manual-only.
    expect(wrapper.text()).not.toContain('Property')
    expect(wrapper.text()).not.toContain('Select All')
    expect(wrapper.text()).not.toContain('No reviews match. Add a manual testimonial above.')
  })

  it('shows the manual toolbar and grouped list in manual mode', () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    expect(wrapper.text()).toContain('Property')
    expect(wrapper.text()).toContain('Select All')
  })
})

describe('reviewStep collapsible preview pool', () => {
  function openPreview(wrapper: ReturnType<typeof mountStep>) {
    return wrapper.findAll('button').find(b => b.text().includes('Website Preview'))!
  }

  // Preview cards use a class combo ("rounded-lg border bg-card p-4") that is unique to
  // the collapsible preview — the grouped candidate list and main-page list use a
  // different combo — so this scopes assertions to the preview panel only.
  function previewCardsText(wrapper: ReturnType<typeof mountStep>): string {
    return wrapper.findAll('.rounded-lg.border.bg-card.p-4').map(c => c.text()).join(' | ')
  }

  it('previews the resolved pool in auto mode', async () => {
    const wrapper = mountStep()
    await openPreview(wrapper).trigger('click')
    // The five reviews the default rules resolve for prop-1.
    const text = previewCardsText(wrapper)
    for (const name of ['Isabella Rossi', 'Clara Fischer', 'Elena Kowalski', 'Sarah Chen', 'Anna Schmidt'])
      expect(text).toContain(name)
  })

  it('previews only the picked records in manual mode', async () => {
    const selection = baseSelection({ mode: 'manual' })
    selection.selectedReviewIds = ['rr-001'] // Sarah Chen
    const wrapper = mountStep(selection)
    await openPreview(wrapper).trigger('click')

    const text = previewCardsText(wrapper)
    expect(text).toContain('Sarah Chen')
    // Thomas Mueller (rr-002) is a candidate but was never selected.
    expect(text).not.toContain('Thomas Mueller')
  })
})

describe('reviewStep zero-match warning', () => {
  it('mentions allowing reviews without text when requireText is on and nothing matches', () => {
    // An unmapped property resolves to an empty listing scope, so the pool is empty
    // while every channel stays enabled and requireText stays at its default (true).
    const wrapper = mountStep(baseSelection(), ['prop-does-not-exist'])
    expect(wrapper.text()).toContain('allow reviews without a written comment')
  })
})

describe('reviewStep property changes', () => {
  it('keeps the rules but clears the picks when the property changes', async () => {
    const selection = baseSelection()
    selection.config.channels.direct.enabled = false
    selection.selectedReviewIds = ['rr-001']
    const wrapper = mountStep(selection)

    await wrapper.setProps({ propertyIds: ['prop-2'] })
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')!
    const last = emitted[emitted.length - 1]![0] as ReturnType<typeof baseSelection>
    expect(last.config.channels.direct.enabled).toBe(false)
    expect(last.selectedReviewIds).toEqual([])
  })
})
