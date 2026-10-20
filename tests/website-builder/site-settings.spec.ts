// Site Settings of the website editor: identity, address, booking rules.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { newRuleSet } from '~/components/channels/data/website-channel'
import SiteSettings from '~/components/website-builder/WebsiteSiteSettings.vue'

const passthrough = { template: '<div><slot /></div>' }
const global = {
  stubs: {
    Icon: true,
    Label: passthrough,
    Badge: { template: '<span data-testid="ss-domain-status"><slot /></span>' },
    Button: { template: '<button><slot /></button>' },
    Input: { props: ['modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">' },
    InputGroup: passthrough,
    InputGroupInput: { props: ['modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">' },
    InputGroupAddon: passthrough,
    InputGroupText: passthrough,
    WebsiteRuleSetForm: true,
  },
  config: { warnHandler: () => {} },
}

function settings(domain: string) {
  return { name: 'Villa Sunset Bali', domain, description: '', brandColor: '#1a1a2e', fontFamily: 'Inter', logoFile: null, faviconFile: null, useDefaultFavicon: false, rules: newRuleSet() }
}

function mountSettings(domain: string, published = false) {
  return mount(SiteSettings, { props: { settings: settings(domain), published }, global })
}

describe('site settings address', () => {
  it('splits a platform address into its subdomain and shows no custom domain', () => {
    const wrapper = mountSettings('villa-sunset.elev8-stays.com')
    expect((wrapper.get('#ss-subdomain').element as HTMLInputElement).value).toBe('villa-sunset')
    expect((wrapper.get('#ss-custom').element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('[data-testid="ss-dns"]').exists()).toBe(false)
  })

  it('treats any other address as the custom domain and lists the DNS records for it and its www twin', () => {
    const wrapper = mountSettings('villa-sunset-bali.com')
    expect((wrapper.get('#ss-custom').element as HTMLInputElement).value).toBe('villa-sunset-bali.com')
    const dns = wrapper.get('[data-testid="ss-dns"]').text()
    expect(dns).toContain('villa-sunset-bali.com')
    expect(dns).toContain('www.villa-sunset-bali.com')
  })

  it('shows the custom domain as Pending for a draft and Active once published', () => {
    expect(mountSettings('villa-sunset-bali.com').get('[data-testid="ss-domain-status"]').text()).toBe('Pending')
    expect(mountSettings('villa-sunset-bali.com', true).get('[data-testid="ss-domain-status"]').text()).toBe('Active')
  })

  it('warns when the subdomain changes and writes the new address into the settings', async () => {
    const wrapper = mountSettings('villa-sunset.elev8-stays.com')
    expect(wrapper.find('[data-testid="ss-subdomain-warning"]').exists()).toBe(false)
    await wrapper.get('#ss-subdomain').setValue('villa-new')
    expect(wrapper.find('[data-testid="ss-subdomain-warning"]').exists()).toBe(true)
    const updates = wrapper.emitted('update:settings')!
    expect((updates.at(-1)![0] as { domain: string }).domain).toBe('villa-new.elev8-stays.com')
  })

  it('tells the editor the site moved when saving after a subdomain change', async () => {
    const wrapper = mountSettings('villa-sunset.elev8-stays.com')
    await wrapper.get('[data-testid="ss-save"]').trigger('click')
    expect(wrapper.emitted('save')![0]).toEqual([false])
    await wrapper.get('#ss-subdomain').setValue('villa-new')
    await wrapper.get('[data-testid="ss-save"]').trigger('click')
    expect(wrapper.emitted('save')![1]).toEqual([true])
  })

  it('offers a re-render only after a save', async () => {
    const wrapper = mountSettings('villa-sunset.elev8-stays.com')
    expect(wrapper.find('[data-testid="ss-saved"]').exists()).toBe(false)
    await wrapper.setProps({ saved: true })
    expect(wrapper.get('[data-testid="ss-saved"]').text()).toContain('Re-render')
  })
})

describe('site settings hero media', () => {
  it('starts as a static hero with no photos and an Add photo tile', () => {
    const wrapper = mountSettings('villa-sunset.elev8-stays.com')
    expect(wrapper.get('[data-testid="ss-hero-static"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.findAll('[data-testid="ss-hero-photo"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('Photos (0)')
    expect(wrapper.find('[data-testid="ss-hero-video-upload"]').exists()).toBe(false)
  })

  it('switches the display mode and shows the video upload instead of photos', async () => {
    const wrapper = mountSettings('villa-sunset.elev8-stays.com')
    await wrapper.get('[data-testid="ss-hero-carousel"]').trigger('click')
    expect((wrapper.emitted('update:settings')!.at(-1)![0] as { heroMode: string }).heroMode).toBe('carousel')
    await wrapper.setProps({ settings: { ...settings('villa-sunset.elev8-stays.com'), heroMode: 'video', heroVideoFile: 'tour.mp4' } })
    expect(wrapper.find('[data-testid="ss-hero-photos"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ss-hero-video-upload"]').text()).toContain('tour.mp4')
  })

  it('marks only the first photo as the hero in static mode', async () => {
    const wrapper = mountSettings('villa-sunset.elev8-stays.com')
    const heroImages = [{ id: 'a', name: 'a.jpg', url: 'blob:a' }, { id: 'b', name: 'b.jpg', url: 'blob:b' }]
    await wrapper.setProps({ settings: { ...settings('villa-sunset.elev8-stays.com'), heroImages } })
    const photos = wrapper.findAll('[data-testid="ss-hero-photo"]')
    expect(photos).toHaveLength(2)
    expect(photos[0]!.text()).toContain('Hero')
    expect(photos[1]!.text()).not.toContain('Hero')
  })
})

describe('site settings languages', () => {
  it('shows English as the only language by default and cannot remove the last one', async () => {
    const wrapper = mountSettings('villa-sunset.elev8-stays.com')
    expect(wrapper.find('[aria-label="Remove English"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="ss-lang-de"]').trigger('click')
    const next = wrapper.emitted('update:settings')!.at(-1)![0] as { languages: string[], defaultLanguage: string }
    expect(next.languages).toEqual(['en', 'de'])
    expect(next.defaultLanguage).toBe('en')
  })

  it('moves the default to a remaining language when the default is removed', async () => {
    const wrapper = mount(SiteSettings, { props: { settings: { ...settings('v.elev8-stays.com'), languages: ['en', 'de'], defaultLanguage: 'en' }, published: false }, global })
    await wrapper.get('[aria-label="Remove English"]').trigger('click')
    const next = wrapper.emitted('update:settings')!.at(-1)![0] as { languages: string[], defaultLanguage: string }
    expect(next.languages).toEqual(['de'])
    expect(next.defaultLanguage).toBe('de')
  })

  it('sets the default language and toggles auto-detect', async () => {
    const wrapper = mount(SiteSettings, { props: { settings: { ...settings('v.elev8-stays.com'), languages: ['en', 'de'], defaultLanguage: 'en' }, published: false }, global })
    await wrapper.get('[aria-label="Set German as default language"]').trigger('click')
    expect((wrapper.emitted('update:settings')!.at(-1)![0] as { defaultLanguage: string }).defaultLanguage).toBe('de')
    await wrapper.get('[data-testid="ss-autodetect"]').trigger('click')
    expect((wrapper.emitted('update:settings')!.at(-1)![0] as { autoDetectLanguage: boolean }).autoDetectLanguage).toBe(true)
  })
})
