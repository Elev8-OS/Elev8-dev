import type { Listing } from '~/components/listings/data/listings'
import { describe, expect, it } from 'vitest'
import { toRaw } from 'vue'
import { aiActiveRooms, listingAiStatus, roomAiStatus, roomsWithAi, setListingAi, setRoomAi } from '~/components/listings/data/listing-ai-status'
import { listings } from '~/components/listings/data/listings'

const multi = (): Listing => structuredClone(toRaw(listings.value.find(l => l.unitType === 'multi' && (l.unitTypes?.flatMap(ut => ut.units).length ?? 0) > 1)!))
const unitIds = (l: Listing) => l.unitTypes!.flatMap(ut => ut.units.map(u => u.id))
function withRoomAi(l: Listing, pick: (index: number) => 'active' | 'paused' | 'not_set'): Listing {
  let i = 0
  return { ...l, unitTypes: l.unitTypes!.map(ut => ({ ...ut, aiStatus: undefined, units: ut.units.map(u => ({ ...u, aiStatus: pick(i++) })) })) }
}

describe('roomAiStatus', () => {
  it('uses the room\'s own status, else its room type\'s, else on', () => {
    expect(roomAiStatus({ aiStatus: 'active' }, { aiStatus: 'paused' })).toBe('paused')
    expect(roomAiStatus({ aiStatus: 'paused' }, {})).toBe('paused')
    expect(roomAiStatus({}, {})).toBe('active')
  })
})

describe('listingAiStatus', () => {
  it('a single-unit listing uses its own status', () => {
    const l = { ...multi(), unitType: 'single' as const, unitTypes: undefined, aiStatus: 'paused' as const }
    expect(listingAiStatus(l)).toBe('paused')
    expect(aiActiveRooms(l)).toBeNull()
  })

  it('multi-unit: active when any room is on, paused when every room is off', () => {
    const l = multi()
    const total = unitIds(l).length
    const some = withRoomAi(l, i => i === 0 ? 'active' : 'paused')
    expect(listingAiStatus(some)).toBe('active')
    expect(aiActiveRooms(some)).toEqual({ active: 1, total })
    expect(listingAiStatus(withRoomAi(l, () => 'paused'))).toBe('paused')
  })

  it('multi-unit with no room on or paused falls back to the listing status', () => {
    expect(listingAiStatus({ ...withRoomAi(multi(), () => 'not_set'), aiStatus: 'not_set' })).toBe('not_set')
  })

  it('lists every room with its type name', () => {
    const l = multi()
    expect(roomsWithAi(l).map(r => r.unit.id)).toEqual(unitIds(l))
    expect(roomsWithAi(l)[0]!.typeName).toBe(l.unitTypes![0]!.name)
  })
})

describe('switching ElevAI on and off', () => {
  it('pausing a multi-unit listing pauses every room, so its status reads paused', () => {
    const off = setListingAi(multi(), false)
    expect(roomsWithAi(off).every(r => r.aiStatus === 'paused')).toBe(true)
    expect(listingAiStatus(off)).toBe('paused')
    const on = setListingAi(off, true)
    expect(roomsWithAi(on).every(r => r.aiStatus === 'active')).toBe(true)
    expect(listingAiStatus(on)).toBe('active')
  })

  it('a single-unit listing only changes its own status', () => {
    const l = { ...multi(), unitType: 'single' as const, unitTypes: undefined }
    expect(setListingAi(l, false)).toMatchObject({ aiStatus: 'paused', unitTypes: undefined })
  })

  it('one room off keeps the listing active and leaves its siblings alone; the last one off pauses it', () => {
    let l = setListingAi(multi(), true)
    const ids = unitIds(l)
    l = setRoomAi(l, ids[0]!, false)
    expect(roomsWithAi(l).map(r => r.aiStatus)).toEqual(ids.map((_, i) => i === 0 ? 'paused' : 'active'))
    expect(listingAiStatus(l)).toBe('active')
    expect(aiActiveRooms(l)).toEqual({ active: ids.length - 1, total: ids.length })
    for (const id of ids.slice(1))
      l = setRoomAi(l, id, false)
    expect(l.aiStatus).toBe('paused')
    expect(listingAiStatus(l)).toBe('paused')
  })
})
