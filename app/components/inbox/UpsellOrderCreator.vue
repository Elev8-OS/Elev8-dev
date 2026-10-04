<script setup lang="ts">
import type { Conversation } from '@/components/inbox/data/conversations'
import type { UpsellOrder } from '@/components/upsells/data/upsell-orders'
import type { UpsellService } from '@/components/upsells/data/upsell-services'
import { toast } from 'vue-sonner'
import { useInbox } from '@/composables/useInbox'
import { useUpsellNotifications } from '@/composables/useUpsellNotifications'
import { useUpsellOrders } from '@/composables/useUpsellOrders'
import { useUpsellServices } from '@/composables/useUpsellServices'

const props = defineProps<{
  conversation: Conversation | null
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { linkOrderToConversation, sendMessage } = useInbox()
const { addOrder, orders } = useUpsellOrders()
const { services } = useUpsellServices()
const { createNotification } = useUpsellNotifications()

const selectedService = ref<UpsellService | null>(null)
const selectedItems = ref<string[]>([])
const serviceDate = ref('')
const notes = ref('')

const filteredServices = computed(() =>
  services.value.filter(s => s.status === 'active'),
)

const selectedServiceId = computed({
  get: () => selectedService.value?.id ?? '',
  set: (id: string) => {
    selectedService.value = filteredServices.value.find(s => s.id === id) ?? null
    selectedItems.value = []
  },
})

function onOpenChange(value: boolean) {
  emit('update:open', value)
  if (!value)
    resetForm()
}

function resetForm() {
  selectedService.value = null
  selectedItems.value = []
  serviceDate.value = ''
  notes.value = ''
}

const isCreateDisabled = computed(() =>
  !selectedService.value || selectedItems.value.length === 0 || !serviceDate.value,
)

function toggleItem(itemId: string, checked: boolean | 'indeterminate') {
  if (checked === true) {
    selectedItems.value = [...selectedItems.value, itemId]
  }
  else {
    selectedItems.value = selectedItems.value.filter(id => id !== itemId)
  }
}

function handleCreate() {
  if (!props.conversation || !selectedService.value || selectedItems.value.length === 0 || !serviceDate.value) {
    toast.error('Please fill in all required fields.')
    return
  }

  const items = selectedService.value.items
    .filter(i => selectedItems.value.includes(i.id))
    .map(i => ({ id: i.id, name: i.name, price: i.price, quantity: 1 }))

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const taxAmount = selectedService.value.pricingEnabled ? Math.round(subtotal * (selectedService.value.taxPercent / 100)) : 0
  const serviceAmount = selectedService.value.pricingEnabled ? Math.round(subtotal * (selectedService.value.servicePercent / 100)) : 0
  const grandTotal = subtotal + taxAmount + serviceAmount

  const isAlways = selectedService.value.availability === 'always'

  const orderData: Omit<UpsellOrder, 'id' | 'createdAt' | 'updatedAt'> = {
    reservationId: props.conversation.reservationId,
    guestName: props.conversation.guestName,
    serviceId: selectedService.value.id,
    serviceName: selectedService.value.name,
    serviceCategory: selectedService.value.category,
    items,
    subtotal,
    taxAmount,
    serviceAmount,
    grandTotal,
    currency: selectedService.value.currency,
    approvalStatus: isAlways ? 'approved' : 'requested',
    paymentStatus: isAlways ? 'awaiting_payment' : 'unpaid',
    fulfillmentStatus: 'not_started',
    orderDate: new Date().toISOString().split('T')[0] as string,
    serviceDate: serviceDate.value,
    checkInDate: props.conversation.checkIn,
    checkOutDate: props.conversation.checkOut,
    listing: props.conversation.listingName,
    channel: props.conversation.otaSource,
    notes: notes.value,
    source: 'inbox',
    conversationId: props.conversation.id,
    createdByStaffId: 'staff-2',
    approvalRequestedAt: isAlways ? new Date().toISOString() : new Date().toISOString(),
    approvedAt: isAlways ? new Date().toISOString() : undefined,
    paymentLinkSentAt: isAlways ? new Date().toISOString() : undefined,
  }

  addOrder(orderData)

  const newOrder = orders.value[orders.value.length - 1]
  if (!newOrder) {
    toast.error('Failed to create order.')
    return
  }

  linkOrderToConversation(props.conversation.id, newOrder.id)

  if (!isAlways) {
    createNotification(newOrder, 'UPSELL_ORDER_REQUESTED')
  }
  else {
    createNotification(newOrder, 'UPSELL_ORDER_APPROVED')
  }

  const upsellOffer = {
    orderId: newOrder.id,
    serviceName: selectedService.value.name,
    serviceCategory: selectedService.value.category,
    items: items.map(i => ({ id: i.id, name: i.name, price: i.price })),
    serviceDate: serviceDate.value,
    subtotal,
    taxAmount,
    serviceAmount,
    grandTotal,
    currency: selectedService.value.currency,
    status: 'pending' as const,
  }

  const upsellMessage = `Hi ${props.conversation.guestName}! We'd like to offer you the following:`

  sendMessage(props.conversation.id, upsellMessage, 'ota', upsellOffer)

  toast.success(`Upsell offer sent to ${props.conversation.guestName}!`)
  onOpenChange(false)
}
</script>

<template>
  <Sheet :open="open" @update:open="onOpenChange">
    <SheetContent side="right" class="flex w-full flex-col gap-0 sm:max-w-md overflow-hidden">
      <SheetHeader class="shrink-0 border-b px-6 py-4">
        <SheetTitle>Create Upsell Order</SheetTitle>
        <SheetDescription v-if="conversation">
          For {{ conversation.guestName }} — {{ conversation.listingName }}
        </SheetDescription>
      </SheetHeader>

      <ScrollArea class="min-h-0 flex-1 overflow-y-auto">
        <div v-if="conversation" class="flex flex-col gap-5 p-6">
          <div class="rounded-md border p-3">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-foreground">
                {{ conversation.guestInitials }}
              </div>
              <div>
                <p class="text-sm font-medium">
                  {{ conversation.guestName }}
                </p>
                <p class="text-xs text-muted-foreground">
                  Res: {{ conversation.reservationId }}
                </p>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <Label>Service <span class="text-destructive">*</span></Label>
            <Select v-model="selectedServiceId">
              <SelectTrigger>
                <SelectValue placeholder="Select a service..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="svc in filteredServices"
                  :key="svc.id"
                  :value="svc.id"
                >
                  <div class="flex items-center gap-2">
                    <span>{{ svc.name }}</span>
                    <Badge v-if="svc.availability === 'by_request'" variant="outline" class="text-xs">
                      By Request
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="selectedService" class="flex flex-col gap-2">
            <Label>Items <span class="text-destructive">*</span></Label>
            <div class="flex flex-col gap-2">
              <label
                v-for="item in selectedService.items"
                :key="item.id"
                class="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                :class="selectedItems.includes(item.id) ? 'border-primary bg-primary/5' : 'border-border'"
              >
                <Checkbox
                  :checked="selectedItems.includes(item.id)"
                  @update:model-value="(checked: boolean | 'indeterminate') => toggleItem(item.id, checked)"
                />
                <div class="flex-1">
                  <p class="text-sm font-medium">{{ item.name }}</p>
                  <p v-if="item.description" class="text-xs text-muted-foreground">{{ item.description }}</p>
                </div>
                <span class="text-sm font-medium">
                  {{ item.price.toLocaleString() }} {{ selectedService.currency }}
                </span>
              </label>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <Label>Service Date <span class="text-destructive">*</span></Label>
            <Input
              v-model="serviceDate"
              type="date"
              :min="conversation.checkIn"
              :max="conversation.checkOut"
            />
            <p class="text-xs text-muted-foreground">
              Stay: {{ conversation.checkIn }} — {{ conversation.checkOut }}
            </p>
          </div>

          <div class="flex flex-col gap-2">
            <Label>Notes</Label>
            <Textarea
              v-model="notes"
              placeholder="Any special requests or details..."
              rows="2"
            />
          </div>

          <div v-if="selectedService && selectedItems.length > 0" class="rounded-md border bg-muted p-3">
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Subtotal</span>
              <span>{{ selectedService.items.filter(i => selectedItems.includes(i.id)).reduce((s, i) => s + i.price, 0).toLocaleString() }} {{ selectedService.currency }}</span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ selectedService.availability === 'always' ? 'Auto-confirmed' : 'Requires confirmation' }}
            </p>
          </div>
        </div>
      </ScrollArea>

      <div class="border-t shrink-0 px-6 py-4">
        <div class="flex items-center gap-2">
          <Button variant="outline" class="flex-1" @click="onOpenChange(false)">
            Cancel
          </Button>
          <Button
            class="flex-1"
            :disabled="isCreateDisabled"
            @click="handleCreate"
          >
            <Icon name="lucide:shopping-cart" class="mr-2 h-4 w-4" />
            Create Order
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
