import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import TenantBillingTab from '~/components/platform-console/TenantBillingTab.vue'
import { deriveTenantBilling } from '~/components/platform-console/data/tenant-billing'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Progress } from '~/components/ui/progress'
import { Switch } from '~/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table'
import { Textarea } from '~/components/ui/textarea'
import { useStaffAuth } from '~/composables/useStaffAuth'
import { useTenantBilling } from '~/composables/useTenantBilling'
import { useTenants } from '~/composables/useTenants'

;(globalThis as any).useStaffAuth = useStaffAuth

let wrapper: ReturnType<typeof mountTab> | null = null

function mountTab(id: string) {
  return mount(TenantBillingTab, {
    props: { tenant: useTenants().byId(id)! },
    attachTo: document.body,
    global: {
      components: {
        Badge, Button, Card, CardContent, Input, Progress, Switch, Textarea,
        Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
        BaseDatePicker: { props: ['modelValue'], template: '<span data-test="date">{{ modelValue }}</span>' },
      },
      stubs: { Icon: true },
    },
  })
}

describe('TenantBillingTab', () => {
  beforeEach(() => {
    useStaffAuth().setRole('admin')
    const now = new Date()
    useTenantBilling().records.value = Object.fromEntries(useTenants().tenants.value.map(t => [t.id, deriveTenantBilling(t, now)]))
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('shows the plan, health, next charge and invoices of a paid property tenant', () => {
    wrapper = mountTab('t-1')
    const text = wrapper.text()
    expect(text).toContain('Pro · Per Property')
    expect(text).toContain('USD 899.00/mo')
    expect(text).toContain('Paid')
    expect(text).toContain('Invoice history')
    expect(text).toContain('USD 899.00')
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('shows the retry ladder for a property tenant in dunning', () => {
    wrapper = mountTab('t-6')
    expect(wrapper.text()).toContain('Payment failing, attempt 2 / 3')
    expect(wrapper.text()).toContain('Suspend account')
  })

  it('shows strikes for a booking tenant and hides Adjust', () => {
    wrapper = mountTab('t-3')
    expect(wrapper.text()).toContain('Auto top-up failing, 3 / 7 strikes')
    expect(wrapper.text()).toContain('Booking quota remaining')
    expect(wrapper.text()).not.toContain('Adjust next charge')
  })

  it('shows the override banner and reverts it', async () => {
    wrapper = mountTab('t-10')
    expect(wrapper.text()).toContain('Next charge adjusted')
    await wrapper.findAll('button').find(b => b.text() === 'Revert to default')!.trigger('click')
    await flushPromises()
    expect(useTenantBilling().records.value['t-10']!.override).toBeNull()
    expect(wrapper.text()).not.toContain('Next charge adjusted')
  })

  it('needs a reason before saving an adjustment, then saves it', async () => {
    wrapper = mountTab('t-1')
    await wrapper.findAll('button').find(b => b.text().includes('Adjust next charge'))!.trigger('click')
    await flushPromises()
    const dialog = () => document.body.querySelector('[role="dialog"]') as HTMLElement
    const save = () => Array.from(dialog().querySelectorAll('button')).find(b => b.textContent?.trim() === 'Save adjustment') as HTMLButtonElement
    expect(dialog()).toBeTruthy()
    expect(save().disabled).toBe(true)

    const note = dialog().querySelector('textarea') as HTMLTextAreaElement
    note.value = 'Agreed with the account manager'
    note.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(save().disabled).toBe(false)

    // Custom amount, one-time.
    const custom = Array.from(dialog().querySelectorAll('div')).find(d => d.textContent?.startsWith('Custom amount, next charge only') && d.className.includes('cursor-pointer')) as HTMLElement
    custom.click()
    await flushPromises()
    const amount = dialog().querySelector('input[aria-label="Custom amount"]') as HTMLInputElement
    amount.value = '700'
    amount.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(dialog().textContent).toContain('USD 199.00 less than default (discount)')

    save().click()
    await flushPromises()
    expect(useTenantBilling().records.value['t-1']!.override).toMatchObject({ amount: 700, recurring: false })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('hides Adjust from roles without the permission', () => {
    useStaffAuth().setRole('finance')
    wrapper = mountTab('t-1')
    expect(wrapper.text()).not.toContain('Adjust next charge')
  })
})
