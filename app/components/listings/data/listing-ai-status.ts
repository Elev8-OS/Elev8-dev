import type { Listing, Unit, UnitType } from './listings'

export type ListingAiStatus = Listing['aiStatus']

export const AI_STATUS_LABELS: Record<ListingAiStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  not_set: 'Not Set',
}

/** A room's ElevAI status: its own, else its room type's (older data), else on. */
export function roomAiStatus(unitType: Pick<UnitType, 'aiStatus'>, unit: Pick<Unit, 'aiStatus'>): ListingAiStatus {
  return unit.aiStatus ?? unitType.aiStatus ?? 'active'
}

/** Every room of a multi-unit listing with its ElevAI status, room type order. */
export function roomsWithAi(listing: Listing): { unit: Unit, typeName: string, aiStatus: ListingAiStatus }[] {
  return (listing.unitTypes ?? []).flatMap(ut => ut.units.map(unit => ({ unit, typeName: ut.name, aiStatus: roomAiStatus(ut, unit) })))
}

const hasRooms = (listing: Listing) => listing.unitType === 'multi' && (listing.unitTypes ?? []).some(ut => ut.units.length)

/**
 * The listing's ElevAI status. Multi-unit listings switch AI per ROOM: any
 * room on = active, every room paused = paused, otherwise the listing's own
 * value. Single-unit listings use `aiStatus` directly.
 */
export function listingAiStatus(listing: Listing): ListingAiStatus {
  if (!hasRooms(listing))
    return listing.aiStatus
  const rooms = roomsWithAi(listing)
  if (rooms.every(r => r.aiStatus === 'paused'))
    return 'paused'
  if (rooms.some(r => r.aiStatus === 'active'))
    return 'active'
  return listing.aiStatus
}

/** Multi-unit only: how many rooms have ElevAI on, e.g. `{ active: 3, total: 4 }`. */
export function aiActiveRooms(listing: Listing): { active: number, total: number } | null {
  if (!hasRooms(listing))
    return null
  const rooms = roomsWithAi(listing)
  return { active: rooms.filter(r => r.aiStatus === 'active').length, total: rooms.length }
}

/**
 * Turns ElevAI on or off for the whole listing. Multi-unit listings switch
 * every room too (and the room types, which older data reads).
 */
export function setListingAi(listing: Listing, on: boolean): Listing {
  const aiStatus: ListingAiStatus = on ? 'active' : 'paused'
  if (!hasRooms(listing))
    return { ...listing, aiStatus }
  return {
    ...listing,
    aiStatus,
    unitTypes: listing.unitTypes!.map(ut => ({ ...ut, aiStatus, units: ut.units.map(u => ({ ...u, aiStatus })) })),
  }
}

/** Turns ElevAI on or off for one room; the listing's own status follows its rooms. */
export function setRoomAi(listing: Listing, unitId: string, on: boolean): Listing {
  const aiStatus: ListingAiStatus = on ? 'active' : 'paused'
  const next = {
    ...listing,
    unitTypes: listing.unitTypes?.map(ut => ({ ...ut, units: ut.units.map(u => u.id === unitId ? { ...u, aiStatus } : u) })),
  }
  return { ...next, aiStatus: roomsWithAi(next).some(r => r.aiStatus === 'active') ? 'active' : 'paused' }
}
