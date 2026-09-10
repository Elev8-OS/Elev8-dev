// The guest detail page moved Activity, Booking History, Payment Requests and
// Upsells into one tabbed card, so these panels are now tab CONTENT: the page
// owns the Card and the heading. A panel that brings its own Card back would
// nest a card inside a card and repeat the tab label, so that is what these
// tests pin.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GuestActivityTimeline from '~/components/reservations/GuestActivityTimeline.vue'
import GuestPaymentRequests from '~/components/reservations/GuestPaymentRequests.vue'
import GuestUpsells from '~/components/reservations/GuestUpsells.vue'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { mockUpsellOrders } from '~/components/upsells/data/upsell-orders'

const components = { Badge, Card, CardContent, CardHeader, CardTitle, Icon: { template: '<i />' } }

function paymentRequest(over: Record<string, unknown> = {}) {
  return {
    id: 'pr-test-1',
    guestName: 'Emily Chen',
    guestEmail: 'emily.chen@email.com',
    listingId: 'lst-2',
    title: 'Balance for August stay',
    amount: 200,
    currency: 'USD',
    feeMode: 'card',
    feeAmount: 6,
    totalAmount: 206,
    status: 'pending',
    payoutAccountId: 'pa-1',
    paymentLink: 'https://pay.example.com/pr-test-1',
    expiresAt: '2026-09-30T00:00:00Z',
    createdAt: '2026-09-01T10:00:00Z',
    createdBy: 'Komang Juliantara',
    ...over,
  }
}

const activityEvent = {
  id: 'act-test-1',
  type: 'reservation' as const,
  title: 'Reservation Confirmed',
  description: 'Direct booking.',
  actor: 'Komang Juliantara',
  timestamp: '2026-09-01T10:00:00Z',
  colorDot: 'green' as const,
}

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

describe('guestPaymentRequests as a tab panel', () => {
  it('renders its rows without wrapping them in a Card', () => {
    const wrapper = mount(GuestPaymentRequests, {
      props: { requests: [paymentRequest()] },
      global: { components },
    })

    expect(wrapper.findComponent(Card).exists()).toBe(false)
    expect(wrapper.text()).toContain('Balance for August stay')
    expect(wrapper.text()).toContain('206 USD')
  })

  it('does not repeat the tab label as its own heading', () => {
    const wrapper = mount(GuestPaymentRequests, {
      props: { requests: [paymentRequest()] },
      global: { components },
    })

    expect(wrapper.findComponent(CardTitle).exists()).toBe(false)
  })

  it('keeps its empty state', () => {
    const wrapper = mount(GuestPaymentRequests, {
      props: { requests: [] },
      global: { components },
    })

    expect(wrapper.text()).toContain('No payment requests.')
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
