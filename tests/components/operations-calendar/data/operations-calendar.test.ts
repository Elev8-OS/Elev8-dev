import { describe, expect, it } from 'vitest'
import {
  buildAllEvents,
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
