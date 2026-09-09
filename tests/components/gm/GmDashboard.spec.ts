// Render tests for the General Manager dashboard. The numbers are covered in
// tests/lib/gm-dashboard.spec.ts; what is asserted here is that the panels
// actually render their data, that the date strip drives the bookings list,
// and that the sentiment panel flags what needs an answer.

import type { GmDayBookings, GmStay } from '~/components/gm/data/gm-dashboard'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isoDiffDays } from '~/components/gm/data/gm-dashboard'
import GmBookingRow from '~/components/gm/GmBookingRow.vue'
import GmBookingsPanel from '~/components/gm/GmBookingsPanel.vue'
import GmDashboard from '~/components/gm/GmDashboard.vue'
import GmKpiCard from '~/components/gm/GmKpiCard.vue'
import GmOccupancyChart from '~/components/gm/GmOccupancyChart.vue'
import GmRevenueChart from '~/components/gm/GmRevenueChart.vue'
import GmSentimentPanel from '~/components/gm/GmSentimentPanel.vue'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { Badge } from '~/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '~/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { useCurrentDashboardUser } from '~/composables/useCurrentDashboardUser'
import { useGmDashboard } from '~/composables/useGmDashboard'

const ANCHOR = '2026-09-08'

// The shadcn primitives are registered for real: an unresolved component
// silently renders as a bare tag, which makes every text assertion pass
// vacuously.
const components = {
  // The GM components reach each other through Nuxt auto-imports, which the
  // test environment does not provide.
  GmBookingRow,
  GmBookingsPanel,
  GmKpiCard,
  GmOccupancyChart,
  GmRevenueChart,
  GmSentimentPanel,
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
}

const stubs = {
  Icon: { props: ['name'], template: '<i :data-icon="name" />' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  // Re-emitting click here would double-fire: the parent's own @click also
  // falls through onto this stub's root button.
  Button: {
    props: ['variant', 'size', 'asChild'],
    template: '<button><slot /></button>',
  },
  // Charts need real layout measurement, which jsdom has none of, and their
  // input is asserted through the composable instead.
  BarChart: { props: ['data', 'categories', 'index'], template: '<div data-testid="bar-chart" :data-points="data.length" />' },
  ToggleGroup: { template: '<div><slot /></div>' },
  ToggleGroupItem: { props: ['value'], template: '<button :data-value="value"><slot /></button>' },
  Select: { template: '<div><slot /></div>' },
  SelectTrigger: { template: '<button><slot /></button>' },
  SelectValue: { template: '<span />' },
  SelectContent: { template: '<div><slot /></div>' },
  SelectItem: { props: ['value'], template: '<div :data-value="value"><slot /></div>' },
}

const globalOptions = { components, stubs }

function text(wrapper: ReturnType<typeof mount>): string {
  return wrapper.text().replace(/\s+/g, ' ')
}

function stay(partial: Partial<GmStay> & Pick<GmStay, 'id' | 'checkIn' | 'checkOut'>): GmStay {
  const nights = isoDiffDays(partial.checkIn, partial.checkOut)
  return {
    listingId: 'lst-1',
    listingName: 'Villa Luwa',
    location: 'Canggu, Bali',
    region: 'Bali',
    guestName: 'Anna Schmidt',
    initials: 'AS',
    channel: 'Airbnb',
    nights,
    guests: 2,
    nightlyRate: 100,
    total: 100 * nights,
    status: 'verified',
    eta: '15:00',
    balanceDue: 0,
    ...partial,
  }
}

// Statuses are set the way the generator would set them for this date.
const bookings: GmDayBookings = {
  arrivals: [stay({ id: 'arr-1', checkIn: ANCHOR, checkOut: '2026-09-12', guestName: 'Yuki Tanaka', initials: 'YT', eta: '16:30' })],
  departures: [stay({ id: 'dep-1', checkIn: '2026-09-02', checkOut: ANCHOR, guestName: 'Marco Rossi', initials: 'MR', status: 'checked_out' })],
  stayovers: [stay({ id: 'stay-1', checkIn: '2026-09-05', checkOut: '2026-09-14', guestName: 'Sophie Dubois', initials: 'SD', status: 'checked_in' })],
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('useGmDashboard', useGmDashboard)
  vi.stubGlobal('useCurrentDashboardUser', useCurrentDashboardUser)
})

describe('gmKpiCard', () => {
  it('renders the value, the delta and what it is measured against', () => {
    const wrapper = mount(GmKpiCard, {
      props: {
        label: 'Occupancy tonight',
        value: '78%',
        icon: 'lucide:bed-double',
        delta: '+4.0 pts',
        trend: 'up',
        hint: '18 of 24 properties',
      },
      global: globalOptions,
    })
    expect(text(wrapper)).toContain('Occupancy tonight')
    expect(text(wrapper)).toContain('78%')
    expect(text(wrapper)).toContain('+4.0 pts')
    expect(text(wrapper)).toContain('18 of 24 properties')
  })

  it('colours a fall as bad news and a rise as good', () => {
    const up = mount(GmKpiCard, {
      props: { label: 'ADR', value: '$180', icon: 'lucide:tag', delta: '+2.0%', trend: 'up' },
      global: globalOptions,
    })
    const down = mount(GmKpiCard, {
      props: { label: 'ADR', value: '$180', icon: 'lucide:tag', delta: '-2.0%', trend: 'down' },
      global: globalOptions,
    })
    expect(up.html()).toContain('text-green-700')
    expect(down.html()).toContain('text-red-700')
  })
})

describe('gmBookingsPanel', () => {
  const stripDays = ['2026-09-07', ANCHOR, '2026-09-09']
  const stripOccupancy = new Map([['2026-09-07', 0.5], [ANCHOR, 0.75], ['2026-09-09', 0.25]])

  function mountPanel(selectedDate = ANCHOR) {
    return mount(GmBookingsPanel, {
      props: { stripDays, stripOccupancy, selectedDate, anchorDate: ANCHOR, bookings },
      global: globalOptions,
    })
  }

  it('marks the selected date and labels today', () => {
    const wrapper = mountPanel()
    const days = wrapper.findAll('[data-testid="gm-strip-day"]')
    expect(days).toHaveLength(3)
    expect(days[1]!.attributes('aria-current')).toBe('date')
    expect(days[0]!.attributes('aria-current')).toBeUndefined()
    expect(days[1]!.text()).toContain('today')
  })

  it('states each day\'s load on the strip, for screen readers too', () => {
    const wrapper = mountPanel()
    const days = wrapper.findAll('[data-testid="gm-strip-day"]')
    expect(days[1]!.attributes('aria-label')).toBe('Tuesday, 8 September 2026, 75% occupied')
    expect(wrapper.html()).toContain('width: 75%')
  })

  it('emits the date it was asked for', async () => {
    const wrapper = mountPanel()
    await wrapper.findAll('[data-testid="gm-strip-day"]')[2]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['2026-09-09']])
  })

  it('pages the strip a week at a time and can come back to today', async () => {
    const wrapper = mountPanel()
    const previous = wrapper.find('[aria-label="Previous days"]')
    const next = wrapper.find('[aria-label="Next days"]')
    await previous.trigger('click')
    await next.trigger('click')
    expect(wrapper.emitted('shift')).toEqual([[-7], [7]])
  })

  it('groups the day into arrivals, departures and guests staying on', () => {
    const body = text(mountPanel())
    expect(body).toContain('Arrivals')
    expect(body).toContain('Departures')
    expect(body).toContain('Staying on')
    expect(body).toContain('2 movements')
    expect(body).toContain('1 staying on')
  })

  it('shows an empty date as empty', () => {
    const wrapper = mount(GmBookingsPanel, {
      props: {
        stripDays,
        stripOccupancy,
        selectedDate: '2026-09-09',
        anchorDate: ANCHOR,
        bookings: { arrivals: [], departures: [], stayovers: [] },
      },
      global: globalOptions,
    })
    expect(text(wrapper)).toContain('Nothing booked on this date.')
  })
})

describe('gmDashboard', () => {
  it('renders the four KPI tiles, both charts and both panels', () => {
    const wrapper = mount(GmDashboard, { global: globalOptions })
    expect(text(wrapper)).toContain('Portfolio overview')
    for (const label of ['Occupancy tonight', 'ADR', 'RevPAR', 'Room revenue'])
      expect(text(wrapper)).toContain(label)

    expect(text(wrapper)).toContain('Negative sentiment')
    expect(text(wrapper)).toContain('Occupancy flow')
    expect(text(wrapper)).toContain('Revenue trend')
    expect(text(wrapper)).toContain('Bookings')

    // Occupancy flow spans 14 days; revenue defaults to the 30-day range.
    const charts = wrapper.findAll('[data-testid="bar-chart"]')
    expect(charts.map(c => c.attributes('data-points'))).toEqual(['14', '30'])
  })

  it('scopes every panel to the selected region', async () => {
    const gm = useGmDashboard()
    const wrapper = mount(GmDashboard, { global: globalOptions })
    const allProperties = gm.unitCount.value
    expect(text(wrapper)).toContain(`${allProperties} properties`)

    gm.region.value = 'Germany'
    await wrapper.vm.$nextTick()
    expect(gm.unitCount.value).toBeLessThan(allProperties)
    expect(text(wrapper)).toContain(`${gm.unitCount.value} properties`)
  })

  it('feeds the sentiment panel real negative conversations from the inbox', () => {
    const gm = useGmDashboard()
    gm.region.value = 'all'
    const wrapper = mount(GmDashboard, { global: globalOptions })
    // The seeded inbox has negative-sentiment conversations, so the panel must
    // render rows rather than its empty state.
    expect(gm.sentimentSummary.value.negative).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-testid="gm-sentiment-row"]').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-testid="gm-sentiment-row"]').length)
      .toBeLessThanOrEqual(gm.sentimentSummary.value.negative)
  })

  it('narrows the revenue chart to 14 days on request', async () => {
    const gm = useGmDashboard()
    const wrapper = mount(GmDashboard, { global: globalOptions })
    gm.revenueRange.value = '14d'
    await wrapper.vm.$nextTick()
    const charts = wrapper.findAll('[data-testid="bar-chart"]')
    expect(charts[1]!.attributes('data-points')).toBe('14')
  })
})

describe('gmSentimentPanel', () => {
  const summary = { negative: 3, actionNeeded: 2, excluded: 0 }

  function conv(partial: Record<string, unknown> = {}) {
    return {
      id: 'conv-1',
      guestName: 'Lisa Park',
      guestInitials: 'LP',
      listingName: 'Villa Sunset Cliff',
      sentiment: 'negative',
      sentimentNote: 'Pool has been green for two days',
      status: 'action_needed',
      lastMessageAt: new Date().toISOString(),
      actionCategory: 'cleanliness',
      actionPriority: 'high',
      ...partial,
    } as never
  }

  function mountPanel(props: Record<string, unknown> = {}) {
    return mount(GmSentimentPanel, {
      props: {
        rows: [conv()],
        hiddenCount: 0,
        summary,
        regionLabel: 'All regions',
        ...props,
      },
      global: globalOptions,
    })
  }

  it('leads with the count of guests awaiting a reply', () => {
    const body = text(mountPanel())
    expect(body).toContain('Negative sentiment')
    expect(body).toContain('3 guests unhappy · 2 awaiting a reply')
    expect(body).toContain('2 action needed')
  })

  it('shows the reason, the property and the action flags on a row', () => {
    const body = text(mountPanel())
    expect(body).toContain('Lisa Park')
    expect(body).toContain('Pool has been green for two days')
    expect(body).toContain('Villa Sunset Cliff')
    expect(body).toContain('ACTION NEEDED')
    expect(body).toContain('CLEANLINESS')
    expect(body).toContain('HIGH')
  })

  it('names its icon-only actions for assistive tech', () => {
    // Icon buttons carry no text, so the aria-label is the only name a screen
    // reader gets — and it is what these tests select on.
    const wrapper = mountPanel()
    expect(wrapper.find('[aria-label="Open conversation"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Mark handled"]').exists()).toBe(true)
  })

  it('offers Mark handled only where an action is actually needed', () => {
    const quiet = mountPanel({
      rows: [conv({ status: null, actionPriority: 'default' })],
      summary: { negative: 1, actionNeeded: 0, excluded: 0 },
    })
    expect(quiet.find('[aria-label="Mark handled"]').exists()).toBe(false)
    // Nothing is flagged, so the header badge goes too.
    expect(text(quiet)).not.toContain('action needed')
    // Opening the conversation is still offered.
    expect(quiet.find('[aria-label="Open conversation"]').exists()).toBe(true)
  })

  it('emits the conversation for both actions', async () => {
    const wrapper = mountPanel()
    await wrapper.find('[aria-label="Open conversation"]').trigger('click')
    await wrapper.find('[aria-label="Mark handled"]').trigger('click')
    expect(wrapper.emitted('open')).toEqual([['conv-1']])
    expect(wrapper.emitted('handled')).toEqual([['conv-1']])
  })

  it('names the region in its empty state', () => {
    const wrapper = mountPanel({
      rows: [],
      summary: { negative: 0, actionNeeded: 0, excluded: 0 },
      regionLabel: 'Germany',
    })
    expect(text(wrapper)).toContain('No guest is unhappy right now')
    expect(text(wrapper)).toContain('No negative sentiment in Germany.')
  })

  it('defers the overflow to the inbox rather than growing', () => {
    const wrapper = mountPanel({ hiddenCount: 5 })
    expect(text(wrapper)).toContain('5 more in the inbox')
  })

  it('marks a flagged row with a border, never a coloured card background', () => {
    // A tinted card background was explicitly not wanted: red stays as a
    // border and badge text only.
    const wrapper = mountPanel()
    const row = wrapper.find('[data-testid="gm-sentiment-row"]')
    expect(row.classes()).toContain('border-red-500/30')
    expect(wrapper.html()).not.toContain('bg-red')
  })

  it('discloses conversations it could not place in the region', () => {
    // Region scoping matches on listing name, and half the mock conversations
    // name a listing that no longer exists — saying so beats looking empty.
    const wrapper = mountPanel({
      summary: { negative: 1, actionNeeded: 0, excluded: 3 },
      regionLabel: 'Bali',
    })
    expect(text(wrapper)).toContain('3 more outside Bali')
  })
})
