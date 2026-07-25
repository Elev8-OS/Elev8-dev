import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PortalHeader from '~/components/owner-portal/PortalHeader.vue'
import PortalMagicLinkForm from '~/components/owner-portal/PortalMagicLinkForm.vue'
import { useOwnerAuth } from '~/composables/useOwnerAuth'

const navigateTo = vi.fn()

const globalOptions = {
  stubs: {
    Icon: { props: ['name'], template: '<span :data-icon="name" />' },
    NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  },
}

describe('portalMagicLinkForm', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigateTo.mockReset()
    vi.stubGlobal('navigateTo', navigateTo)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  async function submitEmail(email: string) {
    const wrapper = mount(PortalMagicLinkForm, { global: globalOptions })
    await wrapper.get('input[type="email"]').setValue(email)
    await wrapper.get('form').trigger('submit')
    await vi.runAllTimersAsync()
    await flushPromises()
    return wrapper
  }

  it('shows the same generic link-sent state for seeded and unknown emails', async () => {
    const seeded = await submitEmail('wayan.sari@example.com')
    expect(seeded.get('[data-testid="magic-link-sent"]').text()).toContain('If an owner account matches')

    useOwnerAuth().logout()

    const unknown = await submitEmail('unknown@example.com')
    expect(unknown.get('[data-testid="magic-link-sent"]').text()).toContain('If an owner account matches')
    expect(unknown.text()).not.toContain('not found')
    expect(unknown.text()).not.toContain('unknown')
  })

  it('disables submission while a magic-link request is pending', async () => {
    const wrapper = mount(PortalMagicLinkForm, { global: globalOptions })
    await wrapper.get('input[type="email"]').setValue('wayan.sari@example.com')
    await wrapper.get('form').trigger('submit')

    const submit = wrapper.get('button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    expect(submit.text()).toContain('Sending')

    await vi.runAllTimersAsync()
    await flushPromises()
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
  })

  it('opens a seeded demo secure link and navigates to the portal overview', async () => {
    const wrapper = await submitEmail('wayan.sari@example.com')
    await wrapper.get('[data-testid="open-demo-secure-link"]').trigger('click')

    expect(useOwnerAuth().isAuthenticated.value).toBe(true)
    expect(navigateTo).toHaveBeenCalledWith('/owner-portal')
  })

  it('keeps the generic sent state and does not navigate for an invalid demo email', async () => {
    const wrapper = await submitEmail('not-seeded@example.com')
    await wrapper.get('[data-testid="open-demo-secure-link"]').trigger('click')

    expect(useOwnerAuth().isAuthenticated.value).toBe(false)
    expect(navigateTo).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="magic-link-sent"]').text()).toContain('If an owner account matches')
    expect(wrapper.get('[role="alert"]').text()).toBe('This secure link could not be opened. Request a new link and try again.')
  })
})

describe('portalHeader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigateTo.mockReset()
    vi.stubGlobal('navigateTo', navigateTo)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows the current owner and clears the session on sign out', async () => {
    const auth = useOwnerAuth()
    const request = auth.requestMagicLink('wayan.sari@example.com')
    await vi.runAllTimersAsync()
    await request
    auth.acceptDemoLink()

    const wrapper = mount(PortalHeader, { global: globalOptions })
    expect(wrapper.text()).toContain('Wayan Sari')

    await wrapper.get('[data-testid="owner-sign-out"]').trigger('click')

    expect(auth.session.value).toBeNull()
    expect(auth.pendingEmail.value).toBeNull()
    expect(navigateTo).toHaveBeenCalledWith('/owner-portal/login')
  })
})
