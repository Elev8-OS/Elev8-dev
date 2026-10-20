// The edit-website layout: header, section nav and one section at a time.

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultWebsiteState, newRuleSet, ruleSetForWebsite, websiteChannel } from '~/components/channels/data/website-channel'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import { websites } from '~/components/website-builder/data/websites'
import WebsiteEditor from '~/components/website-builder/WebsiteEditor.vue'

const passthrough = { template: '<div><slot /></div>' }
const SettingsStub = { template: '<div data-testid="settings-step" />' }
const global = {
  stubs: {
    Icon: true,
    Button: { template: '<button><slot /></button>' },
    Badge: passthrough,
    Textarea: true,
    Input: { props: ['modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">' },
    Select: passthrough,
    SelectTrigger: passthrough,
    SelectValue: true,
    SelectContent: passthrough,
    SelectItem: passthrough,
    AlertDialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
    AlertDialogContent: passthrough,
    AlertDialogTitle: passthrough,
    AlertDialogDescription: passthrough,
    AlertDialogFooter: passthrough,
    AlertDialogCancel: passthrough,
    AlertDialogAction: passthrough,
    WebsiteBuilderWebsiteSiteSettings: SettingsStub,
    WebsiteBuilderWebsiteBookingRules: { template: '<div data-testid="rules-section" />' },
    WebsiteBuilderStepsListingsStep: { template: '<div data-testid="property-step" />' },
    WebsiteBuilderStepsReviewStep: { template: '<div data-testid="review-step" />' },
  },
  config: { warnHandler: () => {} },
}

const originalWebsites = JSON.parse(JSON.stringify(websites.value))

function mountEditor(overrides: { name?: string, propertyIds?: string[] } = {}) {
  return mount(WebsiteEditor, {
    props: {
      website: websites.value.find(w => w.id === '1')!,
      template: null,
      settings: {
        name: overrides.name ?? 'Villa Sunset Bali',
        domain: 'villa-sunset-bali.com',
        description: '',
        brandColor: '#1a1a2e',
        fontFamily: 'Inter',
        logoFile: null,
        faviconFile: null,
        useDefaultFavicon: false,
        rules: { ...newRuleSet(), minNights: 3 },
      },
      property: { propertyIds: overrides.propertyIds ?? ['prop-1'], roomIds: [] },
      reviews: { selectedReviewIds: [], featuredReviewIds: [], manualReviews: [], featuredManualReviewIds: [], config: createDefaultReviewConfig() },
    },
    global,
  })
}

beforeEach(() => {
  websites.value = JSON.parse(JSON.stringify(originalWebsites))
})

afterEach(() => {
  websiteChannel.value = defaultWebsiteState()
  try {
    localStorage.clear()
  }
  catch {}
  vi.useRealTimers()
})

describe('websiteEditor', () => {
  it('shows the site, its listing count and a section nav starting on AI Generate', () => {
    const wrapper = mountEditor()
    expect(wrapper.get('[data-testid="we-title"]').text()).toBe('Villa Sunset Bali')
    expect(wrapper.text()).toContain('Listings')
    const labels = wrapper.findAll('nav button').map(b => b.text())
    expect(labels).toEqual(['AI Generate', 'Site Settings', 'Booking Rules', 'Manage Listings', 'Blog', 'Surroundings', 'Reviews', 'SEO', 'Cookie & Legal', 'Analytics'])
    expect(wrapper.find('[data-testid="we-ai"]').exists()).toBe(true)
    // The empty state is for sections with nothing to set up, never under AI Generate.
    expect(wrapper.find('[data-testid="we-empty"]').exists()).toBe(false)
    // Chat and preview are split by a draggable handle.
    expect(wrapper.find('[data-testid="we-ai-handle"]').exists()).toBe(true)
  })

  it('opens the builder steps embedded, without their own Back / Next', async () => {
    const wrapper = mountEditor()
    await wrapper.get('[data-testid="we-nav-settings"]').trigger('click')
    expect(wrapper.find('[data-testid="settings-step"]').exists()).toBe(true)
    await wrapper.get('[data-testid="we-nav-rules"]').trigger('click')
    expect(wrapper.find('[data-testid="rules-section"]').exists()).toBe(true)
    await wrapper.get('[data-testid="we-nav-listings"]').trigger('click')
    expect(wrapper.find('[data-testid="property-step"]').exists()).toBe(true)
    await wrapper.get('[data-testid="we-nav-reviews"]').trigger('click')
    expect(wrapper.find('[data-testid="review-step"]').exists()).toBe(true)
  })

  it('saves the changes and the site rules, keeping the site published', async () => {
    const wrapper = mountEditor({ name: 'Villa Renamed' })
    await wrapper.get('[data-testid="we-save"]').trigger('click')
    const site = websites.value.find(w => w.id === '1')!
    expect(site.name).toBe('Villa Renamed')
    expect(site.status).toBe('published')
    expect(ruleSetForWebsite(websiteChannel.value, '1')?.minNights).toBe(3)
  })

  it('refuses to save without a property', async () => {
    const wrapper = mountEditor({ propertyIds: [] })
    await wrapper.get('[data-testid="we-save"]').trigger('click')
    expect(ruleSetForWebsite(websiteChannel.value, '1')).toBeUndefined()
  })

  it('unpublishes after confirming, back to a draft', async () => {
    const wrapper = mountEditor()
    expect(wrapper.find('[data-testid="we-unpublish-confirm"]').exists()).toBe(false)
    await wrapper.get('[data-testid="we-unpublish"]').trigger('click')
    await wrapper.get('[data-testid="we-unpublish-confirm"]').trigger('click')
    expect(websites.value.find(w => w.id === '1')!.status).toBe('draft')
  })
})

describe('inline title edit', () => {
  it('renames the site from the header and keeps the change on Enter', async () => {
    const wrapper = mountEditor()
    await wrapper.get('[data-testid="we-title-edit"]').trigger('click')
    const input = wrapper.get('[data-testid="we-title-input"]')
    await input.setValue('Villa Renamed')
    await input.trigger('keydown', { key: 'Enter' })
    const updates = wrapper.emitted('update:settings')!
    expect((updates.at(-1)![0] as { name: string }).name).toBe('Villa Renamed')
    expect(wrapper.find('[data-testid="we-title-input"]').exists()).toBe(false)
  })

  it('drops the change on Escape', async () => {
    const wrapper = mountEditor()
    await wrapper.get('[data-testid="we-title-edit"]').trigger('click')
    const input = wrapper.get('[data-testid="we-title-input"]')
    await input.setValue('Nope')
    await input.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('update:settings')).toBeUndefined()
    expect(wrapper.get('[data-testid="we-title"]').text()).toBe('Villa Sunset Bali')
  })
})

describe('save changes per section', () => {
  it('has a Save changes button under Manage Listings and Reviews', async () => {
    const wrapper = mountEditor()
    await wrapper.get('[data-testid="we-nav-listings"]').trigger('click')
    expect(wrapper.get('[data-testid="we-save-listings"]').text()).toBe('Save changes')
    await wrapper.get('[data-testid="we-nav-reviews"]').trigger('click')
    expect(wrapper.get('[data-testid="we-save-reviews"]').text()).toBe('Save changes')
  })
})
