<script setup lang="ts">
import { buildGuestGuideCssVariables } from '~/lib/branding-colors'

const route = useRoute()
const { branding, faviconHref } = useTenantBranding()
const isLogin = computed(() => route.path === '/owner-portal/login')

const portalBrandStyle = computed(() => Object.fromEntries(
  Object.entries(buildGuestGuideCssVariables(branding.value.guestGuideColors))
    .map(([key, value]) => [key, `hsl(${value})`]),
))

useHead(() => ({
  link: [{ rel: 'icon', href: faviconHref.value }],
}))
</script>

<template>
  <div class="min-h-screen bg-background text-foreground" :style="portalBrandStyle">
    <template v-if="isLogin">
      <main class="flex min-h-screen flex-col items-center justify-center gap-8 p-4 sm:p-6">
        <div class="flex min-h-12 items-center justify-center">
          <img
            v-if="branding.primaryLogo"
            :src="branding.primaryLogo.dataUrl"
            :alt="branding.primaryLogo.name"
            class="max-h-12 max-w-56 object-contain"
            data-testid="owner-portal-logo"
          >
          <div v-else class="text-center">
            <p class="text-xl font-semibold tracking-tight">
              Elev8
            </p>
            <p class="text-xs uppercase tracking-widest text-muted-foreground">
              Owner Portal
            </p>
          </div>
        </div>
        <slot />
      </main>
    </template>

    <template v-else>
      <div class="flex min-h-screen">
        <aside class="hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col">
          <div class="flex h-20 items-center border-b px-6">
            <img
              v-if="branding.primaryLogo"
              :src="branding.primaryLogo.dataUrl"
              :alt="branding.primaryLogo.name"
              class="max-h-10 max-w-44 object-contain"
              data-testid="owner-portal-logo"
            >
            <div v-else>
              <p class="text-lg font-semibold tracking-tight">
                Elev8
              </p>
              <p class="text-xs uppercase tracking-widest text-muted-foreground">
                Owner Portal
              </p>
            </div>
          </div>
          <div class="flex-1 p-4">
            <OwnerPortalSidebar />
          </div>
        </aside>

        <div class="flex min-w-0 flex-1 flex-col">
          <OwnerPortalHeader />
          <main class="flex-1 p-4 sm:p-6 lg:p-8">
            <div class="mx-auto w-full max-w-7xl">
              <slot />
            </div>
          </main>
        </div>
      </div>
    </template>
  </div>
</template>
