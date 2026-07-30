<script setup lang="ts">
import type { CalendarEvent, CalendarListing, OperationsFilters } from '~/components/operations-calendar/data/operations-calendar'
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  formatTime,
  getCalendarListings,
  HOUR_HEIGHT,
  isDayOccupied,
} from '~/components/operations-calendar/data/operations-calendar'

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
  view: 'week' | 'day'
  selectedDay?: string
  showAllListings?: boolean
  filters: OperationsFilters
}>()

const emit = defineEmits<{
  'update:selectedDay': [dayKey: string]
  'update:showAllListings': [value: boolean]
  'update:view': [view: 'week' | 'day']
  'eventClick': [event: CalendarEvent]
  'moveEvent': [payload: { id: string, listingId: string, scheduledAt: string, originalEvent: CalendarEvent }]
  'create': [payload: { listingId: string, dayKey: string }]
  'update:filters': [filters: OperationsFilters]
  'clear': []
  'previousWeek': []
  'nextWeek': []
  'goToToday': []
}>()

const totalHours = DAY_END_HOUR - DAY_START_HOUR
const totalHeight = totalHours * HOUR_HEIGHT

const allListings = getCalendarListings()
const visibleListingIds = computed(() => new Set(props.eventsByListingAndDay.keys()))
const visibleListings = computed(() => allListings.filter(l => visibleListingIds.value.has(l.id)))

const sortedListings = computed(() => {
  return [...visibleListings.value].sort((a, b) => {
    const propertyCompare = a.property.localeCompare(b.property)
    if (propertyCompare !== 0)
      return propertyCompare
    const unitTypeCompare = a.unitTypeLabel.localeCompare(b.unitTypeLabel)
    if (unitTypeCompare !== 0)
      return unitTypeCompare
    return a.roomLabel.localeCompare(b.roomLabel)
  })
})

interface ListingTreeNode {
  id: string
  type: 'property' | 'unitType' | 'room'
  label: string
  listing?: CalendarListing
  depth: number
  eventCount: number
}

interface StayBar {
  id: string
  guestName: string
  startDayIndex: number
  endDayIndex: number
  colorIndex: number
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return map
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

const propertyIds = computed(() => {
  const ids = new Set<string>()
  for (const listing of visibleListings.value) {
    ids.add(`prop-${listing.property}`)
  }
  return ids
})

const unitTypeIds = computed(() => {
  const ids = new Set<string>()
  for (const listing of visibleListings.value) {
    if (!listing.isSingleUnit)
      ids.add(`unit-${listing.property}-${listing.unitTypeLabel}`)
  }
  return ids
})

function expandAll() {
  collapsedNodes.value = new Set()
}

function collapseAll() {
  collapsedNodes.value = new Set([...propertyIds.value, ...unitTypeIds.value])
}

const listingTree = computed<ListingTreeNode[]>(() => {
  const tree: ListingTreeNode[] = []
  const byProperty = groupBy(sortedListings.value, l => l.property)

  for (const [property, propertyListings] of byProperty) {
    const propertyId = `prop-${property}`
    const propertyEventCount = propertyListings.reduce((sum, l) => sum + weeklyEventCount(l.id), 0)
    tree.push({ id: propertyId, type: 'property', label: property, depth: 0, eventCount: propertyEventCount })

    if (!isNodeExpanded(propertyId))
      continue

    const hasMultiUnit = propertyListings.some(l => !l.isSingleUnit)

    if (!hasMultiUnit) {
      for (const listing of propertyListings) {
        tree.push({ id: listing.id, type: 'room', label: listing.roomLabel, listing, depth: 1, eventCount: weeklyEventCount(listing.id) })
      }
    }
    else {
      const byUnitType = groupBy(propertyListings, l => l.unitTypeLabel)
      for (const [unitType, unitListings] of byUnitType) {
        const unitId = `unit-${property}-${unitType}`
        const unitEventCount = unitListings.reduce((sum, l) => sum + weeklyEventCount(l.id), 0)
        tree.push({ id: unitId, type: 'unitType', label: unitType, depth: 1, eventCount: unitEventCount })

        if (!isNodeExpanded(unitId))
          continue

        for (const listing of unitListings) {
          tree.push({ id: listing.id, type: 'room', label: listing.roomLabel, listing, depth: 2, eventCount: weeklyEventCount(listing.id) })
        }
      }
    }
  }

  return tree
})

function getStayBars(listing: CalendarListing): StayBar[] {
  const firstDay = props.weekDays[0]
  const lastDay = props.weekDays[props.weekDays.length - 1]
  if (!firstDay || !lastDay)
    return []
  const weekStart = firstDay.key
  const weekEnd = lastDay.key

  return listing.bookings
    .filter(booking => booking.checkIn <= weekEnd && booking.checkOut >= weekStart)
    .map((booking) => {
      const checkInIndex = props.weekDays.findIndex(d => d.key === booking.checkIn)
      const checkOutIndex = props.weekDays.findIndex(d => d.key === booking.checkOut)
      return {
        id: `stay-bar-${booking.id}`,
        guestName: booking.guestName,
        startDayIndex: checkInIndex === -1 ? 0 : checkInIndex,
        endDayIndex: checkOutIndex === -1 ? 6 : checkOutIndex,
        colorIndex: listing.colorIndex,
      }
    })
}

const selectedDayKey = computed(() => props.selectedDay ?? props.weekDays[0]?.key ?? '')

const dayListings = computed(() => {
  if (props.showAllListings)
    return visibleListings.value
  const activeIds = Array.from(props.eventsByDayAndListing.keys())
  return visibleListings.value.filter(listing => activeIds.includes(listing.id))
})

const timeLabels = computed(() => {
  const labels = []
  for (let hour = DAY_START_HOUR; hour <= DAY_END_HOUR; hour += 2) {
    labels.push({
      hour,
      label: new Date(0, 0, 0, hour).toLocaleTimeString('en-US', { hour: 'numeric' }),
    })
  }
  return labels
})

const listingColors = [
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-slate-500',
]

const listingLightColors = [
  'bg-sky-500/10 border-sky-500/20',
  'bg-emerald-500/10 border-emerald-500/20',
  'bg-amber-500/10 border-amber-500/20',
  'bg-rose-500/10 border-rose-500/20',
  'bg-slate-500/10 border-slate-500/20',
]

function eventStyle(event: CalendarEvent, dayKey: string) {
  const dayStart = new Date(`${dayKey}T00:00:00+08:00`).getTime()
  const slotStart = new Date(`${dayKey}T${String(DAY_START_HOUR).padStart(2, '0')}:00:00+08:00`).getTime()
  const startMs = Math.max(new Date(event.start).getTime(), dayStart)
  const endMs = Math.min(new Date(event.end).getTime(), dayStart + 24 * 60 * 60 * 1000)

  const offsetMinutes = (startMs - slotStart) / 60000
  const durationMinutes = Math.max((endMs - startMs) / 60000, 15)

  return {
    top: `${(offsetMinutes / 60) * HOUR_HEIGHT}px`,
    height: `${(durationMinutes / 60) * HOUR_HEIGHT}px`,
  }
}

function eventClasses(event: CalendarEvent) {
  const base = 'absolute inset-x-1 flex flex-col gap-0.5 rounded-md border-l-4 px-2 py-1 text-[11px] leading-tight shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow'
  if (event.type === 'guest_stay') {
    return `${base} border-l-primary/60 ${listingLightColors[event.colorIndex] ?? listingLightColors[0]}`
  }
  if (event.type === 'task') {
    if (isOverdueTask(event)) {
      return `${base} border-l-destructive bg-destructive/10 border-destructive/50 text-foreground ring-1 ring-destructive/40`
    }
    return `${base} border-l-amber-500 bg-amber-500/10 border-amber-500/30 text-foreground`
  }
  if (event.type === 'cleaning') {
    return `${base} border-l-sky-500 bg-sky-500/10 border-sky-500/30 text-foreground`
  }
  return `${base} border-l-muted bg-card border-border text-foreground`
}

function isOverdueTask(event: CalendarEvent) {
  if (event.type !== 'task' || !event.start)
    return false
  const dueDate = event.start.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  if (dueDate >= today)
    return false
  return event.status !== 'done' && event.status !== 'canceled'
}

function weeklyEventCount(listingId: string) {
  const listingMap = props.eventsByListingAndDay.get(listingId)
  if (!listingMap)
    return 0
  let count = 0
  for (const events of listingMap.values()) {
    count += events.filter(e => e.type !== 'guest_stay').length
  }
  return count
}

const draggedEvent = ref<CalendarEvent | null>(null)
const pendingMove = ref<{ event: CalendarEvent, listingId: string, dayKey: string } | null>(null)
const moveConfirmOpen = ref(false)

function onDragStart(event: CalendarEvent) {
  if (event.type !== 'cleaning')
    return
  draggedEvent.value = event
}

function onDrop(listingId: string, dayKey: string) {
  if (!draggedEvent.value)
    return
  pendingMove.value = { event: draggedEvent.value, listingId, dayKey }
  moveConfirmOpen.value = true
  draggedEvent.value = null
}

function confirmMove() {
  if (!pendingMove.value)
    return
  const { event, listingId, dayKey } = pendingMove.value
  const time = event.start.slice(11, 16)
  const scheduledAt = `${dayKey}T${time}:00+08:00`
  emit('moveEvent', { id: event.id, listingId, scheduledAt, originalEvent: event })
  pendingMove.value = null
  moveConfirmOpen.value = false
}

function cancelMove() {
  pendingMove.value = null
  moveConfirmOpen.value = false
}

function onCellClick(listingId: string, dayKey: string) {
  emit('create', { listingId, dayKey })
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
        <Tabs :model-value="view" @update:model-value="emit('update:view', $event as 'week' | 'day')">
          <TabsList>
            <TabsTrigger value="week">
              Week
            </TabsTrigger>
            <TabsTrigger value="day">
              Day
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
    <!-- Week view -->
    <div v-if="view === 'week'" class="overflow-auto">
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
              :class="selectedDay === day.key && 'bg-muted/30'"
            >
              <p class="text-xs font-semibold text-muted-foreground">
                {{ day.label.slice(0, 3) }}
              </p>
              <p class="mt-1 text-sm font-semibold">
                {{ day.key.slice(8, 10) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Tree rows -->
        <div class="flex flex-col">
          <template v-for="node in listingTree" :key="node.id">
            <!-- Property group header -->
            <div
              v-if="node.type === 'property'"
              class="sticky left-0 z-10 flex cursor-pointer border-t bg-muted/50 px-4 py-2 hover:bg-muted/70"
              @click="toggleNode(node.id)"
            >
              <div class="flex items-center gap-2">
                <Icon
                  :name="isNodeExpanded(node.id) ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                  class="size-3.5 shrink-0 text-muted-foreground"
                />
                <p class="truncate text-xs font-semibold text-muted-foreground">
                  {{ node.label }}
                </p>
                <Badge v-if="node.eventCount > 0" variant="outline" class="text-[10px]">
                  {{ node.eventCount }} events
                </Badge>
              </div>
            </div>

            <!-- Unit type group header -->
            <div
              v-else-if="node.type === 'unitType'"
              class="sticky left-0 z-10 flex cursor-pointer border-t bg-muted/30 px-4 py-2 pl-8 hover:bg-muted/50"
              @click="toggleNode(node.id)"
            >
              <div class="flex items-center gap-2">
                <Icon
                  :name="isNodeExpanded(node.id) ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                  class="size-3.5 shrink-0 text-muted-foreground"
                />
                <p class="truncate text-xs font-medium text-foreground">
                  {{ node.label }}
                </p>
                <Badge v-if="node.eventCount > 0" variant="outline" class="text-[10px]">
                  {{ node.eventCount }} events
                </Badge>
              </div>
            </div>

            <!-- Room row -->
            <div v-else class="flex border-t">
              <div class="sticky left-0 z-10 w-[240px] shrink-0 border-r bg-muted/30 px-4 py-3" :class="node.depth === 2 ? 'pl-12' : 'pl-8'">
                <div class="flex items-start gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold">
                      {{ node.label }}
                    </p>
                    <Badge variant="outline" class="mt-1 text-[10px]">
                      {{ node.eventCount }} events
                    </Badge>
                  </div>
                </div>
              </div>

              <div class="relative grid flex-1 grid-cols-7 grid-rows-[auto_1fr]">
                <!-- Stay bars -->
                <template v-if="node.listing">
                  <div
                    v-for="stay in getStayBars(node.listing)"
                    :key="stay.id"
                    class="mx-0.5 mt-1 flex items-center overflow-hidden rounded px-2 text-xs font-semibold text-white"
                    :class="[listingColors[stay.colorIndex]]"
                    :style="{ gridColumn: `${stay.startDayIndex + 1} / ${stay.endDayIndex + 2}`, gridRow: '1 / 2' }"
                  >
                    <span class="truncate">{{ stay.guestName }}</span>
                  </div>
                </template>

                <!-- Day cells -->
                <div
                  v-for="(day, index) in weekDays"
                  :key="`${node.id}-${day.key}`"
                  class="group relative min-h-[132px] cursor-pointer border-l bg-background/70 p-2 transition-colors hover:bg-muted/40"
                  :class="selectedDay === day.key && 'bg-muted/30'"
                  :style="{ gridColumn: `${index + 1} / ${index + 2}`, gridRow: '2 / 3' }"
                  @dragover.prevent
                  @drop.prevent="onDrop(node.listing?.id ?? '', day.key)"
                  @click="onCellClick(node.listing?.id ?? '', day.key)"
                >
                  <Icon name="lucide:plus" class="absolute right-1.5 top-1.5 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  <div class="flex h-full flex-col gap-2">
                    <OperationsCalendarEventChip
                      v-for="event in node.listing ? (eventsByListingAndDay.get(node.listing.id)?.get(day.key) ?? []).filter(e => e.type !== 'guest_stay') : []"
                      :key="`${day.key}-${event.id}`"
                      :event="event"
                      :draggable="event.type === 'cleaning'"
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

    <!-- Day view -->
    <div v-else class="overflow-auto">
      <div class="grid min-w-[900px]" :style="{ gridTemplateColumns: `64px repeat(${dayListings.length}, minmax(180px, 1fr))` }">
        <!-- Header -->
        <div class="sticky left-0 z-20 border-b bg-background px-2 py-3">
          <Button
            v-if="eventsByDayAndListing.size < visibleListings.length"
            variant="ghost"
            size="sm"
            class="h-auto px-0 text-xs text-muted-foreground"
            @click="emit('update:showAllListings', !showAllListings)"
          >
            {{ showAllListings ? 'Show active' : 'Show all' }}
          </Button>
        </div>
        <div
          v-for="listing in dayListings"
          :key="listing.id"
          class="border-b border-l bg-background px-3 py-3"
        >
          <div class="flex items-start gap-2">
            <div class="min-w-0">
              <template v-if="listing.isSingleUnit">
                <p class="truncate text-sm font-semibold">
                  {{ listing.roomLabel }}
                </p>
              </template>
              <template v-else>
                <p class="truncate text-[10px] text-muted-foreground">
                  {{ listing.property }}
                </p>
                <p class="truncate text-xs font-medium text-foreground">
                  {{ listing.unitTypeLabel }}
                </p>
                <p class="truncate text-sm font-semibold">
                  {{ listing.roomLabel }}
                </p>
              </template>
            </div>
          </div>
          <Badge
            :variant="isDayOccupied(eventsByDayAndListing.get(listing.id) ?? [], selectedDayKey) ? 'default' : 'outline'"
            class="mt-1.5 text-[10px]"
          >
            {{ isDayOccupied(eventsByDayAndListing.get(listing.id) ?? [], selectedDayKey) ? 'Occupied' : 'Empty' }}
          </Badge>
        </div>

        <!-- Time labels -->
        <div class="sticky left-0 z-10 border-r bg-background">
          <div
            v-for="slot in timeLabels"
            :key="slot.hour"
            class="flex items-start justify-end border-b pr-2 text-[10px] text-muted-foreground"
            :style="{ height: `${HOUR_HEIGHT * 2}px` }"
          >
            {{ slot.label }}
          </div>
        </div>

        <!-- Listing columns -->
        <div
          v-for="listing in dayListings"
          :key="listing.id"
          class="relative border-l"
          :style="{ height: `${totalHeight}px` }"
        >
          <div
            v-for="event in eventsByDayAndListing.get(listing.id) ?? []"
            :key="`${listing.id}-${event.id}`"
            :class="eventClasses(event)"
            :style="eventStyle(event, selectedDayKey)"
            @click.stop="emit('eventClick', event)"
          >
            <div class="flex min-w-0 items-start justify-between gap-1">
              <p class="flex min-w-0 items-center gap-1.5 truncate font-semibold">
                <Icon
                  v-if="event.type === 'cleaning'"
                  name="lucide:brush"
                  class="h-3 w-3 shrink-0 text-sky-600"
                />
                <Icon
                  v-else-if="event.type === 'task'"
                  name="lucide:clipboard-list"
                  class="h-3 w-3 shrink-0 text-amber-600"
                />
                <Icon
                  v-else-if="event.type === 'upsell'"
                  name="lucide:sparkles"
                  class="h-3 w-3 shrink-0 text-violet-600"
                />
                <Icon
                  v-else-if="event.type === 'guest_stay'"
                  name="lucide:bed"
                  class="h-3 w-3 shrink-0 text-primary"
                />
                <span class="min-w-0 truncate">{{ event.title }}</span>
              </p>
              <Badge
                v-if="event.type === 'cleaning' && event.priority === 'high'"
                variant="destructive"
                class="shrink-0 bg-destructive/90 px-1 py-0 text-[9px] font-medium text-white"
                data-testid="event-priority-badge"
              >
                <Icon name="lucide:flag" class="mr-0.5 h-2.5 w-2.5" />
                High
              </Badge>
              <Badge
                v-if="isOverdueTask(event)"
                variant="destructive"
                class="shrink-0 bg-destructive/90 px-1 py-0 text-[9px] font-medium text-white"
                data-testid="event-overdue-badge"
              >
                <Icon name="lucide:alert-triangle" class="mr-0.5 h-2.5 w-2.5" />
                Overdue
              </Badge>
              <Badge
                v-if="event.type === 'task' && (event.priority === 'high' || event.priority === 'urgent')"
                variant="destructive"
                class="shrink-0 bg-destructive/90 px-1 py-0 text-[9px] font-medium text-white"
                data-testid="event-priority-badge"
              >
                <Icon name="lucide:flag" class="mr-0.5 h-2.5 w-2.5" />
                {{ event.priority === 'urgent' ? 'Urgent' : 'High' }}
              </Badge>
            </div>
            <p v-if="event.type !== 'guest_stay'" class="min-w-0 truncate text-[10px] text-muted-foreground">
              {{ formatTime(event.start) }} - {{ formatTime(event.end) }}
            </p>
            <p
              v-if="event.type === 'task'"
              class="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground"
            >
              <Icon
                :name="event.assigneeType === 'person' ? 'lucide:user' : 'lucide:users-round'"
                class="h-2.5 w-2.5 shrink-0"
              />
              <span class="min-w-0 flex-1 truncate">
                <template v-if="event.assigneeLabel">
                  {{ event.assigneeLabel }}<span v-if="event.assigneeRoleLabel" class="text-muted-foreground/70"> · {{ event.assigneeRoleLabel }}</span>
                </template>
                <template v-else>
                  Unassigned
                </template>
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Move confirmation dialog -->
    <Dialog v-model:open="moveConfirmOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move cleaning?</DialogTitle>
          <DialogDescription>
            Move <strong>{{ pendingMove?.event.title }}</strong> to {{ pendingMove?.listingId ? allListings.find(l => l.id === pendingMove?.listingId)?.roomLabel : '' }} on {{ pendingMove?.dayKey }}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="cancelMove">
            Cancel
          </Button>
          <Button @click="confirmMove">
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
e>
