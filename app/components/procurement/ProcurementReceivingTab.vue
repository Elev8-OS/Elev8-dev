<script setup lang="ts">
import type { Receiving, ReceivingStatus } from '@/components/procurement/data/receivings'
import { toast } from 'vue-sonner'
import { RCV_STATUS_LABELS } from '@/components/procurement/data/receivings'
import { staffMembers } from '@/components/inbox/data/conversations'
import { useReceivings } from '@/composables/useReceivings'
import { usePurchaseOrders } from '@/composables/usePurchaseOrders'

const {
  filteredReceivings,
  searchValue,
  activeStatusFilter,
  completeReceiving,
} = useReceivings()

const { getOrderById } = usePurchaseOrders()

const drawerOpen = ref(false)
const selectedReceiving = ref<Receiving | null>(null)

function openAdd() {
  selectedReceiving.value = null
  drawerOpen.value = true
}

function openView(rcv: Receiving) {
  selectedReceiving.value = rcv
  drawerOpen.value = true
}

function handleComplete(rcv: Receiving) {
  completeReceiving(rcv.id)
  toast.success(`${rcv.receivingNumber} completed`)
}

function getStaffName(staffId: string): string {
  return staffMembers.find(s => s.id === staffId)?.name ?? staffId
}

function getPoNumber(poId?: string): string {
  if (!poId) return '-'
  return getOrderById(poId)?.poNumber ?? poId
}

function getSupplierName(poId?: string): string {
  if (!poId) return '-'
  return getOrderById(poId)?.supplier.name ?? '-'
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getStatusVariant(status: ReceivingStatus) {
  return status === 'draft' ? 'outline' : 'default'
}

function getStatusClass(status: ReceivingStatus) {
  return status === 'draft'
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-green-100 text-green-700 border-green-200'
}

const STATUS_OPTIONS: { value: ReceivingStatus | 'all', label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative w-48">
        <Icon name="lucide:search" class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchValue" placeholder="Search..." class="pl-8" />
      </div>

      <Select v-model="activeStatusFilter">
        <SelectTrigger class="w-40 h-8">
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
          New Receiving
        </Button>
      </div>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Receiving #</TableHead>
            <TableHead>PO #</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Received By</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead class="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="rcv in filteredReceivings"
            :key="rcv.id"
            class="cursor-pointer"
            @click="openView(rcv)"
          >
            <TableCell class="font-mono text-sm">
              {{ rcv.receivingNumber }}
            </TableCell>
            <TableCell class="font-mono text-sm">
              {{ getPoNumber(rcv.purchaseOrderId) }}
            </TableCell>
            <TableCell>
              {{ getSupplierName(rcv.purchaseOrderId) }}
            </TableCell>
            <TableCell>
              {{ rcv.items.length }} item{{ rcv.items.length !== 1 ? 's' : '' }}
            </TableCell>
            <TableCell>
              {{ getStaffName(rcv.receivedBy) }}
            </TableCell>
            <TableCell>
              <Badge :variant="getStatusVariant(rcv.status)" :class="getStatusClass(rcv.status)">
                {{ RCV_STATUS_LABELS[rcv.status] }}
              </Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ formatDate(rcv.receivedAt) }}
            </TableCell>
            <TableCell @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-8 w-8">
                    <Icon name="lucide:ellipsis" class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openView(rcv)">
                    <Icon name="lucide:eye" class="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="rcv.status === 'draft'" @click="handleComplete(rcv)">
                    <Icon name="lucide:check" class="mr-2 h-4 w-4" />
                    Complete Receiving
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredReceivings.length === 0">
            <TableCell colspan="8" class="text-center text-muted-foreground py-10">
              No receivings found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <ProcurementReceivingDrawer v-model:open="drawerOpen" :receiving="selectedReceiving" />
  </div>
</template>
