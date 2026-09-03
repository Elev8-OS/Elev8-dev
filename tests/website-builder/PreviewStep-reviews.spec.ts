// The reviews part of the final wizard step: a mode-aware summary, and a Load more control
// that behaves the way the published site will.

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultReviewConfig } from '~/components/website-builder/data/review-config'
import PreviewStep from '~/components/website-builder/steps/PreviewStep.vue'

// PreviewStep calls useRoute() during setup; stub it the way
// tests/components/finance/DatevSetupWizard.spec.ts does.
beforeEach(() => {
  vi.stubGlobal('useRoute', () => ({ query: {} }))
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
  },
  config: { warnHandler: () => {} },
}

function mountPreview(configOverrides = {}, reviewOverrides = {}) {
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
        config: { ...createDefaultReviewConfig(), ...configOverrides },
        ...reviewOverrides,
      },
    },
    global,
  })
}

describe('previewStep review summary', () => {
  it('names auto mode and lists the rules in native scale', () => {
    const text = mountPreview().text()
    expect(text).toContain('Auto')
    expect(text).toContain('Airbnb 4.5+')
    expect(text).toContain('Booking.com 9+')
    expect(text).toContain('Direct 4.5+')
  })

  it('reports the resolved count in auto mode, not the picked count', () => {
    expect(mountPreview().text()).toContain('5 reviews match')
  })

  it('omits a disabled channel from the rule list', () => {
    const config = createDefaultReviewConfig()
    config.channels.direct.enabled = false
    expect(mountPreview(config).text()).not.toContain('Direct 4.5+')
  })

  it('reports the picked count in manual mode', () => {
    const text = mountPreview({ mode: 'manual' }, { selectedReviewIds: ['rr-001', 'rr-011'] }).text()
    expect(text).toContain('2 reviews selected')
  })

  it('warns when the section would be hidden by the minimum count', () => {
    const config = createDefaultReviewConfig()
    config.minCountToShow = 20
    expect(mountPreview(config).text()).toContain('hidden')
  })
})

describe('previewStep load more', () => {
  it('shows only one batch at first', () => {
    const config = createDefaultReviewConfig()
    config.batchSize = 2
    const wrapper = mountPreview(config)
    expect(wrapper.findAll('[data-testid="preview-review-card"]')).toHaveLength(2)
  })

  it('appends the next batch when Load more is clicked', async () => {
    const config = createDefaultReviewConfig()
    config.batchSize = 2
    const wrapper = mountPreview(config)

    const loadMore = wrapper.find('[data-testid="preview-load-more"]')
    await loadMore.trigger('click')
    expect(wrapper.findAll('[data-testid="preview-review-card"]')).toHaveLength(4)
  })

  it('hides Load more once the pool is exhausted', async () => {
    const config = createDefaultReviewConfig()
    config.batchSize = 4
    const wrapper = mountPreview(config)

    await wrapper.find('[data-testid="preview-load-more"]').trigger('click')
    expect(wrapper.findAll('[data-testid="preview-review-card"]')).toHaveLength(5)
    expect(wrapper.find('[data-testid="preview-load-more"]').exists()).toBe(false)
  })

  it('never shows Load more when one batch covers everything', () => {
    const wrapper = mountPreview() // batchSize 12, pool of 5
    expect(wrapper.find('[data-testid="preview-load-more"]').exists()).toBe(false)
  })
})
