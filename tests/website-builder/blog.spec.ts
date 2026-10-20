// Blog menu: data helpers and the posts list, AI generate and editor.

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newRuleSet } from '~/components/channels/data/website-channel'
import { canPublish, draftTranslation, generateCover, generatePost, isTranslated, missingLanguages, postTitle } from '~/components/website-builder/data/blog'
import WebsiteBlog from '~/components/website-builder/WebsiteBlog.vue'

describe('blog cover', () => {
  it('draws an SVG picture, the same for the same topic and different for another seed', () => {
    const a = generateCover('Why book direct')
    expect(a.url.startsWith('data:image/svg+xml')).toBe(true)
    expect(a.source).toBe('ai')
    expect(generateCover('Why book direct').url).toBe(a.url)
    expect(generateCover('Why book direct', 1).url).not.toBe(a.url)
  })

  it('gives a generated post a cover', () => {
    expect(generatePost('topic', 'Site', ['en']).cover?.source).toBe('ai')
  })
})

describe('blog data', () => {
  it('writes the same topic in every language the site has', () => {
    const post = generatePost('best time to visit Bali', 'Villa Sunset', ['en', 'de', 'zh'])
    expect(Object.keys(post.translations)).toEqual(['en', 'de', 'zh'])
    expect(post.status).toBe('draft')
    expect(post.aiGenerated).toBe(true)
    expect(post.translations.en!.title).toContain('Best time to visit Bali')
    expect(post.translations.de!.title).toContain('Sie')
    expect(post.translations.zh!.body).toContain('Villa Sunset')
  })

  it('falls back to English for a language it has no template for', () => {
    expect(draftTranslation('x', 'S', 'xx').title).toBe(draftTranslation('x', 'S', 'en').title)
  })

  it('knows which languages are missing and when a post can publish', () => {
    const post = generatePost('topic', 'Site', ['en'])
    expect(isTranslated(post, 'en')).toBe(true)
    expect(missingLanguages(post, ['en', 'fr'])).toEqual(['fr'])
    expect(canPublish(post, 'en')).toBe(true)
    expect(canPublish(post, 'fr')).toBe(false)
  })

  it('titles a post in the asked language, else the first one written', () => {
    const post = generatePost('topic', 'Site', ['de'])
    expect(postTitle(post, 'en')).toBe(post.translations.de!.title)
  })
})

const passthrough = { template: '<div><slot /></div>' }
const global = {
  stubs: {
    Icon: true,
    Spinner: true,
    Label: passthrough,
    Badge: passthrough,
    Button: { template: '<button><slot /></button>' },
    Input: { props: ['modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">' },
    Textarea: { props: ['modelValue'], template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    Switch: true,
    Dialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
    DialogContent: passthrough,
    DialogHeader: passthrough,
    DialogTitle: passthrough,
    DialogDescription: passthrough,
    DialogFooter: passthrough,
    Tabs: passthrough,
    TabsList: passthrough,
    TabsTrigger: passthrough,
    TabsContent: passthrough,
    AlertDialog: { props: ['open'], template: '<div v-if="open"><slot /></div>' },
    AlertDialogContent: passthrough,
    AlertDialogTitle: passthrough,
    AlertDialogDescription: passthrough,
    AlertDialogFooter: passthrough,
    AlertDialogCancel: passthrough,
    AlertDialogAction: { template: '<button><slot /></button>' },
  },
  config: { warnHandler: () => {} },
}

function settings(extra: Record<string, unknown> = {}) {
  return { name: 'Villa Sunset', domain: 'v.elev8-stays.com', description: '', brandColor: '#000', fontFamily: 'Inter', logoFile: null, faviconFile: null, useDefaultFavicon: false, rules: newRuleSet(), languages: ['en', 'de'], defaultLanguage: 'en', ...extra }
}

function mountBlog(extra: Record<string, unknown> = {}) {
  return mount(WebsiteBlog, { props: { settings: settings(extra) }, global })
}
const lastSettings = (w: ReturnType<typeof mountBlog>) => w.emitted('update:settings')!.at(-1)![0] as { blogPosts: ReturnType<typeof generatePost>[] }

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('blog menu', () => {
  it('starts empty with both ways to write a post', () => {
    const wrapper = mountBlog()
    expect(wrapper.find('[data-testid="blog-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="blog-new"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="blog-ai"]').exists()).toBe(true)
  })

  it('generates a draft in every site language and opens it for editing', async () => {
    const wrapper = mountBlog()
    await wrapper.get('[data-testid="blog-ai"]').trigger('click')
    await wrapper.get('#blog-topic').setValue('Why book direct')
    await wrapper.get('[data-testid="blog-generate"]').trigger('click')
    vi.advanceTimersByTime(1300)
    await flushPromises()
    expect(wrapper.find('[data-testid="blog-editor"]').exists()).toBe(true)
    expect((wrapper.get('#blog-title-en').element as HTMLInputElement).value).toContain('Why book direct')
    expect((wrapper.get('#blog-title-de').element as HTMLInputElement).value).toContain('Why book direct')
  })

  it('saves a post on the website and asks the editor to save', async () => {
    const wrapper = mountBlog()
    await wrapper.get('[data-testid="blog-new"]').trigger('click')
    await wrapper.get('#blog-title-en').setValue('Hello')
    await wrapper.get('#blog-body-en').setValue('Body text')
    await wrapper.get('[data-testid="blog-save"]').trigger('click')
    await flushPromises()
    const posts = lastSettings(wrapper).blogPosts
    expect(posts).toHaveLength(1)
    expect(posts[0]!.translations.en!.title).toBe('Hello')
    expect(posts[0]!.status).toBe('draft')
    expect(wrapper.emitted('save')![0]).toEqual(['Post saved as draft'])
  })

  it('shows which languages of a post are written and which are missing', () => {
    const post = generatePost('topic', 'Villa', ['en'])
    const wrapper = mountBlog({ blogPosts: [post] })
    const chips = wrapper.findAll('[data-testid="blog-lang"]')
    expect(chips.map(c => c.text())).toEqual(['en', 'de'])
    expect(chips[0]!.attributes('title')).toContain('written')
    expect(chips[1]!.attributes('title')).toContain('missing')
  })

  it('writes a missing language with AI', async () => {
    const post = generatePost('Why book direct', 'Villa', ['en'])
    const wrapper = mountBlog({ blogPosts: [post] })
    await wrapper.get('[aria-label^="Edit "]').trigger('click')
    expect((wrapper.get('#blog-title-de').element as HTMLInputElement).value).toBe('')
    await wrapper.get('[data-testid="blog-translate-de"]').trigger('click')
    vi.advanceTimersByTime(900)
    await flushPromises()
    expect((wrapper.get('#blog-title-de').element as HTMLInputElement).value).toContain('Why book direct')
  })

  it('deletes a post after confirming', async () => {
    const post = generatePost('topic', 'Villa', ['en', 'de'])
    const wrapper = mountBlog({ blogPosts: [post] })
    await wrapper.get('[aria-label^="Delete "]').trigger('click')
    await wrapper.get('[data-testid="blog-delete-confirm"]').trigger('click')
    await flushPromises()
    expect(lastSettings(wrapper).blogPosts).toEqual([])
    expect(wrapper.emitted('save')![0]).toEqual(['Post deleted'])
  })
})

describe('blog publish and cover', () => {
  it('publishes a draft from the list card and saves the website', async () => {
    const wrapper = mountBlog({ blogPosts: [generatePost('topic', 'Villa', ['en', 'de'])] })
    expect(wrapper.get('[data-testid="blog-publish"]').text()).toBe('Publish')
    await wrapper.get('[data-testid="blog-publish"]').trigger('click')
    await flushPromises()
    expect(lastSettings(wrapper).blogPosts[0]!.status).toBe('published')
    expect(wrapper.emitted('save')![0]).toEqual(['Post published'])
  })

  it('unpublishes a live post back to a draft', async () => {
    const live = { ...generatePost('topic', 'Villa', ['en', 'de']), status: 'published' as const }
    const wrapper = mountBlog({ blogPosts: [live] })
    expect(wrapper.get('[data-testid="blog-publish"]').text()).toBe('Unpublish')
    await wrapper.get('[data-testid="blog-publish"]').trigger('click')
    await flushPromises()
    expect(lastSettings(wrapper).blogPosts[0]!.status).toBe('draft')
  })

  it('cannot publish a post that has no default language written', () => {
    const post = generatePost('topic', 'Villa', ['de'])
    const wrapper = mountBlog({ blogPosts: [post] })
    expect(wrapper.get('[data-testid="blog-publish"]').attributes('disabled')).toBeDefined()
  })

  it('shows the cover on the card, or a placeholder when there is none', () => {
    const withCover = generatePost('topic', 'Villa', ['en'])
    const without = { ...generatePost('other', 'Villa', ['en']), cover: undefined }
    const wrapper = mountBlog({ blogPosts: [withCover, without] })
    const thumbs = wrapper.findAll('[data-testid="blog-thumb"]')
    expect(thumbs.filter(t => t.find('img').exists())).toHaveLength(1)
  })

  it('makes a cover with AI in the editor and removes it', async () => {
    const wrapper = mountBlog()
    await wrapper.get('[data-testid="blog-new"]').trigger('click')
    expect(wrapper.get('[data-testid="blog-cover"]').find('img').exists()).toBe(false)
    await wrapper.get('[data-testid="blog-cover-ai"]').trigger('click')
    vi.advanceTimersByTime(1000)
    await flushPromises()
    expect(wrapper.get('[data-testid="blog-cover"]').find('img').exists()).toBe(true)
    await wrapper.get('[data-testid="blog-cover-remove"]').trigger('click')
    expect(wrapper.get('[data-testid="blog-cover"]').find('img').exists()).toBe(false)
  })

  it('replaces the cover with an uploaded picture', async () => {
    const wrapper = mountBlog()
    await wrapper.get('[data-testid="blog-new"]').trigger('click')
    const input = wrapper.get('[data-testid="blog-cover-upload"]')
    const file = new File(['x'], 'beach.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await vi.waitFor(() => expect(wrapper.get('[data-testid="blog-cover"]').find('img').exists()).toBe(true), { timeout: 2000 })
    expect(wrapper.get('[data-testid="blog-cover"]').text()).toContain('beach.png')
  })
})
