<script setup lang="ts">
import type { UpsellOrder } from '~/components/upsells/data/upsell-orders'
import { useUpsellOrders } from '@/composables/useUpsellOrders'
import { getOrderStatusMeta } from '~/components/upsells/data/upsell-orders'

const props = withDefaults(defineProps<{ orderIds?: string[] }>(), {
  orderIds: () => [],
})

const { orders } = useUpsellOrders()

const linkedOrders = computed(() => {
  if (props.orderIds.length === 0)
    return []
  return orders.value.filter(o => props.orderIds.includes(o.id))
})

function fmtCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
}

function orderStatusLabel(order: UpsellOrder): string {
  return getOrderStatusMeta(order).label
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        Upsells
      </CardTitle>
    </CardHeader>
    <CardContent class="p-0">
      <div v-if="linkedOrders.length === 0" class="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
        <Icon name="lucide:tag" class="size-8 opacity-50" />
        No upsells.
      </div>
      <div v-else class="divide-y">
        <div
          v-for="order in linkedOrders"
          :key="order.id"
          class="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">
              {{ order.serviceName }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ new Date(order.orderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }} · {{ order.guestName }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="outline" class="rounded-full" :class="[getOrderStatusMeta(order).color]">
              {{ orderStatusLabel(order) }}
            </Badge>
            <span class="text-sm font-semibold tabular-nums">
              {{ fmtCurrency(order.grandTotal, order.currency) }}
            </span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
