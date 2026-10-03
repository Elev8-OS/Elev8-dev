import type { Listing } from '~/components/listings/data/listings'
import { describe, expect, it } from 'vitest'
import { toRaw } from 'vue'
import { listingAddress, listingTimeZone, locationLabel } from '~/components/listings/data/listing-address'
import { LISTING_ROOMS_TARGET, ROOM_AMENITIES, roomAmenityTargets, setRoomAmenities, toggleAmenity } from '~/components/listings/data/listing-amenities'
import { LISTING_DETAIL_GROUPS } from '~/components/listings/data/listing-details'
import { listingSetupProgress } from '~/components/listings/data/listing-setup-progress'
import { addCustomSop, removeCustomSop, SOP_GROUPS, updateCustomSop } from '~/components/listings/data/listing-sops'
import { listings } from '~/components/listings/data/listings'

function withListing(patch: (l: Listing) => Listing): Listing {
  return patch(structuredClone(toRaw(listings.value[0]!)))
}

function empty(l: Listing): Listing {
  return {
    ...l,
    name: 'Sunset Stay',
    location: 'Canggu, Bali',
    tags: [],
    timeZone: undefined,
    propertyType: undefined,
    address: undefined,
    details: undefined,
    sops: undefined,
    capacity: 0,
    wifiSsid: undefined,
    wifiPassword: undefined,
    amenities: [],
    roomAmenities: undefined,
    unitTypes: l.unitTypes?.map(ut => ({ ...ut, amenities: [] })),
    resources: { ...l.resources, basics: {}, listingDetails: '', sops: '  ', topicsToAvoid: [], avoidTopics: undefined },
  }
}

describe('listingSetupProgress', () => {
  it('reads city, state, country and time zone from the location label of a listing with no address', () => {
    const p = listingSetupProgress(withListing(empty))
    // Name, time zone, city, state, country: no type, street or area code.
    expect(p.sections.find(s => s.key === 'basics')).toMatchObject({ done: 5, total: 8, complete: false })
    // Only the default check-in/out times; Additional Sleeping Arrangements is optional (29 fields, 28 counted).
    expect(p.sections.find(s => s.key === 'listing-details')).toMatchObject({ done: 2, total: 28 })
    expect(p.completeSections).toBe(0)
    // (5/8 + 2/28) / 5
    expect(p.percent).toBe(14)
  })

  it('treats whitespace-only text as empty', () => {
    const p = listingSetupProgress(withListing(empty))
    expect(p.sections.find(s => s.key === 'sops')!.complete).toBe(false)
  })

  it('reaches 100% when every section is filled in', () => {
    const base = withListing(l => ({
      ...empty(l),
      timeZone: 'Asia/Makassar',
      propertyType: 'Villa',
      address: { street: 'Jl. Jantuk Angsa', unitNumber: '', city: 'Pererenan', state: 'Bali', postalCode: '80351', country: 'ID' },
      amenities: ['Pool'],
      unitTypes: l.unitTypes?.map(ut => ({ ...ut, amenities: ['TV'] })),
      resources: { ...l.resources, basics: {}, sops: 'Steps', topicsToAvoid: ['pricing'] },
    }))
    const filledIn = [...LISTING_DETAIL_GROUPS, ...SOP_GROUPS].flatMap(g => g.fields).reduce((l, f) => f.write(l, '4'), base)
    const p = listingSetupProgress(filledIn)
    expect(p.completeSections).toBe(5)
    expect(p.percent).toBe(100)
    expect(p.sections.map(s => s.key)).toEqual(['basics', 'listing-details', 'amenities', 'sops', 'topics'])
  })
})

describe('listing details fields', () => {
  it('has the 5 / 11 / 13 fields of the three groups', () => {
    expect(LISTING_DETAIL_GROUPS.map(g => [g.label, g.fields.length])).toEqual([
      ['Booking', 5],
      ['Check-in and Check-out', 11],
      ['Details', 13],
    ])
  })

  it('writes the shared listing fields, not copies of them', () => {
    const fields = Object.fromEntries(LISTING_DETAIL_GROUPS.flatMap(g => g.fields).map(f => [f.key, f]))
    let l = withListing(empty)
    l = fields.capacity!.write(l, '10')
    l = fields.wifiSsid!.write(l, 'Luwa')
    l = fields.checkInTime!.write(l, '15:00')
    l = fields.checkInTime!.writeEnd!(l, '00:00')
    l = fields.description!.write(l, 'A villa')
    expect(l.capacity).toBe(10)
    expect(l.wifiSsid).toBe('Luwa')
    expect(l.resources.basics).toMatchObject({ checkInTime: '15:00', description: 'A villa' })
    expect(l.details?.checkInUntil).toBe('00:00')
  })
})

describe('sop groups', () => {
  it('has the six groups with 2 / 2 / 1 / 2 / 1 questions, Other holding General procedures', () => {
    expect(SOP_GROUPS.map(g => [g.label, g.fields.length])).toEqual([
      ['Check-In & Check-Out', 2],
      ['Guest Requests', 2],
      ['Rules', 1],
      ['Guest Issues', 2],
      ['Emergencies', 1],
      ['Other', 1],
    ])
  })

  it('counts the 8 questions; General procedures and custom SOPs do not count', () => {
    let l = withListing(empty)
    const sops = () => listingSetupProgress(l).sections.find(s => s.key === 'sops')!
    expect(sops()).toMatchObject({ done: 0, total: 8 })
    l = SOP_GROUPS.find(g => g.key === 'other')!.fields[0]!.write(l, 'General notes')
    l = addCustomSop(l)
    expect(sops()).toMatchObject({ done: 0, total: 8 })
    expect(l.resources.sops).toBe('General notes')
    l = SOP_GROUPS[0]!.fields[0]!.write(l, 'Meet at the gate')
    expect(l.sops?.checkInProcedure).toBe('Meet at the gate')
    expect(sops()).toMatchObject({ done: 1 })
  })

  it('adds, edits and removes a custom SOP', () => {
    let l = addCustomSop(withListing(empty))
    const id = l.sops!.custom![0]!.id
    l = updateCustomSop(l, id, { title: 'Pool cleaning', text: 'Every morning' })
    expect(l.sops!.custom).toEqual([{ id, title: 'Pool cleaning', text: 'Every morning', group: 'other' }])
    expect(removeCustomSop(l, id).sops!.custom).toEqual([])
  })
})

describe('amenities', () => {
  it('needs a property amenity and a room amenity on every room type', () => {
    const amenities = (l: Listing) => listingSetupProgress(l).sections.find(s => s.key === 'amenities')!
    const l = withListing(l => ({ ...empty(l), amenities: ['Pool'] }))
    expect(l.unitTypes!.length).toBeGreaterThan(1)
    expect(amenities(l)).toMatchObject({ done: 1, total: 2 })
    const oneType = setRoomAmenities(l, l.unitTypes![0]!.id, ['TV'])
    expect(amenities(oneType)).toMatchObject({ done: 1, total: 2 })
    const allTypes = setRoomAmenities(oneType, l.unitTypes![1]!.id, ['Iron'])
    expect(amenities(allTypes)).toMatchObject({ done: 2, complete: true })
  })

  it('keeps room amenities on the listing when it has no room types', () => {
    const l = withListing(l => ({ ...empty(l), unitTypes: undefined }))
    expect(roomAmenityTargets(l).map(t => t.id)).toEqual([LISTING_ROOMS_TARGET])
    expect(setRoomAmenities(l, LISTING_ROOMS_TARGET, ['TV']).roomAmenities).toEqual(['TV'])
  })

  it('toggles an amenity in and out', () => {
    expect(toggleAmenity(['TV'], 'Iron')).toEqual(['TV', 'Iron'])
    expect(toggleAmenity(['TV', 'Iron'], 'TV')).toEqual(['Iron'])
  })

  it('lists every room amenity once', () => {
    expect(new Set(ROOM_AMENITIES).size).toBe(ROOM_AMENITIES.length)
  })
})

describe('listing address', () => {
  it('parses a three-part location label and maps the country name to its code', () => {
    const l = withListing(l => ({ ...empty(l), location: 'Potsdam, Brandenburg, Germany' }))
    expect(listingAddress(l)).toMatchObject({ city: 'Potsdam', state: 'Brandenburg', country: 'DE' })
    expect(listingTimeZone(l)).toBe('Europe/Berlin')
  })

  it('keeps the location label in step with the address', () => {
    const base = { street: '', unitNumber: '', postalCode: '' }
    expect(locationLabel({ ...base, city: 'Pererenan', state: 'Bali', country: 'ID' }, 'x')).toBe('Pererenan, Bali')
    expect(locationLabel({ ...base, city: 'Potsdam', state: 'Brandenburg', country: 'DE' }, 'x')).toBe('Potsdam, Brandenburg, Germany')
    expect(locationLabel({ ...base, city: ' ', state: '', country: 'ID' }, 'Canggu, Bali')).toBe('Canggu, Bali')
  })
})
