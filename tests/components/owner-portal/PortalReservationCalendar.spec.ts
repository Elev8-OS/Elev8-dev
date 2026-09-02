import type { OwnerReservation } from '~/components/owners/data/owner-reservations'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import PortalReservationCalendar from '~/components/owner-portal/PortalReservationCalendar.vue'

const ButtonStub = {
  props: ['variant', 'size', 'disabled', 'type'],
  emits: ['click'],
  template: '<button :type="type" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
}
const IconStub = { props: ['name'], template: '<i />' }

const testListings = vi.hoisted(() => [
  { id: 'lst-1', name: 'Villa Sunset', property: 'Canggu', room: '5BR', location: 'Canggu', unitType: 'single', bookings: [], tags: [] },
  { id: 'lst-3', name: 'Bali Villa', property: 'Ubud', room: 'Villa', location: 'Ubud', unitType: 'multi', bookings: [], tags: [] },
  { id: 'lst-8', name: 'Beach House', property: 'Seminyak', room: 'House', location: 'Seminyak', unitType: 'multi', bookings: [], tags: [] },
])

vi.mock('~/components/listings/data/listings', () => ({
  listings: ref(testListings),
}))

const globalOptions = {
  stubs: {
    Button: ButtonStub,
    Icon: IconStub,
    Dialog: { template: '<div><slot /></div>' },
    DialogContent: { template: '<div><slot /></div>' },
    DialogDescription: { template: '<p><slot /></p>' },
    DialogFooter: { template: '<footer><slot /></footer>' },
    DialogHeader: { template: '<header><slot /></header>' },
    DialogTitle: { template: '<h2><slot /></h2>' },
  },
}

function makeReservation(partial: Partial<OwnerReservation> & { id: string, checkIn: string, checkOut: string }): OwnerReservation {
  return {
    type: 'guest',
    listingId: 'lst-1',
    guestName: 'Test Guest',
    channel: 'airbnb',
    status: 'confirmed',
    ...partial,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2025, 11, 15))
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('portalReservationCalendar', () => {
  it('shows a room-specific owner stay only on that room row', async () => {
    const inMezzanine = makeReservation({
      id: 'o-room',
      listingId: 'lst-1',
      type: 'owner_block',
      roomId: 'rm-1-1',
      note: 'Owner-In-Mezz',
      checkIn: '2025-12-10',
      checkOut: '2025-12-14',
    })
    mount(PortalReservationCalendar, {
      attachTo: document.body,
      global: globalOptions,
      props: { anchor: new Date(2025, 11, 1), listingId: 'lst-1', reservations: [inMezzanine] },
    })
    await vi.runOnlyPendingTimersAsync()

    const rows = Array.from(document.body.querySelectorAll('[role="row"]'))
    const mezz = rows.find(r => r.getAttribute('aria-label') === 'Mezzanine 1')
    const studio = rows.find(r => r.getAttribute('aria-label') === 'Studio 1')
    expect(mezz?.textContent).toContain('Owner-In-Mezz')
    expect(studio?.textContent).not.toContain('Owner-In-Mezz')
  })

  it('shows a property-wide owner stay on every room row', async () => {
    const wholeVilla = makeReservation({
      id: 'o-all',
      listingId: 'lst-1',
      type: 'owner_block',
      note: 'Whole-Villa',
      checkIn: '2025-12-10',
      checkOut: '2025-12-14',
    })
    mount(PortalReservationCalendar, {
      attachTo: document.body,
      global: globalOptions,
      props: { anchor: new Date(2025, 11, 1), listingId: 'lst-1', reservations: [wholeVilla] },
    })
    await vi.runOnlyPendingTimersAsync()

    const rows = Array.from(document.body.querySelectorAll('[role="row"]'))
    expect(rows.length).toBeGreaterThan(1)
    // No room named means the whole property is taken.
    for (const row of rows)
      expect(row.textContent).toContain('Whole-Villa')
  })

  it('renders one row per room, grouped by room type', async () => {
    mount(PortalReservationCalendar, {
      attachTo: document.body,
      global: globalOptions,
      props: { anchor: new Date(2025, 11, 1), listingId: 'lst-1', reservations: [] },
    })
    await vi.runOnlyPendingTimersAsync()

    const text = document.body.textContent ?? ''
    // Rooms only — there is no separate row for owner stays.
    expect(text).not.toContain('Your stays')
    expect(text).toContain('Mezzanine 1')
    expect(text).toContain('Mezzanine 2')
    expect(text).toContain('Studio 1')
    // The date axis is linear now — one column per day of the month.
    expect(text).toContain('Room')
  })

  it('places a guest stay in its own room row, not on a shared line', async () => {
    const mezzanine = makeReservation({
      id: 'g-mz',
      listingId: 'lst-1',
      roomId: 'rm-1-1',
      guestName: 'Mezz-Guest',
      checkIn: '2025-12-10',
      checkOut: '2025-12-14',
    })
    const studio = makeReservation({
      id: 'g-st',
      listingId: 'lst-1',
      roomId: 'rm-1-3',
      guestName: 'Studio-Guest',
      // Deliberately the same dates: different rooms, so no collision.
      checkIn: '2025-12-10',
      checkOut: '2025-12-14',
    })
    mount(PortalReservationCalendar, {
      attachTo: document.body,
      global: globalOptions,
      props: { anchor: new Date(2025, 11, 1), listingId: 'lst-1', reservations: [mezzanine, studio] },
    })
    await vi.runOnlyPendingTimersAsync()

    const rows = Array.from(document.body.querySelectorAll('[role="row"]'))
    const mezzRow = rows.find(r => r.getAttribute('aria-label') === 'Mezzanine 1')
    const studioRow = rows.find(r => r.getAttribute('aria-label') === 'Studio 1')
    expect(mezzRow?.textContent).toContain('Mezz-Guest')
    expect(studioRow?.textContent).toContain('Studio-Guest')
    // Each guest appears only in its own room's lane.
    expect(mezzRow?.textContent).not.toContain('Studio-Guest')
    expect(studioRow?.textContent).not.toContain('Mezz-Guest')
  })

  it('half-insets a bar on its arrival and departure days', async () => {
    // December has 31 columns. Dec 10 -> Dec 14 runs from midday on the 10th
    // (index 9) to midday on the 14th (index 13).
    const stay = makeReservation({
      id: 'g-1',
      listingId: 'lst-1',
      roomId: 'rm-1-1',
      guestName: 'Half-Inset',
      checkIn: '2025-12-10',
      checkOut: '2025-12-14',
    })
    mount(PortalReservationCalendar, {
      attachTo: document.body,
      global: globalOptions,
      props: { anchor: new Date(2025, 11, 1), listingId: 'lst-1', reservations: [stay] },
    })
    await vi.runOnlyPendingTimersAsync()

    const bar = Array.from(document.body.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Half-Inset'))
    const style = bar?.parentElement?.getAttribute('style') ?? ''
    const left = Number(style.match(/left:\s*([\d.]+)%/)?.[1])
    const width = Number(style.match(/width:\s*([\d.]+)%/)?.[1])
    expect(left).toBeCloseTo((9.5 / 31) * 100, 1)
    expect(width).toBeCloseTo((4 / 31) * 100, 1)
  })

  it('stacks two overlapping property-wide owner stays on separate lanes', async () => {
    const a = makeReservation({
      id: 'o-a',
      listingId: 'lst-1',
      type: 'owner_block',
      note: 'Block-A',
      checkIn: '2025-12-10',
      checkOut: '2025-12-15',
    })
    const b = makeReservation({
      id: 'o-b',
      listingId: 'lst-1',
      type: 'owner_block',
      note: 'Block-B',
      checkIn: '2025-12-12',
      checkOut: '2025-12-18',
    })
    mount(PortalReservationCalendar, {
      attachTo: document.body,
      global: globalOptions,
      props: { anchor: new Date(2025, 11, 1), listingId: 'lst-1', reservations: [a, b] },
    })
    await vi.runOnlyPendingTimersAsync()

    const buttons = Array.from(document.body.querySelectorAll('button'))
    const topOf = (label: string) => {
      const style = buttons.find(x => x.textContent?.includes(label))?.parentElement?.getAttribute('style') ?? ''
      return Number(style.match(/top:\s*([\d.]+)px/)?.[1])
    }
    // Neither names a room, so both block the whole property and land on
    // every room row — where they must not draw over each other.
    expect(topOf('Block-A')).toBe(6)
    expect(topOf('Block-B')).toBe(38)
  })

  it('renders owner blocks as amber bars with the note', async () => {
    const reservation = makeReservation({
      id: 'o-1',
      listingId: 'lst-1',
      type: 'owner_block',
      note: 'Family visit',
      checkIn: '2025-12-20',
      checkOut: '2025-12-23',
      status: 'confirmed',
    })
    mount(PortalReservationCalendar, {
      attachTo: document.body,
      global: globalOptions,
      props: {
        anchor: new Date(2025, 11, 1),
        reservations: [reservation],
      },
    })
    await vi.runOnlyPendingTimersAsync()

    const bar = document.body.querySelector('button[aria-label*="Owner block"]')
    expect(bar).toBeTruthy()
    expect(bar?.className).toMatch(/bg-amber-400/)
    expect(bar?.textContent).toMatch(/Family visit/)
  })

  it('emits update:anchor when Previous is clicked', async () => {
    const wrapper = mount(PortalReservationCalendar, {
      attachTo: document.body,
      global: globalOptions,
      props: { anchor: new Date(2025, 11, 1), reservations: [] },
    })
    await vi.runOnlyPendingTimersAsync()

    const prev = Array.from(document.body.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Previous month') as HTMLElement | undefined
    expect(prev).toBeTruthy()
    prev!.click()
    await vi.runOnlyPendingTimersAsync()
    expect(wrapper.emitted('update:anchor')).toBeTruthy()
  })
})
