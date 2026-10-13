import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SidebarNavHeader from '~/components/layout/SidebarNavHeader.vue'
import { useTenantBranding } from '~/composables/useTenantBranding'

vi.mock('~/components/ui/sidebar', () => ({
  useSidebar: () => ({ isMobile: false }),
}))

const stubs = {
  SidebarMenu: { template: '<div><slot /></div>' },
  SidebarMenuItem: { template: '<div><slot /></div>' },
  SidebarMenuButton: { template: '<button><slot /></button>' },
  Popover: { template: '<div><slot /></div>' },
  PopoverTrigger: { template: '<div><slot /></div>' },
  PopoverContent: { template: '<div><slot /></div>' },
  Separator: true,
  Input: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">' },
  Badge: { template: '<span><slot /></span>' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  Icon: { props: ['name'], template: '<span :data-name="name" />' },
}

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() })
  vi.stubGlobal('useRuntimeConfig', () => ({ app: { baseURL: '/dashboard/' } }))
  vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))
})

// eslint-disable-next-line test/prefer-lowercase-title
describe('SidebarNavHeader branding', () => {
  it('shows the active tenant initials without a primary logo', () => {
    const wrapper = mount(SidebarNavHeader, { global: { stubs } })
    expect(wrapper.find('[data-testid="sidebar-brand-logo"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="sidebar-tenant-initials"]').text()).toBe('BV')
  })

  it('renders the saved primary logo in the workspace avatar', () => {
    const { branding } = useTenantBranding()
    branding.value = {
      ...branding.value,
      primaryLogo: { name: 'logo.png', type: 'image/png', size: 1, dataUrl: 'data:image/png;base64,AA==' },
    }
    const wrapper = mount(SidebarNavHeader, { global: { stubs } })
    expect(wrapper.get('[data-testid="sidebar-brand-logo"]').attributes('src')).toBe(branding.value.primaryLogo!.dataUrl)
  })
})

// eslint-disable-next-line test/prefer-lowercase-title
describe('SidebarNavHeader tenant switcher', () => {
  it('lists tenants with their subscription and filters by search', async () => {
    const wrapper = mount(SidebarNavHeader, { global: { stubs } })
    expect(wrapper.findAll('[data-testid="tenant-option"]')).toHaveLength(10)
    expect(wrapper.text()).toContain('Pro · Per Property · 32 units')

    await wrapper.get('[data-testid="tenant-search"]').setValue('swiss')
    const options = wrapper.findAll('[data-testid="tenant-option"]')
    expect(options).toHaveLength(1)
    expect(options[0]!.text()).toContain('Swiss Alpine Retreats')
  })

  it('switches the active tenant on select and links to all tenants', async () => {
    const wrapper = mount(SidebarNavHeader, { global: { stubs } })
    const swiss = wrapper.findAll('[data-testid="tenant-option"]').find(o => o.text().includes('Swiss Alpine'))!
    await swiss.trigger('click')
    expect(wrapper.get('[data-testid="sidebar-tenant-initials"]').text()).toBe('SA')
    expect(wrapper.text()).toContain('Enterprise · Per Property')
    expect(wrapper.get('a[href="/platform-console/tenants"]').text()).toContain('All tenants')
  })
})
