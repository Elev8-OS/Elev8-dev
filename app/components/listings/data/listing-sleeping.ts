import type { Bed, Listing, UnitType } from './listings'

/**
 * Sleeping arrangement of a room type: its beds (`UnitType.beds`) and what can
 * be added on request (`UnitType.sleepingExtras`). Rooms of one type share it;
 * it is edited from each room in Listing Setup > Rooms and in Manage Room Types.
 * Areas follow the room type's bedroom count; the bed total is compared with
 * its max guests.
 */

/** Bed types and how many people each sleeps. */
export const BED_TYPES: { type: string, sleeps: number }[] = [
  { type: 'Single Bed', sleeps: 1 },
  { type: 'Double Bed', sleeps: 2 },
  { type: 'Queen Bed', sleeps: 2 },
  { type: 'King Bed', sleeps: 2 },
  { type: 'Bunk Bed', sleeps: 2 },
  { type: 'Sofa Bed', sleeps: 2 },
  { type: 'Futon', sleeps: 1 },
]

export interface SleepingExtras {
  extraBed?: boolean
  babyCot?: boolean
}

/** People the beds sleep; an unknown bed type counts as one. */
export function bedsSleep(beds: Bed[]): number {
  return beds.reduce((sum, b) => sum + (BED_TYPES.find(t => t.type === b.type)?.sleeps ?? 1) * Math.max(0, b.count), 0)
}

/** "1 King Bed, 2 Single Beds" */
export function bedsSummary(beds: Bed[]): string {
  return beds
    .filter(b => b.count > 0)
    .map(b => `${b.count} ${b.count === 1 ? b.type : `${b.type}s`}`)
    .join(', ')
}

export function newBed(room = 1, type = 'Double Bed'): Bed {
  return { id: `bed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, count: 1, room }
}

/** Sleeping areas, following the room type's bedroom count: Bedroom 1..N, then Other sleeping areas (0). */
export function sleepingAreas(unitType: UnitType): { room: number, label: string }[] {
  const bedrooms = Math.max(1, unitType.bedrooms || 1)
  return [
    ...Array.from({ length: bedrooms }, (_, i) => ({ room: i + 1, label: bedrooms === 1 ? 'Bedroom' : `Bedroom ${i + 1}` })),
    { room: 0, label: 'Other sleeping areas' },
  ]
}

/** The area a bed shows in. A bed in a bedroom the room type no longer has shows in its last bedroom. */
export function bedArea(bed: Bed, unitType: UnitType): number {
  if (bed.room === 0)
    return 0
  return Math.min(bed.room ?? 1, Math.max(1, unitType.bedrooms || 1))
}

/** Guests the room type allows (adults and children; infants sleep in a cot). */
export function maxGuests(unitType: UnitType): number {
  return (unitType.maxAdults ?? 0) + (unitType.maxChildren ?? 0)
}

/** How the beds compare with the room type's max guests. */
export function capacityCheck(unitType: UnitType): { sleeps: number, max: number, status: 'match' | 'short' | 'extra' } {
  const sleeps = bedsSleep(unitType.beds)
  const max = maxGuests(unitType)
  return { sleeps, max, status: sleeps === max ? 'match' : sleeps < max ? 'short' : 'extra' }
}

/** The room type a room belongs to. */
export function unitTypeOf(listing: Listing, unitId: string): UnitType | undefined {
  return listing.unitTypes?.find(ut => ut.units.some(u => u.id === unitId))
}

export function setUnitTypeBeds(listing: Listing, unitTypeId: string, beds: Bed[]): Listing {
  return { ...listing, unitTypes: listing.unitTypes?.map(ut => ut.id === unitTypeId ? { ...ut, beds } : ut) }
}

export function setSleepingExtras(listing: Listing, unitTypeId: string, patch: SleepingExtras): Listing {
  return {
    ...listing,
    unitTypes: listing.unitTypes?.map(ut => ut.id === unitTypeId ? { ...ut, sleepingExtras: { ...ut.sleepingExtras, ...patch } } : ut),
  }
}
