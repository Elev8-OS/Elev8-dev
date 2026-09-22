<script setup lang="ts">
import type { PurchaseOrder, PurchaseOrderItem } from '@/components/procurement/data/purchase-orders'
import type { InventoryItem } from '@/components/inventory/data/catalog'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { CURRENCY_OPTIONS } from '@/components/procurement/data/purchase-requests'
import { usePurchaseOrders } from '@/composables/usePurchaseOrders'
import { useInventoryCatalog } from '@/composables/useInventoryCatalog'
import { useSuppliers } from '@/composables/useSuppliers'

const props = defineProps<{
  open: boolean
  order?: PurchaseOrder | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'createReceiving': [order: PurchaseOrder]
}>()

const { addOrder, updateOrder, markSent } = usePurchaseOrders()
const { items: catalogItems, getItemById } = useInventoryCatalog()
const { suppliers, getSupplierById } = useSuppliers()

const isOpen = computed({
  get: () => props.open,
  set: val => emit('update:open', val),
})

const isEditing = computed(() => !!props.order)

// Form state
const supplierId = ref('')
const currency = ref('IDR')
const expectedDeliveryDate = ref('')
const notes = ref('')
const lineItems = ref<(PurchaseOrderItem & { itemName?: string })[]>([])

// Item picker
const itemPickerOpen = ref(false)
const itemSearchValue = ref('')

const filteredCatalogItems = computed(() => {
  if (!itemSearchValue.value)
    return catalogItems.value
  const q = itemSearchValue.value.toLowerCase()
  return catalogItems.value.filter(i => i.name.toLowerCase().includes(q))
})

function resetForm() {
  supplierId.value = ''
  currency.value = 'IDR'
  expectedDeliveryDate.value = ''
  notes.value = ''
  lineItems.value = []
}

function populateForm(order: PurchaseOrder) {
  const match = suppliers.value.find(s => s.name === order.supplier.name)
  supplierId.value = match?.id ?? ''
  currency.value = order.currency
  expectedDeliveryDate.value = order.expectedDeliveryDate ?? ''
  notes.value = order.notes ?? ''
  lineItems.value = order.items.map(i => ({
    ...i,
    itemName: getItemById(i.itemId)?.name ?? i.itemId,
  }))
}

watch(() => props.open, (val) => {
  if (val) {
    if (props.order)
      populateForm(props.order)
    else resetForm()
  }
})

function getSelectedSupplier() {
  if (supplierId.value)
    return getSupplierById(supplierId.value)
  return null
}

function addItemToLine(item: InventoryItem) {
  const existing = lineItems.value.find(l => l.itemId === item.id)
  if (existing) {
    existing.quantity += 1
    lineItems.value = [...lineItems.value]
  }
  else {
    lineItems.value = [
      ...lineItems.value,
      {
        id: `poi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: item.id,
        quantity: 1,
        unitPrice: item.purchaseValue ?? 0,
        receivedQuantity: 0,
        itemName: item.name,
      },
    ]
  }
  itemPickerOpen.value = false
  itemSearchValue.value = ''
}

function removeLineItem(index: number) {
  lineItems.value = lineItems.value.filter((_, i) => i !== index)
}

function updateLineQty(index: number, qty: number) {
  lineItems.value = lineItems.value.map((l, i) => i === index ? { ...l, quantity: Math.max(1, qty) } : l)
}

function updateLinePrice(index: number, price: number) {
  lineItems.value = lineItems.value.map((l, i) => i === index ? { ...l, unitPrice: Math.max(0, price) } : l)
}

const lineTotal = computed(() =>
  lineItems.value.reduce((s, l) => s + l.unitPrice * l.quantity, 0))

function handleCreate() {
  const sup = getSelectedSupplier()
  if (!sup || lineItems.value.length === 0)
    return

  addOrder({
    status: 'draft',
    supplier: { name: sup.name, contact: sup.contact },
    items: lineItems.value.map(l => ({
      id: l.id,
      itemId: l.itemId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      receivedQuantity: 0,
      notes: l.notes,
    })),
    currency: currency.value,
    totalAmount: lineTotal.value,
    expectedDeliveryDate: expectedDeliveryDate.value || undefined,
    notes: notes.value.trim() || undefined,
  })
  toast.success('PO created')
  isOpen.value = false
}

function handleSave() {
  if (!props.order)
    return
  const sup = getSelectedSupplier()
  updateOrder(props.order.id, {
    supplier: sup
      ? { name: sup.name, contact: sup.contact }
      : props.order.supplier,
    expectedDeliveryDate: expectedDeliveryDate.value || undefined,
    notes: notes.value.trim() || undefined,
  })
  toast.success('PO updated')
  isOpen.value = false
}

function handleMarkSent() {
  if (!props.order)
    return
  markSent(props.order.id)
  toast.success(`${props.order.poNumber} marked as sent`)
  isOpen.value = false
}

function handleCreateReceiving() {
  if (!props.order)
    return
  emit('createReceiving', props.order)
  isOpen.value = false
}

function getItemName(itemId: string): string {
  return getItemById(itemId)?.name ?? itemId
}

function formatDate(d?: string) {
  if (!d)
    return '-'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatAmount(amount: number, curr: string) {
  if (curr === 'IDR')
    return `IDR ${amount.toLocaleString('id-ID')}`
  return `${curr} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent class="w-full sm:max-w-lg overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{{ isEditing ? (order?.poNumber ?? 'Purchase Order') : 'New Purchase Order' }}</SheetTitle>
        <SheetDescription>
          {{ isEditing ? 'View and edit purchase order details.' : 'Create a new purchase order.' }}
        </SheetDescription>
      </SheetHeader>

      <!-- CREATE MODE -->
      <div v-if="!isEditing" class="flex flex-col gap-4 px-4 py-4">
        <div class="flex flex-col gap-1.5">
          <Label>Supplier <span class="text-destructive">*</span></Label>
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
          <p v-if="getSelectedSupplier()?.contact" class="text-xs text-muted-foreground">
            {{ getSelectedSupplier()?.contact }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <Label>Currency</Label>
            <Select v-model="currency">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="c in CURRENCY_OPTIONS" :key="c" :value="c">
                  {{ c }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Expected Delivery</Label>
            <Input v-model="expectedDeliveryDate" type="date" />
          </div>
        </div>

        <Separator />

        <!-- Line Items -->
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">
              Items <span class="text-destructive">*</span>
            </p>
            <Popover v-model:open="itemPickerOpen">
              <PopoverTrigger as-child>
                <Button variant="outline" size="sm" class="h-7 text-xs">
                  <Icon name="lucide:plus" class="mr-1 h-3 w-3" />
                  Add Item
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-80 p-0" align="end">
                <Command>
                  <CommandInput v-model="itemSearchValue" placeholder="Search catalog items..." />
                  <CommandEmpty>No items found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      v-for="item in filteredCatalogItems"
                      :key="item.id"
                      :value="item.id"
                      @select="addItemToLine(item)"
                    >
                      <Icon name="lucide:package" class="mr-2 h-4 w-4 text-muted-foreground" />
                      <div class="flex-1">
                        <p class="text-sm">
                          {{ item.name }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                          {{ item.category }} · {{ item.unit }}
                        </p>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div v-if="lineItems.length === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No items added yet.
          </div>

          <div v-for="(line, idx) in lineItems" :key="line.id" class="rounded-md border p-3">
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-medium flex-1 min-w-0">
                {{ line.itemName ?? line.itemId }}
              </p>
              <Button variant="ghost" size="icon" class="h-6 w-6 shrink-0" @click="removeLineItem(idx)">
                <Icon name="lucide:x" class="h-3.5 w-3.5" />
              </Button>
            </div>
            <div class="grid grid-cols-2 gap-2 mt-2">
              <div class="flex flex-col gap-1">
                <Label class="text-xs">Quantity</Label>
                <Input
                  :model-value="line.quantity"
                  type="number"
                  min="1"
                  class="h-8 text-sm"
                  @update:model-value="(v: string) => updateLineQty(idx, Number(v))"
                />
              </div>
              <div class="flex flex-col gap-1">
                <Label class="text-xs">Unit Price</Label>
                <Input
                  :model-value="line.unitPrice"
                  type="number"
                  min="0"
                  class="h-8 text-sm"
                  @update:model-value="(v: string) => updateLinePrice(idx, Number(v))"
                />
              </div>
            </div>
            <p class="text-xs text-muted-foreground mt-2 text-right">
              Subtotal: {{ formatAmount(line.unitPrice * line.quantity, currency) }}
            </p>
          </div>

          <div v-if="lineItems.length > 0" class="flex justify-end">
            <p class="text-sm font-medium">
              Total: {{ formatAmount(lineTotal, currency) }}
            </p>
          </div>
        </div>

        <Separator />

        <div class="flex flex-col gap-1.5">
          <Label>Notes</Label>
          <Textarea v-model="notes" placeholder="Notes..." rows="3" />
        </div>
      </div>

      <!-- EDIT MODE -->
      <div v-else-if="order" class="flex flex-col gap-4 px-4 py-4">
        <!-- Linked PR info -->
        <div v-if="order.purchaseRequestId" class="rounded-md bg-muted/50 border p-3">
          <p class="text-xs text-muted-foreground">
            Linked Purchase Request
          </p>
          <p class="text-sm font-medium">
            {{ order.purchaseRequestId }}
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Supplier</Label>
          <Select v-model="supplierId" :disabled="order.status !== 'draft'">
            <SelectTrigger>
              <SelectValue :placeholder="order.supplier.name" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="sup in suppliers" :key="sup.id" :value="sup.id">
                {{ sup.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="getSelectedSupplier()?.contact || (!supplierId && order.supplier.contact)" class="text-xs text-muted-foreground">
            {{ getSelectedSupplier()?.contact ?? order.supplier.contact }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <Label>Currency</Label>
            <Input :model-value="order.currency" disabled />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Expected Delivery</Label>
            <Input v-model="expectedDeliveryDate" type="date" :disabled="order.status === 'received' || order.status === 'cancelled'" />
          </div>
        </div>

        <Separator />

        <!-- Line Items (read-only table for edit mode) -->
        <div class="flex flex-col gap-3">
          <p class="text-sm font-medium">
            Items
          </p>
          <div class="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead class="text-right">Qty</TableHead>
                  <TableHead class="text-right">Unit Price</TableHead>
                  <TableHead class="text-right">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="item in order.items" :key="item.id">
                  <TableCell>
                    <p class="text-sm font-medium">
                      {{ getItemName(item.itemId) }}
                    </p>
                    <p v-if="item.notes" class="text-xs text-muted-foreground">
                      {{ item.notes }}
                    </p>
                  </TableCell>
                  <TableCell class="text-right">
                    {{ item.quantity }}
                  </TableCell>
                  <TableCell class="text-right">
                    {{ formatAmount(item.unitPrice, order.currency) }}
                  </TableCell>
                  <TableCell class="text-right">
                    <span :class="item.receivedQuantity >= item.quantity ? 'text-green-600' : 'text-amber-600'">
                      {{ item.receivedQuantity }}
                    </span>
                    / {{ item.quantity }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div class="flex justify-end">
            <p class="text-sm font-medium">
              Total: {{ formatAmount(order.totalAmount, order.currency) }}
            </p>
          </div>
        </div>

        <Separator />

        <div class="flex flex-col gap-1.5">
          <Label>Notes</Label>
          <Textarea v-model="notes" :disabled="order.status === 'received' || order.status === 'cancelled'" placeholder="Notes..." rows="3" />
        </div>
      </div>

      <SheetFooter>
        <Button variant="outline" @click="isOpen = false">
          Close
        </Button>
        <!-- Create mode -->
        <template v-if="!isEditing">
          <Button
            :disabled="!supplierId || lineItems.length === 0"
            @click="handleCreate"
          >
            Create PO
          </Button>
        </template>
        <!-- Edit mode -->
        <template v-else-if="order">
          <Button v-if="order.status === 'draft'" variant="secondary" @click="handleSave">
            Save
          </Button>
          <Button v-if="order.status === 'draft'" @click="handleMarkSent">
            <Icon name="lucide:send" class="mr-2 h-4 w-4" />
            Mark as Sent
          </Button>
          <Button v-if="order.status === 'sent' || order.status === 'partially_received'" @click="handleCreateReceiving">
            <Icon name="lucide:package-check" class="mr-2 h-4 w-4" />
            Create Receiving
          </Button>
        </template>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
