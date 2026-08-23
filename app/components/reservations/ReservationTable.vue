<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import ReservationGuestCell from '~/components/reservations/ReservationGuestCell.vue'
import ReservationStatusBadge from '~/components/reservations/ReservationStatusBadge.vue'

const props = defineProps<{ reservations: ReservationEntry[] }>()

const emit = defineEmits<{
  openGuest: [id: string]
  openDetail: [reservation: ReservationEntry]
  copyId: [id: string]
}>()

const df = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${currency}`
}

// Sorting
type SortKey = 'guest' | 'listing' | 'checkIn' | 'checkOut' | 'nights' | 'guests' | 'channel' | 'total' | 'status'
const sortKey = ref<SortKey | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

const sortableColumns: Array<{ key: SortKey, label: string, align?: 'right' }> = [
  { key: 'guest', label: 'Guest' },
  { key: 'listing', label: 'Listing' },
  { key: 'checkIn', label: 'Check-in' },
  { key: 'checkOut', label: 'Check-out' },
  { key: 'nights', label: 'Nights' },
  { key: 'guests', label: 'Guests' },
  { key: 'channel', label: 'Channel' },
  { key: 'total', label: 'Total', align: 'right' },
  { key: 'status', label: 'Status' },
]

function sortValue(r: ReservationEntry, key: SortKey): string | number {
  switch (key) {
    case 'guest': return r.guestName.toLowerCase()
    case 'listing': return r.listingName.toLowerCase()
    case 'checkIn': return r.checkIn
    case 'checkOut': return r.checkOut
    case 'nights': return r.nights
    case 'guests': return r.guestCount
    case 'channel': return r.channel
    case 'total': return r.totalPrice
    case 'status': return r.status
  }
}

// Pagination
const pageSize = 10
const page = ref(1)

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    if (sortDir.value === 'asc')
      sortDir.value = 'desc'
    else
      sortKey.value = null
  }
  else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
  page.value = 1
}

const sortedReservations = computed(() => {
  const list = [...props.reservations]
  if (!sortKey.value)
    return list
  const key = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    const av = sortValue(a, key)
    const bv = sortValue(b, key)
    if (av < bv)
      return -1 * dir
    if (av > bv)
      return 1 * dir
    return 0
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(sortedReservations.value.length / pageSize)))

const pagedReservations = computed(() => {
  const start = (page.value - 1) * pageSize
  return sortedReservations.value.slice(start, start + pageSize)
})

const rangeLabel = computed(() => {
  const total = sortedReservations.value.length
  if (total === 0)
    return 'No reservations'
  const start = (page.value - 1) * pageSize + 1
  const end = Math.min(page.value * pageSize, total)
  return `Showing ${start}–${end} of ${total}`
})

// Clamp page when filters/sorting shrink the list
watch(totalPages, (pages) => {
  if (page.value > pages)
    page.value = pages
})

watch(() => props.reservations, () => {
  page.value = 1
})

const pageNumbers = computed(() => {
  const pages = totalPages.value
  const current = page.value
  if (pages <= 7)
    return Array.from({ length: pages }, (_, i) => i + 1)
  const nums = new Set<number>([1, pages, current - 1, current, current + 1])
  const list = [...nums].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b)
  const out: Array<number | 'ellipsis'> = []
  let prev = 0
  for (const n of list) {
    if (n - prev > 1)
      out.push('ellipsis')
    out.push(n)
    prev = n
  }
  return out
})
</script>

<template>
  <div class="rounded-md border">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th
              v-for="col in sortableColumns"
              :key="col.key"
              class="px-4 py-3"
              :class="col.align === 'right' ? 'text-right' : 'text-left'"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 font-medium uppercase hover:text-foreground"
                :class="sortKey === col.key ? 'text-foreground' : ''"
                @click="toggleSort(col.key)"
              >
                {{ col.label }}
                <Icon
                  v-if="sortKey === col.key"
                  :name="sortDir === 'asc' ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                  class="size-3.5"
                />
              </button>
            </th>
            <th class="px-4 py-3 text-left font-medium">
              <span class="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in pagedReservations"
            :key="r.id"
            class="border-t hover:bg-muted/30 transition-colors cursor-pointer"
            @click="emit('openDetail', r)"
          >
            <td class="px-4 py-3" @click.stop>
              <button
                type="button"
                class="text-left hover:underline"
                @click="emit('openGuest', r.guestId)"
              >
                <ReservationGuestCell :name="r.guestName" :email="r.guestEmail" />
              </button>
            </td>
            <td class="px-4 py-3">
              <NuxtLink :to="`/listings/${r.listingId}`" class="text-foreground hover:underline">
                {{ r.listingName }}
              </NuxtLink>
            </td>
            <td class="px-4 py-3">
              {{ fmtDate(r.checkIn) }}
            </td>
            <td class="px-4 py-3">
              {{ fmtDate(r.checkOut) }}
            </td>
            <td class="px-4 py-3">
              {{ r.nights }}
            </td>
            <td class="px-4 py-3">
              {{ r.guestCount }}
            </td>
            <td class="px-4 py-3">
              {{ r.channel }}
            </td>
            <td class="px-4 py-3 text-right tabular-nums">
              {{ fmtCurrency(r.totalPrice, r.currency) }}
            </td>
            <td class="px-4 py-3">
              <ReservationStatusBadge :status="r.status" />
            </td>
            <td class="px-4 py-3" @click.stop>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                    <Icon name="lucide:more-horizontal" class="size-4" />
                    <span class="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="emit('openDetail', r)">
                    <Icon name="lucide:eye" class="mr-2 size-4" />
                    View Reservation
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="emit('openGuest', r.guestId)">
                    <Icon name="lucide:user" class="mr-2 size-4" />
                    Open Guest
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="emit('copyId', r.id)">
                    <Icon name="lucide:copy" class="mr-2 size-4" />
                    Copy booking ID
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
          <tr v-if="pagedReservations.length === 0">
            <td colspan="10" class="px-4 py-12 text-center text-sm text-muted-foreground">
              <div class="flex flex-col items-center gap-2">
                <Icon name="lucide:calendar-x" class="size-8 opacity-50" />
                No reservations match your filters.
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination footer -->
    <div v-if="sortedReservations.length > 0" class="flex items-center justify-between gap-3 border-t px-4 py-3">
      <span class="text-xs text-muted-foreground">{{ rangeLabel }}</span>
      <div class="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          class="h-7 w-7 p-0"
          :disabled="page <= 1"
          @click="page--"
        >
          <Icon name="lucide:chevron-left" class="size-3.5" />
        </Button>
        <template v-for="(num, i) in pageNumbers" :key="i">
          <span v-if="num === 'ellipsis'" class="px-1 text-xs text-muted-foreground">…</span>
          <Button
            v-else
            variant="ghost"
            size="sm"
            class="min-w-8 h-7 px-1 text-xs"
            :class="page === num ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''"
            @click="page = num"
          >
            {{ num }}
          </Button>
        </template>
        <Button
          variant="outline"
          size="sm"
          class="h-7 w-7 p-0"
          :disabled="page >= totalPages"
          @click="page++"
        >
          <Icon name="lucide:chevron-right" class="size-3.5" />
        </Button>
      </div>
    </div>
  </div>
</template>
