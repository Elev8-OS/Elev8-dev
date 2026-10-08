<script setup lang="ts">
import type { UpsellOrder } from '@/components/upsells/data/upsell-orders'
import type { UpsellCategory, UpsellService } from '@/components/upsells/data/upsell-services'
import { CATALOG_CATEGORIES } from '@/components/upsells/data/upsell-services'
import { useUpsellOrders } from '@/composables/useUpsellOrders'

const activeView = ref<'catalog' | 'orders'>('catalog')

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

// Orders state
const { totalRevenue, statusCounts } = useUpsellOrders()
const orderDrawerOpen = ref(false)
const selectedOrder = ref<UpsellOrder | null>(null)

function openOrderDrawer(order: UpsellOrder) {
  selectedOrder.value = order
  orderDrawerOpen.value = true
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <!-- Header with Tabs -->
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 class="text-2xl font-bold tracking-tight">
            Upsells
          </h2>
          <p class="text-muted-foreground">
            Manage upsell services and track guest orders.
          </p>
        </div>
        <DropdownMenu v-if="activeView === 'catalog'">
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

      <!-- View Tabs -->
      <div class="flex items-center gap-1 rounded-lg border bg-muted p-1 w-fit">
        <button
          class="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all"
          :class="activeView === 'catalog' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          @click="activeView = 'catalog'"
        >
          <Icon name="lucide:package" class="h-4 w-4" />
          Catalog
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all"
          :class="activeView === 'orders' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          @click="activeView = 'orders'"
        >
          <Icon name="lucide:shopping-cart" class="h-4 w-4" />
          Orders
          <Badge v-if="statusCounts.requested > 0" variant="default" class="h-5 min-w-[1.25rem] px-1 text-[10px]">
            {{ statusCounts.requested }}
          </Badge>
        </button>
      </div>
    </div>

    <!-- Catalog View -->
    <template v-if="activeView === 'catalog'">
      <UpsellsUpsellFilterBar />
      <UpsellsUpsellTable @open-drawer="openDrawer" />
    </template>

    <!-- Orders View -->
    <template v-if="activeView === 'orders'">
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-lg border p-4">
          <p class="text-sm text-muted-foreground">
            Total Revenue
          </p>
          <p class="text-2xl font-bold">
            IDR {{ totalRevenue.toLocaleString('id-ID') }}
          </p>
        </div>
        <div class="rounded-lg border p-4">
          <p class="text-sm text-muted-foreground">
            Requested
          </p>
          <p class="text-2xl font-bold">
            {{ statusCounts.requested }}
          </p>
        </div>
        <div class="rounded-lg border p-4">
          <p class="text-sm text-muted-foreground">
            Awaiting Payment
          </p>
          <p class="text-2xl font-bold">
            {{ statusCounts.awaiting_payment }}
          </p>
        </div>
        <div class="rounded-lg border p-4">
          <p class="text-sm text-muted-foreground">
            Paid - In Progress
          </p>
          <p class="text-2xl font-bold">
            {{ statusCounts.paid_in_progress }}
          </p>
        </div>
      </div>
      <UpsellsUpsellOrderTable @open-drawer="openOrderDrawer" />
    </template>

    <!-- Drawers -->
    <UpsellsUpsellDrawer
      :service="selectedService"
      :initial-category="createCategory"
      :open="drawerOpen"
      @update:open="drawerOpen = $event"
    />
    <UpsellsUpsellOrderDrawer
      :order="selectedOrder"
      :open="orderDrawerOpen"
      @update:open="orderDrawerOpen = $event"
    />
  </div>
</template>
