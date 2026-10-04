<script setup lang="ts">
import type { UpsellOffer } from '~/components/inbox/data/conversations'
import { toast } from 'vue-sonner'
import { useUpsellOrders } from '@/composables/useUpsellOrders'

interface UpsellOfferCardProps {
  offer: UpsellOffer
  conversationId: string
}

const props = defineProps<UpsellOfferCardProps>()

const { cancelOrder } = useUpsellOrders()

const isWithdrawing = ref(false)

function handleWithdraw() {
  isWithdrawing.value = true
  cancelOrder(props.offer.orderId, 'Withdrawn by staff', 'staff')
  props.offer.status = 'withdrawn'
  toast.info('Upsell offer withdrawn')
  isWithdrawing.value = false
}

function handleViewOrder() {
  window.location.href = `/upsells?tab=orders&order=${props.offer.orderId}`
}

const statusConfig = {
  pending: { label: 'Pending', class: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'lucide:clock' },
  accepted: { label: 'Accepted', class: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'lucide:check-circle' },
  declined: { label: 'Declined', class: 'bg-red-50 text-red-700 border-red-200', icon: 'lucide:x-circle' },
  withdrawn: { label: 'Withdrawn', class: 'bg-muted text-muted-foreground border-border', icon: 'lucide:undo-2' },
}

const sb = computed(() => statusConfig[props.offer.status] ?? statusConfig.pending)
</script>

<template>
  <div class="rounded-xl border bg-card overflow-hidden">
    <div class="px-3 py-2.5 border-b bg-muted/30">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex size-7 items-center justify-center rounded-md bg-primary/10">
            <Icon name="lucide:shopping-bag" class="size-3.5 text-foreground" />
          </div>
          <div>
            <p class="text-xs font-semibold">
              {{ offer.serviceName }}
            </p>
            <p class="text-[10px] text-muted-foreground">
              {{ offer.serviceCategory }} · {{ offer.serviceDate }}
            </p>
          </div>
        </div>
        <Badge variant="outline" class="text-[10px] font-medium gap-1" :class="[sb.class]">
          <Icon :name="sb.icon" class="size-3" />
          {{ sb.label }}
        </Badge>
      </div>
    </div>

    <div class="px-3 py-2 space-y-1.5">
      <div v-for="item in offer.items" :key="item.id" class="flex items-center justify-between text-xs">
        <span class="text-muted-foreground">{{ item.name }}</span>
        <span class="font-medium">{{ item.price.toLocaleString() }} {{ offer.currency }}</span>
      </div>

      <Separator class="my-1.5" />

      <div class="flex items-center justify-between text-xs">
        <span class="text-muted-foreground">Subtotal</span>
        <span>{{ offer.subtotal.toLocaleString() }} {{ offer.currency }}</span>
      </div>
      <div v-if="offer.taxAmount > 0" class="flex items-center justify-between text-xs">
        <span class="text-muted-foreground">Tax</span>
        <span>{{ offer.taxAmount.toLocaleString() }} {{ offer.currency }}</span>
      </div>
      <div v-if="offer.serviceAmount > 0" class="flex items-center justify-between text-xs">
        <span class="text-muted-foreground">Service</span>
        <span>{{ offer.serviceAmount.toLocaleString() }} {{ offer.currency }}</span>
      </div>

      <div class="flex items-center justify-between text-sm font-semibold pt-1">
        <span>Total</span>
        <span>{{ offer.grandTotal.toLocaleString() }} {{ offer.currency }}</span>
      </div>
    </div>

    <div class="px-3 py-2 border-t bg-muted/20 flex items-center gap-2">
      <template v-if="offer.status === 'pending'">
        <Button
          variant="outline"
          size="sm"
          class="h-7 text-xs gap-1 flex-1"
          :disabled="isWithdrawing"
          @click="handleWithdraw"
        >
          <Icon name="lucide:undo-2" class="size-3" />
          {{ isWithdrawing ? 'Withdrawing...' : 'Withdraw' }}
        </Button>
      </template>
      <template v-else-if="offer.status === 'accepted'">
        <Button
          variant="default"
          size="sm"
          class="h-7 text-xs gap-1 flex-1"
          @click="handleViewOrder"
        >
          <Icon name="lucide:external-link" class="size-3" />
          View Order
        </Button>
      </template>
      <template v-else-if="offer.status === 'declined'">
        <span class="text-xs text-muted-foreground italic">Guest declined this offer</span>
      </template>
      <template v-else-if="offer.status === 'withdrawn'">
        <span class="text-xs text-muted-foreground italic">Offer withdrawn</span>
      </template>
    </div>
  </div>
</template>
