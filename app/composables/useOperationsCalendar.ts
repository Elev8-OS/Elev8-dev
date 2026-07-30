import type { Task } from '@/components/tasks/data/schema'
import type { CalendarEvent, CalendarEventType, CalendarListing, OperationsFilters } from '~/components/operations-calendar/data/operations-calendar'
import { useTaskStore } from '@/composables/useTaskStore'
import { buildAllEvents, eventsForDay, getCalendarListings, getWeekDays, groupEventsByListingAndDay } from '~/components/operations-calendar/data/operations-calendar'
import { useCleaningJobs } from '~/composables/useCleaningJobs'
import { assigneeOptions, assigneeRoles, staffMembers } from '~/components/tasks/data/data'

export function useOperationsCalendar() {
  const { tasks } = useTaskStore()
  const { jobs: cleaningJobs, updateJob: updateCleaningJob, resolveListingName } = useCleaningJobs()

  const view = ref<'week' | 'day'>('week')
  const weekAnchor = ref(new Date())
  const selectedDay = ref<string>(new Date().toISOString().slice(0, 10))
  const showAllListingsInDay = ref(false)

  const filters = ref<OperationsFilters>({
    listingSearch: '',
    listingTags: [],
    eventTypes: [],
  })

  const calendarListings = computed(() => getCalendarListings())

  function buildTaskEvents(listings: CalendarListing[], allTasks: Task[]): CalendarEvent[] {
    const listingByName = new Map(listings.map(l => [l.name, l]))
    return allTasks
      .filter(task => task.dueDate && task.listing)
      .map((task) => {
        const listing = listingByName.get(task.listing!)
        if (!listing)
          return null

        const assigneeMatch = task.assignee
          ? assigneeOptions.find(o => o.value === task.assignee)
          : null
        const assigneeLabel = assigneeMatch?.label ?? task.assignee
        const assigneeRoleLabel = task.assigneeType === 'person' && task.assignee
          ? assigneeRoles.find(r => r.value === staffMembers.find(s => s.value === task.assignee)?.role)?.label ?? ''
          : ''

        return {
          id: `task-${task.id}`,
          listingId: listing.id,
          listingName: listing.name,
          type: 'task' as CalendarEventType,
          title: task.title,
          start: `${task.dueDate}T09:00:00+08:00`,
          end: `${task.dueDate}T10:00:00+08:00`,
          status: task.status,
          priority: task.priority,
          assignee: task.assignee,
          assigneeType: task.assigneeType,
          assigneeLabel,
          assigneeRoleLabel,
          colorIndex: listing.colorIndex,
        }
      })
      .filter((e): e is CalendarEvent => e !== null)
  }

  const events = computed<CalendarEvent[]>(() => {
    const allEvents = [...buildAllEvents(cleaningJobs.value)]
    allEvents.push(...buildTaskEvents(calendarListings.value, tasks.value))
    return allEvents
  })

  const weekDays = computed(() => getWeekDays(weekAnchor.value))

  const filteredListings = computed(() => {
    const { listingSearch, listingTags } = filters.value
    const q = listingSearch.trim().toLowerCase()

    return calendarListings.value.filter((listing) => {
      if (q) {
        const searchable = `${listing.property} ${listing.unitTypeLabel} ${listing.roomLabel}`.toLowerCase()
        if (!searchable.includes(q))
          return false
      }
      if (listingTags.length && !listingTags.every(tag => listing.tags.includes(tag)))
        return false
      return true
    })
  })

  const filteredListingIds = computed(() => new Set(filteredListings.value.map(l => l.id)))

  const hasListingFilter = computed(() => {
    return filters.value.listingSearch.trim().length > 0 || filters.value.listingTags.length > 0
  })

  const filteredEvents = computed(() => {
    const { eventTypes } = filters.value
    const activeListingFilter = hasListingFilter.value
    const allowedIds = filteredListingIds.value

    if (!activeListingFilter && !eventTypes.length)
      return events.value

    return events.value.filter((event) => {
      if (activeListingFilter && !allowedIds.has(event.listingId))
        return false
      if (eventTypes.length && !eventTypes.includes(event.type))
        return false
      return true
    })
  })

  const eventsByDay = computed(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const day of weekDays.value) {
      map.set(day.key, eventsForDay(filteredEvents.value, day.key))
    }
    return map
  })

  const eventsByListingAndDay = computed(() => {
    return groupEventsByListingAndDay(filteredListings.value, filteredEvents.value, weekDays.value)
  })

  const eventsByDayAndListing = computed(() => {
    const dayKey = selectedDay.value || weekDays.value[0]?.key || ''
    const dayEvents = eventsByDay.value.get(dayKey) ?? []
    const map = new Map<string, CalendarEvent[]>()
    for (const event of dayEvents) {
      const list = map.get(event.listingId)
      if (list) {
        list.push(event)
      }
      else {
        map.set(event.listingId, [event])
      }
    }
    return map
  })

  function setFilters(next: OperationsFilters) {
    filters.value = { ...next }
  }

  function clearFilters() {
    filters.value = { listingSearch: '', listingTags: [], eventTypes: [] }
  }

  function previousWeek() {
    const date = new Date(weekAnchor.value)
    date.setDate(date.getDate() - 7)
    weekAnchor.value = date
  }

  function nextWeek() {
    const date = new Date(weekAnchor.value)
    date.setDate(date.getDate() + 7)
    weekAnchor.value = date
  }

  function goToToday() {
    weekAnchor.value = new Date()
    selectedDay.value = new Date().toISOString().slice(0, 10)
  }

  function toggleEventType(type: CalendarEventType) {
    const current = filters.value.eventTypes
    filters.value.eventTypes = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
  }

  function moveCleaning(payload: { id: string, listingId: string, scheduledAt: string }) {
    const job = cleaningJobs.value.find(item => item.id === payload.id)
    if (!job)
      return
    updateCleaningJob(job.id, {
      listingId: payload.listingId,
      listingName: resolveListingName(payload.listingId),
      scheduledAt: payload.scheduledAt,
    })
  }

  return {
    events,
    view,
    weekAnchor,
    selectedDay,
    showAllListingsInDay,
    filters,
    weekDays,
    filteredEvents,
    eventsByDay,
    eventsByDayAndListing,
    eventsByListingAndDay,
    setFilters,
    clearFilters,
    previousWeek,
    nextWeek,
    goToToday,
    toggleEventType,
    moveCleaning,
  }
}
