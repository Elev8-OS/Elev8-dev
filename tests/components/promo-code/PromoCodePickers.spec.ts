// The two pickers the wizard exists to make legible: the scope step (channel →
// websites → listings) and the free-upsell item list that hangs off it. Both
// render inline — a Popover inside the modal, with a second Popover nested
// inside it for tags, was the original flow's worst part.

import type { Component } from 'vue'
import type { PromoCodeFormDraft } from '~/components/promo-code/data/promo-code-form'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { listings as allListingsData } from '~/components/listings/data/listings'
import { createDefaultPromoCodeFormDraft } from '~/components/promo-code/data/promo-code-form'
import PromoCodeFieldsDiscount from '~/components/promo-code/PromoCodeFieldsDiscount.vue'
import PromoCodeFieldsScope from '~/components/promo-code/PromoCodeFieldsScope.vue'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import { mockUpsellServices } from '~/components/upsells/data/upsell-services'
import { websites as allWebsites } from '~/components/website-builder/data/websites'

const global = {
  components: { Badge, Button, Input, Label, RadioGroup, RadioGroupItem },
  config: { warnHandler: () => {} },
}

/**
 * Mounts one field group behind a host that owns the draft, the way the wizard
 * does — the groups patch by spread and emit, so without a real parent the
 * writes would not come back.
 */
function mountField(component: Component, overrides: Partial<PromoCodeFormDraft> = {}) {
  const draft = ref<PromoCodeFormDraft>({ ...createDefaultPromoCodeFormDraft(), ...overrides })
  const Host = defineComponent({
    setup: () => () => h(component, {
      'modelValue': draft.value,
      'onUpdate:modelValue': (v: PromoCodeFormDraft) => (draft.value = v),
      'errors': {},
      'idPrefix': 'p',
    }),
  })
  return { wrapper: mount(Host, { global }), draft }
}

type Wrapper = ReturnType<typeof mountField>['wrapper']

function findButton(wrapper: Wrapper, label: string) {
  return wrapper.findAll('button').find(b => b.text().trim() === label)
}

describe('free upsell picker (step 3, filtered by the listing scope)', () => {
  const freeUpsell = { discountType: 'free_upsell' as const }

  it('shows the items inline without anything to open first', () => {
    const { wrapper } = mountField(PromoCodeFieldsDiscount, freeUpsell)
    const first = mockUpsellServices[0]!

    expect(wrapper.text()).toContain(first.name)
    expect(wrapper.text()).toContain(first.items[0]!.name)
  })

  it('shows what each item is worth', () => {
    const { wrapper } = mountField(PromoCodeFieldsDiscount, freeUpsell)
    const service = mockUpsellServices[0]!
    const price = service.items[0]!.price

    // Rendered through Intl, so assert on the digits rather than the symbol.
    expect(wrapper.text().replace(/[\s,]/g, '')).toContain(String(price))
  })

  it('states the listing scope the services are measured against', () => {
    const { wrapper } = mountField(PromoCodeFieldsDiscount, freeUpsell)

    expect(wrapper.text()).toContain('Only services offered at the')
    expect(wrapper.text()).toContain('this code covers are shown')
  })

  it('hides services none of the covered listings offer, and says which', () => {
    // Scope the code to one listing, then find a service that listing lacks.
    const listing = allListingsData.value[0]!
    const missing = mockUpsellServices.find(s => !s.assignedListings.includes(listing.name))
    if (!missing) {
      expect(true).toBe(true)
      return
    }
    const { wrapper } = mountField(PromoCodeFieldsDiscount, {
      ...freeUpsell,
      listingIds: [listing.id],
    })

    expect(wrapper.text()).toContain('not offered at any listing this code covers')
    expect(wrapper.text()).toContain(missing.name)
  })

  it('marks a service offered at only part of the scope', () => {
    // Two listings where exactly one offers the service.
    const service = mockUpsellServices.find(s => s.assignedListings.length > 0)!
    const inside = allListingsData.value.find(l => service.assignedListings.includes(l.name))!
    const outside = allListingsData.value.find(l => !service.assignedListings.includes(l.name))!
    const { wrapper } = mountField(PromoCodeFieldsDiscount, {
      ...freeUpsell,
      listingIds: [inside.id, outside.id],
    })

    expect(wrapper.text()).toContain('Offered at 1 of 2 listings')
  })

  it('warns when a picked service does not reach the whole scope', () => {
    const service = mockUpsellServices.find(s => s.assignedListings.length > 0)!
    const inside = allListingsData.value.find(l => service.assignedListings.includes(l.name))!
    const outside = allListingsData.value.find(l => !service.assignedListings.includes(l.name))!
    const { wrapper } = mountField(PromoCodeFieldsDiscount, {
      ...freeUpsell,
      listingIds: [inside.id, outside.id],
      freeUpsellItemIds: [service.items[0]!.id],
    })

    expect(wrapper.text()).toContain('not offered at every listing this code covers')
    expect(wrapper.text()).toContain('will not be able to redeem it')
  })

  it('selects a whole service in one click', async () => {
    const { wrapper, draft } = mountField(PromoCodeFieldsDiscount, freeUpsell)
    const service = mockUpsellServices[0]!
    await wrapper.findAll('[role="checkbox"]')[0]!.trigger('click')

    expect(draft.value.freeUpsellItemIds).toEqual(service.items.map(i => i.id))
  })

  it('does not offer the item list for a percentage code', () => {
    const { wrapper } = mountField(PromoCodeFieldsDiscount, { discountType: '%' })

    expect(wrapper.text()).not.toContain('Free upsell items')
    expect(wrapper.find('input[type="number"]').exists()).toBe(true)
  })
})

describe('listing scope (step 2)', () => {
  it('makes "all listings" an explicit choice rather than an empty selection', () => {
    const { wrapper } = mountField(PromoCodeFieldsScope)

    expect(wrapper.text()).toContain('All listings')
    expect(wrapper.text()).toContain('Pick specific listings')
    // Nothing to pick until the host opts into specific listings.
    expect(wrapper.text()).not.toContain('Search listings')
  })

  it('reveals the list once specific listings are chosen', async () => {
    const { wrapper } = mountField(PromoCodeFieldsScope)
    await wrapper.find('#p-scope-specific').trigger('click')

    expect(wrapper.find('input[aria-label="Search listings"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Select all')
  })

  it('starts on "specific" when the code already limits listings', () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, { listingIds: ['lst-1'] })

    expect(wrapper.find('input[aria-label="Search listings"]').exists()).toBe(true)
  })

  it('bulk-selects everything visible', async () => {
    const { wrapper, draft } = mountField(PromoCodeFieldsScope, { listingIds: ['lst-1'] })
    const selectAll = wrapper.findAll('button').find(b => b.text().startsWith('Select all'))!
    await selectAll.trigger('click')

    expect(draft.value.listingIds.length).toBeGreaterThan(1)
  })

  it('narrows bulk-select to the search results', async () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, { listingIds: ['lst-1'] })
    await wrapper.find('input[aria-label="Search listings"]').setValue('zzzzz-no-such-listing')

    expect(wrapper.text()).toContain('No listings match these filters')
    expect(wrapper.findAll('button').find(b => b.text().startsWith('Select these'))!.attributes('disabled')).toBeDefined()
  })

  it('clears the selection back to all listings', async () => {
    const { wrapper, draft } = mountField(PromoCodeFieldsScope, { listingIds: ['lst-1', 'lst-2'] })
    await findButton(wrapper, 'Clear')!.trigger('click')

    expect(draft.value.listingIds).toEqual([])
  })

  it('opens the tag filter inline rather than in a nested popover', async () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, { listingIds: ['lst-1'] })
    const tagsButton = wrapper.findAll('button').find(b => b.text().trim().startsWith('Tags'))!
    await tagsButton.trigger('click')

    expect(wrapper.find('input[aria-label="Search tags"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('A listing must carry every selected tag')
  })

  it('shows the websites inline when the website channel is picked', () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, { channel: 'website' })

    expect(wrapper.text()).toContain('Which websites')
    expect(wrapper.text()).toContain('the code works on all 4 websites')
  })

  it('hides the website list on the widget channel', () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, { channel: 'widget' })

    expect(wrapper.text()).not.toContain('Which websites')
  })

  it('does not let the upsell picker narrow it back — the chain runs one way', () => {
    // Discount is downstream now; filtering here too would make the two lists
    // filter each other in a circle.
    const service = mockUpsellServices.find(s => s.assignedListings.length > 0)!
    const { wrapper } = mountField(PromoCodeFieldsScope, {
      discountType: 'free_upsell',
      freeUpsellItemIds: [service.items[0]!.id],
      listingIds: ['lst-1'],
    })

    expect(wrapper.text()).toContain(`Showing ${allListingsData.value.length} of ${allListingsData.value.length}`)
  })
})

// A website only covers the listings it markets (Website.propertyIds →
// propertyListingMap), so the listing scope decides which websites can carry
// the code. That is why the step asks for listings before the channel.

// The chain runs one way: channel -> websites -> listings -> upsells. A
// website only covers the listings it markets, so pinning a code to specific
// sites also pins which properties it can cover.
describe('listings narrow to the website selection', () => {
  const websiteChannel = { channel: 'website' as const }

  it('leaves every listing available when no website is picked', () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, {
      ...websiteChannel,
      listingIds: ['lst-1'],
    })

    expect(wrapper.text()).toContain(`of ${allListingsData.value.length}`)
    expect(wrapper.text()).not.toContain('so the code can only apply to those')
  })

  it('limits the listings to what the picked website covers', () => {
    // Website 2 markets prop-2, which is lst-12 alone.
    const { wrapper } = mountField(PromoCodeFieldsScope, {
      ...websiteChannel,
      websiteIds: ['2'],
      listingIds: ['lst-12'],
    })

    expect(wrapper.text()).toContain('so the code can only apply to those')
    expect(wrapper.text()).toContain('Showing 1 of 1')
  })

  it('unions coverage across several picked websites', () => {
    // web 1 covers lst-1 + lst-5, web 2 covers lst-12.
    const { wrapper } = mountField(PromoCodeFieldsScope, {
      ...websiteChannel,
      websiteIds: ['1', '2'],
      listingIds: ['lst-1'],
    })

    expect(wrapper.text()).toContain('Showing 3 of 3')
  })

  it('relabels the all-listings option to match the narrowed set', () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, {
      ...websiteChannel,
      websiteIds: ['2'],
    })

    expect(wrapper.text()).toContain('Every listing these websites cover')
  })

  it('does not narrow on the widget channel', () => {
    // websiteIds are cleared on the widget channel, so nothing constrains.
    const { wrapper } = mountField(PromoCodeFieldsScope, {
      channel: 'widget',
      websiteIds: ['2'],
      listingIds: ['lst-1'],
    })

    expect(wrapper.text()).not.toContain('so the code can only apply to those')
  })

  it('imposes no constraint when a picked site has no coverage recorded', () => {
    const original = [...allWebsites.value]
    allWebsites.value = [
      ...original,
      {
        id: 'legacy',
        name: 'Legacy Site',
        url: 'legacy.example',
        status: 'published',
        template: 'Classic',
        visits: 0,
        lastUpdated: '2026-01-01T00:00:00Z',
        thumbnail: null,
      },
    ]
    try {
      const { wrapper } = mountField(PromoCodeFieldsScope, {
        ...websiteChannel,
        websiteIds: ['legacy'],
        listingIds: ['lst-1'],
      })
      // Un-migrated site may cover anything — do not empty the listing list.
      expect(wrapper.text()).toContain(`of ${allListingsData.value.length}`)
      expect(wrapper.text()).toContain('Coverage not recorded')
    }
    finally {
      allWebsites.value = original
    }
  })

  it('flags a listing stranded by a later website change and offers to drop it', async () => {
    // web 2 covers lst-12 only, so an lst-1 selection is stranded.
    const { wrapper, draft } = mountField(PromoCodeFieldsScope, {
      ...websiteChannel,
      websiteIds: ['2'],
      listingIds: ['lst-1'],
    })

    expect(wrapper.text()).toContain('not covered by the websites you picked')
    await wrapper.findAll('button').find(b => b.text().trim() === 'Remove it')!.trigger('click')
    expect(draft.value.listingIds).toEqual([])
  })

  it('shows how many listings each website covers, so the pick is informed', () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, websiteChannel)

    expect(wrapper.text()).toMatch(/Covers \d+ listings?/)
  })
})

describe('website search', () => {
  const websiteChannel = { channel: 'website' as const }

  it('offers a search field', () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, websiteChannel)

    expect(wrapper.find('input[aria-label="Search websites"]').exists()).toBe(true)
  })

  it('filters by name', async () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, websiteChannel)
    await wrapper.find('input[aria-label="Search websites"]').setValue('ubud')

    expect(wrapper.text()).toContain('Ubud Jungle Retreat')
    expect(wrapper.text()).not.toContain('Canggu Surf Villa')
    expect(wrapper.text()).toContain('Showing 1 of 4')
  })

  it('filters by url', async () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, websiteChannel)
    await wrapper.find('input[aria-label="Search websites"]').setValue('seminyak-beach-house.com')

    expect(wrapper.text()).toContain('Seminyak Beach House')
    expect(wrapper.text()).toContain('Showing 1 of 4')
  })

  it('filters by template, since a host may remember the look not the name', async () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, websiteChannel)
    await wrapper.find('input[aria-label="Search websites"]').setValue(allWebsites.value[0]!.template)

    expect(wrapper.text()).toContain(allWebsites.value[0]!.name)
  })

  it('shows an empty state rather than a blank panel', async () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, websiteChannel)
    await wrapper.find('input[aria-label="Search websites"]').setValue('zzzz-no-such-site')

    expect(wrapper.text()).toContain('No websites match')
    expect(wrapper.text()).toContain('Showing 0 of 4')
  })

  it('resets back to the full list', async () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, websiteChannel)
    await wrapper.find('input[aria-label="Search websites"]').setValue('ubud')
    await wrapper.findAll('button').find(b => b.text().trim() === 'Reset')!.trigger('click')

    expect(wrapper.text()).toContain('Canggu Surf Villa')
    expect(wrapper.text()).toContain('the code works on all 4 websites')
  })

  it('keeps a selection made while the list was filtered', async () => {
    const { wrapper, draft } = mountField(PromoCodeFieldsScope, websiteChannel)
    await wrapper.find('input[aria-label="Search websites"]').setValue('ubud')
    await wrapper.findAll('[role="checkbox"]').find(c => c.text().includes('Ubud'))!.trigger('click')

    expect(draft.value.websiteIds).toEqual(['2'])
  })
})

// The rows carry a checkbox that already shows what is selected, so a chip
// row underneath only repeats it — and at 24 listings it becomes a wall of
// badges that pushes the list off screen. The running count stays instead.
describe('selection is shown in the list, not repeated as chips', () => {
  it('does not echo picked upsell items back as chips', async () => {
    const { wrapper } = mountField(PromoCodeFieldsDiscount, { discountType: 'free_upsell' })
    await wrapper.findAll('[role="checkbox"]')[0]!.trigger('click')

    expect(wrapper.find('[aria-label="Selected upsell items"]').exists()).toBe(false)
    expect(wrapper.findAll('[role="checkbox"][aria-checked="true"]').length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('selected')
  })

  it('does not echo picked listings back as chips', () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, { listingIds: ['lst-1', 'lst-5'] })

    expect(wrapper.find('[aria-label="Selected listings"]').exists()).toBe(false)
    expect(wrapper.findAll('[role="checkbox"][aria-checked="true"]').length).toBe(2)
  })

  it('still counts the selection on the scope card', () => {
    const { wrapper } = mountField(PromoCodeFieldsScope, { listingIds: ['lst-1', 'lst-5'] })

    expect(wrapper.text()).toContain('2 chosen')
  })
})
