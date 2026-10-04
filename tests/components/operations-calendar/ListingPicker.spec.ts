import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ListingPicker from '~/components/operations-calendar/ListingPicker.vue'

const passthrough = { template: '<div><slot /></div>' }

function mountPicker(props: Record<string, unknown> = {}) {
  return mount(ListingPicker, {
    props: { modelValue: '', ...props },
    global: {
      stubs: {
        Icon: true,
        Popover: passthrough,
        PopoverTrigger: passthrough,
        PopoverContent: passthrough,
        ScrollArea: passthrough,
        Button: { template: '<button><slot /></button>' },
      },
    },
  })
}

describe('listingPicker', () => {
  it('lists listings only, with no property or room-text group headers', () => {
    const w = mountPicker()
    expect(w.findAll('[data-testid="picker-listing"]').length).toBeGreaterThan(1)
    expect(w.findAll('[data-testid="picker-room"]')).toHaveLength(0)
    expect(w.text()).not.toContain('Canggu Properties')
  })

  it('with pick-rooms, a multi-unit listing shows its rooms and picking one sets the room', async () => {
    const w = mountPicker({ pickRooms: true })
    const rooms = w.findAll('[data-testid="picker-room"]')
    expect(rooms.map(r => r.text())).toEqual(expect.arrayContaining([expect.stringContaining('Master Suite')]))
    await rooms.find(r => r.text().includes('Master Suite'))!.trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual(['lst-1'])
    expect(w.emitted('update:unitId')![0]).toEqual(['un-1'])
  })

  it('picking the listing itself means the whole property (no room)', async () => {
    const w = mountPicker({ pickRooms: true })
    await w.findAll('[data-testid="picker-listing"]').find(r => r.text().includes('Villa Luwa'))!.trigger('click')
    expect(w.emitted('update:unitId')![0]).toEqual([null])
  })

  it('shows the listing and room on the trigger', () => {
    const w = mountPicker({ pickRooms: true, modelValue: 'lst-1', unitId: 'un-1' })
    expect(w.text()).toContain('· Master Suite')
  })
})
