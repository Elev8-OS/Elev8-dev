import type { Listing } from '~/components/listings/data/listings'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { listings } from '~/components/listings/data/listings'
import NearbyPlacesCard from '~/components/listings/setup/NearbyPlacesCard.vue'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

const passthrough = { template: '<div><slot /></div>' }
// The Select stub writes its model through a plain <select>, so a test can pick a value.
const SelectStub = { props: ['modelValue'], emits: ['update:modelValue'], template: '<div><select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option value="" /><option value="Beach">Beach</option><option value="m">m</option><option value="km">km</option></select><slot /></div>' }
const STUBS = {
  Icon: true,
  Label: passthrough,
  Accordion: passthrough,
  AccordionItem: passthrough,
  AccordionTrigger: passthrough,
  AccordionContent: passthrough,
  Select: SelectStub,
  SelectTrigger: passthrough,
  SelectValue: true,
  SelectContent: { template: '<template />' },
  SelectItem: true,
}

function mountCard(listing: Listing) {
  return mount(NearbyPlacesCard, { props: { listing }, global: { components: { Button, Input }, stubs: STUBS } })
}

describe('nearbyPlacesCard', () => {
  it('lists places closest first with their distance', () => {
    const wrapper = mountCard(listings.value.find(l => l.id === 'lst-1')!)
    const rows = wrapper.findAll('li').map(li => li.text())
    expect(rows[0]).toContain('Beach')
    expect(rows[0]).toContain('650 m')
    expect(rows.at(-1)).toContain('18 km')
  })

  it('adds a place in kilometres and stores metres', async () => {
    const listing = { ...listings.value[1]!, nearbyPlaces: [] }
    const wrapper = mountCard(listing)
    const selects = wrapper.findAll('select')
    await selects[0]!.setValue('Beach')
    await wrapper.find('#nearby-distance').setValue('1.5')
    await selects[1]!.setValue('km')
    await wrapper.find('[data-testid="nearby-save"]').trigger('click')
    const updated = wrapper.emitted('update')![0]![0] as Listing
    expect(updated.nearbyPlaces).toEqual([expect.objectContaining({ type: 'Beach', name: '', meters: 1500 })])
  })

  it('removes a place', async () => {
    const listing = listings.value.find(l => l.id === 'lst-1')!
    const wrapper = mountCard(listing)
    await wrapper.find('[aria-label="Remove Airport"]').trigger('click')
    const updated = wrapper.emitted('update')![0]![0] as Listing
    expect(updated.nearbyPlaces!.map(p => p.type)).toEqual(['Beach', 'Supermarket'])
  })
})
