<script lang="ts" setup>
import type { UpsellOrder } from '~/components/upsells/data/upsell-orders'
import { getOrderStatusMeta } from '~/components/upsells/data/upsell-orders'
import { useUpsellOrders } from '@/composables/useUpsellOrders'

interface ReservationUpsellsProps {
  linkedOrderIds?: string[]
}

const props = withDefaults(defineProps<ReservationUpsellsProps>(), {
  linkedOrderIds: () => [],
})

const { orders } = useUpsellOrders()

const linkedOrders = computed(() => {
  if (!props.linkedOrderIds || props.linkedOrderIds.length === 0)
    return []
  return orders.value.filter(o => props.linkedOrderIds.includes(o.id))
})

function getStatus(order: UpsellOrder) {
  return getOrderStatusMeta(order)
}

function formatPrice(price: number, currency: string): string {
  if (currency === 'IDR') {
    return `IDR ${price.toLocaleString()}`
  }
  return `${currency} ${price}`
}
</script>

<template>
  <div v-if="linkedOrders.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
    <Icon name="lucide:shopping-bag" class="size-8 text-muted-foreground mb-2" />
    <p class="text-sm text-muted-foreground">
      No upsells purchased
    </p>
  </div>

  <div v-else class="space-y-3">
    <div
      v-for="order in linkedOrders"
      :key="order.id"
      class="rounded-lg border p-3 space-y-1.5"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="font-medium text-sm">
            {{ order.serviceName }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ order.guestName }}
          </div>
        </div>
        <span :class="['inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0', getStatus(order).color]">
          {{ getStatus(order).label }}
        </span>
      </div>
      <div class="flex items-center justify-between text-xs">
        <span class="text-muted-foreground">{{ new Date(order.serviceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}</span>
        <span class="font-semibold">{{ formatPrice(order.grandTotal, order.currency) }}</span>
      </div>
    </div>
  </div>
</template>
