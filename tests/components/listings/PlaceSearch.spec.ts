import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PlaceSearch from '~/components/listings/setup/PlaceSearch.vue'

function mountSearch() {
  return mount(PlaceSearch, {
    global: {
      stubs: {
        Icon: true,
        Input: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
      },
    },
  })
}

describe('placeSearch', () => {
  it('suggests places as you type and selects one by click', async () => {
    const w = mountSearch()
    await w.find('input').setValue('seminyak')
    const options = w.findAll('[role="option"]')
    expect(options.map(o => o.text())).toEqual([expect.stringContaining('Jl. Kayu Aya, Seminyak')])
    await options[0]!.trigger('mousedown')
    expect(w.emitted('select')![0]![0]).toMatchObject({ address: { city: 'Seminyak', postalCode: '80361' } })
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('arrow keys move the highlight and Enter picks it', async () => {
    const w = mountSearch()
    const input = w.find('input')
    await input.setValue('pantai')
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(w.findAll('[role="option"]')[1]!.attributes('aria-selected')).toBe('true')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('select')).toHaveLength(1)
  })

  it('says so when nothing matches, and Escape closes the list', async () => {
    const w = mountSearch()
    await w.find('input').setValue('tokyo')
    expect(w.text()).toContain('No places match "tokyo"')
    await w.find('input').trigger('keydown', { key: 'Escape' })
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })
})
