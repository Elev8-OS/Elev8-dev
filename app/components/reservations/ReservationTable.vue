<script setup lang="ts">
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import CityTaxStatusChip from '~/components/city-tax/CityTaxStatusChip.vue'
import DamageProtectionStatusChip from '~/components/damage-protection/DamageProtectionStatusChip.vue'
import ReservationGuestCell from '~/components/reservations/ReservationGuestCell.vue'
import ReservationStatusBadge from '~/components/reservations/ReservationStatusBadge.vue'
import { useCityTax } from '~/composables/useCityTax'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{ reservations: ReservationEntry[] }>()

const emit = defineEmits<{
  openGuest: [id: string]
  openDetail: [reservation: ReservationEntry]
  copyId: [id: string]
  /** Owner stay requests are actioned straight from the row (R47 mirror). */
  approveOwnerStay: [reservation: ReservationEntry]
  rejectOwnerStay: [reservation: ReservationEntry]
}>()

const df = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

function fmtDate(iso: string): string {
  return df.format(new Date(`${iso}T00:00:00Z`))
}

function fmtCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

const cityTax = useCityTax()
const damageProtection = useDamageProtection()

function cityTaxRow(reservationId: string) {
  return cityTax.rows.value.find(row => row.reservation.id === reservationId) ?? null
}

// Extensions: a stay that was extended, and the direct booking that carries
// an OTA stay's added nights (looked up in the full store, not the filtered page).
const { reservations: allReservations } = useReservationsModule()

function extensionSummary(r: ReservationEntry) {
  const list = r.extensions ?? []
  if (!list.length)
    return null
  return {
    nights: list.reduce((sum, e) => sum + e.extraNights, 0),
    until: list.reduce((end, e) => e.newCheckOut > end ? e.newCheckOut : end, r.checkOut),
    viaLinked: list.some(e => e.linkedReservationId),
    unpaid: list.some(e => e.paymentStatus === 'pending'),
  }
}

/** Hover text for the extended-stay icon beside the guest's name. */
function extensionTitle(r: ReservationEntry): string {
  const summary = extensionSummary(r)
  if (!summary)
    return ''
  return `Extended +${summary.nights} night${summary.nights === 1 ? '' : 's'}, stays until ${fmtDate(summary.until)}${summary.unpaid ? '. Payment pending' : ''}`
}

function openParent(id: string) {
  const parent = allReservations.value.find(x => x.id === id)
  if (parent)
    emit('openDetail', parent)
}

// Sorting
type SortKey = 'guest' | 'listing' | 'checkIn' | 'checkOut' | 'nights' | 'guests' | 'channel' | 'total' | 'status' | 'cityTax' | 'protection'
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
  { key: 'cityTax', label: 'City tax' },
  { key: 'protection', label: 'Protection' },
]

// City tax and protection sort by urgency, not by label: ascending puts what
// needs action first. A stay with nothing to show ranks null and always sorts last.
const CITY_TAX_RANK: Record<string, number> = { overdue: 0, due: 1, channel_collects: 2, collected: 3, waived: 4 }
const PROTECTION_RANK: Record<string, number> = { decision_overdue: 0, failed: 1, decision_due: 2, refund_due: 3, awaiting_choice: 4, on_file: 5, settled: 6 }

function cityTaxRank(r: ReservationEntry): number | null {
  const row = cityTaxRow(r.id)
  if (!row)
    return null
  const key = row.assessment.status === 'due' && row.stage === 'overdue' ? 'overdue' : row.assessment.status
  return CITY_TAX_RANK[key] ?? null
}

function protectionRank(r: ReservationEntry): number | null {
  return PROTECTION_RANK[damageProtection.bucketFor(r.id)] ?? null
}

function sortValue(r: ReservationEntry, key: SortKey): string | number | null {
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
    case 'cityTax': return cityTaxRank(r)
    case 'protection': return protectionRank(r)
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

// Parent and child: a linked extension booking is drawn under the stay it
// extends, so the pair reads as one guest stay. It only nests when that stay
// is in the same (filtered) list; otherwise it stands alone with its badge.
const listedIds = computed(() => new Set(props.reservations.map(r => r.id)))

function isNested(r: ReservationEntry): boolean {
  return Boolean(r.extensionOf && listedIds.value.has(r.extensionOf))
}

const childrenByParent = computed(() => {
  const map = new Map<string, ReservationEntry[]>()
  for (const r of props.reservations) {
    if (isNested(r))
      map.set(r.extensionOf!, [...(map.get(r.extensionOf!) ?? []), r])
  }
  for (const list of map.values())
    list.sort((a, b) => a.checkIn.localeCompare(b.checkIn))
  return map
})

const sortedReservations = computed(() => {
  const list = props.reservations.filter(r => !isNested(r))
  if (!sortKey.value)
    return list
  const key = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    const av = sortValue(a, key)
    const bv = sortValue(b, key)
    // Empty cells stay at the bottom whichever way the column is sorted.
    if (av === null || bv === null)
      return av === bv ? 0 : av === null ? 1 : -1
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

// Paging counts stays; a stay's extension rows always come along with it.
const pagedRows = computed(() => pagedReservations.value.flatMap(r => [
  { r, child: false },
  ...(childrenByParent.value.get(r.id) ?? []).map(c => ({ r: c, child: true })),
]))

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
            v-for="{ r, child } in pagedRows"
            :key="r.id"
            class="hover:bg-muted/30 transition-colors cursor-pointer"
            :class="child ? 'border-t border-dashed bg-muted/20' : 'border-t'"
            :data-testid="child ? 'row-child' : undefined"
            :data-row-id="r.id"
            @click="emit('openDetail', r)"
          >
            <td v-if="child" class="py-2.5 pl-8 pr-4">
              <div class="flex items-center gap-2">
                <Icon name="lucide:corner-down-right" class="size-4 shrink-0 text-muted-foreground" />
                <div class="min-w-0">
                  <p class="text-sm font-medium">
                    Extension
                  </p>
                  <p class="truncate font-mono text-xs text-muted-foreground">
                    {{ r.id }}
                  </p>
                </div>
              </div>
            </td>
            <td v-else class="px-4 py-3" @click.stop>
              <button
                type="button"
                class="text-left hover:underline"
                @click="emit('openGuest', r.guestId)"
              >
                <ReservationGuestCell :name="r.guestName" :email="r.guestEmail">
                  <template v-if="extensionSummary(r)" #after-name>
                    <span
                      class="inline-flex shrink-0"
                      :class="extensionSummary(r)!.unpaid ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'"
                      :title="extensionTitle(r)"
                      :aria-label="extensionTitle(r)"
                      role="img"
                      data-testid="row-extended"
                    >
                      <Icon name="lucide:calendar-plus" class="size-3.5" />
                    </span>
                  </template>
                </ReservationGuestCell>
              </button>
            </td>
            <td class="px-4 py-3">
              <span v-if="child" class="text-muted-foreground">Same listing</span>
              <NuxtLink v-else :to="`/listings/${r.listingId}`" class="text-foreground hover:underline">
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
              <div class="flex flex-wrap items-center gap-1.5">
                <ReservationStatusBadge :status="r.status" />
                <button
                  v-if="r.extensionOf && !child"
                  type="button"
                  :title="`Extension of ${r.extensionOf}. Open it`"
                  data-testid="row-extension-of"
                  @click.stop="openParent(r.extensionOf)"
                >
                  <Badge variant="outline" class="gap-1 whitespace-nowrap border-muted-foreground/30 bg-muted text-muted-foreground hover:text-foreground">
                    <Icon name="lucide:link-2" class="size-3" />
                    Extension
                  </Badge>
                </button>
              </div>
            </td>
            <!-- City tax and damage protection each get their own column, so the
                 Status column only ever says where the booking stands. -->
            <td class="px-4 py-3" data-testid="cell-city-tax">
              <CityTaxStatusChip
                v-if="cityTaxRow(r.id)"
                class="whitespace-nowrap"
                :status="cityTaxRow(r.id)!.assessment.status"
                :stage="cityTaxRow(r.id)!.stage"
              />
            </td>
            <td class="px-4 py-3" data-testid="cell-protection">
              <DamageProtectionStatusChip
                class="whitespace-nowrap"
                :bucket="damageProtection.bucketFor(r.id)"
                :option="r.damageProtection?.option"
              />
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
                  <!-- Owner stay awaiting a decision — actionable in place. -->
                  <template v-if="r.status === 'owner_request'">
                    <DropdownMenuSeparator />
                    <DropdownMenuItem @click="emit('approveOwnerStay', r)">
                      <Icon name="lucide:calendar-check" class="mr-2 size-4" />
                      Approve owner stay
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="text-destructive focus:text-destructive"
                      @click="emit('rejectOwnerStay', r)"
                    >
                      <Icon name="lucide:calendar-x" class="mr-2 size-4" />
                      Reject owner stay…
                    </DropdownMenuItem>
                  </template>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
          <tr v-if="pagedReservations.length === 0">
            <td colspan="12" class="px-4 py-12 text-center text-sm text-muted-foreground">
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
