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
  it('renders day cells with the date number top-right', async () => {
    mount(PortalReservationCalendar, {
      attachTo: document.body,
      global: globalOptions,
      props: {
        anchor: new Date(2025, 11, 1),
        reservations: [
          makeReservation({ id: 'r-seed', checkIn: '2025-12-10', checkOut: '2025-12-12' }),
        ],
      },
    })
    await vi.runOnlyPendingTimersAsync()

    const body = document.body.textContent ?? ''
    expect(body).toMatch(/Mon/)
    expect(body).toMatch(/Sun/)
    // In-month day numbers (Dec 1, 15, 31) appear in the body text.
    expect(body).toContain('1')
    expect(body).toContain('15')
    expect(body).toContain('31')
  })

  it('renders guest stays as emerald bars spanning the booking dates', async () => {
    const reservation = makeReservation({
      id: 'r-1',
      listingId: 'lst-1',
      type: 'guest',
      channel: 'airbnb',
      guestName: 'Amelia',
      checkIn: '2025-12-10',
      checkOut: '2025-12-15',
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

    const bar = document.body.querySelector('button[aria-label*="Guest stay for Amelia"]')
    expect(bar).toBeTruthy()
    expect(bar?.className).toMatch(/bg-emerald-800/)
    // Channel badge + guest name rendered.
    expect(bar?.textContent).toMatch(/A/) // Airbnb → A
    expect(bar?.textContent).toMatch(/Amelia/)
  })

  it('renders each reservation as a single bar even when it crosses a week boundary', async () => {
    // Dec 22 (Mon) → Dec 30 (Tue) crosses the Sun→Mon boundary mid-stay.
    const reservation = makeReservation({
      id: 'cross-week',
      listingId: 'lst-1',
      type: 'guest',
      channel: 'direct',
      guestName: 'Cross Week',
      checkIn: '2025-12-22',
      checkOut: '2025-12-30',
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

    const buttons = Array.from(document.body.querySelectorAll('button[aria-label*="Cross Week"]'))
    expect(buttons).toHaveLength(1)
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

  it('renders overlapping owner blocks on the same line (same top value)', async () => {
    const a = makeReservation({
      id: 'a',
      listingId: 'lst-1',
      type: 'owner_block',
      note: 'Block-A',
      checkIn: '2025-12-10',
      checkOut: '2025-12-15',
      status: 'confirmed',
    })
    const b = makeReservation({
      id: 'b',
      listingId: 'lst-1',
      type: 'owner_block',
      note: 'Block-B',
      checkIn: '2025-12-12',
      checkOut: '2025-12-18',
      status: 'confirmed',
    })
    mount(PortalReservationCalendar, {
      attachTo: document.body,
      global: globalOptions,
      props: {
        anchor: new Date(2025, 11, 1),
        reservations: [a, b],
      },
    })
    await vi.runOnlyPendingTimersAsync()

    const buttons = Array.from(document.body.querySelectorAll('button'))
    const barA = buttons.find(b => b.textContent?.includes('Block-A')) as HTMLElement | undefined
    const barB = buttons.find(b => b.textContent?.includes('Block-B')) as HTMLElement | undefined
    expect(barA).toBeTruthy()
    expect(barB).toBeTruthy()
    // Bars share the same horizontal line within their starting row so
    // overlapping stays visually overlap on that line rather than
    // stack. Both blocks start in the same week (Dec 8-14) so the cell
    // rows align, and each bar's wrapper has the same relative `top`
    // offset (set by BAR_TOP_OFFSET_PX) inside its own cell.
    const styleA = barA?.parentElement?.getAttribute('style') ?? ''
    const styleB = barB?.parentElement?.getAttribute('style') ?? ''
    expect(styleA).toContain('top: 36px')
    expect(styleB).toContain('top: 36px')
  })

  it('anchors each bar to the row of its starting cell', async () => {
    // Two non-overlapping reservations in different weeks — each sits
    // at the y of its own starting row.
    const early = makeReservation({
      id: 'early',
      listingId: 'lst-1',
      type: 'guest',
      channel: 'airbnb',
      guestName: 'Early Guest',
      checkIn: '2025-12-10',
      checkOut: '2025-12-12',
      status: 'confirmed',
    })
    const late = makeReservation({
      id: 'late',
      listingId: 'lst-1',
      type: 'guest',
      channel: 'airbnb',
      guestName: 'Late Guest',
      checkIn: '2025-12-22',
      checkOut: '2025-12-24',
      status: 'confirmed',
    })
    mount(PortalReservationCalendar, {
      attachTo: document.body,
      global: globalOptions,
      props: {
        anchor: new Date(2025, 11, 1),
        reservations: [early, late],
      },
    })
    await vi.runOnlyPendingTimersAsync()

    const earlyBtn = document.body.querySelector('button[aria-label*="Early Guest"]') as HTMLElement | null
    const lateBtn = document.body.querySelector('button[aria-label*="Late Guest"]') as HTMLElement | null
    expect(earlyBtn).toBeTruthy()
    expect(lateBtn).toBeTruthy()
    // Bars live inside their starting cell as absolutely-positioned
    // children, so the bar's parent cell carries the start date.
    // Dec 10 sits in row 1 of cells, Dec 22 in row 3 — different cells.
    const earlyCell = earlyBtn?.parentElement?.parentElement
    const lateCell = lateBtn?.parentElement?.parentElement
    expect(earlyCell).not.toBe(lateCell)
    expect(earlyCell?.textContent).toContain('10')
    expect(lateCell?.textContent).toContain('22')
  })

  it('places a block 24-27 on the matching day cells, not Dec 3', async () => {
    const reservation = makeReservation({
      id: 'r-24-27',
      listingId: 'lst-1',
      type: 'owner_block',
      note: 'Range-24-27',
      checkIn: '2025-12-24',
      checkOut: '2025-12-27',
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

    const button = document.body.querySelector('button[aria-label*="Owner block"]') as HTMLElement | null
    expect(button).toBeTruthy()
    // The bar lives inside its starting cell (Dec 24), so the wrapper
    // carries `left:` (the half-cell offset to the middle of Dec 24)
    // and `width:` (enough to reach the middle of Dec 27).
    const style = button?.parentElement?.getAttribute('style') ?? ''
    expect(style).toMatch(/left:/)
    expect(style).toMatch(/width:/)
    // 3 nights (Dec 24-27) spans 3 cells of cell width = ~7.14% of
    // the cell, well past the 5% threshold.
    const widthMatch = style.match(/width:\s*([\d.]+)%/)
    if (widthMatch) {
      const widthPct = Number(widthMatch[1]!)
      expect(widthPct).toBeGreaterThan(5)
    }
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

  it('emits createOwnerReservation when the new reservation button is clicked', async () => {
    const wrapper = mount(PortalReservationCalendar, {
      attachTo: document.body,
      global: globalOptions,
      props: { anchor: new Date(2025, 11, 1), reservations: [] },
    })
    await vi.runOnlyPendingTimersAsync()

    const trigger = Array.from(document.body.querySelectorAll('button')).find(b => b.textContent?.includes('New owner reservation'))
    expect(trigger).toBeTruthy()
    trigger!.click()
    await vi.runOnlyPendingTimersAsync()
    expect(wrapper.emitted('createOwnerReservation')).toBeTruthy()
  })
})
