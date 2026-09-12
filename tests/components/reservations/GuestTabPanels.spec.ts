// The guest detail page moved Activity, Booking History, Payment Requests and
// Upsells into one tabbed card, so these panels are now tab CONTENT: the page
// owns the Card and the heading. A panel that brings its own Card back would
// nest a card inside a card and repeat the tab label, so that is what these
// tests pin.
//
// The Payment Requests tab has no panel component of its own: it renders the
// shared PaymentRequestTable, the same one the payment-requests page uses.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { initialReservations } from '~/components/reservations/data/reservations'
import GuestActivityTimeline from '~/components/reservations/GuestActivityTimeline.vue'
import GuestReservationsTable from '~/components/reservations/GuestReservationsTable.vue'
import GuestUpsells from '~/components/reservations/GuestUpsells.vue'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { mockUpsellOrders } from '~/components/upsells/data/upsell-orders'

const components = { Badge, Card, CardContent, CardHeader, CardTitle, Icon: { template: '<i />' } }

const activityEvent = {
  id: 'act-test-1',
  type: 'reservation' as const,
  title: 'Reservation Confirmed',
  description: 'Direct booking.',
  actor: 'Komang Juliantara',
  timestamp: '2026-09-01T10:00:00Z',
  colorDot: 'green' as const,
}

describe('booking History rows reach a stay', () => {
  // A folio belongs to one stay and a repeat guest has several, so the way to
  // the posting surface has to name which stay it is. The row opens that stay's
  // detail sheet, where its price breakdown and Charges & extras live.
  const stays = [initialReservations.find(r => r.id === 'res-1')!, initialReservations.find(r => r.id === 'res-3')!]

  function mountTable() {
    return mount(GuestReservationsTable, {
      props: { reservations: stays },
      global: { components, stubs: { NuxtLink: { template: '<a><slot /></a>' } } },
    })
  }

  it('emits the stay that was clicked, not merely that a click happened', async () => {
    const wrapper = mountTable()

    await wrapper.findAll('tbody tr')[1]!.trigger('click')

    const emitted = wrapper.emitted('openDetail')
    expect(emitted).toHaveLength(1)
    expect((emitted![0]![0] as { id: string }).id).toBe('res-3')
  })

  it('leaves the listing link alone, so it navigates without opening the sheet', async () => {
    const wrapper = mountTable()

    await wrapper.findAll('tbody tr')[0]!.find('td').trigger('click')

    expect(wrapper.emitted('openDetail')).toBeUndefined()
  })

  it('says nothing when there are no stays to open', () => {
    const wrapper = mount(GuestReservationsTable, {
      props: { reservations: [] },
      global: { components, stubs: { NuxtLink: { template: '<a><slot /></a>' } } },
    })

    expect(wrapper.text()).toContain('No reservations yet.')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })
})

describe('guestActivityTimeline in a tab panel', () => {
  // Doubles as the positive control for the no-Card assertions below: it proves
  // findComponent(Card) really does find a Card with this registration, so
  // those assertions can fail rather than passing vacuously.
  it('brings its own Card when not told to render bare', () => {
    const wrapper = mount(GuestActivityTimeline, {
      props: { events: [activityEvent] },
      global: { components },
    })

    expect(wrapper.findComponent(Card).exists()).toBe(true)
  })

  it('renders bare for the tab, so the page card is not nested', () => {
    const wrapper = mount(GuestActivityTimeline, {
      props: { events: [activityEvent], bare: true },
      global: { components },
    })

    expect(wrapper.findComponent(Card).exists()).toBe(false)
    expect(wrapper.text()).toContain('Reservation Confirmed')
  })
})

describe('guestUpsells as a tab panel', () => {
  const seeded = mockUpsellOrders[0]!

  it('renders its rows without wrapping them in a Card', () => {
    const wrapper = mount(GuestUpsells, {
      props: { orderIds: [seeded.id] },
      global: { components },
    })

    expect(wrapper.findComponent(Card).exists()).toBe(false)
    expect(wrapper.text()).toContain(seeded.serviceName)
  })

  it('does not repeat the tab label as its own heading', () => {
    const wrapper = mount(GuestUpsells, {
      props: { orderIds: [seeded.id] },
      global: { components },
    })

    expect(wrapper.findComponent(CardTitle).exists()).toBe(false)
  })

  it('keeps its empty state, including for an id that no longer resolves', () => {
    const empty = mount(GuestUpsells, { props: { orderIds: [] }, global: { components } })
    expect(empty.text()).toContain('No upsells.')

    const unresolved = mount(GuestUpsells, { props: { orderIds: ['ord-does-not-exist'] }, global: { components } })
    expect(unresolved.text()).toContain('No upsells.')
  })
})
