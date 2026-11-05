import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import BroadcastsPage from '~/pages/platform-console/broadcasts/index.vue'
import BannerCard from '~/components/platform-console/BannerCard.vue'
import RoleGate from '~/components/platform-console/RoleGate.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '~/components/ui/alert-dialog'
import { useStaffAuth } from '~/composables/useStaffAuth'
import { usePlatformBanners } from '~/composables/usePlatformBanners'

;(globalThis as any).useStaffAuth = useStaffAuth
;(globalThis as any).definePageMeta = () => {}
;(globalThis as any).useRouter = () => ({ push: () => {} })

const passthrough = { template: '<div><slot /></div>' }
const MenuItem = { emits: ['click'], template: '<button class="menu-item" @click="$emit(\'click\')"><slot /></button>' }

let wrapper: ReturnType<typeof mountPage> | null = null

function mountPage() {
  return mount(BroadcastsPage, {
    attachTo: document.body,
    global: {
      components: {
        Badge, Button, Card, CardContent, Input, Label,
        AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
        BaseSearchInput: { template: '<input />' },
        PlatformConsoleRoleGate: RoleGate,
        PlatformConsoleBannerCard: BannerCard,
        PlatformConsoleBannerUpdateDialog: { template: '<div />' },
      },
      stubs: {
        Icon: true,
        DropdownMenu: passthrough,
        DropdownMenuTrigger: passthrough,
        DropdownMenuContent: passthrough,
        DropdownMenuItem: MenuItem,
        Select: passthrough,
        SelectTrigger: passthrough,
        SelectValue: passthrough,
        SelectContent: passthrough,
        SelectItem: passthrough,
        Sheet: passthrough,
        SheetContent: passthrough,
        SheetHeader: passthrough,
        SheetTitle: passthrough,
      },
    },
  })
}

describe('broadcasts retract', () => {
  beforeEach(() => {
    useStaffAuth().setRole('admin')
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('retracts a live banner after confirming in the dialog', async () => {
    wrapper = mountPage()
    const { banners } = usePlatformBanners()
    const target = banners.value.find(b => b.status === 'live')!

    const retractItems = wrapper.findAll('.menu-item').filter(b => b.text().includes('Retract'))
    expect(retractItems.length).toBeGreaterThan(0)
    // Rows are sorted newest first; open the dialog for the banner we want by title.
    const row = wrapper.findAll('[data-testid="broadcast-row"]').find(r => r.text().includes(target.title))!
    await row.findAll('.menu-item').find(b => b.text().includes('Retract'))!.trigger('click')
    await flushPromises()

    const confirm = Array.from(document.body.querySelectorAll('[role="alertdialog"] button')).find(b => b.textContent?.trim() === 'Retract')!
    expect(confirm).toBeTruthy()
    confirm.click()
    await flushPromises()

    expect(banners.value.find(b => b.id === target.id)!.status).toBe('retracted')
  })

  it('records the reason and writes an audit entry', async () => {
    wrapper = mountPage()
    const { banners } = usePlatformBanners()
    const target = banners.value.find(b => b.status === 'live')!
    const row = wrapper.findAll('[data-testid="broadcast-row"]').find(r => r.text().includes(target.title))!
    await row.findAll('.menu-item').find(b => b.text().includes('Retract'))!.trigger('click')
    await flushPromises()

    const input = document.body.querySelector('[role="alertdialog"] input') as HTMLInputElement
    input.value = 'Wrong date'
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    ;(Array.from(document.body.querySelectorAll('[role="alertdialog"] button')).find(b => b.textContent?.trim() === 'Retract') as HTMLElement).click()
    await flushPromises()

    const after = banners.value.find(b => b.id === target.id)!
    expect(after.status).toBe('retracted')
    expect(after.retractionReason).toBe('Wrong date')
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('leaves the banner live when the dialog is cancelled', async () => {
    wrapper = mountPage()
    const { banners } = usePlatformBanners()
    const target = banners.value.find(b => b.status === 'live')!
    const row = wrapper.findAll('[data-testid="broadcast-row"]').find(r => r.text().includes(target.title))!
    await row.findAll('.menu-item').find(b => b.text().includes('Retract'))!.trigger('click')
    await flushPromises()
    ;(Array.from(document.body.querySelectorAll('[role="alertdialog"] button')).find(b => b.textContent?.trim() === 'Cancel') as HTMLElement).click()
    await flushPromises()
    expect(banners.value.find(b => b.id === target.id)!.status).toBe('live')
  })

  it('offers no Retract to a role without the permission', async () => {
    useStaffAuth().setRole('viewer')
    wrapper = mountPage()
    expect(wrapper.findAll('.menu-item').some(b => b.text().includes('Retract'))).toBe(false)
    expect(wrapper.findAll('.menu-item').some(b => b.text().includes('Post update'))).toBe(false)
  })
})
