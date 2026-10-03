import type { Listing } from '~/components/listings/data/listings'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick, toRaw } from 'vue'
import { listings } from '~/components/listings/data/listings'
import ListingSetupFieldPanel from '~/components/listings/ListingSetupFieldPanel.vue'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '~/components/ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'

const passthrough = { template: '<div><slot /></div>' }

function mountPanel(listing: Listing, section: 'basics' | 'listing-details' | 'amenities' | 'sops' | 'topics') {
  return mount(ListingSetupFieldPanel, {
    props: { listing, viewMode: 'property', hideNav: true, section },
    global: {
      components: { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Tabs, TabsContent, TabsList, TabsTrigger },
      stubs: {
        Icon: true,
        NuxtLink: true,
        FieldConfigDialog: true,
        Label: { template: '<label><slot /></label>' },
        Input: { template: '<input />' },
        Textarea: { template: '<textarea />' },
        Select: passthrough,
        SelectTrigger: passthrough,
        SelectValue: true,
        SelectContent: passthrough,
        SelectItem: passthrough,
        Button: { template: '<button><slot /></button>' },
        Badge: passthrough,
        Popover: passthrough,
        PopoverTrigger: passthrough,
        PopoverContent: passthrough,
        ScrollArea: passthrough,
        Dialog: passthrough,
        DialogContent: passthrough,
        DialogHeader: passthrough,
        DialogTitle: passthrough,
        DialogDescription: passthrough,
        DialogFooter: passthrough,
        AlertDialog: passthrough,
        AlertDialogContent: passthrough,
        AlertDialogHeader: passthrough,
        AlertDialogTitle: passthrough,
        AlertDialogDescription: passthrough,
        AlertDialogFooter: passthrough,
        AlertDialogCancel: { template: '<button><slot /></button>' },
        AlertDialogAction: { template: '<button><slot /></button>' },
        PropertyPicker: true,
        AvoidTopicDialog: true,
      },
    },
  })
}

const lst1 = () => structuredClone(toRaw(listings.value[0]!))
function state(w: ReturnType<typeof mountPanel>, testid: string) {
  return w.find(`[data-testid="${testid}"] [data-slot="accordion-trigger"]`).attributes('data-state')
}

describe('listingSetupFieldPanel accordions', () => {
  it('opens unfinished Listing Details groups and collapses finished ones', async () => {
    const listing = lst1()
    // Finish Booking; lst-1 leaves Details unfinished (no guest age, size, floors).
    listing.details = {
      ...listing.details,
      airbnbCancellationPolicy: 'Firm',
      vrboCancellationPolicy: 'Not listed on VRBO',
      paymentSchedule: 'Full balance at booking',
      bookingWindow: '12 months in advance',
    }
    const w = mountPanel(listing, 'listing-details')
    await nextTick()
    expect(state(w, 'setup-details-booking')).toBe('closed')
    expect(state(w, 'setup-details-details')).toBe('open')
  })

  it('toggles a group from its header', async () => {
    const w = mountPanel(lst1(), 'listing-details')
    await nextTick()
    const trigger = w.find('[data-testid="setup-details-details"] [data-slot="accordion-trigger"]')
    expect(trigger.attributes('data-state')).toBe('open')
    await trigger.trigger('click')
    expect(trigger.attributes('data-state')).toBe('closed')
    await trigger.trigger('click')
    expect(trigger.attributes('data-state')).toBe('open')
  })

  it('collapses the Location card when the address is complete', async () => {
    const w = mountPanel(lst1(), 'basics')
    await nextTick()
    expect(state(w, 'setup-location')).toBe('closed')
  })
})

describe('listingSetupFieldPanel amenities', () => {
  const row = (w: ReturnType<typeof mountPanel>, name: string) =>
    w.findAll('[data-testid^="setup-amenity-grid"] [role="checkbox"]').find(r => r.text() === name)!

  it('lists the property amenities ticked from listing.amenities, pencil only on ticked ones', async () => {
    const w = mountPanel(lst1(), 'amenities')
    await nextTick()
    expect(row(w, 'Pool').attributes('aria-checked')).toBe('true')
    expect(row(w, 'Pool').find('[aria-label="Pool AI settings"]').exists()).toBe(true)
    expect(row(w, 'Hot tub').attributes('aria-checked')).toBe('false')
    expect(row(w, 'Hot tub').find('button').exists()).toBe(false)
  })

  it('groups property amenities into Outdoor, Family and More, with older values under Other', async () => {
    const listing = lst1()
    listing.amenities = [...listing.amenities, 'Sauna']
    const w = mountPanel(listing, 'amenities')
    await nextTick()
    const groups = w.findAll('[data-testid^="setup-amenities-"]').map(g => g.attributes('data-testid'))
    expect(groups).toEqual(['setup-amenities-outdoor', 'setup-amenities-family', 'setup-amenities-more', 'setup-amenities-other'])
    expect(w.find('[data-testid="setup-amenity-grid-other"]').text()).toContain('Sauna')
    expect(w.find('[data-testid="setup-amenity-grid-family"]').text()).toContain('Baby monitor')
  })

  it('a search hides groups with no match', async () => {
    const w = mountPanel(lst1(), 'amenities')
    await nextTick()
    ;(w.vm as any).amenitySearch = 'kayak'
    await nextTick()
    expect(w.findAll('[data-testid^="setup-amenities-"]').map(g => g.attributes('data-testid'))).toEqual(['setup-amenities-outdoor'])
  })

  it('ticking a property amenity adds it to listing.amenities', async () => {
    const w = mountPanel(lst1(), 'amenities')
    await nextTick()
    await row(w, 'Hot tub').trigger('click')
    expect((w.emitted('update')![0]![0] as Listing).amenities).toContain('Hot tub')
  })

  it('the Room tab ticks into the selected room type only', async () => {
    const listing = lst1()
    const w = mountPanel(listing, 'amenities')
    await nextTick()
    await w.findAll('button').find(b => b.text() === 'Room')!.trigger('click')
    expect(row(w, 'TV').attributes('aria-checked')).toBe('true')
    await row(w, 'Toaster').trigger('click')
    const updated = w.emitted('update')![0]![0] as Listing
    expect(updated.unitTypes![0]!.amenities).toContain('Toaster')
    expect(updated.unitTypes![1]!.amenities).not.toContain('Toaster')
    expect(updated.amenities).toEqual(listing.amenities)
  })

  it('the pencil opens the field settings without toggling the row', async () => {
    const w = mountPanel(lst1(), 'amenities')
    await nextTick()
    await row(w, 'Pool').find('[aria-label="Pool AI settings"]').trigger('click')
    expect(w.emitted('update')).toBeUndefined()
    expect(w.findComponent({ name: 'FieldConfigDialog' }).exists()).toBe(true)
  })
})

describe('listingSetupFieldPanel SOPs', () => {
  it('shows the six SOP groups, all open while unanswered', async () => {
    const w = mountPanel(lst1(), 'sops')
    await nextTick()
    const cards = w.findAll('[data-testid^="setup-sops-"]')
    expect(cards.map(c => c.attributes('data-testid'))).toEqual([
      'setup-sops-check-in-out',
      'setup-sops-requests',
      'setup-sops-rules',
      'setup-sops-issues',
      'setup-sops-emergencies',
      'setup-sops-other',
    ])
    expect(cards.every(c => c.find('[data-slot="accordion-trigger"]').attributes('data-state') === 'open')).toBe(true)
  })

  it('add SOP appends a custom SOP and counts it in the Other header', async () => {
    const w = mountPanel(lst1(), 'sops')
    await nextTick()
    const other = () => w.find('[data-testid="setup-sops-other"]')
    expect(other().text()).toContain('1 field')
    await other().findAll('button').find(b => b.text().includes('Add SOP'))!.trigger('click')
    const updated = w.emitted('update')![0]![0] as Listing
    expect(updated.sops?.custom).toHaveLength(1)
    await w.setProps({ listing: updated })
    expect(other().text()).toContain('2 fields')
    expect(other().find('[aria-label="SOP title"]').exists()).toBe(true)
  })
})

describe('listingSetupFieldPanel custom SOPs per group', () => {
  it('every group has Add SOP, and a new SOP lands in the group it was added from', async () => {
    const w = mountPanel(lst1(), 'sops')
    await nextTick()
    const card = (key: string) => w.find(`[data-testid="setup-sops-${key}"]`)
    for (const key of ['check-in-out', 'requests', 'rules', 'issues', 'emergencies', 'other'])
      expect(card(key).findAll('button').some(b => b.text().includes('Add SOP'))).toBe(true)
    await card('rules').findAll('button').find(b => b.text().includes('Add SOP'))!.trigger('click')
    const updated = w.emitted('update')![0]![0] as Listing
    expect(updated.sops!.custom!.at(-1)!.group).toBe('rules')
    await w.setProps({ listing: updated })
    expect(card('rules').find('[aria-label="SOP title"]').exists()).toBe(true)
    expect(card('other').find('[aria-label="SOP title"]').exists()).toBe(false)
    expect(card('rules').text()).toContain('2 fields')
  })

  it('a custom SOP has a pencil that opens its AI settings', async () => {
    const listing = lst1()
    listing.sops = { custom: [{ id: 'c1', title: 'Pool cleaning', text: 'Daily', group: 'requests' }] }
    const w = mountPanel(listing, 'sops')
    await nextTick()
    await w.find('[aria-label="Pool cleaning AI settings"]').trigger('click')
    expect(w.emitted('update')).toBeUndefined()
    expect(w.findComponent({ name: 'FieldConfigDialog' }).exists()).toBe(true)
  })
})

describe('listingSetupFieldPanel deleting default SOPs', () => {
  it('deleting every question of a section keeps the section at 0 fields, with Restore', async () => {
    const listing = lst1()
    listing.sops = {}
    const w = mountPanel(listing, 'sops')
    await nextTick()
    await w.find('[data-testid="bulk-select"]').trigger('click')
    await w.find('[aria-label="Select all in Check-In & Check-Out"]').trigger('click')
    await w.find('[data-testid="bulk-delete-confirm"]').trigger('click')
    const updated = w.emitted('update')![0]![0] as Listing
    await w.setProps({ listing: updated })
    const card = w.find('[data-testid="setup-sops-check-in-out"]')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('0 fields')
    expect(card.find('[aria-label="What happens when a guest checks in? AI settings"]').exists()).toBe(false)
    await card.find('[data-testid="restore-sops-check-in-out"]').trigger('click')
    const restored = w.emitted('update')![1]![0] as Listing
    await w.setProps({ listing: restored })
    expect(w.find('[data-testid="setup-sops-check-in-out"]').text()).toContain('2 fields')
  })
})

describe('listingSetupFieldPanel bulk select', () => {
  it('ticks only appear after Select; a ticked topic can be deleted on its own', async () => {
    const w = mountPanel(lst1(), 'topics')
    await nextTick()
    expect(w.find('[aria-label="Select Refund requests"]').exists()).toBe(false)
    expect(w.find('[data-testid="bulk-delete"]').exists()).toBe(false)
    await w.find('[data-testid="bulk-select"]').trigger('click')
    await w.find('[aria-label="Select Refund requests"]').trigger('click')
    expect(w.find('[data-testid="setup-bulk-bar"]').text()).toContain('1 topic selected')
    await w.find('[data-testid="bulk-delete-confirm"]').trigger('click')
    const updated = w.emitted('update')![0]![0] as Listing
    expect(updated.resources.avoidTopics!.map(t => t.topic)).toEqual(['Discount requests'])
  })

  it('topics have one select-all in the bar; Cancel leaves select mode and clears it', async () => {
    const w = mountPanel(lst1(), 'topics')
    await nextTick()
    await w.find('[data-testid="bulk-select"]').trigger('click')
    await w.find('[data-testid="setup-bulk-bar"] [role="checkbox"]').trigger('click')
    expect(w.find('[data-testid="setup-bulk-bar"]').text()).toContain('2 topics selected')
    await w.find('[data-testid="bulk-cancel"]').trigger('click')
    expect(w.find('[aria-label="Select Refund requests"]').exists()).toBe(false)
    await w.find('[data-testid="bulk-select"]').trigger('click')
    expect(w.find('[data-testid="setup-bulk-bar"]').text()).toContain('Select topics to copy or delete them')
  })

  it('each SOP group has a select-all covering every default question and its custom SOPs', async () => {
    const listing = lst1()
    listing.sops = {
      checkInProcedure: 'Meet at the gate',
      custom: [{ id: 'c1', title: 'Late arrivals', text: 'Use the lockbox', group: 'check-in-out' }],
    }
    listing.resources = { ...listing.resources, sops: '' }
    const w = mountPanel(listing, 'sops')
    await nextTick()
    expect(w.find('[aria-label="Select all in Check-In & Check-Out"]').exists()).toBe(false)
    await w.find('[data-testid="bulk-select"]').trigger('click')
    // Unanswered default questions are selectable too.
    const checkOut = () => w.find('[aria-label="Select What happens when a guest checks out?"]')
    expect(checkOut().exists()).toBe(true)
    await w.find('[aria-label="Select all in Check-In & Check-Out"]').trigger('click')
    expect(w.find('[data-testid="setup-bulk-bar"]').text()).toContain('3 SOPs selected')
    expect(w.find('[aria-label="Select Late arrivals"]').attributes('aria-checked')).toBe('true')
    expect(w.find('[aria-label="Select What happens when a guest checks in?"]').attributes('aria-checked')).toBe('true')
    // Individual items still toggle on their own; the group then shows the mixed state.
    await checkOut().trigger('click')
    expect(checkOut().attributes('aria-checked')).toBe('false')
    expect(w.find('[aria-label="Select all in Check-In & Check-Out"]').attributes('aria-checked')).toBe('mixed')
    expect(w.find('[data-testid="setup-bulk-bar"]').text()).toContain('2 SOPs selected')
    // Another group's questions stay unselected.
    expect(w.find('[aria-label="Select all in Guest Requests"]').attributes('aria-checked')).toBe('false')
  })
})
