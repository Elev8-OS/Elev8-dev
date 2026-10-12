<script setup lang="ts">
import type { SidebarMenuButtonVariants } from '~/components/ui/sidebar'
import type { NavLink } from '~/types/nav'
import { useSidebar } from '~/components/ui/sidebar'

withDefaults(defineProps<{
  item: NavLink
  size?: SidebarMenuButtonVariants['size']
}>(), {
  size: 'default',
})

const { setOpenMobile } = useSidebar()

const { conversations } = useInbox()

const unreadConversations = computed(() => conversations.value.filter(c => c.unreadCount > 0).length)
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton as-child :tooltip="item.title" :size="size" :data-active="item.link === $route.path">
        <NuxtLink :to="item.link" @click="setOpenMobile(false)">
          <Icon :name="item.icon || ''" />
          <span class="truncate">{{ item.title }}</span>
          <span v-if="item.new" class="rounded-md bg-[#adfa1d] px-1.5 py-0.5 text-xs text-black leading-none no-underline group-hover:no-underline">
            New
          </span>
          <Badge
            v-if="item.link === '/inbox' && unreadConversations > 0"
            class="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs"
            variant="default"
          >
            {{ unreadConversations }}
          </Badge>
        </NuxtLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>

<style scoped>

</style>
