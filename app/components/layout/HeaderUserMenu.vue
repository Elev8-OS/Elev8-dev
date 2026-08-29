<script setup lang="ts">
const { currentUser } = useCurrentDashboardUser()
const { getRole } = useRoles()

const user = computed(() => {
  const u = currentUser.value
  return {
    name: u?.name ?? 'User',
    role: getRole(u?.roleId ?? '')?.name ?? 'Staff',
    avatar: u?.avatarUrl ?? '/avatars/avatartion.png',
    initials: u?.initials ?? '?',
  }
})

function handleLogout() {
  navigateTo('/login')
}

const showModalTheme = ref(false)
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" class="h-auto p-1.5 gap-2">
        <Avatar class="h-8 w-8 rounded-lg">
          <AvatarImage :src="user.avatar" :alt="user.name" />
          <AvatarFallback class="rounded-lg">
            {{ user.name.split(' ').map((n) => n[0]).join('') }}
          </AvatarFallback>
        </Avatar>
        <div class="grid flex-1 text-left text-sm leading-tight">
          <span class="truncate font-semibold">{{ user.name }}</span>
          <span class="truncate text-xs text-muted-foreground">{{ user.role }}</span>
        </div>
        <Icon name="i-lucide-chevrons-up-down" class="ml-auto size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56" align="end" :side-offset="8">
      <DropdownMenuLabel class="p-0 font-normal">
        <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
          <Avatar class="h-8 w-8 rounded-lg">
            <AvatarImage :src="user.avatar" :alt="user.name" />
            <AvatarFallback class="rounded-lg">
              {{ user.name.split(' ').map((n) => n[0]).join('') }}
            </AvatarFallback>
          </Avatar>
          <div class="grid flex-1 text-left text-sm leading-tight">
            <span class="truncate font-semibold">{{ user.name }}</span>
            <span class="truncate text-xs text-muted-foreground">{{ user.role }}</span>
          </div>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem>
          <Icon name="i-lucide-sparkles" />
          Upgrade to Pro
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem>
          <Icon name="i-lucide-badge-check" />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem as-child>
          <NuxtLink to="/settings">
            <Icon name="i-lucide-settings" />
            Settings
          </NuxtLink>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Icon name="i-lucide-bell" />
          Notifications
        </DropdownMenuItem>
        <DropdownMenuItem as-child>
          <NuxtLink to="/changelog">
            <Icon name="i-lucide-history" />
            Changelog
          </NuxtLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem as-child>
          <NuxtLink to="" external target="_blank">
            <Icon name="i-lucide-github" />
            Github Repository
          </NuxtLink>
        </DropdownMenuItem>
        <DropdownMenuItem @click="showModalTheme = true">
          <Icon name="i-lucide-paintbrush" />
          Theme
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem @click="handleLogout">
        <Icon name="i-lucide-log-out" />
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <Dialog v-model:open="showModalTheme">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Customize</DialogTitle>
        <DialogDescription class="text-xs text-muted-foreground">
          Customize & Preview in Real Time
        </DialogDescription>
      </DialogHeader>
      <ThemeCustomize />
    </DialogContent>
  </Dialog>
</template>
