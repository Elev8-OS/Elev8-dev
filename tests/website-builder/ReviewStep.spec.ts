// The Reviews step in both modes. Auto resolves a pool from the rules; Manual keeps the
// hand-picked list. The step owns validity, so the wizard can trust its `next` event.
//
// Both modes render the same card list: in Manual the cards are pickable, in Auto they are
// read-only. Nothing is starred by hand — every published review is on the home page, so the
// featured ids are derived from whatever the mode publishes.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '~/components/ui/pagination'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import ReviewPickerCard from '~/components/website-builder/ReviewPickerCard.vue'
import ReviewAutoSettings from '~/components/website-builder/steps/ReviewAutoSettings.vue'
import ReviewStep from '~/components/website-builder/steps/ReviewStep.vue'

const global = {
  components: {
    WebsiteBuilderStepsReviewAutoSettings: ReviewAutoSettings,
    WebsiteBuilderReviewPickerCard: ReviewPickerCard,
    // Real pagination primitives: the pager's behaviour is what these tests are about.
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationPrevious,
    PaginationNext,
    PaginationEllipsis,
  },
  stubs: {
    Button: { template: '<button><slot /></button>' },
    Badge: { template: '<span><slot /></span>' },
    Label: { template: '<label><slot /></label>' },
    // Model-aware so the search box actually filters in tests; a bare `<input>` would
    // swallow the binding and make every value assertion pass vacuously.
    Input: {
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">',
    },
    Textarea: { template: '<textarea />' },
    // Mirrors reka-ui: a click on an indeterminate box resolves to true.
    Checkbox: {
      props: ['modelValue', 'disabled'],
      emits: ['update:modelValue'],
      template: '<button role="checkbox" :aria-checked="String(modelValue)" :disabled="disabled" @click="$emit(\'update:modelValue\', modelValue !== true)"><slot /></button>',
    },
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
    selectedReviewIds: [] as string[],
    featuredReviewIds: [] as string[],
    manualReviews: [] as never[],
    featuredManualReviewIds: [] as string[],
    config: { ...createDefaultReviewConfig(), ...configOverrides },
  }
}

function mountStep(selection = baseSelection(), propertyIds = ['prop-1']) {
  return mount(ReviewStep, { props: { modelValue: selection, propertyIds }, global })
}

type Wrapper = ReturnType<typeof mountStep>

function lastEmitted(wrapper: Wrapper) {
  const emitted = wrapper.emitted('update:modelValue')!
  return emitted[emitted.length - 1]![0] as ReturnType<typeof baseSelection>
}

function cards(wrapper: Wrapper) {
  return wrapper.findAll('[data-testid="review-picker-card"]')
}

function cardFor(wrapper: Wrapper, guestName: string) {
  return cards(wrapper).find(c => c.text().includes(guestName))!
}

function clickMode(wrapper: Wrapper, mode: 'auto' | 'manual') {
  return wrapper.find(`[data-testid="review-mode-${mode}"]`).trigger('click')
}

async function typeSearch(wrapper: Wrapper, term: string) {
  const input = wrapper.find('input[aria-label="Search reviews"]')
  await input.setValue(term)
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

  it('emits the new mode when the mode card is clicked', async () => {
    const wrapper = mountStep()
    await clickMode(wrapper, 'manual')
    expect(lastEmitted(wrapper).config.mode).toBe('manual')
  })

  it('states on each mode card what it currently yields', () => {
    const wrapper = mountStep()
    // Five reviews clear the default rules for prop-1; nine are pickable by hand.
    expect(wrapper.find('[data-testid="review-mode-auto"]').text()).toContain('5 reviews would show')
    expect(wrapper.find('[data-testid="review-mode-manual"]').text()).toContain('0 of 9 chosen')
  })

  it('offers the testimonial button in both modes', () => {
    for (const wrapper of [mountStep(), mountStep(baseSelection({ mode: 'manual' }))])
      expect(wrapper.text()).toContain('Add testimonial')
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

  it('drops a review from the home page when a rule pushes it out of the pool', async () => {
    // rr-007 is Direct (falls out when Direct is disabled); rr-001 is Airbnb (survives).
    const wrapper = mountStep()

    const config = createDefaultReviewConfig()
    config.channels.direct.enabled = false
    await wrapper.findComponent(ReviewAutoSettings).vm.$emit('update:modelValue', config)
    await wrapper.vm.$nextTick()

    const last = lastEmitted(wrapper)
    expect(last.featuredReviewIds).not.toContain('rr-007')
    expect(last.featuredReviewIds).toContain('rr-001')
  })
})

describe('reviewStep home-page ids are derived, never starred', () => {
  it('offers no per-card main-page toggle', () => {
    for (const wrapper of [mountStep(), mountStep(baseSelection({ mode: 'manual' }))])
      expect(wrapper.findAll('button').some(b => b.text().includes('Main page'))).toBe(false)
  })

  it('puts the whole auto pool on the home page', async () => {
    const wrapper = mountStep()
    const config = createDefaultReviewConfig()
    config.channels.direct.enabled = false
    await wrapper.findComponent(ReviewAutoSettings).vm.$emit('update:modelValue', config)

    // The three Airbnb/Booking.com reviews left once Direct is off, newest first.
    expect(lastEmitted(wrapper).featuredReviewIds).toEqual(['rr-011', 'rr-005', 'rr-001'])
  })

  it('puts every hand-picked review on the home page as it is picked', async () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    await cardFor(wrapper, 'Sarah Chen').trigger('click')

    const last = lastEmitted(wrapper)
    expect(last.selectedReviewIds).toEqual(['rr-001'])
    expect(last.featuredReviewIds).toEqual(['rr-001'])
  })

  it('drops a review from the home page when the pick is undone', async () => {
    const selection = baseSelection({ mode: 'manual' })
    selection.selectedReviewIds = ['rr-001']
    const wrapper = mountStep(selection)
    await cardFor(wrapper, 'Sarah Chen').trigger('click')

    expect(lastEmitted(wrapper).featuredReviewIds).toEqual([])
  })

  it('clears the home page when switching from Auto to Manual with nothing picked', async () => {
    const wrapper = mountStep()
    await clickMode(wrapper, 'manual')
    await wrapper.vm.$nextTick()

    expect(lastEmitted(wrapper).featuredReviewIds).toEqual([])
  })
})

describe('reviewStep validity', () => {
  function nextButton(wrapper: Wrapper) {
    return wrapper.find('[data-testid="review-step-next"]')
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

describe('reviewStep candidate cards', () => {
  it('offers every in-scope review, with no hidden rating floor', () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    // lst-1 holds 6 records (rr-003 hidden) and lst-5 holds 4, so 9 are pickable.
    expect(cards(wrapper)).toHaveLength(9)
    expect(wrapper.text()).toContain('0 of 9 chosen')
  })

  it('shows the review text on the card, not just the guest name', () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    expect(cardFor(wrapper, 'Sarah Chen').text()).toContain('The pool was amazing')
  })

  it('marks a textless review instead of showing an empty card', () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    // rr-008 (David Park) has no rating and no written comment.
    const card = cardFor(wrapper, 'David Park')
    expect(card.text()).toContain('No written comment')
    expect(card.text()).toContain('Unrated')
  })

  it('shows every rule match in auto mode, ticked', () => {
    const wrapper = mountStep()
    expect(cards(wrapper)).toHaveLength(5)
    expect(cardFor(wrapper, 'Sarah Chen').text()).toContain('Shown on site')
    expect(wrapper.text()).not.toContain('Hidden')
  })

  it('renders manual-mode cards as pickable, showing their inclusion state', () => {
    const selection = baseSelection({ mode: 'manual' })
    selection.selectedReviewIds = ['rr-001']
    const wrapper = mountStep(selection)

    expect(cardFor(wrapper, 'Sarah Chen').text()).toContain('Shown on site')
    expect(cardFor(wrapper, 'Thomas Mueller').text()).toContain('Hidden')
  })

  it('picks a review when its card is clicked', async () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    await cardFor(wrapper, 'Sarah Chen').trigger('click')
    expect(lastEmitted(wrapper).selectedReviewIds).toEqual(['rr-001'])
  })
})

describe('reviewStep browsing the pool', () => {
  it('narrows the cards by search across guest name and wording', async () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    await typeSearch(wrapper, 'sarah')
    expect(cards(wrapper)).toHaveLength(1)
    expect(cards(wrapper)[0]!.text()).toContain('Sarah Chen')

    await typeSearch(wrapper, 'surfboard')
    // Wording-only match: rr-006 is on lst-12, out of scope, so nothing is left.
    expect(cards(wrapper)).toHaveLength(0)
    expect(wrapper.text()).toContain('No review matches these filters')
  })

  it('drops textless reviews behind the written-comment filter', async () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    await wrapper.find('#review-only-with-text').trigger('click')
    // Only rr-008 (David Park) has no written comment.
    expect(cards(wrapper)).toHaveLength(8)
    expect(wrapper.text()).not.toContain('David Park')
  })

  it('scopes Select all to what search left on screen', async () => {
    const wrapper = mountStep(baseSelection({ mode: 'manual' }))
    await typeSearch(wrapper, 'sarah')
    // The status line says what "all" means while a filter is running.
    expect(wrapper.text()).toContain('Showing 1 of 1 review')
    expect(wrapper.text()).toContain('filtered from 9')

    expect(wrapper.find('#review-select-all').attributes('aria-checked')).toBe('false')
    await wrapper.find('#review-select-all').trigger('click')

    expect(lastEmitted(wrapper).selectedReviewIds).toEqual(['rr-001'])
    // Everything on screen is now picked, so the same control turns into its opposite.
    expect(wrapper.find('#review-select-all').attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).toContain('Unselect all')
  })

  it('shows the bulk checkbox as mixed while only part of the visible set is picked', () => {
    const selection = baseSelection({ mode: 'manual' })
    selection.selectedReviewIds = ['rr-001']
    const wrapper = mountStep(selection)

    expect(wrapper.find('#review-select-all').attributes('aria-checked')).toBe('indeterminate')
    expect(wrapper.text()).toContain('Select all')
  })

  it('takes the whole visible set from the mixed state in one click', async () => {
    const selection = baseSelection({ mode: 'manual' })
    selection.selectedReviewIds = ['rr-001']
    const wrapper = mountStep(selection)

    await wrapper.find('#review-select-all').trigger('click')

    expect(lastEmitted(wrapper).selectedReviewIds).toHaveLength(9)
  })

  it('unselects only what the filter shows, leaving picks made elsewhere alone', async () => {
    const selection = baseSelection({ mode: 'manual' })
    selection.selectedReviewIds = ['rr-001', 'rr-002']
    const wrapper = mountStep(selection)
    await typeSearch(wrapper, 'sarah')

    await wrapper.find('#review-select-all').trigger('click')

    // rr-002 (Thomas Mueller) was never on screen, so it keeps its pick.
    expect(lastEmitted(wrapper).selectedReviewIds).toEqual(['rr-002'])
  })

  it('reports the page range and the running selection', () => {
    const selection = baseSelection({ mode: 'manual' })
    selection.selectedReviewIds = ['rr-001', 'rr-002']
    const wrapper = mountStep(selection)

    expect(wrapper.text()).toContain('Showing 1-9 of 9 reviews')
    expect(wrapper.text()).toContain('2 selected')
  })
})

describe('reviewStep collapsible preview pool', () => {
  function openPreview(wrapper: Wrapper) {
    return wrapper.findAll('button').find(b => b.text().includes('Website Preview'))!
  }

  function previewCardsText(wrapper: Wrapper): string {
    return wrapper.findAll('[data-testid="review-preview-card"]').map(c => c.text()).join(' | ')
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

  it('previews newest first, the order the published page uses', async () => {
    const wrapper = mountStep()
    await openPreview(wrapper).trigger('click')

    // rr-014 (Isabella Rossi, 4 Jul) is the newest of the five resolved reviews.
    const first = wrapper.findAll('[data-testid="review-preview-card"]')[0]!
    expect(first.text()).toContain('Isabella Rossi')
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

    const last = lastEmitted(wrapper)
    expect(last.config.channels.direct.enabled).toBe(false)
    expect(last.selectedReviewIds).toEqual([])
  })
})

describe('reviewStep pagination', () => {
  // prop-1 (lst-1 + lst-5) plus prop-2 (lst-12) hold 14 pickable reviews — two pages at ten.
  function mountTwoPages() {
    return mountStep(baseSelection({ mode: 'manual' }), ['prop-1', 'prop-2'])
  }

  it('pages a long list instead of growing it', () => {
    const wrapper = mountTwoPages()
    expect(cards(wrapper)).toHaveLength(10)
    expect(wrapper.text()).toContain('Showing 1-10 of 14 reviews')
  })

  it('shows the remainder on the next page', async () => {
    const wrapper = mountTwoPages()
    await wrapper.find('[data-testid="review-page-next"]').trigger('click')

    expect(cards(wrapper)).toHaveLength(4)
    expect(wrapper.text()).toContain('Showing 11-14 of 14 reviews')
  })

  it('hides the pager when everything fits on one page', () => {
    // prop-1 alone holds nine.
    expect(mountStep(baseSelection({ mode: 'manual' })).find('[data-testid="review-page-next"]').exists()).toBe(false)
  })

  it('returns to the first page when a filter narrows the list', async () => {
    const wrapper = mountTwoPages()
    await wrapper.find('[data-testid="review-page-next"]').trigger('click')
    await typeSearch(wrapper, 'sarah')

    expect(wrapper.text()).toContain('Showing 1 of 1 review')
    expect(cardFor(wrapper, 'Sarah Chen').exists()).toBe(true)
  })

  it('picks across pages, so Select all is not limited to the page on screen', async () => {
    const wrapper = mountTwoPages()
    await wrapper.find('#review-select-all').trigger('click')

    expect(lastEmitted(wrapper).selectedReviewIds).toHaveLength(14)
  })
})

// Auto mode's escape hatch: the rules stay in charge, but a single review can be pulled off
// the site by hand without loosening them.
describe('reviewStep auto exclusions', () => {
  function excludeFrom(wrapper: Wrapper, guestName: string) {
    return cardFor(wrapper, guestName).trigger('click')
  }

  it('hides a rule match when its card is unticked', async () => {
    const wrapper = mountStep()
    await excludeFrom(wrapper, 'Sarah Chen')

    const last = lastEmitted(wrapper)
    expect(last.config.excludedReviewIds).toEqual(['rr-001'])
    // …and it stops publishing, home page included.
    expect(last.featuredReviewIds).not.toContain('rr-001')
  })

  it('keeps the hidden review on screen so it can be brought back', async () => {
    const wrapper = mountStep()
    await excludeFrom(wrapper, 'Sarah Chen')

    expect(cards(wrapper)).toHaveLength(5)
    expect(cardFor(wrapper, 'Sarah Chen').text()).toContain('Hidden')
    expect(wrapper.text()).toContain('1 hidden')
  })

  it('brings a hidden review back on a second click', async () => {
    const selection = baseSelection({ excludedReviewIds: ['rr-001'] })
    const wrapper = mountStep(selection)
    await excludeFrom(wrapper, 'Sarah Chen')

    expect(lastEmitted(wrapper).config.excludedReviewIds).toEqual([])
  })

  it('counts only what still publishes', () => {
    const wrapper = mountStep(baseSelection({ excludedReviewIds: ['rr-001'] }))
    expect(wrapper.findComponent(ReviewAutoSettings).props('stats').total).toBe(4)
    expect(wrapper.text()).toContain('4 of 5 showing')
  })

  it('blames the hiding, not the rules, when nothing is left to publish', () => {
    const excludedReviewIds = ['rr-001', 'rr-005', 'rr-007', 'rr-011', 'rr-014']
    const wrapper = mountStep(baseSelection({ excludedReviewIds }))

    expect(wrapper.text()).toContain('Every review your rules let through is hidden')
    expect(wrapper.text()).not.toContain('Try a lower minimum rating')
  })

  it('offers no bulk control in auto mode — hiding is per review', () => {
    expect(mountStep().find('#review-select-all').exists()).toBe(false)
    // Manual still has one.
    expect(mountStep(baseSelection({ mode: 'manual' })).find('#review-select-all').exists()).toBe(true)
  })

  it('drops the hiding when the property changes, since the ids belong to the old scope', async () => {
    const wrapper = mountStep(baseSelection({ excludedReviewIds: ['rr-001'] }))
    await wrapper.setProps({ propertyIds: ['prop-2'] })
    await wrapper.vm.$nextTick()

    expect(lastEmitted(wrapper).config.excludedReviewIds).toEqual([])
  })
})
