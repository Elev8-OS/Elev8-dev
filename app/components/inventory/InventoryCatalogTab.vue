<script setup lang="ts">
import type { AssetStatus, InventoryItem } from '@/components/inventory/data/catalog'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { INVENTORY_CATEGORIES } from '@/components/inventory/data/catalog'
import { useInventoryCatalog } from '@/composables/useInventoryCatalog'

const {
  items,
  filteredItems,
  searchValue,
  activeCategoryFilter,
  activeTypeFilter,
  activeStatusFilter,
  deleteItem,
  getBookValue,
  getDepreciationPct,
  getNextServiceInfo,
} = useInventoryCatalog()

const drawerOpen = ref(false)
const selectedItem = ref<InventoryItem | null>(null)

const docViewOpen = ref(false)
const docViewItem = ref<InventoryItem | null>(null)

function openAdd() {
  selectedItem.value = null
  drawerOpen.value = true
}

function openEdit(item: InventoryItem) {
  selectedItem.value = item
  drawerOpen.value = true
}

function handleDelete(item: InventoryItem) {
  deleteItem(item.id)
  toast.success(`"${item.name}" removed from catalog`)
}

function openDocView(item: InventoryItem) {
  docViewItem.value = item
  docViewOpen.value = true
}

function warrantyStatus(expiry?: string): 'expired' | 'soon' | 'ok' | 'none' {
  if (!expiry)
    return 'none'
  const exp = new Date(expiry)
  const now = new Date()
  const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0)
    return 'expired'
  if (diff <= 30)
    return 'soon'
  return 'ok'
}

function formatIDR(val?: number) {
  if (val === undefined || val === null)
    return '—'
  return `IDR ${val.toLocaleString('id-ID')}`
}

function formatDate(d?: string) {
  if (!d)
    return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatNextServiceDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  active: 'Active',
  under_maintenance: 'Maintenance',
  disposed: 'Disposed',
  replaced: 'Replaced',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  warranty: 'Warranty',
  receipt: 'Receipt',
  invoice: 'Invoice',
  other: 'Other',
}

function downloadCSV() {
  const headers = ['Name', 'Category', 'Type', 'Unit', 'Status', 'Purchase Value (IDR)', 'Book Value (IDR)', 'Depreciation %', 'Purchase Date', 'Warranty Expiry', 'Next Service']
  const rows = items.value.map((i) => {
    const bv = getBookValue(i)
    const dp = getDepreciationPct(i)
    const ns = getNextServiceInfo(i)
    return [
      i.name,
      i.category,
      i.type,
      i.unit,
      i.assetStatus ?? '',
      i.purchaseValue?.toString() ?? '',
      bv?.toString() ?? '',
      dp !== undefined ? `${dp}%` : '',
      i.purchaseDate ?? '',
      i.warrantyExpiry ?? '',
      ns ? formatNextServiceDate(ns.nextDueDate) : '',
    ]
  })
  const csv = [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'inventory-catalog.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative w-48">
        <Icon name="lucide:search" class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchValue" placeholder="Search items..." class="pl-8" />
      </div>

      <div class="flex flex-wrap gap-1.5">
        <Button
          v-for="cat in ['all', ...INVENTORY_CATEGORIES]"
          :key="cat"
          :variant="activeCategoryFilter === cat ? 'default' : 'outline'"
          size="sm"
          class="h-8"
          @click="activeCategoryFilter = cat as typeof activeCategoryFilter"
        >
          {{ cat === 'all' ? 'All' : cat }}
        </Button>
      </div>

      <Select v-model="activeTypeFilter">
        <SelectTrigger class="w-36 h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All Types
          </SelectItem>
          <SelectItem value="permanent">
            Permanent
          </SelectItem>
          <SelectItem value="consumable">
            Consumable
          </SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="activeStatusFilter">
        <SelectTrigger class="w-40 h-8">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All Statuses
          </SelectItem>
          <SelectItem value="active">
            Active
          </SelectItem>
          <SelectItem value="under_maintenance">
            Under Maintenance
          </SelectItem>
          <SelectItem value="disposed">
            Disposed
          </SelectItem>
          <SelectItem value="replaced">
            Replaced
          </SelectItem>
        </SelectContent>
      </Select>

      <div class="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" @click="downloadCSV">
          <Icon name="lucide:download" class="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button size="sm" @click="openAdd">
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-12" />
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Book Value</TableHead>
            <TableHead>Next Service</TableHead>
            <TableHead>Warranty</TableHead>
            <TableHead class="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="item in filteredItems"
            :key="item.id"
            class="cursor-pointer"
            @click="openEdit(item)"
          >
            <TableCell>
              <div class="w-9 h-9 rounded-md border overflow-hidden bg-muted flex items-center justify-center">
                <img v-if="item.photo" :src="item.photo" class="w-full h-full object-cover" :alt="item.name">
                <Icon v-else name="lucide:package" class="h-4 w-4 text-muted-foreground" />
              </div>
            </TableCell>
            <TableCell>
              <div>
                <p class="font-medium">
                  {{ item.name }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ item.unit }} · {{ item.type }}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {{ item.category }}
              </Badge>
            </TableCell>
            <TableCell>
              <template v-if="item.assetStatus">
                <Badge
                  :class="{
                    'bg-green-100 text-green-700 border-green-200': item.assetStatus === 'active',
                    'bg-amber-100 text-amber-700 border-amber-200': item.assetStatus === 'under_maintenance',
                    'text-muted-foreground': item.assetStatus === 'disposed' || item.assetStatus === 'replaced',
                  }"
                  variant="outline"
                >
                  {{ ASSET_STATUS_LABELS[item.assetStatus] }}
                </Badge>
              </template>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <template v-if="getBookValue(item) !== undefined">
                <p class="text-sm">
                  {{ formatIDR(getBookValue(item)) }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ getDepreciationPct(item) }}% depreciated
                </p>
              </template>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <template v-if="getNextServiceInfo(item)">
                <Badge
                  v-if="getNextServiceInfo(item)!.status === 'overdue'"
                  variant="destructive"
                  class="text-xs"
                >
                  Overdue
                </Badge>
                <Badge
                  v-else-if="getNextServiceInfo(item)!.status === 'due_soon'"
                  class="bg-amber-100 text-amber-700 border-amber-200 text-xs"
                  variant="outline"
                >
                  Due Soon
                </Badge>
                <div v-else class="text-sm text-muted-foreground">
                  {{ formatNextServiceDate(getNextServiceInfo(item)!.nextDueDate) }}
                </div>
              </template>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-1.5">
                <template v-if="warrantyStatus(item.warrantyExpiry) === 'none'">
                  <span class="text-muted-foreground">—</span>
                </template>
                <Badge
                  v-else-if="warrantyStatus(item.warrantyExpiry) === 'expired'"
                  variant="destructive"
                >
                  Expired
                </Badge>
                <Badge
                  v-else-if="warrantyStatus(item.warrantyExpiry) === 'soon'"
                  class="bg-amber-100 text-amber-700 border-amber-200"
                >
                  Expiring soon
                </Badge>
                <span v-else class="text-sm text-muted-foreground">
                  {{ formatDate(item.warrantyExpiry) }}
                </span>
                <Button
                  v-if="item.documents?.some(d => d.type === 'warranty' || d.type === 'receipt')"
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 shrink-0"
                  aria-label="View documents"
                  @click.stop="openDocView(item)"
                >
                  <Icon name="lucide:paperclip" class="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </TableCell>
            <TableCell @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-8 w-8">
                    <Icon name="lucide:ellipsis" class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openEdit(item)">
                    <Icon name="lucide:pencil" class="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive" @click="handleDelete(item)">
                    <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredItems.length === 0">
            <TableCell colspan="8" class="text-center text-muted-foreground py-10">
              No items found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <InventoryItemDrawer v-model:open="drawerOpen" :item="selectedItem" />

    <!-- Warranty / Document Quick-View -->
    <Dialog v-model:open="docViewOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Documents — {{ docViewItem?.name }}</DialogTitle>
          <DialogDescription>Attached warranty cards, receipts, and invoices.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-2 py-2">
          <div
            v-for="(doc, i) in docViewItem?.documents"
            :key="i"
            class="flex items-center gap-3 rounded-md border p-3"
          >
            <Icon name="lucide:file-text" class="h-5 w-5 shrink-0 text-muted-foreground" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">
                {{ doc.name }}
              </p>
              <Badge variant="outline" class="mt-0.5 text-xs capitalize">
                {{ DOC_TYPE_LABELS[doc.type] ?? doc.type }}
              </Badge>
            </div>
            <a
              v-if="doc.url.startsWith('data:')"
              :href="doc.url"
              :download="doc.name"
              class="shrink-0"
            >
              <Button variant="outline" size="sm">
                <Icon name="lucide:download" class="mr-1.5 h-3.5 w-3.5" />
                Download
              </Button>
            </a>
            <span v-else class="text-xs text-muted-foreground shrink-0">Mock file</span>
          </div>
          <p v-if="!docViewItem?.documents?.length" class="text-sm text-muted-foreground text-center py-4">
            No documents attached.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
