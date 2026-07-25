<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useOwnerAuth } from '~/composables/useOwnerAuth'
import { useOwnerPortal } from '~/composables/useOwnerPortal'
import PortalSidebar from './PortalSidebar.vue'

const mobileMenuOpen = ref(false)
const { logout } = useOwnerAuth()
const { currentOwner } = useOwnerPortal()

async function handleSignOut() {
  logout()
  mobileMenuOpen.value = false
  await navigateTo('/owner-portal/login')
}
</script>

<template>
  <header class="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4 md:px-6">
    <div class="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        class="md:hidden"
        aria-label="Open owner portal navigation"
        @click="mobileMenuOpen = true"
      >
        <Icon name="lucide:menu" class="size-5" aria-hidden="true" />
      </Button>
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

    <Sheet :open="mobileMenuOpen" @update:open="mobileMenuOpen = $event">
      <SheetContent side="left" class="w-72 p-0">
        <SheetHeader class="border-b p-5 text-left">
          <SheetTitle>Owner Portal</SheetTitle>
          <SheetDescription>View your properties and statements.</SheetDescription>
        </SheetHeader>
        <div class="p-4" @click="mobileMenuOpen = false">
          <PortalSidebar />
        </div>
      </SheetContent>
    </Sheet>
  </header>
</template>
