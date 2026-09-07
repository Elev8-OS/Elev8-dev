<script setup lang="ts">
import type { NavGroup, NavLink, NavMenu, NavMenuItems, NavSectionTitle } from '~/types/nav'
import { navMenu as defaultNavMenu, navMenuBottom as defaultNavMenuBottom } from '~/constants/menus'

const props = withDefaults(defineProps<{
  menu?: NavMenu[]
  menuBottom?: NavMenuItems
  showSearch?: boolean
  showTeams?: boolean
}>(), {
  menu: () => defaultNavMenu,
  menuBottom: () => defaultNavMenuBottom,
  showSearch: true,
  showTeams: true,
})

function resolveNavItemComponent(item: NavLink | NavGroup | NavSectionTitle): any {
  if ('children' in item)
    return resolveComponent('LayoutSidebarNavGroup')

  return resolveComponent('LayoutSidebarNavLink')
}

const teams: {
  name: string
  logo: string
  plan: string
}[] = props.showTeams
  ? [
      {
        name: 'Acme Inc',
        logo: 'i-lucide-gallery-vertical-end',
        plan: 'Enterprise',
      },
      {
        name: 'Acme Corp.',
        logo: 'i-lucide-audio-waveform',
        plan: 'Startup',
      },
      {
        name: 'Evil Corp.',
        logo: 'i-lucide-command',
        plan: 'Free',
      },
    ]
  : []

const { sidebar } = useAppSettings()
</script>

<template>
  <!--
    `h-full` replaces the ui component's `h-svh` on the fixed inner container (twMerge picks the
    later class). The sidebar then fills its containing block rather than the whole viewport,
    which matters when the billing alert occupies the top of the layout: `h-svh` would push the
    sidebar past the bottom and add a page scrollbar. With no alert the two are equivalent.
  -->
  <Sidebar :collapsible="sidebar?.collapsible" :side="sidebar?.side" :variant="sidebar?.variant" class="h-full">
    <SidebarHeader>
      <LayoutSidebarNavHeader v-if="showTeams" :teams="teams" />
      <Search v-if="showSearch" />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup v-for="(nav, indexGroup) in menu" :key="indexGroup">
        <SidebarGroupLabel v-if="nav.heading">
          {{ nav.heading }}
        </SidebarGroupLabel>
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in nav.items" :key="index" :item="item" />
      </SidebarGroup>
      <SidebarGroup class="mt-auto">
        <component :is="resolveNavItemComponent(item)" v-for="(item, index) in menuBottom" :key="index" :item="item" size="sm" />
      </SidebarGroup>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>
</template>

<style scoped>

</style>
