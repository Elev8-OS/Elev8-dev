<script setup lang="ts">
import type { DateRange } from 'reka-ui'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { listings } from '~/components/listings/data/listings'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'
import NewReservationDialog from '~/components/reservations/NewReservationDialog.vue'
import ReservationDetailSheet from '~/components/reservations/ReservationDetailSheet.vue'
import ReservationTable from '~/components/reservations/ReservationTable.vue'
import { useReservationsModule } from '~/composables/useReservationsModule'

const router = useRouter()

const {
  filteredReservations,
  stats,
  filters,
} = useReservationsModule()

const df = new DateFormatter('en-US', { dateStyle: 'medium' })

const createOpen = ref(false)
const detailReservation = ref<ReservationEntry | null>(null)
const detailOpen = ref(false)

function openDetail(r: ReservationEntry) {
  detailReservation.value = r
  detailOpen.value = true
}

function openGuest(id: string) {
  router.push(`/reservations/guests/${id}`)
}

function copyId(id: string) {
  navigator.clipboard.writeText(id)
  toast.success('Booking ID copied')
}

const statusOptions = [
  { label: 'All', value: 'all' },
  ...Object.entries(reservationStatusLabels).map(([value, label]) => ({ label, value })),
]

// Listing filter (same pattern as Payment Requests)
const listingPopoverOpen = ref(false)
const listingSearch = ref('')
const selectedListingTags = ref<string[]>([])

const allListingTags = computed(() => {
  const tags = new Set<string>()
  for (const l of listings.value)
    l.tags.forEach(t => tags.add(t))
  return Array.from(tags).sort()
})

function toggleListingTag(tag: string) {
  if (selectedListingTags.value.includes(tag))
    selectedListingTags.value = selectedListingTags.value.filter(t => t !== tag)
  else
    selectedListingTags.value = [...selectedListingTags.value, tag]
}

function toggleListing(listingId: string) {
  if (filters.value.listings.includes(listingId))
    filters.value.listings = filters.value.listings.filter(id => id !== listingId)
  else
    filters.value.listings = [...filters.value.listings, listingId]
}

const filteredListingsForFilter = computed(() => {
  const query = listingSearch.value.trim().toLowerCase()
  return listings.value.filter((l) => {
    const haystack = `${l.name} ${l.location} ${l.tags.join(' ')}`.toLowerCase()
    if (query && !haystack.includes(query))
      return false
    if (selectedListingTags.value.length > 0 && !selectedListingTags.value.every(tag => l.tags.includes(tag)))
      return false
    return true
  })
})

const selectedListingNames = computed(() => {
  return filters.value.listings
    .map(id => listings.value.find(l => l.id === id)?.name)
    .filter(Boolean) as string[]
})

// Date range filter
const datePopoverOpen = ref(false)

function parseDateToCalendarDate(dateStr: string): CalendarDate | undefined {
  if (!dateStr)
    return undefined
  const [year, month, day] = dateStr.split('-').map(Number)
  return new CalendarDate(year, month, day)
}

function calendarDateToString(date: CalendarDate | undefined): string {
  if (!date)
    return ''
  const d = date.toDate(getLocalTimeZone())
  return d.toISOString().split('T')[0]
}

const dateRange = ref<DateRange>({
  start: parseDateToCalendarDate(filters.value.dateFrom),
  end: parseDateToCalendarDate(filters.value.dateTo),
})

watch(() => dateRange.value, (val) => {
  filters.value.dateFrom = calendarDateToString(val.start)
  filters.value.dateTo = calendarDateToString(val.end)
}, { deep: true })

watch(datePopoverOpen, (open) => {
  if (open) {
    dateRange.value = {
      start: parseDateToCalendarDate(filters.value.dateFrom),
      end: parseDateToCalendarDate(filters.value.dateTo),
    }
  }
})

function clearDateFilter() {
  filters.value.dateFrom = ''
  filters.value.dateTo = ''
  dateRange.value = { start: undefined, end: undefined }
}

function clearAllFilters() {
  filters.value.search = ''
  filters.value.status = 'all'
  filters.value.listings = []
  filters.value.dateFrom = ''
  filters.value.dateTo = ''
  selectedListingTags.value = []
  listingSearch.value = ''
}

const hasActiveFilters = computed(() =>
  filters.value.search
  || filters.value.status !== 'all'
  || filters.value.listings.length > 0
  || filters.value.dateFrom
  || filters.value.dateTo,
)

const dateFilterLabel = computed(() => {
  if (!filters.value.dateFrom && !filters.value.dateTo)
    return 'Date range'
  if (filters.value.dateFrom === filters.value.dateTo)
    return filters.value.dateFrom
  return `${filters.value.dateFrom} – ${filters.value.dateTo}`
})

// Stats cards (clickable to filter)
const statCards = computed(() => [
  { label: 'Upcoming', value: stats.value.upcoming, status: 'verified' as const, icon: 'lucide:calendar-clock' },
  { label: 'Current', value: stats.value.current, status: 'checked_in' as const, icon: 'lucide:calendar-check' },
  { label: 'Past', value: stats.value.past, status: 'checked_out' as const, icon: 'lucide:calendar-x' },
  { label: 'Cancelled', value: stats.value.cancelled, status: 'cancelled' as const, icon: 'lucide:calendar-off' },
])

function applyStatFilter(status: string) {
  filters.value.status = filters.value.status === status ? 'all' : status as any
}
</script>

<template>
  <div class="space-y-6 p-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Reservations
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ filteredReservations.length }} reservations
        </p>
      </div>
      <Button class="gap-2" @click="createOpen = true">
        <Icon name="lucide:plus" class="size-4" />
        New Reservation
      </Button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <button
        v-for="card in statCards"
        :key="card.label"
        type="button"
        class="rounded-lg border bg-card text-left p-4 transition-colors hover:bg-muted/40"
        :class="filters.status === card.status ? 'border-primary' : ''"
        @click="applyStatFilter(card.status)"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground uppercase tracking-wide">{{ card.label }}</span>
          <Icon :name="card.icon" class="size-4 text-muted-foreground" />
        </div>
        <div class="text-2xl font-bold mt-1">
          {{ card.value }}
        </div>
      </button>
    </div>

    <!-- Filter bar -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative min-w-[200px] flex-1 max-w-xs">
        <Icon name="lucide:search" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="filters.search" placeholder="Search guest, listing, or ID..." class="pl-9" />
      </div>

      <Select v-model="filters.status">
        <SelectTrigger class="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Popover v-model:open="listingPopoverOpen">
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            class="h-9 gap-1.5 px-3"
            :class="filters.listings.length ? 'border-primary text-primary hover:bg-primary/10' : ''"
          >
            <Icon name="lucide:building-2" class="size-4" />
            Listings
            <Badge v-if="filters.listings.length" variant="default" class="ml-0.5 h-4 px-1 text-[10px]">
              {{ filters.listings.length }}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-[380px] p-0" align="start">
          <Command>
            <div class="flex w-full items-center">
              <div class="flex-1 min-w-0">
                <CommandInput v-model="listingSearch" placeholder="Search listing or location..." class="border-0 focus:ring-0" />
              </div>
              <div class="pr-2">
                <Popover>
                  <PopoverTrigger as-child>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-7 gap-1 px-2 text-xs"
                      :class="selectedListingTags.length ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground'"
                    >
                      <Icon name="lucide:tags" class="size-3.5" />
                      Tags
                      <Badge v-if="selectedListingTags.length" variant="default" class="ml-0.5 h-4 px-1 text-[10px]">
                        {{ selectedListingTags.length }}
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-56 p-0" align="end">
                    <div class="space-y-2 p-2">
                      <Input v-model="listingSearch" placeholder="Search tags..." class="h-8 text-xs" />
                      <div class="max-h-40 space-y-1 overflow-auto">
                        <button
                          v-for="tag in allListingTags.filter(t => t.toLowerCase().includes(listingSearch.trim().toLowerCase()))"
                          :key="tag"
                          type="button"
                          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                          @click="toggleListingTag(tag)"
                        >
                          <Checkbox :model-value="selectedListingTags.includes(tag)" class="size-3.5" />
                          <span>{{ tag }}</span>
                        </button>
                        <p v-if="!allListingTags.filter(t => t.toLowerCase().includes(listingSearch.trim().toLowerCase())).length" class="px-2 py-3 text-sm text-muted-foreground">
                          No tags found.
                        </p>
                      </div>
                      <Button v-if="selectedListingTags.length" variant="ghost" size="sm" class="h-7 w-full text-xs text-muted-foreground" @click="selectedListingTags = []">
                        Clear all
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <CommandList>
              <CommandEmpty>
                <div v-if="listingSearch.trim() || selectedListingTags.length" class="py-3 text-center">
                  <p class="text-sm text-muted-foreground">
                    No listing found.
                  </p>
                </div>
                <div v-else class="py-3 text-center text-sm text-muted-foreground">
                  Type to search...
                </div>
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  v-for="listing in filteredListingsForFilter"
                  :key="listing.id"
                  :value="listing.name"
                  class="cursor-pointer"
                  @select.prevent="toggleListing(listing.id)"
                >
                  <div class="flex items-start gap-2 w-full">
                    <Checkbox :model-value="filters.listings.includes(listing.id)" class="mt-0.5 size-4" />
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium">
                        {{ listing.name }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{ listing.location }}
                      </p>
                      <div class="mt-1 flex flex-wrap gap-1">
                        <Badge v-for="tag in listing.tags" :key="tag" variant="outline" class="text-[10px]">
                          {{ tag }}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
          <div v-if="filters.listings.length" class="border-t p-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted-foreground">{{ filters.listings.length }} selected</span>
              <Button variant="ghost" size="sm" class="h-6 text-xs text-muted-foreground" @click="filters.listings = []">
                Clear all
              </Button>
            </div>
            <div class="mt-1.5 flex flex-wrap gap-1">
              <Badge v-for="name in selectedListingNames" :key="name" variant="secondary" class="text-[10px]">
                {{ name }}
              </Badge>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Popover v-model:open="datePopoverOpen">
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            class="h-9 gap-1.5 px-3"
            :class="filters.dateFrom ? 'border-primary text-primary hover:bg-primary/10' : ''"
          >
            <Icon name="lucide:calendar" class="size-4" />
            <span class="max-w-[160px] truncate">{{ dateFilterLabel }}</span>
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
            <div class="mt-3 flex items-center justify-between border-t pt-3">
              <p class="text-xs text-muted-foreground">
                <template v-if="dateRange.start && dateRange.end">
                  {{ df.format(dateRange.start.toDate(getLocalTimeZone())) }} – {{ df.format(dateRange.end.toDate(getLocalTimeZone())) }}
                </template>
                <template v-else>
                  Select a date range
                </template>
              </p>
              <Button v-if="filters.dateFrom || filters.dateTo" variant="ghost" size="sm" class="h-7 text-xs text-muted-foreground" @click="clearDateFilter">
                Clear
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button v-if="hasActiveFilters" variant="ghost" class="h-9 text-xs" @click="clearAllFilters">
        Clear all
      </Button>
    </div>

    <ReservationTable
      :reservations="filteredReservations"
      @open-guest="openGuest"
      @open-detail="openDetail"
      @copy-id="copyId"
    />

    <ReservationDetailSheet
      :reservation="detailReservation"
      :open="detailOpen"
      @update:open="detailOpen = $event"
      @open-guest="openGuest"
    />

    <NewReservationDialog
      v-model:open="createOpen"
    />
  </div>
</template>
