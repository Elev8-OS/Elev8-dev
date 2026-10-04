import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ListingPhotosEditor from '~/components/listings/ListingPhotosEditor.vue'

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast }))

function mountEditor(photos: string[]) {
  return mount(ListingPhotosEditor, {
    props: { 'photos': photos, 'onUpdate:photos': () => {} },
    global: {
      stubs: {
        Icon: true,
        Badge: { template: '<span><slot /></span>' },
        Dialog: { template: '<div><slot /></div>' },
        DialogContent: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
      },
    },
  })
}

const file = (name: string, type: string, size = 10) => new File([new Uint8Array(size)], name, { type })

async function upload(w: ReturnType<typeof mountEditor>, files: File[]) {
  const input = w.find('[data-testid="photo-file-input"]')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  // FileReader resolves on later ticks.
  await new Promise(r => setTimeout(r, 20))
  await flushPromises()
}

describe('listingPhotosEditor', () => {
  it('uploads several photos in one update, so none is lost', async () => {
    const w = mountEditor(['a.jpg'])
    await upload(w, [file('one.jpg', 'image/jpeg'), file('two.png', 'image/png')])
    const updates = w.emitted('update:photos')!
    expect(updates).toHaveLength(1)
    expect(updates[0]![0]).toHaveLength(3)
    expect((updates[0]![0] as string[])[0]).toBe('a.jpg')
  })

  it('skips a file of the wrong type and says why', async () => {
    const w = mountEditor([])
    await upload(w, [file('doc.pdf', 'application/pdf'), file('ok.webp', 'image/webp')])
    expect(toast.error).toHaveBeenCalledWith('doc.pdf skipped: not a JPEG, PNG or WebP')
    expect((w.emitted('update:photos')![0]![0] as string[])).toHaveLength(1)
  })

  it('deletes a photo, and the first photo is the thumbnail', async () => {
    const w = mountEditor(['a.jpg', 'b.jpg'])
    expect(w.findAll('[data-testid="photo-tile"]')[0]!.text()).toContain('Thumbnail')
    await w.find('[aria-label="Delete photo 1"]').trigger('click')
    expect(w.emitted('update:photos')![0]![0]).toEqual(['b.jpg'])
  })

  it('reorders by drag and drop', async () => {
    const w = mountEditor(['a.jpg', 'b.jpg', 'c.jpg'])
    const tiles = w.findAll('[data-testid="photo-tile"]')
    await tiles[2]!.trigger('dragstart')
    await tiles[0]!.trigger('drop')
    expect(w.emitted('update:photos')![0]![0]).toEqual(['c.jpg', 'a.jpg', 'b.jpg'])
  })

  it('hides the add slot at 20 photos', () => {
    const w = mountEditor(Array.from({ length: 20 }, (_, i) => `${i}.jpg`))
    expect(w.find('[data-testid="photo-add"]').exists()).toBe(false)
  })
})
