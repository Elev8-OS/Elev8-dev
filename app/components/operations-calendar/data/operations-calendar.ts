import type { CleaningJob } from '~/components/cleaning/data/cleaning-jobs'
import type { Booking } from '~/components/listings/data/listings'
import type { CleaningJobPriority } from '~/components/cleaning/data/cleaning-jobs'
import type { OwnerStay } from '~/components/owners/data/owner-stays'
import { cleaningJobs } from '~/components/cleaning/data/cleaning-jobs'
import { listings } from '~/components/listings/data/listings'
import { mockUpsellOrders } from '~/components/upsells/data/upsell-orders'

export type CalendarEventType = 'guest_stay' | 'owner_stay' | 'cleaning' | 'task' | 'upsell'

export interface CalendarEvent {
  id: string
  listingId: string
  listingName: string
  type: CalendarEventType
  title: string
  start: string // ISO datetime
  end: string // ISO datetime
  guestName?: string
  status?: string
  priority?: CleaningJobPriority
  assignedTo?: string[]
  assignee?: string
  assigneeType?: 'role' | 'person'
  assigneeLabel?: string
  assigneeRoleLabel?: string
  notes?: string
  source?: string
  colorIndex: number
}

export interface OperationsFilters {
  listingSearch: string
  listingTags: string[]
  eventTypes: CalendarEventType[]
}

export const HOUR_HEIGHT = 64
export const DAY_START_HOUR = 8
export const DAY_END_HOUR = 20
export const TIME_SLOT_INTERVAL = 2 // 2-hour labels keep the grid light

export const eventTypeLabels: Record<CalendarEventType, string> = {
  guest_stay: 'Guest stay',
  owner_stay: 'Owner stay',
  cleaning: 'Cleaning',
  task: 'Task',
  upsell: 'Upsell',
}

export const eventTypeTones: Record<CalendarEventType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  guest_stay: 'default',
  owner_stay: 'secondary',
  cleaning: 'default',
  task: 'outline',
  upsell: 'secondary',
}

export interface CalendarListing {
  id: string
  name: string
  colorIndex: number
  property: string
  unitTypeLabel: string
  roomLabel: string
  isSingleUnit: boolean
  tags: string[]
  bookings: Booking[]
}

/** Format a `Date` as `YYYY-MM-DD` using the *local* date components.
 *
 * `Date#toISOString` always returns UTC, which is one calendar day behind
 * the user's intent for any time zone east of UTC (e.g. Bali is UTC+8 —
 * midnight local is 16:00 the previous day in UTC). Calendar keys must be
 * anchored to the user's local day, so we format from the local getters.
 */
export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getListingColorIndex(listingId: string) {
  const sum = listingId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return sum % 5
}

export function getListingName(listingId: string) {
  return listings.value.find(listing => listing.id === listingId)?.name ?? listingId
}

export function getCalendarListings(): CalendarListing[] {
  return listings.value.map(listing => ({
    id: listing.id,
    name: listing.name,
    colorIndex: getListingColorIndex(listing.id),
    property: listing.property,
    unitTypeLabel: listing.room,
    roomLabel: listing.name,
    isSingleUnit: listing.unitType === 'single',
    tags: listing.tags,
    bookings: listing.bookings,
  }))
}

export function getMonthGrid(anchorDate = new Date()) {
  const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
  // Snap to Monday.
  const dayOfWeek = start.getDay()
  const offset = (dayOfWeek + 6) % 7
  start.setDate(start.getDate() - offset)
  start.setHours(0, 0, 0, 0)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const month = date.getMonth()
    return {
      key: formatLocalDateKey(date),
      label: date.toLocaleDateString('en-US', { day: 'numeric' }),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date,
      inMonth: month === anchorDate.getMonth(),
    }
  })
}

export function getWeekDays(anchorDate = new Date()) {
  const start = new Date(anchorDate)
  const day = start.getDay()
  const diff = start.getDate() - day + (day === 0 ? -6 : 1)
  start.setDate(diff)
  start.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      key: formatLocalDateKey(date),
      label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      date,
    }
  })
}

export function formatWeekRange(days: Array<{ date: Date }>) {
  if (!days.length)
    return ''
  const start = days[0]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const end = days[days.length - 1]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${start} - ${end}`
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function getTimeSlots() {
  const slots = []
  for (let hour = DAY_START_HOUR; hour <= DAY_END_HOUR; hour += TIME_SLOT_INTERVAL) {
    slots.push({
      hour,
      label: new Date(0, 0, 0, hour).toLocaleTimeString('en-US', { hour: 'numeric' }),
    })
  }
  return slots
}

export function toLocalDateTime(date: string, time: string, tzOffset = '+08:00') {
  return `${date}T${time}:00${tzOffset}`
}

export function getDefaultCheckInTime(listingId: string) {
  return listings.value.find(listing => listing.id === listingId)?.resources.basics.checkInTime ?? '14:00'
}

export function getDefaultCheckOutTime(listingId: string) {
  return listings.value.find(listing => listing.id === listingId)?.resources.basics.checkOutTime ?? '11:00'
}

function addDays(dateStr: string, days: number) {
  const parts = dateStr.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function buildGuestStayEvents(booking: Booking, listing: CalendarListing, _checkInTime: string, _checkOutTime: string): CalendarEvent[] {
  const events: CalendarEvent[] = []

  // Overnight guest stay blocks for each night between check-in and check-out
  let nightDate = booking.checkIn
  while (nightDate < booking.checkOut) {
    events.push({
      id: `stay-${booking.id}-${nightDate}`,
      listingId: listing.id,
      listingName: listing.name,
      type: 'guest_stay',
      title: booking.guestName,
      start: toLocalDateTime(nightDate, '00:00'),
      end: toLocalDateTime(addDays(nightDate, 1), '00:00'),
      guestName: booking.guestName,
      source: booking.source,
      colorIndex: listing.colorIndex,
    })
    nightDate = addDays(nightDate, 1)
  }

  return events
}

export function buildOwnerStayEvents(stays: OwnerStay[]): CalendarEvent[] {
  return stays
    .filter(stay => stay.status === 'active')
    .map(stay => ({
      id: `owner-stay-${stay.id}`,
      listingId: stay.listingId,
      listingName: getListingName(stay.listingId),
      type: 'owner_stay',
      title: stay.guestName,
      start: toLocalDateTime(stay.checkIn, '00:00'),
      end: toLocalDateTime(stay.checkOut, '00:00'),
      guestName: stay.guestName,
      status: stay.status,
      notes: stay.notes,
      source: 'owner',
      colorIndex: getListingColorIndex(stay.listingId),
    }))
}

export function buildCleaningEvents(listingMap?: Map<string, CalendarListing>, jobs?: CleaningJob[]) {
  const source = jobs ?? cleaningJobs.value
  return source.map((job) => {
    const listing = listingMap?.get(job.listingId)
    const fullListing = listings.value.find(l => l.id === job.listingId)
    const scheduledDate = job.scheduledAt.slice(0, 10)
    const checkoutBooking = fullListing?.bookings.find(b => b.checkOut === scheduledDate)
    const guestSuffix = job.source === 'checkout' && checkoutBooking
      ? ` · ${checkoutBooking.guestName}`
      : ''
    return {
      id: job.id,
      listingId: job.listingId,
      listingName: listing?.name ?? job.listingName,
      type: 'cleaning' as CalendarEventType,
      title: `Cleaning${guestSuffix}`,
      start: job.scheduledAt,
      end: new Date(new Date(job.scheduledAt).getTime() + job.durationMinutes * 60000).toISOString(),
      assignedTo: job.cleanerNames ?? [],
      status: job.status,
      priority: job.priority,
      notes: job.notes,
      source: job.source,
      colorIndex: listing?.colorIndex ?? getListingColorIndex(job.listingId),
    }
  })
}

export function buildCheckoutCleanings(listingMap?: Map<string, CalendarListing>, jobs?: CleaningJob[]): CalendarEvent[] {
  const existingKeys = new Set((jobs ?? cleaningJobs.value).map(job => `${job.listingId}:${job.scheduledAt.slice(0, 10)}`))
  const events: CalendarEvent[] = []

  for (const listing of getCalendarListings()) {
    const fullListing = listings.value.find(l => l.id === listing.id)
    if (!fullListing)
      continue
    const checkOutTime = getDefaultCheckOutTime(listing.id)
    for (const booking of fullListing.bookings) {
      const key = `${listing.id}:${booking.checkOut}`
      if (existingKeys.has(key))
        continue
      const start = toLocalDateTime(booking.checkOut, checkOutTime)
      events.push({
        id: `checkout-cleaning-${booking.id}`,
        listingId: listing.id,
        listingName: listingMap?.get(listing.id)?.name ?? listing.name,
        type: 'cleaning' as CalendarEventType,
        title: `Cleaning · ${booking.guestName}`,
        start,
        end: new Date(new Date(start).getTime() + 120 * 60000).toISOString(),
        guestName: booking.guestName,
        priority: 'high',
        source: booking.source,
        colorIndex: listingMap?.get(listing.id)?.colorIndex ?? listing.colorIndex,
      })
    }
  }

  return events
}

export function buildAllEvents(jobs?: CleaningJob[]): CalendarEvent[] {
  const calendarListings = getCalendarListings()
  const listingMap = new Map(calendarListings.map(l => [l.id, l]))
  const events: CalendarEvent[] = []

  for (const listing of calendarListings) {
    const fullListing = listings.value.find(l => l.id === listing.id)
    if (!fullListing || !fullListing.bookings.length)
      continue
    const checkInTime = getDefaultCheckInTime(listing.id)
    const checkOutTime = getDefaultCheckOutTime(listing.id)
    for (const booking of fullListing.bookings) {
      events.push(...buildGuestStayEvents(booking, listing, checkInTime, checkOutTime))
    }
  }

  events.push(...buildCleaningEvents(listingMap, jobs))
  events.push(...buildCheckoutCleanings(listingMap, jobs))
  events.push(...buildMockTaskEvents(calendarListings))
  events.push(...buildUpsellEvents(calendarListings))
  return events
}

export function buildUpsellEvents(calendarListings: CalendarListing[]): CalendarEvent[] {
  const listingByName = new Map(calendarListings.map(l => [l.name, l]))

  return mockUpsellOrders
    .filter(order => order.serviceDate)
    .map((order): CalendarEvent | null => {
      const listing = listingByName.get(order.listing)
      if (!listing)
        return null
      return {
        id: `upsell-${order.id}`,
        listingId: listing.id,
        listingName: listing.name,
        type: 'upsell' as CalendarEventType,
        title: `${order.serviceName} · ${order.guestName}`,
        start: `${order.serviceDate}T10:00:00+08:00`,
        end: `${order.serviceDate}T12:00:00+08:00`,
        guestName: order.guestName,
        status: order.fulfillmentStatus,
        colorIndex: listing.colorIndex,
      }
    })
    .filter((e): e is CalendarEvent => e !== null)
}

export function buildMockTaskEvents(calendarListings: CalendarListing[]): CalendarEvent[] {
  const taskTitles = [
    'AC filter replacement',
    'Pool pump check',
    'Garden maintenance',
    'Deep clean bathroom',
    'WiFi speed test',
    'Fire extinguisher check',
    'Drain unclogging',
    'Light bulb replacement',
    'Termite inspection',
    'Water heater service',
    'Septic tank check',
    'Pest control spray',
    'Mattress rotation',
    'Gas line inspection',
    'Roof gutter cleaning',
  ]
  const weekDays = ['2026-06-22', '2026-06-23', '2026-06-24', '2026-06-25', '2026-06-26', '2026-06-27', '2026-06-28']

  return calendarListings.map((listing, index) => ({
    id: `task-mock-${listing.id}`,
    listingId: listing.id,
    listingName: listing.name,
    type: 'task' as CalendarEventType,
    title: taskTitles[index % taskTitles.length]!,
    start: `${weekDays[index % weekDays.length]}T${String(8 + (index % 8)).padStart(2, '0')}:00:00+08:00`,
    end: `${weekDays[index % weekDays.length]}T${String(9 + (index % 8)).padStart(2, '0')}:00:00+08:00`,
    colorIndex: listing.colorIndex,
  }))
}

export function eventsForDay(events: CalendarEvent[], dayKey: string) {
  const dayStart = `${dayKey}T00:00:00+08:00`
  const dayEnd = `${dayKey}T23:59:59+08:00`
  return events.filter((event) => {
    const start = new Date(event.start).getTime()
    const end = new Date(event.end).getTime()
    const dayStartMs = new Date(dayStart).getTime()
    const dayEndMs = new Date(dayEnd).getTime()
    return start < dayEndMs && end > dayStartMs
  })
}

export function eventStyle(event: CalendarEvent, dayKey: string) {
  const dayStart = new Date(`${dayKey}T00:00:00+08:00`).getTime()
  const slotStart = new Date(`${dayKey}T${String(DAY_START_HOUR).padStart(2, '0')}:00:00+08:00`).getTime()
  const startMs = Math.max(new Date(event.start).getTime(), dayStart)
  const endMs = Math.min(new Date(event.end).getTime(), dayStart + 24 * 60 * 60 * 1000)

  const offsetMinutes = (startMs - slotStart) / 60000
  const durationMinutes = Math.max((endMs - startMs) / 60000, 15)

  const top = (offsetMinutes / 60) * HOUR_HEIGHT
  const height = (durationMinutes / 60) * HOUR_HEIGHT

  return {
    top: `${top}px`,
    height: `${height}px`,
  }
}

export function isDayOccupied(events: CalendarEvent[], dayKey: string) {
  return eventsForDay(events, dayKey).some(event => event.type === 'guest_stay')
}

export interface WeekDay {
  key: string
  label: string
  date: Date
}

export function groupEventsByListingAndDay(
  listings: CalendarListing[],
  events: CalendarEvent[],
  weekDays: WeekDay[],
): Map<string, Map<string, CalendarEvent[]>> {
  const map = new Map<string, Map<string, CalendarEvent[]>>()

  // Ensure every listing has a row, even if no events all week
  for (const listing of listings) {
    const dayMap = new Map<string, CalendarEvent[]>()
    for (const day of weekDays) {
      dayMap.set(day.key, [])
    }
    map.set(listing.id, dayMap)
  }

  for (const day of weekDays) {
    const dayEvents = eventsForDay(events, day.key)
    for (const event of dayEvents) {
      const listingMap = map.get(event.listingId)
      if (!listingMap)
        continue
      const list = listingMap.get(day.key) ?? []
      list.push(event)
      listingMap.set(day.key, list)
    }
  }

  return map
}
