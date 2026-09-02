<script setup lang="ts">
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail } from '@/components/ui/sidebar'

const { currentOwner } = useOwnerPortal()
const { approvalsForOwner } = useTaskOwnerApproval()

/**
 * Repairs waiting on this owner's decision. Same source as the Maintenance
 * page's "Awaiting you" tile, so the badge and the page can never disagree.
 */
const awaitingApproval = computed(() =>
  currentOwner.value ? approvalsForOwner(currentOwner.value.id).length : 0)

const links = computed(() => [
  { label: 'Overview', to: '/owner-portal', icon: 'lucide:layout-dashboard', badge: 0 },
  { label: 'Statements', to: '/owner-portal/statements', icon: 'lucide:file-text', badge: 0 },
  { label: 'My Stays', to: '/owner-portal/stays', icon: 'lucide:calendar-days', badge: 0 },
  { label: 'Documents', to: '/owner-portal/documents', icon: 'lucide:folder-open', badge: 0 },
  { label: 'Maintenance', to: '/owner-portal/maintenance', icon: 'lucide:wrench', badge: awaitingApproval.value },
])

const route = useRoute()

function isActive(to: string) {
  return to === '/owner-portal'
    ? route.path === to
    : route.path.startsWith(to)
}
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader class="border-b">
      <div class="flex items-center gap-2 px-2 py-2">
        <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Icon name="lucide:building-2" class="size-4" aria-hidden="true" />
        </div>
        <div class="grid flex-1 text-left text-sm leading-tight">
          <span class="truncate font-semibold">Owner Portal</span>
          <span class="truncate text-xs text-muted-foreground">Elev8</span>
        </div>
      </div>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Menu</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="link in links" :key="link.to">
              <SidebarMenuButton
                as-child
                :is-active="isActive(link.to)"
                :tooltip="link.label"
              >
                <NuxtLink
                  :to="link.to"
                  :aria-label="link.badge ? `${link.label}, ${link.badge} waiting for your approval` : undefined"
                >
                  <Icon :name="link.icon" class="size-4" aria-hidden="true" />
                  <span>{{ link.label }}</span>
                </NuxtLink>
              </SidebarMenuButton>
              <SidebarMenuBadge v-if="link.badge" class="bg-primary text-primary-foreground">
                {{ link.badge }}
              </SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>
</template>
