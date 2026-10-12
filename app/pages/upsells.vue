<script setup lang="ts">
import type { UpsellCategory, UpsellService } from '@/components/upsells/data/upsell-services'
import { CATALOG_CATEGORIES } from '@/components/upsells/data/upsell-services'

// Orders moved to their own page; old `?tab=orders` links still land there.
const route = useRoute()
if (route.query.tab === 'orders')
  await navigateTo({ path: '/upsell-orders', query: route.query.order ? { order: route.query.order } : {} }, { replace: true })

// Catalog state
const drawerOpen = ref(false)
const selectedService = ref<UpsellService | null>(null)
const createCategory = ref<UpsellCategory | null>(null)

function openDrawer(service: UpsellService | null) {
  selectedService.value = service
  createCategory.value = null
  drawerOpen.value = true
}

function openCreateDrawer(category: UpsellCategory) {
  selectedService.value = null
  createCategory.value = category
  drawerOpen.value = true
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Upsells
        </h2>
        <p class="text-muted-foreground">
          Manage the upsell services guests can order.
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button size="sm">
            <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
            Add Service
            <Icon name="lucide:chevron-down" class="ml-2 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-52">
          <DropdownMenuItem
            v-for="cat in CATALOG_CATEGORIES"
            :key="cat"
            @click="openCreateDrawer(cat)"
          >
            {{ cat }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <UpsellsUpsellFilterBar />
    <UpsellsUpsellTable @open-drawer="openDrawer" />

    <UpsellsUpsellDrawer
      :service="selectedService"
      :initial-category="createCategory"
      :open="drawerOpen"
      @update:open="drawerOpen = $event"
    />
  </div>
</template>
