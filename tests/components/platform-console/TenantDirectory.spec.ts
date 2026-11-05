import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import TenantDirectory from '~/components/platform-console/TenantDirectory.vue'
import { deriveTenantBilling } from '~/components/platform-console/data/tenant-billing'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { useStaffAuth } from '~/composables/useStaffAuth'
import { useTenantBilling } from '~/composables/useTenantBilling'
import { useTenants } from '~/composables/useTenants'

;(globalThis as any).useStaffAuth = useStaffAuth

let wrapper: ReturnType<typeof mountDirectory> | null = null

function mountDirectory() {
  return mount(TenantDirectory, {
    props: { tenants: useTenants().tenants.value },
    attachTo: document.body,
    global: {
      components: {
        Badge, Button, Card, CardContent,
        BaseSearchInput: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input data-test="search" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
        PlatformConsoleTenantStatusBadge: { props: ['status'], template: '<span>{{ status }}</span>' },
        PlatformConsoleTenantPlanBadge: { template: '<span />' },
        PlatformConsoleTenantBillingTab: { props: ['tenant'], template: '<div data-test="billing">billing of {{ tenant.id }}</div>' },
      },
      stubs: { Icon: true, NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }, Popover: true, Select: true, SelectTrigger: true, SelectValue: true, SelectContent: true, SelectItem: true },
    },
  })
}

describe('TenantDirectory', () => {
  beforeEach(() => {
    useStaffAuth().setRole('admin')
    useTenantBilling().records.value = Object.fromEntries(useTenants().tenants.value.map(t => [t.id, deriveTenantBilling(t)]))
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
  })

  it('selects the top tenant by MRR and shows its billing', () => {
    wrapper = mountDirectory()
    expect(wrapper.find('[data-testid="tenant-row-t-2"]').attributes('aria-current')).toBe('true')
    expect(wrapper.find('[data-test="billing"]').text()).toBe('billing of t-2')
    expect(wrapper.find('a[href="/platform-console/tenants/t-2"]').exists()).toBe(true)
  })

  it('switches the detail when another row is clicked', async () => {
    wrapper = mountDirectory()
    await wrapper.find('[data-testid="tenant-row-t-6"]').trigger('click')
    expect(wrapper.find('[data-test="billing"]').text()).toBe('billing of t-6')
  })

  it('hides internal tenants and leaves them out of the rollups', async () => {
    wrapper = mountDirectory()
    expect(wrapper.find('[data-testid="tenant-row-t-9"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('1 internal tenant hidden from rollups')
    const stats = wrapper.find('[data-testid="tenant-stats"]').text()
    // 7 active-status tenants minus the internal one (t-9) = 6; t-4 is switching, t-5 suspended, t-8 churned.
    expect(stats).toContain('Active tenants')
    expect(stats).toMatch(/Active tenants\s*6/)
    expect(stats).toMatch(/In dunning\s*2/)
  })

  it('filters by search and moves the selection to the first match', async () => {
    wrapper = mountDirectory()
    await wrapper.find('[data-test="search"]').setValue('lisbon')
    await flushPromises()
    expect(wrapper.findAll('[data-testid^="tenant-row-"]').map(r => r.attributes('data-testid'))).toEqual(['tenant-row-t-4'])
    expect(wrapper.find('[data-test="billing"]').text()).toBe('billing of t-4')
    await wrapper.find('[data-test="search"]').setValue('zzz')
    await flushPromises()
    expect(wrapper.find('[data-testid="tenant-empty"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Select a tenant')
  })

  it('does not show billing to a viewer', () => {
    useStaffAuth().setRole('viewer')
    wrapper = mountDirectory()
    expect(wrapper.find('[data-test="billing"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-billing-hidden"]').exists()).toBe(true)
  })
})
