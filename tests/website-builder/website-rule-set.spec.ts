// Website Builder shows and sets the site's Website channel rule set. The channel
// (`useWebsiteChannel`) is the only writer: the Website object never stores the id.

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { defaultWebsiteState, newRuleSet, ruleSetForWebsite, websiteChannel } from '~/components/channels/data/website-channel'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import { websites } from '~/components/website-builder/data/websites'
import PreviewStep from '~/components/website-builder/steps/PreviewStep.vue'
import SettingsStep from '~/components/website-builder/steps/SettingsStep.vue'
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
const global = { stubs: STUBS, config: { warnHandler: () => {} } }

const originalWebsites = JSON.parse(JSON.stringify(websites.value))

function settings(ruleSetId?: string | null) {
  return {
    name: 'Villa Test',
    domain: 'villa-test.com',
    description: '',
    brandColor: '#1a1a2e',
    fontFamily: 'Inter',
    logoFile: null,
    faviconFile: null,
    useDefaultFavicon: true,
    ...(ruleSetId === undefined ? {} : { ruleSetId }),
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

describe('settingsStep booking rules', () => {
  it('says there are no rule sets and links to Channels when the channel has none', () => {
    const wrapper = mount(SettingsStep, { props: { modelValue: settings(null) }, global })
    expect(wrapper.find('[data-testid="ws-no-rule-sets"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="ws-booking-rules"]').find('[data-testid="select-stub"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ws-manage-rule-sets"]').attributes('href')).toBe('/channels')
  })

  it('lists No rule set plus every rule set with its summary', () => {
    seedChannel()
    const wrapper = mount(SettingsStep, { props: { modelValue: settings(null) }, global })
    const items = wrapper.get('[data-testid="ws-booking-rules"]').findAll('.select-item')
    expect(items.map(i => i.attributes('data-value'))).toEqual(['__none__', 'wrs-bali', 'wrs-long'])
    expect(items[0]!.text()).toBe('No rule set')
    expect(items[1]!.text()).toContain('Bali sites')
    expect(items[1]!.text()).toContain('2 stay discounts, up to 20%')
    expect(wrapper.get('[data-testid="ws-booking-rules"] [data-testid="select-stub"]').attributes('data-value')).toBe('__none__')
    expect(wrapper.get('[data-testid="ws-manage-rule-sets"]').text()).toContain('Manage on the Channels page')
  })

  it('emits the picked rule set, and null for No rule set', async () => {
    seedChannel()
    const wrapper = mount(SettingsStep, { props: { modelValue: settings(null) }, global })
    // The first Select on the step is Booking rules (the font picker comes after it).
    const select = wrapper.findAllComponents(SelectStub)[0]!
    expect(select.props('modelValue')).toBe('__none__')

    select.vm.$emit('update:modelValue', 'wrs-long')
    await nextTick()
    let emitted = wrapper.emitted('update:modelValue')!
    expect((emitted.at(-1)![0] as { ruleSetId: string | null }).ruleSetId).toBe('wrs-long')

    select.vm.$emit('update:modelValue', '__none__')
    await nextTick()
    emitted = wrapper.emitted('update:modelValue')!
    expect((emitted.at(-1)![0] as { ruleSetId: string | null }).ruleSetId).toBeNull()
  })

  it('preselects the rule set passed in', () => {
    seedChannel()
    const wrapper = mount(SettingsStep, { props: { modelValue: settings('wrs-bali') }, global })
    expect(wrapper.get('[data-testid="ws-booking-rules"] [data-testid="select-stub"]').attributes('data-value')).toBe('wrs-bali')
  })
})

describe('previewStep saves the rule set through the channel', () => {
  function mountPreview(ruleSetId: string | null | undefined, editId?: string) {
    vi.stubGlobal('useRoute', () => ({ query: editId ? { edit: editId } : {} }))
    return mount(PreviewStep, {
      props: {
        template: { id: 'luxury-villa', name: 'Luxury Villa', description: '', gradient: '', icon: '' },
        settings: settings(ruleSetId),
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

  it('puts a new website in the picked rule set on publish', async () => {
    seedChannel()
    vi.useFakeTimers()
    const before = websites.value.length
    const wrapper = mountPreview('wrs-long')
    expect(wrapper.get('[data-testid="preview-rule-set"]').text()).toContain('Long stays')

    await clickButton(wrapper, 'Publish Website')
    vi.advanceTimersByTime(1000)

    expect(websites.value).toHaveLength(before + 1)
    const created = websites.value.at(-1)!
    expect(ruleSetForWebsite(websiteChannel.value, created.id)?.id).toBe('wrs-long')
    expect(created).not.toHaveProperty('ruleSetId')
  })

  it('moves an edited site out of its rule set when No rule set is picked', async () => {
    seedChannel()
    vi.useFakeTimers()
    const wrapper = mountPreview(null, '1')
    expect(wrapper.get('[data-testid="preview-rule-set"]').text()).toContain('No rule set')

    await clickButton(wrapper, 'Update Website')
    vi.advanceTimersByTime(1000)

    expect(ruleSetForWebsite(websiteChannel.value, '1')).toBeUndefined()
  })

  it('moves an edited site into another rule set, out of its old one', async () => {
    seedChannel()
    vi.useFakeTimers()
    const wrapper = mountPreview('wrs-long', '1')

    await clickButton(wrapper, 'Update Website')
    vi.advanceTimersByTime(1000)

    expect(ruleSetForWebsite(websiteChannel.value, '1')?.id).toBe('wrs-long')
    expect(websiteChannel.value.ruleSets.find(r => r.id === 'wrs-bali')!.websiteIds).not.toContain('1')
  })

  it('leaves the rule set alone when the form never set one', async () => {
    seedChannel()
    vi.useFakeTimers()
    const wrapper = mountPreview(undefined, '1')
    expect(wrapper.find('[data-testid="preview-rule-set"]').exists()).toBe(false)

    await clickButton(wrapper, 'Update Website')
    vi.advanceTimersByTime(1000)

    expect(ruleSetForWebsite(websiteChannel.value, '1')?.id).toBe('wrs-bali')
  })
})

describe('create page preselects the site rule set when editing', () => {
  const SettingsStepStub = defineComponent({
    name: 'SettingsStepStub',
    props: { modelValue: { type: Object, required: true } },
    template: '<div data-testid="settings-step" :data-rule-set="String(modelValue.ruleSetId)" />',
  })
  const pageGlobal = {
    ...global,
    stubs: {
      ...STUBS,
      WebsiteBuilderStepsTemplateStep: true,
      WebsiteBuilderStepsSettingsStep: SettingsStepStub,
      WebsiteBuilderStepsPropertyStep: true,
      WebsiteBuilderStepsReviewStep: true,
      WebsiteBuilderStepsPreviewStep: true,
    },
  }

  it('starts on the rule set the site is in', async () => {
    seedChannel()
    vi.stubGlobal('useRoute', () => ({ query: { edit: '1' } }))
    const wrapper = mount(CreatePage, { global: pageGlobal })
    await nextTick()
    // The edit prefill runs client-side only; jump to Settings to read the form state.
    ;(wrapper.vm as unknown as { currentStep: number }).currentStep = 1
    await nextTick()
    expect(wrapper.get('[data-testid="settings-step"]').attributes('data-rule-set')).toBe('wrs-bali')
  })

  it('starts on No rule set for a new website', async () => {
    seedChannel()
    const wrapper = mount(CreatePage, { global: pageGlobal })
    await nextTick()
    ;(wrapper.vm as unknown as { currentStep: number }).currentStep = 1
    await nextTick()
    expect(wrapper.get('[data-testid="settings-step"]').attributes('data-rule-set')).toBe('null')
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
