<script setup lang="ts">
import type { ItemCondition, ListingInventoryEntry } from '@/components/inventory/data/listing-entries'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { BALI_LISTINGS } from '@/components/upsells/data/upsell-services'
import { useInventoryCatalog } from '@/composables/useInventoryCatalog'
import { useInventoryListings } from '@/composables/useInventoryListings'

const LOW_STOCK_THRESHOLD = 5

const router = useRouter()
const { getItemById } = useInventoryCatalog()
const { entries, filteredEntries, filterListing, filterCondition, deleteEntry } = useInventoryListings()

const drawerOpen = ref(false)
const selectedEntry = ref<ListingInventoryEntry | null>(null)

function openAdd() {
  selectedEntry.value = null
  drawerOpen.value = true
}

function openEdit(entry: ListingInventoryEntry) {
  selectedEntry.value = entry
  drawerOpen.value = true
}

function handleDelete(entry: ListingInventoryEntry) {
  const item = getItemById(entry.itemId)
  deleteEntry(entry.id)
  toast.success(`"${item?.name ?? 'Item'}" removed from listing`)
}

function handleCreatePr(entry: ListingInventoryEntry) {
  router.push(`/procurement?tab=pr&itemId=${entry.itemId}`)
}

const CONDITIONS: { value: ItemCondition | 'all', label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'missing', label: 'Missing' },
]

function conditionVariant(cond: ItemCondition) {
  const map: Record<ItemCondition, string> = {
    good: 'bg-green-100 text-green-700 border-green-200',
    fair: 'bg-amber-100 text-amber-700 border-amber-200',
    damaged: 'bg-orange-100 text-orange-700 border-orange-200',
    missing: 'bg-red-100 text-red-700 border-red-200',
  }
  return map[cond]
}

function downloadCSV() {
  const headers = ['Item', 'Category', 'Listing', 'Quantity', 'Unit', 'Condition', 'Stock Level', 'Last Updated']
  const rows = entries.value.map((e) => {
    const item = getItemById(e.itemId)
    return [
      item?.name ?? e.itemId,
      item?.category ?? '',
      e.listingName,
      e.quantity.toString(),
      item?.unit ?? '',
      e.condition,
      e.stockLevel?.toString() ?? '',
      new Date(e.lastUpdated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    ]
  })
  const csv = [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'inventory-per-listing.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function formatRelativeDate(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0)
    return 'Today'
  if (diff === 1)
    return 'Yesterday'
  if (diff < 7)
    return `${diff} days ago`
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <Select v-model="filterListing">
        <SelectTrigger class="w-56 h-8">
          <SelectValue placeholder="All Listings" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All Listings
          </SelectItem>
          <SelectItem v-for="listing in BALI_LISTINGS" :key="listing" :value="listing">
            {{ listing }}
          </SelectItem>
        </SelectContent>
      </Select>

      <div class="flex flex-wrap gap-1.5">
        <Button
          v-for="cond in CONDITIONS"
          :key="cond.value"
          :variant="filterCondition === cond.value ? 'default' : 'outline'"
          size="sm"
          class="h-8"
          @click="filterCondition = cond.value as typeof filterCondition"
        >
          {{ cond.label }}
        </Button>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" @click="downloadCSV">
          <Icon name="lucide:download" class="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button size="sm" @click="openAdd">
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Add Entry
        </Button>
      </div>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Listing</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Condition</TableHead>
            <TableHead>Stock Level</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead class="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="entry in filteredEntries"
            :key="entry.id"
            class="cursor-pointer"
            @click="openEdit(entry)"
          >
            <TableCell>
              <div class="flex flex-col">
                <span class="font-medium">{{ getItemById(entry.itemId)?.name ?? '—' }}</span>
                <Badge variant="outline" class="w-fit mt-0.5 text-xs">
                  {{ getItemById(entry.itemId)?.category ?? '' }}
                </Badge>
              </div>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground max-w-48 truncate">
              {{ entry.listingName }}
            </TableCell>
            <TableCell>
              {{ entry.quantity }} {{ getItemById(entry.itemId)?.unit ?? '' }}
            </TableCell>
            <TableCell>
              <span
                class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize"
                :class="conditionVariant(entry.condition)"
              >
                {{ entry.condition }}
              </span>
            </TableCell>
            <TableCell>
              <span v-if="entry.stockLevel !== undefined" class="flex items-center gap-1.5">
                <span class="text-muted-foreground">{{ entry.stockLevel }} {{ getItemById(entry.itemId)?.unit ?? '' }}</span>
                <span
                  v-if="entry.stockLevel <= LOW_STOCK_THRESHOLD"
                  class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700 border-orange-200"
                >
                  Low
                </span>
              </span>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ formatRelativeDate(entry.lastUpdated) }}
            </TableCell>
            <TableCell @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-8 w-8">
                    <Icon name="lucide:ellipsis" class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openEdit(entry)">
                    <Icon name="lucide:pencil" class="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="entry.stockLevel !== undefined && entry.stockLevel <= LOW_STOCK_THRESHOLD"
                    @click="handleCreatePr(entry)"
                  >
                    <Icon name="lucide:shopping-cart" class="mr-2 h-4 w-4" />
                    Create Purchase Request
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive" @click="handleDelete(entry)">
                    <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredEntries.length === 0">
            <TableCell colspan="7" class="text-center text-muted-foreground py-10">
              No entries found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <InventoryListingDrawer v-model:open="drawerOpen" :entry="selectedEntry" />
  </div>
</template>
