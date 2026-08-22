<script setup lang="ts">
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useOwnerAuth } from '~/composables/useOwnerAuth'
import { useOwnerPortal } from '~/composables/useOwnerPortal'

const { logout } = useOwnerAuth()
const { currentOwner } = useOwnerPortal()

async function handleSignOut() {
  logout()
  await navigateTo('/owner-portal/login')
}
</script>

<template>
  <header class="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4 md:px-6">
    <div class="flex items-center gap-3">
      <SidebarTrigger class="md:hidden" />
      <div>
        <p class="text-xs text-muted-foreground">
          Welcome back
        </p>
        <p class="text-sm font-medium">
          {{ currentOwner?.name ?? 'Owner' }}
        </p>
      </div>
    </div>

    <Button
      variant="ghost"
      size="sm"
      data-testid="owner-sign-out"
      @click="handleSignOut"
    >
      <Icon name="lucide:log-out" class="size-4" aria-hidden="true" />
      <span class="hidden sm:inline">Sign out</span>
    </Button>
  </header>
</template>
