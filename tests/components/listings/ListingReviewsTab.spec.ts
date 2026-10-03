import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { listings } from '~/components/listings/data/listings'
import ListingReviewsTab from '~/components/listings/ListingReviewsTab.vue'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { useReviewHub } from '~/composables/useReviewHub'

const STUBS = {
  Icon: true,
  Progress: true,
  ClientOnly: { template: '<div><slot /></div>' },
  // Lists the ids it was given, so the test reads what the tab passes to the hub's table.
  FeedTable: { props: ['items', 'page', 'pageSize'], template: '<ul data-testid="feed"><li v-for="i in items" :key="i.id" :data-source="i.review_record.source">{{ i.id }}</li></ul>' },
  DetailDrawer: { props: ['open', 'item'], template: '<div />' },
}
const COMPONENTS = { Button, Card }

function mountTab(listingId = 'lst-1') {
  const listing = listings.value.find(l => l.id === listingId)!
  return mount(ListingReviewsTab, { props: { listing }, global: { components: COMPONENTS, stubs: STUBS } })
}

describe('listingReviewsTab', () => {
  it('shows the Review Hub records for this listing, and only those', () => {
    const { reviewRecords } = useReviewHub()
    const expected = reviewRecords.value.filter(r => r.listing_id === 'lst-1').map(r => r.id).sort()
    const shown = mountTab().findAll('[data-testid="feed"] li').map(li => li.text()).sort()
    expect(expected.length).toBeGreaterThan(0)
    expect(shown).toEqual(expected)
  })

  it('filters by channel', async () => {
    const wrapper = mountTab()
    await wrapper.get('[data-testid="reviews-channel-airbnb"]').trigger('click')
    await nextTick()
    const sources = wrapper.findAll('[data-testid="feed"] li').map(li => li.attributes('data-source'))
    expect(sources.length).toBeGreaterThan(0)
    expect(new Set(sources)).toEqual(new Set(['airbnb']))
  })

  it('filters by reply status', async () => {
    const { reviewRecords, getComputedStatus } = useReviewHub()
    const expected = reviewRecords.value.filter(r => r.listing_id === 'lst-1' && getComputedStatus(r) === 'replied').map(r => r.id).sort()
    const wrapper = mountTab()
    await wrapper.get('[data-testid="reviews-status-replied"]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-testid="feed"] li').map(li => li.text()).sort()).toEqual(expected)
  })

  it('shows no average for a listing with no reviews', () => {
    const { reviewRecords } = useReviewHub()
    const empty = listings.value.find(l => !reviewRecords.value.some(r => r.listing_id === l.id))!
    expect(mountTab(empty.id).get('[data-testid="reviews-average"]').text()).toBe('-')
  })
})
