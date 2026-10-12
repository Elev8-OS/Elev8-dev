<script setup lang="ts">
import type { UpsellOrder } from '@/components/upsells/data/upsell-orders'
import { useUpsellOrders } from '@/composables/useUpsellOrders'

const route = useRoute()
const { orders, totalRevenue, statusCounts } = useUpsellOrders()
const orderDrawerOpen = ref(false)
const selectedOrder = ref<UpsellOrder | null>(null)

function openOrderDrawer(order: UpsellOrder) {
  selectedOrder.value = order
  orderDrawerOpen.value = true
}

// `?order=<id>` (inbox offer card, notifications) opens that order's drawer. On mount,
// not during SSR: an open Sheet rendered on the server is lost on hydration.
function openFromQuery() {
  const id = route.query.order
  const order = typeof id === 'string' ? orders.value.find(o => o.id === id) : undefined
  if (order)
    openOrderDrawer(order)
}
onMounted(openFromQuery)
watch(() => route.query.order, openFromQuery)
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Upsell Orders
      </h2>
      <p class="text-muted-foreground">
        Track and fulfil the upsells guests ordered.
      </p>
    </div>

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

    <UpsellsUpsellOrderDrawer
      :order="selectedOrder"
      :open="orderDrawerOpen"
      @update:open="orderDrawerOpen = $event"
    />
  </div>
</template>
