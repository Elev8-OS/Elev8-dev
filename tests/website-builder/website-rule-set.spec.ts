// Website Builder shows and sets the site's Website channel rule set. The channel
// (`useWebsiteChannel`) is the only writer: the Website object never stores the id.

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { defaultWebsiteState, newRuleSet, ruleSetForWebsite, websiteChannel } from '~/components/channels/data/website-channel'
import WebsiteRuleHint from '~/components/channels/WebsiteRuleHint.vue'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import { websites } from '~/components/website-builder/data/websites'
import PreviewStep from '~/components/website-builder/steps/PreviewStep.vue'
import BookingRules from '~/components/website-builder/WebsiteBookingRules.vue'
import CreatePage from '~/pages/website-builder/create.vue'
import IndexPage from '~/pages/website-builder/index.vue'

const passthrough = { template: '<div><slot /></div>' }

const SelectStub = defineComponent({
  name: 'SelectStub',
  props: { modelValue: { type: String, default: undefined } },
  emits: ['update:modelValue'],
  template: '<div data-testid="select-stub" :data-value="modelValue"><slot /></div>',
})

const STUBS = {
  Icon: true,
  Label: passthrough,
  Input: true,
  Textarea: true,
  Checkbox: true,
  Separator: true,
  Button: { template: '<button><slot /></button>' },
  Badge: { props: ['variant'], template: '<span :data-variant="variant"><slot /></span>' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  Select: SelectStub,
  SelectTrigger: passthrough,
  SelectValue: true,
  SelectContent: passthrough,
  SelectGroup: passthrough,
  SelectItem: { props: ['value'], template: '<div class="select-item" :data-value="value"><slot /></div>' },
  Card: passthrough,
  CardHeader: passthrough,
  CardTitle: passthrough,
  CardContent: passthrough,
  CardFooter: passthrough,
  DropdownMenu: passthrough,
  DropdownMenuTrigger: passthrough,
  DropdownMenuContent: passthrough,
  DropdownMenuItem: passthrough,
  Empty: passthrough,
  EmptyHeader: passthrough,
  EmptyMedia: passthrough,
  EmptyTitle: passthrough,
  EmptyDescription: passthrough,
  EmptyContent: passthrough,
  AlertDialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
  AlertDialogContent: passthrough,
  AlertDialogHeader: passthrough,
  AlertDialogTitle: passthrough,
  AlertDialogDescription: passthrough,
  AlertDialogFooter: passthrough,
  AlertDialogCancel: passthrough,
  AlertDialogAction: passthrough,
}
// The hint's own tooltip is a Reka portal: stub it to a title so the text can be read.
const HINT_STUB = defineComponent({ name: 'ChannelsWebsiteRuleHint', props: { label: String, text: String }, template: '<button :aria-label="\'About \' + label" :title="text" />' })
const global = { stubs: STUBS, components: { ChannelsWebsiteRuleHint: HINT_STUB }, config: { warnHandler: () => {} } }

const originalWebsites = JSON.parse(JSON.stringify(websites.value))

function settings(rules?: ReturnType<typeof newRuleSet>) {
  return {
    name: 'Villa Test',
    domain: 'villa-test.com',
    description: '',
    brandColor: '#1a1a2e',
    fontFamily: 'Inter',
    logoFile: null,
    faviconFile: null,
    useDefaultFavicon: true,
    ...(rules ? { rules } : {}),
  }
}

function seedChannel(enabled = true) {
  websiteChannel.value = {
    enabled,
    ruleSets: [
      { ...newRuleSet('Bali sites'), id: 'wrs-bali', websiteIds: ['1'] },
      { ...newRuleSet('Long stays'), id: 'wrs-long', websiteIds: [] },
    ],
  }
}

beforeEach(() => {
  websites.value = JSON.parse(JSON.stringify(originalWebsites))
  vi.stubGlobal('definePageMeta', () => {})
  vi.stubGlobal('navigateTo', vi.fn())
  vi.stubGlobal('useRouter', () => ({ push: vi.fn() }))
  vi.stubGlobal('useRoute', () => ({ query: {} }))
})

afterEach(() => {
  websiteChannel.value = defaultWebsiteState()
  try {
    localStorage.clear()
  }
  catch {}
  vi.useRealTimers()
})

describe('booking rules section', () => {
  it('shows this site\'s rules inline, with no website or rule set picker', () => {
    seedChannel()
    const wrapper = mount(BookingRules, { props: { settings: settings(newRuleSet()) }, global })
    const rules = wrapper.get('[data-testid="ws-booking-rules"]')
    expect(rules.text()).toContain('Length of stay discounts')
    expect(rules.text()).toContain('Minimum stay')
    expect(rules.text()).not.toContain('Websites')
    expect(rules.text()).not.toContain('Rule set name')
    expect(rules.find('[data-testid="wrs-website"]').exists()).toBe(false)
  })

  it('explains each stay rule with a hint', () => {
    const wrapper = mount(BookingRules, { props: { settings: settings(newRuleSet()) }, global })
    for (const label of ['Minimum stay', 'Maximum stay', 'Booking notice', 'Arrival days', 'Departure days', 'Prepayment at booking']) {
      const hint = wrapper.get(`[aria-label="About ${label}"]`)
      expect(hint.attributes('title')!.length).toBeGreaterThan(20)
    }
  })

  it('the real hint shows its label and keeps the text for the tooltip', () => {
    const wrapper = mount(WebsiteRuleHint, { props: { label: 'Minimum stay', text: 'Fewest nights.' }, global: { stubs: { Tooltip: { template: '<div><slot /></div>' }, TooltipTrigger: { template: '<div><slot /></div>' }, TooltipContent: { template: '<p data-testid="tip"><slot /></p>' }, Icon: true } } })
    expect(wrapper.get('button').attributes('aria-label')).toBe('About Minimum stay')
    expect(wrapper.get('[data-testid="tip"]').text()).toBe('Fewest nights.')
  })

  it('shows no rules section when the form has none', () => {
    const wrapper = mount(BookingRules, { props: { settings: settings() }, global })
    expect(wrapper.find('[data-testid="ws-booking-rules"]').exists()).toBe(false)
  })
})

describe('previewStep saves the site rules through the channel', () => {
  function mountPreview(rules: ReturnType<typeof newRuleSet> | undefined, editId?: string) {
    vi.stubGlobal('useRoute', () => ({ query: editId ? { edit: editId } : {} }))
    return mount(PreviewStep, {
      props: {
        template: { id: 'luxury-villa', name: 'Luxury Villa', description: '', gradient: '', icon: '' },
        settings: settings(rules),
        property: { propertyIds: ['prop-1'], roomIds: [] },
        reviews: {
          selectedReviewIds: [],
          featuredReviewIds: [],
          manualReviews: [],
          featuredManualReviewIds: [],
          config: createDefaultReviewConfig(),
        },
      },
      global,
    })
  }

  function clickButton(wrapper: ReturnType<typeof mountPreview>, label: string) {
    return wrapper.findAll('button').find(b => b.text().includes(label))!.trigger('click')
  }

  it('gives a new website its own rule set on publish', async () => {
    seedChannel()
    vi.useFakeTimers()
    const before = websites.value.length
    const rules = { ...newRuleSet(), minNights: 3, lengthOfStayDiscounts: [{ id: 'a', minNights: 5, pct: 15 }] }
    const wrapper = mountPreview(rules)
    expect(wrapper.get('[data-testid="preview-rule-set"]').text()).toContain('up to 15%')

    await clickButton(wrapper, 'Publish Website')
    vi.advanceTimersByTime(1000)

    expect(websites.value).toHaveLength(before + 1)
    const created = websites.value.at(-1)!
    const set = ruleSetForWebsite(websiteChannel.value, created.id)!
    expect(set.name).toBe('Villa Test')
    expect(set.websiteIds).toEqual([created.id])
    expect(set.minNights).toBe(3)
    expect(set.lengthOfStayDiscounts[0]!.pct).toBe(15)
    expect(created).not.toHaveProperty('rules')
  })

  it('updates the set in place when only this site uses it', async () => {
    seedChannel()
    vi.useFakeTimers()
    const wrapper = mountPreview({ ...newRuleSet(), minNights: 4 }, '1')

    await clickButton(wrapper, 'Update Website')
    vi.advanceTimersByTime(1000)

    const set = ruleSetForWebsite(websiteChannel.value, '1')!
    expect(set.id).toBe('wrs-bali')
    expect(set.name).toBe('Bali sites')
    expect(set.minNights).toBe(4)
    expect(websiteChannel.value.ruleSets).toHaveLength(2)
  })

  it('splits the site off a shared rule set and leaves the others untouched', async () => {
    seedChannel()
    websiteChannel.value = { ...websiteChannel.value, ruleSets: websiteChannel.value.ruleSets.map(r => r.id === 'wrs-bali' ? { ...r, websiteIds: ['1', '2'] } : r) }
    vi.useFakeTimers()
    const wrapper = mountPreview({ ...newRuleSet(), minNights: 6 }, '1')

    await clickButton(wrapper, 'Update Website')
    vi.advanceTimersByTime(1000)

    const own = ruleSetForWebsite(websiteChannel.value, '1')!
    expect(own.id).not.toBe('wrs-bali')
    expect(own.websiteIds).toEqual(['1'])
    expect(own.minNights).toBe(6)
    const shared = websiteChannel.value.ruleSets.find(r => r.id === 'wrs-bali')!
    expect(shared.websiteIds).toEqual(['2'])
    expect(shared.minNights).toBe(1)
  })

  it('leaves the channel alone when the form has no rules', async () => {
    seedChannel()
    vi.useFakeTimers()
    const wrapper = mountPreview(undefined, '1')
    expect(wrapper.find('[data-testid="preview-rule-set"]').exists()).toBe(false)

    await clickButton(wrapper, 'Update Website')
    vi.advanceTimersByTime(1000)

    expect(ruleSetForWebsite(websiteChannel.value, '1')?.id).toBe('wrs-bali')
  })
})

describe('create page prefills the site rules when editing', () => {
  const SettingsStepStub = defineComponent({
    name: 'SettingsStepStub',
    props: { modelValue: { type: Object, required: true } },
    template: '<div data-testid="settings-step" :data-min="String(modelValue.rules?.minNights)" :data-name="String(modelValue.rules?.name)" />',
  })
  // Editing opens the website editor, which gets the settings as `settings`.
  const EditorStub = defineComponent({
    name: 'EditorStub',
    props: { settings: { type: Object, required: true } },
    template: '<div data-testid="settings-step" :data-min="String(settings.rules?.minNights)" :data-name="String(settings.rules?.name)" />',
  })
  const pageGlobal = {
    ...global,
    stubs: {
      ...STUBS,
      WebsiteBuilderStepsTemplateStep: true,
      WebsiteBuilderStepsSettingsStep: SettingsStepStub,
      // A new website sets its rules on the Details screen.
      WebsiteBuilderWizardDetailsStep: defineComponent({
        name: 'DetailsStepStub',
        props: { settings: { type: Object, required: true } },
        template: '<div data-testid="settings-step" :data-min="String(settings.rules?.minNights)" />',
      }),
      WebsiteBuilderStepsListingsStep: true,
      WebsiteBuilderStepsReviewStep: true,
      WebsiteBuilderStepsPreviewStep: true,
      WebsiteBuilderWebsiteEditor: EditorStub,
    },
  }

  it('starts on a copy of the rule set the site is in', async () => {
    seedChannel()
    websiteChannel.value = { ...websiteChannel.value, ruleSets: websiteChannel.value.ruleSets.map(r => r.id === 'wrs-bali' ? { ...r, minNights: 5 } : r) }
    vi.stubGlobal('useRoute', () => ({ query: { edit: '1' } }))
    const wrapper = mount(CreatePage, { global: pageGlobal })
    await nextTick()
    expect(wrapper.get('[data-testid="settings-step"]').attributes('data-min')).toBe('5')
    expect(wrapper.get('[data-testid="settings-step"]').attributes('data-name')).toBe('Bali sites')
  })

  it('starts on default rules for a new website', async () => {
    seedChannel()
    const wrapper = mount(CreatePage, { global: pageGlobal })
    await nextTick()
    ;(wrapper.vm as unknown as { step: string }).step = 'details'
    await nextTick()
    expect(wrapper.get('[data-testid="settings-step"]').attributes('data-min')).toBe('1')
  })
})

describe('website list rule set badge', () => {
  it('shows the rule set name, or an outline No rule set badge with a hint', () => {
    seedChannel()
    const wrapper = mount(IndexPage, { global })

    const inSet = wrapper.get('[data-testid="rule-set-1"]')
    expect(inSet.text()).toContain('Bali sites')
    expect(inSet.get('a').attributes('href')).toBe('/channels')

    const none = wrapper.get('[data-testid="rule-set-2"]')
    expect(none.text()).toContain('No rule set')
    expect(none.get('[data-variant="outline"]').exists()).toBe(true)
    expect(none.text()).toContain('No Website discounts on direct bookings')
  })

  it('hides the badge while the Website channel is not added', () => {
    seedChannel(false)
    const wrapper = mount(IndexPage, { global })
    expect(wrapper.find('[data-testid="rule-set-1"]').exists()).toBe(false)
  })
})
