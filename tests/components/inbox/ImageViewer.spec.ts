import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ImageViewer from '~/components/inbox/ImageViewer.vue'
import { useImageViewer } from '~/composables/useImageViewer'

function mountViewer(scope?: string) {
  return mount(ImageViewer, {
    props: scope ? { scope } : {},
    global: {
      stubs: {
        Icon: true,
        // Honours `open`, so a shut viewer renders nothing.
        Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
        DialogContent: { template: '<div data-testid="image-viewer"><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        DialogDescription: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('imageViewer scopes', () => {
  it('opens only the instance whose scope the photo was opened in', async () => {
    const inbox = mountViewer()
    const claim = mountViewer('damage-claim')
    useImageViewer('damage-claim').openImage({ url: '/p/sofa.jpg' })
    await claim.vm.$nextTick()
    expect(claim.find('[data-testid="image-viewer"]').exists()).toBe(true)
    expect(inbox.find('[data-testid="image-viewer"]').exists()).toBe(false)
  })

  it('keeps the default scope for the inbox', () => {
    useImageViewer().openImage({ url: '/p/a.jpg' })
    expect(useImageViewer('inbox').viewedImage.value?.url).toBe('/p/a.jpg')
  })
})

describe('imageViewer zoom', () => {
  it('opens fitted, zooms in on a click, and fits again on the next', async () => {
    const wrapper = mountViewer('damage-claim')
    useImageViewer('damage-claim').openImage({ url: '/p/sofa.jpg' })
    await wrapper.vm.$nextTick()

    const zoom = () => wrapper.find('[data-testid="viewer-zoom"]')
    expect(zoom().attributes('aria-pressed')).toBe('false')
    expect(zoom().attributes('aria-label')).toBe('Zoom in')
    expect(wrapper.text()).toContain('Click the photo to zoom in.')

    await zoom().trigger('click')
    expect(zoom().attributes('aria-pressed')).toBe('true')
    expect(zoom().attributes('aria-label')).toBe('Zoom out')
    expect(zoom().attributes('style')).toContain('width: 250%')
    expect(wrapper.find('[data-testid="viewer-frame"]').classes()).toContain('overflow-auto')

    await zoom().trigger('click')
    expect(zoom().attributes('aria-pressed')).toBe('false')
    expect(zoom().attributes('style')).toBeUndefined()
  })

  it('opens the next photo fitted, not at the last one\'s zoom', async () => {
    const wrapper = mountViewer('damage-claim')
    const viewer = useImageViewer('damage-claim')
    viewer.openImage({ url: '/p/a.jpg' })
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="viewer-zoom"]').trigger('click')
    viewer.openImage({ url: '/p/b.jpg' })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="viewer-zoom"]').attributes('aria-pressed')).toBe('false')
  })

  it('offers no zoom on a photo that failed to load', async () => {
    const wrapper = mountViewer('damage-claim')
    useImageViewer('damage-claim').openImage({ url: '/p/dead.jpg' })
    await wrapper.vm.$nextTick()
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('[data-testid="viewer-zoom"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="viewer-photo-unavailable"]').exists()).toBe(true)
  })
})
