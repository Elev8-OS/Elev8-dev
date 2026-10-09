import type { Booking, Listing, UnitType } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { addIsoDays, isoDiffDays } from '~/components/gm/data/gm-dashboard'
import { stayUnitIds } from '~/components/listings/data/calendar-rooms'
import { ratePlanNightlyRate } from '~/components/listings/data/listings'
import { reservationToBooking } from '~/components/operations-calendar/data/calendar-stays'

/**
 * The Cockpit: every listing on one timeline, a header row per listing with
 * how much of it is still free each night, then a row per sellable unit (the
 * listing itself, or each room of a multi-unit listing) carrying its stays.
 *
 * Framework-free, like `gm-dashboard.ts`: the page owns the reactive state and
 * calls in.
 */

/** The period the board shows: a number of days, a calendar month, or a picked range. */
export type CockpitRange = '7' | '14' | '28' | 'month' | 'custom'

export const COCKPIT_RANGES: Array<{ value: CockpitRange, label: string }> = [
  { value: '7', label: '1 Week' },
  { value: '14', label: '2 Weeks' },
  { value: '28', label: '4 Weeks' },
  { value: 'month', label: '1 Month' },
  { value: 'custom', label: 'Custom' },
]

/** A picked range is capped at about three months, so the board stays fast. */
export const MAX_CUSTOM_DAYS = 92

/** `iso` plus `months`, keeping the day but clamping it to the month's end (31 Jan + 1 = 28 Feb). */
export function addIsoMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y!, m! - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d!, lastDay))
  return target.toISOString().slice(0, 10)
}

/** The 1st of the month `iso` falls in: 1 Month always shows a whole calendar month. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 8)}01`
}

/**
 * How many days the board shows from `startKey`. 1 Month runs to the day
 * before the same date next month (8 Oct to 7 Nov); Custom is its own length,
 * capped at `MAX_CUSTOM_DAYS`.
 */
export function rangeLength(range: CockpitRange, startKey: string, customDays: number): number {
  if (range === 'month')
    return isoDiffDays(startKey, addIsoMonths(startKey, 1))
  if (range === 'custom')
    return Math.min(MAX_CUSTOM_DAYS, Math.max(1, customDays))
  return Number(range)
}

export interface CockpitDay {
  key: string
  /** "Thu" */
  weekday: string
  /** "08" */
  day: string
  /** "October 2026", for the month band above the days. */
  month: string
  isToday: boolean
  isWeekend: boolean
}

function dateOf(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}

export function cockpitDays(startKey: string, count: number, todayKey: string): CockpitDay[] {
  return Array.from({ length: count }, (_, i) => {
    const key = addIsoDays(startKey, i)
    const date = dateOf(key)
    const dow = date.getUTCDay()
    return {
      key,
      weekday: date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
      day: String(date.getUTCDate()).padStart(2, '0'),
      month: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      isToday: key === todayKey,
      isWeekend: dow === 0 || dow === 6,
    }
  })
}

/** The month band: one span per month the visible days touch. */
export function monthSpans(days: CockpitDay[]): Array<{ label: string, start: number, count: number }> {
  const spans: Array<{ label: string, start: number, count: number }> = []
  days.forEach((day, index) => {
    const last = spans[spans.length - 1]
    if (last && last.label === day.month)
      last.count++
    else
      spans.push({ label: day.month, start: index, count: 1 })
  })
  return spans
}

/** A stay that holds the unit: not cancelled and not a bare inquiry. Blocks count. */
export function isLiveStay(booking: Pick<Booking, 'status'>): boolean {
  return booking.status !== 'cancelled' && booking.status !== 'inquiry'
}

/** The arrival night counts, the departure night does not. */
export function occupiesNight(booking: Pick<Booking, 'checkIn' | 'checkOut'>, key: string): boolean {
  return booking.checkIn <= key && key < booking.checkOut
}

export interface CockpitRow {
  /** `<listingId>` for a single-unit listing, `<listingId>:<unitId>` for a room, `<listingId>:unassigned`. */
  id: string
  kind: 'unit' | 'room' | 'unassigned'
  unitId: string | null
  name: string
  /** A room's room type name. */
  sublabel?: string
  /** A room's room type id, which groups it under that type's header row. */
  typeId?: string
  /** Most guests the unit sleeps, for Find availability. */
  capacity: number
  stays: Booking[]
}

/**
 * A room type of a multi-unit listing. Each has its own rate (its base rate
 * plan) and its own free count, so the board gives it a header row.
 */
export interface CockpitRoomType {
  id: string
  name: string
  /** Active rooms of this type. */
  unitCount: number
  /** The base rate plan's nightly rate; the listing rate when the type has no plan. */
  rate: number
  currency: string
}

export interface CockpitGroup {
  listing: Listing
  /** Sellable units: 1, or the listing's room count. */
  unitCount: number
  /** Room types with rooms, in the listing's order. Empty for a single-unit listing. */
  types: CockpitRoomType[]
  rows: CockpitRow[]
}

export const UNASSIGNED_ROW = 'unassigned'

export function rowIdFor(listingId: string, unitId: string | null): string {
  return unitId ? `${listingId}:${unitId}` : listingId
}

/** A room type's nightly rate: its base rate plan (else the first), else the listing's rate. */
export function roomTypeRate(type: UnitType, listing: Pick<Listing, 'pricing'>): number {
  const plan = type.pricing.ratePlans.find(rp => rp.isBase) ?? type.pricing.ratePlans[0]
  const rate = plan ? ratePlanNightlyRate(plan) : 0
  return rate > 0 ? rate : listing.pricing.nightlyRate
}

function roomTypesOf(listing: Listing, rooms: ReturnType<typeof listingRooms>): CockpitRoomType[] {
  return (listing.unitTypes ?? [])
    .map(type => ({
      id: type.id,
      name: type.name,
      unitCount: rooms.filter(r => r.type.id === type.id).length,
      rate: roomTypeRate(type, listing),
      currency: type.pricing.currency || listingCurrency(listing),
    }))
    .filter(type => type.unitCount > 0)
}

/** Rooms of one type free on a night. Stays with no room yet are not of any type. */
export function typeFreeUnits(group: CockpitGroup, typeId: string, key: string): number {
  if (group.listing.blockedDates.includes(key))
    return 0
  return group.rows.filter(r => r.kind === 'room' && r.typeId === typeId && isRowFree(group, r, key)).length
}

function listingRooms(listing: Listing) {
  if (listing.unitType !== 'multi')
    return []
  return (listing.unitTypes ?? []).flatMap(type => type.units
    .filter(unit => unit.status !== 'inactive')
    .map(unit => ({ unit, type })))
}

/**
 * The timeline's groups, one per active listing by name.
 *
 * ⚠️ Stays come from the Reservations module ONLY (what the Reservations page
 * lists), never `listing.bookings`, so every bar is a reservation and opens its
 * detail sheet. They are drawn in the calendar's `Booking` shape
 * (`reservationToBooking`, keeping the reservation id). A multi-unit listing's
 * stays go on the rooms they book (`stayUnitIds`), and those with no room yet on
 * a "Not assigned to a room" row, so nothing drops off the board.
 */
export function buildCockpitGroups(
  listings: Listing[],
  reservations: ReservationEntry[],
): CockpitGroup[] {
  return listings
    .filter(listing => listing.status !== 'inactive')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((listing) => {
      const stays = reservations
        .filter(r => r.listingId === listing.id)
        .map(reservationToBooking)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
      const rooms = listingRooms(listing)
      if (!rooms.length) {
        const row: CockpitRow = {
          id: listing.id,
          kind: 'unit',
          unitId: null,
          name: listing.name,
          capacity: listing.capacity,
          stays,
        }
        return { listing, unitCount: 1, types: [], rows: [row] }
      }
      const unitsByStay = new Map(stays.map(s => [s.id, stayUnitIds(s, reservations)]))
      const rows: CockpitRow[] = rooms.map(({ unit, type }) => {
        return {
          id: rowIdFor(listing.id, unit.id),
          kind: 'room',
          unitId: unit.id,
          name: unit.name,
          sublabel: type.name,
          typeId: type.id,
          capacity: type.maxAdults + type.maxChildren,
          stays: stays.filter(s => unitsByStay.get(s.id)?.includes(unit.id)),
        }
      })
      const unassigned = stays.filter(s => !unitsByStay.get(s.id)?.length)
      if (unassigned.length) {
        rows.push({
          id: `${listing.id}:${UNASSIGNED_ROW}`,
          kind: 'unassigned',
          unitId: null,
          name: 'Not assigned to a room',
          capacity: 0,
          stays: unassigned,
        })
      }
      return { listing, unitCount: rooms.length, types: roomTypesOf(listing, rooms), rows }
    })
}

/** True when a unit row has nothing holding the night. A listing's blocked date closes every unit. */
export function isRowFree(group: CockpitGroup, row: CockpitRow, key: string): boolean {
  if (group.listing.blockedDates.includes(key))
    return false
  return !row.stays.some(s => isLiveStay(s) && occupiesNight(s, key))
}

/**
 * Free units on a night. Stays not yet in a room still take one each, so a
 * listing with three rooms and three unassigned guests is full.
 */
export function freeUnits(group: CockpitGroup, key: string): number {
  if (group.listing.blockedDates.includes(key))
    return 0
  const units = group.rows.filter(r => r.kind !== 'unassigned')
  const free = units.filter(r => isRowFree(group, r, key)).length
  const unassignedHeld = group.rows
    .filter(r => r.kind === 'unassigned')
    .flatMap(r => r.stays)
    .filter(s => isLiveStay(s) && occupiesNight(s, key))
    .length
  return Math.max(0, free - unassignedHeld)
}

/** Share of the listing still free on a night, 0 to 100. 0% is sold out. */
export function availablePercent(group: CockpitGroup, key: string): number {
  if (!group.unitCount)
    return 0
  return Math.round((freeUnits(group, key) / group.unitCount) * 100)
}

/** The night's rate: a seasonal rate covering it, else the base nightly rate. */
export function nightlyRateOn(listing: Pick<Listing, 'pricing'>, key: string): number {
  const season = listing.pricing.seasonalRates.find(s => s.startDate <= key && key <= s.endDate)
  return season?.rate ?? listing.pricing.nightlyRate
}

export function listingCurrency(listing: Pick<Listing, 'unitTypes'>): string {
  return listing.unitTypes?.[0]?.pricing.currency ?? 'USD'
}

/** The ISO code, then the amount (`USD 150.00`, `IDR 500,000`), like the stay hover card. */
export function formatMoney(amount: number, currency: string): string {
  const decimals = currency === 'IDR' ? 0 : 2
  const locale = currency === 'CHF' ? 'de-CH' : 'en-US'
  return `${currency} ${amount.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

/** Rows that can take `guests` for every night of the stay, by listing. */
export interface AvailabilityQuery {
  checkIn: string
  checkOut: string
  guests: number
}

export function availableRowIds(groups: CockpitGroup[], query: AvailabilityQuery): Set<string> {
  const ids = new Set<string>()
  if (query.checkOut <= query.checkIn)
    return ids
  const nights: string[] = []
  for (let key = query.checkIn; key < query.checkOut; key = addIsoDays(key, 1))
    nights.push(key)
  for (const group of groups) {
    for (const row of group.rows) {
      if (row.kind === 'unassigned' || row.capacity < query.guests)
        continue
      if (nights.every(key => isRowFree(group, row, key) && freeUnits(group, key) > 0))
        ids.add(row.id)
    }
  }
  return ids
}

/** Name search and tags (every tag must match, like the Listings index). */
export function filterGroups(groups: CockpitGroup[], search: string, tags: string[]): CockpitGroup[] {
  const q = search.trim().toLowerCase()
  return groups.filter((group) => {
    if (tags.length && !tags.every(tag => group.listing.tags.includes(tag)))
      return false
    if (!q)
      return true
    return group.listing.name.toLowerCase().includes(q)
      || group.rows.some(row => row.name.toLowerCase().includes(q))
  })
}

/** Share of the listing booked on a night, 0 to 1. Drives the listing row's occupancy band. */
export function bookedShare(group: CockpitGroup, key: string): number {
  if (!group.unitCount)
    return 0
  return 1 - freeUnits(group, key) / group.unitCount
}

/**
 * Where "now" sits across the visible days, 0 to 1, or null when today is not
 * shown. Day `i` spans `[i / n, (i + 1) / n)`, so 14:00 on the first of seven
 * days is `(0 + 14 / 24) / 7`.
 */
export function nowFraction(dayKeys: string[], todayKey: string, minutesIntoDay: number): number | null {
  const index = dayKeys.indexOf(todayKey)
  if (index === -1 || !dayKeys.length)
    return null
  return (index + Math.min(1439, Math.max(0, minutesIntoDay)) / 1440) / dayKeys.length
}

/* ------------------------------------------------------------ conflicts */

/** A stay that takes the room: not cancelled and not an inquiry. */
function holdsRoom(booking: Pick<Booking, 'status'>) {
  return booking.status !== 'cancelled' && booking.status !== 'inquiry'
}

/**
 * Stays double booked in one room: two live stays in the same unit or room row
 * that share a night. Cancelled stays and inquiries never count, and the "Not
 * assigned to a room" row is not a room, so it is skipped.
 */
export function conflictIds(groups: CockpitGroup[]): Set<string> {
  const ids = new Set<string>()
  for (const group of groups) {
    for (const row of group.rows) {
      if (row.kind === 'unassigned')
        continue
      const live = row.stays.filter(holdsRoom)
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i]!
          const b = live[j]!
          if (a.checkIn < b.checkOut && b.checkIn < a.checkOut) {
            ids.add(a.id)
            ids.add(b.id)
          }
        }
      }
    }
  }
  return ids
}

/* ------------------------------------------------------------ today */

export type TodayKey = 'arrivals' | 'departures' | 'inHouse' | 'unassigned' | 'actionNeeded' | 'conflicts'

/**
 * Today's work as booking ids, for the strip above the board. Arrivals and
 * departures are live stays starting or ending today; in house is a stay that
 * started before today and ends after it; unassigned is a live stay with no
 * room that has not left yet; action needed is a stay that has not left yet
 * whose Inbox conversation is marked; conflicts are double bookings not over
 * yet. Blocks are not guests, so they count only as conflicts.
 */
export function todaySummary(groups: CockpitGroup[], todayKey: string, actionNeeded: Set<string>): Record<TodayKey, Set<string>> {
  const out: Record<TodayKey, Set<string>> = {
    arrivals: new Set(),
    departures: new Set(),
    inHouse: new Set(),
    unassigned: new Set(),
    actionNeeded: new Set(),
    conflicts: new Set(),
  }
  const conflicts = conflictIds(groups)
  for (const group of groups) {
    for (const row of group.rows) {
      for (const stay of row.stays) {
        const upcoming = stay.checkOut > todayKey
        if (conflicts.has(stay.id) && upcoming)
          out.conflicts.add(stay.id)
        if (!holdsRoom(stay) || stay.type === 'block')
          continue
        if (stay.checkIn === todayKey)
          out.arrivals.add(stay.id)
        if (stay.checkOut === todayKey)
          out.departures.add(stay.id)
        if (stay.checkIn < todayKey && upcoming)
          out.inHouse.add(stay.id)
        if (row.kind === 'unassigned' && upcoming)
          out.unassigned.add(stay.id)
        if (actionNeeded.has(stay.id) && stay.checkOut >= todayKey)
          out.actionNeeded.add(stay.id)
      }
    }
  }
  return out
}

/* ------------------------------------------------------------ filters */

/** What the board draws. Filters hide bars only: availability always counts every stay. */
export interface CockpitStayFilters {
  /** Statuses to show; empty = all. Cancelled is governed by `showCancelled` alone. */
  statuses: string[]
  /** Channels to show (`Booking.source`); empty = all. */
  channels: string[]
  showCancelled: boolean
  /** Only listings with a stay marked Action needed in the period. */
  actionOnly: boolean
}

export const DEFAULT_STAY_FILTERS: CockpitStayFilters = { statuses: [], channels: [], showCancelled: true, actionOnly: false }

/** How many filters differ from the defaults, for the filter button's badge. */
export function activeFilterCount(filters: CockpitStayFilters, tags: string[]): number {
  return (filters.statuses.length ? 1 : 0)
    + (filters.channels.length ? 1 : 0)
    + (filters.showCancelled ? 0 : 1)
    + (filters.actionOnly ? 1 : 0)
    + tags.length
}

/** Whether a stay's bar is drawn under the filters. `status` is the Reservations status of the bar. */
export function stayVisible(booking: Pick<Booking, 'source'>, status: string, filters: CockpitStayFilters): boolean {
  if (status === 'cancelled')
    return filters.showCancelled
  if (filters.statuses.length && !filters.statuses.includes(status))
    return false
  if (filters.channels.length && !filters.channels.includes(booking.source))
    return false
  return true
}

/** Listings with a stay marked Action needed that overlaps the days shown. */
export function groupsWithAction(groups: CockpitGroup[], actionNeeded: Set<string>, firstKey: string, lastKey: string): CockpitGroup[] {
  return groups.filter(group => group.rows.some(row => row.stays.some(s =>
    actionNeeded.has(s.id) && s.checkIn <= lastKey && s.checkOut > firstKey)))
}

/** True when any stay (cancelled ones too) touches the days shown. */
export function hasStaysIn(groups: CockpitGroup[], firstKey: string, lastKey: string): boolean {
  return groups.some(group => group.rows.some(row => row.stays.some(s => s.checkIn <= lastKey && s.checkOut >= firstKey)))
}

/* ------------------------------------------------------------ selection */

/** A click or drag across free nights of a unit row: the stay to create there. */
export interface CockpitCreateRequest {
  listing: Listing
  unitId: string | null
  rowName: string
  checkIn: string
  checkOut: string
  /** False when a night in the range is not free; the page says so instead of creating. */
  free: boolean
}

/**
 * A click or drag on the board as a stay. The dates dragged from and to are
 * the check-in and the check-out, as the bar will be drawn (midday to midday):
 * dragging from the 8th to the 9th is one night, 8 to 9. A click on one date
 * is one night from it. Either direction.
 */
export function selectionStay(a: string, b: string): { checkIn: string, checkOut: string } {
  const [first, last] = a <= b ? [a, b] : [b, a]
  return { checkIn: first, checkOut: first === last ? addIsoDays(last, 1) : last }
}

/* ------------------------------------------------------------ day header */

/** Share of all units shown that are booked on a night, 0 to 100. */
export function portfolioOccupancy(groups: CockpitGroup[], key: string): number {
  const units = groups.reduce((n, g) => n + g.unitCount, 0)
  if (!units)
    return 0
  const booked = groups.reduce((n, g) => n + g.unitCount - freeUnits(g, key), 0)
  return Math.round((booked / units) * 100)
}

/**
 * Reservations arriving on a day across the listings shown: live stays, not
 * blocks. Counted once each, though a stay booking several rooms sits on
 * several room rows.
 */
export function arrivalsOn(groups: CockpitGroup[], key: string): number {
  const ids = new Set<string>()
  for (const group of groups) {
    for (const row of group.rows) {
      for (const stay of row.stays) {
        if (stay.checkIn === key && stay.type !== 'block' && stay.status !== 'cancelled' && stay.status !== 'inquiry')
          ids.add(stay.id)
      }
    }
  }
  return ids.size
}

/* ------------------------------------------------------------ extensions */

/** Where an extension meets the stay it extends, on one row: the date they share. */
export interface ExtensionJoin {
  /** The shared date: the original's check-out (nights added after) or check-in (early arrival). */
  key: string
  originalId: string
  extensionId: string
}

/**
 * The joins between a stay and its extensions that sit on this row. An
 * extension is a separate reservation (`extensionOf` = the original's id). It
 * touches a part of the same stay: the original, or an earlier extension of it
 * (a second extension starts where the first ends). Nights added after meet on
 * that part's check-out; an early arrival meets on its check-in. Cancelled
 * stays draw no join.
 */
export function extensionJoins(row: CockpitRow, extensionOf: Map<string, string>): ExtensionJoin[] {
  const live = row.stays.filter(s => s.status !== 'cancelled')
  const joins: ExtensionJoin[] = []
  for (const ext of live) {
    const originalId = extensionOf.get(ext.id)
    if (!originalId)
      continue
    // The original and its other extensions: every part of one stay.
    const parts = live.filter(s => s.id !== ext.id && (s.id === originalId || extensionOf.get(s.id) === originalId))
    const before = parts.find(s => s.checkOut === ext.checkIn)
    const after = parts.find(s => s.checkIn === ext.checkOut)
    if (before)
      joins.push({ key: ext.checkIn, originalId: before.id, extensionId: ext.id })
    else if (after)
      joins.push({ key: ext.checkOut, originalId: after.id, extensionId: ext.id })
  }
  return joins
}
