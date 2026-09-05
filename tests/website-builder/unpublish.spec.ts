// Taking a live site down. Unpublishing is a status flip, never a delete: the site keeps
// its content, its review rules and its property coverage so it can go back up unchanged.

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import { setWebsiteStatus, websites } from '~/components/website-builder/data/websites'
import PreviewStep from '~/components/website-builder/steps/PreviewStep.vue'

describe('setWebsiteStatus', () => {
  const original = JSON.parse(JSON.stringify(websites.value))

  beforeEach(() => {
    websites.value = JSON.parse(JSON.stringify(original))
  })

  it('takes a published site back to draft', () => {
    const site = websites.value.find(w => w.status === 'published')!
    const updated = setWebsiteStatus(site.id, 'draft')

    expect(updated?.status).toBe('draft')
    expect(websites.value.find(w => w.id === site.id)?.status).toBe('draft')
  })

  it('keeps everything the site was built from, so it can go back up unchanged', () => {
    const site = websites.value.find(w => w.status === 'published')!
    websites.value = websites.value.map(w => (w.id === site.id
      ? { ...w, reviewIds: ['rr-001'], reviewConfig: createDefaultReviewConfig(), propertyIds: ['prop-1'] }
      : w))

    setWebsiteStatus(site.id, 'draft')
    const after = websites.value.find(w => w.id === site.id)!

    expect(after.reviewIds).toEqual(['rr-001'])
    expect(after.reviewConfig?.mode).toBe('auto')
    expect(after.propertyIds).toEqual(['prop-1'])
    expect(after.name).toBe(site.name)
  })

  it('publishes a draft again', () => {
    const site = websites.value.find(w => w.status === 'draft')!
    expect(setWebsiteStatus(site.id, 'published')?.status).toBe('published')
  })

  it('stamps the change so the card reports it as the latest edit', () => {
    const site = websites.value.find(w => w.status === 'published')!
    const before = site.lastUpdated
    expect(setWebsiteStatus(site.id, 'draft')?.lastUpdated).not.toBe(before)
  })

  it('reports an unknown id rather than mutating the list', () => {
    const before = websites.value.length
    expect(setWebsiteStatus('no-such-site', 'draft')).toBeNull()
    expect(websites.value).toHaveLength(before)
  })
})

// The wizard's own exit from a live site. "Save as draft" already unpublished it silently;
// on a published site the button now says what it does and asks first.
describe('previewStep unpublish', () => {
  const original = JSON.parse(JSON.stringify(websites.value))

  beforeEach(() => {
    websites.value = JSON.parse(JSON.stringify(original))
    vi.stubGlobal('navigateTo', vi.fn())
  })

  const global = {
    stubs: {
      Button: { template: '<button><slot /></button>' },
      Badge: { template: '<span><slot /></span>' },
      Card: { template: '<div><slot /></div>' },
      CardHeader: { template: '<div><slot /></div>' },
      CardTitle: { template: '<div><slot /></div>' },
      CardContent: { template: '<div><slot /></div>' },
      Separator: { template: '<hr>' },
      Icon: { template: '<i />' },
      AlertDialog: { template: '<div><slot /></div>' },
      AlertDialogContent: { template: '<div><slot /></div>' },
      AlertDialogTitle: { template: '<div><slot /></div>' },
      AlertDialogDescription: { template: '<div><slot /></div>' },
      AlertDialogFooter: { template: '<div><slot /></div>' },
      AlertDialogCancel: { template: '<button><slot /></button>' },
      AlertDialogAction: { template: '<button><slot /></button>' },
    },
    config: { warnHandler: () => {} },
  }

  function mountPreview(editId?: string) {
    vi.stubGlobal('useRoute', () => ({ query: editId ? { edit: editId } : {} }))
    return mount(PreviewStep, {
      props: {
        template: { id: 'luxury-villa', name: 'Luxury Villa', description: '', gradient: '', icon: '' },
        settings: {
          name: 'Villa Test',
          domain: 'villa-test.com',
          description: '',
          brandColor: '#1a1a2e',
          fontFamily: 'Inter',
          logoFile: null,
          faviconFile: null,
          useDefaultFavicon: true,
        },
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

  it('offers Unpublish instead of Save as Draft when the site is live', () => {
    const live = websites.value.find(w => w.status === 'published')!
    const wrapper = mountPreview(live.id)

    expect(wrapper.find('[data-testid="preview-unpublish"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Save as Draft')
    // The primary action is an update, not a first publish.
    expect(wrapper.text()).toContain('Update Website')
  })

  it('keeps Save as Draft for a site that is not live yet', () => {
    const draft = websites.value.find(w => w.status === 'draft')!
    const wrapper = mountPreview(draft.id)

    expect(wrapper.find('[data-testid="preview-unpublish"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Save as Draft')
    expect(wrapper.text()).toContain('Publish Website')
  })

  it('offers Save as Draft on a brand-new website', () => {
    const wrapper = mountPreview()
    expect(wrapper.find('[data-testid="preview-unpublish"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Save as Draft')
  })

  it('drops the site to draft once the confirmation is accepted', async () => {
    vi.useFakeTimers()
    const live = websites.value.find(w => w.status === 'published')!
    const wrapper = mountPreview(live.id)

    await wrapper.find('[data-testid="preview-unpublish"]').trigger('click')
    await wrapper.find('[data-testid="preview-unpublish-confirm"]').trigger('click')
    vi.advanceTimersByTime(1000)

    expect(websites.value.find(w => w.id === live.id)?.status).toBe('draft')
    vi.useRealTimers()
  })

  it('records the property coverage on save, so a site knows which listings it markets', async () => {
    vi.useFakeTimers()
    const live = websites.value.find(w => w.status === 'published')!
    websites.value = websites.value.map(w => (w.id === live.id ? { ...w, propertyIds: undefined } : w))
    const wrapper = mountPreview(live.id)

    await wrapper.find('[data-testid="preview-unpublish"]').trigger('click')
    await wrapper.find('[data-testid="preview-unpublish-confirm"]').trigger('click')
    vi.advanceTimersByTime(1000)

    expect(websites.value.find(w => w.id === live.id)?.propertyIds).toEqual(['prop-1'])
    vi.useRealTimers()
  })
})
