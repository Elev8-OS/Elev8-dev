import type { GuideContentItem, GuideContentKind } from './guest-guide-content'
import type { ListingDetailField } from './listing-details'
import type { CustomSop } from './listing-sops'
import type { Listing, Unit } from './listings'
import { listingGuideContent } from './guest-guide-content'
import { LISTING_DETAIL_GROUPS } from './listing-details'

/**
 * Rooms inherit the property's setup; a room stores only what differs. Our
 * partner (HostBuddy) treats every room as a property of its own, so
 * `roomAsProperty` gives the full settings for one room: the property with
 * that room's overrides on top.
 */
export interface RoomOverrides {
  /** Field key (from `LISTING_DETAIL_GROUPS`) → the room's own value. A time range's end is `<key>:end`. */
  fields?: Record<string, string>
  /** The room's own photos; missing = the property's photos. */
  photos?: string[]
  /** SOPs only for this room, added to the property's. */
  sops?: CustomSop[]
  /** Guest guide items only for this room, shown after the property's (`ROOM_GUIDE_KINDS`). */
  guide?: Partial<Record<RoomGuideKind, GuideContentItem[]>>
}

/** The guest guide sections a room can add to. Check-out steps and house rules stay property-wide. */
export const ROOM_GUIDE_KINDS = ['checkin', 'good_to_know'] as const
export type RoomGuideKind = typeof ROOM_GUIDE_KINDS[number]

export function isRoomGuideKind(kind: GuideContentKind): kind is RoomGuideKind {
  return (ROOM_GUIDE_KINDS as readonly string[]).includes(kind)
}

/** The fields a room may set for itself; everything else comes from the property only. */
export const ROOM_OVERRIDE_KEYS = ['checkInTime', 'checkOutTime', 'access', 'backupAccess', 'accessTroubleshooting', 'wifiSsid', 'wifiPassword'] as const

export const ROOM_OVERRIDE_FIELDS: ListingDetailField[] = ROOM_OVERRIDE_KEYS
  .map(key => LISTING_DETAIL_GROUPS.flatMap(g => g.fields).find(f => f.key === key))
  .filter((f): f is ListingDetailField => !!f)

const endKey = (key: string) => `${key}:end`

export function findUnit(listing: Listing, unitId: string): Unit | undefined {
  return listing.unitTypes?.flatMap(ut => ut.units).find(u => u.id === unitId)
}

function patchUnit(listing: Listing, unitId: string, patch: (u: Unit) => Unit): Listing {
  return {
    ...listing,
    unitTypes: listing.unitTypes?.map(ut => ({ ...ut, units: ut.units.map(u => u.id === unitId ? patch(u) : u) })),
  }
}

/** Whether the room has its own value for a field (either end of a time range counts). */
export function isRoomCustom(unit: Unit | undefined, key: string): boolean {
  const fields = unit?.overrides?.fields ?? {}
  return key in fields || endKey(key) in fields
}

/** The value a room uses: its own if set, else the property's. */
export function roomFieldValue(listing: Listing, unit: Unit | undefined, field: ListingDetailField, end = false): string {
  const own = unit?.overrides?.fields?.[end ? endKey(field.key) : field.key]
  if (own !== undefined)
    return own
  return end ? field.readEnd?.(listing) ?? '' : field.read(listing)
}

/**
 * Sets the room's own value. For a time range the other end is pinned to what
 * the room shows now, so the pair stays together when the property changes.
 */
export function setRoomField(listing: Listing, unitId: string, field: ListingDetailField, value: string, end = false): Listing {
  return patchUnit(listing, unitId, (u) => {
    const fields = { ...u.overrides?.fields, [end ? endKey(field.key) : field.key]: value }
    if (field.input === 'time-range') {
      const other = end ? field.key : endKey(field.key)
      if (!(other in fields))
        fields[other] = roomFieldValue(listing, u, field, !end)
    }
    return { ...u, overrides: { ...u.overrides, fields } }
  })
}

/** Back to the property's value. */
export function resetRoomField(listing: Listing, unitId: string, key: string): Listing {
  return patchUnit(listing, unitId, (u) => {
    const { [key]: _a, [endKey(key)]: _b, ...fields } = u.overrides?.fields ?? {}
    return { ...u, overrides: { ...u.overrides, fields } }
  })
}

/** `undefined` = use the property's photos again. */
export function setRoomPhotos(listing: Listing, unitId: string, photos: string[] | undefined): Listing {
  return patchUnit(listing, unitId, (u) => {
    const { photos: _old, ...rest } = u.overrides ?? {}
    return { ...u, overrides: photos ? { ...rest, photos } : rest }
  })
}

export function roomPhotos(listing: Listing, unit: Unit | undefined): string[] {
  return unit?.overrides?.photos ?? listing.photos
}

export function setRoomSops(listing: Listing, unitId: string, sops: CustomSop[]): Listing {
  return patchUnit(listing, unitId, u => ({ ...u, overrides: { ...u.overrides, sops } }))
}

export function roomGuideItems(listing: Listing, unitId: string, kind: RoomGuideKind): GuideContentItem[] {
  return findUnit(listing, unitId)?.overrides?.guide?.[kind] ?? []
}

export function setRoomGuideItems(listing: Listing, unitId: string, kind: RoomGuideKind, items: GuideContentItem[]): Listing {
  return patchUnit(listing, unitId, u => ({ ...u, overrides: { ...u.overrides, guide: { ...u.overrides?.guide, [kind]: items } } }))
}

/**
 * The guest guide content for a stay in these rooms: the property's items,
 * then each room's own additions (tagged with `roomName`). No rooms = the
 * property's content only.
 */
export function guideContentForRooms(listing: Listing, unitIds: string[]): Record<GuideContentKind, GuideContentItem[]> {
  const content = listingGuideContent(listing)
  for (const unitId of unitIds) {
    const unit = findUnit(listing, unitId)
    if (!unit)
      continue
    for (const kind of ROOM_GUIDE_KINDS)
      content[kind] = [...content[kind], ...(unit.overrides?.guide?.[kind] ?? []).map(item => ({ ...item, roomName: unit.name }))]
  }
  return content
}

/** How many things the room sets for itself. */
export function roomCustomCount(unit: Unit | undefined): number {
  const keys = new Set(Object.keys(unit?.overrides?.fields ?? {}).map(k => k.replace(/:end$/, '')))
  const guideItems = ROOM_GUIDE_KINDS.reduce((n, k) => n + (unit?.overrides?.guide?.[k]?.length ?? 0), 0)
  return keys.size + (unit?.overrides?.photos ? 1 : 0) + (unit?.overrides?.sops?.length ? 1 : 0) + (guideItems ? 1 : 0)
}

/**
 * One room as a full property, the way HostBuddy sees it: the property's setup
 * with the room's name, photos and own field values on top, and its own SOPs
 * and guest guide items added to the property's.
 */
export function roomAsProperty(listing: Listing, unitId: string): Listing {
  const unit = findUnit(listing, unitId)
  if (!unit)
    return listing
  let room: Listing = { ...listing, name: unit.name, photos: roomPhotos(listing, unit) }
  for (const field of ROOM_OVERRIDE_FIELDS) {
    if (!isRoomCustom(unit, field.key))
      continue
    room = field.write(room, roomFieldValue(listing, unit, field))
    if (field.writeEnd)
      room = field.writeEnd(room, roomFieldValue(listing, unit, field, true))
  }
  const roomSops = unit.overrides?.sops ?? []
  if (roomSops.length)
    room = { ...room, sops: { ...room.sops, custom: [...(room.sops?.custom ?? []), ...roomSops] } }
  const guide = guideContentForRooms(listing, [unitId])
  if (ROOM_GUIDE_KINDS.some(k => unit.overrides?.guide?.[k]?.length))
    room = { ...room, guestGuide: { ...room.guestGuide, checkin: guide.checkin, good_to_know: guide.good_to_know } }
  return room
}
