import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import PortalSidebar from '~/components/owner-portal/PortalSidebar.vue'
import { mockTasks } from '~/components/tasks/data/tasks-mock'
import { useTaskOwnerApproval } from '~/composables/useTaskOwnerApproval'
import { useTaskStore } from '~/composables/useTaskStore'

// The component reaches these through Nuxt auto-imports, so they have to be
// globals rather than mocked modules. Only the signed-in owner is faked: the
// count comes from the real `useTaskOwnerApproval` reading the real task seed,
// so this test fails if either the seed or the filter changes.
const currentOwner = ref<{ id: string } | null>(null)
vi.stubGlobal('useOwnerPortal', () => ({ currentOwner }))
vi.stubGlobal('useTaskOwnerApproval', useTaskOwnerApproval)
vi.stubGlobal('useTaskStore', useTaskStore)
vi.stubGlobal('useRoute', () => ({ path: '/owner-portal' }))

const globalOptions = {
  stubs: {
    Icon: { props: ['name'], template: '<i />' },
    NuxtLink: { props: ['to', 'ariaLabel'], template: '<a :href="to" :aria-label="ariaLabel"><slot /></a>' },
    Sidebar: { template: '<aside><slot /></aside>' },
    SidebarContent: { template: '<div><slot /></div>' },
    SidebarGroup: { template: '<div><slot /></div>' },
    SidebarGroupContent: { template: '<div><slot /></div>' },
    SidebarGroupLabel: { template: '<div><slot /></div>' },
    SidebarHeader: { template: '<header><slot /></header>' },
    SidebarMenu: { template: '<ul><slot /></ul>' },
    SidebarMenuItem: { template: '<li><slot /></li>' },
    SidebarMenuButton: { props: ['isActive', 'tooltip', 'asChild'], template: '<div><slot /></div>' },
    SidebarMenuBadge: { template: '<span data-testid="sidebar-badge"><slot /></span>' },
    SidebarRail: { template: '<div />' },
  },
}

function badges() {
  return Array.from(document.body.querySelectorAll('[data-testid="sidebar-badge"]'))
}

describe('portalSidebar maintenance badge', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    useTaskStore().tasks.value = mockTasks.map(t => ({ ...t }))
  })

  it('counts repairs awaiting the signed-in owner', () => {
    // own-2 holds the one seeded task with ownerApprovalStatus 'pending'.
    currentOwner.value = { id: 'own-2' }
    mount(PortalSidebar, { global: globalOptions, attachTo: document.body })

    expect(badges().map(b => b.textContent?.trim())).toEqual(['1'])
  })

  it('renders no badge for an owner with nothing pending', () => {
    // own-1's approval task is already decided, so there is nothing to show.
    currentOwner.value = { id: 'own-1' }
    mount(PortalSidebar, { global: globalOptions, attachTo: document.body })

    expect(badges()).toHaveLength(0)
  })

  it('renders no badge before a session exists', () => {
    currentOwner.value = null
    mount(PortalSidebar, { global: globalOptions, attachTo: document.body })

    expect(badges()).toHaveLength(0)
  })

  it('labels the link with the count so it is not a bare number', () => {
    currentOwner.value = { id: 'own-2' }
    mount(PortalSidebar, { global: globalOptions, attachTo: document.body })

    const link = document.body.querySelector('a[href="/owner-portal/maintenance"]')
    expect(link?.getAttribute('aria-label')).toBe('Maintenance, 1 waiting for your approval')
  })
})
