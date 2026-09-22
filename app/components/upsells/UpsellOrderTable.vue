<script setup lang="ts">
import type { OrderStatus, UpsellOrder } from '@/components/upsells/data/upsell-orders'
import type { DateRange } from 'reka-ui'
import { toast } from 'vue-sonner'
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import {
  getOrderStatus,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
} from '@/components/upsells/data/upsell-orders'
import { useUpsellOrders } from '@/composables/useUpsellOrders'
import { listings } from '@/components/listings/data/listings'

const df = new DateFormatter('en-GB', { dateStyle: 'medium' })

function parseDateToCalendarDate(dateStr: string): CalendarDate | undefined {
  if (!dateStr) return undefined
  const [year, month, day] = dateStr.split('-').map(Number)
  return new CalendarDate(year, month, day)
}

function calendarDateToString(date: CalendarDate | undefined): string {
  if (!date) return ''
  return date.toDate(getLocalTimeZone()).toISOString().split('T')[0]
}

const emit = defineEmits<{
  openDrawer: [order: UpsellOrder]
}>()

const { filteredOrders, statusCounts, orders, approveOrder, declineOrder, markPaid, completeFulfillment, startFulfillment, reopenDeclinedOrder, filterStatus, searchValue, filterService, filterDateFrom, filterDateTo, clearFilters } = useUpsellOrders()

// ── Date range (RangeCalendar) ──
const datePopoverOpen = ref(false)

const dateRange = ref<DateRange>({
  start: parseDateToCalendarDate(filterDateFrom.value),
  end: parseDateToCalendarDate(filterDateTo.value),
})

watch(() => dateRange.value, (val) => {
  filterDateFrom.value = calendarDateToString(val.start)
  filterDateTo.value = calendarDateToString(val.end)
}, { deep: true })

watch(datePopoverOpen, (open) => {
  if (open) {
    dateRange.value = {
      start: parseDateToCalendarDate(filterDateFrom.value),
      end: parseDateToCalendarDate(filterDateTo.value),
    }
  }
})

const dateFilterLabel = computed(() => {
  if (dateRange.value.start && dateRange.value.end) {
    return `${df.format(dateRange.value.start.toDate(getLocalTimeZone()))} – ${df.format(dateRange.value.end.toDate(getLocalTimeZone()))}`
  }
  return 'Select dates'
})

function clearDateFilter() {
  filterDateFrom.value = ''
  filterDateTo.value = ''
  dateRange.value = { start: undefined, end: undefined }
  currentPage.value = 1
}

// ── Pagination ──
const pageSize = ref(10)
const currentPage = ref(1)

watch(pageSize, () => {
  currentPage.value = 1
})

watch(filteredOrders, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }
})

// ── Listing filter (from listings data, with tags) ──
const listingSearchText = ref('')
const listingTagSearch = ref('')
const selectedListingTags = ref<string[]>([])
const showListingPanel = ref(false)
const showListingTags = ref(false)

const allListingTags = computed(() => {
  const tags = new Set<string>()
  for (const l of listings.value) {
    for (const tag of l.tags) {
      tags.add(tag)
    }
  }
  return Array.from(tags).sort()
})

const filteredListings = computed(() => {
  return listings.value.filter((l) => {
    const query = listingSearchText.value.trim().toLowerCase()
    if (query && !l.name.toLowerCase().includes(query)) return false
    if (selectedListingTags.value.length > 0 && !selectedListingTags.value.every(tag => l.tags.includes(tag))) return false
    return true
  })
})

function toggleListingTag(tag: string) {
  if (selectedListingTags.value.includes(tag)) {
    selectedListingTags.value = selectedListingTags.value.filter(t => t !== tag)
  }
  else {
    selectedListingTags.value = [...selectedListingTags.value, tag]
  }
}

const filterListing = ref<string[]>([])

function toggleListingFilter(name: string) {
  const current = [...filterListing.value]
  const idx = current.indexOf(name)
  if (idx >= 0) {
    current.splice(idx, 1)
  }
  else {
    current.push(name)
  }
  filterListing.value = current
  currentPage.value = 1
}

function clearListingFilters() {
  filterListing.value = []
  selectedListingTags.value = []
  listingSearchText.value = ''
  listingTagSearch.value = ''
  currentPage.value = 1
}

const hasListingFilter = computed(() => filterListing.value.length > 0)

// ── Tags filter (service category, multi-select) ──
const tagOptions = computed(() => {
  const categories = new Set(orders.value.map(o => o.serviceCategory))
  return Array.from(categories).sort()
})

const filterTags = ref<string[]>([])
const tagSearchText = ref('')

const filteredTagOptions = computed(() => {
  const q = tagSearchText.value.toLowerCase()
  return q ? tagOptions.value.filter(t => t.toLowerCase().includes(q)) : tagOptions.value
})

const hasTagFilter = computed(() => filterTags.value.length > 0)

function toggleServiceTag(tag: string) {
  const current = [...filterTags.value]
  const idx = current.indexOf(tag)
  if (idx >= 0) {
    current.splice(idx, 1)
  }
  else {
    current.push(tag)
  }
  filterTags.value = current
  currentPage.value = 1
}

function clearTagFilters() {
  filterTags.value = []
  tagSearchText.value = ''
  currentPage.value = 1
}

// ── Upsell filter (service name) ──
const serviceOptions = computed(() => {
  const names = new Set(orders.value.map(o => o.serviceName))
  return Array.from(names).sort()
})

const filterServices = ref<string[]>([])
const upsellSearchText = ref('')
const showUpsellPanel = ref(false)

const filteredUpsellOptions = computed(() => {
  const q = upsellSearchText.value.toLowerCase()
  return q ? serviceOptions.value.filter(n => n.toLowerCase().includes(q)) : serviceOptions.value
})

function toggleServiceFilter(name: string) {
  const current = [...filterServices.value]
  const idx = current.indexOf(name)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(name)
  filterServices.value = current
  currentPage.value = 1
}

function clearServiceFilters() {
  filterServices.value = []
  currentPage.value = 1
}

const hasServiceFilter = computed(() => filterServices.value.length > 0)

// ── Currency filter ──
const currencyOptions = computed(() => {
  const currencies = new Set(orders.value.map(o => o.currency))
  return Array.from(currencies).sort()
})

const filterCurrencies = ref<string[]>([])

function toggleCurrencyFilter(currency: string) {
  const current = [...filterCurrencies.value]
  const idx = current.indexOf(currency)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(currency)
  filterCurrencies.value = current
  currentPage.value = 1
}

function clearCurrencyFilters() {
  filterCurrencies.value = []
  currentPage.value = 1
}

const hasCurrencyFilter = computed(() => filterCurrencies.value.length > 0)

const hasAnyFilter = computed(() => hasListingFilter.value || hasTagFilter.value || hasServiceFilter.value || hasCurrencyFilter.value)

const displayOrders = computed(() => {
  let result = filteredOrders.value
  if (filterListing.value.length > 0) {
    result = result.filter(o => filterListing.value.includes(o.listing))
  }
  if (filterTags.value.length > 0) {
    result = result.filter(o => filterTags.value.includes(o.serviceCategory))
  }
  if (filterServices.value.length > 0) {
    result = result.filter(o => filterServices.value.includes(o.serviceName))
  }
  if (filterCurrencies.value.length > 0) {
    result = result.filter(o => filterCurrencies.value.includes(o.currency))
  }
  return result
})

// Re-point pagination to use displayOrders instead of filteredOrders
const totalPages = computed(() => Math.max(1, Math.ceil(displayOrders.value.length / pageSize.value)))

const paginatedOrders = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return displayOrders.value.slice(start, start + pageSize.value)
})

function openDetail(order: UpsellOrder) {
  emit('openDrawer', order)
}

function handleStatusChange(id: string, status: OrderStatus) {
  switch (status) {
    case 'requested':
      reopenDeclinedOrder(id)
      break
    case 'awaiting_payment':
      approveOrder(id)
      break
    case 'paid_in_progress':
      startFulfillment(id)
      break
    case 'completed':
      completeFulfillment(id)
      break
    case 'declined':
      declineOrder(id, 'Declined by staff', 'staff')
      break
  }
  toast.success(`Order marked as ${ORDER_STATUS_LABELS[status]}.`)
}

const showCancelModal = ref(false)
const cancelTargetOrder = ref<UpsellOrder | null>(null)

function handleCancel(order: UpsellOrder) {
  cancelTargetOrder.value = order
  showCancelModal.value = true
}

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('id-ID')}`
}

const statusOptions = computed(() => [
  { label: 'All', value: 'all' as const, count: statusCounts.value.all },
  { label: 'Requested', value: 'requested' as const, count: statusCounts.value.requested },
  { label: 'Awaiting Payment', value: 'awaiting_payment' as const, count: statusCounts.value.awaiting_payment },
  { label: 'Paid - In Progress', value: 'paid_in_progress' as const, count: statusCounts.value.paid_in_progress },
  { label: 'Completed', value: 'completed' as const, count: statusCounts.value.completed },
  { label: 'Declined', value: 'declined' as const, count: statusCounts.value.declined },
])

function exportCSV() {
  const headers = ['Order ID', 'Guest', 'Listing', 'Reservation', 'Service', 'Items', 'Total', 'Currency', 'Status', 'Service Date', 'Order Date', 'Channel', 'Notes']
  const rows = filteredOrders.value.map(o => [
    o.id,
    o.guestName,
    o.listing,
    o.reservationId,
    o.serviceName,
    o.items.map(i => `${i.name} (×${i.quantity})`).join('; '),
    o.grandTotal,
    o.currency,
    ORDER_STATUS_LABELS[getOrderStatus(o)],
    o.serviceEndDate ? `${o.serviceDate} – ${o.serviceEndDate}` : o.serviceDate,
    o.orderDate,
    o.channel,
    o.notes,
  ])
  const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'upsell-orders-export.csv'
  a.click()
  URL.revokeObjectURL(url)
  toast.success('CSV exported.')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Status filter pills -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="opt in statusOptions"
        :key="opt.value"
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors"
        :class="
          filterStatus === opt.value
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        "
        @click="filterStatus = opt.value"
      >
        {{ opt.label }}
        <span
          class="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold"
          :class="filterStatus === opt.value ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-muted-foreground'"
        >
          {{ opt.count }}
        </span>
      </button>
      <div class="ml-auto flex items-center gap-2">
        <!-- Filters button (date range + listing + tags) -->
        <Popover>
          <PopoverTrigger as-child>
            <Button variant="outline" size="sm" class="h-8">
              <Icon name="lucide:filter" class="mr-2 h-4 w-4" />
              Filters
              <span v-if="hasAnyFilter" class="ml-1 rounded-full bg-primary px-1.5 text-[10px] leading-none text-primary-foreground">{{ filterListing.length + filterTags.length + filterServices.length + filterCurrencies.length + (filterDateFrom || filterDateTo ? 1 : 0) }}</span>
              <Icon name="lucide:chevron-down" class="ml-2 h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[380px] p-0" align="start">
            <div class="flex flex-col">
              <!-- Listing selector button (expandable inline) -->
              <div class="border-b" :class="showListingPanel ? '' : 'p-3'">
                <div v-if="!showListingPanel" class="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    class="w-full justify-between"
                    @click="showListingPanel = true"
                  >
                    <div class="flex items-center gap-2">
                      <Icon name="lucide:building" class="size-4" />
                      <span>{{ hasListingFilter ? `${filterListing.length} selected` : 'All listings' }}</span>
                    </div>
                    <Icon name="lucide:chevrons-up-down" class="size-4 opacity-50" />
                  </Button>
                </div>
                <div v-else class="flex flex-col">
                  <div class="flex items-center gap-1 px-2 py-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-7 px-1 text-xs text-muted-foreground"
                      @click="showListingPanel = false"
                    >
                      <Icon name="lucide:arrow-left" class="size-3.5 mr-1" />
                      Back
                    </Button>
                    <div class="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-7 gap-1 px-2 text-xs shrink-0"
                      :class="selectedListingTags.length ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground'"
                      @click="showListingTags = !showListingTags"
                    >
                      <Icon name="lucide:tags" class="size-3.5" />
                      Tags
                      <Badge v-if="selectedListingTags.length" variant="default" class="ml-0.5 h-4 px-1 text-[10px]">
                        {{ selectedListingTags.length }}
                      </Badge>
                    </Button>
                  </div>
                  <div class="px-2 pb-1">
                    <div class="relative">
                      <Icon name="lucide:search" class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input v-model="listingSearchText" placeholder="Search listings..." class="h-8 pl-7 text-xs" />
                    </div>
                  </div>
                  <!-- Tags section (inline toggle) -->
                  <div v-if="showListingTags" class="border-t px-2 py-2">
                    <Input v-model="listingTagSearch" placeholder="Search tags..." class="h-8 text-xs mb-2" />
                    <div class="max-h-40 space-y-1 overflow-auto">
                      <button
                        v-for="tag in allListingTags.filter(t => t.toLowerCase().includes(listingTagSearch.trim().toLowerCase()))"
                        :key="tag"
                        type="button"
                        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        @click="toggleListingTag(tag)"
                      >
                        <div
                          class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                          :class="selectedListingTags.includes(tag) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                        >
                          <Icon v-if="selectedListingTags.includes(tag)" name="lucide:check" class="size-3" />
                        </div>
                        <span>{{ tag }}</span>
                      </button>
                      <p v-if="!allListingTags.filter(t => t.toLowerCase().includes(listingTagSearch.trim().toLowerCase())).length" class="px-2 py-3 text-sm text-muted-foreground">
                        No tags found.
                      </p>
                    </div>
                    <Button v-if="selectedListingTags.length" variant="ghost" size="sm" class="h-7 w-full text-xs text-muted-foreground mt-1" @click="selectedListingTags = []">
                      Clear all
                    </Button>
                  </div>
                  <div class="max-h-48 overflow-auto px-2 pb-2">
                    <div
                      v-for="listing in filteredListings"
                      :key="listing.id"
                      class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      @click="toggleListingFilter(listing.name)"
                    >
                      <div
                        class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                        :class="filterListing.includes(listing.name) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                      >
                        <Icon v-if="filterListing.includes(listing.name)" name="lucide:check" class="size-3" />
                      </div>
                      <span class="flex-1 truncate">{{ listing.name }}</span>
                      <div class="flex shrink-0 gap-0.5">
                        <Badge v-for="tag in listing.tags" :key="tag" variant="outline" class="text-[10px]">
                          {{ tag }}
                        </Badge>
                      </div>
                    </div>
                    <div v-if="filteredListings.length === 0" class="py-4 text-center text-sm text-muted-foreground">
                      No listings found.
                    </div>
                  </div>
                </div>
              </div>
              <!-- Upsell filter -->
              <div class="border-b p-3">
                <Button
                  variant="outline"
                  size="sm"
                  class="w-full justify-between"
                  @click="showUpsellPanel = !showUpsellPanel"
                >
                  <div class="flex items-center gap-2">
                    <Icon name="lucide:package" class="size-4" />
                    <span>{{ hasServiceFilter ? `${filterServices.length} selected` : 'All upsells' }}</span>
                  </div>
                  <Icon name="lucide:chevron-down" class="size-4 opacity-50" :class="showUpsellPanel ? 'rotate-180' : ''" />
                </Button>
                <div v-if="showUpsellPanel" class="mt-2 max-h-48 space-y-1 overflow-auto">
                  <div class="relative mb-2">
                    <Icon name="lucide:search" class="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input v-model="upsellSearchText" placeholder="Search upsells..." class="h-8 pl-7 text-xs" />
                  </div>
                  <button
                    v-for="name in filteredUpsellOptions"
                    :key="name"
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                    @click="toggleServiceFilter(name)"
                  >
                    <div
                      class="flex size-4 shrink-0 items-center justify-center rounded-[4px] border"
                      :class="filterServices.includes(name) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'"
                    >
                      <Icon v-if="filterServices.includes(name)" name="lucide:check" class="size-3" />
                    </div>
                    <span>{{ name }}</span>
                  </button>
                  <Button v-if="hasServiceFilter" variant="ghost" size="sm" class="h-7 w-full text-xs text-muted-foreground mt-1" @click="clearServiceFilters()">
                    Clear all
                  </Button>
                </div>
              </div>
              <!-- Currency filter -->
              <div class="border-b p-3">
                <div class="flex items-center justify-between mb-2">
                  <Label class="text-xs text-muted-foreground">Currency</Label>
                  <Button v-if="hasCurrencyFilter" variant="ghost" size="sm" class="h-6 px-1 text-xs text-muted-foreground" @click="clearCurrencyFilters()">
                    Clear
                  </Button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="currency in currencyOptions"
                    :key="currency"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
                    :class="filterCurrencies.includes(currency) ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:text-foreground'"
                    @click="toggleCurrencyFilter(currency)"
                  >
                    {{ currency }}
                  </button>
                </div>
              </div>
              <!-- Date range -->
              <div class="flex flex-col gap-3 p-3">
                <div class="flex items-center justify-between">
                  <Label class="text-xs text-muted-foreground">Date Range</Label>
                  <Button v-if="filterDateFrom || filterDateTo" variant="ghost" size="sm" class="h-6 px-1 text-xs text-muted-foreground" @click="clearDateFilter">
                    Clear
                  </Button>
                </div>
                <Popover v-model:open="datePopoverOpen">
                  <PopoverTrigger as-child>
                    <Button
                      variant="outline"
                      size="sm"
                      class="w-full justify-start text-xs font-normal"
                      :class="filterDateFrom ? '' : 'text-muted-foreground'"
                    >
                      <Icon name="lucide:calendar" class="mr-2 size-4" />
                      <span class="truncate">{{ dateFilterLabel }}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0" align="start">
                    <div class="p-3">
                      <RangeCalendar
                        v-model="dateRange"
                        weekday-format="short"
                        :number-of-months="2"
                        initial-focus
                        :placeholder="dateRange.start"
                        @update:start-value="(startDate: any) => dateRange.start = startDate"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="sm" class="w-full" @click="clearDateFilter(); clearListingFilters(); clearTagFilters(); filterStatus = 'all'; searchValue = ''">
                  <Icon name="lucide:x" class="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Input
          v-model="searchValue"
          placeholder="Search guest, service, reservation..."
          class="h-8 w-64 text-sm"
        />
        <Button variant="outline" size="sm" class="h-8" @click="exportCSV">
          <Icon name="lucide:download" class="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guest</TableHead>
            <TableHead>Service</TableHead>
            <TableHead class="text-right">
              Total
            </TableHead>
            <TableHead class="text-center">
              Status
            </TableHead>
            <TableHead class="text-center">
              Service Date
            </TableHead>
            <TableHead class="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="paginatedOrders.length === 0">
            <TableCell colspan="6" class="py-12 text-center text-sm text-muted-foreground">
              No orders match the selected filters.
            </TableCell>
          </TableRow>
          <TableRow
            v-for="order in paginatedOrders"
            :key="order.id"
            class="cursor-pointer hover:bg-muted/50"
            @click="openDetail(order)"
          >
            <TableCell>
              <div class="flex flex-col gap-0.5">
                <span class="text-sm font-medium">{{ order.guestName }}</span>
                <span class="max-w-48 truncate text-xs text-muted-foreground">{{ order.listing }}</span>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex flex-col gap-0.5">
                <span class="text-sm">{{ order.serviceName }}</span>
                <span class="text-xs text-muted-foreground">
                  {{ order.items.length }} {{ order.items.length === 1 ? 'item' : 'items' }}
                </span>
              </div>
            </TableCell>
            <TableCell class="text-right font-semibold tabular-nums whitespace-nowrap">
              <span :class="getOrderStatus(order) === 'declined' ? 'line-through text-muted-foreground' : ''">
                {{ formatCurrency(order.grandTotal, order.currency) }}
              </span>
            </TableCell>
            <TableCell class="text-center">
              <Badge
                variant="secondary"
                class="gap-1 text-xs"
                :class="ORDER_STATUS_COLORS[getOrderStatus(order)]"
              >
                {{ ORDER_STATUS_LABELS[getOrderStatus(order)] }}
              </Badge>
            </TableCell>
            <TableCell class="text-center">
              <div class="flex flex-col gap-0.5">
                <span class="text-sm font-medium">
                  <template v-if="order.serviceEndDate">
                    {{ order.serviceDate }} – {{ order.serviceEndDate }}
                  </template>
                  <template v-else>
                    {{ order.serviceDate }}
                  </template>
                </span>
                <span class="text-xs text-muted-foreground">Ordered {{ order.orderDate }}</span>
              </div>
            </TableCell>
            <TableCell @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-7 w-7" aria-label="Order actions">
                    <Icon name="lucide:ellipsis" class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openDetail(order)">
                    <Icon name="lucide:eye" class="mr-2 h-4 w-4" />
                    View Detail
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem v-if="order.approvalStatus === 'requested'" @click="approveOrder(order.id); toast.success('Payment link sent.')">
                    <Icon name="lucide:check-circle" class="mr-2 h-4 w-4 text-emerald-500" />
                    Send Payment Link
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="order.approvalStatus === 'requested'" class="text-destructive" @click="handleCancel(order)">
                    <Icon name="lucide:x-circle" class="mr-2 h-4 w-4" />
                    Decline Request
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="order.paymentStatus === 'awaiting_payment'" @click="markPaid(order.id, 'manual'); toast.success('Payment recorded.')">
                    <Icon name="lucide:wallet" class="mr-2 h-4 w-4 text-emerald-500" />
                    Record Payment
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="order.paymentStatus === 'paid' && order.fulfillmentStatus === 'not_started'" @click="handleStatusChange(order.id, 'paid_in_progress')">
                    <Icon name="lucide:loader-2" class="mr-2 h-4 w-4 text-cyan-500" />
                    Start Fulfillment
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="order.fulfillmentStatus === 'in_progress'" @click="handleStatusChange(order.id, 'completed')">
                    <Icon name="lucide:check-check" class="mr-2 h-4 w-4 text-slate-500" />
                    Mark Completed
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="order.approvalStatus === 'declined'" @click="handleStatusChange(order.id, 'requested')">
                    <Icon name="lucide:rotate-ccw" class="mr-2 h-4 w-4" />
                    Reopen Request
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between px-2">
      <div class="text-sm text-muted-foreground">
        {{ filteredOrders.length }} total orders
      </div>
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2">
          <p class="text-sm font-medium">
            Rows per page
          </p>
          <Select :model-value="`${pageSize}`" @update:model-value="(v) => { pageSize = Number(v); currentPage = 1 }">
            <SelectTrigger class="h-8 w-[70px]">
              <SelectValue :placeholder="`${pageSize}`" />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectItem v-for="s in [10, 20, 30, 50]" :key="s" :value="`${s}`">
                {{ s }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex items-center justify-center text-sm font-medium">
          Page {{ currentPage }} of {{ totalPages }}
        </div>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            class="hidden h-8 w-8 p-0 lg:flex"
            :disabled="currentPage <= 1"
            @click="currentPage = 1"
          >
            <span class="sr-only">First page</span>
            <Icon name="lucide:chevrons-left" class="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            class="h-8 w-8 p-0"
            :disabled="currentPage <= 1"
            @click="currentPage = currentPage - 1"
          >
            <span class="sr-only">Previous page</span>
            <Icon name="lucide:chevron-left" class="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            class="h-8 w-8 p-0"
            :disabled="currentPage >= totalPages"
            @click="currentPage = currentPage + 1"
          >
            <span class="sr-only">Next page</span>
            <Icon name="lucide:chevron-right" class="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            class="hidden h-8 w-8 p-0 lg:flex"
            :disabled="currentPage >= totalPages"
            @click="currentPage = totalPages"
          >
            <span class="sr-only">Last page</span>
            <Icon name="lucide:chevrons-right" class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
  <UpsellsUpsellCancelModal
    :order="cancelTargetOrder"
    :open="showCancelModal"
    @update:open="showCancelModal = $event"
  />
</template>
