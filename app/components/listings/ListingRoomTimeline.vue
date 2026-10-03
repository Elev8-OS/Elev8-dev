<script setup lang="ts">
import type { TimelineDay } from '~/components/listings/data/calendar-rooms'
import type { Booking, Listing } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { canAssignRoom, stayUnitIds } from '~/components/listings/data/calendar-rooms'
import ListingStayBar from '~/components/listings/ListingStayBar.vue'
import { assignStayLanes, HALF_DAYS_PER_DAY, stayBarSpan } from '~/components/operations-calendar/data/operations-calendar'

/**
 * A multi-room listing's month as a timeline: one row per room, grouped by
 * room type, the days across. A stay sits on every room it books, so a family
 * taking three rooms shows on three rows. Stays with no recorded room (listing
 * bookings, reservations without room lines) go in "Not assigned to a room",
 * so nothing drops off the calendar.
 *
 * Bars use the same half-day rule as the month grid (`stayBarSpan`): they start
 * at midday of check-in and end at midday of check-out.
 */
const props = defineProps<{
  listing: Listing
  stays: Booking[]
  reservations: ReservationEntry[]
  days: TimelineDay[]
  /** Show one room only, or `'__unassigned__'` for only the stays not in a room (the tab's room filter). */
  unitId?: string | null
}>()
const emit = defineEmits<{
  open: [booking: Booking]
  /** A stay dropped on a room, or on "Not assigned to a room" (`unitId` null). */
  assign: [bookingId: string, unitId: string | null]
}>()

const STAY_DRAG_TYPE = 'application/x-elev8-stay'
const UNASSIGNED = '__unassigned__'

// Drag a stay without priced room lines onto a room (`canAssignRoom`); rows light up while it moves.
const dragging = ref<Booking | null>(null)
const dropTarget = ref<string | null>(null)

function isDraggable(booking: Booking) {
  return canAssignRoom(booking, props.reservations)
}

function onDragOver(event: DragEvent, rowId: string) {
  if (!dragging.value)
    return
  event.preventDefault()
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'move'
  dropTarget.value = rowId
}

function onDrop(event: DragEvent, rowId: string) {
  event.preventDefault()
  const id = event.dataTransfer?.getData(STAY_DRAG_TYPE) || dragging.value?.id
  dropTarget.value = null
  dragging.value = null
  if (id)
    emit('assign', id, rowId === UNASSIGNED ? null : rowId)
}

function endDrag() {
  dragging.value = null
  dropTarget.value = null
}

const dayKeys = computed(() => props.days.map(d => d.key))
const columns = computed(() => `minmax(9rem, 11rem) repeat(${props.days.length * HALF_DAYS_PER_DAY}, minmax(0.875rem, 1fr))`)

interface RoomRow {
  id: string
  name: string
  bars: Array<{ booking: Booking, lane: number, startHalf: number, endHalf: number, continuesBefore: boolean, continuesAfter: boolean }>
  laneCount: number
}

function rowFor(id: string, name: string, stays: Booking[]): RoomRow {
  const placed = stays
    .map(booking => ({ booking, span: stayBarSpan(booking.checkIn, booking.checkOut, dayKeys.value) }))
    .filter((p): p is { booking: Booking, span: NonNullable<typeof p.span> } => p.span !== null)
  const { lanes, laneCount } = assignStayLanes(placed.map(p => p.span))
  return { id, name, bars: placed.map((p, i) => ({ booking: p.booking, lane: lanes[i]!, ...p.span })), laneCount: Math.max(1, laneCount) }
}

const unitsByStay = computed(() => new Map(props.stays.map(s => [s.id, stayUnitIds(s, props.reservations)])))

const groups = computed(() => (props.listing.unitTypes ?? [])
  .map(type => ({
    id: type.id,
    name: type.name,
    rows: type.units
      .filter(unit => !props.unitId || unit.id === props.unitId)
      .map(unit => rowFor(unit.id, unit.name, props.stays.filter(s => unitsByStay.value.get(s.id)?.includes(unit.id)))),
  }))
  .filter(group => group.rows.length > 0))

const unassigned = computed(() => {
  const row = rowFor(UNASSIGNED, 'Not assigned to a room', props.stays.filter(s => !unitsByStay.value.get(s.id)?.length))
  // Hidden when filtered to one room; shown while dragging, so a placed stay can be taken out again.
  if (dragging.value)
    return row
  const showing = !props.unitId || props.unitId === UNASSIGNED
  return showing && row.bars.length ? row : null
})

function barStyle(bar: RoomRow['bars'][number]) {
  return { gridColumn: `${bar.startHalf + 2} / ${bar.endHalf + 2}`, gridRow: `${bar.lane + 1}` }
}

function dayStyle(index: number) {
  return { gridColumn: `${index * HALF_DAYS_PER_DAY + 2} / span ${HALF_DAYS_PER_DAY}`, gridRow: '1 / -1' }
}
</script>

<template>
  <div class="overflow-x-auto rounded-lg border" data-testid="room-timeline">
    <div :style="{ minWidth: `${11 + days.length * 2.25}rem` }">
      <!-- Day header -->
      <div class="grid border-b bg-muted/40" :style="{ gridTemplateColumns: columns }">
        <div class="sticky left-0 z-20 border-r bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
          Room
        </div>
        <div
          v-for="(day, index) in days"
          :key="day.key"
          class="flex flex-col items-center py-1 text-[10px] leading-tight text-muted-foreground"
          :style="{ gridColumn: `${index * HALF_DAYS_PER_DAY + 2} / span ${HALF_DAYS_PER_DAY}` }"
        >
          <span>{{ day.weekday }}</span>
          <span
            class="mt-0.5 flex size-5 items-center justify-center rounded-full text-xs"
            :class="day.isToday ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground'"
          >{{ day.day }}</span>
        </div>
      </div>

      <template v-for="group in groups" :key="group.id">
        <div class="sticky left-0 border-b bg-muted/20 px-3 py-1.5 text-xs font-semibold" data-testid="room-group">
          {{ group.name }}
        </div>
        <div
          v-for="row in group.rows"
          :key="row.id"
          class="grid min-h-9 border-b transition-colors last:border-b-0"
          :class="dropTarget === row.id && 'bg-primary/10 ring-2 ring-inset ring-primary'"
          :style="{ gridTemplateColumns: columns, gridTemplateRows: `repeat(${row.laneCount}, minmax(2.25rem, auto))` }"
          data-testid="room-row"
          :data-room="row.id"
          @dragover="onDragOver($event, row.id)"
          @dragleave="dropTarget === row.id && (dropTarget = null)"
          @drop="onDrop($event, row.id)"
        >
          <div
            class="sticky left-0 z-20 flex items-center border-r bg-background px-3 text-sm"
            :style="{ gridColumn: '1', gridRow: '1 / -1' }"
          >
            <span class="truncate">{{ row.name }}</span>
          </div>
          <div
            v-for="(day, index) in days"
            :key="day.key"
            class="border-r border-border/50 last:border-r-0"
            :class="[day.isBlocked && 'bg-muted', day.isToday && 'bg-primary/5']"
            :style="dayStyle(index)"
          />
          <ListingStayBar
            v-for="bar in row.bars"
            :key="`${bar.booking.id}-${row.id}`"
            :booking="bar.booking"
            :listing="listing"
            :continues-before="bar.continuesBefore"
            :continues-after="bar.continuesAfter"
            :grid-style="barStyle(bar)"
            :draggable="isDraggable(bar.booking)"
            @open="emit('open', $event)"
            @drag-start="dragging = $event"
            @drag-end="endDrag"
          />
        </div>
      </template>

      <div
        v-if="unassigned"
        class="grid min-h-9 border-t-2 border-dashed transition-colors"
        :class="dropTarget === unassigned.id && 'bg-primary/10 ring-2 ring-inset ring-primary'"
        :style="{ gridTemplateColumns: columns, gridTemplateRows: `repeat(${unassigned.laneCount}, minmax(2.25rem, auto))` }"
        data-testid="room-row"
        :data-room="unassigned.id"
        @dragover="onDragOver($event, unassigned.id)"
        @dragleave="dropTarget === unassigned.id && (dropTarget = null)"
        @drop="onDrop($event, unassigned.id)"
      >
        <div
          class="sticky left-0 z-20 flex items-center gap-1.5 border-r bg-background px-3 text-sm text-muted-foreground"
          :style="{ gridColumn: '1', gridRow: '1 / -1' }"
        >
          <Icon name="lucide:circle-help" class="size-3.5 shrink-0" />
          <span class="truncate">{{ unassigned.name }}</span>
        </div>
        <div
          v-for="(day, index) in days"
          :key="day.key"
          class="border-r border-border/50 last:border-r-0"
          :class="[day.isBlocked && 'bg-muted', day.isToday && 'bg-primary/5']"
          :style="dayStyle(index)"
        />
        <ListingStayBar
          v-for="bar in unassigned.bars"
          :key="`${bar.booking.id}-unassigned`"
          :booking="bar.booking"
          :listing="listing"
          :continues-before="bar.continuesBefore"
          :continues-after="bar.continuesAfter"
          :grid-style="barStyle(bar)"
          :draggable="isDraggable(bar.booking)"
          @open="emit('open', $event)"
          @drag-start="dragging = $event"
          @drag-end="endDrag"
        />
      </div>
    </div>
  </div>
</template>
