import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import RoleGate from '~/components/platform-console/RoleGate.vue'
import TenantPricingTab from '~/components/platform-console/TenantPricingTab.vue'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { usePricingOverrides } from '~/composables/usePricingOverrides'
import { useStaffAuth } from '~/composables/useStaffAuth'
import { useTenants } from '~/composables/useTenants'

;(globalThis as any).useStaffAuth = useStaffAuth
;(globalThis as any).usePlatformAudit = undefined

const passthrough = { template: '<div><slot /></div>' }

let wrapper: ReturnType<typeof mountTab> | null = null

function mountTab() {
  const tenant = useTenants().byId('t-1')!
  return mount(TenantPricingTab, {
    props: { tenant },
    attachTo: document.body,
    global: {
      components: {
        Badge,
        Button,
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle,
        PlatformConsoleRoleGate: RoleGate,
        PlatformConsoleApplyOverrideDialog: { template: '<div />' },
      },
      stubs: { Icon: true, Sheet: passthrough, SheetContent: passthrough, SheetHeader: passthrough, SheetTitle: passthrough },
    },
  })
}

describe('tenant pricing revoke', () => {
  beforeEach(() => {
    useStaffAuth().setRole('admin')
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('revokes the active override after confirming in the dialog', async () => {
    wrapper = mountTab()
    const { overrides } = usePricingOverrides()
    const active = overrides.value.find(o => o.tenantId === 't-1' && o.status === 'active')!

    await wrapper.findAll('button').find(b => b.text().includes('Revoke'))!.trigger('click')
    await flushPromises()
    const confirm = Array.from(document.body.querySelectorAll('[role="alertdialog"] button')).find(b => b.textContent?.trim() === 'Revoke') as HTMLElement
    expect(confirm).toBeTruthy()
    confirm.click()
    await flushPromises()

    expect(overrides.value.find(o => o.id === active.id)!.status).toBe('revoked')
  })
})
