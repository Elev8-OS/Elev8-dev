import type { CleaningJob, CleaningJobPriority, CleaningJobSource } from '~/components/cleaning/data/cleaning-jobs'
import type { Booking } from '~/components/listings/data/listings'
import type { OwnerStay } from '~/components/owners/data/owner-stays'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { cleaningJobs } from '~/components/cleaning/data/cleaning-jobs'
import { cleaningDateKey } from '~/components/cleaning/data/cleaning-link'
import { listings } from '~/components/listings/data/listings'
import { mergedBookingsFor } from '~/components/operations-calendar/data/calendar-stays'
import { mockUpsellOrders } from '~/components/upsells/data/upsell-orders'

export type CalendarEventType = 'guest_stay' | 'owner_stay' | 'cleaning' | 'task' | 'upsell'

export type CleaningType = 'daily' | 'check_out' | 'mid_stay' | 'custom'

/** Map a `CleaningJobSource` (incl. legacy aliases) to the 4 canonical cleaning types. */
export function normalizeCleaningType(source: CleaningJobSource | string | undefined): CleaningType {
  if (source === 'daily' || source === 'check_out' || source === 'mid_stay' || source === 'custom')
    return source
  if (source === 'checkout')
    return 'check_out'
  return 'custom'
}

export const cleaningTypeLabels: Record<CleaningType, string> = {
  daily: 'Daily cleaning',
  check_out: 'Check-out cleaning',
  mid_stay: 'Mid-stay cleaning',
  custom: 'Custom cleaning',
}

export const cleaningTypeIcons: Record<CleaningType, string> = {
  daily: 'lucide:calendar-days',
  check_out: 'lucide:log-out',
  mid_stay: 'lucide:clock-4',
  custom: 'lucide:settings-2',
}

export const cleaningTypeVariants: Record<CleaningType, 'default' | 'secondary' | 'outline'> = {
  daily: 'secondary',
  check_out: 'default',
  mid_stay: 'secondary',
  custom: 'outline',
}

export interface CalendarEvent {
  id: string
  listingId: string
  listingName: string
  type: CalendarEventType
  title: string
  start: string // ISO datetime
  end: string // ISO datetime
  guestName?: string
  hasPet?: boolean
  cleaningType?: CleaningType
  cleaningTypeLabel?: string
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

/**
 * Format a `Date` as `YYYY-MM-DD` using the *local* date components.
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

/**
 * The calendar's listings, each carrying its bookings from BOTH stay sources
 * (`calendar-stays.ts`). Pass the Reservations module's stays; without them the
 * calendar shows only `listing.bookings`, which is what hid every stay made on
 * the Reservations page.
 */
export function getCalendarListings(reservations: ReservationEntry[] = []): CalendarListing[] {
  return listings.value.map(listing => ({
    id: listing.id,
    name: listing.name,
    colorIndex: getListingColorIndex(listing.id),
    property: listing.property,
    unitTypeLabel: listing.room,
    roomLabel: listing.name,
    isSingleUnit: listing.unitType === 'single',
    tags: listing.tags,
    bookings: mergedBookingsFor(listing.id, listing.bookings, reservations),
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

/** Each day is two half-day columns in the stay bar row: before 12:00 and after it. */
export const HALF_DAYS_PER_DAY = 2

export interface StayBarSpan {
  /** First half-day column the bar covers, 0-based, across the visible days. */
  startHalf: number
  /** One past the last half-day column it covers. */
  endHalf: number
  /** The stay began before the first visible day, so the bar has no left end. */
  continuesBefore: boolean
  /** The stay runs past the last visible day, so the bar has no right end. */
  continuesAfter: boolean
}

/**
 * Where a stay's bar sits in the half-day grid, or null when it misses the days
 * shown entirely.
 *
 * A guest checks in after 12:00 and checks out before it, so a stay starts in
 * the SECOND half of its check-in day and ends in the FIRST half of its check-out
 * day. On a turnover day the departing bar stops at midday and the arriving bar
 * starts there, rather than both filling the whole day and running together.
 */
export function stayBarSpan(checkIn: string, checkOut: string, dayKeys: string[]): StayBarSpan | null {
  const first = dayKeys[0]
  const last = dayKeys[dayKeys.length - 1]
  if (!first || !last || checkIn > last || checkOut < first || checkOut <= checkIn)
    return null
  const totalHalves = dayKeys.length * HALF_DAYS_PER_DAY
  const inIndex = dayKeys.indexOf(checkIn)
  const outIndex = dayKeys.indexOf(checkOut)
  const continuesBefore = checkIn < first
  const continuesAfter = checkOut > last
  const startHalf = continuesBefore || inIndex === -1 ? 0 : inIndex * HALF_DAYS_PER_DAY + 1
  const endHalf = continuesAfter || outIndex === -1 ? totalHalves : outIndex * HALF_DAYS_PER_DAY + 1
  if (endHalf <= startHalf)
    return null
  return { startHalf, endHalf, continuesBefore, continuesAfter }
}

/**
 * Stacks stay bars that overlap into separate lanes, so one never hides
 * another. A multi-unit listing is one calendar row, and its rooms are booked
 * at the same time as a matter of course; drawn in one lane, a long stay covers
 * every shorter stay beside it. Bars that only touch (one guest leaving at
 * midday, the next arriving then) share a lane.
 *
 * Greedy by start, then longest first: each bar takes the first lane whose last
 * bar has ended. Returns the lane per input index, and how many lanes there are.
 */
export function assignStayLanes(spans: Pick<StayBarSpan, 'startHalf' | 'endHalf'>[]): { lanes: number[], laneCount: number } {
  const order = spans
    .map((span, index) => ({ span, index }))
    .sort((a, b) => a.span.startHalf - b.span.startHalf || b.span.endHalf - a.span.endHalf)
  const laneEnds: number[] = []
  const lanes: number[] = Array.from({ length: spans.length }, () => 0)
  for (const { span, index } of order) {
    let lane = laneEnds.findIndex(end => end <= span.startHalf)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(span.endHalf)
    }
    else {
      laneEnds[lane] = span.endHalf
    }
    lanes[index] = lane
  }
  return { lanes, laneCount: laneEnds.length }
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
      label: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      date,
    }
  })
}

export function formatWeekRange(days: Array<{ date: Date }>) {
  if (!days.length)
    return ''
  const start = days[0]?.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const end = days[days.length - 1]?.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${start} - ${end}`
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function getTimeSlots() {
  const slots = []
  for (let hour = DAY_START_HOUR; hour <= DAY_END_HOUR; hour += TIME_SLOT_INTERVAL) {
    slots.push({
      hour,
      label: new Date(0, 0, 0, hour).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
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
    // The merged bookings when the caller built the map, else the listing's own.
    const bookings = listing?.bookings ?? listings.value.find(l => l.id === job.listingId)?.bookings ?? []
    const scheduledDate = cleaningDateKey(job.scheduledAt)
    const overlappingBooking = bookings.find(b =>
      b.status !== 'cancelled'
      && b.status !== 'inquiry'
      && b.checkIn <= scheduledDate
      && b.checkOut >= scheduledDate,
    )
    const cleaningType = normalizeCleaningType(job.source)
    const guestSuffix = job.source === 'checkout' && overlappingBooking
      ? ` · ${overlappingBooking.guestName}`
      : ''
    return {
      id: job.id,
      listingId: job.listingId,
      listingName: listing?.name ?? job.listingName,
      type: 'cleaning' as CalendarEventType,
      title: `Cleaning${guestSuffix}`,
      start: job.scheduledAt,
      end: new Date(new Date(job.scheduledAt).getTime() + job.durationMinutes * 60000).toISOString(),
      guestName: overlappingBooking?.guestName ?? job.notes?.match(/guest:\s*([^\n]+)/i)?.[1]?.trim(),
      hasPet: overlappingBooking?.hasPet ?? false,
      cleaningType,
      cleaningTypeLabel: cleaningTypeLabels[cleaningType],
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
  const existingKeys = new Set((jobs ?? cleaningJobs.value).map(job => `${job.listingId}:${cleaningDateKey(job.scheduledAt)}`))
  const events: CalendarEvent[] = []

  for (const listing of listingMap ? [...listingMap.values()] : getCalendarListings()) {
    const checkOutTime = getDefaultCheckOutTime(listing.id)
    for (const booking of listing.bookings) {
      // Skip cancelled / inquiry — no actual checkout, no cleaning
      if (booking.status === 'cancelled' || booking.status === 'inquiry')
        continue
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
        hasPet: booking.hasPet ?? false,
        cleaningType: 'check_out',
        cleaningTypeLabel: cleaningTypeLabels.check_out,
        priority: 'high',
        source: booking.source,
        colorIndex: listingMap?.get(listing.id)?.colorIndex ?? listing.colorIndex,
      })
    }
  }

  return events
}

export function buildAllEvents(jobs?: CleaningJob[], reservations: ReservationEntry[] = []): CalendarEvent[] {
  const calendarListings = getCalendarListings(reservations)
  const listingMap = new Map(calendarListings.map(l => [l.id, l]))
  const events: CalendarEvent[] = []

  for (const listing of calendarListings) {
    if (!listing.bookings.length)
      continue
    const checkInTime = getDefaultCheckInTime(listing.id)
    const checkOutTime = getDefaultCheckOutTime(listing.id)
    for (const booking of listing.bookings) {
      // Skip cancelled / inquiry — not a real booking, no stay or cleaning
      if (booking.status === 'cancelled' || booking.status === 'inquiry')
        continue
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
