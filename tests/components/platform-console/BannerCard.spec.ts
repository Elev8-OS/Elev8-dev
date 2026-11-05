import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BannerCard from '~/components/platform-console/BannerCard.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import type { PlatformBanner } from '~/components/platform-console/data/banners'

const IconStub = { props: ['name'], template: '<i :data-icon="name" />' }

function banner(over: Partial<PlatformBanner> = {}): PlatformBanner {
  return {
    id: 'b', title: 'Title', body: 'Body text', severity: 'info',
    targetScope: 'all', targetFilter: { scope: 'all' }, visibleRoles: ['Admin'],
    dismissible: true, dismissalScope: 'user',
    startAt: new Date(Date.now() - 60_000).toISOString(), status: 'live',
    createdByStaffId: 'staff-1', createdAt: new Date().toISOString(),
    ...over,
  }
}

function mountCard(b: PlatformBanner, props: Record<string, unknown> = {}) {
  return mount(BannerCard, {
    props: { banner: b, ...props },
    global: { components: { Icon: IconStub, Badge, Button }, stubs: { Icon: IconStub } },
  })
}

describe('BannerCard', () => {
  it('renders a plain announcement without a window or phase', () => {
    const w = mountCard(banner())
    expect(w.text()).toContain('Title')
    expect(w.find('[data-testid="banner-window"]').exists()).toBe(false)
    expect(w.find('[data-testid="banner-phase"]').exists()).toBe(false)
  })

  it('shows the window, affected areas and an Upcoming phase for maintenance', () => {
    const start = new Date(Date.now() + 2 * 3_600_000)
    const w = mountCard(banner({
      kind: 'maintenance',
      maintenance: {
        startAt: start.toISOString(), endAt: new Date(start.getTime() + 1_800_000).toISOString(),
        timezone: 'UTC', impact: 'offline', affected: ['Inbox', 'Reviews'],
      },
    }))
    expect(w.get('[data-testid="banner-phase"]').text()).toBe('Upcoming')
    const win = w.get('[data-testid="banner-window"]').text()
    expect(win).toContain('Inbox')
    expect(win).toContain('Reviews')
    expect(win).toContain('Offline during the window')
    expect(win).toContain('UTC')
  })

  it('marks a resolved banner and lists the newest update first, capped by maxUpdates', () => {
    const t = Date.now()
    const w = mountCard(banner({
      resolvedAt: new Date(t).toISOString(),
      updates: [
        { id: 'u1', kind: 'update', message: 'First note', createdAt: new Date(t - 3000).toISOString(), createdByStaffId: 's' },
        { id: 'u2', kind: 'update', message: 'Second note', createdAt: new Date(t - 2000).toISOString(), createdByStaffId: 's' },
        { id: 'u3', kind: 'resolved', message: 'All clear', createdAt: new Date(t - 1000).toISOString(), createdByStaffId: 's' },
      ],
    }), { maxUpdates: 2 })
    expect(w.get('[data-testid="banner-phase"]').text()).toBe('Resolved')
    const items = w.findAll('[data-testid="banner-updates"] li')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('All clear')
    expect(items[1]!.text()).toContain('Second note')
  })

  it('only shows the dismiss button when dismissible and a handler is given', async () => {
    expect(mountCard(banner()).find('button[aria-label="Dismiss banner"]').exists()).toBe(false)
    let dismissed = 0
    const w = mountCard(banner(), { onDismiss: () => { dismissed++ } })
    await w.get('button[aria-label="Dismiss banner"]').trigger('click')
    expect(dismissed).toBe(1)
    expect(mountCard(banner({ dismissible: false }), { onDismiss: () => {} }).find('button[aria-label="Dismiss banner"]').exists()).toBe(false)
  })
})
