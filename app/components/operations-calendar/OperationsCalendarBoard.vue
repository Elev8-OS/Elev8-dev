<script setup lang="ts">
import type { CalendarEvent, CalendarListing, OperationsFilters } from '~/components/operations-calendar/data/operations-calendar'
import type { ReservationStatus } from '~/components/reservations/data/reservations'
import { toast } from 'vue-sonner'
import { stayUnitIds } from '~/components/listings/data/calendar-rooms'
import { bookingReservationStatus } from '~/components/operations-calendar/data/calendar-stays'
import { assignStayLanes, getCalendarListings, HALF_DAYS_PER_DAY, stayBarSpan } from '~/components/operations-calendar/data/operations-calendar'
import { reservationStatusClasses, reservationStatusLabels } from '~/components/reservations/data/reservations'
import { useReservationsModule } from '~/composables/useReservationsModule'

interface WeekDay {
  key: string
  label: string
  date: Date
}

const props = defineProps<{
  events: CalendarEvent[]
  eventsByDay: Map<string, CalendarEvent[]>
  eventsByDayAndListing: Map<string, CalendarEvent[]>
  eventsByListingAndDay: Map<string, Map<string, CalendarEvent[]>>
  weekDays: WeekDay[]
  filters: OperationsFilters
}>()

const emit = defineEmits<{
  'eventClick': [event: CalendarEvent]
  'moveEvent': [payload: { id: string, listingId: string, unitId: string | null, scheduledAt: string, originalEvent: CalendarEvent }]
  'create': [payload: { listingId: string, unitId: string | null, dayKey: string }]
  'update:filters': [filters: OperationsFilters]
  'clear': []
  'previousWeek': []
  'nextWeek': []
  'goToToday': []
}>()

// The stay bars read each listing's bookings, which must include the stays
// made on the Reservations page (`calendar-stays.ts`).
const { reservations } = useReservationsModule()
const allListings = computed(() => getCalendarListings(reservations.value))
const visibleListingIds = computed(() => new Set(props.eventsByListingAndDay.keys()))
const visibleListings = computed(() => allListings.value.filter(l => visibleListingIds.value.has(l.id)))

/** Listings are the top level (a listing is a property); rooms sit under multi-unit ones. */
const sortedListings = computed(() => [...visibleListings.value].sort((a, b) => a.name.localeCompare(b.name)))

interface ListingTreeNode {
  id: string
  /** `room` is a listing's row (the property); `unit` is one room of a multi-unit listing, under it. */
  type: 'room' | 'unit'
  label: string
  listing?: CalendarListing
  /** `unit` rows: the room. */
  unitId?: string
  /** `unit` rows: the room's room type. */
  sublabel?: string
  depth: number
  eventCount: number
}

/** A multi-unit listing's rooms are expanded under it unless collapsed. */
const roomsNodeId = (listingId: string) => `rooms-${listingId}`

/**
 * Which row a stay or event is drawn on. A listing with rooms: a room row shows
 * what is in that room; the listing's own row shows what has no room (stays
 * not assigned yet, common-area cleanings, tasks). A listing without rooms
 * shows everything on its one row.
 */
function onRow(listing: CalendarListing, rowUnitId: string | undefined, itemUnitIds: string[]): boolean {
  if (!listing.rooms.length)
    return true
  return rowUnitId ? itemUnitIds.includes(rowUnitId) : itemUnitIds.length === 0
}

function rowEvents(listing: CalendarListing, rowUnitId: string | undefined, dayKey: string): CalendarEvent[] {
  return (props.eventsByListingAndDay.get(listing.id)?.get(dayKey) ?? [])
    .filter(e => e.type !== 'guest_stay' && onRow(listing, rowUnitId, e.unitId ? [e.unitId] : []))
}

interface StayBar {
  id: string
  guestName: string
  /** "19 Sep to 24 Sep", for the tooltip. */
  dates: string
  /** The Reservations status, which picks the bar's colour. */
  status: ReservationStatus
  startHalf: number
  endHalf: number
  continuesBefore: boolean
  continuesAfter: boolean
  /** Which stacked lane the bar sits in; overlapping stays never share one. */
  lane: number
}

interface StayLayout {
  bars: StayBar[]
  /** At least 1, so a row with no stays keeps its (empty) bar lane. */
  laneCount: number
}

const collapsedNodes = ref<Set<string>>(new Set())

function isNodeExpanded(nodeId: string) {
  return !collapsedNodes.value.has(nodeId)
}

function toggleNode(nodeId: string) {
  const next = new Set(collapsedNodes.value)
  if (next.has(nodeId))
    next.delete(nodeId)
  else
    next.add(nodeId)
  collapsedNodes.value = next
}

function expandAll() {
  collapsedNodes.value = new Set()
}

function collapseAll() {
  const roomIds = visibleListings.value.filter(l => l.rooms.length).map(l => roomsNodeId(l.id))
  collapsedNodes.value = new Set(roomIds)
}

/** A listing's row, then (multi-unit, expanded) one row per room. */
function pushListingRows(tree: ListingTreeNode[], listing: CalendarListing, depth: number) {
  tree.push({ id: listing.id, type: 'room', label: listing.roomLabel, listing, depth, eventCount: weeklyEventCount(listing) })
  if (!listing.rooms.length || !isNodeExpanded(roomsNodeId(listing.id)))
    return
  for (const room of listing.rooms) {
    tree.push({ id: `${listing.id}:${room.id}`, type: 'unit', label: room.name, sublabel: room.typeName, listing, unitId: room.id, depth: depth + 1, eventCount: weeklyEventCount(listing, room.id) })
  }
}

const listingTree = computed<ListingTreeNode[]>(() => {
  const tree: ListingTreeNode[] = []
  for (const listing of sortedListings.value)
    pushListingRows(tree, listing, 0)
  return tree
})

function stayLayoutFor(listing: CalendarListing, rowUnitId?: string): StayLayout {
  const firstDay = props.weekDays[0]
  const lastDay = props.weekDays[props.weekDays.length - 1]
  if (!firstDay || !lastDay)
    return { bars: [], laneCount: 1 }
  const weekStart = firstDay.key
  const weekEnd = lastDay.key

  const dayKeys = props.weekDays.map(d => d.key)
  const bars = listing.bookings
    // A cancellation or an inquiry is nobody in the house, the same rule the
    // calendar's stay events already apply.
    .filter(booking => booking.status !== 'cancelled' && booking.status !== 'inquiry')
    .filter(booking => booking.checkIn <= weekEnd && booking.checkOut >= weekStart)
    .filter(booking => onRow(listing, rowUnitId, stayUnitIds(booking, reservations.value)))
    .flatMap((booking) => {
      const span = stayBarSpan(booking.checkIn, booking.checkOut, dayKeys)
      if (!span)
        return []
      return [{
        id: `stay-bar-${booking.id}`,
        guestName: booking.guestName,
        dates: `${shortDate(booking.checkIn)} to ${shortDate(booking.checkOut)}`,
        status: bookingReservationStatus(booking),
        ...span,
        lane: 0,
      }]
    })
  const { lanes, laneCount } = assignStayLanes(bars)
  return {
    bars: bars.map((bar, i) => ({ ...bar, lane: lanes[i] ?? 0 })),
    laneCount: Math.max(laneCount, 1),
  }
}

/** Worked out once per visible row rather than once per template read; keyed by tree node id. */
const stayLayouts = computed(() => new Map(
  listingTree.value
    .filter(n => n.listing && (n.type === 'room' || n.type === 'unit'))
    .map(n => [n.id, stayLayoutFor(n.listing!, n.unitId)]),
))

function layoutOf(node: ListingTreeNode): StayLayout {
  return stayLayouts.value.get(node.id) || { bars: [], laneCount: 1 }
}

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** The bar row is laid out in half days; the day cells below span two each. */
const halfColumns = computed(() => props.weekDays.length * HALF_DAYS_PER_DAY)

const todayKey = new Date().toISOString().slice(0, 10)

const weekRangeLabel = computed(() => {
  if (!props.weekDays?.length)
    return ''
  const first = props.weekDays[0]
  const last = props.weekDays[props.weekDays.length - 1]
  if (!first || !last)
    return ''
  const startDate = new Date(`${first.key}T00:00:00+08:00`)
  const endDate = new Date(`${last.key}T00:00:00+08:00`)
  const sameMonth = startDate.getMonth() === endDate.getMonth()
  const startStr = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const endStr = sameMonth
    ? endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${startStr} – ${endStr}, ${endDate.getFullYear()}`
})

const totalEventsLabel = computed(() => {
  const n = props.events?.length ?? 0
  if (!n)
    return 'No events'
  return `${n} event${n === 1 ? '' : 's'} this week`
})

function formatWeekRangeHeader(_days: typeof props.weekDays) {
  return weekRangeLabel.value
}

function weeklyEventCount(listing: CalendarListing, rowUnitId?: string) {
  const listingMap = props.eventsByListingAndDay.get(listing.id)
  if (!listingMap)
    return 0
  let count = 0
  for (const dayKey of listingMap.keys())
    count += rowEvents(listing, rowUnitId, dayKey).length
  return count
}

const draggedEvent = ref<CalendarEvent | null>(null)
const pendingMove = ref<{ event: CalendarEvent, listingId: string, unitId: string | null, dayKey: string } | null>(null)
const moveConfirmOpen = ref(false)

function isCleaningDraggable(event: CalendarEvent): boolean {
  if (event.type !== 'cleaning')
    return false
  if (event.status && event.status !== 'scheduled' && event.status !== 'confirmed')
    return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const scheduled = new Date(event.start)
  scheduled.setHours(0, 0, 0, 0)
  return scheduled.getTime() >= today.getTime()
}

function onDragStart(event: CalendarEvent) {
  if (!isCleaningDraggable(event))
    return
  draggedEvent.value = event
}

function onDrop(listingId: string, dayKey: string, unitId: string | null = null) {
  if (!draggedEvent.value)
    return
  if (dayKey < todayKey) {
    toast.error('Cannot reschedule cleaning to a past date')
    draggedEvent.value = null
    return
  }
  pendingMove.value = { event: draggedEvent.value, listingId, unitId, dayKey }
  moveConfirmOpen.value = true
  draggedEvent.value = null
}

function confirmMove() {
  if (!pendingMove.value)
    return
  const { event, listingId, unitId, dayKey } = pendingMove.value
  const time = event.start.slice(11, 16)
  const scheduledAt = `${dayKey}T${time}:00+08:00`
  emit('moveEvent', { id: event.id, listingId, unitId, scheduledAt, originalEvent: event })
  pendingMove.value = null
  moveConfirmOpen.value = false
}

function cancelMove() {
  pendingMove.value = null
  moveConfirmOpen.value = false
}

function onCellClick(listingId: string, dayKey: string, unitId: string | null = null) {
  emit('create', { listingId, unitId, dayKey })
}

/** "The R Villa Luwa · Master Suite" for the reschedule confirmation. */
function moveTargetLabel(move: { listingId: string, unitId: string | null }) {
  const listing = allListings.value.find(l => l.id === move.listingId)
  const room = move.unitId ? listing?.rooms.find(r => r.id === move.unitId)?.name : undefined
  return room ? `${listing?.name} · ${room}` : (listing?.name ?? '')
}
</script>

<template>
  <div class="rounded-2xl border bg-background shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <OperationsCalendarFilters
        :filters="props.filters"
        @update:filters="emit('update:filters', $event)"
        @clear="emit('clear')"
      />
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="emit('previousWeek')">
          <Icon name="lucide:chevron-left" class="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" @click="emit('goToToday')">
          Today
        </Button>
        <Button variant="outline" size="sm" @click="emit('nextWeek')">
          <Icon name="lucide:chevron-right" class="h-4 w-4" />
        </Button>
      </div>
    </div>
    <div class="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2 text-sm">
      <p class="font-semibold tracking-tight">
        {{ formatWeekRangeHeader(weekDays) }}
      </p>
      <p class="text-xs text-muted-foreground">
        {{ totalEventsLabel }}
      </p>
    </div>
    <!-- Week view -->
    <div class="max-h-[calc(100vh-var(--header-height)-220px)] overflow-auto">
      <div class="min-w-[1100px]">
        <!-- Header -->
        <div class="sticky top-0 z-20 flex border-b bg-background">
          <div class="sticky left-0 z-30 flex w-[240px] shrink-0 items-center justify-between border-r bg-background px-4 py-3">
            <span class="text-xs font-semibold text-muted-foreground">Listing</span>
            <div class="flex items-center gap-1">
              <button class="text-muted-foreground hover:text-foreground transition-colors" @click="expandAll">
                <Icon name="lucide:chevrons-down" class="size-3.5" />
              </button>
              <button class="text-muted-foreground hover:text-foreground transition-colors" @click="collapseAll">
                <Icon name="lucide:chevrons-up" class="size-3.5" />
              </button>
            </div>
          </div>
          <div class="grid flex-1 grid-cols-7">
            <div
              v-for="day in weekDays"
              :key="day.key"
              class="border-l bg-background px-4 py-3"
              :class="day.key === todayKey && 'bg-muted/30'"
            >
              <p class="text-xs font-semibold text-muted-foreground">
                {{ day.label.slice(0, 3) }}
              </p>
              <p class="mt-1 text-sm font-semibold">
                {{ day.key.slice(8, 10) }}
              </p>
              <p class="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {{ day.date.toLocaleString('en-US', { month: 'short' }) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Tree rows -->
        <div class="flex flex-col">
          <template v-for="node in listingTree" :key="node.id">
            <!-- Listing (property) row, or one of its rooms -->
            <div class="flex border-t">
              <div
                class="sticky left-0 z-10 w-[240px] shrink-0 border-r px-4 py-3"
                :class="node.type === 'unit' ? 'bg-background pl-10' : 'bg-muted/30'"
                :data-testid="node.type === 'unit' ? 'calendar-room-row' : 'calendar-listing-row'"
              >
                <div class="flex items-start gap-2">
                  <!-- A multi-unit listing's row folds its rooms. -->
                  <button
                    v-if="node.type === 'room' && node.listing?.rooms.length"
                    type="button"
                    class="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                    :aria-label="isNodeExpanded(roomsNodeId(node.listing.id)) ? `Hide rooms of ${node.label}` : `Show rooms of ${node.label}`"
                    :aria-expanded="isNodeExpanded(roomsNodeId(node.listing.id))"
                    @click="toggleNode(roomsNodeId(node.listing.id))"
                  >
                    <Icon :name="isNodeExpanded(roomsNodeId(node.listing.id)) ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="size-3.5" />
                  </button>
                  <Icon v-else-if="node.type === 'unit'" name="lucide:door-closed" class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div class="min-w-0">
                    <p class="truncate text-sm" :class="node.type === 'unit' ? 'font-medium' : 'font-semibold'">
                      {{ node.label }}
                    </p>
                    <p v-if="node.type === 'unit'" class="truncate text-xs text-muted-foreground">
                      {{ node.sublabel }}
                    </p>
                    <p v-else-if="node.listing?.rooms.length" class="truncate text-xs text-muted-foreground">
                      Whole property · {{ node.listing.rooms.length }} rooms
                    </p>
                    <Badge variant="outline" class="mt-1 text-[10px]">
                      {{ node.eventCount }} events
                    </Badge>
                  </div>
                </div>
              </div>

              <div
                class="relative grid flex-1"
                :style="{
                  gridTemplateColumns: `repeat(${halfColumns}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${layoutOf(node).laneCount}, auto) 1fr`,
                }"
              >
                <!-- Stay bars, in half days: check-in after 12:00, check-out before it.
                     A bar is only rounded, and only inset, at an end that is really
                     its check-in or check-out, so consecutive guests meet at midday
                     with a gap between them while a stay running off the week keeps
                     a flat edge. -->
                <template v-if="node.listing">
                  <div
                    v-for="stay in layoutOf(node).bars"
                    :key="stay.id"
                    data-testid="stay-bar"
                    :data-start-half="stay.startHalf"
                    :data-end-half="stay.endHalf"
                    :data-lane="stay.lane"
                    :data-status="stay.status"
                    class="mt-1 flex h-6 items-center overflow-hidden border px-2 text-xs font-semibold"
                    :class="[
                      reservationStatusClasses[stay.status],
                      stay.continuesBefore ? '' : 'ml-1 rounded-l-md',
                      stay.continuesAfter ? '' : 'mr-1 rounded-r-md',
                    ]"
                    :style="{ gridColumn: `${stay.startHalf + 1} / ${stay.endHalf + 1}`, gridRow: `${stay.lane + 1} / ${stay.lane + 2}` }"
                    :title="`${stay.guestName}, ${stay.dates}, ${reservationStatusLabels[stay.status]}`"
                  >
                    <span class="truncate">{{ stay.guestName }}</span>
                  </div>
                </template>

                <!-- Day cells -->
                <div
                  v-for="(day, index) in weekDays"
                  :key="`${node.id}-${day.key}`"
                  class="group relative cursor-pointer border-l bg-background/70 p-2 transition-colors hover:bg-muted/40"
                  :class="[node.type === 'unit' ? 'min-h-[88px]' : 'min-h-[132px]', day.key === todayKey && 'bg-muted/30']"
                  :style="{
                    gridColumn: `${index * HALF_DAYS_PER_DAY + 1} / ${(index + 1) * HALF_DAYS_PER_DAY + 1}`,
                    gridRow: `${layoutOf(node).laneCount + 1} / ${layoutOf(node).laneCount + 2}`,
                  }"
                  @dragover.prevent
                  @drop.prevent="onDrop(node.listing?.id ?? '', day.key, node.unitId ?? null)"
                  @click="onCellClick(node.listing?.id ?? '', day.key, node.unitId ?? null)"
                >
                  <Icon name="lucide:plus" class="absolute right-1.5 top-1.5 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  <div class="flex h-full flex-col gap-2">
                    <OperationsCalendarEventChip
                      v-for="event in node.listing ? rowEvents(node.listing, node.unitId, day.key) : []"
                      :key="`${day.key}-${event.id}`"
                      :event="event"
                      :draggable="isCleaningDraggable(event)"
                      @click="emit('eventClick', event)"
                      @dragstart="onDragStart(event)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Move / Reschedule confirmation dialog -->
    <Dialog v-model:open="moveConfirmOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule cleaning?</DialogTitle>
          <DialogDescription>
            Reschedule <strong>{{ pendingMove?.event.title }}</strong> to {{ pendingMove ? moveTargetLabel(pendingMove) : '' }} on {{ pendingMove?.dayKey }}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="cancelMove">
            Cancel
          </Button>
          <Button @click="confirmMove">
            Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
