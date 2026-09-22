<script setup lang="ts">
import type { PurchaseRequest, PurchaseRequestStatus } from '@/components/procurement/data/purchase-requests'
import { toast } from 'vue-sonner'
import { PR_STATUS_LABELS } from '@/components/procurement/data/purchase-requests'
import { staffMembers } from '@/components/inbox/data/conversations'
import { usePurchaseRequests } from '@/composables/usePurchaseRequests'
import { usePurchaseOrders } from '@/composables/usePurchaseOrders'
import { useInventoryCatalog } from '@/composables/useInventoryCatalog'

const {
  filteredRequests,
  searchValue,
  activeStatusFilter,
  approveRequest,
  rejectRequest,
  submitForApproval,
  markConvertedToPo,
  deleteRequest,
} = usePurchaseRequests()

const { addOrder } = usePurchaseOrders()
const { getItemById } = useInventoryCatalog()

const drawerOpen = ref(false)
const selectedRequest = ref<PurchaseRequest | null>(null)

function openAdd() {
  selectedRequest.value = null
  drawerOpen.value = true
}

function openEdit(req: PurchaseRequest) {
  selectedRequest.value = req
  drawerOpen.value = true
}

function handleSubmit(req: PurchaseRequest) {
  submitForApproval(req.id)
  toast.success(`${req.requestNumber} submitted for approval`)
}

function handleApprove(req: PurchaseRequest) {
  approveRequest(req.id, 'staff-1')
  toast.success(`${req.requestNumber} approved`)
}

function handleReject(req: PurchaseRequest) {
  rejectRequest(req.id, 'staff-1')
  toast.success(`${req.requestNumber} rejected`)
}

function handleCreatePo(req: PurchaseRequest) {
  const supplierItem = req.items[0]
  const catalogItem = supplierItem ? getItemById(supplierItem.itemId) : undefined

  addOrder({
    purchaseRequestId: req.id,
    status: 'draft',
    supplier: catalogItem?.supplier ?? { name: 'Unknown Supplier', contact: '' },
    items: req.items.map(i => ({
      id: `poi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: i.itemId,
      quantity: i.quantity,
      unitPrice: i.estimatedPrice ?? 0,
      receivedQuantity: 0,
      notes: i.notes,
    })),
    currency: req.currency,
    totalAmount: req.items.reduce((sum, i) => sum + (i.estimatedPrice ?? 0) * i.quantity, 0),
    notes: `Created from ${req.requestNumber}`,
  })

  markConvertedToPo(req.id)
  toast.success(`PO created from ${req.requestNumber}`)
}

function handleDelete(req: PurchaseRequest) {
  deleteRequest(req.id)
  toast.success(`${req.requestNumber} deleted`)
}

function getStaffName(staffId: string): string {
  return staffMembers.find(s => s.id === staffId)?.name ?? staffId
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatAmount(amount: number, currency: string) {
  if (currency === 'IDR')
    return `IDR ${amount.toLocaleString('id-ID')}`
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function getStatusVariant(status: PurchaseRequestStatus) {
  switch (status) {
    case 'draft': return 'secondary'
    case 'pending_approval': return 'outline'
    case 'approved': return 'default'
    case 'rejected': return 'destructive'
    case 'converted_to_po': return 'outline'
    default: return 'secondary'
  }
}

function getStatusClass(status: PurchaseRequestStatus) {
  switch (status) {
    case 'pending_approval': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'approved': return 'bg-green-100 text-green-700 border-green-200'
    case 'converted_to_po': return 'bg-blue-100 text-blue-700 border-blue-200'
    default: return ''
  }
}

const STATUS_OPTIONS: { value: PurchaseRequestStatus | 'all', label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'converted_to_po', label: 'Converted to PO' },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative w-48">
        <Icon name="lucide:search" class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchValue" placeholder="Search PRs..." class="pl-8" />
      </div>

      <Select v-model="activeStatusFilter">
        <SelectTrigger class="w-44 h-8">
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
          New PR
        </Button>
      </div>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Request #</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Requested By</TableHead>
            <TableHead>Total Est.</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead class="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="req in filteredRequests"
            :key="req.id"
            class="cursor-pointer"
            @click="openEdit(req)"
          >
            <TableCell class="font-mono text-sm">
              {{ req.requestNumber }}
            </TableCell>
            <TableCell class="font-medium">
              {{ req.title }}
            </TableCell>
            <TableCell>
              {{ req.items.length }} item{{ req.items.length !== 1 ? 's' : '' }}
            </TableCell>
            <TableCell>
              {{ getStaffName(req.requestedBy) }}
            </TableCell>
            <TableCell>
              {{ formatAmount(req.items.reduce((s, i) => s + (i.estimatedPrice ?? 0) * i.quantity, 0), req.currency) }}
            </TableCell>
            <TableCell>
              <Badge :variant="getStatusVariant(req.status)" :class="getStatusClass(req.status)">
                {{ PR_STATUS_LABELS[req.status] }}
              </Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ formatDate(req.createdAt) }}
            </TableCell>
            <TableCell @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-8 w-8">
                    <Icon name="lucide:ellipsis" class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openEdit(req)">
                    <Icon name="lucide:pencil" class="mr-2 h-4 w-4" />
                    View / Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="req.status === 'draft'" @click="handleSubmit(req)">
                    <Icon name="lucide:send" class="mr-2 h-4 w-4" />
                    Submit for Approval
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="req.status === 'pending_approval'" @click="handleApprove(req)">
                    <Icon name="lucide:check" class="mr-2 h-4 w-4" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="req.status === 'pending_approval'" @click="handleReject(req)">
                    <Icon name="lucide:x" class="mr-2 h-4 w-4" />
                    Reject
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="req.status === 'approved'" @click="handleCreatePo(req)">
                    <Icon name="lucide:shopping-cart" class="mr-2 h-4 w-4" />
                    Create PO
                  </DropdownMenuItem>
                  <DropdownMenuSeparator v-if="req.status === 'draft'" />
                  <DropdownMenuItem v-if="req.status === 'draft'" class="text-destructive" @click="handleDelete(req)">
                    <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredRequests.length === 0">
            <TableCell colspan="8" class="text-center text-muted-foreground py-10">
              No purchase requests found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <ProcurementPurchaseRequestDrawer v-model:open="drawerOpen" :request="selectedRequest" />
  </div>
</template>
