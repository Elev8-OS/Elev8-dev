<script setup lang="ts">
import type { TimelineDay } from '~/components/listings/data/calendar-rooms'
import type { Booking, Listing, Unit } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import { otaIcon } from '~/components/channels/data/channels'
import { canAssignRoom, stayUnitIds, stayUnitNames } from '~/components/listings/data/calendar-rooms'
import { stayBarClasses } from '~/components/listings/data/stay-bar'
import ListingGuestSheet from '~/components/listings/ListingGuestSheet.vue'
import ListingRoomTimeline from '~/components/listings/ListingRoomTimeline.vue'
import ListingStayBar from '~/components/listings/ListingStayBar.vue'
import { bookingReservationStatus, mergedBookingsFor } from '~/components/operations-calendar/data/calendar-stays'
import { assignStayLanes, formatLocalDateKey, HALF_DAYS_PER_DAY, stayBarSpan } from '~/components/operations-calendar/data/operations-calendar'
import { reservationStatusLabels } from '~/components/reservations/data/reservations'
import ReservationDetailSheet from '~/components/reservations/ReservationDetailSheet.vue'
import ReservationStatusBadge from '~/components/reservations/ReservationStatusBadge.vue'
import { useReservationsModule } from '~/composables/useReservationsModule'

const props = defineProps<{ listing: Listing, activeUnit?: Unit | null }>()

const { reservations, assignRoom, unassignRoom, getUnitConflicts } = useReservationsModule()

// Both stay sources, so this tab agrees with the Operations Calendar and the Reservations page.
const bookings = computed<Booking[]>(() =>
  mergedBookingsFor(props.listing.id, props.listing.bookings, reservations.value),
)

/** Stays that hold the dates. Cancelled stays and inquiries draw no bar, as on the Operations Calendar. */
const stays = computed(() => bookings.value.filter(b => b.status !== 'cancelled' && b.status !== 'inquiry'))

/**
 * Room filter for a multi-room listing: every room, one room, or the stays
 * not in any room yet. Applies to both views, the guest list and the stats.
 * Starts on the room picked at the top of the listing.
 */
const UNASSIGNED_ROOM = '__unassigned__'
const roomFilter = ref<string>(props.activeUnit?.id ?? 'all')
watch(() => props.activeUnit?.id, (id) => {
  roomFilter.value = id ?? 'all'
})

function matchesRoom(b: Booking) {
  if (roomFilter.value === 'all')
    return true
  const units = stayUnitIds(b, reservations.value)
  return roomFilter.value === UNASSIGNED_ROOM ? units.length === 0 : units.includes(roomFilter.value)
}

const visibleStays = computed(() => stays.value.filter(matchesRoom))

const todayKey = formatLocalDateKey(new Date())
const monthStart = ref(firstOfMonth(new Date()))

function firstOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function shiftMonth(delta: number) {
  monthStart.value = new Date(monthStart.value.getFullYear(), monthStart.value.getMonth() + delta, 1)
}

function goToToday() {
  monthStart.value = firstOfMonth(new Date())
}

function goToMonthOf(dateKey: string) {
  const [y, m] = dateKey.split('-').map(Number)
  monthStart.value = new Date(y!, m! - 1, 1)
}

const monthLabel = computed(() =>
  monthStart.value.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
)
const monthFirstKey = computed(() => formatLocalDateKey(monthStart.value))
const monthLastKey = computed(() =>
  formatLocalDateKey(new Date(monthStart.value.getFullYear(), monthStart.value.getMonth() + 1, 0)),
)

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface CalendarDay {
  key: string
  day: number
  inMonth: boolean
  isToday: boolean
  isBlocked: boolean
}

interface WeekBar {
  booking: Booking
  lane: number
  startHalf: number
  endHalf: number
  continuesBefore: boolean
  continuesAfter: boolean
}

interface CalendarWeek {
  key: string
  days: CalendarDay[]
  bars: WeekBar[]
  laneCount: number
}

const blockedDateSet = computed(() => new Set(props.listing.blockedDates))

/** Monday-first weeks covering the visible month, each with its stay bars stacked in lanes. */
const weeks = computed<CalendarWeek[]>(() => {
  const first = monthStart.value
  const offset = (first.getDay() + 6) % 7
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const weekCount = Math.ceil((offset + last.getDate()) / 7)

  return Array.from({ length: weekCount }, (_, w) => {
    const days: CalendarDay[] = Array.from({ length: 7 }, (_, d) => {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7 + d)
      const key = formatLocalDateKey(date)
      return {
        key,
        day: date.getDate(),
        inMonth: date.getMonth() === first.getMonth(),
        isToday: key === todayKey,
        isBlocked: blockedDateSet.value.has(key),
      }
    })
    const dayKeys = days.map(d => d.key)
    const placed = visibleStays.value
      .map(booking => ({ booking, span: stayBarSpan(booking.checkIn, booking.checkOut, dayKeys) }))
      .filter((p): p is { booking: Booking, span: NonNullable<typeof p.span> } => p.span !== null)
    const { lanes, laneCount } = assignStayLanes(placed.map(p => p.span))
    return {
      key: dayKeys[0]!,
      days,
      bars: placed.map((p, i) => ({ booking: p.booking, lane: lanes[i]!, ...p.span })),
      laneCount,
    }
  })
})

/** Every stay touching the visible month, including inquiries and cancellations, by check-in. */
const monthBookings = computed(() =>
  bookings.value.filter(b => b.checkIn <= monthLastKey.value && b.checkOut > monthFirstKey.value && matchesRoom(b)),
)

function nightKeysInMonth(b: Booking) {
  const keys: string[] = []
  const [y, m, d] = b.checkIn.split('-').map(Number)
  const cursor = new Date(y!, m! - 1, d!)
  for (let key = formatLocalDateKey(cursor); key < b.checkOut; cursor.setDate(cursor.getDate() + 1), key = formatLocalDateKey(cursor)) {
    if (key >= monthFirstKey.value && key <= monthLastKey.value)
      keys.push(key)
  }
  return keys
}

/**
 * Rooms the listing has, for room-night occupancy. A single-unit listing (or a
 * multi-unit one with no rooms set up yet) counts as one.
 */
const roomCount = computed(() => Math.max(1, (props.listing.unitTypes ?? []).reduce((n, t) => n + t.units.length, 0)))
const isMultiRoom = computed(() => props.listing.unitType === 'multi' && roomCount.value > 1)

const monthStats = computed(() => {
  const daysInMonth = Number(monthLastKey.value.slice(8))
  const bookedNights = new Set<string>()
  const blockedNights = new Set<string>()
  let roomNights = 0
  let arrivals = 0
  let departures = 0
  for (const b of visibleStays.value) {
    const nights = nightKeysInMonth(b)
    const target = b.type === 'block' ? blockedNights : bookedNights
    for (const key of nights)
      target.add(key)
    if (b.type !== 'block') {
      // A stay with no recorded room still takes one.
      roomNights += nights.length * Math.max(1, stayUnitIds(b, reservations.value).length)
      if (b.checkIn >= monthFirstKey.value && b.checkIn <= monthLastKey.value)
        arrivals++
      if (b.checkOut >= monthFirstKey.value && b.checkOut <= monthLastKey.value)
        departures++
    }
  }
  for (const key of props.listing.blockedDates) {
    if (key >= monthFirstKey.value && key <= monthLastKey.value && !bookedNights.has(key))
      blockedNights.add(key)
  }
  // All rooms: room-nights over every room. One room (or the unassigned stays): nights over the month.
  const allRooms = isMultiRoom.value && roomFilter.value === 'all'
  const capacity = daysInMonth * (allRooms ? roomCount.value : 1)
  const booked = allRooms ? roomNights : bookedNights.size
  return {
    booked,
    capacity,
    occupancy: Math.min(100, Math.round((booked / capacity) * 100)),
    arrivals,
    departures,
    blockedNights: blockedNights.size,
  }
})

// --- Views ------------------------------------------------------------------
// A multi-room listing opens on the rooms timeline; the month grid stays one click away.
/** The filtered room's name for headings; null for all rooms. */
const roomFilterLabel = computed(() => {
  if (roomFilter.value === 'all')
    return null
  if (roomFilter.value === UNASSIGNED_ROOM)
    return 'not in a room'
  return (props.listing.unitTypes ?? []).flatMap(t => t.units).find(u => u.id === roomFilter.value)?.name ?? null
})

/** One string, so the formatter cannot put a space before the comma. */
const guestListHeading = computed(() => roomFilterLabel.value ? `Guests in ${monthLabel.value}, ${roomFilterLabel.value}` : `Guests in ${monthLabel.value}`)

const view = ref<'rooms' | 'month'>(isMultiRoom.value ? 'rooms' : 'month')
watch(isMultiRoom, (multi) => {
  if (!multi)
    view.value = 'month'
})

const timelineDays = computed<TimelineDay[]>(() => {
  const days = Number(monthLastKey.value.slice(8))
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(monthStart.value.getFullYear(), monthStart.value.getMonth(), i + 1)
    const key = formatLocalDateKey(date)
    return {
      key,
      day: i + 1,
      weekday: date.toLocaleDateString('en-GB', { weekday: 'narrow' }),
      isToday: key === todayKey,
      isBlocked: blockedDateSet.value.has(key),
    }
  })
})

/** The closest stay before or after the visible month, for the empty state. */
const nearestStay = computed(() => {
  const guests = stays.value.filter(b => b.type !== 'block')
  return guests.find(b => b.checkIn > monthLastKey.value)
    ?? [...guests].reverse().find(b => b.checkOut <= monthFirstKey.value)
    ?? null
})

const LEGEND = ['verified', 'unverified', 'checked_in', 'checked_out', 'owner_request', 'blocked'] as const

const detailReservation = ref<ReservationEntry | null>(null)
const detailOpen = ref(false)

// A listing booking has no reservation record, so it gets the small guest sheet instead.
const selectedBooking = ref<Booking | null>(null)
const sheetOpen = ref(false)

/** A Reservations-module stay opens the reservation detail sheet; a listing booking the guest sheet. */
function openGuest(booking: Booking) {
  const reservation = reservations.value.find(r => r.id === booking.id)
  if (reservation) {
    detailReservation.value = reservation
    detailOpen.value = true
    return
  }
  selectedBooking.value = booking
  sheetOpen.value = true
}

/**
 * Puts a stay in a room (or takes it out, `unitId` null), from a drag on the
 * rooms timeline or the guest list's room menu. Placement only: the stay's
 * price is untouched (`assignRoom` in useReservationsModule).
 */
function assignStayToRoom(bookingId: string, unitId: string | null) {
  const guest = bookings.value.find(b => b.id === bookingId)?.guestName ?? 'Guest'
  if (!unitId) {
    unassignRoom(bookingId)
    toast.success(`${guest} taken out of the room`)
    return
  }
  const result = assignRoom(bookingId, unitId)
  if (!result.success) {
    toast.error(result.error ?? 'Could not assign the room')
    return
  }
  const room = (props.listing.unitTypes ?? []).flatMap(t => t.units).find(u => u.id === unitId)?.name ?? 'the room'
  toast.success(`${guest} is in ${room}`)
}

/**
 * The rooms of a stay in a few words for its month-grid bar: "Master Suite",
 * "Master Suite +2", or "No room" when it has none yet.
 */
function roomLabelFor(booking: Booking): string {
  const names = stayUnitNames(booking, reservations.value, props.listing)
  if (!names.length)
    return 'No room'
  return names.length === 1 ? names[0]! : `${names[0]} +${names.length - 1}`
}

/** Who already holds a room on this stay's dates, for the room menu; null when free. */
function roomTakenBy(booking: Booking, unitId: string): string | null {
  const r = reservations.value.find(x => x.id === booking.id)
  if (!r)
    return null
  const live = getUnitConflicts(unitId, r.listingId, r.checkIn, r.checkOut, r.id)
    .filter(c => reservations.value.find(x => x.id === c.reservationId)?.status !== 'cancelled')
  return live[0]?.guestName ?? null
}

function openGuestProfile(guestId: string) {
  navigateTo(`/reservations/guests/${guestId}`)
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function formatShort(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function guestCount(b: Booking) {
  return (b.adults ?? 0) + (b.children ?? 0) + (b.infants ?? 0)
}

function barStyle(bar: WeekBar) {
  return {
    gridColumn: `${bar.startHalf + 1} / ${bar.endHalf + 1}`,
    gridRow: `${bar.lane + 2}`,
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card class="gap-1 p-4">
        <span class="text-xs text-muted-foreground">Occupancy</span>
        <span class="text-xl font-semibold">{{ monthStats.occupancy }}%</span>
        <span class="text-xs text-muted-foreground" data-testid="occupancy-detail">
          <template v-if="isMultiRoom && roomFilter === 'all'">{{ monthStats.booked }} of {{ monthStats.capacity }} room-nights</template>
          <template v-else>{{ monthStats.booked }} booked nights</template>
        </span>
      </Card>
      <Card class="gap-1 p-4">
        <span class="text-xs text-muted-foreground">Arrivals</span>
        <span class="text-xl font-semibold">{{ monthStats.arrivals }}</span>
        <span class="text-xs text-muted-foreground">check-ins this month</span>
      </Card>
      <Card class="gap-1 p-4">
        <span class="text-xs text-muted-foreground">Departures</span>
        <span class="text-xl font-semibold">{{ monthStats.departures }}</span>
        <span class="text-xs text-muted-foreground">check-outs this month</span>
      </Card>
      <Card class="gap-1 p-4">
        <span class="text-xs text-muted-foreground">Blocked</span>
        <span class="text-xl font-semibold">{{ monthStats.blockedNights }}</span>
        <span class="text-xs text-muted-foreground">nights unavailable</span>
      </Card>
    </div>

    <!-- One 4-column grid: the guest list lines up under the last summary card. -->
    <div class="grid gap-4 xl:grid-cols-4">
      <Card class="min-w-0 gap-4 p-4 sm:p-5 xl:col-span-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="text-base font-semibold" data-testid="calendar-month-label">
            {{ monthLabel }}
          </h3>
          <div class="flex items-center gap-1">
            <Select v-if="isMultiRoom" v-model="roomFilter">
              <SelectTrigger class="mr-2 h-8 w-44 text-xs" aria-label="Room" data-testid="calendar-room-filter">
                <Icon name="lucide:bed-double" class="size-3.5 text-muted-foreground" />
                <SelectValue placeholder="All rooms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All rooms
                </SelectItem>
                <SelectGroup v-for="type in listing.unitTypes ?? []" :key="type.id">
                  <SelectLabel class="text-xs">
                    {{ type.name }}
                  </SelectLabel>
                  <SelectItem v-for="unit in type.units" :key="unit.id" :value="unit.id">
                    {{ unit.name }}
                  </SelectItem>
                </SelectGroup>
                <SelectSeparator />
                <SelectItem :value="UNASSIGNED_ROOM">
                  Not assigned to a room
                </SelectItem>
              </SelectContent>
            </Select>
            <Tabs v-if="isMultiRoom" v-model="view" class="mr-2">
              <TabsList class="h-8">
                <TabsTrigger value="rooms" class="text-xs" data-testid="calendar-view-rooms">
                  <Icon name="lucide:bed-double" class="mr-1 size-3.5" />
                  Rooms
                </TabsTrigger>
                <TabsTrigger value="month" class="text-xs" data-testid="calendar-view-month">
                  <Icon name="lucide:calendar" class="mr-1 size-3.5" />
                  Month
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" @click="goToToday">
              Today
            </Button>
            <Button variant="ghost" size="icon" class="size-8" aria-label="Previous month" @click="shiftMonth(-1)">
              <Icon name="lucide:chevron-left" class="size-4" />
            </Button>
            <Button variant="ghost" size="icon" class="size-8" aria-label="Next month" @click="shiftMonth(1)">
              <Icon name="lucide:chevron-right" class="size-4" />
            </Button>
          </div>
        </div>

        <ListingRoomTimeline
          v-if="view === 'rooms'"
          :listing="listing"
          :stays="stays"
          :reservations="reservations"
          :days="timelineDays"
          :unit-id="roomFilter === 'all' ? null : roomFilter"
          @open="openGuest"
          @assign="assignStayToRoom"
        />

        <div v-else class="overflow-x-auto">
          <div class="min-w-[560px] overflow-hidden rounded-lg border">
            <div class="grid grid-cols-7 border-b bg-muted/40">
              <div
                v-for="weekday in WEEKDAYS"
                :key="weekday"
                class="px-2 py-1.5 text-xs font-medium text-muted-foreground"
              >
                {{ weekday }}
              </div>
            </div>

            <div
              v-for="week in weeks"
              :key="week.key"
              class="grid min-h-24 border-b last:border-b-0"
              :style="{
                gridTemplateColumns: `repeat(${7 * HALF_DAYS_PER_DAY}, minmax(0, 1fr))`,
                gridTemplateRows: `auto repeat(${week.laneCount}, auto) 1fr`,
              }"
              data-testid="calendar-week"
            >
              <div
                v-for="(day, index) in week.days"
                :key="day.key"
                class="relative border-r last:border-r-0"
                :class="[
                  !day.inMonth && 'bg-muted/30',
                  day.isBlocked && 'bg-muted',
                ]"
                :style="{
                  gridColumn: `${index * HALF_DAYS_PER_DAY + 1} / span ${HALF_DAYS_PER_DAY}`,
                  gridRow: '1 / -1',
                }"
                :data-blocked="day.isBlocked || undefined"
              />
              <div
                v-for="(day, index) in week.days"
                :key="`n-${day.key}`"
                class="flex items-center justify-between px-2 pt-1.5 pb-1"
                :style="{ gridColumn: `${index * HALF_DAYS_PER_DAY + 1} / span ${HALF_DAYS_PER_DAY}`, gridRow: '1' }"
              >
                <span
                  class="flex size-6 items-center justify-center rounded-full text-xs"
                  :class="[
                    day.isToday ? 'bg-primary font-semibold text-primary-foreground' : '',
                    !day.inMonth && !day.isToday ? 'text-muted-foreground/60' : '',
                  ]"
                >
                  {{ day.day }}
                </span>
                <Icon v-if="day.isBlocked" name="lucide:ban" class="size-3 text-muted-foreground" />
              </div>
              <ListingStayBar
                v-for="bar in week.bars"
                :key="`${bar.booking.id}-${week.key}`"
                :booking="bar.booking"
                :listing="listing"
                :continues-before="bar.continuesBefore"
                :continues-after="bar.continuesAfter"
                :grid-style="barStyle(bar)"
                :room-label="isMultiRoom ? roomLabelFor(bar.booking) : undefined"
                @open="openGuest"
              />
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div v-for="status in LEGEND" :key="status" class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span class="size-3 rounded-sm border" :class="stayBarClasses[status]" />
            {{ reservationStatusLabels[status] }}
          </div>
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span class="size-3 rounded-sm border bg-muted" />
            Blocked date
          </div>
        </div>
      </Card>

      <Card class="min-w-0 gap-0 self-start p-0">
        <div class="flex items-center justify-between border-b px-4 py-3">
          <h3 class="text-sm font-semibold">
            {{ guestListHeading }}
          </h3>
          <span class="text-xs text-muted-foreground">{{ monthBookings.length }}</span>
        </div>
        <div v-if="monthBookings.length" class="flex flex-col divide-y">
          <div v-for="booking in monthBookings" :key="booking.id" class="flex flex-col">
            <button
              type="button"
              class="flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              data-testid="calendar-guest-row"
              @click="openGuest(booking)"
            >
              <div
                class="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                :class="booking.type === 'block' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'"
              >
                <Icon v-if="booking.type === 'block'" name="lucide:ban" class="size-4" />
                <span v-else>{{ initials(booking.guestName) }}</span>
              </div>
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-sm font-medium">
                    {{ booking.type === 'block' ? (booking.blockReason ?? 'Blocked') : booking.guestName }}
                  </span>
                  <ReservationStatusBadge :status="bookingReservationStatus(booking)" class="shrink-0 text-[10px]" />
                </div>
                <span class="text-xs text-muted-foreground">
                  {{ formatShort(booking.checkIn) }} → {{ formatShort(booking.checkOut) }} · {{ booking.nights }} {{ booking.nights === 1 ? 'night' : 'nights' }}
                </span>
                <span v-if="isMultiRoom && stayUnitNames(booking, reservations, listing).length" class="flex items-center gap-1 truncate text-xs text-muted-foreground" data-testid="guest-row-rooms">
                  <Icon name="lucide:bed-double" class="size-3 shrink-0" />
                  {{ stayUnitNames(booking, reservations, listing).join(', ') }}
                </span>
                <div v-if="booking.type !== 'block'" class="flex items-center gap-3 text-xs text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <Icon :name="otaIcon(booking.source)" class="size-3" />
                    {{ booking.source }}
                  </span>
                  <span v-if="guestCount(booking) > 0" class="flex items-center gap-1">
                    <Icon name="lucide:users" class="size-3" />
                    {{ guestCount(booking) }}
                  </span>
                  <span v-if="booking.hasPet || (booking.pets ?? 0) > 0" class="flex items-center gap-1">
                    <Icon name="lucide:paw-print" class="size-3" />
                    Pet
                  </span>
                </div>
              </div>
            </button>
            <!-- Put the guest in a room: the keyboard-friendly twin of dragging on the timeline. -->
            <div v-if="isMultiRoom && canAssignRoom(booking, reservations)" class="-mt-1 px-4 pb-3 pl-16">
              <Popover>
                <PopoverTrigger as-child>
                  <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" :data-testid="`assign-room-${booking.id}`">
                    <Icon name="lucide:bed-double" class="size-3.5" />
                    {{ stayUnitIds(booking, reservations).length ? 'Change room' : 'Assign room' }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" class="w-64 p-1">
                  <div v-for="type in listing.unitTypes ?? []" :key="type.id">
                    <p class="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                      {{ type.name }}
                    </p>
                    <button
                      v-for="unit in type.units"
                      :key="unit.id"
                      type="button"
                      class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="Boolean(roomTakenBy(booking, unit.id))"
                      :data-testid="`assign-room-option-${booking.id}-${unit.id}`"
                      @click="assignStayToRoom(booking.id, unit.id)"
                    >
                      <span class="flex items-center gap-1.5 truncate">
                        <Icon v-if="stayUnitIds(booking, reservations).includes(unit.id)" name="lucide:check" class="size-3.5 text-primary" />
                        {{ unit.name }}
                      </span>
                      <span v-if="roomTakenBy(booking, unit.id)" class="truncate text-xs text-muted-foreground">{{ roomTakenBy(booking, unit.id) }}</span>
                    </button>
                  </div>
                  <button
                    v-if="stayUnitIds(booking, reservations).length"
                    type="button"
                    class="mt-1 flex w-full items-center gap-1.5 rounded-md border-t px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
                    @click="assignStayToRoom(booking.id, null)"
                  >
                    <Icon name="lucide:x" class="size-3.5" />
                    Take out of the room
                  </button>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <div v-else class="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <Icon name="lucide:calendar-x" class="size-8 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">
            No guests this month.
          </p>
          <Button
            v-if="nearestStay"
            variant="outline"
            size="sm"
            @click="goToMonthOf(nearestStay.checkIn)"
          >
            Go to {{ nearestStay.guestName }}'s stay
          </Button>
        </div>
      </Card>
    </div>

    <ClientOnly>
      <ReservationDetailSheet
        :reservation="detailReservation"
        :open="detailOpen"
        @update:open="detailOpen = $event"
        @open-guest="openGuestProfile"
      />
    </ClientOnly>

    <ListingGuestSheet
      v-model:open="sheetOpen"
      :booking="selectedBooking"
      :listing="listing"
    />
  </div>
</template>
