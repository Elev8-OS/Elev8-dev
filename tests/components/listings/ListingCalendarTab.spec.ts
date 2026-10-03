import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { listings } from '~/components/listings/data/listings'
import ListingCalendarTab from '~/components/listings/ListingCalendarTab.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useReservationsModule } from '~/composables/useReservationsModule'

const passthrough = { template: '<div><slot /></div>' }
const STUBS = {
  Icon: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  Sheet: { props: ['open'], template: '<div v-if="open" data-testid="guest-sheet"><slot /></div>' },
  SheetContent: passthrough,
  SheetHeader: passthrough,
  SheetTitle: passthrough,
  SheetDescription: passthrough,
  SheetFooter: passthrough,
  ClientOnly: passthrough,
  // The hover card renders its content inline, so the test can read it without hovering.
  HoverCard: passthrough,
  HoverCardTrigger: passthrough,
  HoverCardContent: passthrough,
  // The room filter as a native select, so a test can pick a room.
  Select: { props: ['modelValue'], emits: ['update:modelValue'], template: '<select data-testid="room-filter" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>' },
  SelectTrigger: { template: '<slot />' },
  SelectValue: true,
  SelectContent: { template: '<slot />' },
  SelectGroup: { template: '<slot />' },
  SelectLabel: true,
  SelectSeparator: true,
  SelectItem: { props: ['value'], template: '<option :value="value"><slot /></option>' },
  ReservationDetailSheet: {
    props: ['reservation', 'open'],
    template: '<div v-if="open" data-testid="reservation-detail-sheet" :data-reservation-id="reservation?.id" />',
  },
}
const COMPONENTS = { Badge, Button, Card, Tabs, TabsList, TabsTrigger }
/** Statuses drawn under the guest's name; owner stays and blocks show their reason instead. */
const GUEST_STATUSES: string[] = ['unverified', 'verified', 'checked_in', 'checked_out']

/** lst-1 has several rooms, so the tab opens on the rooms timeline; month-grid tests switch first. */
async function showMonthGrid(wrapper: ReturnType<typeof mountTab>) {
  const trigger = wrapper.find('[data-testid="calendar-view-month"]')
  if (trigger.exists()) {
    await trigger.trigger('mousedown', { button: 0 })
    await trigger.trigger('click')
    await nextTick()
  }
}

function mountTab(listingId = 'lst-1') {
  const listing = listings.value.find(l => l.id === listingId)!
  return mount(ListingCalendarTab, { props: { listing }, global: { components: COMPONENTS, stubs: STUBS } })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 7, 1, 9, 0))
  vi.stubGlobal('navigateTo', vi.fn())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('listingCalendarTab', () => {
  it('opens on the current month and draws a bar per stay', () => {
    const wrapper = mountTab()
    expect(wrapper.get('[data-testid="calendar-month-label"]').text()).toBe('August 2026')
    const bars = wrapper.findAll('[data-testid="calendar-stay-bar"]').map(b => b.text())
    expect(bars.some(t => t.includes('Isabella Romano'))).toBe(true)
  })

  it('draws a stay crossing a week as one bar per week, without a rounded end at the cut', async () => {
    const wrapper = mountTab()
    await showMonthGrid(wrapper)
    // Isabella Romano: 30 Jul → 4 Aug, the first grid week of August runs Mon 27 Jul → Sun 2 Aug.
    const isabella = wrapper.findAll('[data-testid="calendar-stay-bar"]').filter(b => b.text().includes('Isabella Romano'))
    expect(isabella).toHaveLength(2)
    expect(isabella[0]!.classes()).toContain('rounded-l-md')
    expect(isabella[0]!.classes()).not.toContain('rounded-r-md')
    expect(isabella[1]!.classes()).not.toContain('rounded-l-md')
    expect(isabella[1]!.classes()).toContain('rounded-r-md')
  })

  it('includes stays from the Reservations module', () => {
    const { reservations } = useReservationsModule()
    const res = reservations.value.find(r => r.listingId === 'lst-1' && r.checkIn.startsWith('2026-08') && GUEST_STATUSES.includes(r.status))!
    const wrapper = mountTab()
    const rows = wrapper.findAll('[data-testid="calendar-guest-row"]').map(r => r.text())
    expect(rows.some(t => t.includes(res.guestName))).toBe(true)
  })

  it('moves between months', async () => {
    const wrapper = mountTab()
    await wrapper.get('[aria-label="Next month"]').trigger('click')
    expect(wrapper.get('[data-testid="calendar-month-label"]').text()).toBe('September 2026')
    await wrapper.get('[aria-label="Previous month"]').trigger('click')
    await wrapper.get('[aria-label="Previous month"]').trigger('click')
    expect(wrapper.get('[data-testid="calendar-month-label"]').text()).toBe('July 2026')
  })

  it('opens the reservation detail sheet for a Reservations-module stay', async () => {
    const { reservations } = useReservationsModule()
    const res = reservations.value.find(r => r.listingId === 'lst-1' && r.checkIn.startsWith('2026-08') && GUEST_STATUSES.includes(r.status))!
    const wrapper = mountTab()
    expect(wrapper.find('[data-testid="reservation-detail-sheet"]').exists()).toBe(false)
    const row = wrapper.findAll('[data-testid="calendar-guest-row"]').find(r => r.text().includes(res.guestName))!
    await row.trigger('click')
    await nextTick()
    expect(wrapper.get('[data-testid="reservation-detail-sheet"]').attributes('data-reservation-id')).toBe(res.id)
    expect(wrapper.find('[data-testid="guest-sheet"]').exists()).toBe(false)
  })

  it('opens the guest sheet for a listing booking, which has no reservation record', async () => {
    const wrapper = mountTab()
    const bar = wrapper.findAll('[data-testid="calendar-stay-bar"]').find(b => b.text().includes('Isabella Romano'))!
    await bar.trigger('click')
    await nextTick()
    expect(wrapper.get('[data-testid="guest-sheet"]').text()).toContain('Isabella Romano')
    expect(wrapper.find('[data-testid="reservation-detail-sheet"]').exists()).toBe(false)
  })

  it('offers a jump to the nearest stay when the month is empty', async () => {
    vi.setSystemTime(new Date(2027, 5, 1, 9, 0))
    const wrapper = mountTab()
    expect(wrapper.findAll('[data-testid="calendar-guest-row"]')).toHaveLength(0)
    const jump = wrapper.findAll('button').find(b => b.text().startsWith('Go to'))!
    await jump.trigger('click')
    expect(wrapper.findAll('[data-testid="calendar-guest-row"]').length).toBeGreaterThan(0)
  })

  it('fills a bar with the solid colour of its status', () => {
    const wrapper = mountTab()
    const isabella = wrapper.findAll('[data-testid="calendar-stay-bar"]').find(b => b.text().includes('Isabella Romano'))!
    expect(isabella.classes()).toContain('bg-orange-500')
    expect(isabella.classes()).toContain('text-white')
  })

  it('shows the guest\'s details in the hover card', () => {
    const { reservations } = useReservationsModule()
    const res = reservations.value.find(r => r.listingId === 'lst-1' && r.checkIn.startsWith('2026-08') && GUEST_STATUSES.includes(r.status))!
    const wrapper = mountTab()
    const card = wrapper.findAll('[data-testid="stay-hover-card"]').find(c => c.text().includes(res.guestName))!
    expect(card.text()).toContain(`${res.currency} `)
    expect(card.text()).toContain(listings.value.find(l => l.id === 'lst-1')!.location)
    expect(card.text()).toMatch(/\d+ Adults?/)
  })
})

describe('rooms timeline (multi-room listings)', () => {
  function rowIds(wrapper: ReturnType<typeof mountTab>) {
    return wrapper.findAll('[data-testid="room-row"]').map(r => r.attributes('data-room'))
  }

  it('opens a multi-room listing on one row per room, grouped by room type', () => {
    const listing = listings.value.find(l => l.id === 'lst-1')!
    const units = (listing.unitTypes ?? []).flatMap(t => t.units.map(u => u.id))
    expect(units.length).toBeGreaterThan(1)
    const wrapper = mountTab()
    expect(wrapper.find('[data-testid="room-timeline"]').exists()).toBe(true)
    expect(rowIds(wrapper).filter(id => id !== '__unassigned__')).toEqual(units)
    expect(wrapper.findAll('[data-testid="room-group"]').map(g => g.text())).toEqual((listing.unitTypes ?? []).map(t => t.name))
  })

  it('puts a stay on every room it books, and stays without a room in their own row', async () => {
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0))
    const { reservations } = useReservationsModule()
    const multi = reservations.value.find(r => r.listingId === 'lst-1' && (r.rooms?.length ?? 0) > 1)!
    const wrapper = mountTab()
    const rowsWithGuest = wrapper.findAll('[data-testid="room-row"]')
      .filter(r => r.findAll('[data-testid="calendar-stay-bar"]').some(b => b.text().includes(multi.guestName)))
      .map(r => r.attributes('data-room'))
    expect(rowsWithGuest).toEqual([...new Set(multi.rooms!.map(r => r.unitId))])
    const unassigned = wrapper.find('[data-room="__unassigned__"]')
    expect(unassigned.exists()).toBe(true)
    expect(unassigned.text()).toContain('Not assigned to a room')
  })

  it('counts occupancy in room-nights and lists each guest\'s rooms', async () => {
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0))
    const { reservations } = useReservationsModule()
    const multi = reservations.value.find(r => r.listingId === 'lst-1' && (r.rooms?.length ?? 0) > 1)!
    const wrapper = mountTab()
    expect(wrapper.get('[data-testid="occupancy-detail"]').text()).toMatch(/\d+ of \d+ room-nights/)
    const row = wrapper.findAll('[data-testid="calendar-guest-row"]').find(r => r.text().includes(multi.guestName))!
    expect(row.get('[data-testid="guest-row-rooms"]').text()).toContain(multi.rooms![0]!.unitName)
  })

  it('shows only the room picked at the top of the listing', () => {
    const listing = listings.value.find(l => l.id === 'lst-1')!
    const unit = listing.unitTypes![0]!.units[0]!
    const wrapper = mount(ListingCalendarTab, { props: { listing, activeUnit: unit }, global: { components: COMPONENTS, stubs: STUBS } })
    expect(rowIds(wrapper).filter(id => id !== '__unassigned__')).toEqual([unit.id])
  })

  it('keeps the month grid for a single-room listing, with no view switch', () => {
    const single = listings.value.find(l => l.unitType === 'single')!
    const wrapper = mountTab(single.id)
    expect(wrapper.find('[data-testid="room-timeline"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="calendar-view-rooms"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="calendar-week"]').length).toBeGreaterThan(3)
  })
})

describe('putting guests in rooms', () => {
  const POPOVER = { template: '<div><slot /></div>' }
  const ROOM_STUBS = { ...STUBS, Popover: POPOVER, PopoverTrigger: POPOVER, PopoverContent: POPOVER }

  function mountRooms() {
    const listing = listings.value.find(l => l.id === 'lst-1')!
    return mount(ListingCalendarTab, { props: { listing }, global: { components: COMPONENTS, stubs: ROOM_STUBS } })
  }

  function unroomedStayThisMonth() {
    const { reservations } = useReservationsModule()
    return reservations.value.find(r => r.listingId === 'lst-1' && !r.rooms?.length && r.status !== 'cancelled' && r.status !== 'inquiry' && r.checkIn.startsWith('2026-09'))!
  }

  it('moves a stay into a room by dropping it on the room\'s row', async () => {
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0))
    const stay = unroomedStayThisMonth()
    const wrapper = mountRooms()
    const bar = wrapper.get('[data-room="__unassigned__"]').findAll('[data-testid="calendar-stay-bar"]').find(b => b.text().includes(stay.guestName))!
    expect(bar.attributes('draggable')).toBe('true')
    const data = new Map<string, string>()
    const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? '', effectAllowed: '', dropEffect: '' }
    await bar.trigger('dragstart', { dataTransfer })
    const target = wrapper.get('[data-room="un-2"]')
    await target.trigger('dragover', { dataTransfer })
    await target.trigger('drop', { dataTransfer })
    await nextTick()
    expect(useReservationsModule().reservations.value.find(r => r.id === stay.id)!.assignedUnitIds).toEqual(['un-2'])
    expect(wrapper.get('[data-room="un-2"]').text()).toContain(stay.guestName)
  })

  it('does not let a stay with priced rooms be dragged', () => {
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0))
    const { reservations } = useReservationsModule()
    const multi = reservations.value.find(r => r.listingId === 'lst-1' && (r.rooms?.length ?? 0) > 1)!
    const wrapper = mountRooms()
    const bars = wrapper.findAll('[data-testid="calendar-stay-bar"]').filter(b => b.text().includes(multi.guestName))
    expect(bars.length).toBeGreaterThan(0)
    expect(bars.every(b => b.attributes('draggable') === undefined)).toBe(true)
  })

  it('assigns a room from the guest list, with taken rooms disabled', async () => {
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0))
    const stay = unroomedStayThisMonth()
    const wrapper = mountRooms()
    const option = wrapper.get(`[data-testid="assign-room-${stay.id}"]`)
    expect(option.text()).toContain('Assign room')
    await wrapper.get(`[data-testid="assign-room-option-${stay.id}-un-2"]`).trigger('click')
    expect(useReservationsModule().reservations.value.find(r => r.id === stay.id)!.assignedUnitIds).toEqual(['un-2'])
  })
})

describe('rooms in the month grid', () => {
  it('names the room on each bar of a multi-room listing, or says it has none', async () => {
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0))
    const { reservations } = useReservationsModule()
    const multi = reservations.value.find(r => r.listingId === 'lst-1' && (r.rooms?.length ?? 0) > 1)!
    const wrapper = mountTab()
    await showMonthGrid(wrapper)
    const bar = wrapper.findAll('[data-testid="calendar-stay-bar"]').find(b => b.text().includes(multi.guestName))!
    const roomCount = new Set(multi.rooms!.map(r => r.unitId)).size
    expect(bar.get('[data-testid="stay-bar-room"]').text()).toBe(`· ${multi.rooms![0]!.unitName} +${roomCount - 1}`)
    expect(wrapper.findAll('[data-testid="stay-bar-room"]').some(r => r.text() === '· No room')).toBe(true)
  })

  it('leaves the room off the bars of a single-room listing', () => {
    const single = listings.value.find(l => l.unitType === 'single' && l.bookings.length)!
    const wrapper = mountTab(single.id)
    expect(wrapper.find('[data-testid="stay-bar-room"]').exists()).toBe(false)
  })
})

describe('room filter', () => {
  async function filtered(room: string) {
    vi.setSystemTime(new Date(2026, 8, 1, 9, 0))
    const wrapper = mountTab()
    await wrapper.get('[data-testid="room-filter"]').setValue(room)
    await nextTick()
    return wrapper
  }

  function multiStay() {
    const { reservations } = useReservationsModule()
    return reservations.value.find(r => r.listingId === 'lst-1' && (r.rooms?.length ?? 0) > 1)!
  }

  it('shows only the stays in the chosen room in the month grid and the guest list', async () => {
    const multi = multiStay()
    const room = multi.rooms![0]!.unitId
    const wrapper = await filtered(room)
    await showMonthGrid(wrapper)
    const barNames = wrapper.findAll('[data-testid="calendar-stay-bar"]').map(b => b.text())
    expect(barNames.length).toBeGreaterThan(0)
    expect(barNames.every(t => t.includes(multi.guestName))).toBe(true)
    const rows = wrapper.findAll('[data-testid="calendar-guest-row"]').map(r => r.text())
    expect(rows.every(t => t.includes(multi.guestName))).toBe(true)
    expect(wrapper.text().replace(/\s+/g, ' ')).toContain(`Guests in September 2026, ${multi.rooms![0]!.unitName}`)
  })

  it('counts that room\'s own nights, not room-nights', async () => {
    const wrapper = await filtered(multiStay().rooms![0]!.unitId)
    expect(wrapper.get('[data-testid="occupancy-detail"]').text()).toMatch(/^\d+ booked nights$/)
  })

  it('shows only the stays not in a room', async () => {
    const multi = multiStay()
    const wrapper = await filtered('__unassigned__')
    const rows = wrapper.findAll('[data-testid="calendar-guest-row"]').map(r => r.text())
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some(t => t.includes(multi.guestName))).toBe(false)
    expect(wrapper.findAll('[data-testid="room-row"]').map(r => r.attributes('data-room'))).toEqual(['__unassigned__'])
  })

  it('narrows the rooms timeline to the chosen room, without the unassigned row', async () => {
    const room = multiStay().rooms![0]!.unitId
    const wrapper = await filtered(room)
    expect(wrapper.findAll('[data-testid="room-row"]').map(r => r.attributes('data-room'))).toEqual([room])
  })
})
