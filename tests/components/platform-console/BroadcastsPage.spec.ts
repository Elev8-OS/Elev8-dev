import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import BannerCard from '~/components/platform-console/BannerCard.vue'
import RoleGate from '~/components/platform-console/RoleGate.vue'
import BroadcastsPage from '~/pages/platform-console/broadcasts/index.vue'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Tabs } from '~/components/ui/tabs'
import { usePlatformBanners } from '~/composables/usePlatformBanners'
import { useStaffAuth } from '~/composables/useStaffAuth'

;(globalThis as any).useStaffAuth = useStaffAuth
;(globalThis as any).definePageMeta = () => {}
;(globalThis as any).useRouter = () => ({ push: () => {} })

const passthrough = { template: '<div><slot /></div>' }
const SearchStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input class="search" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">',
}

let wrapper: ReturnType<typeof mountPage> | null = null

function mountPage() {
  return mount(BroadcastsPage, {
    attachTo: document.body,
    global: {
      components: {
        Badge,
        Button,
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        Input,
        Label,
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle,
        BaseSearchInput: SearchStub,
        PlatformConsoleRoleGate: RoleGate,
        PlatformConsoleBannerCard: BannerCard,
        PlatformConsoleBannerUpdateDialog: { template: '<div />' },
      },
      stubs: {
        Icon: true,
        DropdownMenu: passthrough,
        DropdownMenuTrigger: passthrough,
        DropdownMenuContent: passthrough,
        DropdownMenuItem: { emits: ['click'], template: '<button class="menu-item" @click="$emit(\'click\')"><slot /></button>' },
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

const rows = () => wrapper!.findAll('[data-testid="broadcast-row"]')
const rowTitles = () => rows().map(r => r.find('span.truncate').text())

async function setTab(value: string) {
  wrapper!.findComponent(Tabs).vm.$emit('update:modelValue', value)
  await flushPromises()
}

describe('broadcasts page', () => {
  beforeEach(() => {
    useStaffAuth().setRole('admin')
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('summarises the seeded data in the stats row', () => {
    wrapper = mountPage()
    const text = wrapper.get('[data-testid="broadcast-stats"]').text()
    expect(text).toContain('Live now')
    expect(text).toMatch(/Live now\s*2/)
    expect(text).toMatch(/Scheduled\s*1/)
    expect(text).toMatch(/Maintenance planned\s*1/)
    expect(text).toMatch(/Tenants reached\s*9 of 9/)
  })

  it('lists live first, then scheduled, then ended', () => {
    wrapper = mountPage()
    const titles = rowTitles()
    expect(titles).toHaveLength(4)
    expect(titles[0]).toMatch(/Planned maintenance|Growth ceiling/)
    expect(titles[2]).toBe('New: Guest Guide templates')
    expect(titles[3]).toBe('Resolved: Stripe webhook latency')
  })

  it('filters by tab', async () => {
    wrapper = mountPage()
    await setTab('ended')
    expect(rowTitles()).toEqual(['Resolved: Stripe webhook latency'])
    await setTab('scheduled')
    expect(rowTitles()).toEqual(['New: Guest Guide templates'])
    await setTab('live')
    expect(rows()).toHaveLength(2)
  })

  it('shows an empty state when nothing matches the search', async () => {
    wrapper = mountPage()
    await wrapper.get('input.search').setValue('zzzz')
    expect(rows()).toHaveLength(0)
    expect(wrapper.get('[data-testid="broadcast-empty"]').text()).toContain('Nothing matches')
  })

  it('shows the planned maintenance window with its affected areas', () => {
    wrapper = mountPage()
    const panel = wrapper.get('[data-testid="maintenance-queue"]').text()
    expect(panel).toContain('Planned maintenance: Inbox and Reviews')
    expect(panel).toContain('Inbox')
    expect(panel).toContain('Reviews')
  })

  it('lists recent broadcast activity from the audit log', () => {
    wrapper = mountPage()
    const { createBanner } = usePlatformBanners()
    createBanner({
      title: 'Fresh notice', body: 'Body', severity: 'info', targetScope: 'all', targetFilter: { scope: 'all' },
      visibleRoles: ['Admin'], dismissible: true, dismissalScope: 'account',
      startAt: new Date().toISOString(), createdByStaffId: 'staff-1',
    })
    return flushPromises().then(() => {
      const text = wrapper!.get('[data-testid="recent-activity"]').text()
      expect(text).toContain('Went live')
      expect(text).toContain('Fresh notice')
    })
  })

  it('offers an inline Resolve only once a maintenance window has started', async () => {
    wrapper = mountPage()
    const queued = rows().find(r => r.text().includes('Planned maintenance'))!
    expect(queued.findAll('button').some(b => b.text() === 'Resolve')).toBe(false)

    const { createBanner } = usePlatformBanners()
    createBanner({
      title: 'Underway now', body: 'Body', severity: 'warning', targetScope: 'all', targetFilter: { scope: 'all' },
      visibleRoles: ['Admin'], dismissible: true, dismissalScope: 'account',
      kind: 'maintenance',
      maintenance: {
        startAt: new Date(Date.now() + 60_000).toISOString(), endAt: new Date(Date.now() + 3_600_000).toISOString(),
        timezone: 'UTC', impact: 'offline', affected: ['Inbox'],
      },
      startAt: new Date().toISOString(), createdByStaffId: 'staff-1',
    })
    await flushPromises()
    // Window starts a minute from now: still upcoming, so still no Resolve.
    expect(rows().find(r => r.text().includes('Underway now'))!.findAll('button').some(b => b.text() === 'Resolve')).toBe(false)

    const { banners } = usePlatformBanners()
    banners.value = banners.value.map(b => b.title === 'Underway now'
      ? { ...b, maintenance: { ...b.maintenance!, startAt: new Date(Date.now() - 60_000).toISOString() } }
      : b)
    await flushPromises()
    expect(rows().find(r => r.text().includes('Underway now'))!.findAll('button').some(b => b.text() === 'Resolve')).toBe(true)
  })

  it('hides Resolve and Post update from a role that cannot compose', () => {
    useStaffAuth().setRole('viewer')
    wrapper = mountPage()
    expect(wrapper.text()).not.toContain('New broadcast')
    expect(wrapper.findAll('.menu-item').some(b => b.text().includes('Post update'))).toBe(false)
  })
})
