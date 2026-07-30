<script setup lang="ts">
import type { CalendarEvent } from '~/components/operations-calendar/data/operations-calendar'
import { toast } from 'vue-sonner'
import OperationsCalendarCreateDialog from '~/components/operations-calendar/OperationsCalendarCreateDialog.vue'
import CalendarEventDetailDialog from '~/components/operations-calendar/CalendarEventDetailDialog.vue'
import TaskEventDetailSheet from '~/components/operations-calendar/TaskEventDetailSheet.vue'
import { useOperationsCalendar } from '~/composables/useOperationsCalendar'

const {
  view,
  selectedDay,
  showAllListingsInDay,
  filters,
  weekDays,
  filteredEvents,
  eventsByDay,
  eventsByDayAndListing,
  eventsByListingAndDay,
  previousWeek,
  nextWeek,
  goToToday,
  clearFilters,
  moveCleaning,
} = useOperationsCalendar()

const createOpen = ref(false)
const createListingId = ref<string>()
const createDayKey = ref<string>()

const detailOpen = ref(false)
const detailEvent = ref<CalendarEvent | null>(null)
const taskSheetOpen = ref(false)

function handleEventClick(event: CalendarEvent) {
  detailEvent.value = event
  if (event.type === 'task') {
    taskSheetOpen.value = true
  }
  else {
    detailOpen.value = true
  }
}

function handleCreate(payload: { listingId: string, dayKey: string }) {
  createListingId.value = payload.listingId
  createDayKey.value = payload.dayKey
  createOpen.value = true
}

function handleMoveEvent(payload: { id: string, listingId: string, scheduledAt: string }) {
  moveCleaning(payload)
  toast.success('Cleaning job moved')
}
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Operations Calendar
        </h2>
        <p class="text-muted-foreground">
          Time-based view of guest stays, cleaning, and tasks.
        </p>
      </div>
    </div>

    <ClientOnly>
      <LazyOperationsCalendarBoard
        :events="filteredEvents"
        :events-by-day="eventsByDay"
        :events-by-day-and-listing="eventsByDayAndListing"
        :events-by-listing-and-day="eventsByListingAndDay"
        :week-days="weekDays"
        :view="view"
        :selected-day="selectedDay"
        :show-all-listings="showAllListingsInDay"
        :filters="filters"
        @update:filters="filters = $event"
        @clear="clearFilters"
        @update:selected-day="selectedDay = $event"
        @update:show-all-listings="showAllListingsInDay = $event"
        @update:view="view = $event"
        @previous-week="previousWeek"
        @next-week="nextWeek"
        @go-to-today="goToToday"
        @event-click="handleEventClick"
        @move-event="handleMoveEvent"
        @create="handleCreate"
      />

      <OperationsCalendarCreateDialog
        :open="createOpen"
        :listing-id="createListingId"
        :day-key="createDayKey"
        @update:open="createOpen = $event"
      />

      <CalendarEventDetailDialog
        :open="detailOpen"
        :event="detailEvent"
        @update:open="detailOpen = $event"
      />

      <TaskEventDetailSheet
        :open="taskSheetOpen"
        :event="detailEvent"
        @update:open="taskSheetOpen = $event"
      />

      <template #fallback>
        <div class="flex h-96 items-center justify-center rounded-2xl border bg-card text-sm text-muted-foreground">
          Loading operations calendar…
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
