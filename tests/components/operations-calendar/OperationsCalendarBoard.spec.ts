import type { ReservationEntry, ReservationStatus } from '~/components/reservations/data/reservations'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OperationsCalendarBoard from '~/components/operations-calendar/OperationsCalendarBoard.vue'
import { reservationStatusClasses } from '~/components/reservations/data/reservations'
import { useReservationsModule } from '~/composables/useReservationsModule'

const WEEK = ['2027-03-01', '2027-03-02', '2027-03-03', '2027-03-04', '2027-03-05', '2027-03-06', '2027-03-07']

function stay(id: string, guestName: string, checkIn: string, checkOut: string, status = 'verified'): ReservationEntry {
  return { id, listingId: 'lst-1', listingName: 'The R Villa Merapi', guestName, checkIn, checkOut, nights: 1, status, channel: 'Direct', totalPrice: 0 } as ReservationEntry
}

function mountBoard() {
  return mount(OperationsCalendarBoard, {
    props: {
      events: [],
      eventsByDay: new Map(),
      eventsByDayAndListing: new Map(),
      // A listing only renders a row when it has an entry here.
      eventsByListingAndDay: new Map([['lst-1', new Map()]]),
      weekDays: WEEK.map(key => ({ key, label: key, date: new Date(`${key}T00:00:00`) })),
      filters: { listingSearch: '', listingTags: [], eventTypes: [] },
    },
    global: {
      stubs: {
        Icon: true,
        OperationsCalendarEventChip: true,
        OperationsCalendarFilters: true,
        Badge: { template: '<span><slot /></span>' },
        Button: { template: '<button><slot /></button>' },
        Dialog: { template: '<div />' },
      },
    },
  })
}

describe('operationsCalendarBoard stay bars', () => {
  it('ends a departing guest at midday and starts the next guest there, never running together', () => {
    useReservationsModule().reservations.value = [
      stay('r-a', 'Leaving Guest', '2027-02-28', '2027-03-03'),
      stay('r-b', 'Arriving Guest', '2027-03-03', '2027-03-05'),
    ]
    const bars = mountBoard().findAll('[data-testid="stay-bar"]')
    const leaving = bars.find(b => b.text() === 'Leaving Guest')!
    const arriving = bars.find(b => b.text() === 'Arriving Guest')!
    expect(leaving.attributes('data-end-half')).toBe('5')
    expect(arriving.attributes('data-start-half')).toBe('5')
    // Inset and rounded only at a real check-in or check-out: the leaving guest
    // began before this week, so its left edge is flat.
    expect(leaving.classes()).not.toContain('rounded-l-md')
    expect(leaving.classes()).toContain('rounded-r-md')
    expect(arriving.classes()).toEqual(expect.arrayContaining(['rounded-l-md', 'rounded-r-md', 'ml-1', 'mr-1']))
    expect(arriving.attributes('style')).toContain('grid-column: 6 / 10')
  })

  it('stacks a long stay in its own lane instead of drawing it over the guests it overlaps', () => {
    useReservationsModule().reservations.value = [
      stay('r-long', 'Long Stay', '2027-02-01', '2027-04-01'),
      stay('r-a', 'Leaving Guest', '2027-02-28', '2027-03-04'),
      stay('r-b', 'Arriving Guest', '2027-03-05', '2027-03-09'),
    ]
    const wrapper = mountBoard()
    const lane = (name: string) => wrapper.findAll('[data-testid="stay-bar"]').find(b => b.text() === name)!.attributes('data-lane')
    expect(lane('Long Stay')).toBe('0')
    expect(lane('Leaving Guest')).toBe('1')
    expect(lane('Arriving Guest')).toBe('1')
    // The day cells sit below both lanes.
    const firstCell = wrapper.find('[data-testid="stay-bar"]').element.parentElement!.querySelector('.min-h-\\[132px\\]') as HTMLElement
    expect(firstCell.getAttribute('style')).toContain('grid-row: 3 / 4')
  })

  it('draws no bar for a cancelled stay or an inquiry', () => {
    useReservationsModule().reservations.value = [
      stay('r-c', 'Cancelled Guest', '2027-03-02', '2027-03-04', 'cancelled'),
      stay('r-i', 'Inquiry Guest', '2027-03-02', '2027-03-04', 'inquiry'),
    ]
    const names = mountBoard().findAll('[data-testid="stay-bar"]').map(b => b.text())
    expect(names).not.toContain('Cancelled Guest')
    expect(names).not.toContain('Inquiry Guest')
  })

  it('names the guest, the dates and the status in the tooltip', () => {
    useReservationsModule().reservations.value = [stay('r-a', 'Priya Raman', '2027-03-02', '2027-03-04')]
    const bar = mountBoard().findAll('[data-testid="stay-bar"]').find(b => b.text() === 'Priya Raman')!
    expect(bar.attributes('title')).toBe('Priya Raman, 2 Mar to 4 Mar, Verified')
  })

  it('colours each bar like its reservation status badge', () => {
    useReservationsModule().reservations.value = [
      stay('r-v', 'Verified Guest', '2027-03-01', '2027-03-02', 'verified'),
      stay('r-i', 'In House Guest', '2027-03-02', '2027-03-03', 'checked_in'),
      stay('r-o', 'Departed Guest', '2027-03-03', '2027-03-04', 'checked_out'),
      stay('r-u', 'Unverified Guest', '2027-03-04', '2027-03-05', 'unverified'),
      stay('r-w', 'Property Owner', '2027-03-05', '2027-03-06', 'owner_request'),
      stay('r-b', 'Maintenance', '2027-03-06', '2027-03-07', 'blocked'),
    ]
    const bars = mountBoard().findAll('[data-testid="stay-bar"]')
    const bar = (name: string) => bars.find(b => b.text() === name)!
    const expected: Record<string, ReservationStatus> = {
      'Verified Guest': 'verified',
      'In House Guest': 'checked_in',
      'Departed Guest': 'checked_out',
      'Unverified Guest': 'unverified',
      'Property Owner': 'owner_request',
      'Maintenance': 'blocked',
    }
    for (const [name, status] of Object.entries(expected)) {
      expect(bar(name).attributes('data-status'), name).toBe(status)
      for (const cls of reservationStatusClasses[status].split(' '))
        expect(bar(name).classes(), `${name} ${cls}`).toContain(cls)
    }
  })
})
