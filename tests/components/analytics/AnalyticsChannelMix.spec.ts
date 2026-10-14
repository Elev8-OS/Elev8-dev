// The Direct row of the channel mix opens into its website split. Collapsed
// by default; the chevron toggles it and reports its state.

import type { ChannelShare } from '~/components/analytics/data/analytics'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import AnalyticsChannelMix from '~/components/analytics/AnalyticsChannelMix.vue'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'

const SHARES: ChannelShare[] = [
  { channel: 'Airbnb', stays: 6, revenue: 1200, percent: 60 },
  {
    channel: 'Direct',
    stays: 4,
    revenue: 900,
    percent: 40,
    sites: [
      { websiteId: '1', name: 'Villa Sunset Bali', stays: 3, revenue: 700, percent: 30 },
      { websiteId: null, name: 'Other direct', stays: 1, revenue: 200, percent: 10 },
    ],
  },
]

enableAutoUnmount(afterEach)

function render() {
  return mount(AnalyticsChannelMix, {
    props: { shares: SHARES, currency: 'USD' },
    attachTo: document.body,
    global: {
      components: { Button, Card, CardContent, CardDescription, CardHeader, CardTitle },
      stubs: { Icon: true, DonutChart: true, ClientOnly: { template: '<div><slot /></div>' } },
    },
  })
}

describe('analyticsChannelMix website split', () => {
  it('keeps one row per channel and only Direct gets a toggle', () => {
    const wrapper = render()
    expect(wrapper.findAll('[data-testid="analytics-channel-row"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="analytics-direct-sites-toggle"]')).toHaveLength(1)
  })

  it('is collapsed by default and expands on click', async () => {
    const wrapper = render()
    const toggle = wrapper.get('[data-testid="analytics-direct-sites-toggle"]')
    const panel = wrapper.get('[data-testid="analytics-direct-sites"]')
    expect(panel.isVisible()).toBe(false)
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(toggle.attributes('aria-label')).toBe('Show direct bookings by website')

    await toggle.trigger('click')
    expect(panel.isVisible()).toBe(true)
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.attributes('aria-label')).toBe('Hide direct bookings by website')
    const rows = wrapper.findAll('[data-testid="analytics-direct-site-row"]')
    expect(rows.map(r => r.text())).toEqual([
      expect.stringContaining('Villa Sunset Bali'),
      expect.stringContaining('Other direct'),
    ])
    expect(rows[0]!.text()).toContain('3 stays')
    expect(rows[0]!.text()).toContain('USD 700')
    expect(rows[0]!.text()).toContain('30%')

    await toggle.trigger('click')
    expect(panel.isVisible()).toBe(false)
  })
})
