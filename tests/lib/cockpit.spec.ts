// The Cockpit board's rules: which row a stay lands on, what "free" means for a
// night, how the listing row's percentage counts unassigned guests, and that
// the stays come from the Reservations module only.

import type { CockpitGroup } from '~/components/cockpit/data/cockpit'
import type { Listing } from '~/components/listings/data/listings'
import type { ReservationEntry } from '~/components/reservations/data/reservations'
import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  addIsoMonths,
  arrivalsOn,
  availablePercent,
  availableRowIds,
  bookedShare,
  buildCockpitGroups,
  cockpitDays,
  conflictIds,
  DEFAULT_STAY_FILTERS,
  extensionJoins,
  filterGroups,
  formatMoney,
  freeUnits,
  groupsWithAction,
  hasStaysIn,
  inPlaceExtensionJoins,
  isLiveStay,
  MAX_CUSTOM_DAYS,
  monthSpans,
  monthStart,
  nightlyRateOn,
  nowFraction,
  occupiesNight,
  periodSummary,
  portfolioOccupancy,
  rangeLength,
  roomTypeRate,
  selectionStay,
  splitSpan,
  stayVisible,
  typeFreeUnits,
} from '~/components/cockpit/data/cockpit'
import { listings } from '~/components/listings/data/listings'
import { initialReservations } from '~/components/reservations/data/reservations'

const single = listings.value.find(l => l.unitType === 'single' && l.status !== 'inactive')!
const multi = listings.value.find(l => l.unitType === 'multi' && (l.unitTypes ?? []).some(t => t.units.length > 1))!

const seed = initialReservations[0]!

/** A reservation on `listing`, with no room lines. */
function res(id: string, listing: Listing, checkIn: string, checkOut: string, extra: Partial<ReservationEntry> = {}): ReservationEntry {
  return { ...seed, id, guestName: id, listingId: listing.id, listingName: listing.name, checkIn, checkOut, status: 'verified', rooms: undefined, ...extra }
}

/** The listing with no seeded bookings or blocked dates, so only the test's reservations count. */
function clean(listing: Listing, extra: Partial<Listing> = {}): Listing {
  return { ...listing, bookings: [], blockedDates: [], ...extra }
}

describe('cockpitDays / monthSpans', () => {
  it('builds consecutive days and marks today', () => {
    const days = cockpitDays('2026-10-30', 4, '2026-10-31')
    expect(days.map(d => d.key)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(days.map(d => d.isToday)).toEqual([false, true, false, false])
    expect(days[0]).toMatchObject({ weekday: 'Fri', day: '30' })
  })

  it('splits the month band where the month changes', () => {
    const spans = monthSpans(cockpitDays('2026-10-30', 4, '2026-10-30'))
    expect(spans).toEqual([
      { label: 'October 2026', start: 0, count: 2 },
      { label: 'November 2026', start: 2, count: 2 },
    ])
  })
})

describe('nights', () => {
  it('counts the arrival night, not the departure night', () => {
    const s = { checkIn: '2026-10-08', checkOut: '2026-10-10' }
    expect(occupiesNight(s, '2026-10-08')).toBe(true)
    expect(occupiesNight(s, '2026-10-09')).toBe(true)
    expect(occupiesNight(s, '2026-10-10')).toBe(false)
  })

  it('ignores cancelled stays and inquiries', () => {
    expect(isLiveStay({ status: 'cancelled' })).toBe(false)
    expect(isLiveStay({ status: 'inquiry' })).toBe(false)
    expect(isLiveStay({ status: 'unverified' })).toBe(true)
  })
})

describe('buildCockpitGroups', () => {
  it('gives a single-unit listing one row with its reservations', () => {
    const listing = clean(single)
    const [group] = buildCockpitGroups([listing], [res('a', listing, '2026-10-08', '2026-10-10')])
    expect(group!.unitCount).toBe(1)
    expect(group!.rows).toHaveLength(1)
    expect(group!.rows[0]).toMatchObject({ id: listing.id, kind: 'unit' })
    expect(group!.rows[0]!.stays.map(s => s.id)).toEqual(['a'])
  })

  it('reads the Reservations module only, never listing.bookings', () => {
    const listing = { ...clean(single), bookings: [{ id: 'bk-x', guestName: 'Mock', checkIn: '2026-10-08', checkOut: '2026-10-10', nights: 2, status: 'verified' as const, revenue: 0, source: 'Direct' }] }
    const [group] = buildCockpitGroups([listing], [])
    expect(group!.rows[0]!.stays).toEqual([])
  })

  it('keeps the reservation id on the bar, so a click finds the reservation', () => {
    const listing = clean(single)
    const [group] = buildCockpitGroups([listing], [res('res-77', listing, '2026-10-08', '2026-10-10'), res('other', clean(multi), '2026-10-08', '2026-10-10')])
    expect(group!.rows[0]!.stays.map(s => s.id)).toEqual(['res-77'])
  })

  it('gives a multi-unit listing a row per room, and puts stays with no room on their own row', () => {
    const listing = clean(multi)
    const [group] = buildCockpitGroups([listing], [res('a', listing, '2026-10-08', '2026-10-10')])
    const rooms = group!.rows.filter(r => r.kind === 'room')
    expect(rooms.length).toBe(group!.unitCount)
    expect(rooms.every(r => r.stays.length === 0)).toBe(true)
    const unassigned = group!.rows.find(r => r.kind === 'unassigned')
    expect(unassigned?.stays.map(s => s.id)).toEqual(['a'])
  })

  it('skips inactive listings and sorts by name', () => {
    const a = clean(single, { id: 'x-b', name: 'B listing' })
    const b = clean(single, { id: 'x-a', name: 'A listing' })
    const c = clean(single, { id: 'x-c', name: 'C listing', status: 'inactive' })
    expect(buildCockpitGroups([a, b, c], []).map(g => g.listing.id)).toEqual(['x-a', 'x-b'])
  })
})

describe('availability', () => {
  it('is 0% on a booked night and 100% on a free one', () => {
    const listing = clean(single)
    const [group] = buildCockpitGroups([listing], [res('a', listing, '2026-10-08', '2026-10-10')])
    expect(availablePercent(group!, '2026-10-09')).toBe(0)
    expect(availablePercent(group!, '2026-10-10')).toBe(100)
  })

  it('ignores a cancelled reservation', () => {
    const listing = clean(single)
    const [group] = buildCockpitGroups([listing], [res('a', listing, '2026-10-08', '2026-10-10', { status: 'cancelled' })])
    expect(availablePercent(group!, '2026-10-09')).toBe(100)
  })

  it('closes every unit on a blocked date', () => {
    const [group] = buildCockpitGroups([clean(single, { blockedDates: ['2026-10-12'] })], [])
    expect(freeUnits(group!, '2026-10-12')).toBe(0)
  })

  it('counts an unassigned guest against the free rooms', () => {
    const listing = clean(multi)
    const [group] = buildCockpitGroups([listing], [res('a', listing, '2026-10-08', '2026-10-10')])
    expect(freeUnits(group!, '2026-10-08')).toBe(group!.unitCount - 1)
    expect(freeUnits(group!, '2026-10-11')).toBe(group!.unitCount)
  })

  it('finds rows free for every night and big enough', () => {
    const listing = clean(single, { capacity: 4 })
    const [group] = buildCockpitGroups([listing], [res('a', listing, '2026-10-10', '2026-10-12')])
    const groups: CockpitGroup[] = [group!]
    expect(availableRowIds(groups, { checkIn: '2026-10-08', checkOut: '2026-10-10', guests: 2 }).has(single.id)).toBe(true)
    expect(availableRowIds(groups, { checkIn: '2026-10-09', checkOut: '2026-10-11', guests: 2 }).has(single.id)).toBe(false)
    expect(availableRowIds(groups, { checkIn: '2026-10-08', checkOut: '2026-10-10', guests: 5 }).has(single.id)).toBe(false)
  })
})

describe('rates and money', () => {
  it('uses a seasonal rate inside its dates', () => {
    const listing = { pricing: { ...single.pricing, nightlyRate: 100, seasonalRates: [{ startDate: '2026-12-20', endDate: '2027-01-05', rate: 180, label: 'Peak' }] } }
    expect(nightlyRateOn(listing, '2026-12-25')).toBe(180)
    expect(nightlyRateOn(listing, '2026-12-19')).toBe(100)
  })

  it('writes the ISO code before the amount', () => {
    expect(formatMoney(150, 'USD')).toBe('USD 150.00')
    expect(formatMoney(500000, 'IDR')).toBe('IDR 500,000')
  })
})

describe('filterGroups', () => {
  it('matches the name and needs every tag', () => {
    const a = clean(single, { id: 'x-a', name: 'Villa Luna', tags: ['Bali', 'Pool'] })
    const b = clean(single, { id: 'x-b', name: 'Swiss Chalet', tags: ['Pool'] })
    const groups = buildCockpitGroups([a, b], [])
    expect(filterGroups(groups, 'luna', []).map(g => g.listing.id)).toEqual(['x-a'])
    expect(filterGroups(groups, '', ['Pool']).map(g => g.listing.id)).toEqual(['x-b', 'x-a'])
    expect(filterGroups(groups, '', ['Pool', 'Bali']).map(g => g.listing.id)).toEqual(['x-a'])
  })
})

describe('bookedShare', () => {
  it('is the booked part of a multi-unit listing, unassigned guests included', () => {
    const listing = clean(multi)
    const [group] = buildCockpitGroups([listing], [res('a', listing, '2026-10-08', '2026-10-10')])
    expect(bookedShare(group!, '2026-10-08')).toBeCloseTo(1 / group!.unitCount)
    expect(bookedShare(group!, '2026-10-11')).toBe(0)
  })
})

describe('nowFraction', () => {
  const keys = ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']

  it('places now inside today by the time of day', () => {
    expect(nowFraction(keys, '2026-10-08', 0)).toBe(0)
    expect(nowFraction(keys, '2026-10-09', 720)).toBeCloseTo(1.5 / 4)
  })

  it('is null when today is not shown', () => {
    expect(nowFraction(keys, '2026-10-20', 600)).toBeNull()
  })
})

describe('ranges', () => {
  it('steps a month by calendar month, clamping to the month end', () => {
    expect(addIsoMonths('2026-10-08', 1)).toBe('2026-11-08')
    expect(addIsoMonths('2027-01-31', 1)).toBe('2027-02-28')
    expect(addIsoMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addIsoMonths('2026-10-08', -1)).toBe('2026-09-08')
  })

  it('starts a month on its 1st', () => {
    expect(monthStart('2026-10-08')).toBe('2026-10-01')
    expect(monthStart('2026-10-01')).toBe('2026-10-01')
    expect(rangeLength('month', monthStart('2026-02-14'), 0)).toBe(28)
  })

  it('shows a month as the days up to the same date next month', () => {
    expect(rangeLength('month', '2026-10-08', 0)).toBe(31)
    expect(rangeLength('month', '2026-11-08', 0)).toBe(30)
  })

  it('keeps fixed ranges and caps a custom one', () => {
    expect(rangeLength('14', '2026-10-08', 0)).toBe(14)
    expect(rangeLength('custom', '2026-10-08', 10)).toBe(10)
    expect(rangeLength('custom', '2026-10-08', 400)).toBe(MAX_CUSTOM_DAYS)
  })
})

describe('conflictIds', () => {
  it('flags two live stays sharing a night in one row, not a turnover, a cancelled stay or an inquiry', () => {
    const listing = clean(single)
    const [group] = buildCockpitGroups([listing], [
      res('a', listing, '2026-10-08', '2026-10-12'),
      res('b', listing, '2026-10-11', '2026-10-14'),
      res('c', listing, '2026-10-14', '2026-10-16'),
      res('d', listing, '2026-10-14', '2026-10-15', { status: 'cancelled' }),
      res('e', listing, '2026-10-15', '2026-10-17', { status: 'inquiry' }),
    ])
    expect([...conflictIds([group!])].sort()).toEqual(['a', 'b'])
  })

  it('never flags the "Not assigned to a room" row', () => {
    const listing = clean(multi)
    const [group] = buildCockpitGroups([listing], [res('a', listing, '2026-10-08', '2026-10-10'), res('b', listing, '2026-10-08', '2026-10-10')])
    expect(conflictIds([group!]).size).toBe(0)
  })
})

describe('periodSummary', () => {
  const today = '2026-10-08'
  const listing = clean(multi)
  const [group] = buildCockpitGroups([listing], [
    res('arrive', listing, today, '2026-10-10'),
    res('leave', listing, '2026-10-05', today),
    res('stay', listing, '2026-10-06', '2026-10-09'),
    res('gone', listing, '2026-10-01', '2026-10-03'),
    res('blk', listing, today, '2026-10-09', { status: 'blocked' }),
    res('next-month', listing, '2026-11-03', '2026-11-05'),
  ])
  const marked = new Set(['stay', 'gone', 'next-month'])

  it('on a one-day period at today, sorts arrivals, departures and staying; blocks are not guests', () => {
    const s = periodSummary([group!], today, today, today, marked)
    expect([...s.arrivals]).toEqual(['arrive'])
    expect([...s.departures]).toEqual(['leave'])
    expect([...s.staying].sort()).toEqual(['arrive', 'stay'])
  })

  it('follows the period: another month counts its own stays', () => {
    const october = periodSummary([group!], '2026-10-01', '2026-10-31', today, marked)
    expect([...october.arrivals].sort()).toEqual(['arrive', 'gone', 'leave', 'stay'])
    expect(october.staying.has('next-month')).toBe(false)
    const november = periodSummary([group!], '2026-11-01', '2026-11-30', today, marked)
    expect([...november.arrivals]).toEqual(['next-month'])
    expect([...november.staying]).toEqual(['next-month'])
    expect([...november.actionNeeded]).toEqual(['next-month'])
    expect(november.departures.size).toBe(1)
  })

  it('counts no room yet and action needed only for stays in the period and not over yet', () => {
    const s = periodSummary([group!], '2026-10-01', '2026-10-31', today, marked)
    expect([...s.unassigned].sort()).toEqual(['arrive', 'stay'])
    expect([...s.actionNeeded]).toEqual(['stay'])
    const september = periodSummary([group!], '2026-09-01', '2026-09-30', today, marked)
    expect(Object.values(september).every(ids => ids.size === 0)).toBe(true)
  })
})

describe('filters', () => {
  it('hides bars by status and channel, and cancelled ones by their switch', () => {
    const f = { ...DEFAULT_STAY_FILTERS, statuses: ['verified'], channels: ['Airbnb'] }
    expect(stayVisible({ source: 'Airbnb' }, 'verified', f)).toBe(true)
    expect(stayVisible({ source: 'Direct' }, 'verified', f)).toBe(false)
    expect(stayVisible({ source: 'Airbnb' }, 'inquiry', f)).toBe(false)
    expect(stayVisible({ source: 'Airbnb' }, 'cancelled', f)).toBe(true)
    expect(stayVisible({ source: 'Airbnb' }, 'cancelled', { ...f, showCancelled: false })).toBe(false)
  })

  it('counts the filters that differ from the defaults, tags one each', () => {
    expect(activeFilterCount(DEFAULT_STAY_FILTERS, [])).toBe(0)
    expect(activeFilterCount({ ...DEFAULT_STAY_FILTERS, statuses: ['verified', 'inquiry'], showCancelled: false, actionOnly: true }, ['Bali', 'Pool'])).toBe(5)
  })

  it('keeps only listings with an action-needed stay in the period', () => {
    const a = clean(single, { id: 'x-a', name: 'A' })
    const b = clean(single, { id: 'x-b', name: 'B' })
    const groups = buildCockpitGroups([a, b], [res('r1', a, '2026-10-08', '2026-10-10'), res('r2', b, '2026-11-20', '2026-11-22')])
    expect(groupsWithAction(groups, new Set(['r1', 'r2']), '2026-10-08', '2026-11-04').map(g => g.listing.id)).toEqual(['x-a'])
  })

  it('knows when a period has no reservation at all', () => {
    const groups = buildCockpitGroups([clean(single)], [res('r1', single, '2026-10-08', '2026-10-10')])
    expect(hasStaysIn(groups, '2026-10-01', '2026-10-31')).toBe(true)
    expect(hasStaysIn(groups, '2026-12-01', '2026-12-31')).toBe(false)
  })
})

describe('selectionStay', () => {
  it('reads the dates dragged from and to as check-in and check-out, either direction', () => {
    expect(selectionStay('2026-10-08', '2026-10-09')).toEqual({ checkIn: '2026-10-08', checkOut: '2026-10-09' })
    expect(selectionStay('2026-10-14', '2026-10-12')).toEqual({ checkIn: '2026-10-12', checkOut: '2026-10-14' })
  })

  it('makes a click on one date a one-night stay', () => {
    expect(selectionStay('2026-10-12', '2026-10-12')).toEqual({ checkIn: '2026-10-12', checkOut: '2026-10-13' })
  })
})

describe('day header', () => {
  it('counts guest arrivals, not blocks, cancelled stays or inquiries', () => {
    const listing = clean(multi)
    const [group] = buildCockpitGroups([listing], [
      res('a', listing, '2026-10-08', '2026-10-10'),
      res('b', listing, '2026-10-08', '2026-10-09', { status: 'blocked' }),
      res('c', listing, '2026-10-08', '2026-10-09', { status: 'cancelled' }),
      res('d', listing, '2026-10-08', '2026-10-09', { status: 'inquiry' }),
    ])
    expect(arrivalsOn([group!], '2026-10-08')).toBe(1)
  })

  it('gives the share of all units booked across listings', () => {
    const a = clean(single, { id: 'x-a', name: 'A' })
    const b = clean(single, { id: 'x-b', name: 'B' })
    const groups = buildCockpitGroups([a, b], [res('r', a, '2026-10-08', '2026-10-10')])
    expect(portfolioOccupancy(groups, '2026-10-08')).toBe(50)
    expect(portfolioOccupancy(groups, '2026-10-12')).toBe(0)
  })
})

describe('room types', () => {
  it('gives a multi-unit listing one type per room type, each with its own rate', () => {
    const listing = clean(multi)
    const [group] = buildCockpitGroups([listing], [])
    expect(group!.types.map(t => t.id)).toEqual((listing.unitTypes ?? []).filter(t => t.units.length).map(t => t.id))
    for (const type of group!.types) {
      const source = listing.unitTypes!.find(t => t.id === type.id)!
      expect(type.rate).toBe(roomTypeRate(source, listing))
      expect(group!.rows.filter(r => r.typeId === type.id)).toHaveLength(type.unitCount)
    }
  })

  it('has no types for a single-unit listing', () => {
    expect(buildCockpitGroups([clean(single)], [])[0]!.types).toEqual([])
  })

  it('falls back to the listing rate when a type has no priced plan', () => {
    const type = { ...multi.unitTypes![0]!, pricing: { ...multi.unitTypes![0]!.pricing, ratePlans: [] } }
    expect(roomTypeRate(type, { pricing: { ...multi.pricing, nightlyRate: 333 } })).toBe(333)
  })

  it('counts free rooms per type; a stay with no room counts against no type', () => {
    const listing = clean(multi)
    const type = listing.unitTypes!.find(t => t.units.length)!
    const room = type.units[0]!
    const [group] = buildCockpitGroups([listing], [
      res('in-room', listing, '2026-10-08', '2026-10-10', { assignedUnitIds: [room.id] }),
      res('no-room', listing, '2026-10-08', '2026-10-10'),
    ])
    expect(typeFreeUnits(group!, type.id, '2026-10-08')).toBe(group!.types.find(t => t.id === type.id)!.unitCount - 1)
  })
})

describe('extensionJoins', () => {
  const listing = clean(single)
  const [group] = buildCockpitGroups([listing], [
    res('orig', listing, '2026-10-13', '2026-10-17'),
    res('ext1', listing, '2026-10-17', '2026-10-19'),
    res('ext2', listing, '2026-10-19', '2026-10-20'),
    res('early', listing, '2026-10-11', '2026-10-13'),
    res('other', listing, '2026-10-20', '2026-10-22'),
  ])
  const row = group!.rows[0]!
  const extensionOf = new Map([['ext1', 'orig'], ['ext2', 'orig'], ['early', 'orig']])

  it('joins each extension to the part of the stay it touches, chains and early arrivals included', () => {
    const byExtension = (a: { extensionId: string }, b: { extensionId: string }) => a.extensionId.localeCompare(b.extensionId)
    expect(extensionJoins(row, extensionOf).sort(byExtension)).toEqual([
      { key: '2026-10-17', originalId: 'orig', extensionId: 'ext1' },
      { key: '2026-10-19', originalId: 'ext1', extensionId: 'ext2' },
      { key: '2026-10-13', originalId: 'orig', extensionId: 'early' },
    ].sort(byExtension))
  })

  it('never joins a guest who simply arrives as another leaves', () => {
    expect(extensionJoins(row, extensionOf).some(j => j.extensionId === 'other')).toBe(false)
  })
})

describe('inPlaceExtensionJoins', () => {
  const listing = clean(single)
  const [group] = buildCockpitGroups([listing], [
    res('direct', listing, '2026-10-11', '2026-10-17'),
    res('gone', listing, '2026-10-20', '2026-10-25', { status: 'cancelled' }),
  ])
  const row = group!.rows[0]!
  const ext = (id: string, extra: object) => ({ id, extraNights: 2, ...extra })

  it('puts a link inside the bar where a direct stay was extended, both ways', () => {
    const byStay = new Map([['direct', [
      ext('later', { direction: 'after', previousCheckOut: '2026-10-15', newCheckOut: '2026-10-17' }),
      ext('earlier', { direction: 'before', previousCheckIn: '2026-10-13', newCheckIn: '2026-10-11' }),
      ext('old-record', { previousCheckOut: '2026-10-14' }),
    ]]])
    expect(inPlaceExtensionJoins(row, byStay as never)).toEqual([
      { key: '2026-10-15', stayId: 'direct', extensionId: 'later', extraNights: 2, direction: 'after' },
      { key: '2026-10-13', stayId: 'direct', extensionId: 'earlier', extraNights: 2, direction: 'before' },
      { key: '2026-10-14', stayId: 'direct', extensionId: 'old-record', extraNights: 2, direction: 'after' },
    ])
  })

  it('skips linked bookings, cancelled extensions or stays, and dates no longer inside the bar', () => {
    const byStay = new Map([
      ['direct', [
        ext('linked', { previousCheckOut: '2026-10-15', linkedReservationId: 'res-x' }),
        ext('taken-back', { previousCheckOut: '2026-10-15', cancelledAt: '2026-10-09T10:00:00Z' }),
        ext('outside', { previousCheckOut: '2026-10-17' }),
      ]],
      ['gone', [ext('on-cancelled', { previousCheckOut: '2026-10-23' })]],
    ])
    expect(inPlaceExtensionJoins(row, byStay as never)).toEqual([])
  })
})

describe('splitSpan', () => {
  const span = { startHalf: 3, endHalf: 15, continuesBefore: true, continuesAfter: false, lane: 1 }

  it('cuts a bar into parts that meet at the cut, each a real end', () => {
    expect(splitSpan(span, [9])).toEqual([
      { startHalf: 3, endHalf: 9, continuesBefore: true, continuesAfter: false, lane: 1 },
      { startHalf: 9, endHalf: 15, continuesBefore: false, continuesAfter: false, lane: 1 },
    ])
    expect(splitSpan(span, [11, 7, 7]).map(p => [p.startHalf, p.endHalf])).toEqual([[3, 7], [7, 11], [11, 15]])
  })

  it('leaves the bar whole when no cut falls inside it', () => {
    expect(splitSpan(span, [])).toEqual([span])
    expect(splitSpan(span, [3, 15, 20])).toEqual([span])
  })
})
