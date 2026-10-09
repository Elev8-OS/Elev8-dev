import type { RevenueRoom } from '~/components/revenue/data/revenue-policy'
import type { AutonomySettings, ChannelMarkup } from '~/components/revenue/data/revenue-settings'
import { describe, expect, it } from 'vitest'
import { effectiveAutonomy, effectiveMarkup, nextReviewDue, seedRevenueSettings, substitutionGroups } from '~/components/revenue/data/revenue-settings'

function room(key: string, patch: Partial<RevenueRoom> = {}): RevenueRoom {
  return {
    key,
    listingId: key,
    unitId: null,
    name: key,
    unitName: null,
    listingName: key,
    location: 'Canggu',
    tags: [],
    bedrooms: 2,
    capacity: 4,
    currency: 'USD',
    channels: ['Airbnb'],
    seedRate: 100,
    ...patch,
  }
}

const autonomy: AutonomySettings = { mode: 'graduated', startBandPct: 3, maxBandPct: 12, rules: [] }

describe('effectiveAutonomy', () => {
  it('falls back to the default', () => {
    expect(effectiveAutonomy(autonomy, room('a'))).toEqual({ mode: 'graduated', maxBandPct: 12, rule: null })
  })

  it('lets a room rule beat a tag rule', () => {
    const settings: AutonomySettings = {
      ...autonomy,
      rules: [
        { id: 't', scope: { kind: 'tag', tag: 'Luxury' }, mode: 'review', maxBandPct: null },
        { id: 'r', scope: { kind: 'room', roomKey: 'a' }, mode: 'graduated', maxBandPct: 5 },
      ],
    }
    expect(effectiveAutonomy(settings, room('a', { tags: ['Luxury'] }))).toMatchObject({ mode: 'graduated', maxBandPct: 5 })
    expect(effectiveAutonomy(settings, room('b', { tags: ['Luxury'] }))).toMatchObject({ mode: 'review' })
  })

  it('takes the stricter of two tag rules and never exceeds the tenant ceiling', () => {
    const settings: AutonomySettings = {
      ...autonomy,
      rules: [
        { id: 'wide', scope: { kind: 'tag', tag: 'A' }, mode: 'graduated', maxBandPct: 30 },
        { id: 'narrow', scope: { kind: 'tag', tag: 'B' }, mode: 'graduated', maxBandPct: 4 },
      ],
    }
    expect(effectiveAutonomy(settings, room('x', { tags: ['A', 'B'] }))).toMatchObject({ maxBandPct: 4 })
    expect(effectiveAutonomy(settings, room('y', { tags: ['A'] }))).toMatchObject({ maxBandPct: 12 })
  })
})

describe('effectiveMarkup', () => {
  const markups: ChannelMarkup[] = [
    { id: '1', channel: 'Airbnb', roomKey: null, adjustPct: 3, active: true },
    { id: '2', channel: 'Airbnb', roomKey: 'a', adjustPct: 8, active: true },
    { id: '3', channel: 'Booking.com', roomKey: null, adjustPct: 15, active: false },
  ]

  it('prefers the room markup, then the channel one, and skips inactive ones', () => {
    expect(effectiveMarkup(markups, 'Airbnb', 'a')?.adjustPct).toBe(8)
    expect(effectiveMarkup(markups, 'Airbnb', 'b')?.adjustPct).toBe(3)
    expect(effectiveMarkup(markups, 'Booking.com', 'a')).toBeNull()
  })
})

describe('substitutionGroups', () => {
  const rooms = [
    room('a'),
    room('b'),
    room('c', { bedrooms: 5 }),
    room('d', { location: 'Ubud' }),
  ]

  it('groups rooms by area and bedroom band, and drops rooms that compete with nobody', () => {
    const groups = substitutionGroups(rooms, { moves: {}, names: {} })
    expect(groups.map(g => [g.name, g.roomKeys, g.adjusted])).toEqual([['Canggu · 2 to 3BR', ['a', 'b'], false]])
  })

  it('lays the tenant moves and names over the derived groups', () => {
    const groups = substitutionGroups(rooms, { moves: { c: 'Canggu|2 to 3BR', b: 'none' }, names: { 'Canggu|2 to 3BR': 'Canggu family villas' } })
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ name: 'Canggu family villas', roomKeys: ['a', 'c'], adjusted: true })
  })

  it('keeps a new custom group with one room so a second can be moved in', () => {
    const groups = substitutionGroups(rooms, { moves: { d: 'custom-1' }, names: { 'custom-1': 'Ubud solo' } })
    expect(groups.find(g => g.key === 'custom-1')).toMatchObject({ roomKeys: ['d'], adjusted: true })
  })
})

describe('nextReviewDue', () => {
  it('is due now when never reviewed, else one cadence after the last review', () => {
    expect(nextReviewDue({ cadence: 'quarterly', ownerId: null, lastReviewedAt: null }, '2026-10-09')).toBe('2026-10-09')
    expect(nextReviewDue({ cadence: 'quarterly', ownerId: null, lastReviewedAt: '2026-08-03T10:00:00Z' }, '2026-10-09')).toBe('2026-11-03')
    expect(nextReviewDue({ cadence: 'monthly', ownerId: null, lastReviewedAt: '2026-08-03' }, '2026-10-09')).toBe('2026-09-03')
  })
})

describe('seedRevenueSettings', () => {
  it('seeds calendar dates relative to today so none sit in the past', () => {
    const today = new Date(2026, 9, 9)
    const seed = seedRevenueSettings(today)
    expect(seed.events.every(e => e.to >= '2026-10-09')).toBe(true)
    expect(seed.blackouts.every(b => b.from <= b.to)).toBe(true)
  })
})
