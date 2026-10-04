import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import {
  buildAllEvents,
  buildCheckoutCleanings,
  eventsForDay,
  formatLocalDateKey,
  getCalendarListings,
  getWeekDays,
  groupEventsByListingAndDay,
} from '~/components/operations-calendar/data/operations-calendar'

describe('operations-calendar data', () => {
  it('formatLocalDateKey formats from local components, not UTC', () => {
    // Late evening in Bali (UTC+8) — Date#toISOString would slide this
    // back to the previous UTC day. The helper must use local getters
    // so calendar keys stay anchored to the user's local day.
    const lateLocalBali = new Date(2026, 6, 15, 23, 30, 0) // 2026-07-15 23:30 local
    expect(formatLocalDateKey(lateLocalBali)).toBe('2026-07-15')

    // Single-digit month/day must be zero-padded.
    const januaryThird = new Date(2026, 0, 3, 12, 0, 0)
    expect(formatLocalDateKey(januaryThird)).toBe('2026-01-03')
  })

  it('getWeekDays returns 7 ascending, locally-keyed days', () => {
    const days = getWeekDays(new Date('2026-06-23'))

    expect(days.length).toBe(7)
    for (const day of days) {
      expect(day.key).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    // Keys strictly increase.
    for (let i = 1; i < days.length; i++) {
      expect(days[i]!.key > days[i - 1]!.key).toBe(true)
    }
  })
  it('builds all events without hanging', () => {
    const start = performance.now()
    const events = buildAllEvents()
    const elapsed = performance.now() - start

    expect(events.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(1000)
  })

  it('produces correct guest stay night count', () => {
    const events = buildAllEvents()
    const stayEvents = events.filter(e => e.type === 'guest_stay' && e.listingId === 'lst-1')

    // lst-1 has 3 bookings: 4 + 3 + 5 nights = 12 stay blocks
    expect(stayEvents.length).toBe(12)
  })

  it('returns events for each day of the week', () => {
    const events = buildAllEvents()
    const weekDays = getWeekDays(new Date('2026-06-23'))

    expect(weekDays.length).toBe(7)

    for (const day of weekDays) {
      const dayEvents = eventsForDay(events, day.key)
      expect(dayEvents).toBeDefined()
    }
  })

  it('groups events by listing and day', () => {
    const events = buildAllEvents()
    const listings = getCalendarListings()
    const weekDays = getWeekDays(new Date('2026-06-23'))
    const grouped = groupEventsByListingAndDay(listings, events, weekDays)

    // Every listing should have a row
    expect(grouped.size).toBe(listings.length)

    // lst-1 has bookings, so it should have entries
    expect(grouped.has('lst-1')).toBe(true)

    // Each day key for lst-1 should map to an array
    const listingMap = grouped.get('lst-1')
    expect(listingMap).toBeDefined()
    for (const day of weekDays) {
      expect(listingMap!.has(day.key)).toBe(true)
      expect(Array.isArray(listingMap!.get(day.key))).toBe(true)
    }
  })
})

describe('rooms on the operations calendar', () => {
  it('a multi-unit listing carries its rooms; a single-unit one has none', () => {
    const calendar = getCalendarListings([])
    expect(calendar.find(l => l.id === 'lst-1')!.rooms.map(r => r.name)).toEqual(['Master Suite', 'Garden Unit', 'Pool Unit', 'Loft Unit'])
    const single = calendar.find(l => l.isSingleUnit)
    if (single)
      expect(single.rooms).toEqual([])
  })

  it('a stay in two rooms gets a check-out cleaning per room, ending in local time', () => {
    const reservation = {
      id: 'r-two-rooms',
      listingId: 'lst-1',
      listingName: 'x',
      guestName: 'Two Rooms Guest',
      checkIn: '2030-01-10',
      checkOut: '2030-01-12',
      nights: 2,
      status: 'verified',
      channel: 'Direct',
      totalPrice: 0,
      assignedUnitIds: ['un-1', 'un-3'],
    } as ReservationEntry
    const calendar = getCalendarListings([reservation])
    const map = new Map(calendar.map(l => [l.id, l]))
    const cleanings = buildCheckoutCleanings(map, [], [reservation]).filter(e => e.guestName === 'Two Rooms Guest')
    expect(cleanings.map(c => c.unitId)).toEqual(['un-1', 'un-3'])
    expect(new Set(cleanings.map(c => c.id)).size).toBe(2)
    // 2 hours after the listing's check-out time, still in +08:00.
    expect(cleanings[0]!.end).toMatch(/\+08:00$/)
    expect(cleanings[0]!.end.slice(11, 16)).toBe(`${String(Number(cleanings[0]!.start.slice(11, 13)) + 2).padStart(2, '0')}:${cleanings[0]!.start.slice(14, 16)}`)
  })
})
