import type { Listing } from '~/components/listings/data/listings'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { toRaw } from 'vue'
import { bedArea, bedsSleep, bedsSummary, capacityCheck, setSleepingExtras, setUnitTypeBeds, sleepingAreas, unitTypeOf } from '~/components/listings/data/listing-sleeping'
import { listings } from '~/components/listings/data/listings'
import SleepingArrangementCard from '~/components/listings/setup/SleepingArrangementCard.vue'

const lst1 = (): Listing => JSON.parse(JSON.stringify(toRaw(listings.value[0]!)))
const passthrough = { template: '<div><slot /></div>' }

function mountCard(listing: Listing, unitTypeId: string) {
  return mount(SleepingArrangementCard, {
    props: { listing, unitTypeId },
    global: {
      stubs: {
        Icon: true,
        Label: { template: '<label><slot /></label>' },
        Select: passthrough,
        SelectTrigger: passthrough,
        SelectValue: true,
        SelectContent: passthrough,
        SelectItem: passthrough,
        Switch: { props: ['modelValue'], emits: ['update:modelValue'], template: '<button role="switch" :aria-checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)" />' },
        Button: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
      },
    },
  })
}

describe('sleeping arrangement helpers', () => {
  it('counts how many people the beds sleep', () => {
    expect(bedsSleep([{ id: 'a', type: 'King Bed', count: 1 }, { id: 'b', type: 'Single Bed', count: 2 }])).toBe(4)
    expect(bedsSleep([{ id: 'a', type: 'Hammock', count: 1 }])).toBe(1)
  })

  it('summarises the beds', () => {
    expect(bedsSummary([{ id: 'a', type: 'King Bed', count: 1 }, { id: 'b', type: 'Single Bed', count: 2 }])).toBe('1 King Bed, 2 Single Beds')
  })

  it('writes beds and extras to the room type only', () => {
    const l = lst1()
    const [first, second] = l.unitTypes!
    const next = setSleepingExtras(setUnitTypeBeds(l, first!.id, []), first!.id, { babyCot: true })
    expect(next.unitTypes![0]).toMatchObject({ beds: [], sleepingExtras: { babyCot: true } })
    expect(next.unitTypes![1]!.beds).toEqual(second!.beds)
    expect(unitTypeOf(l, first!.units[0]!.id)!.id).toBe(first!.id)
  })
})

describe('following the room type settings', () => {
  it('one section per bedroom, then other sleeping areas', () => {
    const ut = { ...lst1().unitTypes![0]!, bedrooms: 2 }
    expect(sleepingAreas(ut).map(a => a.label)).toEqual(['Bedroom 1', 'Bedroom 2', 'Other sleeping areas'])
    expect(sleepingAreas({ ...ut, bedrooms: 1 }).map(a => a.label)).toEqual(['Bedroom', 'Other sleeping areas'])
  })

  it('a bed in a bedroom the room type no longer has shows in the last bedroom', () => {
    const ut = { ...lst1().unitTypes![0]!, bedrooms: 1 }
    expect(bedArea({ id: 'a', type: 'King Bed', count: 1, room: 3 }, ut)).toBe(1)
    expect(bedArea({ id: 'b', type: 'Sofa Bed', count: 1, room: 0 }, ut)).toBe(0)
    expect(bedArea({ id: 'c', type: 'King Bed', count: 1 }, ut)).toBe(1)
  })

  it('compares what the beds sleep with the max guests (adults and children)', () => {
    const ut = { ...lst1().unitTypes![0]!, maxAdults: 2, maxChildren: 1 }
    expect(capacityCheck({ ...ut, beds: [{ id: 'a', type: 'Double Bed', count: 1 }] })).toEqual({ sleeps: 2, max: 3, status: 'short' })
    expect(capacityCheck({ ...ut, beds: [{ id: 'a', type: 'Double Bed', count: 1 }, { id: 'b', type: 'Single Bed', count: 1 }] }).status).toBe('match')
    expect(capacityCheck({ ...ut, beds: [{ id: 'a', type: 'King Bed', count: 2 }] }).status).toBe('extra')
  })
})

describe('sleepingArrangementCard', () => {
  it('warns when the beds sleep fewer guests than the room type allows', () => {
    const l = lst1()
    Object.assign(l.unitTypes![0]!, { maxAdults: 2, maxChildren: 1, beds: [{ id: 'a', type: 'Double Bed', count: 1 }] })
    const w = mountCard(l, l.unitTypes![0]!.id)
    expect(w.find('[data-testid="sleeping-capacity-note"]').text()).toContain('The beds sleep 2, but this room type allows 3 guests.')
  })

  it('shows a section per bedroom and adds a bed to the section it was added from', async () => {
    const l = lst1()
    Object.assign(l.unitTypes![0]!, { bedrooms: 2 })
    const w = mountCard(l, l.unitTypes![0]!.id)
    expect(w.find('[data-testid="sleeping-area-2"]').exists()).toBe(true)
    await w.find('[data-testid="sleeping-add-2"]').trigger('click')
    expect((w.emitted('update')![0]![0] as Listing).unitTypes![0]!.beds.at(-1)).toMatchObject({ room: 2, type: 'Double Bed' })
    await w.find('[data-testid="sleeping-add-0"]').trigger('click')
    expect((w.emitted('update')![1]![0] as Listing).unitTypes![0]!.beds.at(-1)).toMatchObject({ room: 0, type: 'Sofa Bed' })
  })

  it('names the rooms that share it and shows who it sleeps', () => {
    const l = lst1()
    const ut = l.unitTypes![0]!
    const w = mountCard(l, ut.id)
    expect(w.text().replace(/\s+/g, ' ')).toContain(`Shared by every ${ut.name} room: ${ut.units.map(u => u.name).join(', ')}.`)
    expect(w.find('[data-testid="sleeping-sleeps"]').text()).toBe(`Sleeps ${bedsSleep(ut.beds)} of ${ut.maxAdults + ut.maxChildren}`)
  })

  it('adds a bed, steps a count and removes a bed', async () => {
    const l = lst1()
    const ut = l.unitTypes![0]!
    const w = mountCard(l, ut.id)
    await w.find('[data-testid="sleeping-add-1"]').trigger('click')
    const added = w.emitted('update')![0]![0] as Listing
    expect(added.unitTypes![0]!.beds).toHaveLength(ut.beds.length + 1)
    await w.setProps({ listing: added })
    await w.find(`[aria-label="One more ${ut.beds[0]!.type}"]`).trigger('click')
    expect((w.emitted('update')![1]![0] as Listing).unitTypes![0]!.beds[0]!.count).toBe(ut.beds[0]!.count + 1)
    await w.find(`[aria-label="Remove ${ut.beds[0]!.type}"]`).trigger('click')
    expect((w.emitted('update')![2]![0] as Listing).unitTypes![0]!.beds).toHaveLength(ut.beds.length)
  })

  it('a count cannot go below one', () => {
    const l = lst1()
    l.unitTypes![0]!.beds = [{ id: 'b1', type: 'King Bed', count: 1 }]
    const w = mountCard(l, l.unitTypes![0]!.id)
    expect(w.find('[aria-label="One less King Bed"]').attributes('disabled')).toBeDefined()
  })

  it('toggles an extra bed on request', async () => {
    const l = lst1()
    const w = mountCard(l, l.unitTypes![0]!.id)
    await w.findAll('[role="switch"]')[0]!.trigger('click')
    expect((w.emitted('update')![0]![0] as Listing).unitTypes![0]!.sleepingExtras).toEqual({ extraBed: true })
  })
})
