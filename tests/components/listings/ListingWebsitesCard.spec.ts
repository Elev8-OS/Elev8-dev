import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultWebsiteState, newRuleSet, websiteChannel } from '~/components/channels/data/website-channel'
import ListingWebsitesCard from '~/components/listings/ListingWebsitesCard.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { websites } from '~/components/website-builder/data/websites'

const STUBS = {
  Icon: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
}
const COMPONENTS = { Badge, Button, Card }

let savedSites: typeof websites.value

beforeEach(() => {
  localStorage.clear()
  savedSites = websites.value
  // prop-1 covers lst-1 and lst-5; prop-2 covers lst-12.
  websites.value = [
    { id: 'w1', name: 'Villa Site', url: 'villa.com', status: 'published', template: '', visits: 0, lastUpdated: '', thumbnail: null, propertyIds: ['prop-1'] },
    { id: 'w2', name: 'Draft Site', url: 'draft.com', status: 'draft', template: '', visits: 0, lastUpdated: '', thumbnail: null, propertyIds: ['prop-1', 'prop-2'] },
    { id: 'w3', name: 'Unset Site', url: 'unset.com', status: 'published', template: '', visits: 0, lastUpdated: '', thumbnail: null },
  ]
})

afterEach(() => {
  websites.value = savedSites
  websiteChannel.value = defaultWebsiteState()
})

function mountFor(listingId: string) {
  return mount(ListingWebsitesCard, { props: { listingId }, global: { components: COMPONENTS, stubs: STUBS } })
}

describe('listingWebsitesCard', () => {
  it('lists each site selling the listing with url and status', () => {
    const rows = mountFor('lst-1').findAll('[data-testid="listing-website-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Villa Site')
    expect(rows[0]!.text()).toContain('villa.com')
    expect(rows[0]!.text()).toContain('Published')
    expect(rows[1]!.text()).toContain('Draft Site')
    expect(rows[1]!.text()).toContain('Draft')
  })

  it('does not show a site with no coverage set', () => {
    expect(mountFor('lst-1').text()).not.toContain('Unset Site')
  })

  it('hides rule sets while the Website channel is not added', () => {
    websiteChannel.value = { enabled: false, ruleSets: [{ ...newRuleSet('Summer'), websiteIds: ['w1'] }] }
    const wrapper = mountFor('lst-1')
    expect(wrapper.find('[data-testid="listing-website-rule-set"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Summer')
  })

  it('names the rule set of each site, or "No rule set"', () => {
    websiteChannel.value = { enabled: true, ruleSets: [{ ...newRuleSet('Summer'), websiteIds: ['w1'] }] }
    const ruleSets = mountFor('lst-1').findAll('[data-testid="listing-website-rule-set"]').map(r => r.text())
    expect(ruleSets).toEqual(['Rule set: Summer', 'No rule set'])
  })

  it('links to Channels', () => {
    expect(mountFor('lst-1').find('a[href="/channels"]').exists()).toBe(true)
  })

  it('shows an empty state linking to Website Builder when no site sells the listing', () => {
    const wrapper = mountFor('lst-999')
    expect(wrapper.find('[data-testid="listing-website-row"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="listing-websites-empty"]').text()).toContain('No website sells this listing yet.')
    expect(wrapper.find('a[href="/website-builder"]').exists()).toBe(true)
  })
})
