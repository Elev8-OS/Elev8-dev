<script setup lang="ts">
// Owner Portal — Reservation Calendar.
//
// Single-property month grid that mirrors the Figma "My Stays" design:
// property info + occupancy stats at the top, a toolbar with property /
// room-type selector + month / year navigation + "New owner reservation"
// button, and a 7-column by 6-row day grid where reservations render as
// absolutely-positioned bars overlaid on the cells. Guest stays are
// emerald, owner blocks are amber. Bars that cross a week boundary are
// split across weeks (the existing `buildReservationBars` helper).

import type { OwnerReservation, OwnerReservationBar, OwnerRoom, OwnerRoomType } from '~/components/owners/data/owner-reservations'
import { computed, ref } from 'vue'
import { listings } from '~/components/listings/data/listings'
import { mockOwnerLedgerEntries } from '~/components/owners/data/owner-ledger'
import {
  mockOwnerReservations,
  mockOwnerRooms,
  mockOwnerRoomTypes,
} from '~/components/owners/data/owner-reservations-seed'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import {
  buildReservationBars,
  buildReservationMonthGrid,
} from '~/lib/owner-reservations-layout'
import PortalOwnerReservationPopover from './PortalOwnerReservationPopover.vue'

const props = defineProps<{
  anchor?: Date
  reservations?: OwnerReservation[]
  /** When provided, the calendar is pinned to a single listing. */
  listingId?: string
}>()

const emit = defineEmits<{
  'update:anchor': [value: Date]
  'update:listingId': [value: string]
  'createOwnerReservation': [value: { checkIn: string, checkOut: string, listingId?: string, roomTypeId?: string }]
  'editOwnerReservation': [value: OwnerReservation]
  'removeOwnerReservation': [value: OwnerReservation]
}>()

const anchor = computed({
  get: () => props.anchor ?? new Date(),
  set: value => emit('update:anchor', value),
})

const reservations = computed<OwnerReservation[]>(() => props.reservations ?? mockOwnerReservations)

const ownerListings = computed(() => {
  const ids = new Set<string>()
  for (const reservation of reservations.value)
    ids.add(reservation.listingId)
  return listings.value.filter((l): l is NonNullable<typeof l> => ids.has(l.id))
})

const selectedListingId = computed<string | null>({
  get: () => props.listingId ?? ownerListings.value[0]?.id ?? null,
  set: value => emit('update:listingId', value ?? ''),
})

const selectedListing = computed(() => {
  const id = selectedListingId.value
  if (!id)
    return null
  return listings.value.find(l => l.id === id) ?? null
})

const roomTypesForListing = computed<OwnerRoomType[]>(() => {
  const id = selectedListingId.value
  if (!id)
    return []
  return mockOwnerRoomTypes.filter(rt => rt.listingId === id)
})

const roomsForListing = computed<OwnerRoom[]>(() => {
  const id = selectedListingId.value
  if (!id)
    return []
  return mockOwnerRooms.filter(r => r.listingId === id)
})

const selectedRoomTypeId = ref<string | null>(null)
const selectedRoomId = ref<string | null>(null)

const selectedRoomType = computed(() => {
  const id = selectedRoomTypeId.value
  if (!id)
    return null
  return roomTypesForListing.value.find(rt => rt.id === id) ?? null
})

const selectedRoom = computed(() => {
  const id = selectedRoomId.value
  if (!id)
    return null
  return roomsForListing.value.find(r => r.id === id) ?? null
})

const roomDropdownLabel = computed(() => {
  const room = selectedRoom.value
  if (room) {
    const roomType = roomTypesForListing.value.find(rt => rt.id === room.roomTypeId)
    return `${roomType?.name ?? 'Room'} · ${room.label}`
  }
  const roomType = selectedRoomType.value
  if (roomType)
    return roomType.name
  return 'All rooms'
})

const monthGrid = computed(() => buildReservationMonthGrid(anchor.value))
const monthLabel = computed(() => anchor.value.toLocaleDateString('en-US', { month: 'long' }))
const yearLabel = computed(() => anchor.value.toLocaleDateString('en-US', { year: 'numeric' }))

interface PlacedBar extends OwnerReservationBar {
  startWeek: number
  endWeek: number
  startCellKey: string
  startOffsetPct: number
  remainingWidthPct: number
}

const CELL_ROW_HEIGHT_PX = 96
const BAR_TOP_OFFSET_PX = 36
const BAR_HEIGHT_PX = 24

const listingReservations = computed<OwnerReservation[]>(() => {
  const id = selectedListingId.value
  if (!id)
    return []
  return reservations.value.filter(r => r.listingId === id)
})

const listingBars = computed<PlacedBar[]>(() => {
  const id = selectedListingId.value
  if (!id)
    return []
  const totalCells = 42
  const cellWidthPct = 100 / totalCells
  const halfCellPct = cellWidthPct / 2

  return buildReservationBars(monthGrid.value, id, listingReservations.value).map((bar) => {
    // Airbnb-style calendar: a reservation's bar covers half of the
    // check-in day (the right half — guest arrives in the afternoon)
    // and half of the check-out day (the left half — guest departs in
    // the morning). The nights in between are full cells. When the bar
    // extends past the visible grid (wrapsForward / wrapsBackward), the
    // outer edge runs to the grid boundary instead of stopping at the
    // half-cell.
    // Number of cell-widths the bar spans: from the middle of the
    // start cell to the middle of the end cell = endDay - startDay
    // (e.g. Dec 15 → Dec 20 spans 5 cells = 19 - 14).
    const cellWidths = Math.max(0, bar.endDay - bar.startDay)
    const startOffsetPct = bar.wrapsBackward ? 0 : halfCellPct
    const endOffsetPct = bar.wrapsForward ? 0 : halfCellPct
    const remainingWidthPct = cellWidths * 100 + startOffsetPct + endOffsetPct
    // The bar is placed inside its starting cell as an absolute child.
    // Because the cell is `position: relative`, the bar is anchored to
    // the row of its starting cell automatically — no need to compute
    // y from the grid header height. The width is expressed as a
    // percentage of the cell width so the bar spans the right number
    // of columns regardless of the cell's actual pixel size.
    const startWeek = Math.floor(bar.startDay / 7)
    const startCell = monthGrid.value[bar.startDay]
    return {
      ...bar,
      startWeek,
      endWeek: Math.floor(bar.endDay / 7),
      startCellKey: startCell?.key ?? '',
      startOffsetPct,
      remainingWidthPct,
    }
  })
})

// Group bars by their starting cell so the template can render them as
// absolutely-positioned children of that cell. Bars never duplicate: a
// reservation that crosses a week boundary still renders as one bar,
// anchored to its starting cell.
const barsByCell = computed<Record<string, PlacedBar[]>>(() => {
  const map: Record<string, PlacedBar[]> = {}
  for (const bar of listingBars.value) {
    const bucket = map[bar.startCellKey] ?? []
    bucket.push(bar)
    map[bar.startCellKey] = bucket
  }
  return map
})

const stats = computed(() => {
  const id = selectedListingId.value
  if (!id)
    return { occupancy: 0, thisMonthNights: 0, upcomingCount: 0 }

  const monthStart = new Date(anchor.value.getFullYear(), anchor.value.getMonth(), 1)
  const monthEnd = new Date(anchor.value.getFullYear(), anchor.value.getMonth() + 1, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const occupiedDayKeys = new Set<string>()
  for (const reservation of listingReservations.value) {
    if (reservation.type !== 'guest')
      continue
    const start = new Date(`${reservation.checkIn}T00:00:00`)
    const endMs = new Date(`${reservation.checkOut}T00:00:00`).getTime()
    const oneDayMs = 24 * 60 * 60 * 1000
    for (let cursorMs = start.getTime(), cursor = new Date(cursorMs); cursorMs < endMs; cursorMs += oneDayMs, cursor = new Date(cursorMs)) {
      if (cursor.getMonth() === anchor.value.getMonth() && cursor.getFullYear() === anchor.value.getFullYear())
        occupiedDayKeys.add(toDayKey(cursor))
    }
  }

  const daysInMonth = monthEnd.getDate()
  const occupancy = daysInMonth > 0 ? Math.round((occupiedDayKeys.size / daysInMonth) * 100) : 0

  let upcomingCount = 0
  for (const reservation of listingReservations.value) {
    if (reservation.status === 'cancelled')
      continue
    const start = new Date(`${reservation.checkIn}T00:00:00`)
    if (start >= today)
      upcomingCount += 1
  }

  const ledger = mockOwnerLedgerEntries.find(entry =>
    entry.ownerId
    && entry.listingId === id
    && entry.period === `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
  )
  const thisMonthNights = ledger ? ledger.occupiedNights : occupiedDayKeys.size

  return {
    occupancy,
    thisMonthNights,
    upcomingCount,
  }
})

function toDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function shiftMonth(months: number) {
  const next = new Date(anchor.value)
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  anchor.value = next
}

function goToToday() {
  const next = new Date()
  next.setHours(0, 0, 0, 0)
  anchor.value = next
}

function setMonth(monthIndex: number) {
  const next = new Date(anchor.value)
  next.setDate(1)
  next.setMonth(monthIndex)
  anchor.value = next
}

function setYear(year: number) {
  const next = new Date(anchor.value)
  next.setDate(1)
  next.setFullYear(year)
  anchor.value = next
}

const selectedReservation = ref<OwnerReservation | null>(null)
const popoverOpen = ref(false)

function openBar(bar: PlacedBar) {
  const reservationId = bar.id.split('-').slice(0, -2).join('-')
  const found = reservations.value.find(r => r.id === reservationId)
  if (!found)
    return
  selectedReservation.value = found
  popoverOpen.value = true
}

function newOwnerReservation() {
  const listingId = selectedListingId.value ?? ownerListings.value[0]?.id
  const roomTypeId = listingId ? roomTypesForListing.value[0]?.id : undefined
  emit('createOwnerReservation', { checkIn: '', checkOut: '', listingId, roomTypeId })
}

function selectListing(listingId: string) {
  selectedListingId.value = listingId
  selectedRoomTypeId.value = null
  selectedRoomId.value = null
}

function selectRoomType(roomTypeId: string | null) {
  selectedRoomTypeId.value = roomTypeId
  selectedRoomId.value = null
}

function selectRoom(roomId: string | null) {
  selectedRoomId.value = roomId
}

const monthOptions = computed(() => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return months
})

const yearOptions = computed(() => {
  const baseYear = anchor.value.getFullYear()
  return [baseYear - 1, baseYear, baseYear + 1]
})

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function propertyTypeChip(listingId: string | null) {
  if (!listingId)
    return ''
  const listing = listings.value.find(l => l.id === listingId)
  if (!listing)
    return ''
  const bedroomCount = listing.unitTypes?.reduce((sum, ut) => sum + (ut.bedrooms ?? 0), 0) ?? 0
  return bedroomCount > 0 ? `Villa · ${bedroomCount} Bedrooms` : 'Villa'
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-6">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="space-y-1">
        <p class="text-base font-semibold">
          {{ selectedListing?.name ?? 'No property selected' }}
        </p>
        <p class="text-sm text-muted-foreground">
          {{ selectedListing?.location ?? '—' }}
        </p>
        <Badge
          v-if="selectedListingId"
          variant="outline"
          class="mt-2 rounded-full px-3 py-1 text-xs font-normal"
        >
          {{ propertyTypeChip(selectedListingId) }}
        </Badge>
      </div>

      <dl v-if="selectedListingId" class="flex items-stretch divide-x divide-border rounded-md border bg-card">
        <div class="flex flex-col gap-1 px-4 py-2">
          <dt class="text-xs font-medium text-muted-foreground">
            Occupancy
          </dt>
          <dd class="text-base font-semibold">
            {{ stats.occupancy }}%
          </dd>
        </div>
        <div class="flex flex-col gap-1 px-4 py-2">
          <dt class="text-xs font-medium text-muted-foreground">
            This month
          </dt>
          <dd class="text-base font-semibold">
            {{ stats.thisMonthNights }} nights
          </dd>
        </div>
        <div class="flex flex-col gap-1 px-4 py-2">
          <dt class="text-xs font-medium text-muted-foreground">
            Upcoming
          </dt>
          <dd class="text-base font-semibold">
            {{ stats.upcomingCount }} bookings
          </dd>
        </div>
      </dl>
    </header>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            class="min-w-56 justify-between font-normal"
            :disabled="ownerListings.length === 0"
          >
            <span class="truncate">
              {{ roomDropdownLabel }}
            </span>
            <Icon name="lucide:chevron-down" class="size-4 shrink-0 opacity-60" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="min-w-56">
          <DropdownMenuLabel>Property</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            :model-value="selectedListingId ?? ''"
            @update:model-value="(value: string) => selectListing(value)"
          >
            <DropdownMenuRadioItem
              v-for="listing in ownerListings"
              :key="listing.id"
              :value="listing.id"
            >
              {{ listing.name }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator v-if="roomTypesForListing.length > 0" />
          <template v-if="roomTypesForListing.length > 0">
            <DropdownMenuLabel>Room type</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              :model-value="selectedRoomTypeId ?? ''"
              @update:model-value="(value: string) => selectRoomType(value || null)"
            >
              <DropdownMenuRadioItem value="">
                All rooms
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                v-for="roomType in roomTypesForListing"
                :key="roomType.id"
                :value="roomType.id"
              >
                {{ roomType.name }}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </template>
          <template v-if="roomsForListing.length > 0">
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Room</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              :model-value="selectedRoomId ?? ''"
              @update:model-value="(value: string) => selectRoom(value || null)"
            >
              <DropdownMenuRadioItem value="">
                Any
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem
                v-for="room in roomsForListing"
                :key="room.id"
                :value="room.id"
              >
                {{ room.label }}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>

      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          @click="shiftMonth(-1)"
        >
          <Icon name="lucide:chevron-left" class="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next month"
          @click="shiftMonth(1)"
        >
          <Icon name="lucide:chevron-right" class="size-4" aria-hidden="true" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="font-medium">
              {{ monthLabel }}
              <Icon name="lucide:chevron-down" class="ml-1 size-4 opacity-60" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuRadioGroup
              :model-value="String(anchor.getMonth())"
              @update:model-value="(value: string) => setMonth(Number(value))"
            >
              <DropdownMenuRadioItem
                v-for="(label, index) in monthOptions"
                :key="label"
                :value="String(index)"
              >
                {{ label }}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="font-medium">
              {{ yearLabel }}
              <Icon name="lucide:chevron-down" class="ml-1 size-4 opacity-60" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuRadioGroup
              :model-value="yearLabel"
              @update:model-value="(value: string) => setYear(Number(value))"
            >
              <DropdownMenuRadioItem
                v-for="year in yearOptions"
                :key="year"
                :value="String(year)"
              >
                {{ year }}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" @click="goToToday">
          Today
        </Button>
      </div>

      <Button
        class="rounded-full bg-emerald-100 px-4 text-emerald-900 hover:bg-emerald-200"
        @click="newOwnerReservation"
      >
        <Icon name="lucide:plus" class="mr-1.5 size-4" aria-hidden="true" />
        New owner reservation
      </Button>
    </div>

    <div class="min-h-0 flex-1 overflow-auto rounded-md border bg-card">
      <div role="grid" class="relative grid grid-cols-7">
        <div
          v-for="weekday in WEEKDAY_LABELS"
          :key="weekday"
          class="sticky top-0 z-20 border-b border-r bg-card px-3 py-2 text-xs font-medium text-muted-foreground"
        >
          {{ weekday }}
        </div>
        <div
          v-for="cell in monthGrid"
          :key="cell.key"
          class="relative border-r border-b p-2"
          :class="[
            cell.inMonth ? '' : 'bg-muted/30 text-muted-foreground/60',
            cell.isToday ? 'bg-primary/5' : '',
          ]"
          :style="{ minHeight: `${CELL_ROW_HEIGHT_PX}px` }"
        >
          <span class="relative z-10 text-sm font-medium">
            {{ cell.date.getDate() }}
          </span>
          <!-- Reservation bars that START in this cell are absolutely
               positioned inside the cell, so they automatically align
               with the row of their starting date and stay within the
               cell's column bounds. Each bar extends rightward by its
               own pixel width into adjacent cells. -->
          <div
            v-for="bar in barsByCell[cell.key] ?? []"
            :key="bar.id"
            class="pointer-events-auto absolute z-10"
            :style="{
              top: `${BAR_TOP_OFFSET_PX}px`,
              left: `${bar.startOffsetPct}%`,
              width: `${bar.remainingWidthPct}%`,
              height: `${BAR_HEIGHT_PX}px`,
            }"
          >
            <button
              type="button"
              class="flex h-full w-full items-center gap-1.5 overflow-hidden rounded px-2 text-[11px] font-medium"
              :class="bar.type === 'guest'
                ? (bar.status === 'cancelled' ? 'bg-emerald-900/40 text-white line-through' : 'bg-emerald-800 text-white')
                : 'bg-amber-400 text-amber-950'"
              :style="{
                clipPath: bar.wrapsBackward && bar.wrapsForward
                  ? 'polygon(6px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 6px 100%, 0 calc(100% - 10px), 0 10px)'
                  : bar.wrapsBackward
                    ? 'polygon(6px 0, 100% 0, 100% 100%, 6px 100%, 0 calc(100% - 10px), 0 10px)'
                    : 'polygon(0 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 0 100%, 0 10px)',
              }"
              :aria-label="bar.type === 'guest' ? `Guest stay for ${bar.guestName}` : 'Owner block'"
              @click="openBar(bar)"
            >
              <Icon
                v-if="bar.type === 'owner_block'"
                name="lucide:circle-x"
                class="size-3 shrink-0"
                aria-hidden="true"
              />
              <span
                v-if="bar.type === 'guest' && bar.channel"
                class="flex size-4 shrink-0 items-center justify-center rounded-full bg-white/90 text-[9px] font-bold text-emerald-900"
              >
                {{ bar.channel.charAt(0).toUpperCase() }}
              </span>
              <span class="truncate">
                {{ bar.type === 'guest' ? bar.guestName : (bar.note || 'Owner stay') }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <PortalOwnerReservationPopover
      v-model:open="popoverOpen"
      :reservation="selectedReservation"
      @edit="(value) => emit('editOwnerReservation', value)"
      @remove="(value) => emit('removeOwnerReservation', value)"
    />
  </div>
</template>
