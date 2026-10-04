import type { Listing } from '~/components/listings/data/listings'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { toRaw } from 'vue'
import { findUnit, guideContentForRooms, isRoomCustom, isRoomGuideKind, resetRoomField, ROOM_OVERRIDE_FIELDS, roomAsProperty, roomCustomCount, roomFieldValue, roomGuideItems, roomPhotos, setRoomField, setRoomGuideItems, setRoomPhotos, setRoomSops } from '~/components/listings/data/listing-room-overrides'
import { listings } from '~/components/listings/data/listings'
import RoomSettingsCard from '~/components/listings/setup/RoomSettingsCard.vue'

const lst1 = (): Listing => JSON.parse(JSON.stringify(toRaw(listings.value[0]!)))
const field = (key: string) => ROOM_OVERRIDE_FIELDS.find(f => f.key === key)!
const roomId = (l: Listing) => l.unitTypes![0]!.units[0]!.id

describe('room overrides', () => {
  it('a room uses the property\'s value until it sets its own', () => {
    let l = lst1()
    const id = roomId(l)
    expect(isRoomCustom(findUnit(l, id), 'wifiSsid')).toBe(false)
    expect(roomFieldValue(l, findUnit(l, id), field('wifiSsid'))).toBe(l.wifiSsid)
    l = setRoomField(l, id, field('wifiSsid'), 'Suite_5G')
    expect(isRoomCustom(findUnit(l, id), 'wifiSsid')).toBe(true)
    expect(roomFieldValue(l, findUnit(l, id), field('wifiSsid'))).toBe('Suite_5G')
    // The property itself is untouched, and the other room still inherits.
    expect(l.wifiSsid).toBe(lst1().wifiSsid)
    expect(isRoomCustom(l.unitTypes![0]!.units[1], 'wifiSsid')).toBe(false)
    l = resetRoomField(l, id, 'wifiSsid')
    expect(isRoomCustom(findUnit(l, id), 'wifiSsid')).toBe(false)
  })

  it('changing one end of the check-in window pins the other end for the room', () => {
    const l = setRoomField(lst1(), roomId(lst1()), field('checkInTime'), '16:00')
    const fields = findUnit(l, roomId(l))!.overrides!.fields!
    expect(fields).toMatchObject({ 'checkInTime': '16:00', 'checkInTime:end': lst1().details!.checkInUntil })
  })

  it('photos: the property\'s until the room has its own; reset goes back', () => {
    let l = lst1()
    const id = roomId(l)
    expect(roomPhotos(l, findUnit(l, id))).toEqual(l.photos)
    l = setRoomPhotos(l, id, ['room.jpg'])
    expect(roomPhotos(l, findUnit(l, id))).toEqual(['room.jpg'])
    l = setRoomPhotos(l, id, undefined)
    expect(findUnit(l, id)!.overrides!.photos).toBeUndefined()
  })

  it('roomAsProperty: the property with the room\'s name, photos, own values and SOPs on top (what HostBuddy sees)', () => {
    let l = lst1()
    const id = roomId(l)
    l = setRoomField(l, id, field('wifiSsid'), 'Suite_5G')
    l = setRoomField(l, id, field('checkOutTime'), '12:00')
    l = setRoomPhotos(l, id, ['room.jpg'])
    l = setRoomSops(l, id, [{ id: 'r1', title: 'Jacuzzi', text: 'Drain after checkout', group: 'other' }])
    const room = roomAsProperty(l, id)
    expect(room).toMatchObject({ name: findUnit(l, id)!.name, wifiSsid: 'Suite_5G', photos: ['room.jpg'] })
    expect(room.resources.basics.checkOutTime).toBe('12:00')
    // Inherited values stay the property's.
    expect(room.wifiPassword).toBe(l.wifiPassword)
    expect(room.resources.basics.description).toBe(l.resources.basics.description)
    expect(room.sops!.custom!.map(s => s.title)).toContain('Jacuzzi')
    // Wi-Fi, check-out, photos and SOPs, plus the seeded Master Suite guide items.
    expect(roomCustomCount(findUnit(l, id))).toBe(5)
  })
})

describe('roomSettingsCard', () => {
  const stubs = {
    Icon: true,
    Label: { template: '<label><slot /></label>' },
    Input: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    Textarea: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
  }

  it('shows each field as Same as property, and editing makes it Custom for this room', async () => {
    const l = lst1()
    const id = roomId(l)
    const w = mount(RoomSettingsCard, { props: { listing: l, unitId: id }, global: { stubs } })
    const wifi = () => w.find('[data-testid="room-field-wifiSsid"]')
    expect(wifi().find('[data-testid="room-field-inherited"]').exists()).toBe(true)
    expect((wifi().find('input').element as HTMLInputElement).value).toBe(l.wifiSsid)
    await wifi().find('input').setValue('Suite_5G')
    const updated = w.emitted('update')![0]![0] as Listing
    await w.setProps({ listing: updated })
    expect(wifi().find('[data-testid="room-field-custom"]').exists()).toBe(true)
    await wifi().find('[aria-label="Reset WiFi Network to the property\'s"]').trigger('click')
    expect(isRoomCustom(findUnit(w.emitted('update')![1]![0] as Listing, id), 'wifiSsid')).toBe(false)
  })
})

describe('room guest guide additions', () => {
  it('a stay in a room gets the property\'s items, then the room\'s own, labelled', () => {
    const l = lst1()
    const content = guideContentForRooms(l, ['un-1'])
    expect(content.checkin.at(-1)).toMatchObject({ title: 'Find the Master Suite', roomName: 'Master Suite' })
    expect(guideContentForRooms(l, []).checkin.some(i => i.roomName)).toBe(false)
  })

  it('a room only adds to check-in steps and Good to Know', () => {
    expect(isRoomGuideKind('checkin')).toBe(true)
    expect(isRoomGuideKind('house_rules')).toBe(false)
  })

  it('writes a room\'s own items without touching the property\'s', () => {
    const l = setRoomGuideItems(lst1(), 'un-2', 'good_to_know', [{ id: 'x', title: 'Garden door sticks' }])
    expect(roomGuideItems(l, 'un-2', 'good_to_know').map(i => i.title)).toEqual(['Garden door sticks'])
    expect(l.guestGuide).toEqual(lst1().guestGuide)
  })
})
