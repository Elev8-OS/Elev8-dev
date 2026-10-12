<script setup lang="ts">
import type { SidebarMenuButtonVariants } from '~/components/ui/sidebar'
import type { NavGroup } from '~/types/nav'
import { useSidebar } from '~/components/ui/sidebar'

const props = withDefaults(defineProps<{
  item: NavGroup
  size?: SidebarMenuButtonVariants['size']
}>(), {
  size: 'default',
})

const { setOpenMobile } = useSidebar()

const route = useRoute()
const hasActiveChild = computed(() => props.item.children.some(child => child.link === route.path))

// A group opens itself when it holds the current page, so the active link is never hidden.
const openCollapsible = ref(hasActiveChild.value)
watch(hasActiveChild, (active) => {
  if (active)
    openCollapsible.value = true
})

// Upsell orders waiting for staff approval.
const { statusCounts: upsellOrderCounts } = useUpsellOrders()
function childCount(link: string): number {
  return link === '/upsell-orders' ? upsellOrderCounts.value.requested : 0
}
const groupCount = computed(() => props.item.children.reduce((sum, child) => sum + childCount(child.link), 0))
</script>

<template>
  <SidebarMenu>
    <Collapsible
      :key="item.title"
      v-model:open="openCollapsible"
      as-child
      class="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger as-child>
          <SidebarMenuButton :tooltip="item.title" :size="size" :data-active="hasActiveChild && !openCollapsible">
            <Icon :name="item.icon || ''" mode="svg" />
            <span class="truncate">{{ item.title }}</span>
            <span v-if="item.new" class="rounded-md bg-[#adfa1d] px-1.5 py-0.5 text-xs text-black leading-none no-underline group-hover:no-underline">
              New
            </span>
            <Badge
              v-if="groupCount > 0 && !openCollapsible"
              class="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs"
              variant="default"
            >
              {{ groupCount }}
            </Badge>
            <Icon name="i-lucide-chevron-right" class="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" :class="groupCount > 0 && !openCollapsible ? '' : 'ml-auto'" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <SidebarMenuSubItem
              v-for="subItem in item.children"
              :key="subItem.title"
            >
              <SidebarMenuSubButton as-child :data-active="subItem.link === $route.path">
                <NuxtLink :to="subItem.link" @click="setOpenMobile(false)">
                  <span class="truncate">{{ subItem.title }}</span>
                  <span v-if="subItem.new" class="rounded-md bg-[#adfa1d] px-1.5 py-0.5 text-xs text-black leading-none no-underline group-hover:no-underline">
                    New
                  </span>
                  <Badge
                    v-if="childCount(subItem.link) > 0"
                    class="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs"
                    variant="default"
                  >
                    {{ childCount(subItem.link) }}
                  </Badge>
                </NuxtLink>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  </SidebarMenu>
</template>

<style scoped>

</style>
