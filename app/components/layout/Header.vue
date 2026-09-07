<script setup lang="ts">
const route = useRoute()
const { isGro } = useGroScope()

const showGroBar = computed(() => isGro.value && route.path === '/inbox')
</script>

<template>
  <header class="sticky top-0 md:peer-data-[variant=inset]:top-2 z-10 h-(--header-height) flex items-center gap-4 border-b bg-background px-4 md:px-6 md:rounded-tl-xl md:rounded-tr-xl">
    <SidebarTrigger />
    <GroHeaderBar v-if="showGroBar" />
    <div class="ml-auto flex items-center gap-3">
      <LayoutLanguageSelector />
      <NotificationsNotificationCenter />
      <ElevAIButton class="ml-1" />
      <LayoutHeaderUserMenu />
    </div>
  </header>
</template>
