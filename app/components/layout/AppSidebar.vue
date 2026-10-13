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

const { sidebar } = useAppSettings()

// A PMS_ONLY tenant does not get every module. Those entries are removed from
// navigation rather than shown disabled (PRD 7.4). Every other model keeps the
// menu it was given, so this is a no-op for them.
const { moduleAvailable } = useOnboarding()
const visibleMenu = computed<NavMenu[]>(() =>
  props.menu
    // A NavSectionTitle carries no `title`, so it is never gated. Group children are
    // gated by their own title, and a group left with none is dropped.
    .map(group => ({
      ...group,
      items: group.items
        .map(item => 'children' in item
          ? { ...item, children: item.children.filter(child => moduleAvailable(child.title)) }
          : item)
        .filter(item => !('title' in item) || moduleAvailable(item.title))
        .filter(item => !('children' in item) || item.children.length > 0),
    }))
    .filter(group => group.items.length > 0))
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
      <LayoutSidebarNavHeader v-if="showTeams" />
      <Search v-if="showSearch" />
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup v-for="(nav, indexGroup) in visibleMenu" :key="indexGroup">
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
