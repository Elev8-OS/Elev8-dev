import type { Listing } from './listings'

export interface AmenityGroup {
  key: string
  label: string
  icon: string
  items: string[]
}

/** Property-wide amenities, stored in `Listing.amenities`. */
export const PROPERTY_AMENITY_GROUPS: AmenityGroup[] = [
  {
    key: 'outdoor',
    label: 'Outdoor',
    icon: 'lucide:trees',
    items: ['Pool', 'Fenced yard', 'Mosquito net', 'Surveillance', 'Hot tub', 'Free parking on premises', 'Free parking on street', 'Paid parking off premises', 'Paid parking on premises', 'EV car charger', 'Barbecue', 'Barbecue utensils', 'Garden', 'Deck/patio', 'Private entrance', 'Beach essentials', 'Bikes', 'Boat slip', 'Fire pit', 'Hammock', 'Kayak', 'Outdoor kitchen', 'Outdoor seating'],
  },
  {
    key: 'family',
    label: 'Family',
    icon: 'lucide:baby',
    items: ['Baby bath', 'Baby monitor', 'Babysitter recommendations', 'Bathtub', 'Changing table', 'Children books & toys', 'Children dinnerware', 'Fireplace guards', 'Game console', 'Outlet covers', 'Pack n Play or travel crib', 'Room darkening shades', 'Stair gates', 'Table corner guards', 'Window guards'],
  },
  {
    key: 'more',
    label: 'More',
    icon: 'lucide:ellipsis',
    items: ['Wheelchair accessible', 'Elevator', 'Gym', 'Pool table', 'Piano', 'Breakfast included', 'Doorman', 'Carbon monoxide detector', 'Lake access', 'Beach front', 'Water front', 'Ski-in/Ski-out', 'Contactless check-in', 'Arcade games', 'Batting cage', 'Books and reading material', 'Bowling alley', 'Climbing wall', 'Laser tag', 'Life size games', 'Mini golf', 'Movie theater', 'Skate ramp', 'Theme room', 'Laundromat nearby', 'Resort access'],
  },
]

/** What a room has. Stored per room type (`UnitType.amenities`), or `Listing.roomAmenities` without room types. */
const ROOM_AMENITY_ITEMS = [
  'TV',
  'Air Conditioning',
  'Heating',
  'WiFi',
  'Ethernet connection',
  'Washer',
  'Dryer',
  'Fireplace',
  'Single level home',
  'Cat on the property',
  'Dog on the property',
  'Other pets on property',
  'Smoke detector',
  'Fire extinguisher',
  'Deadbolt lock',
  'Outdoor lighting',
  'Essentials',
  'Baby high chair',
  'CD/DVD player',
  'Board games',
  'Ceiling fan',
  'Ventilation fan',
  'Hair dryer',
  'Crockery and cutlery',
  'Pots and pans',
  'Oven',
  'Microwave',
  'Water kettle',
  'Coffee maker',
  'Dishwasher',
  'Toaster',
  'Fridge',
  'Dining table',
  'Alarm system',
  'Desk',
  'Desk chair',
  'Computer monitor',
  'Printer',
  'Safe box',
  'Closet/drawers',
  'Iron',
  'Shampoo',
  'Conditioner',
  'Body wash',
  'Buzzer',
  'First aid kit',
  'Safety card',
  'Hangers',
  'Laptop friendly',
  'Stove',
  'Linens provided',
  'Towels provided',
  'Hot water',
  'Cooking basics',
  'Air filter',
  'Enhanced cleaning',
  'Disinfectants used on surfaces',
  'Baking sheet',
  'Bidet',
  'Blender',
  'Cleaning products available',
  'Drying rack for clothing',
  'Exercise equipment',
  'Extra pillows and blankets',
  'Freezer',
  'Mini fridge',
  'Ping pong table',
  'Pocket WiFi',
  'Portable fans',
  'Rain shower',
  'Record player',
  'Rice maker',
  'Sound system',
  'Trash compactor',
  'Wine glasses',
]

export const ROOM_AMENITY_GROUPS: AmenityGroup[] = [
  { key: 'indoor', label: 'Indoor', icon: 'lucide:sofa', items: ROOM_AMENITY_ITEMS },
]

export const ROOM_AMENITIES = ROOM_AMENITY_ITEMS

/**
 * Property groups, plus an "Other" group for values the listing already has
 * that no group lists (older data such as "Parking" or "Sauna"), so they stay
 * visible and can be unticked.
 */
export function propertyAmenityGroups(listing: Listing): AmenityGroup[] {
  const known = new Set(PROPERTY_AMENITY_GROUPS.flatMap(g => g.items))
  const other = listing.amenities.filter(a => !known.has(a))
  return other.length
    ? [...PROPERTY_AMENITY_GROUPS, { key: 'other', label: 'Other', icon: 'lucide:tag', items: other }]
    : PROPERTY_AMENITY_GROUPS
}

export function toggleAmenity(list: string[], name: string): string[] {
  return list.includes(name) ? list.filter(a => a !== name) : [...list, name]
}

/** Where room amenities are kept: one entry per room type, or the listing itself when it has none. */
export interface RoomAmenityTarget {
  id: string
  label: string
  amenities: string[]
}

export const LISTING_ROOMS_TARGET = 'listing'

export function roomAmenityTargets(listing: Listing): RoomAmenityTarget[] {
  if (listing.unitTypes?.length)
    return listing.unitTypes.map(ut => ({ id: ut.id, label: ut.name, amenities: ut.amenities ?? [] }))
  return [{ id: LISTING_ROOMS_TARGET, label: 'All rooms', amenities: listing.roomAmenities ?? [] }]
}

export function setRoomAmenities(listing: Listing, targetId: string, amenities: string[]): Listing {
  if (targetId === LISTING_ROOMS_TARGET)
    return { ...listing, roomAmenities: amenities }
  return { ...listing, unitTypes: listing.unitTypes?.map(ut => ut.id === targetId ? { ...ut, amenities } : ut) }
}

/** `FieldConfigDialog` key for an amenity's pencil. */
export function amenityConfigKey(kind: 'property' | 'room', name: string, targetId = LISTING_ROOMS_TARGET): string {
  return kind === 'property' ? `amenity:${name}` : `room-amenity:${targetId}:${name}`
}
