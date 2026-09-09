<script setup lang="ts">
import type { UpsellOrder } from '@/components/upsells/data/upsell-orders'
import { toast } from 'vue-sonner'
import {
  getOrderStatusMeta,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
} from '@/components/upsells/data/upsell-orders'
import { useUpsellOrders } from '@/composables/useUpsellOrders'

const props = defineProps<{
  order: UpsellOrder | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const showCancelModal = ref(false)

const { orders, approveOrder, markPaid, startFulfillment, completeFulfillment, reopenDeclinedOrder } = useUpsellOrders()

const order = computed(() => {
  if (!props.order)
    return null
  return orders.value.find(o => o.id === props.order!.id) ?? null
})

const orderStatusMeta = computed(() => order.value ? getOrderStatusMeta(order.value) : null)

function onOpenChange(value: boolean) {
  emit('update:open', value)
}

function handleApprove() {
  if (!order.value)
    return
  approveOrder(order.value.id)
  toast.success('Order approved and payment link sent.')
}

function handlePaid() {
  if (!order.value)
    return
  markPaid(order.value.id, 'manual')
  toast.success('Order marked as paid.')
}

function handleStart() {
  if (!order.value)
    return
  startFulfillment(order.value.id)
  toast.success('Fulfillment started.')
}

function handleComplete() {
  if (!order.value)
    return
  completeFulfillment(order.value.id)
  toast.success('Order marked as completed.')
}

function handleReopen() {
  if (!order.value)
    return
  reopenDeclinedOrder(order.value.id)
  toast.success('Order reopened.')
}

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('id-ID')}`
}
</script>

<template>
  <Sheet :open="open" @update:open="onOpenChange">
    <SheetContent class="flex w-full flex-col gap-0 overflow-hidden sm:max-w-md">
      <SheetHeader class="shrink-0 border-b px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <SheetTitle>{{ order?.id ?? 'Order' }}</SheetTitle>
            <SheetDescription v-if="order">
              {{ order.serviceName }}
            </SheetDescription>
          </div>
          <Badge v-if="orderStatusMeta" variant="secondary" class="gap-1" :class="ORDER_STATUS_COLORS[orderStatusMeta.status]">
            {{ ORDER_STATUS_LABELS[orderStatusMeta.status] }}
          </Badge>
        </div>
      </SheetHeader>

      <ScrollArea class="min-h-0 flex-1 overflow-y-auto">
        <div v-if="order" class="flex flex-col gap-5 p-6">
          <div class="flex flex-col gap-2">
            <Label class="text-xs text-muted-foreground">Guest</Label>
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {{ order.guestName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() }}
              </div>
              <div>
                <p class="text-sm font-medium">
                  {{ order.guestName }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ order.guestEmail }}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div class="flex flex-col gap-2">
            <Label class="text-xs text-muted-foreground">Fulfillment</Label>
            <div class="rounded-md border p-3 text-sm">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <Icon
                    :name="order.fulfillmentStatus === 'completed' ? 'lucide:badge-check' : order.fulfillmentStatus === 'in_progress' ? 'lucide:loader-2' : 'lucide:package-check'"
                    class="h-3.5 w-3.5"
                    :class="order.fulfillmentStatus === 'completed' ? 'text-emerald-500' : order.fulfillmentStatus === 'in_progress' ? 'text-cyan-500' : 'text-muted-foreground'"
                  />
                  <span class="font-medium">{{ order.fulfillmentStatus === 'in_progress' ? 'Paid - In Progress' : order.fulfillmentStatus === 'not_started' ? 'Waiting' : 'Completed' }}</span>
                </div>
                <Badge variant="secondary" class="h-5 px-1.5 text-[10px]">
                  {{ order.fulfillmentStatus === 'not_started' ? 'Waiting' : order.fulfillmentStatus === 'in_progress' ? 'Paid - In Progress' : 'Done' }}
                </Badge>
              </div>
              <p class="mt-2 text-xs text-muted-foreground">
                {{ order.serviceEndDate ? `${order.serviceDate} – ${order.serviceEndDate}` : order.serviceDate }}
              </p>
            </div>
          </div>

          <Separator />

          <UpsellsUpsellOrderLockAccess :order="order" />

          <div class="flex flex-col gap-2">
            <Label class="text-xs text-muted-foreground">Stay</Label>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span class="text-muted-foreground">Reservation</span>
                <p class="font-medium">
                  {{ order.reservationId }}
                </p>
              </div>
              <div>
                <span class="text-muted-foreground">Channel</span>
                <p class="font-medium">
                  {{ order.channel }}
                </p>
              </div>
              <div>
                <span class="text-muted-foreground">Check-in</span>
                <p class="font-medium">
                  {{ order.checkInDate }}
                </p>
              </div>
              <div>
                <span class="text-muted-foreground">Check-out</span>
                <p class="font-medium">
                  {{ order.checkOutDate }}
                </p>
              </div>
              <div class="col-span-2">
                <span class="text-muted-foreground">Listing</span>
                <p class="font-medium">
                  {{ order.listing }}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div v-if="order.invoice" class="flex flex-col gap-2">
            <Label class="text-xs text-muted-foreground">Invoice</Label>
            <div class="flex items-center justify-between rounded-md border p-3">
              <div class="flex items-center gap-2">
                <Icon name="lucide:file-text" class="h-4 w-4 text-muted-foreground" />
                <span class="text-sm font-medium">{{ order.invoice }}</span>
              </div>
              <Button variant="ghost" size="sm" class="h-7 gap-1 text-xs">
                <Icon name="lucide:download" class="h-3.5 w-3.5" />
                Download
              </Button>
            </div>
          </div>

          <Separator v-if="order.invoice" />

          <div class="flex flex-col gap-2">
            <Label class="text-xs text-muted-foreground">Items</Label>
            <div class="flex flex-col gap-2">
              <div
                v-for="item in order.items"
                :key="item.id"
                class="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p class="text-sm font-medium">
                    {{ item.name }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ formatCurrency(item.price, order.currency) }} × {{ item.quantity }}
                  </p>
                </div>
                <span class="text-sm font-semibold">
                  {{ formatCurrency(item.price * item.quantity, order.currency) }}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          <div class="flex flex-col gap-2">
            <Label class="text-xs text-muted-foreground">Pricing</Label>
            <div class="flex flex-col gap-1 text-sm">
              <div class="flex justify-between">
                <span class="text-muted-foreground">Subtotal</span>
                <span>{{ formatCurrency(order.subtotal, order.currency) }}</span>
              </div>
              <div v-if="order.taxAmount > 0" class="flex justify-between">
                <span class="text-muted-foreground">Tax</span>
                <span>{{ formatCurrency(order.taxAmount, order.currency) }}</span>
              </div>
              <div v-if="order.serviceAmount > 0" class="flex justify-between">
                <span class="text-muted-foreground">Service</span>
                <span>{{ formatCurrency(order.serviceAmount, order.currency) }}</span>
              </div>
              <Separator class="my-1" />
              <div class="flex justify-between text-base font-semibold">
                <span>Grand Total</span>
                <span>{{ formatCurrency(order.grandTotal, order.currency) }}</span>
              </div>
            </div>
          </div>

          <div v-if="order.notes" class="flex flex-col gap-2">
            <Label class="text-xs text-muted-foreground">Notes</Label>
            <p class="text-sm">
              {{ order.notes }}
            </p>
          </div>

          <div v-if="order.staffAssigned" class="flex flex-col gap-2">
            <Label class="text-xs text-muted-foreground">Assigned To</Label>
            <p class="text-sm">
              {{ order.staffAssigned }}
            </p>
          </div>
        </div>
      </ScrollArea>

      <div v-if="order" class="shrink-0 border-t px-6 py-4">
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <Button v-if="order.approvalStatus === 'requested'" class="flex-1" @click="handleApprove">
              <Icon name="lucide:check-circle" class="mr-2 h-4 w-4" />
              Send Payment Link
            </Button>
            <Button v-if="order.approvalStatus === 'requested'" variant="outline" class="flex-1" @click="showCancelModal = true">
              <Icon name="lucide:x-circle" class="mr-2 h-4 w-4" />
              Decline
            </Button>
            <Button v-if="order.paymentStatus === 'awaiting_payment'" class="flex-1" @click="handlePaid">
              <Icon name="lucide:wallet" class="mr-2 h-4 w-4" />
              Record Payment
            </Button>
            <Button v-if="order.paymentStatus === 'paid' && order.fulfillmentStatus === 'not_started'" class="flex-1" @click="handleStart">
              <Icon name="lucide:loader-2" class="mr-2 h-4 w-4" />
              Start Fulfillment
            </Button>
            <Button v-if="order.fulfillmentStatus === 'in_progress'" class="flex-1" @click="handleComplete">
              <Icon name="lucide:check-check" class="mr-2 h-4 w-4" />
              Complete
            </Button>
            <Button v-if="order.approvalStatus === 'declined'" class="w-full" @click="handleReopen">
              <Icon name="lucide:rotate-ccw" class="mr-2 h-4 w-4" />
              Reopen Request
            </Button>
          </div>
        </div>
      </div>
    </SheetContent>

    <UpsellsUpsellCancelModal
      :order="order"
      :open="showCancelModal"
      @update:open="showCancelModal = $event"
    />
  </Sheet>
</template>
