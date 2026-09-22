<script setup lang="ts">
import type { Receiving, ReceivingItem } from '@/components/procurement/data/receivings'
import type { PurchaseOrder } from '@/components/procurement/data/purchase-orders'
import type { ItemCondition } from '@/components/inventory/data/listing-entries'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { staffMembers } from '@/components/inbox/data/conversations'
import { useReceivings } from '@/composables/useReceivings'
import { usePurchaseOrders } from '@/composables/usePurchaseOrders'
import { useInventoryCatalog } from '@/composables/useInventoryCatalog'
import { useSuppliers } from '@/composables/useSuppliers'

const props = defineProps<{
  open: boolean
  receiving?: Receiving | null
  purchaseOrder?: PurchaseOrder | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { addReceiving, updateReceiving, completeReceiving } = useReceivings()
const { getOrderById } = usePurchaseOrders()
const { items: catalogItems, getItemById } = useInventoryCatalog()
const { suppliers, getSupplierById } = useSuppliers()

const isOpen = computed({
  get: () => props.open,
  set: val => emit('update:open', val),
})

const isCreatingFromPo = computed(() => !!props.purchaseOrder && !props.receiving)
const isCreatingStandalone = computed(() => !props.purchaseOrder && !props.receiving)

// Form state
const receivedBy = ref('staff-3')
const supplierId = ref('')
const notes = ref('')
const editItems = ref<{ itemId: string, itemName: string, quantityReceived: number, condition: ItemCondition, poItemId?: string }[]>([])

// Item picker
const itemPickerOpen = ref(false)
const itemSearchValue = ref('')

const filteredCatalogItems = computed(() => {
  if (!itemSearchValue.value)
    return catalogItems.value
  const q = itemSearchValue.value.toLowerCase()
  return catalogItems.value.filter(i => i.name.toLowerCase().includes(q))
})

function populateFromPo(po: PurchaseOrder) {
  receivedBy.value = 'staff-3'
  const match = suppliers.value.find(s => s.name === po.supplier.name)
  supplierId.value = match?.id ?? ''
  notes.value = ''
  editItems.value = po.items
    .filter(i => i.receivedQuantity < i.quantity)
    .map(i => ({
      itemId: i.itemId,
      itemName: getItemById(i.itemId)?.name ?? i.itemId,
      quantityReceived: i.quantity - i.receivedQuantity,
      condition: 'good' as ItemCondition,
      poItemId: i.id,
    }))
}

function populateForm(rcv: Receiving) {
  receivedBy.value = rcv.receivedBy
  notes.value = rcv.notes ?? ''
  if (rcv.purchaseOrderId) {
    const po = getOrderById(rcv.purchaseOrderId)
    if (po) {
      const match = suppliers.value.find(s => s.name === po.supplier.name)
      supplierId.value = match?.id ?? ''
    }
  }
  editItems.value = rcv.items.map(i => ({
    itemId: i.itemId,
    itemName: getItemById(i.itemId)?.name ?? i.itemId,
    quantityReceived: i.quantityReceived,
    condition: i.condition,
    poItemId: i.purchaseOrderItemId,
  }))
}

function resetForm() {
  receivedBy.value = 'staff-3'
  supplierId.value = ''
  notes.value = ''
  editItems.value = []
}

watch(() => props.open, (val) => {
  if (val) {
    if (props.receiving)
      populateForm(props.receiving)
    else if (props.purchaseOrder)
      populateFromPo(props.purchaseOrder)
    else resetForm()
  }
})

function addItem() {
  editItems.value = [
    ...editItems.value,
    {
      itemId: '',
      itemName: '',
      quantityReceived: 1,
      condition: 'good' as ItemCondition,
    },
  ]
}

function removeItem(index: number) {
  editItems.value = editItems.value.filter((_, i) => i !== index)
}

function selectItem(idx: number, item: { id: string, name: string }) {
  editItems.value = editItems.value.map((l, i) => i === idx ? { ...l, itemId: item.id, itemName: item.name } : l)
  itemPickerOpen.value = false
  itemSearchValue.value = ''
}

function getPo() {
  if (props.purchaseOrder)
    return props.purchaseOrder
  if (props.receiving?.purchaseOrderId)
    return getOrderById(props.receiving.purchaseOrderId)
  return null
}

function getPoItemOrderedQty(poItemId?: string): number {
  if (!poItemId)
    return 0
  const po = getPo()
  if (!po)
    return 0
  return po.items.find(i => i.id === poItemId)?.quantity ?? 0
}

function getStaffName(staffId: string): string {
  return staffMembers.find(s => s.id === staffId)?.name ?? staffId
}

function formatDate(d?: string) {
  if (!d)
    return '-'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const CONDITIONS: { value: ItemCondition, label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'missing', label: 'Missing' },
]

function buildPayload() {
  return editItems.value.map(item => ({
    id: `rcvi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    itemId: item.itemId,
    purchaseOrderItemId: item.poItemId,
    quantityReceived: item.quantityReceived,
    condition: item.condition,
  }))
}

function handleSave() {
  if (isCreatingStandalone.value || isCreatingFromPo.value) {
    const po = getPo()
    addReceiving({
      purchaseOrderId: po?.id,
      status: 'draft',
      receivedBy: receivedBy.value,
      items: buildPayload(),
      receivedAt: new Date().toISOString(),
      notes: notes.value.trim() || undefined,
    })
    toast.success('Receiving created')
  }
  else if (props.receiving) {
    updateReceiving(props.receiving.id, {
      items: editItems.value.map(item => ({
        id: item.poItemId ?? `rcvi-${Date.now()}`,
        itemId: item.itemId,
        purchaseOrderItemId: item.poItemId,
        quantityReceived: item.quantityReceived,
        condition: item.condition,
      })),
    })
    toast.success('Receiving updated')
  }
  isOpen.value = false
}

function handleComplete() {
  if (isCreatingStandalone.value || isCreatingFromPo.value) {
    const po = getPo()
    const newId = addReceiving({
      purchaseOrderId: po?.id,
      status: 'draft',
      receivedBy: receivedBy.value,
      items: buildPayload(),
      receivedAt: new Date().toISOString(),
      notes: notes.value.trim() || undefined,
    })
    completeReceiving(newId)
  }
  else if (props.receiving) {
    updateReceiving(props.receiving.id, {
      items: editItems.value.map(item => ({
        id: item.poItemId ?? `rcvi-${Date.now()}`,
        itemId: item.itemId,
        purchaseOrderItemId: item.poItemId,
        quantityReceived: item.quantityReceived,
        condition: item.condition,
      })),
    })
    completeReceiving(props.receiving.id)
  }
  isOpen.value = false
}

const isFormValid = computed(() =>
  editItems.value.length > 0 && editItems.value.every(i => i.itemId && i.quantityReceived > 0))
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent class="w-full sm:max-w-lg overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{{ isCreatingStandalone ? 'New Receiving' : isCreatingFromPo ? 'New Receiving' : (receiving?.receivingNumber ?? 'Receiving') }}</SheetTitle>
        <SheetDescription>
          {{ isCreatingStandalone ? 'Receive items into inventory.' : isCreatingFromPo ? `Receive items from ${purchaseOrder?.poNumber}.` : 'Receiving details and item inspection.' }}
        </SheetDescription>
      </SheetHeader>

      <div v-if="receiving || isCreatingStandalone || isCreatingFromPo" class="flex flex-col gap-4 px-4 py-4">
        <!-- PO Info (when linked) -->
        <div v-if="getPo()" class="rounded-md bg-muted/50 border p-3">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <p class="text-xs text-muted-foreground">
                Purchase Order
              </p>
              <p class="text-sm font-medium">
                {{ getPo()?.poNumber }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">
                Supplier
              </p>
              <p class="text-sm font-medium">
                {{ getPo()?.supplier.name }}
              </p>
            </div>
          </div>
        </div>

        <!-- Supplier picker (standalone mode) -->
        <div v-if="isCreatingStandalone" class="flex flex-col gap-1.5">
          <Label>Supplier (optional)</Label>
          <Select v-model="supplierId">
            <SelectTrigger>
              <SelectValue placeholder="Select supplier..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="sup in suppliers" :key="sup.id" :value="sup.id">
                {{ sup.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Staff selector (create modes) -->
        <div v-if="!receiving" class="flex flex-col gap-1.5">
          <Label>Received By</Label>
          <Select v-model="receivedBy">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="s in staffMembers" :key="s.id" :value="s.id">
                {{ s.name }} ({{ s.role }})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div v-else class="grid grid-cols-2 gap-2">
          <div>
            <p class="text-xs text-muted-foreground">Received By</p>
            <p class="text-sm font-medium">{{ getStaffName(receiving.receivedBy) }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground">Date</p>
            <p class="text-sm font-medium">{{ formatDate(receiving.receivedAt) }}</p>
          </div>
        </div>

        <Separator />

        <!-- Items -->
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">
              Items <span class="text-destructive">*</span>
            </p>
            <Button v-if="isCreatingStandalone" variant="outline" size="sm" class="h-7 text-xs" @click="addItem">
              <Icon name="lucide:plus" class="mr-1 h-3 w-3" />
              Add Item
            </Button>
          </div>

          <div v-if="editItems.length === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No items yet.
          </div>

          <div v-for="(item, idx) in editItems" :key="idx" class="rounded-md border p-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium">
                  {{ item.itemName || 'Select item...' }}
                </p>
                <p v-if="item.poItemId" class="text-xs text-muted-foreground">
                  Ordered: {{ getPoItemOrderedQty(item.poItemId) }}
                </p>
              </div>
              <Button v-if="isCreatingStandalone" variant="ghost" size="icon" class="h-6 w-6 shrink-0" @click="removeItem(idx)">
                <Icon name="lucide:x" class="h-3.5 w-3.5" />
              </Button>
            </div>

            <!-- Item picker for standalone mode -->
            <div v-if="isCreatingStandalone && !item.itemId" class="mt-2">
              <Popover>
                <PopoverTrigger as-child>
                  <Button variant="outline" size="sm" class="h-8 justify-start text-xs font-normal w-full">
                    <Icon name="lucide:search" class="mr-2 h-3 w-3" />
                    Pick item from catalog...
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-72 p-0" align="start">
                  <Command>
                    <CommandInput v-model="itemSearchValue" placeholder="Search..." />
                    <CommandEmpty>No items found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        v-for="ci in filteredCatalogItems"
                        :key="ci.id"
                        :value="ci.id"
                        @select="selectItem(idx, { id: ci.id, name: ci.name })"
                      >
                        <Icon name="lucide:package" class="mr-2 h-4 w-4 text-muted-foreground" />
                        <div>
                          <p class="text-sm">{{ ci.name }}</p>
                          <p class="text-xs text-muted-foreground">{{ ci.category }} · {{ ci.unit }}</p>
                        </div>
                      </CommandItem>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div v-if="item.itemId" class="grid grid-cols-2 gap-2 mt-2">
              <div class="flex flex-col gap-1">
                <Label class="text-xs">Received Qty</Label>
                <Input
                  v-model.number="item.quantityReceived"
                  type="number"
                  min="0"
                  class="h-8 text-sm"
                  :disabled="!!receiving && receiving.status === 'completed'"
                />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs">Condition</Label>
                <Select v-model="item.condition" :disabled="!!receiving && receiving.status === 'completed'">
                  <SelectTrigger class="h-8 text-sm w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="c in CONDITIONS" :key="c.value" :value="c.value">
                      {{ c.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div class="flex flex-col gap-1.5">
          <Label>Notes</Label>
          <Textarea v-model="notes" :disabled="!!receiving && receiving.status === 'completed'" placeholder="Notes..." rows="2" />
        </div>
      </div>

      <SheetFooter>
        <Button variant="outline" @click="isOpen = false">
          Close
        </Button>
        <template v-if="!receiving">
          <Button variant="secondary" :disabled="!isFormValid" @click="handleSave">
            Save Draft
          </Button>
          <Button :disabled="!isFormValid" @click="handleComplete">
            <Icon name="lucide:check" class="mr-2 h-4 w-4" />
            Complete Receiving
          </Button>
        </template>
        <template v-else-if="receiving.status === 'draft'">
          <Button variant="secondary" @click="handleSave">
            Save
          </Button>
          <Button @click="handleComplete">
            <Icon name="lucide:check" class="mr-2 h-4 w-4" />
            Complete Receiving
          </Button>
        </template>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
