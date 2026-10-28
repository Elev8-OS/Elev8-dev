<script setup lang="ts">
import type { CockpitCreateRequest, CockpitDay, CockpitGroup, CockpitRoomType, CockpitRow, CockpitStayFilters } from '~/components/cockpit/data/cockpit'
import type { RoomCleaningStatus } from '~/components/cockpit/data/cockpit-cleaning'
import type { Booking, Listing } from '~/components/listings/data/listings'
import type { Task } from '~/components/tasks/data/schema'
import { useEventListener } from '@vueuse/core'
import CockpitBoardTools from '~/components/cockpit/CockpitBoardTools.vue'
import CockpitChannelLinks from '~/components/cockpit/CockpitChannelLinks.vue'
import CockpitLegend from '~/components/cockpit/CockpitLegend.vue'
import CockpitListingScore from '~/components/cockpit/CockpitListingScore.vue'
import CockpitRoomTasks from '~/components/cockpit/CockpitRoomTasks.vue'
import CockpitStayBar from '~/components/cockpit/CockpitStayBar.vue'
import { arrivalsOn, DEFAULT_STAY_FILTERS, extensionJoins, formatMoney, freeUnits, inPlaceExtensionJoins, isRowFree, listingCurrency, nightlyRateOn, nowFraction, portfolioOccupancy, selectionStay, splitSpan, stayVisible, typeFreeUnits } from '~/components/cockpit/data/cockpit'
import { ROOM_CLEANING_ICON, roomCleaningMeta } from '~/components/cockpit/data/cockpit-cleaning'
import { describeOverrides, overridesOn, sellableUnits } from '~/components/cockpit/data/cockpit-overrides'
import { canAssignRoom } from '~/components/listings/data/calendar-rooms'
import { bookingReservationStatus } from '~/components/operations-calendar/data/calendar-stays'
import { assignStayLanes, HALF_DAYS_PER_DAY, stayBarSpan } from '~/components/operations-calendar/data/operations-calendar'
import { Button } from '~/components/ui/button'
import { useCockpitOverrides } from '~/composables/useCockpitOverrides'
import { useReservationsModule } from '~/composables/useReservationsModule'

/**
 * The Cockpit board (`docs/claude/cockpit.md`), laid out like a hotel tape
 * chart. Each listing has a header row (its name, then per night how many
 * units are free and the nightly rate in a pill) over one row per unit: the
 * listing itself, or each of its rooms. Unit rows hold only the stays.
 *
 * Bars follow the half-day rule (`stayBarSpan`): a stay starts at midday of
 * check-in and ends at midday of check-out, drawn with slanted ends, and
 * overlapping stays stack in lanes (`assignStayLanes`). The date header shows
 * the arrivals that day, the date and the share of all units booked; today's
 * column is tinted and a gold line marks the time now.
 */
const props = defineProps<{
  groups: CockpitGroup[]
  days: CockpitDay[]
  /** Open tasks per row id. A row missing from the map has none. */
  openTasks: Map<string, Task[]>
  /** Local `YYYY-MM-DD`, for overdue tasks. */
  todayKey: string
  /** Each room's housekeeping state today, by row id (`roomCleaningStatus`). */
  roomCleaning?: Map<string, RoomCleaningStatus>
  /** Reservation ids whose Inbox conversation is marked Action needed. */
  actionNeeded?: Set<string>
  /** Upsell orders (not declined) per reservation id. */
  upsellCounts?: Map<string, number>
  /** Double-booked stay ids (`conflictIds`). */
  conflicts?: Set<string>
  /** The today strip's focus: stays outside it fade back. Null = no focus. */
  focusIds?: Set<string> | null
  /** Find availability: the searched nights, and the rows that can take the stay. */
  highlightNights?: Set<string>
  matchingRows?: Set<string> | null
}>()

const emit = defineEmits<{
  open: [booking: Booking, listing: Listing]
  openInbox: [booking: Booking]
  create: [request: CockpitCreateRequest]
  /** A stay dropped on a room of its listing, or on "Not assigned to a room" (`unitId` null). */
  assign: [bookingId: string, unitId: string | null]
  openTask: [task: Task]
  /** The room's cleaning icon: the job its state rests on, or none (schedule one). */
  openCleaning: [target: { listingId: string, unitId: string | null, jobId?: string }]
}>()

const search = defineModel<string>('search', { default: '' })
const tags = defineModel<string[]>('tags', { default: () => [] })
const filters = defineModel<CockpitStayFilters>('filters', { default: () => ({ ...DEFAULT_STAY_FILTERS }) })
/** Folded listings, by id. The page remembers them. */
const collapsedIds = defineModel<string[]>('collapsed', { default: () => [] })

const { reservations, getCheckInTime, getListingCheckInTime } = useReservationsModule()

/** The arrival time a bar shows: the reservation's own, else the listing's default. */
function checkInTimeOf(booking: Booking, listing: Listing) {
  const r = reservations.value.find(x => x.id === booking.id)
  return r ? getCheckInTime(r) : getListingCheckInTime(listing.id)
}

/** A stay's extension records, for the in-place link icons (`inPlaceExtensionJoins`). */
const extensionsByStay = computed(() => new Map(reservations.value
  .filter(r => r.extensions?.length)
  .map(r => [r.id, r.extensions!])))

/** Extension booking id to the id of the stay it extends (`extensionOf`). */
const extensionOf = computed(() => new Map(reservations.value
  .filter(r => r.extensionOf)
  .map(r => [r.id, r.extensionOf!])))

/* ------------------------------------------------------------ folding */

const collapsed = computed(() => new Set(collapsedIds.value))
const allCollapsed = computed(() => props.groups.length > 0 && props.groups.every(g => collapsed.value.has(g.listing.id)))

function toggleGroup(id: string) {
  collapsedIds.value = collapsed.value.has(id) ? collapsedIds.value.filter(x => x !== id) : [...collapsedIds.value, id]
}

function toggleAll() {
  collapsedIds.value = allCollapsed.value ? [] : props.groups.map(g => g.listing.id)
}

/* ------------------------------------------------------------ grid */

const dayKeys = computed(() => props.days.map(d => d.key))
const todayKey = computed(() => props.days.find(d => d.isToday)?.key ?? null)
const halfColumns = computed(() => props.days.length * HALF_DAYS_PER_DAY)
const gridColumns = computed(() => `var(--cockpit-left) repeat(${halfColumns.value}, minmax(3.5rem, 1fr))`)

function dayColumn(index: number) {
  return `${index * HALF_DAYS_PER_DAY + 2} / span ${HALF_DAYS_PER_DAY}`
}

/** The month shows on the first visible day and on every 1st. */
function monthLabel(day: CockpitDay, index: number): string | null {
  if (index !== 0 && day.day !== '01')
    return null
  return day.month.split(' ')[0]!.slice(0, 3)
}

/** Per date: guests arriving, and the share of all units shown that are booked. */
const dayStats = computed(() => new Map(props.days.map(day => [day.key, {
  arrivals: arrivalsOn(props.groups, day.key),
  occupancy: portfolioOccupancy(props.groups, day.key),
}])))

function dayClasses(day: CockpitDay) {
  return [
    day.isToday ? 'bg-primary/10' : day.isWeekend && 'bg-muted/40',
    props.highlightNights?.has(day.key) && 'bg-primary/15',
  ]
}

/* ------------------------------------------------------------ now line */

const now = ref(new Date())
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  tick = setInterval(() => { now.value = new Date() }, 60_000)
})
onBeforeUnmount(() => clearInterval(tick))

const nowLeft = computed(() => {
  if (!todayKey.value)
    return null
  const fraction = nowFraction(dayKeys.value, todayKey.value, now.value.getHours() * 60 + now.value.getMinutes())
  return fraction === null ? null : `calc(var(--cockpit-left) + (100% - var(--cockpit-left)) * ${fraction})`
})
const nowLabel = computed(() => now.value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))

/**
 * The time pill hangs half below the sticky header, so the listing column
 * cannot cover that half when the board scrolls sideways. Hide the pill once
 * its left edge slides under the column.
 */
const headerCorner = useTemplateRef<HTMLElement>('headerCorner')
const nowPill = useTemplateRef<HTMLElement>('nowPill')
const nowPillHidden = ref(false)

function updateNowPill() {
  if (!headerCorner.value || !nowPill.value)
    return
  nowPillHidden.value = nowPill.value.getBoundingClientRect().left < headerCorner.value.getBoundingClientRect().right
}

watch([nowLeft, () => props.days.length], () => nextTick(updateNowPill), { immediate: true })

/**
 * Scroll the board sideways so today's column is the first one after the
 * listing column (as far as the board can scroll). The page calls it from
 * Today; the board also does it once when it opens. No-op when today is not
 * in the period.
 */
const scroller = useTemplateRef<HTMLElement>('scroller')

function scrollToToday(smooth = true) {
  const box = scroller.value
  const corner = headerCorner.value
  const cell = box?.querySelector<HTMLElement>('[data-today]')
  if (!box || !corner || !cell)
    return
  const left = box.scrollLeft + cell.getBoundingClientRect().left - corner.getBoundingClientRect().right
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  box.scrollTo({ left: Math.max(0, left), behavior: smooth && !reduced ? 'smooth' : 'auto' })
}

onMounted(() => nextTick(() => scrollToToday(false)))

defineExpose({ scrollToToday })
useEventListener('resize', updateNowPill)

/* ------------------------------------------------------------ bars */

interface PlacedBar {
  booking: Booking
  lane: number
  startHalf: number
  endHalf: number
  continuesBefore: boolean
  continuesAfter: boolean
}

function place(stays: Booking[]) {
  return stays
    .filter(booking => stayVisible(booking, bookingReservationStatus(booking), filters.value))
    .map(booking => ({ booking, span: stayBarSpan(booking.checkIn, booking.checkOut, dayKeys.value) }))
    .filter((p): p is { booking: Booking, span: NonNullable<typeof p.span> } => p.span !== null)
}

/**
 * Live stays stack in lanes. Cancelled stays have their own lanes BELOW the
 * live ones: each is a short grid row, and its bar aligns to the bottom and
 * overflows up into the row above, so it tucks under the bar there and stays
 * readable. Overlapping cancelled stays stack instead of hiding each other.
 */
function layoutRow(row: CockpitRow) {
  const live = place(row.stays.filter(s => s.status !== 'cancelled'))
  const { lanes, laneCount } = assignStayLanes(live.map(p => p.span))
  const gone = place(row.stays.filter(s => s.status === 'cancelled'))
  const cancelledLanes = assignStayLanes(gone.map(p => p.span))
  return {
    bars: live.map((p, i): PlacedBar => ({ booking: p.booking, lane: lanes[i]!, ...p.span })),
    cancelled: gone.map((p, i): PlacedBar => ({ booking: p.booking, lane: cancelledLanes.lanes[i]!, ...p.span })),
    laneCount: Math.max(1, laneCount),
    cancelledLaneCount: cancelledLanes.laneCount,
  }
}

/**
 * The bars drawn for one placed stay: a direct stay extended in place is cut
 * where the added nights begin (or, early arrival, end), so the stay and its
 * extension read as two bars with the link icon between them, like an OTA
 * stay and its linked booking. Lanes, keyboard moves, marks and links still
 * use the whole stay.
 */
function barSegments(row: CockpitRow, bar: PlacedBar): PlacedBar[] {
  const cuts = inPlaceExtensionJoins({ ...row, stays: [bar.booking] }, extensionsByStay.value)
    .map(join => dayKeys.value.indexOf(join.key))
    .filter(day => day !== -1)
    .map(day => day * HALF_DAYS_PER_DAY + 1)
  return splitSpan(bar, cuts)
}

function barStyle(bar: PlacedBar) {
  return { gridColumn: `${bar.startHalf + 2} / ${bar.endHalf + 2}`, gridRow: `${bar.lane + 1}`, alignSelf: 'center' }
}

/** Cancelled lane `n` sits after the live lanes; earlier lanes paint over later ones. */
function cancelledStyle(bar: PlacedBar, laneCount: number) {
  return { gridColumn: `${bar.startHalf + 2} / ${bar.endHalf + 2}`, gridRow: `${laneCount + bar.lane + 1}`, alignSelf: 'end', zIndex: 5 - bar.lane }
}

/** Live lanes, then one short row per cancelled lane. */
function rowTemplate(laneCount: number, cancelledLaneCount: number) {
  return `repeat(${laneCount}, minmax(2.5rem, auto))${cancelledLaneCount ? ` repeat(${cancelledLaneCount}, 1.5rem)` : ''}`
}

/** Gold dots where a stay arrives or leaves today, at that end of the bar. */
function todayMarks(bars: PlacedBar[]) {
  const today = todayKey.value
  if (!today)
    return []
  return bars.flatMap((bar) => {
    const marks: Array<{ key: string, label: string, style: Record<string, string> }> = []
    const row = `${bar.lane + 1}`
    if (bar.booking.checkIn === today && !bar.continuesBefore)
      marks.push({ key: `${bar.booking.id}-in`, label: `${bar.booking.guestName} arrives today`, style: { gridColumn: `${bar.startHalf + 2}`, gridRow: row, justifySelf: 'start', alignSelf: 'start' } })
    if (bar.booking.checkOut === today && !bar.continuesAfter)
      marks.push({ key: `${bar.booking.id}-out`, label: `${bar.booking.guestName} leaves today`, style: { gridColumn: `${bar.endHalf + 1}`, gridRow: row, justifySelf: 'end', alignSelf: 'start' } })
    return marks
  })
}

/**
 * A link icon in the slanted gap where a stay and its extension meet: midday
 * of the shared date, on the stay's lane. Only when both bars are drawn on
 * this row and the date is in view. Opens the extension.
 */
function formatDayShort(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * Link icons where a stay and its added nights meet: between two bars for a
 * linked booking (an OTA stay), inside the one bar for a direct stay extended
 * in place. A click opens the added nights' reservation.
 */
function extensionLinks(row: CockpitRow, bars: PlacedBar[]) {
  const byId = new Map(bars.map(b => [b.booking.id, b]))
  // Midday of the shared date is the boundary after half-column `2 * day`; the icon spans the halves either side of it.
  const place = (key: string, lane: number) => {
    const day = dayKeys.value.indexOf(key)
    if (day === -1)
      return null
    const boundary = day * HALF_DAYS_PER_DAY + 1
    return { gridColumn: `${boundary + 1} / span 2`, gridRow: `${lane + 1}`, justifySelf: 'center', alignSelf: 'center' }
  }
  const linked = extensionJoins(row, extensionOf.value).flatMap((join) => {
    const original = byId.get(join.originalId)
    const extension = byId.get(join.extensionId)
    const style = original && extension ? place(join.key, original.lane) : null
    if (!original || !extension || !style)
      return []
    return [{
      key: `${join.originalId}-${join.extensionId}`,
      extension: extension.booking,
      label: `${extension.booking.guestName}: extension of the stay. Open the added nights.`,
      style,
    }]
  })
  const inPlace = inPlaceExtensionJoins(row, extensionsByStay.value).flatMap((join) => {
    const bar = byId.get(join.stayId)
    const style = bar ? place(join.key, bar.lane) : null
    if (!bar || !style)
      return []
    const nights = `${join.extraNights} ${join.extraNights === 1 ? 'night' : 'nights'}`
    const what = join.direction === 'before' ? `arrives earlier, ${nights} added before ${formatDayShort(join.key)}` : `extended, ${nights} added from ${formatDayShort(join.key)}`
    return [{
      key: `${join.stayId}-${join.extensionId}`,
      extension: bar.booking,
      label: `${bar.booking.guestName}: ${what}. Open the stay.`,
      style,
    }]
  })
  return [...linked, ...inPlace]
}

/* ------------------------------------------------------------ listing column */

function listingTitle(listing: Listing) {
  const channels = listing.otaConnected.length ? `Connected to ${listing.otaConnected.join(', ')}` : 'No channel connected'
  return `Open listing. ${channels}.`
}

/** The unit row of a single-unit listing has no room name of its own. */
function unitRowName(group: CockpitGroup, row: CockpitRow) {
  if (row.kind === 'room')
    return row.name
  return group.listing.room?.trim() || 'Whole property'
}

/* ------------------------------------------------------------ date overrides */

const { overrides } = useCockpitOverrides()

/** Overrides on a night, for a room type or (null) a single-unit listing. */
function dayOverrides(group: CockpitGroup, typeId: string | null, key: string) {
  return overridesOn(overrides.value, group.listing.id, typeId, key)
}

/** " Overrides: Min Stay 3 nights, Stop Sell." for a tooltip, or nothing. */
function overrideNote(group: CockpitGroup, typeId: string | null, key: string, currency: string) {
  const parts = describeOverrides(dayOverrides(group, typeId, key), currency)
  return parts.length ? ` Overrides: ${parts.join(', ')}.` : ''
}

/** A restriction other than the rate is overridden that night: the band shows a marker. */
function hasRestriction(group: CockpitGroup, typeId: string | null, key: string) {
  const { rate: _rate, ...rest } = dayOverrides(group, typeId, key)
  return Object.keys(rest).length > 0
}

/** The night's rate: an override, else the listing's (seasonal) rate. */
function listingRateOn(group: CockpitGroup, key: string) {
  return dayOverrides(group, null, key).rate ?? nightlyRateOn(group.listing, key)
}

function typeRateOn(group: CockpitGroup, type: CockpitRoomType, key: string) {
  return dayOverrides(group, type.id, key).rate ?? type.rate
}

/** A room type's rooms open to sell that night: free rooms, less what its overrides close. */
function typeSellable(group: CockpitGroup, type: CockpitRoomType, key: string) {
  return sellableUnits(typeFreeUnits(group, type.id, key), type.unitCount, dayOverrides(group, type.id, key))
}

/**
 * The listing header's count: units open to sell. A single-unit listing reads
 * its own overrides; a multi-unit one takes off what each room type's
 * overrides close.
 */
function listingSellable(group: CockpitGroup, key: string) {
  const free = freeUnits(group, key)
  if (!group.types.length)
    return sellableUnits(free, group.unitCount, dayOverrides(group, null, key))
  const closed = group.types.reduce((sum, type) => sum + typeFreeUnits(group, type.id, key) - typeSellable(group, type, key), 0)
  return Math.max(0, free - closed)
}

/** "2 of 3 units free" or, when overrides close some, "1 of 3 units open to sell (2 free)". */
function countPhrase(open: number, free: number, total: number, noun: [string, string]) {
  const word = total === 1 ? noun[0] : noun[1]
  return open === free ? `${free} of ${total} ${word} free` : `${open} of ${total} ${word} open to sell (${free} free)`
}

function freeLabel(group: CockpitGroup, key: string) {
  const units = countPhrase(listingSellable(group, key), freeUnits(group, key), group.unitCount, ['unit', 'units'])
  // A multi-unit listing's rates are per room type, on the type rows.
  if (group.types.length)
    return units
  const currency = listingCurrency(group.listing)
  return `${units}, ${formatMoney(listingRateOn(group, key), currency)} a night.${overrideNote(group, null, key, currency)}`
}

function typeFreeLabel(group: CockpitGroup, type: CockpitRoomType, key: string) {
  const units = countPhrase(typeSellable(group, type, key), typeFreeUnits(group, type.id, key), type.unitCount, ['room', 'rooms'])
  return `${type.name}: ${units}, ${formatMoney(typeRateOn(group, type, key), type.currency)} a night.${overrideNote(group, type.id, key, type.currency)}`
}

/** `USD 185`, whole amounts, so it fits a day column. Cents are in the tooltip. */
function pill(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString(currency === 'CHF' ? 'de-CH' : 'en-US', { maximumFractionDigits: 0 })}`
}

/** The pill: `USD 185`, whole amounts, so it fits a day column. Cents are in the tooltip. */
function ratePill(group: CockpitGroup, key: string) {
  return pill(listingCurrency(group.listing), listingRateOn(group, key))
}

interface VisibleRow extends ReturnType<typeof layoutRow> {
  row: CockpitRow
  marks: ReturnType<typeof todayMarks>
  links: ReturnType<typeof extensionLinks>
  /** Position among all visible unit rows, for arrow-key moves between rows. */
  index: number
}

/** The fold key of a room type's header row. */
function typeFoldId(listingId: string, typeId: string) {
  return `${listingId}:type:${typeId}`
}

/**
 * A listing's rows in sections: a single-unit listing is one section with no
 * header; a multi-unit listing has one section per room type (its header row
 * carries that type's free rooms and rate), then the "Not assigned to a room"
 * row on its own.
 */
interface VisibleSection {
  key: string
  type: CockpitRoomType | null
  rows: VisibleRow[]
}

const visibleGroups = computed(() => {
  let index = 0
  const toVisible = (row: CockpitRow): VisibleRow => {
    const layout = layoutRow(row)
    return { row, ...layout, marks: todayMarks(layout.bars), links: extensionLinks(row, layout.bars), index: index++ }
  }
  const shown = (row: CockpitRow) => !props.matchingRows || props.matchingRows.has(row.id)
  return props.groups.map((group) => {
    if (collapsed.value.has(group.listing.id))
      return { group, sections: [] as VisibleSection[] }
    if (!group.types.length)
      return { group, sections: [{ key: group.listing.id, type: null, rows: group.rows.filter(shown).map(toVisible) }] }
    const sections: VisibleSection[] = group.types
      .map(type => ({
        key: typeFoldId(group.listing.id, type.id),
        type,
        rows: collapsed.value.has(typeFoldId(group.listing.id, type.id))
          ? []
          : group.rows.filter(r => r.kind === 'room' && r.typeId === type.id && shown(r)).map(toVisible),
      }))
      // Find availability hides room types with no matching room.
      .filter(section => !props.matchingRows || group.rows.some(r => r.typeId === section.type.id && shown(r)))
    const unassigned = group.rows.filter(r => r.kind === 'unassigned' && shown(r))
    if (unassigned.length)
      sections.push({ key: `${group.listing.id}:unassigned`, type: null, rows: unassigned.map(toVisible) })
    return { group, sections }
  })
})

/* ------------------------------------------------------------ drag a stay onto a room */

const dragging = ref<{ bookingId: string, listingId: string } | null>(null)
const dropTarget = ref<string | null>(null)

/** A stay of a multi-unit listing with no priced rooms can be moved between rooms. */
function canDrag(group: CockpitGroup, booking: Booking) {
  return group.unitCount > 1 && booking.status !== 'cancelled' && canAssignRoom(booking, reservations.value)
}

function acceptsDrop(group: CockpitGroup, row: CockpitRow) {
  return !!dragging.value && dragging.value.listingId === group.listing.id && (row.kind === 'room' || row.kind === 'unassigned')
}

function onDragOver(event: DragEvent, group: CockpitGroup, row: CockpitRow) {
  if (!acceptsDrop(group, row))
    return
  event.preventDefault()
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'move'
  dropTarget.value = row.id
}

function onDrop(event: DragEvent, group: CockpitGroup, row: CockpitRow) {
  if (!acceptsDrop(group, row))
    return
  event.preventDefault()
  const id = dragging.value!.bookingId
  endDrag()
  emit('assign', id, row.kind === 'room' ? row.unitId : null)
}

function endDrag() {
  dragging.value = null
  dropTarget.value = null
}

/* ------------------------------------------------------------ click or drag across free nights */

const selection = ref<{ group: CockpitGroup, row: CockpitRow, anchor: string, current: string } | null>(null)

function startSelect(event: PointerEvent, group: CockpitGroup, row: CockpitRow, key: string) {
  if (event.button !== 0 || row.kind === 'unassigned' || !isRowFree(group, row, key))
    return
  event.preventDefault()
  selection.value = { group, row, anchor: key, current: key }
}

function extendSelect(row: CockpitRow, key: string) {
  if (selection.value && selection.value.row.id === row.id)
    selection.value = { ...selection.value, current: key }
}

/** The stay being dragged, drawn where its bar will sit (midday to midday) with its dates. */
const selectionPreview = computed(() => {
  const sel = selection.value
  if (!sel)
    return null
  const stay = selectionStay(sel.anchor, sel.current)
  const span = stayBarSpan(stay.checkIn, stay.checkOut, dayKeys.value)
  if (!span)
    return null
  const nights = dayKeys.value.filter(k => k >= stay.checkIn && k < stay.checkOut)
  const free = nights.every(k => isRowFree(sel.group, sel.row, k))
  const fmt = (key: string) => {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  const count = Math.round((Date.parse(stay.checkOut) - Date.parse(stay.checkIn)) / 86_400_000)
  return {
    rowId: sel.row.id,
    free,
    // The night count fits even a one-night bar; the dialog that follows names the dates.
    label: `${count} ${count === 1 ? 'night' : 'nights'}`,
    title: `${fmt(stay.checkIn)} to ${fmt(stay.checkOut)}`,
    style: {
      gridColumn: `${span.startHalf + 2} / ${span.endHalf + 2}`,
      gridRow: '1 / -1',
      alignSelf: 'center',
      clipPath: 'polygon(0.6rem 0, 100% 0, calc(100% - 0.6rem) 100%, 0 100%)',
    },
  }
})

function finishSelect() {
  const sel = selection.value
  if (!sel)
    return
  selection.value = null
  const stay = selectionStay(sel.anchor, sel.current)
  const nights = dayKeys.value.filter(k => k >= stay.checkIn && k < stay.checkOut)
  emit('create', {
    listing: sel.group.listing,
    unitId: sel.row.kind === 'room' ? sel.row.unitId : null,
    rowName: sel.row.kind === 'room' ? `${sel.group.listing.name}, ${sel.row.name}` : sel.group.listing.name,
    ...stay,
    free: nights.every(k => isRowFree(sel.group, sel.row, k)),
  })
}

onMounted(() => window.addEventListener('pointerup', finishSelect))
onBeforeUnmount(() => window.removeEventListener('pointerup', finishSelect))

/* ------------------------------------------------------------ keyboard */

/**
 * Arrow keys move between bars: left and right along the row, up and down to
 * the bar nearest the same date in the row above or below. Enter opens it.
 */
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.matches('[data-cockpit-bar]') || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
    return
  const all = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-cockpit-bar]')]
    .map(el => ({ el, row: Number(el.dataset.rowIndex), start: Number(el.dataset.start) }))
  const here = { row: Number(target.dataset.rowIndex), start: Number(target.dataset.start) }
  let next: HTMLElement | undefined
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const sameRow = all.filter(b => b.row === here.row).sort((a, b) => a.start - b.start)
    const at = sameRow.findIndex(b => b.el === target)
    next = sameRow[at + (event.key === 'ArrowRight' ? 1 : -1)]?.el
  }
  else {
    const step = event.key === 'ArrowDown' ? 1 : -1
    const rows = [...new Set(all.map(b => b.row))]
    const targetRow = rows.filter(r => step > 0 ? r > here.row : r < here.row).sort((a, b) => step * (a - b))[0]
    if (targetRow !== undefined)
      next = all.filter(b => b.row === targetRow).sort((a, b) => Math.abs(a.start - here.start) - Math.abs(b.start - here.start))[0]?.el
  }
  if (next) {
    event.preventDefault()
    next.focus()
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-col gap-2 [--cockpit-left:9rem] md:[--cockpit-left:17rem]">
    <!-- Phone: the tools sit above the board; the listing column is names only. -->
    <div class="rounded-lg border bg-card p-2 md:hidden">
      <CockpitBoardTools
        v-model:search="search"
        v-model:tags="tags"
        v-model:filters="filters"
        :can-fold="groups.length > 0"
        :all-collapsed="allCollapsed"
        @toggle-all="toggleAll"
      />
    </div>

    <div ref="scroller" class="min-h-0 flex-1 overflow-auto rounded-lg border bg-card" data-testid="cockpit-timeline" @keydown="onKeydown" @scroll.passive="updateNowPill">
      <div class="relative" :style="{ minWidth: `calc(var(--cockpit-left) + ${days.length * 7}rem)` }">
        <!-- Header: tools on the left, the dates across -->
        <div class="sticky top-0 z-30 grid border-b bg-card" :style="{ gridTemplateColumns: gridColumns }">
          <div ref="headerCorner" class="sticky left-0 z-10 flex flex-col justify-between gap-2 border-r bg-card p-2">
            <div class="hidden md:block">
              <CockpitBoardTools
                v-model:search="search"
                v-model:tags="tags"
                v-model:filters="filters"
                :legend="false"
                :fold="false"
                :can-fold="groups.length > 0"
                :all-collapsed="allCollapsed"
                @toggle-all="toggleAll"
              />
            </div>
            <div class="flex items-center gap-1 px-1">
              <span class="text-sm font-semibold">All listings</span>
              <span class="hidden md:inline-flex"><CockpitLegend compact /></span>
              <Button
                v-if="groups.length > 0"
                variant="ghost"
                size="icon"
                class="ml-auto hidden size-6 md:inline-flex"
                :aria-label="allCollapsed ? 'Expand all rooms' : 'Collapse all rooms'"
                :title="allCollapsed ? 'Expand all rooms' : 'Collapse all rooms'"
                @click="toggleAll"
              >
                <Icon :name="allCollapsed ? 'lucide:chevrons-up-down' : 'lucide:chevrons-down-up'" class="size-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <div
            v-for="(day, index) in days"
            :key="day.key"
            class="flex flex-col items-center justify-end gap-0.5 border-r pt-2 pb-1.5 last:border-r-0"
            :class="[
              dayClasses(day),
              monthLabel(day, index) && index !== 0 && 'border-l border-l-foreground/25',
            ]"
            :style="{ gridColumn: dayColumn(index) }"
            :data-today="day.isToday || undefined"
          >
            <span
              class="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums"
              :class="dayStats.get(day.key)!.arrivals ? 'bg-foreground text-background' : 'invisible'"
              :title="`${dayStats.get(day.key)!.arrivals} ${dayStats.get(day.key)!.arrivals === 1 ? 'arrival' : 'arrivals'}`"
              :aria-label="`${dayStats.get(day.key)!.arrivals} arrivals`"
              data-testid="cockpit-day-arrivals"
            >{{ dayStats.get(day.key)!.arrivals }}</span>
            <span class="text-xs leading-none" :class="day.isToday ? 'font-semibold text-foreground' : 'text-muted-foreground'">
              <span v-if="monthLabel(day, index)" class="mr-1 font-semibold text-foreground">{{ monthLabel(day, index) }}</span>{{ day.weekday }}
            </span>
            <span
              class="flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-xl leading-none font-bold tabular-nums"
              :class="day.isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'"
            >{{ Number(day.day) }}</span>
            <span class="text-[11px] leading-none text-muted-foreground tabular-nums" :title="`${dayStats.get(day.key)!.occupancy}% of units booked`" data-testid="cockpit-day-occupancy">{{ dayStats.get(day.key)!.occupancy }}%</span>
          </div>

          <!-- Now: where the line enters the board, with the time -->
          <div
            v-if="nowLeft"
            ref="nowPill"
            class="pointer-events-none absolute bottom-0 z-[1] -translate-x-1/2 translate-y-1/2"
            :class="nowPillHidden && 'invisible'"
            :style="{ left: nowLeft }"
            aria-hidden="true"
            data-testid="cockpit-now-pill"
          >
            <span class="block rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none font-semibold tabular-nums text-primary-foreground shadow-sm">{{ nowLabel }}</span>
          </div>
        </div>

        <!-- Now line through every row; the sticky listing column draws over it. -->
        <div
          v-if="nowLeft"
          class="pointer-events-none absolute inset-y-0 z-[15] w-0.5 -translate-x-1/2 bg-primary"
          :style="{ left: nowLeft }"
          :title="`Now, ${nowLabel}`"
          data-testid="cockpit-now"
          aria-hidden="true"
        />

        <!-- Body -->
        <template v-for="{ group, sections } in visibleGroups" :key="group.listing.id">
          <!-- Listing header: name, then free units and the rate per night -->
          <div class="grid border-b bg-muted/30" :style="{ gridTemplateColumns: gridColumns }" data-testid="cockpit-group">
            <div class="sticky left-0 z-20 flex min-h-14 items-center gap-1 border-r bg-muted px-2">
              <div class="flex min-w-0 flex-1 flex-col">
                <NuxtLink
                  :to="`/listings/${group.listing.id}`"
                  class="flex min-w-0 flex-col rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  :title="listingTitle(group.listing)"
                >
                  <span class="truncate text-sm font-bold">{{ group.listing.name }}</span>
                </NuxtLink>
                <div class="flex min-w-0 items-center gap-2">
                  <span class="hidden min-w-0 truncate text-xs text-muted-foreground md:block">{{ group.unitCount > 1 ? `${group.unitCount} rooms, ` : '' }}{{ group.listing.location }}</span>
                  <CockpitChannelLinks v-if="!group.types.length" :listing="group.listing" />
                </div>
              </div>
              <CockpitListingScore :listing="group.listing" />
              <Button
                variant="ghost"
                size="icon"
                class="size-7 shrink-0"
                :aria-label="collapsed.has(group.listing.id) ? `Show ${group.listing.name}` : `Fold ${group.listing.name}`"
                :aria-expanded="!collapsed.has(group.listing.id)"
                @click="toggleGroup(group.listing.id)"
              >
                <Icon name="lucide:chevron-right" class="size-4 transition-transform motion-reduce:transition-none" :class="!collapsed.has(group.listing.id) && 'rotate-90'" />
              </Button>
            </div>
            <div
              v-for="(day, index) in days"
              :key="day.key"
              class="flex flex-col items-center justify-center gap-1 border-r py-1.5 last:border-r-0"
              :class="dayClasses(day)"
              :style="{ gridColumn: dayColumn(index) }"
              :title="freeLabel(group, day.key)"
              :aria-label="`${day.weekday} ${Number(day.day)}: ${freeLabel(group, day.key)}`"
              data-testid="cockpit-band"
            >
              <span class="flex items-center gap-0.5">
                <span
                  class="text-xs leading-none tabular-nums"
                  :class="[
                    listingSellable(group, day.key) === 0 ? 'font-semibold text-destructive' : 'text-foreground',
                    listingSellable(group, day.key) < freeUnits(group, day.key) && 'underline decoration-primary decoration-2 underline-offset-2',
                  ]"
                  data-testid="cockpit-free"
                >{{ listingSellable(group, day.key) }}</span>
                <Icon v-if="!group.types.length && hasRestriction(group, null, day.key)" name="lucide:sliders-horizontal" class="size-3 text-primary" data-testid="cockpit-override-mark" />
              </span>
              <span
                v-if="!group.types.length"
                class="rounded-full border bg-card px-2 py-0.5 text-[11px] leading-none font-medium tabular-nums"
                :class="dayOverrides(group, null, day.key).rate !== undefined && 'border-primary text-primary'"
                data-testid="cockpit-rate-pill"
              >{{ ratePill(group, day.key) }}</span>
            </div>
          </div>

          <template v-for="section in sections" :key="section.key">
            <!-- Room type header: its own free rooms and its own rate -->
            <div v-if="section.type" class="grid border-b bg-muted/10" :style="{ gridTemplateColumns: gridColumns }" data-testid="cockpit-type">
              <div class="sticky left-0 z-20 flex min-h-12 items-center gap-1 border-r bg-card pr-2 pl-3 md:pl-4">
                <div class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-sm font-semibold">{{ section.type.name }}</span>
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="hidden truncate text-xs text-muted-foreground md:block">{{ section.type.unitCount }} {{ section.type.unitCount === 1 ? 'room' : 'rooms' }}</span>
                    <CockpitChannelLinks :listing="group.listing" :room-type="section.type" />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 shrink-0"
                  :aria-label="collapsed.has(section.key) ? `Show ${section.type.name}` : `Fold ${section.type.name}`"
                  :aria-expanded="!collapsed.has(section.key)"
                  @click="toggleGroup(section.key)"
                >
                  <Icon name="lucide:chevron-right" class="size-4 transition-transform motion-reduce:transition-none" :class="!collapsed.has(section.key) && 'rotate-90'" />
                </Button>
              </div>
              <div
                v-for="(day, index) in days"
                :key="day.key"
                class="flex flex-col items-center justify-center gap-1 border-r py-1 last:border-r-0"
                :class="dayClasses(day)"
                :style="{ gridColumn: dayColumn(index) }"
                :title="typeFreeLabel(group, section.type, day.key)"
                :aria-label="`${day.weekday} ${Number(day.day)}: ${typeFreeLabel(group, section.type, day.key)}`"
                data-testid="cockpit-type-band"
              >
                <span class="flex items-center gap-0.5">
                  <span
                    class="text-xs leading-none tabular-nums"
                    :class="[
                      typeSellable(group, section.type, day.key) === 0 ? 'font-semibold text-destructive' : 'text-foreground',
                      typeSellable(group, section.type, day.key) < typeFreeUnits(group, section.type.id, day.key) && 'underline decoration-primary decoration-2 underline-offset-2',
                    ]"
                    data-testid="cockpit-type-free"
                  >{{ typeSellable(group, section.type, day.key) }}</span>
                  <Icon v-if="hasRestriction(group, section.type.id, day.key)" name="lucide:sliders-horizontal" class="size-3 text-primary" data-testid="cockpit-override-mark" />
                </span>
                <span
                  class="rounded-full border bg-card px-2 py-0.5 text-[11px] leading-none font-medium tabular-nums"
                  :class="dayOverrides(group, section.type.id, day.key).rate !== undefined && 'border-primary text-primary'"
                  data-testid="cockpit-rate-pill"
                >{{ pill(section.type.currency, typeRateOn(group, section.type, day.key)) }}</span>
              </div>
            </div>

            <!-- Unit rows: the listing itself, or each room. Bars only. -->
            <div
              v-for="{ row, bars, cancelled, laneCount, cancelledLaneCount, marks, links, index: rowIndex } in section.rows"
              :key="row.id"
              class="grid border-b transition-colors select-none motion-reduce:transition-none"
              :class="dropTarget === row.id && 'bg-primary/10 ring-2 ring-primary ring-inset'"
              :style="{ gridTemplateColumns: gridColumns, gridTemplateRows: rowTemplate(laneCount, cancelledLaneCount) }"
              data-testid="cockpit-row"
              :data-row="row.id"
              @dragover="onDragOver($event, group, row)"
              @dragleave="dropTarget === row.id && (dropTarget = null)"
              @drop="onDrop($event, group, row)"
            >
              <div
                class="sticky left-0 z-20 flex items-center gap-2 border-r bg-card px-3 md:pl-4"
                :style="{ gridColumn: '1', gridRow: '1 / -1' }"
              >
                <template v-if="row.kind === 'unassigned'">
                  <Icon name="lucide:circle-help" class="size-4 shrink-0 text-muted-foreground" />
                  <span class="truncate text-sm text-muted-foreground">{{ row.name }}</span>
                </template>
                <div v-else class="flex min-w-0 flex-1 items-baseline gap-2">
                  <span class="truncate text-sm">{{ unitRowName(group, row) }}</span>
                </div>
                <div class="ml-auto flex shrink-0 items-center gap-1.5">
                  <!-- Housekeeping today: icon only, the sentence in the tooltip. A click opens the cleaning. -->
                  <button
                    v-if="roomCleaning?.get(row.id)"
                    type="button"
                    class="flex size-5 items-center justify-center rounded-full border transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:hover:scale-100"
                    :class="roomCleaningMeta[roomCleaning.get(row.id)!.state].classes"
                    :title="roomCleaning.get(row.id)!.detail"
                    :aria-label="`${roomCleaning.get(row.id)!.detail} ${roomCleaning.get(row.id)!.jobId ? 'Open the cleaning.' : 'Schedule a cleaning.'}`"
                    data-testid="cockpit-room-cleaning"
                    @click="emit('openCleaning', { listingId: group.listing.id, unitId: row.unitId, jobId: roomCleaning.get(row.id)!.jobId })"
                  >
                    <Icon :name="ROOM_CLEANING_ICON" class="size-3" />
                  </button>
                  <CockpitRoomTasks
                    v-if="row.kind !== 'unassigned'"
                    :tasks="openTasks.get(row.id) ?? []"
                    :room-name="group.listing.unitType === 'multi' ? `${group.listing.name}, ${unitRowName(group, row)}` : group.listing.name"
                    :today-key="todayKey ?? ''"
                    @open-task="emit('openTask', $event)"
                  />
                </div>
              </div>

              <div
                v-for="(day, index) in days"
                :key="day.key"
                class="border-r last:border-r-0"
                :class="[
                  dayClasses(day),
                  group.listing.blockedDates.includes(day.key) && 'bg-muted',
                  row.kind !== 'unassigned' && isRowFree(group, row, day.key) && 'cursor-cell hover:bg-accent/60',
                ]"
                :style="{ gridColumn: dayColumn(index), gridRow: '1 / -1' }"
                :title="row.kind !== 'unassigned' && isRowFree(group, row, day.key) ? 'Free. Click or drag to book.' : undefined"
                data-testid="cockpit-day-cell"
                @pointerdown="startSelect($event, group, row, day.key)"
                @pointerenter="extendSelect(row, day.key)"
              />

              <!-- Drag preview: where the new stay will sit, red when a night in it is taken -->
              <div
                v-if="selectionPreview?.rowId === row.id"
                class="pointer-events-none z-[12] my-1 flex h-8 items-center px-4 text-xs font-medium ring-2 ring-inset"
                :class="selectionPreview.free ? 'bg-primary/25 text-foreground ring-primary' : 'bg-destructive/15 text-destructive ring-destructive'"
                :style="selectionPreview.style"
                :aria-label="`${selectionPreview.title}, ${selectionPreview.label}`"
                data-testid="cockpit-selection"
              >
                <span class="truncate">{{ selectionPreview.label }}</span>
              </div>

              <CockpitStayBar
                v-for="bar in cancelled"
                :key="`${bar.booking.id}-${row.id}`"
                :booking="bar.booking"
                :listing="group.listing"
                :continues-before="bar.continuesBefore"
                :continues-after="bar.continuesAfter"
                :grid-style="cancelledStyle(bar, laneCount)"
                :action-needed="actionNeeded?.has(bar.booking.id)"
                :check-in-time="checkInTimeOf(bar.booking, group.listing)"
                :upsells="upsellCounts?.get(bar.booking.id) ?? 0"
                :dimmed="!!focusIds && !focusIds.has(bar.booking.id)"
                :row-index="rowIndex"
                :start-half="bar.startHalf"
                @open="emit('open', $event, group.listing)"
                @open-inbox="emit('openInbox', $event)"
              />

              <CockpitStayBar
                v-for="{ bar, part, partIndex } in bars.flatMap(b => barSegments(row, b).map((part, partIndex) => ({ bar: b, part, partIndex })))"
                :key="`${bar.booking.id}-${row.id}-${partIndex}`"
                :booking="bar.booking"
                :listing="group.listing"
                :continues-before="part.continuesBefore"
                :continues-after="part.continuesAfter"
                :grid-style="barStyle(part)"
                :past="!!todayKey && bar.booking.checkOut <= todayKey"
                :action-needed="partIndex === 0 && actionNeeded?.has(bar.booking.id)"
                :check-in-time="checkInTimeOf(bar.booking, group.listing)"
                :upsells="upsellCounts?.get(bar.booking.id) ?? 0"
                :conflict="conflicts?.has(bar.booking.id)"
                :dimmed="!!focusIds && !focusIds.has(bar.booking.id)"
                :draggable="canDrag(group, bar.booking)"
                :row-index="rowIndex"
                :start-half="part.startHalf"
                @open="emit('open', $event, group.listing)"
                @open-inbox="emit('openInbox', $event)"
                @drag-start="dragging = { bookingId: $event.id, listingId: group.listing.id }"
                @drag-end="endDrag"
              />

              <span
                v-for="mark in marks"
                :key="mark.key"
                class="pointer-events-none z-[11] mt-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card"
                :style="mark.style"
                role="img"
                :aria-label="mark.label"
                :title="mark.label"
                data-testid="cockpit-today-mark"
              />

              <!-- Extension: a link where the stay and its added nights meet (between two bars, or inside a bar extended in place) -->
              <button
                v-for="link in links"
                :key="link.key"
                type="button"
                class="z-[12] flex size-5 items-center justify-center rounded-full border bg-card text-foreground shadow-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                :style="link.style"
                :aria-label="link.label"
                :title="link.label"
                data-testid="cockpit-extension-link"
                @click="emit('open', link.extension, group.listing)"
              >
                <Icon name="lucide:link-2" class="size-3" />
              </button>
            </div>
          </template>
        </template>

        <div v-if="!visibleGroups.length" class="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Icon name="lucide:search-x" class="size-6" />
          No listings match the search or filters.
        </div>
      </div>
    </div>
  </div>
</template>
