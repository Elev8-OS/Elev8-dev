<script setup lang="ts">
import type { PurchaseOrder, PurchaseOrderStatus } from '@/components/procurement/data/purchase-orders'
import { toast } from 'vue-sonner'
import { PO_STATUS_LABELS } from '@/components/procurement/data/purchase-orders'
import { usePurchaseOrders } from '@/composables/usePurchaseOrders'

const {
  filteredOrders,
  searchValue,
  activeStatusFilter,
  markSent,
  cancelOrder,
} = usePurchaseOrders()

const drawerOpen = ref(false)
const selectedOrder = ref<PurchaseOrder | null>(null)
const rcvDrawerOpen = ref(false)
const rcvPo = ref<PurchaseOrder | null>(null)

function openAdd() {
  selectedOrder.value = null
  drawerOpen.value = true
}

function openEdit(order: PurchaseOrder) {
  selectedOrder.value = order
  drawerOpen.value = true
}

function handleMarkSent(order: PurchaseOrder) {
  markSent(order.id)
  toast.success(`${order.poNumber} marked as sent`)
}

function handleCancel(order: PurchaseOrder) {
  cancelOrder(order.id)
  toast.success(`${order.poNumber} cancelled`)
}

function handleCreateReceiving(order: PurchaseOrder) {
  rcvPo.value = order
  rcvDrawerOpen.value = true
}

function formatDate(d?: string) {
  if (!d)
    return '-'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatAmount(amount: number, currency: string) {
  if (currency === 'IDR')
    return `IDR ${amount.toLocaleString('id-ID')}`
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function getStatusVariant(status: PurchaseOrderStatus) {
  switch (status) {
    case 'draft': return 'secondary'
    case 'sent': return 'outline'
    case 'partially_received': return 'outline'
    case 'received': return 'default'
    case 'cancelled': return 'destructive'
    default: return 'secondary'
  }
}

function getStatusClass(status: PurchaseOrderStatus) {
  switch (status) {
    case 'sent': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'partially_received': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'received': return 'bg-green-100 text-green-700 border-green-200'
    default: return ''
  }
}

function getReceivedProgress(order: PurchaseOrder) {
  const total = order.items.reduce((s, i) => s + i.quantity, 0)
  const received = order.items.reduce((s, i) => s + i.receivedQuantity, 0)
  return `${received}/${total}`
}

const STATUS_OPTIONS: { value: PurchaseOrderStatus | 'all', label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative w-48">
        <Icon name="lucide:search" class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchValue" placeholder="Search POs..." class="pl-8" />
      </div>

      <Select v-model="activeStatusFilter">
        <SelectTrigger class="w-48 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <div class="ml-auto">
        <Button size="sm" @click="openAdd">
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          New PO
        </Button>
      </div>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PO #</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expected</TableHead>
            <TableHead class="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="order in filteredOrders"
            :key="order.id"
            class="cursor-pointer"
            @click="openEdit(order)"
          >
            <TableCell class="font-mono text-sm">
              {{ order.poNumber }}
            </TableCell>
            <TableCell class="font-medium">
              {{ order.supplier.name }}
            </TableCell>
            <TableCell>
              {{ order.items.length }} item{{ order.items.length !== 1 ? 's' : '' }}
            </TableCell>
            <TableCell>
              {{ getReceivedProgress(order) }}
            </TableCell>
            <TableCell>
              {{ formatAmount(order.totalAmount, order.currency) }}
            </TableCell>
            <TableCell>
              <Badge :variant="getStatusVariant(order.status)" :class="getStatusClass(order.status)">
                {{ PO_STATUS_LABELS[order.status] }}
              </Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ formatDate(order.expectedDeliveryDate) }}
            </TableCell>
            <TableCell @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-8 w-8">
                    <Icon name="lucide:ellipsis" class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openEdit(order)">
                    <Icon name="lucide:pencil" class="mr-2 h-4 w-4" />
                    View / Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="order.status === 'sent' || order.status === 'partially_received'"
                    @click="handleCreateReceiving(order)"
                  >
                    <Icon name="lucide:package-check" class="mr-2 h-4 w-4" />
                    Create Receiving
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="order.status === 'draft'" @click="handleMarkSent(order)">
                    <Icon name="lucide:send" class="mr-2 h-4 w-4" />
                    Mark as Sent
                  </DropdownMenuItem>
                  <DropdownMenuSeparator v-if="order.status === 'draft' || order.status === 'sent'" />
                  <DropdownMenuItem
                    v-if="order.status === 'draft' || order.status === 'sent'"
                    class="text-destructive"
                    @click="handleCancel(order)"
                  >
                    <Icon name="lucide:x-circle" class="mr-2 h-4 w-4" />
                    Cancel Order
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredOrders.length === 0">
            <TableCell colspan="8" class="text-center text-muted-foreground py-10">
              No purchase orders found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <ProcurementPurchaseOrderDrawer v-model:open="drawerOpen" :order="selectedOrder" @create-receiving="handleCreateReceiving" />
    <ProcurementReceivingDrawer v-model:open="rcvDrawerOpen" :purchase-order="rcvPo" />
  </div>
</template>
