// Listing > room type > room picker used by Manage Listings.

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { getUnits, listings } from '~/components/listings/data/listings'
import ListingRoomPicker from '~/components/shared/ListingRoomPicker.vue'
import { getListingsForProperties, selectionForListings } from '~/components/website-builder/data/property-listings'

const multi = listings.value.find(l => (l.unitTypes?.length ?? 0) > 0 && getUnits(l).length > 1)!
const single = listings.value.find(l => !(l.unitTypes?.length))!

const global = {
  stubs: {
    Icon: true,
    Button: { template: '<button><slot /></button>' },
    BaseSearchInput: { props: ['modelValue'], template: '<input data-testid="search" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)">' },
  },
  config: { warnHandler: () => {} },
}

function mountPicker(modelValue = { propertyIds: [] as string[], roomIds: [] as string[] }) {
  return mount(ListingRoomPicker, { props: { modelValue }, global })
}
const lastModel = (w: ReturnType<typeof mountPicker>) => w.emitted('update:modelValue')!.at(-1)![0] as { propertyIds: string[], roomIds: string[] }

describe('listing room picker', () => {
  it('lists every listing and starts with nothing picked', () => {
    const wrapper = mountPicker()
    expect(wrapper.findAll('[data-testid="lrp-listing"]')).toHaveLength(listings.value.length)
    expect(wrapper.get('[data-testid="lrp-summary"]').text()).toContain('0 listings')
  })

  it('ticking a multi-unit listing picks every room of it', async () => {
    const wrapper = mountPicker()
    await wrapper.get(`[aria-label="Select ${multi.name}"]`).trigger('click')
    expect(lastModel(wrapper)).toEqual({ propertyIds: [multi.id], roomIds: getUnits(multi).map(u => u.id) })
  })

  it('ticking a single-unit listing picks the listing and no rooms', async () => {
    const wrapper = mountPicker()
    await wrapper.get(`[aria-label="Select ${single.name}"]`).trigger('click')
    expect(lastModel(wrapper)).toEqual({ propertyIds: [single.id], roomIds: [] })
  })

  it('unticking the last room unticks the listing', async () => {
    const unit = getUnits(multi)[0]!
    const wrapper = mountPicker({ propertyIds: [multi.id], roomIds: [unit.id] })
    await wrapper.get(`[aria-label="Show rooms of ${multi.name}"]`).trigger('click')
    await wrapper.get(`[aria-label="Select room ${unit.name}"]`).trigger('click')
    expect(lastModel(wrapper)).toEqual({ propertyIds: [], roomIds: [] })
  })

  it('shows a listing with only some rooms picked as mixed', () => {
    const unit = getUnits(multi)[0]!
    const wrapper = mountPicker({ propertyIds: [multi.id], roomIds: [unit.id] })
    expect(wrapper.get(`[aria-label="Select ${multi.name}"]`).attributes('aria-checked')).toBe('mixed')
  })

  it('filters by listing, room type or room name', async () => {
    const wrapper = mountPicker()
    await wrapper.get('[data-testid="search"]').setValue(multi.name)
    const rows = wrapper.findAll('[data-testid="lrp-listing"]')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(listings.value.length)
    await wrapper.get('[data-testid="search"]').setValue('zzz-no-such-thing')
    expect(wrapper.text()).toContain('No listings found.')
  })

  it('select all picks every listing and room', async () => {
    const wrapper = mountPicker()
    await wrapper.get('[data-testid="lrp-select-all"]').trigger('click')
    expect(lastModel(wrapper).propertyIds).toHaveLength(listings.value.length)
    expect(lastModel(wrapper).roomIds).toHaveLength(listings.value.reduce((n, l) => n + getUnits(l).length, 0))
  })
})

describe('website listing ids', () => {
  it('resolves legacy property ids and real listing ids alike', () => {
    expect(getListingsForProperties(['prop-2'])).toEqual(['lst-12'])
    expect(getListingsForProperties([multi.id, 'prop-2'])).toEqual([multi.id, 'lst-12'])
    expect(getListingsForProperties(['nope'])).toEqual([])
  })

  it('opens a saved website with every room of its listings picked', () => {
    const sel = selectionForListings(['lst-12', multi.id])
    expect(sel.propertyIds.sort()).toEqual(['lst-12', multi.id].sort())
    expect(sel.roomIds).toEqual(expect.arrayContaining(getUnits(multi).map(u => u.id)))
  })
})
