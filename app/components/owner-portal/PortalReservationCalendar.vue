<script setup lang="ts">
// Owner Portal — Reservation Calendar.
//
// Single-property resource calendar: property info + occupancy stats at the
// top, a toolbar with the property selector + month / year navigation, then a
// linear month axis with the owner's own stays on the first row and each room
// on its own row below, grouped by room type. Guest stays are emerald, owner
// blocks amber. A bar is half-inset on its arrival and departure days, so a
// check-out and the next check-in on the same date read as a handover rather
// than an overlap.

import type { OwnerReservation } from '~/components/owners/data/owner-reservations'
import { computed, ref } from 'vue'
import { listings } from '~/components/listings/data/listings'
import {
  mockOwnerReservations,
  mockOwnerRooms,
  mockOwnerRoomTypes,
} from '~/components/owners/data/owner-reservations-seed'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import PortalOwnerReservationPopover from './PortalOwnerReservationPopover.vue'

const props = defineProps<{
  anchor?: Date
  reservations?: OwnerReservation[]
  /** When provided, the calendar is pinned to a single listing. */
  listingId?: string
  /** Owner whose self-booking quota is shown for the selected listing. */
  ownerId?: string | null
}>()

const emit = defineEmits<{
  'update:anchor': [value: Date]
  'update:listingId': [value: string]
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

const propertyDropdownLabel = computed(() =>
  selectedListing.value?.name ?? 'Select a property')

const monthLabel = computed(() => anchor.value.toLocaleDateString('en-US', { month: 'long' }))
const yearLabel = computed(() => String(anchor.value.getFullYear()))

/** Every reservation on the selected property, whatever room it is in. */
const listingReservations = computed<OwnerReservation[]>(() => {
  const id = selectedListingId.value
  if (!id)
    return []
  return reservations.value.filter(r => r.listingId === id)
})

/**
 * Days of the anchored month — one column each. A resource calendar needs a
 * linear date axis; the old 6-week wrap cannot carry per-room rows.
 */
const monthDays = computed(() => {
  const year = anchor.value.getFullYear()
  const month = anchor.value.getMonth()
  const total = new Date(year, month + 1, 0).getDate()
  const todayKey = new Date().toISOString().slice(0, 10)
  return Array.from({ length: total }, (_, index) => {
    const date = new Date(year, month, index + 1)
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
    return {
      key,
      day: index + 1,
      weekday: date.toLocaleDateString('en-GB', { weekday: 'narrow' }),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isToday: key === todayKey,
    }
  })
})

interface RoomRow {
  kind: 'group' | 'room'
  id: string
  label: string
  sublabel?: string
}

/** One row per room, grouped under its room type. */
const roomRows = computed<RoomRow[]>(() => {
  const id = selectedListingId.value
  if (!id)
    return []
  const rows: RoomRow[] = []
  for (const type of mockOwnerRoomTypes.filter(rt => rt.listingId === id)) {
    const rooms = mockOwnerRooms.filter(r => r.roomTypeId === type.id)
    if (rooms.length === 0)
      continue
    rows.push({ kind: 'group', id: type.id, label: type.name })
    for (const room of rooms)
      rows.push({ kind: 'room', id: room.id, label: room.label, sublabel: type.name })
  }
  return rows
})

/** A reservation placed on the date axis of the visible month. */
interface PlacedStay {
  id: string
  reservation: OwnerReservation
  /** 0-based column of the check-in day, clamped to the month. */
  startIndex: number
  /** Column of the check-out day, clamped to the month. */
  endIndex: number
  clippedStart: boolean
  clippedEnd: boolean
  /** Stacking line within the lane, for stays that overlap in the same row. */
  lane: number
}

function placeStay(reservation: OwnerReservation): PlacedStay | null {
  const days = monthDays.value
  if (days.length === 0)
    return null
  const first = days[0]!.key
  const last = days[days.length - 1]!.key
  // Skip anything entirely outside the month.
  if (reservation.checkOut < first || reservation.checkIn > last)
    return null
  const startIndex = days.findIndex(d => d.key === reservation.checkIn)
  const endIndex = days.findIndex(d => d.key === reservation.checkOut)
  return {
    id: reservation.id,
    reservation,
    startIndex: startIndex === -1 ? 0 : startIndex,
    endIndex: endIndex === -1 ? days.length - 1 : endIndex,
    clippedStart: startIndex === -1,
    clippedEnd: endIndex === -1,
    lane: 0,
  }
}

/**
 * Stack stays that overlap within one row. Room rows rarely need it — a room
 * cannot be double-booked — but the owner row holds every owner stay for the
 * property, and two of those can genuinely run at once.
 */
function assignLanes(stays: PlacedStay[]): PlacedStay[] {
  const lanes: Array<Array<{ start: number, end: number }>> = []
  return stays.map((stay) => {
    let lane = lanes.findIndex(spans =>
      spans.every(span => stay.endIndex <= span.start || stay.startIndex >= span.end))
    if (lane === -1) {
      lanes.push([])
      lane = lanes.length - 1
    }
    lanes[lane]!.push({ start: stay.startIndex, end: stay.endIndex })
    return { ...stay, lane }
  })
}

/** Stays for one row: the owner row takes owner blocks, room rows take their own. */
/**
 * Stays shown on a room's row: guest bookings for that room, owner stays
 * booked into that room, and owner stays with no room at all — those block the
 * whole property, so they belong on every room row rather than a lane of their
 * own.
 */
function staysForRow(row: RoomRow): PlacedStay[] {
  if (row.kind === 'group')
    return []
  const placed = listingReservations.value
    .filter(r => r.roomId
      ? r.roomId === row.id
      : r.type === 'owner_block')
    .map(placeStay)
    .filter((stay): stay is PlacedStay => stay !== null)
    .sort((a, b) => a.startIndex - b.startIndex
      || (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex))
  return assignLanes(placed)
}

/** Lane count for a row, so its height can grow to fit a stack. */
function laneCount(row: RoomRow): number {
  return staysForRow(row).reduce((deepest, stay) => Math.max(deepest, stay.lane + 1), 1)
}

/**
 * Geometry for a bar on a row: anchored at midday on the check-in column and
 * running to midday on the check-out column, so the arrival and departure days
 * are each half-covered. A clipped edge runs to the edge of the month instead.
 */
function barStyle(stay: PlacedStay) {
  const columns = monthDays.value.length
  const startPct = ((stay.startIndex + (stay.clippedStart ? 0 : 0.5)) / columns) * 100
  const endPct = ((stay.endIndex + (stay.clippedEnd ? 1 : 0.5)) / columns) * 100
  return { left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }
}

/**
 * Month stats, all on one basis: ROOM-NIGHTS. A five-room property selling six
 * nights in every room sold 30 room-nights, not 6 — and that is the figure the
 * statements are built from.
 *
 * Occupancy uses the same numerator, so the two can never disagree:
 *   room-nights sold / (rooms x days in month)
 */
const stats = computed(() => {
  const id = selectedListingId.value
  if (!id)
    return { occupancy: 0, roomNights: 0, upcomingCount: 0 }

  const year = anchor.value.getFullYear()
  const month = anchor.value.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const ONE_DAY_MS = 24 * 60 * 60 * 1000

  // Each guest reservation counts its own nights: one room occupied for one
  // night is one room-night, so concurrent stays in different rooms add up.
  let roomNights = 0
  for (const reservation of listingReservations.value) {
    if (reservation.type !== 'guest' || reservation.status === 'cancelled')
      continue
    const startMs = new Date(`${reservation.checkIn}T00:00:00`).getTime()
    const endMs = new Date(`${reservation.checkOut}T00:00:00`).getTime()
    for (let cursorMs = startMs; cursorMs < endMs; cursorMs += ONE_DAY_MS) {
      const night = new Date(cursorMs)
      if (night.getMonth() === month && night.getFullYear() === year)
        roomNights += 1
    }
  }

  const rooms = Math.max(1, mockOwnerRooms.filter(r => r.listingId === id).length)
  const capacity = rooms * daysInMonth
  const occupancy = capacity > 0 ? Math.round((roomNights / capacity) * 100) : 0

  let upcomingCount = 0
  for (const reservation of listingReservations.value) {
    if (reservation.status === 'cancelled')
      continue
    if (new Date(`${reservation.checkIn}T00:00:00`) >= today)
      upcomingCount += 1
  }

  return { occupancy, roomNights, upcomingCount }
})

/** Seasonal self-booking quota windows for the selected listing + owner. */
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

function openStay(stay: PlacedStay) {
  selectedReservation.value = stay.reservation
  popoverOpen.value = true
}

function selectListing(listingId: string) {
  selectedListingId.value = listingId
}

const monthOptions = computed(() => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return months
})

const yearOptions = computed(() => {
  const baseYear = anchor.value.getFullYear()
  return [baseYear - 1, baseYear, baseYear + 1]
})

/** Row height and the label gutter, matching the operations calendar. */
const ROW_HEIGHT_PX = 44
const LABEL_WIDTH_PX = 200
/** Vertical pitch of stacked stays inside one row. */
const LANE_PITCH_PX = 32
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-6">
    <header class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <!-- Left: which property -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            class="min-w-56 justify-between font-normal"
            :disabled="ownerListings.length === 0"
          >
            <span class="truncate">
              {{ propertyDropdownLabel }}
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
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Centre: which month -->
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Previous month" @click="shiftMonth(-1)">
          <Icon name="lucide:chevron-left" class="size-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Next month" @click="shiftMonth(1)">
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

      <!-- Right: how the month is performing -->
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
            Sold
          </dt>
          <dd class="text-base font-semibold">
            {{ stats.roomNights }} room-nights
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

    <div class="min-h-0 flex-1 overflow-auto rounded-md border bg-card">
      <div class="min-w-[900px]">
        <!-- Date axis -->
        <div class="sticky top-0 z-20 flex border-b bg-card">
          <div
            class="sticky left-0 z-30 shrink-0 border-r bg-card px-3 py-2 text-xs font-medium text-muted-foreground"
            :style="{ width: `${LABEL_WIDTH_PX}px` }"
          >
            Room
          </div>
          <div class="flex flex-1">
            <div
              v-for="day in monthDays"
              :key="day.key"
              class="flex flex-1 flex-col items-center justify-center border-r py-1 last:border-r-0"
              :class="[
                day.isWeekend ? 'bg-muted/40' : '',
                day.isToday ? 'bg-primary/10' : '',
              ]"
            >
              <span class="text-[10px] uppercase text-muted-foreground">{{ day.weekday }}</span>
              <span class="text-xs font-medium tabular-nums" :class="day.isToday ? 'text-primary' : ''">
                {{ day.day }}
              </span>
            </div>
          </div>
        </div>

        <!-- One row per room, grouped by room type -->
        <div v-if="!roomRows.length" class="p-8 text-center text-sm text-muted-foreground">
          Select a property to see its calendar.
        </div>

        <template v-for="row in roomRows" :key="row.id">
          <!-- Room-type header -->
          <div v-if="row.kind === 'group'" class="flex border-t bg-muted/50">
            <div
              class="sticky left-0 z-10 shrink-0 bg-muted/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              :style="{ width: `${LABEL_WIDTH_PX}px` }"
            >
              {{ row.label }}
            </div>
            <div class="flex-1" />
          </div>

          <!-- Owner row / room row -->
          <div v-else class="flex border-t">
            <div
              class="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-card px-3"
              :style="{ width: `${LABEL_WIDTH_PX}px`, minHeight: `${Math.max(ROW_HEIGHT_PX, 12 + laneCount(row) * LANE_PITCH_PX)}px` }"
            >
              <Icon
                name="lucide:bed-double"
                class="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span class="truncate text-sm">
                {{ row.label }}
              </span>
            </div>

            <!-- Date lane -->
            <div
              class="relative flex-1"
              :style="{ minHeight: `${Math.max(ROW_HEIGHT_PX, 12 + laneCount(row) * LANE_PITCH_PX)}px` }"
              role="row"
              :aria-label="row.label"
            >
              <!-- Day gridlines -->
              <div class="absolute inset-0 flex">
                <div
                  v-for="day in monthDays"
                  :key="day.key"
                  class="flex-1 border-r last:border-r-0"
                  :class="[
                    day.isWeekend ? 'bg-muted/30' : '',
                    day.isToday ? 'bg-primary/5' : '',
                  ]"
                />
              </div>

              <!-- Stays -->
              <div
                v-for="stay in staysForRow(row)"
                :key="stay.id"
                class="absolute z-10 px-px"
                :style="{ ...barStyle(stay), top: `${6 + stay.lane * LANE_PITCH_PX}px` }"
              >
                <button
                  type="button"
                  class="flex h-7 w-full items-center gap-1.5 overflow-hidden rounded px-2 text-[11px] font-medium"
                  :class="stay.reservation.type === 'guest'
                    ? (stay.reservation.status === 'cancelled' ? 'bg-emerald-900/40 text-white line-through' : 'bg-emerald-800 text-white')
                    : stay.reservation.ownerStayStatus === 'pending_approval'
                      ? 'bg-amber-200 text-amber-950'
                      : stay.reservation.ownerStayStatus === 'rejected'
                        ? 'bg-zinc-300 text-zinc-600 line-through'
                        : 'bg-amber-400 text-amber-950'"
                  :aria-label="stay.reservation.type === 'guest'
                    ? `Guest stay for ${stay.reservation.guestName}`
                    : 'Owner block'"
                  @click="openStay(stay)"
                >
                  <span
                    v-if="stay.reservation.type === 'guest' && stay.reservation.channel"
                    class="flex size-4 shrink-0 items-center justify-center rounded-full bg-white/90 text-[9px] font-bold text-emerald-900"
                  >
                    {{ stay.reservation.channel.charAt(0).toUpperCase() }}
                  </span>
                  <Icon
                    v-else-if="stay.reservation.type === 'owner_block'"
                    name="lucide:user-round"
                    class="size-3 shrink-0"
                    aria-hidden="true"
                  />
                  <span class="truncate">
                    {{ stay.reservation.type === 'guest' ? stay.reservation.guestName : (stay.reservation.note || 'Owner stay') }}
                    <span v-if="stay.reservation.ownerStayStatus === 'pending_approval'" class="ml-1 font-bold">
                      · Pending
                    </span>
                    <span v-else-if="stay.reservation.ownerStayStatus === 'rejected'" class="ml-1">
                      · Rejected
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </template>
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
